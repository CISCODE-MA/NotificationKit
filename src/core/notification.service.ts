/**
 * @file Core Notification Service
 *
 * This file contains the main NotificationService class which orchestrates all notification operations.
 * It is the heart of the NotificationKit business logic and handles:
 *
 * - Creating notifications (with validation and template rendering)
 * - Sending notifications through appropriate channels
 * - Managing notification lifecycle (pending, queued, sending, sent, delivered, failed)
 * - Handling retries for failed notifications
 * - Processing scheduled notifications
 * - Querying and managing notification records
 * - Emitting lifecycle events for monitoring
 *
 * Architecture:
 * - This service depends only on port interfaces (INotificationSender, INotificationRepository, etc.)
 * - It knows nothing about specific implementations (Nodemailer, Twilio, MongoDB, etc.)
 * - This allows swapping implementations without changing this code (dependency inversion)
 *
 * Key Responsibilities:
 * 1. Validation: Ensures recipients have required fields for their channel
 * 2. Template Processing: Renders templates if templateId is provided
 * 3. Scheduling: Handles scheduled vs immediate sends
 * 4. Retry Logic: Attempts retries on failures (respecting maxRetries)
 * 5. Status Tracking: Updates notification status throughout lifecycle
 * 6. Event Emission: Fires events for monitoring and integrations
 */

import type { CreateNotificationDto, SendNotificationDto } from "./dtos";
import {
  InvalidRecipientError,
  MaxRetriesExceededError,
  NotificationNotFoundError,
  SenderNotAvailableError,
  SendFailedError,
  TemplateError,
} from "./errors";
import type {
  IDateTimeProvider,
  IIdGenerator,
  INotificationEventEmitter,
  INotificationRepository,
  INotificationSender,
  ITemplateEngine,
  NotificationQueryCriteria,
} from "./ports";
import { type Notification, type NotificationResult, NotificationStatus } from "./types";

/**
 * Core notification service - orchestrates all notification business logic
 *
 * This service is the main entry point for notification operations and coordinates
 * between senders, repository, template engine, and other dependencies.
 */
export class NotificationService {
  // Map of notification channels to their respective senders (e.g., "email" -> NodemailerSender)
  // This allows O(1) lookup when routing notifications to the correct sender
  private readonly senders: Map<string, INotificationSender>;

  /**
   * Constructor - Initialize the notification service with all dependencies
   *
   * @param repository - Repository for persisting notifications (MongoDB, PostgreSQL, etc.)
   * @param idGenerator - Generator for creating unique notification IDs
   * @param dateTimeProvider - Provider for working with dates/times (for scheduling)
   * @param senders - Array of notification senders (email, SMS, push, etc.)
   * @param templateEngine - Optional template engine for rendering notification content
   * @param eventEmitter - Optional event emitter for lifecycle events
   *
   * The senders array is converted to a Map keyed by channel for fast lookups.
   * Example: [NodemailerSender, TwilioSmsSender] becomes Map { "email" => NodemailerSender, "sms" => TwilioSmsSender }
   */
  constructor(
    private readonly repository: INotificationRepository,
    private readonly idGenerator: IIdGenerator,
    private readonly dateTimeProvider: IDateTimeProvider,
    senders: INotificationSender[],
    private readonly templateEngine?: ITemplateEngine,
    private readonly eventEmitter?: INotificationEventEmitter,
  ) {
    // Build a map of channel name to sender for efficient routing
    // This allows us to quickly find the right sender based on notification channel
    this.senders = new Map(senders.map((sender) => [sender.channel, sender]));
  }

