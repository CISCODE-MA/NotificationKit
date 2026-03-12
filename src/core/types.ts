/**
 * @file Core Domain Types and Interfaces
 *
 * This file defines all the core domain types, enums, and interfaces for the NotificationKit system.
 * It contains the fundamental building blocks that represent notifications in the system:
 *
 * - NotificationChannel: Enum defining available delivery channels (Email, SMS, Push, etc.)
 * - NotificationStatus: Enum tracking the lifecycle state of a notification
 * - NotificationPriority: Enum for categorizing notification urgency
 * - NotificationRecipient: Interface describing who receives the notification
 * - NotificationContent: Interface describing what the notification contains
 * - Notification: Main domain entity representing a complete notification
 * - NotificationResult: Interface for send operation results
 *
 * These types are used throughout the entire system and form the core vocabulary
 * of the notification domain.
 */

/**
 * Notification channel types
 * Defines the different delivery mechanisms available for sending notifications
 */
export enum NotificationChannel {
  EMAIL = "email", // Email delivery via SMTP or email service providers
  SMS = "sms", // SMS text messages via telecom providers
  PUSH = "push", // Mobile push notifications via FCM, APNs, etc.
  IN_APP = "in_app", // In-application notifications (stored for retrieval)
  WEBHOOK = "webhook", // HTTP webhook callbacks to external systems
  WHATSAPP = "whatsapp", // WhatsApp messages via Twilio or Meta Business API
}

/**
 * Notification status lifecycle
 * Tracks the current state of a notification through its delivery process
 */
export enum NotificationStatus {
  PENDING = "pending", // Created but not yet ready to send (e.g., scheduled for future)
  QUEUED = "queued", // Ready to be sent, waiting in queue
  SENDING = "sending", // Currently being sent to provider
  SENT = "sent", // Successfully sent to provider (but not yet confirmed delivered)
  DELIVERED = "delivered", // Confirmed delivered to recipient
  FAILED = "failed", // Send attempt failed (may retry based on configuration)
  CANCELLED = "cancelled", // Manually cancelled before sending
}

/**
 * Notification priority levels
 * Used for queue ordering and handling urgency
 */
export enum NotificationPriority {
  LOW = "low", // Low priority, can be delayed (e.g., newsletters, digests)
  NORMAL = "normal", // Standard priority for most notifications
  HIGH = "high", // Important, should be sent soon (e.g., alerts)
  URGENT = "urgent", // Critical, send immediately (e.g., OTP codes, security alerts)
}

/**
 * Notification recipient information
 */
export interface NotificationRecipient {
  /**
   * Unique identifier for the recipient (user ID, etc.)
   */
  readonly id: string;

  /**
   * Email address (required for email channel)
   */
  readonly email?: string | undefined;

  /**
   * Phone number (required for SMS channel)
   */
  readonly phone?: string | undefined;

  /**
   * Device token (required for push notifications)
   */
  readonly deviceToken?: string | undefined;

  /**
   * Additional metadata about the recipient
   */
  readonly metadata?: Record<string, unknown> | undefined;
}

/**
 * Notification content structure
 */
export interface NotificationContent {
  /**
   * Notification title/subject
   */
  readonly title: string;

  /**
   * Notification body/message
   */
  readonly body: string;

  /**
   * Optional HTML content (for email)
   */
  readonly html?: string | undefined;

  /**
   * Additional data/payload
   */
  readonly data?: Record<string, unknown> | undefined;

  /**
   * Template ID if using a template
   */
  readonly templateId?: string | undefined;

  /**
   * Template variables for substitution
   */
  readonly templateVars?: Record<string, unknown> | undefined;
}

/**
 * Core notification entity
 */
export interface Notification {
  /**
   * Unique identifier
   */
  readonly id: string;

  /**
   * Notification channel
   */
  readonly channel: NotificationChannel;

  /**
   * Current status
   */
  readonly status: NotificationStatus;

  /**
   * Priority level
   */
  readonly priority: NotificationPriority;

  /**
   * Recipient information
   */
  readonly recipient: NotificationRecipient;

  /**
   * Notification content
   */
  readonly content: NotificationContent;

  /**
   * ISO 8601 timestamp when notification was created
   */
  readonly createdAt: string;

  /**
   * ISO 8601 timestamp when notification was last updated
   */
  readonly updatedAt: string;

  /**
   * ISO 8601 timestamp when notification should be sent (for scheduled notifications)
   */
  readonly scheduledFor?: string | undefined;

  /**
   * ISO 8601 timestamp when notification was sent
   */
  readonly sentAt?: string | undefined;

  /**
   * ISO 8601 timestamp when notification was delivered
   */
  readonly deliveredAt?: string | undefined;

  /**
   * Error message if failed
   */
  readonly error?: string | undefined;

  /**
   * Number of retry attempts
   */
  readonly retryCount: number;

  /**
   * Maximum retry attempts allowed
   */
  readonly maxRetries: number;

  /**
   * Additional metadata
   */
  readonly metadata?: Record<string, unknown> | undefined;
}

/**
 * Result of a notification send operation
 */
export interface NotificationResult {
  /**
   * Whether the operation was successful
   */
  readonly success: boolean;

  /**
   * The notification ID
   */
  readonly notificationId: string;

  /**
   * Provider-specific message ID
   */
  readonly providerMessageId?: string | undefined;

  /**
   * Error message if failed
   */
  readonly error?: string | undefined;

  /**
   * Additional metadata from the provider
   */
  readonly metadata?: Record<string, unknown> | undefined;
}
