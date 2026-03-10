/**
 * Twilio WhatsApp Sender - WhatsApp Message Delivery via Twilio
 *
 * This is the WhatsApp sender implementation using Twilio's WhatsApp API,
 * which provides an easy way to send WhatsApp messages without requiring
 * direct Meta Business API approval.
 *
 * Features:
 * - WhatsApp messaging: Send text messages via WhatsApp
 * - Media support: Send images, videos, PDFs, and other documents
 * - Template support: Use pre-approved WhatsApp message templates (configurable)
 * - Lazy loading: Twilio SDK is loaded only when needed (peer dependency)
 * - Connection verification: isReady() checks Twilio credentials
 * - Phone validation: Validates E.164 format before sending
 *
 * Requirements:
 * - Twilio account with WhatsApp enabled
 * - WhatsApp Sandbox (for testing) or approved WhatsApp Business Profile
 * - Recipients must opt-in to receive messages (Sandbox requirement)
 * - Messages must use approved templates for certain use cases
 *
 * Configuration example:
 * ```typescript
 * const whatsappSender = new TwilioWhatsAppSender({
 *   accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
 *   authToken: 'your-auth-token',
 *   fromNumber: '+14155238886', // Your Twilio WhatsApp number
 *   templates: {
 *     orderShipped: 'order_shipped_v1',
 *     welcomeMessage: 'welcome_v2'
 *   }
 * });
 * ```
 *
 * Usage with NotificationKit:
 * ```typescript
 * NotificationKitModule.forRoot({
 *   senders: [whatsappSender],
 *   // ... other config
 * });
 * ```
 *
 * Media support example:
 * ```typescript
 * await notificationService.send({
 *   channel: NotificationChannel.WHATSAPP,
 *   recipient: { id: 'user-123', phone: '+1234567890' },
 *   content: {
 *     title: 'Invoice',
 *     body: 'Here is your invoice',
 *     data: {
 *       mediaUrl: 'https://example.com/invoice.pdf'
 *     }
 *   }
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
 * Configuration for Twilio WhatsApp sender
 *
 * This configuration matches Twilio's WhatsApp API requirements.
 * See: https://www.twilio.com/docs/whatsapp/api
 */
export interface TwilioWhatsAppConfig {
  accountSid: string; // Twilio Account SID (starts with AC...)
  authToken: string; // Twilio Auth Token (from console)
  fromNumber: string; // Your Twilio WhatsApp-enabled phone number (E.164 format: +14155238886)

  /**
   * Optional: WhatsApp message templates (configurable)
   *
   * Templates are required for certain types of messages (promotional, etc.)
   * in the WhatsApp Business API. Define your approved templates here.
   *
   * Usage in notification:
   * ```typescript
   * content: {
   *   templateId: 'orderShipped',  // maps to 'order_shipped_v1'
   *   templateVars: { orderId: '12345' }
   * }
   * ```
   */
  templates?: Record<string, string>;
}

/**
 * WhatsApp sender implementation using Twilio API
 *
 * Implements the INotificationSender port for WhatsApp notifications.
 * Uses Twilio's WhatsApp API (https://www.twilio.com/docs/whatsapp) for message delivery.
 */
export class TwilioWhatsAppSender implements INotificationSender {
  readonly channel: NotificationChannel = "whatsapp" as NotificationChannel;

  // Twilio client is created lazily and cached for reuse
  // This avoids creating multiple connections to Twilio
  private client: any = null;

  constructor(private readonly config: TwilioWhatsAppConfig) {}

  /**
   * Initialize the Twilio client (lazy initialization)
   *
   * Why lazy initialization?
   * - Twilio is a peer dependency (may not be installed)
   * - Connection is only needed when actually sending messages
   * - Avoids startup errors if Twilio is misconfigured
   * - Client is reused for all sends (connection pooling)
   *
   * @returns Promise<any> - Twilio client instance
   * @private
   */
  private async getClient(): Promise<any> {
    // Return cached client if already created
    if (this.client) {
      return this.client;
    }

    // Dynamic import: Load Twilio SDK only when needed
    // This allows NotificationKit to work without Twilio installed
    // if you're only using email/push notifications
    // @ts-expect-error - twilio is an optional peer dependency
    const twilio = await import("twilio");

    // Create Twilio client with credentials
    this.client = twilio.default(this.config.accountSid, this.config.authToken);

    return this.client;
  }

