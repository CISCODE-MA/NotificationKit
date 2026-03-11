/**
 * Mock WhatsApp Sender - Testing WhatsApp Without Real API
 *
 * This is a mock implementation of the WhatsApp sender for testing and development
 * purposes. It simulates sending WhatsApp messages without requiring actual Twilio
 * credentials or making real API calls.
 *
 * Features:
 * - No credentials required: Works immediately without setup
 * - Always succeeds: Simulates successful message delivery
 * - Console logging: Outputs what would be sent (for debugging)
 * - Media support: Logs media URLs that would be sent
 * - Template support: Logs template usage
 * - Fast: No network calls, instant responses
 *
 * Use cases:
 * - Local development without Twilio account
 * - Testing notification flows
 * - Demo applications
 * - CI/CD pipelines without credentials
 *
 * Configuration example:
 * ```typescript
 * const mockSender = new MockWhatsAppSender({
 *   logMessages: true  // Optional: log to console (default: true)
 * });
 * ```
 *
 * Usage with NotificationKit:
 * ```typescript
 * NotificationKitModule.forRoot({
 *   senders: [mockSender],
 *   // ... other config
 * });
 * ```
 */

import { randomUUID } from "node:crypto";

import type {
  INotificationSender,
  NotificationChannel,
  NotificationContent,
  NotificationRecipient,
  NotificationResult,
} from "../../../core";

/**
 * Configuration for Mock WhatsApp sender
 */
export interface MockWhatsAppConfig {
  /**
   * Whether to log messages to console (default: true)
   * Useful for debugging and seeing what would be sent
   */
  logMessages?: boolean;
}

/**
 * Mock WhatsApp sender for testing
 *
 * Implements the INotificationSender port but doesn't actually send messages.
 * Perfect for development, testing, and demos.
 */
export class MockWhatsAppSender implements INotificationSender {
  readonly channel: NotificationChannel = "whatsapp" as NotificationChannel;

  constructor(private readonly config: MockWhatsAppConfig = { logMessages: true }) {}

  /**
   * Simulate sending a WhatsApp message
   *
   * This method:
   * 1. Validates recipient has phone number
   * 2. Logs what would be sent (if logging enabled)
   * 3. Returns mock success response
   * 4. Never actually sends anything
   *
   * @param _recipient - Notification recipient
   * @param _content - Notification content
   * @returns Promise<NotificationResult> - Mock success result
   */
  async send(
    _recipient: NotificationRecipient,
    _content: NotificationContent,
  ): Promise<NotificationResult> {
    // Validate recipient has phone
    if (!_recipient.phone) {
      return {
        success: false,
        notificationId: _recipient.id,
        error: "Recipient phone number is required for WhatsApp",
      };
    }

    // Validate phone format
    if (!this.isValidPhoneNumber(_recipient.phone)) {
      return {
        success: false,
        notificationId: _recipient.id,
        error: `Invalid phone number format. Must be E.164 format (e.g., +1234567890). Got: ${_recipient.phone}`,
      };
    }

    // Log what would be sent (if enabled)
    if (this.config.logMessages) {
      console.log("\n═══════════════════════════════════════════");
      console.log("📱 [MockWhatsApp] Simulating WhatsApp send");
      console.log("═══════════════════════════════════════════");
      console.log(`To: ${_recipient.phone}`);
      console.log(`Recipient ID: ${_recipient.id}`);

      if (_content.templateId) {
        console.log(`\n📋 Template: ${_content.templateId}`);
        if (_content.templateVars) {
          console.log(`Variables: ${JSON.stringify(_content.templateVars, null, 2)}`);
        }
      } else {
        console.log(`\n💬 Message: ${_content.body}`);
      }

      const mediaUrl = _content.data?.mediaUrl as string | undefined;
      if (mediaUrl) {
        console.log(`📎 Media: ${mediaUrl}`);
      }

      console.log("═══════════════════════════════════════════\n");
    }

    // Return mock success
    return {
      success: true,
      notificationId: _recipient.id,
      providerMessageId: `mock-whatsapp-${randomUUID()}`,
      metadata: {
        status: "sent",
        mock: true,
        timestamp: new Date().toISOString(),
        recipient: _recipient.phone,
        messageType: _content.templateId ? "template" : "text",
        hasMedia: !!_content.data?.mediaUrl,
      },
    };
  }

  /**
   * Mock always ready
   *
   * Since this is a mock sender that doesn't require credentials,
   * it's always ready to "send" (simulate sending).
   *
   * @returns Promise<boolean> - Always true
   */
  async isReady(): Promise<boolean> {
    return true;
  }

  /**
   * Validate recipient has phone number in E.164 format
   *
   * @param _recipient - Recipient to validate
   * @returns boolean - true if phone exists and is valid
   */
  validateRecipient(_recipient: NotificationRecipient): boolean {
    return !!_recipient.phone && this.isValidPhoneNumber(_recipient.phone);
  }

  /**
   * Validate phone number is in E.164 format
   *
   * E.164 format: +[country code][number]
   * Examples: +14155551234, +447911123456, +212612345678
   *
   * @param phone - Phone number to validate
   * @returns boolean - true if valid E.164 format
   * @private
   */
  private isValidPhoneNumber(phone: string): boolean {
    // E.164 format: + followed by 1-15 digits
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }
}
