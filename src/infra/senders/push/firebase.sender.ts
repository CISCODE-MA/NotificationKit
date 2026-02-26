import type {
  INotificationSender,
  NotificationChannel,
  NotificationContent,
  NotificationRecipient,
  NotificationResult,
} from "../../../core";

export interface FirebaseConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
}

/**
 * Push notification sender implementation using Firebase Cloud Messaging (FCM)
 */
export class FirebasePushSender implements INotificationSender {
  readonly channel: NotificationChannel = "push" as NotificationChannel;
  private app: any = null;
  private messaging: any = null;

  constructor(private readonly config: FirebaseConfig) {}

  /**
   * Initialize Firebase app lazily
   */
  private async getMessaging(): Promise<any> {
    if (this.messaging) {
      return this.messaging;
    }

    // Dynamic import to avoid requiring firebase-admin at build time
    // @ts-expect-error - firebase-admin is an optional peer dependency
    const admin = await import("firebase-admin");

    if (!this.app) {
      this.app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: this.config.projectId,
          privateKey: this.config.privateKey.replace(/\\n/g, "\n"),
          clientEmail: this.config.clientEmail,
        }),
      });
    }

    this.messaging = admin.messaging(this.app);

    return this.messaging;
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
          error: "Recipient device token is required",
        };
      }

      const messaging = await this.getMessaging();

      const message = {
        token: _recipient.deviceToken,
        notification: {
          title: _content.title,
          body: _content.body,
        },
        data: _content.data as Record<string, string> | undefined,
      };

      const messageId = await messaging.send(message);

      return {
        success: true,
        notificationId: _recipient.id,
        providerMessageId: messageId,
      };
    } catch (error) {
      return {
        success: false,
        notificationId: _recipient.id,
        error: error instanceof Error ? error.message : "Failed to send push notification via FCM",
      };
    }
  }

  async isReady(): Promise<boolean> {
    try {
      const messaging = await this.getMessaging();
      return !!messaging;
    } catch {
      return false;
    }
  }

  validateRecipient(_recipient: NotificationRecipient): boolean {
    return !!_recipient.deviceToken && _recipient.deviceToken.length > 0;
  }
}
