import type {
  INotificationSender,
  NotificationChannel,
  NotificationContent,
  NotificationRecipient,
  NotificationResult,
} from "../../../core";

export interface AwsSnsConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  senderName?: string;
}

/**
 * SMS sender implementation using AWS SNS
 */
export class AwsSnsSender implements INotificationSender {
  readonly channel: NotificationChannel = "sms" as NotificationChannel;
  private sns: any = null;

  constructor(private readonly config: AwsSnsConfig) {}

  /**
   * Initialize AWS SNS client lazily
   */
  private async getClient(): Promise<any> {
    if (this.sns) {
      return this.sns;
    }

    // Dynamic import to avoid requiring @aws-sdk at build time
    // @ts-expect-error - @aws-sdk/client-sns is an optional peer dependency
    const { SNSClient, PublishCommand } = await import("@aws-sdk/client-sns");

    this.sns = {
      client: new SNSClient({
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
      }),
      PublishCommand,
    };

    return this.sns;
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

      const { client, PublishCommand } = await this.getClient();

      const params: any = {
        Message: _content.body,
        PhoneNumber: _recipient.phone,
      };

      if (this.config.senderName) {
        params.MessageAttributes = {
          "AWS.SNS.SMS.SenderID": {
            DataType: "String",
            StringValue: this.config.senderName,
          },
        };
      }

      const command = new PublishCommand(params);
      const response = await client.send(command);

      return {
        success: true,
        notificationId: _recipient.id,
        providerMessageId: response.MessageId,
        metadata: {
          sequenceNumber: response.SequenceNumber,
        },
      };
    } catch (error) {
      return {
        success: false,
        notificationId: _recipient.id,
        error: error instanceof Error ? error.message : "Failed to send SMS via AWS SNS",
      };
    }
  }

  async isReady(): Promise<boolean> {
    try {
      const { client } = await this.getClient();
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
