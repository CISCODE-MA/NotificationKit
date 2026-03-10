/**
 * @file Port Interfaces (Hexagonal Architecture)
 *
 * This file defines all the "port" interfaces used in the NotificationKit system.
 * Following hexagonal/clean architecture principles, these are the contracts
 * that the infrastructure layer must implement.
 *
 * What are Ports?
 * - Ports are interfaces that define HOW the core business logic  * (domain layer) communicates with external systems.
 * - They allow the core to remain independent of specific implementations.
 * - The infrastructure layer provides "adapters" that implement these ports.
 *
 * Port Interfaces Defined:
 * - INotificationSender: Contract for sending notifications through various channels
 * - INotificationRepository: Contract for persisting and retrieving notifications
 * - ITemplateEngine: Contract for rendering notification templates
 * - IIdGenerator: Contract for generating unique notification IDs
 * - IDateTimeProvider: Contract for working with dates/times
 * - INotificationEventEmitter: Contract for emitting notification lifecycle events
 *
 * Benefits:
 * - Testability: Easy to mock these interfaces in tests
 * - Flexibility: Swap implementations without changing core logic
 * - Framework independence: Core layer doesn't depend on specific libraries
 */

import type {
  Notification,
  NotificationChannel,
  NotificationContent,
  NotificationRecipient,
  NotificationResult,
} from "./types";

/**
 * Port: Notification sender abstraction
 *
 * This interface defines the contract that all notification senders must implement.
 * The infrastructure layer will provide concrete implementations for each channel:
 * - Email: NodemailerSender, AwsSesSender, etc.
 * - SMS: TwilioSmsSender, AwsSnsSender, VonageSmsSender, etc.
 * - Push: FirebasePushSender, OneSignalPushSender, etc.
 *
 * Each sender is responsible for:
 * 1. Sending messages through their specific provider/channel
 * 2. Validating recipient information matches channel requirements
 * 3. Checking readiness/configuration before attempting to send
 */
export interface INotificationSender {
  /**
   * The channel this sender handles (e.g., "email", "sms", "push")
   * Used by the core service to route notifications to the correct sender
   */
  readonly channel: NotificationChannel;

  /**
   * Send a notification to a recipient
   *
   * @param _recipient - The recipient information (email, phone, device token, etc.)
   * @param _content - The notification content (title, body, html, etc.)
   * @returns Promise<NotificationResult> - Result indicating success/failure and provider details
   *
   * This method performs the actual sending operation through the provider's API.
   * It should handle provider-specific errors and return a consistent result format.
   */
  send(
    _recipient: NotificationRecipient,
    _content: NotificationContent,
  ): Promise<NotificationResult>;

  /**
   * Check if the sender is properly configured and ready
   *
   * @returns Promise<boolean> - true if ready to send, false otherwise
   *
   * This method verifies:
   * - Required configuration/credentials are present
   * - Connection to provider can be established
   * - Any required resources are available
   *
   * Called before attempting to send to avoid unnecessary failures
   */
  isReady(): Promise<boolean>;

  /**
   * Validate recipient has required fields for this channel
   *
   * @param _recipient - The recipient to validate
   * @returns boolean - true if recipient is valid for this channel
   *
   * Validation rules by channel:
   * - Email: Must have valid email address
   * - SMS: Must have valid phone number
   * - Push: Must have device token
   * - In-App: Must have user ID
   * - Webhook: Must have URL in metadata
   */
  validateRecipient(_recipient: NotificationRecipient): boolean;
}

/**
 * Port: Notification repository abstraction
 *
 * This interface defines the contract for persisting and retrieving notifications.
 * The infrastructure layer will provide implementations for different databases:
 * - MongoDB: MongooseRepository
 * - PostgreSQL: PostgresRepository (custom)
 * - In-Memory: InMemoryRepository (for testing)
 *
 * The repository handles all CRUD operations and queries for notifications,
 * allowing the core service to remain database-agnostic.
 */
