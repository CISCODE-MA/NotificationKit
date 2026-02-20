import type {
  Notification,
  NotificationChannel,
  NotificationContent,
  NotificationRecipient,
  NotificationResult,
} from "./types";

/**
 * Port: Notification sender abstraction
 * Infrastructure layer will implement this for each channel (email, SMS, etc.)
 */
export interface INotificationSender {
  /**
   * The channel this sender handles
   */
  readonly channel: NotificationChannel;

  /**
   * Send a notification to a recipient
   */
  send(
    _recipient: NotificationRecipient,
    _content: NotificationContent,
  ): Promise<NotificationResult>;

  /**
   * Check if the sender is properly configured and ready
   */
  isReady(): Promise<boolean>;

  /**
   * Validate recipient has required fields for this channel
   */
  validateRecipient(_recipient: NotificationRecipient): boolean;
}

/**
 * Port: Notification repository abstraction
 * Infrastructure layer will implement this for persistence
 */
export interface INotificationRepository {
  /**
   * Create a new notification record
   */
  create(
    _notification: Omit<Notification, "id" | "createdAt" | "updatedAt">,
  ): Promise<Notification>;

  /**
   * Find a notification by ID
   */
  findById(_id: string): Promise<Notification | null>;

  /**
   * Find notifications matching criteria
   */
  find(_criteria: NotificationQueryCriteria): Promise<Notification[]>;

  /**
   * Update a notification
   */
  update(_id: string, _updates: Partial<Notification>): Promise<Notification>;

  /**
   * Delete a notification
   */
  delete(_id: string): Promise<boolean>;

  /**
   * Count notifications matching criteria
   */
  count(_criteria: NotificationQueryCriteria): Promise<number>;

  /**
   * Find notifications that are ready to be sent
   */
  findReadyToSend(_limit: number): Promise<Notification[]>;
}

/**
 * Query criteria for finding notifications
 */
export interface NotificationQueryCriteria {
  recipientId?: string;
  channel?: NotificationChannel;
  status?: string;
  priority?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Port: Template engine abstraction
 * Infrastructure layer will implement this for template rendering
 */
export interface ITemplateEngine {
  /**
   * Render a template with variables
   */
  render(_templateId: string, _variables: Record<string, unknown>): Promise<TemplateResult>;

  /**
   * Check if a template exists
   */
  hasTemplate(_templateId: string): Promise<boolean>;

  /**
   * Validate template variables
   */
  validateVariables(_templateId: string, _variables: Record<string, unknown>): Promise<boolean>;
}

/**
 * Result of template rendering
 */
export interface TemplateResult {
  title: string;
  body: string;
  html?: string;
}

/**
 * Port: ID generator abstraction
 */
export interface IIdGenerator {
  /**
   * Generate a unique ID
   */
  generate(): string;
}

/**
 * Port: Date/time provider abstraction
 */
export interface IDateTimeProvider {
  /**
   * Get current ISO 8601 timestamp
   */
  now(): string;

  /**
   * Check if a datetime is in the past
   */
  isPast(_datetime: string): boolean;

  /**
   * Check if a datetime is in the future
   */
  isFuture(_datetime: string): boolean;
}

/**
 * Port: Notification queue abstraction (for async processing)
 */
export interface INotificationQueue {
  /**
   * Add a notification to the queue
   */
  enqueue(_notificationId: string, _priority?: string): Promise<void>;

  /**
   * Remove a notification from the queue
   */
  dequeue(): Promise<string | null>;

  /**
   * Get queue size
   */
  size(): Promise<number>;

  /**
   * Clear the queue
   */
  clear(): Promise<void>;
}

/**
 * Port: Event emitter abstraction (for notification events)
 */
export interface INotificationEventEmitter {
  /**
   * Emit an event
   */
  emit(_event: NotificationEvent): Promise<void>;
}

/**
 * Notification events
 */
export type NotificationEvent =
  | { type: "notification.created"; notification: Notification }
  | { type: "notification.queued"; notification: Notification }
  | { type: "notification.sending"; notification: Notification }
  | { type: "notification.sent"; notification: Notification; result: NotificationResult }
  | { type: "notification.delivered"; notification: Notification }
  | { type: "notification.failed"; notification: Notification; error: string }
  | { type: "notification.cancelled"; notification: Notification };
