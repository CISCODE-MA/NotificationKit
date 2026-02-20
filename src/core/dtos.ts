import { z } from "zod";

import { NotificationChannel, NotificationPriority } from "./types";

/**
 * Zod schema for notification recipient
 */
export const NotificationRecipientSchema = z.object({
  id: z.string().min(1, "Recipient ID is required"),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  deviceToken: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for notification content
 */
export const NotificationContentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  body: z.string().min(1, "Body is required"),
  html: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  templateId: z.string().optional(),
  templateVars: z.record(z.unknown()).optional(),
});

/**
 * DTO for creating a new notification
 */
export const CreateNotificationDtoSchema = z
  .object({
    channel: z.nativeEnum(NotificationChannel),
    priority: z.nativeEnum(NotificationPriority).default(NotificationPriority.NORMAL),
    recipient: NotificationRecipientSchema,
    content: NotificationContentSchema,
    scheduledFor: z.string().datetime().optional(),
    maxRetries: z.number().int().min(0).max(10).default(3),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine(
    (data) => {
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
 * DTO for sending a notification immediately
 */
export const SendNotificationDtoSchema = CreateNotificationDtoSchema;

export type SendNotificationDto = z.infer<typeof SendNotificationDtoSchema>;

/**
 * DTO for querying notifications
 */
export const QueryNotificationsDtoSchema = z.object({
  recipientId: z.string().optional(),
  channel: z.nativeEnum(NotificationChannel).optional(),
  status: z.string().optional(),
  priority: z.nativeEnum(NotificationPriority).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.number().int().positive().max(100).default(10),
  offset: z.number().int().min(0).default(0),
});

export type QueryNotificationsDto = z.infer<typeof QueryNotificationsDtoSchema>;

/**
 * DTO for updating notification status
 */
export const UpdateNotificationStatusDtoSchema = z.object({
  notificationId: z.string().min(1),
  status: z.string().min(1),
  error: z.string().optional(),
  providerMessageId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateNotificationStatusDto = z.infer<typeof UpdateNotificationStatusDtoSchema>;

/**
 * DTO for bulk notification sending
 */
export const BulkSendNotificationDtoSchema = z.object({
  channel: z.nativeEnum(NotificationChannel),
  priority: z.nativeEnum(NotificationPriority).default(NotificationPriority.NORMAL),
  recipients: z.array(NotificationRecipientSchema).min(1).max(1000),
  content: NotificationContentSchema,
  scheduledFor: z.string().datetime().optional(),
  maxRetries: z.number().int().min(0).max(10).default(3),
  metadata: z.record(z.unknown()).optional(),
});

export type BulkSendNotificationDto = z.infer<typeof BulkSendNotificationDtoSchema>;

/**
 * Validate and parse a DTO
 */
export function validateDto<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safely validate a DTO and return result
 */
export function validateDtoSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}