  /**
   * Create a new notification without sending it immediately
   *
   * This method:
   * 1. Validates the recipient has required fields for the channel
   * 2. Renders template if templateId is provided
   * 3. Determines initial status (PENDING for scheduled, QUEUED for immediate)
   * 4. Persists the notification to repository
   * 5. Emits a "notification.created" event
   *
   * @param dto - Data transfer object containing notification details
   * @returns Promise<Notification> - The created notification with generated ID and timestamps
   * @throws InvalidRecipientError - If recipient is missing required fields for the channel
   * @throws TemplateError - If template rendering fails
   *
   * Use this method when you want to create a notification record but send it later
   * (e.g., for batch processing, scheduled sends, or queue-based systems)
   */
  async create(dto: CreateNotificationDto): Promise<Notification> {
    // Step 1: Validate recipient has required fields for the channel
    // Example: Email channel requires email address, SMS requires phone number
    const sender = this.senders.get(dto.channel);
    if (sender && !sender.validateRecipient(dto.recipient)) {
      throw new InvalidRecipientError(
        `Recipient does not have required fields for channel: ${dto.channel}`,
        { channel: dto.channel, recipient: dto.recipient },
      );
    }

    // Step 2: Process template if template ID is provided
    // This replaces {{variables}} in the template with actual values
    let content = dto.content;
    if (dto.content.templateId && this.templateEngine) {
      content = await this.renderTemplate(dto);
    }

    // Step 3: Determine initial status based on scheduling
    // If scheduledFor is in the future, status = PENDING (waiting for scheduled time)
    // Otherwise, status = QUEUED (ready to send immediately)
    const isScheduled = dto.scheduledFor && this.dateTimeProvider.isFuture(dto.scheduledFor);

    // Step 4: Persist the notification to the database
    // The repository will generate ID, createdAt, and updatedAt timestamps
    const notification = await this.repository.create({
      channel: dto.channel,
      status: isScheduled ? NotificationStatus.PENDING : NotificationStatus.QUEUED,
      priority: dto.priority,
      recipient: dto.recipient,
      content,
      scheduledFor: dto.scheduledFor,
      sentAt: undefined,
      deliveredAt: undefined,
      error: undefined,
      retryCount: 0,
      maxRetries: dto.maxRetries,
      metadata: dto.metadata,
    });

    // Step 5: Emit creation event for monitoring/logging
    await this.emitEvent({ type: "notification.created", notification });

    return notification;
  }

  /**
   * Send a notification immediately
   *
   * This is a convenience method that combines create() and send():
   * 1. Creates the notification record
   * 2. Immediately sends it through the appropriate channel
   *
   * @param dto - Notification details (channel, recipient, content, etc.)
   * @returns Promise<NotificationResult> - Result with success status and provider details
   * @throws InvalidRecipientError - If recipient is invalid
   * @throws SenderNotAvailableError - If no sender for channel or sender not ready
   * @throws SendFailedError - If send operation fails
   *
   * This is the most common method - use it when you want to send right away
   */
  async send(dto: SendNotificationDto): Promise<NotificationResult> {
    // Create the notification record in database
    const notification = await this.create(dto);

    // Send it immediately through the appropriate channel sender
    return this.sendNotification(notification);
  }

  /**
   * Send an existing notification by ID
   *
   * Useful for:
   * - Retrying failed notifications
   * - Sending scheduled notifications when their time arrives
   * - Processing notifications from a queue
   *
   * @param notificationId - The ID of the notification to send
   * @returns Promise<NotificationResult> - Result of the send operation
   * @throws NotificationNotFoundError - If notification doesn't exist
   * @throws SenderNotAvailableError - If sender not available
   */
  async sendById(notificationId: string): Promise<NotificationResult> {
    // Retrieve the notification from database
    const notification = await this.repository.findById(notificationId);
    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }

