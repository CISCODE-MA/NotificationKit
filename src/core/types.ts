/**
 * Notification channel types
 */
export enum NotificationChannel {
  EMAIL = "email",
  SMS = "sms",
  PUSH = "push",
  IN_APP = "in_app",
  WEBHOOK = "webhook",
}

/**
 * Notification status lifecycle
 */
export enum NotificationStatus {
  PENDING = "pending",
  QUEUED = "queued",
  SENDING = "sending",
  SENT = "sent",
  DELIVERED = "delivered",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  URGENT = "urgent",
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
