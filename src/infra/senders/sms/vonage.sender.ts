import type {
  INotificationSender,
  NotificationChannel,
  NotificationContent,
  NotificationRecipient,
  NotificationResult,
} from "../../../core";

export interface VonageConfig {
  apiKey: string;
  apiSecret: string;
  from: string;
}

/**
 * SMS sender implementation using Vonage (formerly Nexmo)
 */
export class VonageSmsSender implements INotificationSender {
  readonly channel: NotificationChannel = "sms" as NotificationChannel;
  private client: any = null;

  constructor(private readonly config: VonageConfig) {}

  /**
   * Initialize Vonage client lazily
   */
  private async getClient(): Promise<any> {
    if (this.client) {
      return this.client;
    }

    // Dynamic import to avoid requiring @vonage/server-sdk at build time
    // @ts-expect-error - @vonage/server-sdk is an optional peer dependency
    const { Vonage } = await import("@vonage/server-sdk");

    this.client = new Vonage({
      apiKey: this.config.apiKey,
      apiSecret: this.config.apiSecret,
    });

    return this.client;
  }

  async send(
    _recipient: NotificationRecipient,
    _content: NotificationContent,
  ): Promise<NotificationResult> {
    try {
      if (!_recipient.phone) {
        return {
          success: false,
          notificationId: _recipient.id,
          error: "Recipient phone number is required",
        };
      }

      const client = await this.getClient();

      const response = await client.sms.send({
        to: _recipient.phone,
        from: this.config.from,
        text: _content.body,
      });

      const message = response.messages[0];

      if (message.status === "0") {
        return {
          success: true,
          notificationId: _recipient.id,
          providerMessageId: message["message-id"],
          metadata: {
            networkCode: message["network-code"],
            price: message["message-price"],
            remainingBalance: message["remaining-balance"],
          },
        };
      } else {
        return {
          success: false,
          notificationId: _recipient.id,
          error: message["error-text"] || "Failed to send SMS via Vonage",
        };
      }
    } catch (error) {
      return {
        success: false,
        notificationId: _recipient.id,
        error: error instanceof Error ? error.message : "Failed to send SMS via Vonage",
      };
    }
  }

  async isReady(): Promise<boolean> {
    try {
      const client = await this.getClient();
      // Check if client is initialized
      return !!client;
    } catch {
      return false;
    }
  }

  validateRecipient(_recipient: NotificationRecipient): boolean {
    return !!_recipient.phone && this.isValidPhoneNumber(_recipient.phone);
  }

  private isValidPhoneNumber(phone: string): boolean {
    // Basic E.164 format validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }
}
