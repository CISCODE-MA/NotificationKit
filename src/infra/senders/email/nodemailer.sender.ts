import type {
  INotificationSender,
  NotificationChannel,
  NotificationContent,
  NotificationRecipient,
  NotificationResult,
} from "../../../core";

export interface NodemailerConfig {
  host: string;
  port: number;
  secure?: boolean | undefined;
  auth?:
    | {
        user: string;
        pass: string;
      }
    | undefined;
  from: string;
  fromName?: string | undefined;
}

/**
 * Email sender implementation using Nodemailer
 * Supports any SMTP provider (Gmail, SendGrid, AWS SES, etc.)
 */
export class NodemailerSender implements INotificationSender {
  readonly channel: NotificationChannel = "email" as NotificationChannel;
  private transporter: any = null;

  constructor(private readonly config: NodemailerConfig) {}

  /**
   * Initialize the nodemailer transporter lazily
   */
  private async getTransporter(): Promise<any> {
    if (this.transporter) {
      return this.transporter;
    }

    // Dynamic import to avoid requiring nodemailer at build time
    // @ts-expect-error - nodemailer is an optional peer dependency
    const nodemailer = await import("nodemailer");

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure ?? false,
      auth: this.config.auth,
    });

    return this.transporter;
  }

  async send(
    _recipient: NotificationRecipient,
    _content: NotificationContent,
  ): Promise<NotificationResult> {
    try {
      if (!_recipient.email) {
        return {
          success: false,
          notificationId: "",
          error: "Recipient email is required",
        };
      }

      const transporter = await this.getTransporter();

      const mailOptions = {
        from: this.config.fromName
          ? `"${this.config.fromName}" <${this.config.from}>`
          : this.config.from,
        to: _recipient.email,
        subject: _content.title,
        text: _content.body,
        html: _content.html,
      };

      const info = await transporter.sendMail(mailOptions);

      return {
        success: true,
        notificationId: _recipient.id,
        providerMessageId: info.messageId,
        metadata: {
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response,
        },
      };
    } catch (error) {
      return {
        success: false,
        notificationId: _recipient.id,
        error: error instanceof Error ? error.message : "Failed to send email",
      };
    }
  }

  async isReady(): Promise<boolean> {
    try {
      const transporter = await this.getTransporter();
      await transporter.verify();
      return true;
    } catch {
      return false;
    }
  }

  validateRecipient(_recipient: NotificationRecipient): boolean {
    return !!_recipient.email && this.isValidEmail(_recipient.email);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