export interface INotificationRepository {
  /**
   * Create a new notification record in the database
   *
   * @param _notification - Notification data (without id, createdAt, updatedAt)
   * @returns Promise<Notification> - The created notification with generated ID and timestamps
   *
   * The repository implementation should:
   * - Generate a unique ID
   * - Set createdAt and updatedAt timestamps
   * - Persist to database
   * - Return the complete notification object
   */
  create(
    _notification: Omit<Notification, "id" | "createdAt" | "updatedAt">,
  ): Promise<Notification>;

  /**
   * Find a notification by its unique ID
   *
   * @param _id - The notification ID to search for
   * @returns Promise<Notification | null> - The notification if found, null otherwise
   *
   * Used for:
   * - Retrieving notification details
   * - Checking notification status
   * - Retry operations
   */
  findById(_id: string): Promise<Notification | null>;

  /**
   * Find notifications matching specified criteria
   *
   * @param _criteria - Query filters (recipientId, channel, status, dates, pagination)
   * @returns Promise<Notification[]> - Array of matching notifications
   *
   * Supports filtering by:
   * - Recipient ID (get all notifications for a user)
   * - Channel (get all email/SMS/push notifications)
   * - Status (find pending/failed/sent notifications)
   * - Priority (get urgent notifications)
   * - Date range (notifications between dates)
   * - Pagination (limit and offset)
   */
  find(_criteria: NotificationQueryCriteria): Promise<Notification[]>;

  /**
   * Update an existing notification
   *
   * @param _id - The notification ID to update
   * @param _updates - Partial notification data to update
   * @returns Promise<Notification> - The updated notification
   *
   * Used for:
   * - Updating status during send process
   * - Recording send/delivery timestamps
   * - Incrementing retry count
   * - Storing error messages
   */
  update(_id: string, _updates: Partial<Notification>): Promise<Notification>;

  /**
   * Delete a notification by ID
   *
   * @param _id - The notification ID to delete
   * @returns Promise<boolean> - true if deleted, false if not found
   *
   * Note: Be cautious with deletion - consider soft deletes for audit purposes
   */
  delete(_id: string): Promise<boolean>;

  /**
   * Count notifications matching criteria
   *
   * @param _criteria - Query filters (same as find)
   * @returns Promise<number> - Count of matching notifications
   *
   * Useful for:
   * - Dashboard statistics
   * - Pagination (total count)
   * - Monitoring failed notification counts
   */
  count(_criteria: NotificationQueryCriteria): Promise<number>;

  /**
   * Find notifications that are ready to be sent
   *
   * @param _limit - Maximum number of notifications to return
   * @returns Promise<Notification[]> - Notifications ready for sending
   *
   * Returns notifications that are:
   * - Status = QUEUED (ready to send immediately), OR
   * - Status = PENDING with scheduledFor <= now (scheduled time has arrived)
   *
   * Ordered by:
   * 1. Priority (urgent first)
   * 2. Created date (oldest first)
   *
   * Used by scheduled jobs or queue processors to batch-send notifications
   */
  findReadyToSend(_limit: number): Promise<Notification[]>;
}

/**
 * Query criteria for finding notifications
 *
 * This interface defines all possible filters for querying notifications.
 * All fields are optional - you can combine any filters you need.
 *
 * Example queries:
 * ```typescript
 * // Find all failed emails for a user
 * { recipientId: "user-123", channel: "email", status: "failed" }
 *
 * // Find urgent notifications from last 24 hours
 * { priority: "urgent", fromDate: "2026-03-30T00:00:00Z", limit: 50 }
 *
 * // Paginate through SMS notifications (page 3, 20 per page)
 * { channel: "sms", limit: 20, offset: 40 }
 * ```
 */
export interface NotificationQueryCriteria {
  recipientId?: string; // Filter by recipient ID
  channel?: NotificationChannel; // Filter by channel (email, sms, push, etc.)
  status?: string; // Filter by status (pending, sent, failed, etc.)
  priority?: string; // Filter by priority (low, normal, high, urgent)
  fromDate?: string; // Start date (ISO 8601)
  toDate?: string; // End date (ISO 8601)
  limit?: number; // Max results to return (pagination)
  offset?: number; // Number of results to skip (pagination)
}

