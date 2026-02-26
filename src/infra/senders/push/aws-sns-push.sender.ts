import type {
  INotificationSender,
  NotificationChannel,
  NotificationContent,
  NotificationRecipient,
  NotificationResult,
} from "../../../core";

export interface AwsSnsPushConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  platformApplicationArn: string;
}

/**
 * Push notification sender implementation using AWS SNS
 */
export class AwsSnsPushSender implements INotificationSender {
  readonly channel: NotificationChannel = "push" as NotificationChannel;
  private sns: any = null;

  constructor(private readonly config: AwsSnsPushConfig) {}

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
      if (!_recipient.deviceToken) {
        return {
          success: false,
          notificationId: _recipient.id,
          error: "Recipient device token (endpoint ARN) is required",
        };
      }

      const { client, PublishCommand } = await this.getClient();

      // For AWS SNS push, the message format depends on the platform
      const message = JSON.stringify({
        default: _content.body,
        GCM: JSON.stringify({
          notification: {
            title: _content.title,
            body: _content.body,
          },
          data: _content.data,
        }),
        APNS: JSON.stringify({
          aps: {
            alert: {
              title: _content.title,
              body: _content.body,
            },
          },
          data: _content.data,
        }),
      });

      const params = {
        Message: message,
        MessageStructure: "json",
        TargetArn: _recipient.deviceToken, // This should be the endpoint ARN
      };

      const command = new PublishCommand(params);
      const response = await client.send(command);

      return {
        success: true,
        notificationId: _recipient.id,
        providerMessageId: response.MessageId,
      };
    } catch (error) {
      return {
        success: false,
        notificationId: _recipient.id,
        error:
          error instanceof Error ? error.message : "Failed to send push notification via AWS SNS",
      };
    }
  }

  async isReady(): Promise<boolean> {
    try {
      const { client } = await this.getClient();
      return !!client;
    } catch {
      return false;
    }
  }

  validateRecipient(_recipient: NotificationRecipient): boolean {
    // For AWS SNS, deviceToken should be an endpoint ARN
    return (
      !!_recipient.deviceToken &&
      _recipient.deviceToken.startsWith("arn:aws:sns:") &&
      _recipient.deviceToken.includes(":endpoint/")
    );
  }
}
