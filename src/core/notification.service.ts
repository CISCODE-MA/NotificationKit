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
 * Core notification service - contains all business logic
 */
export class NotificationService {
  private readonly senders: Map<string, INotificationSender>;

  constructor(
    private readonly repository: INotificationRepository,
    private readonly idGenerator: IIdGenerator,
    private readonly dateTimeProvider: IDateTimeProvider,
    senders: INotificationSender[],
    private readonly templateEngine?: ITemplateEngine,
    private readonly eventEmitter?: INotificationEventEmitter,
  ) {
    this.senders = new Map(senders.map((sender) => [sender.channel, sender]));
  }

  /**
   * Create a new notification without sending it
   */
  async create(dto: CreateNotificationDto): Promise<Notification> {
    // Validate recipient for the channel
    const sender = this.senders.get(dto.channel);
    if (sender && !sender.validateRecipient(dto.recipient)) {
      throw new InvalidRecipientError(
        `Recipient does not have required fields for channel: ${dto.channel}`,
        { channel: dto.channel, recipient: dto.recipient },
      );
    }

    // Process template if provided
    let content = dto.content;
    if (dto.content.templateId && this.templateEngine) {
      content = await this.renderTemplate(dto);
    }

    const isScheduled = dto.scheduledFor && this.dateTimeProvider.isFuture(dto.scheduledFor);

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

    await this.emitEvent({ type: "notification.created", notification });

    return notification;
  }

  /**
   * Send a notification immediately
   */
  async send(dto: SendNotificationDto): Promise<NotificationResult> {
    // Create the notification
    const notification = await this.create(dto);

    // Send it immediately
    return this.sendNotification(notification);
  }

  /**
   * Send an existing notification by ID
   */
  async sendById(notificationId: string): Promise<NotificationResult> {
    const notification = await this.repository.findById(notificationId);
    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }

    return this.sendNotification(notification);
  }

  /**
   * Internal method to send a notification
   */
  private async sendNotification(notification: Notification): Promise<NotificationResult> {
    // Check if notification can be sent
    if (notification.status === NotificationStatus.SENT) {
      return {
        success: true,
        notificationId: notification.id,
        metadata: { message: "Already sent" },
      };
    }

    if (notification.status === NotificationStatus.CANCELLED) {
      return {
        success: false,
        notificationId: notification.id,
        error: "Notification is cancelled",
      };
    }

    // Check retry limit
    if (notification.retryCount >= notification.maxRetries) {
      throw new MaxRetriesExceededError(notification.id, notification.retryCount);
    }

    // Get sender for channel
    const sender = this.senders.get(notification.channel);
    if (!sender) {
      throw new SenderNotAvailableError(notification.channel);
    }

    // Check sender is ready
    const isReady = await sender.isReady();
    if (!isReady) {
      throw new SenderNotAvailableError(notification.channel);
    }

    try {
      // Update status to sending
      await this.repository.update(notification.id, {
        status: NotificationStatus.SENDING,
        updatedAt: this.dateTimeProvider.now(),
      });

      await this.emitEvent({
        type: "notification.sending",
        notification: { ...notification, status: NotificationStatus.SENDING },
      });

      // Send the notification
      const result = await sender.send(notification.recipient, notification.content);

      if (result.success) {
        // Update status to sent
        const updatedNotification = await this.repository.update(notification.id, {
          status: NotificationStatus.SENT,
          sentAt: this.dateTimeProvider.now(),
          updatedAt: this.dateTimeProvider.now(),
        });

        await this.emitEvent({
          type: "notification.sent",
          notification: updatedNotification,
          result,
        });

        return result;
      } else {
        // Sending failed, update retry count
        const updatedNotification = await this.repository.update(notification.id, {
          status: NotificationStatus.FAILED,
          error: result.error,
          retryCount: notification.retryCount + 1,
          updatedAt: this.dateTimeProvider.now(),
        });

        await this.emitEvent({
          type: "notification.failed",
          notification: updatedNotification,
          error: result.error || "Unknown error",
        });

        throw new SendFailedError(result.error || "Send failed", {
          notificationId: notification.id,
          result,
        });
      }
    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await this.repository.update(notification.id, {
        status: NotificationStatus.FAILED,
        error: errorMessage,
        retryCount: notification.retryCount + 1,
        updatedAt: this.dateTimeProvider.now(),
      });

      throw error;
    }
  }

  /**
   * Get a notification by ID
   */
  async getById(notificationId: string): Promise<Notification> {
    const notification = await this.repository.findById(notificationId);
    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }
    return notification;
  }

  /**
   * Query notifications
   */
  async query(criteria: NotificationQueryCriteria): Promise<Notification[]> {
    return this.repository.find(criteria);
  }

  /**
   * Count notifications
   */
  async count(criteria: NotificationQueryCriteria): Promise<number> {
    return this.repository.count(criteria);
  }

  /**
   * Cancel a notification
   */
  async cancel(notificationId: string): Promise<Notification> {
    const notification = await this.repository.findById(notificationId);
    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }

    if (notification.status === NotificationStatus.SENT) {
      throw new SendFailedError("Cannot cancel a notification that has already been sent", {
        notificationId,
      });
    }

    const updated = await this.repository.update(notificationId, {
      status: NotificationStatus.CANCELLED,
      updatedAt: this.dateTimeProvider.now(),
    });

    await this.emitEvent({ type: "notification.cancelled", notification: updated });

    return updated;
  }

  /**
   * Retry a failed notification
   */
  async retry(notificationId: string): Promise<NotificationResult> {
    const notification = await this.repository.findById(notificationId);
    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }

    if (notification.status !== NotificationStatus.FAILED) {
      throw new SendFailedError("Only failed notifications can be retried", { notificationId });
    }

    return this.sendNotification(notification);
  }

  /**
   * Process scheduled notifications that are ready to send
   */
  async processScheduled(limit = 100): Promise<NotificationResult[]> {
    const notifications = await this.repository.findReadyToSend(limit);
    const results: NotificationResult[] = [];

    for (const notification of notifications) {
      try {
        const result = await this.sendNotification(notification);
        results.push(result);
      } catch (error) {
        // Log error but continue processing other notifications
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
   */
  async markAsDelivered(
    notificationId: string,
    metadata?: Record<string, unknown>,
  ): Promise<Notification> {
    const notification = await this.repository.findById(notificationId);
    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }

    const updated = await this.repository.update(notificationId, {
      status: NotificationStatus.DELIVERED,
      deliveredAt: this.dateTimeProvider.now(),
      updatedAt: this.dateTimeProvider.now(),
      metadata: { ...notification.metadata, ...metadata },
    });

    await this.emitEvent({ type: "notification.delivered", notification: updated });

    return updated;
  }

  /**
   * Render a template with variables
   */
  private async renderTemplate(dto: CreateNotificationDto) {
    if (!this.templateEngine || !dto.content.templateId) {
      return dto.content;
    }

    try {
      const rendered = await this.templateEngine.render(
        dto.content.templateId,
        dto.content.templateVars || {},
      );

      return {
        ...dto.content,
        title: rendered.title,
        body: rendered.body,
        html: rendered.html,
      };
    } catch (error) {
      throw new TemplateError(`Failed to render template: ${dto.content.templateId}`, {
        templateId: dto.content.templateId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Emit a notification event
   */
  private async emitEvent(event: Parameters<INotificationEventEmitter["emit"]>[0]): Promise<void> {
    if (this.eventEmitter) {
      await this.eventEmitter.emit(event);
    }
  }
}