/**
 * Port: Template Engine - Abstraction for rendering notification templates
 *
 * The template engine is responsible for:
 * - Loading templates by ID (e.g., "welcome-email", "password-reset-sms")
 * - Rendering templates with variables (e.g., {{ userName }} → "John Doe")
 * - Returning rendered content (title, body, HTML)
 *
 * Why abstract this?
 * - Allows different template engines (Handlebars, Mustache, EJS, etc.)
 * - Supports loading from different sources (filesystem, database, API)
 * - Testable (mock template engine for tests)
 * - Swappable implementation without changing core logic
 *
 * Infrastructure implementations:
 * - HandlebarsTemplateEngine (uses Handlebars syntax)
 * - FileSystemTemplateEngine (loads from .hbs files)
 * - DatabaseTemplateEngine (loads from database)
 * - NoOpTemplateEngine (for apps not using templates)
 *
 * Template structure example:
 * ```handlebars
 * Title: Welcome to {{appName}}!
 * Body: Hi {{userName}}, thanks for joining {{appName}}.
 *       Your account is now active.
 * HTML: <h1>Welcome to {{appName}}!</h1>
 *       <p>Hi {{userName}}, thanks for joining.</p>
 * ```
 */
export interface ITemplateEngine {
  /**
   * Render a template with variables
   *
   * @param _templateId - Unique template identifier (e.g., "welcome-email")
   * @param _variables - Key-value pairs for variable substitution
   * @returns Promise<TemplateResult> - Rendered title, body, and HTML
   * @throws TemplateError - If template doesn't exist or rendering fails
   *
   * Example:
   * ```typescript
   * const result = await templateEngine.render("welcome-email", {
   *   userName: "John Doe",
   *   appName: "MyApp"
   * });
   * // Returns: { title: "Welcome to MyApp!", body: "Hi John Doe, ...", html: "<h1>..." }
   * ```
   */
  render(_templateId: string, _variables: Record<string, unknown>): Promise<TemplateResult>;

  /**
   * Check if a template exists
   *
   * @param _templateId - Template ID to check
   * @returns Promise<boolean> - true if template exists, false otherwise
   *
   * Useful for validation before attempting to render
   */
  hasTemplate(_templateId: string): Promise<boolean>;

  /**
   * Validate that all required template variables are provided
   *
   * @param _templateId - Template ID
   * @param _variables - Variables to validate
   * @returns Promise<boolean> - true if all required variables present
   *
   * Example:
   * If template requires {{ userName }} and {{ code }}, this checks both are provided
   */
  validateVariables(_templateId: string, _variables: Record<string, unknown>): Promise<boolean>;
}

/**
 * Result of template rendering
 *
 * Contains the rendered content ready to be sent.
 * - title: Used as email subject, push notification title, etc.
 * - body: Plain text content
 * - html: HTML content (for email, optional)
 */
export interface TemplateResult {
  title: string; // Rendered title/subject
  body: string; // Rendered plain text body
  html?: string; // Rendered HTML body (optional, mainly for email)
}

/**
 * Port: ID Generator - Abstraction for generating unique IDs
 *
 * This port allows pluggable ID generation strategies.
 *
 * Why abstract this?
 * - Different ID formats (UUID, nanoid, ULID, Snowflake, etc.)
 * - Testable (predictable IDs in tests)
 * - Consistent ID format across the system
 *
 * Infrastructure implementations:
 * - UUIDGenerator (uses uuid v4)
 * - NanoidGenerator (uses nanoid)
 * - ULIDGenerator (uses ULID - sortable by time)
 * - IncrementalIdGenerator (for testing)
 */
