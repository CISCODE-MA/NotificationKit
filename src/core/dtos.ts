/**
 * Data Transfer Objects (DTOs) with Zod Validation
 *
 * This file defines all DTOs (Data Transfer Objects) used for validating input
 * across the NotificationKit API. It uses Zod for runtime type validation and
 * schema enforcement.
 *
 * Why DTOs with Zod?
 * - Runtime validation: Ensure data is valid before business logic runs
 * - Type safety: TypeScript types automatically inferred from schemas
 * - Clear error messages: Detailed validation errors for API consumers
 * - Schema documentation: Self-documenting API contracts
 *
 * DTOs defined here:
 * 1. CreateNotificationDto - For creating single notifications
 * 2. SendNotificationDto - For immediate sending (alias of CreateNotificationDto)
 * 3. QueryNotificationsDto - For searching/filtering notifications
 * 4. UpdateNotificationStatusDto - For updating notification status
 * 5. BulkSendNotificationDto - For sending to multiple recipients
 *
 * Usage:
 * ```typescript
 * // Validate and parse
 * const dto = validateDto(CreateNotificationDtoSchema, requestBody);
 *
 * // Safe validation (doesn't throw)
 * const result = validateDtoSafe(CreateNotificationDtoSchema, requestBody);
 * if (result.success) {
 *   // Use result.data
 * } else {
 *   // Handle result.errors
 * }
 * ```
 */

import { z } from "zod";

import { NotificationChannel, NotificationPriority } from "./types";

/**
 * Schema for notification recipient information
 *
 * Defines who will receive the notification. Different channels require
 * different contact information:
 * - EMAIL channel: requires 'email' field
 * - SMS channel: requires 'phone' field
 * - PUSH channel: requires 'deviceToken' field
 * - IN_APP/WEBHOOK channels: only require 'id'
 *
 * Fields:
 * - id: Unique identifier for the recipient (user ID, customer ID, etc.)
 * - email: Email address (required for EMAIL channel)
 * - phone: Phone number in E.164 format (required for SMS channel)
 * - deviceToken: FCM/APNS device token (required for PUSH channel)
 * - metadata: Additional recipient data for logging/analytics
 */
export const NotificationRecipientSchema = z.object({
  id: z.string().min(1, "Recipient ID is required"), // Unique recipient identifier
  email: z.string().email().optional(), // Email address (for EMAIL channel)
  phone: z.string().optional(), // Phone number (for SMS channel)
  deviceToken: z.string().optional(), // FCM/APNS token (for PUSH channel)
  metadata: z.record(z.unknown()).optional(), // Additional data (user preferences, etc.)
});

/**
 * Schema for notification content
 *
 * Defines what will be sent in the notification. Supports both direct content
 * and template-based content.
 *
 * Direct content mode:
 * - Provide title, body, and (optionally) html
 * - Content is used as-is
 *
 * Template mode:
 * - Provide templateId (e.g., "welcome-email", "password-reset")
 * - Provide templateVars for variable substitution (e.g., { name: "John", code: "123456" })
 * - Template engine renders title/body/html from template
 *
 * Fields:
 * - title: Notification title/subject (email subject, push title, etc.)
 * - body: Main notification text content (plain text)
 * - html: HTML version of body (for email)
 * - data: Additional structured data (for push notifications, webhooks)
 * - templateId: ID of template to render (optional)
 * - templateVars: Variables for template rendering (optional)
 */
export const NotificationContentSchema = z.object({
  title: z.string().min(1, "Title is required"), // Required: notification title/subject
  body: z.string().min(1, "Body is required"), // Required: main text content
  html: z.string().optional(), // Optional: HTML version (for email)
  data: z.record(z.unknown()).optional(), // Optional: additional data payload
  templateId: z.string().optional(), // Optional: template to render
  templateVars: z.record(z.unknown()).optional(), // Optional: variables for template
});

/**
 * Schema for creating a new notification
 *
 * This is the primary DTO for creating notifications. It includes comprehensive
 * validation rules:
 *
 * 1. Channel validation: Must be a valid NotificationChannel enum value
 * 2. Priority validation: Must be a valid NotificationPriority (default: NORMAL)
 * 3. Recipient validation: Must pass NotificationRecipientSchema checks
 * 4. Content validation: Must pass NotificationContentSchema checks
 * 5. Schedule validation: If provided, must be valid ISO 8601 datetime
 * 6. Retry validation: Must be 0-10 (default: 3)
 * 7. Cross-field validation: Recipient must have appropriate contact info for channel
 *    - EMAIL channel → recipient.email required
 *    - SMS channel → recipient.phone required
 *    - PUSH channel → recipient.deviceToken required
 *
 * Example valid DTO:
 * ```json
 * {
 *   "channel": "email",
 *   "priority": "high",
 *   "recipient": {
 *     "id": "user-123",
 *     "email": "user@example.com"
 *   },
 *   "content": {
 *     "title": "Welcome!",
 *     "body": "Welcome to our platform",
 *     "html": "<h1>Welcome!</h1>"
 *   },
 *   "scheduledFor": "2026-04-01T10:00:00Z",
 *   "maxRetries": 3,
 *   "metadata": { "campaign": "onboarding" }
 * }
 * ```
 */