    // Send it through the channel sender
    return this.sendNotification(notification);
  }

  /**
   * Internal method to send a notification through its channel
   *
   * This is the core send logic that:
   * 1. Validates notification can be sent (not already sent/cancelled)
   * 2. Checks retry limits haven't been exceeded
   * 3. Finds and validates the appropriate sender
   * 4. Updates status to SENDING
   * 5. Calls the sender to perform actual send
   * 6. Updates status to SENT on success or FAILED on error
   * 7. Emits lifecycle events throughout the process
   * 8. Handles retries by incrementing retry count
   *
   * @param notification - The notification to send
   * @returns Promise<NotificationResult> - Result with success status and details
   * @throws MaxRetriesExceededError - If retry limit reached
   * @throws SenderNotAvailableError - If no sender for channel or not ready
   * @throws SendFailedError - If send fails
   *
   * This method is called internally by send(), sendById(), and retry()
   */
  private async sendNotification(notification: Notification): Promise<NotificationResult> {
    // Guard: Check if notification is already sent (idempotency check)
    // Prevents duplicate sends if method is called twice
    if (notification.status === NotificationStatus.SENT) {
      return {
        success: true,
        notificationId: notification.id,
        metadata: { message: "Already sent" },
      };
    }

    // Guard: Check if notification was cancelled
    // Cancelled notifications should not be sent
    if (notification.status === NotificationStatus.CANCELLED) {
      return {
        success: false,
        notificationId: notification.id,
        error: "Notification is cancelled",
      };
    }

    // Guard: Check if retry limit has been exceeded
    // Prevents infinite retry loops
    if (notification.retryCount >= notification.maxRetries) {
      throw new MaxRetriesExceededError(notification.id, notification.retryCount);
    }

    // Get the sender for this notification's channel
    // Example: For channel="email", get NodemailerSender from the senders map
    const sender = this.senders.get(notification.channel);
    if (!sender) {
      throw new SenderNotAvailableError(notification.channel);
    }

    // Check if sender is properly configured and ready to send
    // This verifies credentials, connections, etc.
    const isReady = await sender.isReady();
    if (!isReady) {
      throw new SenderNotAvailableError(notification.channel);
    }

    try {
      // Step 1: Update status to SENDING in database
      // This marks the notification as currently being processed
      await this.repository.update(notification.id, {
        status: NotificationStatus.SENDING,
        updatedAt: this.dateTimeProvider.now(),
      });

      // Emit event for monitoring/logging
      await this.emitEvent({
        type: "notification.sending",
        notification: { ...notification, status: NotificationStatus.SENDING },
      });

      // Step 2: Perform the actual send operation through the sender
      // This calls the external provider (Twilio, Nodemailer, Firebase, etc.)
      const result = await sender.send(notification.recipient, notification.content);

      if (result.success) {
        // SUCCESS PATH: Send was successful
        // Update notification record with sent status and timestamp
        const updatedNotification = await this.repository.update(notification.id, {
          status: NotificationStatus.SENT,
          sentAt: this.dateTimeProvider.now(),
          updatedAt: this.dateTimeProvider.now(),
        });

        // Emit success event for monitoring
        await this.emitEvent({
          type: "notification.sent",
          notification: updatedNotification,
          result,
        });

        return result;
      } else {
        // FAILURE PATH: Send failed (provider returned failure)
        // Update notification with failed status and error message
        // Increment retry count for potential future retry attempts
        const updatedNotification = await this.repository.update(notification.id, {
          status: NotificationStatus.FAILED,
          error: result.error,
          retryCount: notification.retryCount + 1,
          updatedAt: this.dateTimeProvider.now(),
        });

        // Emit failure event for monitoring/alerts
        await this.emitEvent({
          type: "notification.failed",
          notification: updatedNotification,
          error: result.error || "Unknown error",
        });

        // Throw error to propagate failure to caller
        throw new SendFailedError(result.error || "Send failed", {
          notificationId: notification.id,
          result,
        });
      }
    } catch (error) {
      // EXCEPTION PATH: Unexpected error occurred during send
      // This catches errors from the sender or other unexpected issues
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Update notification status to FAILED and record error
      await this.repository.update(notification.id, {
        status: NotificationStatus.FAILED,
        error: errorMessage,
        retryCount: notification.retryCount + 1,
        updatedAt: this.dateTimeProvider.now(),
      });

      // Re-throw error for caller to handle
      throw error;
    }
  }

  /**
   * Get a notification by its unique ID
   *
   * @param notificationId - The notification ID to retrieve
   * @returns Promise<Notification> - The notification entity
   * @throws NotificationNotFoundError - If notification doesn't exist
   *
   * Use this to:
   * - Check notification status
   * - Display notification details to users
   * - Verify notification was created
   */
  async getById(notificationId: string): Promise<Notification> {
    const notification = await this.repository.findById(notificationId);
    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }
    return notification;
  }

  /**
   * Query/search for notifications matching criteria
   *
   * @param criteria - Query filters (recipientId, channel, status, dates, pagination)
   * @returns Promise<Notification[]> - Array of matching notifications
   *
   * Examples:
   * - Get all notifications for a user: { recipientId: "user-123" }
   * - Get failed emails: { channel: "email", status: "failed" }
   * - Get recent urgent notifications: { priority: "urgent", fromDate: "2026-03-01T00:00:00Z", limit: 10 }
   */
  async query(criteria: NotificationQueryCriteria): Promise<Notification[]> {
    return this.repository.find(criteria);
  }

  /**
   * Count notifications matching criteria
   *
   * @param criteria - Query filters (same as query method)
   * @returns Promise<number> - Count of matching notifications
   *
   * Useful for:
   * - Dashboard statistics (total sent, failed, etc.)
   * - Pagination (showing "Page 1 of 10")
   * - Monitoring alerts (e.g., "100 failed notifications in last hour")
   */
  async count(criteria: NotificationQueryCriteria): Promise<number> {
    return this.repository.count(criteria);
  }

  /**
   * Cancel a pending or queued notification
   *
   * @param notificationId - ID of notification to cancel
   * @returns Promise<Notification> - The cancelled notification
   * @throws NotificationNotFoundError - If notification doesn't exist
   * @throws SendFailedError - If notification already sent (can't cancel sent notifications)
   *
   * Use cases:
   * - User opts out before scheduled notification sends
   * - Business logic changes and notification is no longer relevant
   * - Testing/debugging
   *
   * Note: You cannot cancel a notification that's already been sent
   */
  async cancel(notificationId: string): Promise<Notification> {
    // Retrieve the notification
    const notification = await this.repository.findById(notificationId);
    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }

    // Check if already sent (can't cancel sent notifications)
    if (notification.status === NotificationStatus.SENT) {
      throw new SendFailedError("Cannot cancel a notification that has already been sent", {
        notificationId,
      });
    }

    // Update status to cancelled
    const updated = await this.repository.update(notificationId, {
      status: NotificationStatus.CANCELLED,
      updatedAt: this.dateTimeProvider.now(),
    });

    // Emit cancellation event
    await this.emitEvent({ type: "notification.cancelled", notification: updated });

    return updated;
  }

  /**
   * Retry a failed notification
   *
   * @param notificationId - ID of the failed notification to retry
   * @returns Promise<NotificationResult> - Result of the retry attempt
   * @throws NotificationNotFoundError - If notification doesn't exist
   * @throws SendFailedError - If notification isn't in FAILED status
   * @throws MaxRetriesExceededError - If retry limit already reached
   *
   * This method:
   * 1. Retrieves the notification
   * 2. Validates it's in FAILED status
   * 3. Attempts to send it again (retry count will be incremented)
   *
   * Use for:
   * - Manual retry buttons in admin UI
   * - Automated retry jobs (e.g., retry all failed from last hour)
   * - Scheduled retry attempts with exponential backoff
   */
  async retry(notificationId: string): Promise<NotificationResult> {
    const notification = await this.repository.findById(notificationId);
    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }

    // Only failed notifications can be retried
    if (notification.status !== NotificationStatus.FAILED) {
      throw new SendFailedError("Only failed notifications can be retried", { notificationId });
    }

    // Attempt to send again (retry count will be checked and incremented)
    return this.sendNotification(notification);
  }

  /**
   * Process scheduled notifications that are ready to send
   *
   * This method is designed to be called by a scheduled job (cron, queue worker, etc.)
   * It:
   * 1. Queries for notifications ready to send (QUEUED or PENDING with past scheduledFor)
   * 2. Sends each notification
   * 3. Continues processing even if individual sends fail
   * 4. Returns results for all processed notifications
   *
   * @param limit - Maximum number of notifications to process (default: 100)
   * @returns Promise<NotificationResult[]> - Results for all processed notifications
   *
   * Example cron job setup:
   * ```
   * // Every minute, process up to 100 scheduled notifications
   * schedule.scheduleJob('* * * * *', async () => {
   *   const results = await notificationService.processScheduled(100);
   *   console.log(`Processed ${results.length} notifications`);
   * });
   * ```
   */
  async processScheduled(limit = 100): Promise<NotificationResult[]> {
    // Get notifications that are ready to send
    // This includes QUEUED and PENDING notifications where scheduledFor <= now
    const notifications = await this.repository.findReadyToSend(limit);
    const results: NotificationResult[] = [];

    // Process each notification
    // Note: We don't stop on errors - we want to process as many as possible
    for (const notification of notifications) {
      try {
        // Try to send the notification
        const result = await this.sendNotification(notification);
        results.push(result);
      } catch (error) {
        // If send fails, record the error but continue processing others
        // This ensures one bad notification doesn't block the entire batch
        results.push({
          success: false,
          notificationId: notification.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  }

  /**
   * Mark a notification as delivered (called by webhook/callback)
   *
   * Many notification providers (Twilio, SendGrid, etc.) send webhook callbacks
   * when messages are delivered. This method handles those callbacks.
   *
   * @param notificationId - ID of the notification that was delivered
   * @param metadata - Optional additional metadata from the provider
   * @returns Promise<Notification> - The updated notification
   * @throws NotificationNotFoundError - If notification doesn't exist
   *
   * Status flow:
   * SENT -> DELIVERED (confirmed by provider that recipient received it)
   *
   * This is useful for:
   * - Tracking delivery rates
   * - Confirming message receipt
   * - Debugging delivery issues
   *
   * Example webhook handler:
   * ```
   * @Post('webhooks/twilio')
   * async twilioWebhook(@Body() body) {
   *   if (body.MessageStatus === 'delivered') {
   *     await this.notificationService.markAsDelivered(body.MessageSid, body);
   *   }
   * }
   * ```
   */
  async markAsDelivered(
    notificationId: string,
    metadata?: Record<string, unknown>,
  ): Promise<Notification> {
    const notification = await this.repository.findById(notificationId);
    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }

    // Update the notification status to DELIVERED
    // Merge any webhook metadata with existing metadata
    const updated = await this.repository.update(notificationId, {
      status: NotificationStatus.DELIVERED,
      deliveredAt: this.dateTimeProvider.now(),
      updatedAt: this.dateTimeProvider.now(),
      metadata: { ...notification.metadata, ...metadata }, // Preserve existing + add new
    });

    // Emit delivery event for analytics/monitoring
    await this.emitEvent({ type: "notification.delivered", notification: updated });

    return updated;
  }

  /**
   * Render a template with variables (private helper)
   *
   * This method handles template rendering if a template engine is configured.
   * It takes a template ID and variables, renders the template, and returns
   * the rendered content (title, body, html).
   *
   * @param dto - The create notification DTO with template info
   * @returns Promise<NotificationContent> - Content with rendered template
   * @throws TemplateError - If template rendering fails
   *
   * Template rendering flow:
   * 1. Check if template engine is available and templateId is provided
   * 2. If no template, return original content as-is
   * 3. Call template engine with templateId and variables
   * 4. Merge rendered content (title, body, html) back into content object
   *
   * Example template:
   * ```
   * Template ID: "welcome-email"
   * Template: "Hello {{name}}, welcome to {{appName}}!"
   * Variables: { name: "John", appName: "MyApp" }
   * Result: "Hello John, welcome to MyApp!"
   * ```
   */
  private async renderTemplate(dto: CreateNotificationDto) {
    // Guard: If no template engine or no templateId, return content as-is
    // This allows non-template notifications to work without a template engine
    if (!this.templateEngine || !dto.content.templateId) {
      return dto.content;
    }

    try {
      // Render the template using the template engine
      // Pass templateId (e.g., "welcome-email") and variables (e.g., { name: "John" })
      const rendered = await this.templateEngine.render(
        dto.content.templateId,
        dto.content.templateVars || {}, // Use empty object if no variables provided
      );

      // Merge rendered content back into the content object
      // This preserves any other content properties while replacing title/body/html
      return {
        ...dto.content,
        title: rendered.title, // Rendered template title
        body: rendered.body, // Rendered template body (plain text)
        html: rendered.html, // Rendered template HTML (if applicable)
      };
    } catch (error) {
      // If template rendering fails, throw a descriptive error
      // This could happen if template doesn't exist or has syntax errors
      throw new TemplateError(`Failed to render template: ${dto.content.templateId}`, {
        templateId: dto.content.templateId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Emit a notification event (private helper)
   *
   * This method publishes lifecycle events to the event emitter (if configured).
   * Events are used for:
   * - Monitoring and logging (track all notification state changes)
   * - Analytics (count sent, failed, delivered notifications)
   * - Integrations (trigger workflows, webhooks, alerts)
   * - Auditing (compliance, tracking)
   *
   * @param event - The event to emit (type + data)
   *
   * Event types:
   * - "notification.created" - When notification is created
   * - "notification.sending" - When send starts
   * - "notification.sent" - When send succeeds
   * - "notification.failed" - When send fails
   * - "notification.delivered" - When provider confirms delivery
   * - "notification.cancelled" - When notification is cancelled
   *
   * Implementation note:
   * - If no eventEmitter is configured, this is a no-op (silently skip)
   * - Event emission is async but we await it to ensure proper sequencing
   * - Events should not throw errors (emitter should handle failures gracefully)
   */
  private async emitEvent(event: Parameters<INotificationEventEmitter["emit"]>[0]): Promise<void> {
    if (this.eventEmitter) {
      await this.eventEmitter.emit(event);
    }
  }
}
