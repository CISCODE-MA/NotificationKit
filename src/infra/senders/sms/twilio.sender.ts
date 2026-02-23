import type {
  INotificationSender,
  NotificationChannel,
  NotificationContent,
  NotificationRecipient,
  NotificationResult,
} from "../../../core";

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

/**
 * SMS sender implementation using Twilio
 */
export class TwilioSmsSender implements INotificationSender {
  readonly channel: NotificationChannel = "sms" as NotificationChannel;
  private client: any = null;

  constructor(private readonly config: TwilioConfig) {}

  /**
   * Initialize Twilio client lazily
   */
  private async getClient(): Promise<any> {
    if (this.client) {
      return this.client;
    }

    // Dynamic import to avoid requiring twilio at build time
    // @ts-expect-error - twilio is an optional peer dependency
    const twilio = await import("twilio");
    this.client = twilio.default(this.config.accountSid, this.config.authToken);

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

      const message = await client.messages.create({
        body: _content.body,
        from: this.config.fromNumber,
        to: _recipient.phone,
      });

      return {
        success: true,
        notificationId: _recipient.id,
        providerMessageId: message.sid,
        metadata: {
          status: message.status,
          price: message.price,
          priceUnit: message.priceUnit,
        },
      };
    } catch (error) {
      return {
        success: false,
        notificationId: _recipient.id,
        error: error instanceof Error ? error.message : "Failed to send SMS via Twilio",
      };
    }
  }

  async isReady(): Promise<boolean> {
    try {
      const client = await this.getClient();
      // Try to fetch account info to verify credentials
      await client.api.accounts(this.config.accountSid).fetch();
      return true;
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