export const CreateNotificationDtoSchema = z
  .object({
    channel: z.nativeEnum(NotificationChannel), // Which channel to send through
    priority: z.nativeEnum(NotificationPriority).default(NotificationPriority.NORMAL), // Priority level
    recipient: NotificationRecipientSchema, // Who receives it
    content: NotificationContentSchema, // What to send
    scheduledFor: z.string().datetime().optional(), // When to send (optional, ISO 8601)
    maxRetries: z.number().int().min(0).max(10).default(3), // Retry limit (0-10, default 3)
    metadata: z.record(z.unknown()).optional(), // Additional tracking data
  })
  .refine(
    (data) => {
      // Cross-field validation: Ensure recipient has required contact info for channel
      // Email channel requires email address
      if (data.channel === NotificationChannel.EMAIL && !data.recipient.email) {
        return false;
      }
      // SMS channel requires phone number
      if (data.channel === NotificationChannel.SMS && !data.recipient.phone) {
        return false;
      }
      // Push channel requires device token
      if (data.channel === NotificationChannel.PUSH && !data.recipient.deviceToken) {
        return false;
      }
      return true;
    },
    {
      message: "Recipient must have appropriate contact info for the selected channel",
    },
  );

export type CreateNotificationDto = z.infer<typeof CreateNotificationDtoSchema>;

/**
 * Schema for sending a notification immediately
 *
 * This is an alias of CreateNotificationDtoSchema. It has the exact same validation
 * rules, but semantically indicates the notification will be sent immediately
 * rather than just created.
 *
 * Use CreateNotificationDto when you want to create and potentially schedule for later.
 * Use SendNotificationDto when you want to send immediately (scheduledFor will be ignored).
 */
export const SendNotificationDtoSchema = CreateNotificationDtoSchema;

export type SendNotificationDto = z.infer<typeof SendNotificationDtoSchema>;

/**
 * Schema for querying/searching notifications
 *
 * This DTO supports flexible filtering and pagination for notification queries.
 * All filter fields are optional - you can query by any combination.
 *
 * Filter fields:
 * - recipientId: Find all notifications for a specific user
 * - channel: Filter by channel (email, sms, push, etc.)
 * - status: Filter by status (pending, sent, failed, etc.)
 * - priority: Filter by priority level
 * - fromDate: Find notifications created/sent after this date (ISO 8601)
 * - toDate: Find notifications created/sent before this date (ISO 8601)
 *
 * Pagination fields:
 * - limit: Maximum results to return (1-100, default: 10)
 * - offset: Number of results to skip (default: 0)
 *
 * Example queries:
 * ```json
 * // Get user's failed emails (first 10)
 * { "recipientId": "user-123", "channel": "email", "status": "failed", "limit": 10, "offset": 0 }
 *
 * // Get urgent notifications from last 24 hours
 * { "priority": "urgent", "fromDate": "2026-03-30T00:00:00Z", "limit": 50 }
 *
 * // Get all SMS notifications (paginated)
 * { "channel": "sms", "limit": 20, "offset": 40 }
 * ```
 */
export const QueryNotificationsDtoSchema = z.object({
  recipientId: z.string().optional(), // Filter by recipient
  channel: z.nativeEnum(NotificationChannel).optional(), // Filter by channel
  status: z.string().optional(), // Filter by status
  priority: z.nativeEnum(NotificationPriority).optional(), // Filter by priority
  fromDate: z.string().datetime().optional(), // Filter by start date
  toDate: z.string().datetime().optional(), // Filter by end date
  limit: z.number().int().positive().max(100).default(10), // Page size (1-100)
  offset: z.number().int().min(0).default(0), // Pagination offset
});

export type QueryNotificationsDto = z.infer<typeof QueryNotificationsDtoSchema>;

/**
 * Schema for updating notification status
 *
 * This DTO is used for webhook callbacks and status updates from notification
 * providers. When a provider sends a webhook (e.g., "message delivered"), we
 * use this DTO to update the notification record.
 *
 * Fields:
 * - notificationId: The ID of the notification to update
 * - status: New status value (e.g., "delivered", "bounced", "failed")
 * - error: Error message if status is failed/bounced
 * - providerMessageId: Provider's tracking ID (Twilio SID, SendGrid ID, etc.)
 * - metadata: Additional provider data (timestamps, costs, etc.)
 *
 * Example webhook payload from Twilio:
 * ```json
 * {
 *   "notificationId": "notif-123",
 *   "status": "delivered",
 *   "providerMessageId": "SM1234567890abcdef",
 *   "metadata": {
 *     "MessageStatus": "delivered",
 *     "MessageSid": "SM1234567890abcdef",
 *     "To": "+1234567890"
 *   }
 * }
 * ```
 */