export interface IIdGenerator {
  /**
   * Generate a unique ID for a notification
   *
   * @returns string - A unique identifier
   *
   * Requirements:
   * - Must be globally unique (no collisions)
   * - Should be URL-safe
   * - Recommended: Sortable by creation time (ULID)
   *
   * Example implementations:
   * - UUID v4: "550e8400-e29b-41d4-a716-446655440000"
   * - Nanoid: "V1StGXR8_Z5jdHi6B-myT"
   * - ULID: "01ARZ3NDEKTSV4RRFFQ69G5FAV"
   */
  generate(): string;
}

/**
 * Port: Date/Time Provider - Abstraction for date/time operations
 *
 * Why abstract date/time?
 * - Testability: Mock current time in tests
 * - Consistency: All timestamps in same format (ISO 8601)
 * - Timezone handling: Normalize to UTC
 *
 * Infrastructure implementations:
 * - SystemDateTimeProvider (uses system time)
 * - FixedDateTimeProvider (for testing - returns fixed time)
 */
export interface IDateTimeProvider {
  /**
   * Get current timestamp in ISO 8601 format
   *
   * @returns string - Current UTC time as ISO 8601
   *
   * Example: "2026-03-31T14:30:00.000Z"
   *
   * Used for:
   * - Setting createdAt, updatedAt timestamps
   * - Recording sentAt, deliveredAt times
   * - Comparing with scheduledFor dates
   */
  now(): string;

  /**
   * Check if a datetime is in the past
   *
   * @param _datetime - ISO 8601 datetime string
   * @returns boolean - true if datetime < now
   *
   * Used for:
   * - Validating scheduled dates
   * - Finding expired items
   */
  isPast(_datetime: string): boolean;

  /**
   * Check if a datetime is in the future
   *
   * @param _datetime - ISO 8601 datetime string
   * @returns boolean - true if datetime > now
   *
   * Used for:
   * - Checking if notification is scheduled for future
   * - Validating input dates
   */
  isFuture(_datetime: string): boolean;
}

/**
 * Port: Notification Queue - Abstraction for async notification queue
 *
 * The queue is used for asynchronous notification processing:
 * - Decouple notification creation from sending
 * - Handle high-volume notification bursts
 * - Prioritize urgent notifications
 * - Retry failed notifications
 *
 * Why use a queue?
 * - Performance: Don't block API responses waiting for sends
 * - Reliability: Persist notifications if sender is temporarily down
 * - Scalability: Multiple workers can process queue in parallel
 * - Rate limiting: Control send rate to avoid provider limits
 *
 * Infrastructure implementations:
 * - RedisQueue (Redis-based queue with prioritization)
 * - BullMQQueue (Bull queue with advanced features)
 * - SQSQueue (AWS SQS)
 * - InMemoryQueue (for testing/development)
 *
 * Typical flow:
 * 1. API request creates notification → notification.status = QUEUED
 * 2. Notification ID is added to queue
 * 3. Worker dequeues notification ID
 * 4. Worker sends notification and updates status
 */
export interface INotificationQueue {
  /**
   * Add a notification to the queue for async processing
   *
   * @param _notificationId - ID of notification to queue
   * @param _priority - Optional priority (urgent notifications processed first)
   * @returns Promise<void>
   *
   * Example:
   * ```typescript
   * // Create notification
   * const notification = await service.create(dto);
   *
   * // Queue for async processing
   * await queue.enqueue(notification.id, notification.priority);
   * ```
   */
  enqueue(_notificationId: string, _priority?: string): Promise<void>;

  /**
   * Remove and return the next notification ID from the queue
   *
   * @returns Promise<string | null> - Next notification ID, or null if queue is empty
   *
   * Worker loop example:
   * ```typescript
   * while (true) {
   *   const notificationId = await queue.dequeue();
   *   if (notificationId) {
   *     await notificationService.sendById(notificationId);
   *   } else {
   *     await sleep(1000); // Wait if queue is empty
   *   }
   * }
   * ```
   */
  dequeue(): Promise<string | null>;

