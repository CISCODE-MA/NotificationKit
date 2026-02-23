import type {
  INotificationSender,
  NotificationChannel,
  NotificationContent,
  NotificationRecipient,
  NotificationResult,
} from "../../../core";

export interface OneSignalConfig {
  appId: string;
  restApiKey: string;
}

/**
 * Push notification sender implementation using OneSignal
 */
export class OneSignalPushSender implements INotificationSender {
  readonly channel: NotificationChannel = "push" as NotificationChannel;
  private readonly baseUrl = "https://onesignal.com/api/v1";

  constructor(private readonly config: OneSignalConfig) {}

  async send(
    _recipient: NotificationRecipient,
    _content: NotificationContent,
  ): Promise<NotificationResult> {
    try {
      if (!_recipient.deviceToken) {
        return {
          success: false,
          notificationId: _recipient.id,
          error: "Recipient device token is required",
        };
      }

      const response = await fetch(`${this.baseUrl}/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${this.config.restApiKey}`,
        },
        body: JSON.stringify({
          app_id: this.config.appId,
          include_player_ids: [_recipient.deviceToken],
          headings: { en: _content.title },
          contents: { en: _content.body },
          data: _content.data,
        }),
      });

      const result = await response.json();

      if (response.ok && result.id) {
        return {
          success: true,
          notificationId: _recipient.id,
          providerMessageId: result.id,
          metadata: {
            recipients: result.recipients,
          },
        };
      } else {
        return {
          success: false,
          notificationId: _recipient.id,
          error: result.errors?.[0] || "Failed to send push notification via OneSignal",
        };
      }
    } catch (error) {
      return {
        success: false,
        notificationId: _recipient.id,
        error:
          error instanceof Error ? error.message : "Failed to send push notification via OneSignal",
      };
    }
  }

  async isReady(): Promise<boolean> {
    try {
      // Verify API key by fetching app info
      const response = await fetch(`${this.baseUrl}/apps/${this.config.appId}`, {
        headers: {
          Authorization: `Basic ${this.config.restApiKey}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  validateRecipient(_recipient: NotificationRecipient): boolean {
    return !!_recipient.deviceToken && _recipient.deviceToken.length > 0;
  }
}