export const UpdateNotificationStatusDtoSchema = z.object({
  notificationId: z.string().min(1), // Required: notification ID
  status: z.string().min(1), // Required: new status
  error: z.string().optional(), // Optional: error message
  providerMessageId: z.string().optional(), // Optional: provider tracking ID
  metadata: z.record(z.unknown()).optional(), // Optional: provider data
});

export type UpdateNotificationStatusDto = z.infer<typeof UpdateNotificationStatusDtoSchema>;

/**
 * Schema for bulk notification sending
 *
 * This DTO allows sending the same notification to multiple recipients in one call.
 * It's more efficient than making individual API calls for each recipient.
 *
 * Key differences from CreateNotificationDto:
 * - Takes array of 'recipients' instead of single 'recipient'
 * - Limited to 1000 recipients per bulk send (to prevent timeouts)
 * - All recipients receive the same content
 * - Channel must support bulk sending (most do)
 *
 * Use cases:
 * - Marketing campaigns (send to list of customers)
 * - Alerts/announcements (notify all users of maintenance)
 * - Batch processing (process notification queue)
 *
 * Example:
 * ```json
 * {
 *   "channel": "email",
 *   "priority": "normal",
 *   "recipients": [
 *     { "id": "user-1", "email": "user1@example.com" },
 *     { "id": "user-2", "email": "user2@example.com" },
 *     { "id": "user-3", "email": "user3@example.com" }
 *   ],
 *   "content": {
 *     "title": "Weekly Newsletter",
 *     "body": "Here's what's new this week..."
 *   },
 *   "maxRetries": 3
 * }
 * ```
 *
 * Note: Each recipient will get a separate notification record in the database.
 */
export const BulkSendNotificationDtoSchema = z.object({
  channel: z.nativeEnum(NotificationChannel), // Which channel to send through
  priority: z.nativeEnum(NotificationPriority).default(NotificationPriority.NORMAL), // Priority level
  recipients: z.array(NotificationRecipientSchema).min(1).max(1000), // 1-1000 recipients
  content: NotificationContentSchema, // What to send (same for all)
  scheduledFor: z.string().datetime().optional(), // When to send (optional)
  maxRetries: z.number().int().min(0).max(10).default(3), // Retry limit per notification
  metadata: z.record(z.unknown()).optional(), // Tracking data (applied to all)
});

export type BulkSendNotificationDto = z.infer<typeof BulkSendNotificationDtoSchema>;

/**
 * Validate and parse a DTO (throws on validation error)
 *
 * This function validates data against a Zod schema and returns the parsed
 * (type-safe) result. If validation fails, it throws a ZodError with detailed
 * error information.
 *
 * @param schema - The Zod schema to validate against
 * @param data - The data to validate (typically from API request body)
 * @returns The validated and parsed data (type-safe)
 * @throws ZodError - If validation fails
 *
 * Usage:
 * ```typescript
 * try {
 *   const dto = validateDto(CreateNotificationDtoSchema, requestBody);
 *   // dto is now type-safe CreateNotificationDto
 *   await notificationService.create(dto);
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     // Handle validation errors
 *     return { errors: error.errors };
 *   }
 *   throw error;
 * }
 * ```
 */
export function validateDto<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data); // Throws ZodError if invalid
}

/**
 * Safely validate a DTO without throwing (returns result object)
 *
 * This function validates data against a Zod schema but doesn't throw errors.
 * Instead, it returns a result object indicating success or failure.
 *
 * @param schema - The Zod schema to validate against
 * @param data - The data to validate
 * @returns Success result { success: true, data: T } or failure result { success: false, errors: ZodError }
 *
 * This is useful when:
 * - You want to handle validation errors without try/catch
 * - You need to return validation errors to the caller
 * - You're validating in middleware/interceptors
 *
 * Usage:
 * ```typescript
 * const result = validateDtoSafe(CreateNotificationDtoSchema, requestBody);
 * if (result.success) {
 *   // result.data is type-safe CreateNotificationDto
 *   await notificationService.create(result.data);
 *   return { success: true };
 * } else {
 *   // result.errors contains detailed validation errors
 *   return {
 *     success: false,
 *     errors: result.errors.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
 *   };
 * }
 * ```
 */
export function validateDtoSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data); // Doesn't throw
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}