  /**
   * Get the current size of the queue
   *
   * @returns Promise<number> - Number of notifications waiting in queue
   *
   * Useful for monitoring and alerting (e.g., alert if queue size > 10000)
   */
  size(): Promise<number>;

  /**
   * Clear all notifications from the queue
   *
   * @returns Promise<void>
   *
   * Use with caution - typically only for testing or emergency queue purges
   */
  clear(): Promise<void>;
}

/**
 * Port: Event Emitter - Abstraction for publishing notification lifecycle events
 *
 * The event emitter publishes events for monitoring, logging, analytics, and
 * integrations throughout the notification lifecycle.
 *
 * Why emit events?
 * - Monitoring: Track send success/failure rates
 * - Analytics: Measure notification engagement
 * - Logging: Audit trail of all notifications
 * - Integrations: Trigger webhooks, update CRM, send to data warehouse
 * - Real-time updates: WebSocket updates to admin dashboard
 *
 * Infrastructure implementations:
 * - EventEmitter2EventEmitter (Node.js EventEmitter2)
 * - KafkaEventEmitter (publish to Kafka topics)
 * - SQSEventEmitter (publish to AWS SQS)
 * - WebhookEventEmitter (HTTP webhooks)
 * - CompositeEventEmitter (emit to multiple destinations)
 *
 * Event flow example:
 * 1. notification.created → Log to console, send to analytics
 * 2. notification.sending → Update dashboard with "sending" status
 * 3. notification.sent → Increment Prometheus counter, log success
 * 4. notification.delivered → Update CRM with delivery confirmation
 */
export interface INotificationEventEmitter {
  /**
   * Emit a notification lifecycle event
   *
   * @param _event - The event to emit (see NotificationEvent type)
   * @returns Promise<void>
   *
   * Events should be fire-and-forget. Event emission failures should not
   * prevent notification processing (log errors but don't throw).
   *
   * Example implementation:
   * ```typescript
   * async emit(event: NotificationEvent) {
   *   try {
   *     console.log(`[EVENT] ${event.type}`, event);
   *     await kafka.send({ topic: 'notifications', messages: [{ value: JSON.stringify(event) }] });
   *   } catch (error) {
   *     console.error('Failed to emit event:', error);
   *     // Don't throw - event emission is non-critical
   *   }
   * }
   * ```
   */
  emit(_event: NotificationEvent): Promise<void>;
}

/**
 * Notification lifecycle events
 *
 * These are all possible events emitted during a notification's lifecycle.
 * Each event type has a specific structure with relevant data.
 *
 * Event types:
 *
 * 1. "notification.created" - Notification was created
 *    - Contains: notification entity
 *    - When: After create() succeeds
 *
 * 2. "notification.queued" - Notification was added to async queue
 *    - Contains: notification entity
 *    - When: After enqueue() succeeds
 *
 * 3. "notification.sending" - Send operation started
 *    - Contains: notification entity (status = SENDING)
 *    - When: Before calling sender.send()
 *
 * 4. "notification.sent" - Send succeeded
 *    - Contains: notification entity (status = SENT), send result
 *    - When: After sender.send() returns success
 *
 * 5. "notification.delivered" - Provider confirmed delivery
 *    - Contains: notification entity (status = DELIVERED)
 *    - When: Webhook callback from provider
 *
 * 6. "notification.failed" - Send failed
 *    - Contains: notification entity (status = FAILED), error message
 *    - When: After sender.send() returns failure or throws error
 *
 * 7. "notification.cancelled" - Notification was cancelled
 *    - Contains: notification entity (status = CANCELLED)
 *    - When: After cancel() succeeds
 */
export type NotificationEvent =
  | { type: "notification.created"; notification: Notification }
  | { type: "notification.queued"; notification: Notification }
  | { type: "notification.sending"; notification: Notification }
  | { type: "notification.sent"; notification: Notification; result: NotificationResult }
  | { type: "notification.delivered"; notification: Notification }
  | { type: "notification.failed"; notification: Notification; error: string }
  | { type: "notification.cancelled"; notification: Notification };