  /**
   * Send a WhatsApp message
   *
   * This method:
   * 1. Validates recipient has a phone number
   * 2. Validates phone is in E.164 format
   * 3. Gets or creates the Twilio client
   * 4. Formats phone numbers for WhatsApp (prefixes with "whatsapp:")
   * 5. Checks if using a template or plain message
   * 6. Sends message via Twilio WhatsApp API
   * 7. Returns result with success status and provider message SID
   *
   * @param _recipient - Notification recipient (must have phone field)
   * @param _content - Notification content (body, optional mediaUrl, optional templateId)
   * @returns Promise<NotificationResult> - Send result
   */
  async send(
    _recipient: NotificationRecipient,
    _content: NotificationContent,
  ): Promise<NotificationResult> {
    try {
      // Validate recipient has phone number
      if (!_recipient.phone) {
        return {
          success: false,
          notificationId: _recipient.id,
          error: "Recipient phone number is required for WhatsApp",
        };
      }

      // Validate phone number format (E.164)
      if (!this.isValidPhoneNumber(_recipient.phone)) {
        return {
          success: false,
          notificationId: _recipient.id,
          error: `Invalid phone number format. Must be E.164 format (e.g., +1234567890). Got: ${_recipient.phone}`,
        };
      }

      // Get Twilio client (creates if not exists)
      const client = await this.getClient();

      // Format phone numbers for WhatsApp (Twilio requires "whatsapp:" prefix)
      const fromWhatsApp = `whatsapp:${this.config.fromNumber}`;
      const toWhatsApp = `whatsapp:${_recipient.phone}`;

      // Prepare message options
      const messageOptions: any = {
        from: fromWhatsApp,
        to: toWhatsApp,
      };

      // Check if using a template
      if (_content.templateId && this.config.templates?.[_content.templateId]) {
        // Template message (for WhatsApp Business API requirements)
        const templateName = this.config.templates[_content.templateId];

        messageOptions.contentSid = templateName;

        // Add template variables if provided
        if (_content.templateVars) {
          messageOptions.contentVariables = JSON.stringify(_content.templateVars);
        }
      } else {
        // Plain text message
        messageOptions.body = _content.body;
      }

      // Add media URL if provided (images, videos, PDFs, etc.)
      // WhatsApp supports: image/*, video/*, audio/*, application/pdf, and more
      const mediaUrl = _content.data?.mediaUrl as string | undefined;
      if (mediaUrl) {
        messageOptions.mediaUrl = [mediaUrl];
      }

      // Send the message via Twilio WhatsApp API
      const message = await client.messages.create(messageOptions);

      // Return success with provider message SID (for tracking)
      return {
        success: true,
        notificationId: _recipient.id,
        providerMessageId: message.sid, // Twilio message SID (e.g., SM...)
        metadata: {
          status: message.status, // Message status (queued, sent, delivered, read, failed)
          dateCreated: message.dateCreated, // When message was created
          dateSent: message.dateSent, // When message was sent (if available)
          price: message.price, // Cost of message (if available)
          priceUnit: message.priceUnit, // Currency of price
          errorCode: message.errorCode, // Error code if failed
          errorMessage: message.errorMessage, // Error message if failed
        },
      };
    } catch (error: any) {
      // Handle Twilio-specific errors
      const errorMessage = error?.message || "Failed to send WhatsApp message via Twilio";
      const errorCode = error?.code || undefined;

      return {
        success: false,
        notificationId: _recipient.id,
        error: errorCode ? `[${errorCode}] ${errorMessage}` : errorMessage,
        metadata: {
          errorCode,
          rawError: error,
        },
      };
    }
  }

  /**
   * Check if the WhatsApp sender is ready to send
   *
   * This method verifies the Twilio credentials by attempting to fetch
   * the account information. If credentials are invalid, sending won't work.
   *
   * @returns Promise<boolean> - true if Twilio credentials work, false otherwise
   *
   * Called by NotificationService before sending to ensure sender is ready.
   * Prevents attempting sends when Twilio is misconfigured or unreachable.
   */
  async isReady(): Promise<boolean> {
    try {
      const client = await this.getClient();

      // Verify credentials by fetching account info
      await client.api.accounts(this.config.accountSid).fetch();

      return true;
    } catch (error) {
      // Credentials invalid or Twilio unreachable
      console.error(
        "[TwilioWhatsAppSender] Not ready:",
        error instanceof Error ? error.message : error,
      );
      return false;
    }
  }

  /**
   * Validate recipient has required fields for WhatsApp
   *
   * WhatsApp requires:
   * - phone: Must exist
   * - phone: Must be in E.164 format (+[country code][number])
   *
   * @param _recipient - The recipient to validate
   * @returns boolean - true if recipient is valid for WhatsApp
   *
   * Called by NotificationService before attempting to send.
   */
  validateRecipient(_recipient: NotificationRecipient): boolean {
    return !!_recipient.phone && this.isValidPhoneNumber(_recipient.phone);
  }

  /**
   * Validate phone number is in E.164 format
   *
   * E.164 format: +[country code][number]
   * - Starts with +
   * - Followed by 1-3 digit country code
   * - Followed by up to 15 total digits
   *
   * Valid examples:
   * - +14155551234 (USA)
   * - +447911123456 (UK)
   * - +212612345678 (Morocco)
   * - +33612345678 (France)
   *
   * Invalid examples:
   * - 4155551234 (missing +)
   * - +1-415-555-1234 (contains dashes)
   * - +1 (415) 555-1234 (contains spaces and parentheses)
   *
   * @param phone - Phone number to validate
   * @returns boolean - true if valid E.164 format
   * @private
   */
  private isValidPhoneNumber(phone: string): boolean {
    // E.164 format regex: + followed by 1-15 digits, no spaces or special chars
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }
}
