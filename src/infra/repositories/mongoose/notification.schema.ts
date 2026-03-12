import type {
  Notification,
  NotificationChannel,
  NotificationContent,
  NotificationPriority,
  NotificationRecipient,
  NotificationStatus,
} from "../../../core";

// Helper to get Schema type at runtime (for Mongoose schema definitions)
const getSchemaTypes = () => {
  try {
    // @ts-ignore - mongoose is an optional peer dependency
    const mongoose = require("mongoose");
    return mongoose.Schema.Types;
  } catch {
    return { Mixed: {} };
  }
};

const SchemaTypes = getSchemaTypes();

/**
 * Mongoose schema definition for Notification
 */
export interface NotificationDocument extends Omit<Notification, "id"> {
  _id: string;
}

export const notificationSchemaDefinition = {
  channel: {
    type: String,
    required: true,
    enum: ["email", "sms", "push", "in_app", "webhook"],
  },
  status: {
    type: String,
    required: true,
    enum: ["pending", "queued", "sending", "sent", "delivered", "failed", "cancelled"],
  },
  priority: {
    type: String,
    required: true,
    enum: ["low", "normal", "high", "urgent"],
  },
  recipient: {
    id: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    deviceToken: { type: String },
    metadata: { type: Map, of: SchemaTypes.Mixed },
  },
  content: {
    title: { type: String, required: true },
    body: { type: String, required: true },
    html: { type: String },
    data: { type: Map, of: SchemaTypes.Mixed },
    templateId: { type: String },
    templateVars: { type: Map, of: SchemaTypes.Mixed },
  },
  scheduledFor: { type: String },
  sentAt: { type: String },
  deliveredAt: { type: String },
  error: { type: String },
  retryCount: { type: Number, required: true, default: 0 },
  maxRetries: { type: Number, required: true, default: 3 },
  metadata: { type: Map, of: SchemaTypes.Mixed },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
};

/**
 * Type helper for creating a new notification
 */
export type CreateNotificationInput = {
  channel: NotificationChannel;
  status: NotificationStatus;
  priority: NotificationPriority;
  recipient: NotificationRecipient;
  content: NotificationContent;
  scheduledFor?: string | undefined;
  sentAt?: string | undefined;
  deliveredAt?: string | undefined;
  error?: string | undefined;
  retryCount: number;
  maxRetries: number;
  metadata?: Record<string, unknown> | undefined;
};
