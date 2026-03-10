/**
 * Nodemailer Email Sender - SMTP Email Delivery
 *
 * This is the email sender implementation using Nodemailer, which supports
 * any SMTP provider (Gmail, SendGrid, AWS SES, Mailgun, etc.).
 *
 * Features:
 * - SMTP support: Works with any SMTP server
 * - HTML emails: Supports both plain text and HTML content
 * - Lazy loading: Nodemailer is loaded only when needed (peer dependency)
 * - Connection verification: isReady() checks SMTP connection
 * - Email validation: Validates email format before sending
 *
 * Supported providers (any SMTP server):
 * - Gmail (smtp.gmail.com:587)
 * - SendGrid (smtp.sendgrid.net:587)
 * - AWS SES (email-smtp.us-east-1.amazonaws.com:587)
 * - Mailgun (smtp.mailgun.org:587)
 * - Office 365 (smtp.office365.com:587)
 * - Custom SMTP servers
 *
 * Configuration example:
 * ```typescript
 * const emailSender = new NodemailerSender({
 *   host: 'smtp.gmail.com',
 *   port: 587,
 *   secure: false,
 *   auth: {
 *     user: 'your-email@gmail.com',
 *     pass: 'your-app-password'
 *   },
 *   from: 'noreply@yourapp.com',
 *   fromName: 'Your App Name'
 * });
 * ```
 *
 * Usage with NotificationKit:
 * ```typescript
 * NotificationKitModule.forRoot({
 *   senders: [emailSender],
 *   // ... other config
 * });
 * ```
 */

import type {
  INotificationSender,
  NotificationChannel,
  NotificationContent,
  NotificationRecipient,
  NotificationResult,
} from "../../../core";

/**
 * Configuration for Nodemailer SMTP transport
 *
 * This matches the Nodemailer transport configuration structure.
 * See: https://nodemailer.com/smtp/
 */
export interface NodemailerConfig {
  host: string; // SMTP server hostname (e.g., "smtp.gmail.com")
  port: number; // SMTP port (587 for TLS, 465 for SSL, 25 for unencrypted)
  secure?: boolean | undefined; // true for port 465 (SSL), false for other ports (TLS)
  auth?: // SMTP authentication credentials
    | {
        user: string; // SMTP username (usually your email)
        pass: string; // SMTP password (use app-specific password for Gmail)
      }
    | undefined;
  from: string; // Default "from" email address
  fromName?: string | undefined; // Optional "from" display name
}

/**
 * Email sender implementation using Nodemailer
 *
 * Implements the INotificationSender port for email notifications.
 * Uses Nodemailer (https://nodemailer.com/) for SMTP email delivery.
 */
export class NodemailerSender implements INotificationSender {
  readonly channel: NotificationChannel = "email" as NotificationChannel;

  // Transporter is created lazily and cached for reuse
  // This avoids creating multiple SMTP connections
  private transporter: any = null;

  constructor(private readonly config: NodemailerConfig) {}

  /**
   * Initialize the nodemailer transporter (lazy initialization)
   *
   * Why lazy initialization?
   * - Nodemailer is a peer dependency (may not be installed)
   * - Connection is only needed when actually sending emails
   * - Avoids startup errors if SMTP is misconfigured
   * - Transporter is reused for all sends (connection pooling)
   *
   * @returns Promise<any> - Nodemailer transporter instance
   * @private
   */
  private async getTransporter(): Promise<any> {
    // Return cached transporter if already created
    if (this.transporter) {
      return this.transporter;
    }

    // Dynamic import: Load nodemailer only when needed
    // This allows NotificationKit to work without nodemailer installed
    // if you're only using SMS/push notifications
    // @ts-expect-error - nodemailer is an optional peer dependency
    const nodemailer = await import("nodemailer");

    // Create SMTP transporter with configured settings
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure ?? false, // Default to false (TLS on port 587)
      auth: this.config.auth,
    });

    return this.transporter;
  }

  /**
   * Send an email notification
   *
   * This method:
   * 1. Validates recipient has an email address
   * 2. Gets or creates the SMTP transporter
   * 3. Constructs the email (from, to, subject, text, html)
   * 4. Sends via SMTP
   * 5. Returns result with success status and provider message ID
   *
   * @param _recipient - Notification recipient (must have email field)
   * @param _content - Notification content (title, body, html)
   * @returns Promise<NotificationResult> - Send result
   */
  async send(
    _recipient: NotificationRecipient,
    _content: NotificationContent,
  ): Promise<NotificationResult> {
    try {
      // Validate recipient has email address
      if (!_recipient.email) {
        return {
          success: false,
          notificationId: "",
          error: "Recipient email is required",
        };
      }

      // Get transporter (creates if not exists)
      const transporter = await this.getTransporter();

      // Construct email options
      const mailOptions = {
        // From address: Use "Display Name <email>" format if fromName provided
        from: this.config.fromName
          ? `"${this.config.fromName}" <${this.config.from}>`
          : this.config.from,
        to: _recipient.email, // Recipient email
        subject: _content.title, // Email subject
        text: _content.body, // Plain text body
        html: _content.html, // HTML body (optional, falls back to text)
      };

      // Send the email via SMTP
      const info = await transporter.sendMail(mailOptions);

      // Return success with provider message ID (for tracking)
      return {
        success: true,
        notificationId: _recipient.id,
        providerMessageId: info.messageId, // Nodemailer message ID
        metadata: {
          accepted: info.accepted, // Accepted recipients
          rejected: info.rejected, // Rejected recipients
          response: info.response, // SMTP server response
        },
      };
    } catch (error) {
      // Return failure with error message
      return {
        success: false,
        notificationId: _recipient.id,
        error: error instanceof Error ? error.message : "Failed to send email",
      };
    }
  }

  /**
   * Check if the email sender is ready to send
   *
   * This method verifies the SMTP connection by attempting to connect
   * to the SMTP server. If connection fails, sending won't work.
   *
   * @returns Promise<boolean> - true if SMTP connection works, false otherwise
   *
   * Called by NotificationService before sending to ensure sender is ready.
   * Prevents attempting sends when SMTP is misconfigured or unreachable.
   */
  async isReady(): Promise<boolean> {
    try {
      const transporter = await this.getTransporter();
      await transporter.verify(); // Verifies SMTP connection
      return true;
    } catch {
      return false; // SMTP connection failed (wrong credentials, server down, etc.)
    }
  }

  /**
   * Validate recipient has valid email address
   *
   * Checks that:
   * 1. Recipient has an email field
   * 2. Email format is valid (basic regex check)
   *
   * @param _recipient - Recipient to validate
   * @returns boolean - true if valid, false otherwise
   *
   * Note: This is a basic format check, not a deliverability check.
   * The email could still bounce if it doesn't exist.
   */
  validateRecipient(_recipient: NotificationRecipient): boolean {
    return !!_recipient.email && this.isValidEmail(_recipient.email);
  }

  /**
   * Validate email format using regex
   *
   * Basic email validation: checks for user@domain.tld format.
   * This is not RFC-compliant but catches most invalid formats.
   *
   * @param email - Email address to validate
   * @returns boolean - true if format looks valid
   * @private
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
