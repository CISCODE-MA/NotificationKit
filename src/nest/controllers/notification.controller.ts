import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";

import type {
  BulkSendNotificationDto,
  CreateNotificationDto,
  QueryNotificationsDto,
  SendNotificationDto,
} from "../../core/dtos";
import { NotificationNotFoundError, ValidationError } from "../../core/errors";
import type { NotificationService } from "../../core/notification.service";
import { NOTIFICATION_KIT_OPTIONS, NOTIFICATION_SERVICE } from "../constants";
import type { NotificationKitModuleOptions } from "../interfaces";

/**
 * REST API controller for notification operations
 */
@Controller()
export class NotificationController {
  private readonly prefix: string;

  constructor(
    @Inject(NOTIFICATION_SERVICE)
    private readonly notificationService: NotificationService,
    @Inject(NOTIFICATION_KIT_OPTIONS)
    private readonly options: NotificationKitModuleOptions,
  ) {
    this.prefix = options.apiPrefix || "notifications";
  }

  /**
   * Send a notification
   * POST /notifications/send
   */
  @Post("send")
  @HttpCode(HttpStatus.CREATED)
  async send(@Body() dto: SendNotificationDto) {
    try {
      return await this.notificationService.send(dto);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * Send bulk notifications
   * POST /notifications/bulk-send
   */
  @Post("bulk-send")
  @HttpCode(HttpStatus.ACCEPTED)
  async bulkSend(@Body() dto: BulkSendNotificationDto) {
    try {
      // Convert bulk DTO to individual send requests
      const results = await Promise.allSettled(
        dto.recipients.map((recipient) =>
          this.notificationService.send({
            ...dto,
            recipient,
          }),
        ),
      );

      return {
        total: results.length,
        succeeded: results.filter((r: PromiseSettledResult<any>) => r.status === "fulfilled")
          .length,
        failed: results.filter((r: PromiseSettledResult<any>) => r.status === "rejected").length,
        results: results.map((r: PromiseSettledResult<any>, index: number) => ({
          index,
          status: r.status,
          notification: r.status === "fulfilled" ? r.value : undefined,
          error: r.status === "rejected" ? String(r.reason) : undefined,
        })),
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * Create a notification without sending
   * POST /notifications
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateNotificationDto) {
    try {
      return await this.notificationService.create(dto);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * Get notification by ID
   * GET /notifications/:id
   */
  @Get(":id")
  async getById(@Param("id") id: string) {
    try {
      return await this.notificationService.getById(id);
    } catch (error) {
      if (error instanceof NotificationNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  /**
   * Query notifications
   * GET /notifications
   */
  @Get()
  async query(@Query() queryDto: QueryNotificationsDto) {
    try {
      // Build query criteria
      const criteria: any = {
        limit: queryDto.limit,
        offset: queryDto.offset,
      };

      if (queryDto.recipientId) criteria.recipientId = queryDto.recipientId;
      if (queryDto.channel) criteria.channel = queryDto.channel;
      if (queryDto.status) criteria.status = queryDto.status;
      if (queryDto.priority) criteria.priority = queryDto.priority;
      if (queryDto.fromDate) criteria.fromDate = queryDto.fromDate;
      if (queryDto.toDate) criteria.toDate = queryDto.toDate;

      const [notifications, total] = await Promise.all([
        this.notificationService.query(criteria),
        this.notificationService.count(criteria),
      ]);

      return {
        data: notifications,
        total,
        limit: queryDto.limit,
        offset: queryDto.offset,
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * Retry sending a notification
   * POST /notifications/:id/retry
   */
  @Post(":id/retry")
  @HttpCode(HttpStatus.OK)
  async retry(@Param("id") id: string) {
    try {
      return await this.notificationService.retry(id);
    } catch (error) {
      if (error instanceof NotificationNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  /**
   * Cancel a notification
   * DELETE /notifications/:id/cancel
   */
  @Delete(":id/cancel")
  @HttpCode(HttpStatus.OK)
  async cancel(@Param("id") id: string) {
    try {
      return await this.notificationService.cancel(id);
    } catch (error) {
      if (error instanceof NotificationNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  /**
   * Mark notification as delivered (webhook callback)
   * PATCH /notifications/:id/delivered
   */
  @Patch(":id/delivered")
  @HttpCode(HttpStatus.OK)
  async markAsDelivered(@Param("id") id: string, @Body() body: { metadata?: Record<string, any> }) {
    try {
      return await this.notificationService.markAsDelivered(id, body.metadata);
    } catch (error) {
      if (error instanceof NotificationNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
