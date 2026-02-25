import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";

import { NotificationNotFoundError } from "../../core/errors";
import type { NotificationService } from "../../core/notification.service";
import { NOTIFICATION_KIT_OPTIONS, NOTIFICATION_SERVICE } from "../constants";
import type { NotificationKitModuleOptions } from "../interfaces";

/**
 * Webhook payload from notification providers
 */
interface WebhookPayload {
  notificationId: string;
  status?: "delivered" | "failed" | "bounced" | "complained";
  deliveredAt?: string;
  provider?: string;
  metadata?: Record<string, any>;
}

/**
 * Webhook controller for receiving delivery status callbacks from providers
 */
@Controller()
export class WebhookController {
  private readonly path: string;
  private readonly secret: string | undefined;

  constructor(
    @Inject(NOTIFICATION_SERVICE)
    private readonly notificationService: NotificationService,
    @Inject(NOTIFICATION_KIT_OPTIONS)
    private readonly options: NotificationKitModuleOptions,
  ) {
    this.path = options.webhookPath || "webhooks/notifications";
    this.secret = options.webhookSecret;
  }

  /**
   * Handle webhook callbacks from notification providers
   * POST /webhooks/notifications
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers("x-webhook-secret") webhookSecret: string | undefined,
    @Headers("x-webhook-signature") webhookSignature: string | undefined,
    @Body() payload: WebhookPayload | WebhookPayload[],
  ) {
    // Verify webhook secret if configured
    if (this.secret) {
      if (!webhookSecret && !webhookSignature) {
        throw new UnauthorizedException("Missing webhook authentication");
      }

      if (webhookSecret && webhookSecret !== this.secret) {
        throw new UnauthorizedException("Invalid webhook secret");
      }

      // TODO: Implement signature verification for production use
      // This would verify HMAC signatures from providers like AWS SNS, Twilio, etc.
    }

    try {
      // Handle single or batch webhooks
      const payloads = Array.isArray(payload) ? payload : [payload];
      const results = [];

      for (const item of payloads) {
        try {
          // Validate payload
          if (!item.notificationId) {
            throw new BadRequestException("Missing notificationId in webhook payload");
          }

          // Process based on status
          if (item.status === "delivered") {
            const notification = await this.notificationService.markAsDelivered(
              item.notificationId,
              item.metadata,
            );
            results.push({ success: true, notificationId: item.notificationId, notification });
          } else if (item.status === "failed" || item.status === "bounced") {
            // Mark as failed and potentially retry
            const notification = await this.notificationService.getById(item.notificationId);
            if (notification.retryCount < (notification.maxRetries || 3)) {
              await this.notificationService.retry(item.notificationId);
              results.push({
                success: true,
                notificationId: item.notificationId,
                action: "retried",
              });
            } else {
              results.push({
                success: true,
                notificationId: item.notificationId,
                action: "max_retries_reached",
              });
            }
          } else {
            // Unknown status, just log it
            results.push({
              success: true,
              notificationId: item.notificationId,
              action: "logged",
              status: item.status,
            });
          }
        } catch (error) {
          if (error instanceof NotificationNotFoundError) {
            results.push({
              success: false,
              notificationId: item.notificationId,
              error: "notification_not_found",
            });
          } else {
            results.push({
              success: false,
              notificationId: item.notificationId,
              error: String(error),
            });
          }
        }
      }

      return {
        received: payloads.length,
        processed: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to process webhook: ${String(error)}`);
    }
  }
}
