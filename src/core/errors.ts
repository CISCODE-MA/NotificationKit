/**
 * Base error class for notification-related errors
 */
export class NotificationError extends Error {
  constructor(
    message: string,
    public readonly _code: string,
    public readonly _details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "NotificationError";
    Object.setPrototypeOf(this, NotificationError.prototype);
  }

  get code(): string {
    return this._code;
  }

  get details(): Record<string, unknown> | undefined {
    return this._details;
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends NotificationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error thrown when a notification is not found
 */
export class NotificationNotFoundError extends NotificationError {
  constructor(notificationId: string) {
    super(`Notification with ID ${notificationId} not found`, "NOTIFICATION_NOT_FOUND", {
      notificationId,
    });
    this.name = "NotificationNotFoundError";
    Object.setPrototypeOf(this, NotificationNotFoundError.prototype);
  }
}

/**
 * Error thrown when a sender is not available for a channel
 */
export class SenderNotAvailableError extends NotificationError {
  constructor(channel: string) {
    super(`No sender available for channel: ${channel}`, "SENDER_NOT_AVAILABLE", { channel });
    this.name = "SenderNotAvailableError";
    Object.setPrototypeOf(this, SenderNotAvailableError.prototype);
  }
}

/**
 * Error thrown when sending a notification fails
 */
export class SendFailedError extends NotificationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "SEND_FAILED", details);
    this.name = "SendFailedError";
    Object.setPrototypeOf(this, SendFailedError.prototype);
  }
}

/**
 * Error thrown when recipient validation fails
 */
export class InvalidRecipientError extends NotificationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "INVALID_RECIPIENT", details);
    this.name = "InvalidRecipientError";
    Object.setPrototypeOf(this, InvalidRecipientError.prototype);
  }
}

/**
 * Error thrown when template rendering fails
 */
export class TemplateError extends NotificationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "TEMPLATE_ERROR", details);
    this.name = "TemplateError";
    Object.setPrototypeOf(this, TemplateError.prototype);
  }
}

/**
 * Error thrown when notification has reached max retries
 */
export class MaxRetriesExceededError extends NotificationError {
  constructor(notificationId: string, retryCount: number) {
    super(
      `Notification ${notificationId} exceeded max retries (${retryCount})`,
      "MAX_RETRIES_EXCEEDED",
      { notificationId, retryCount },
    );
    this.name = "MaxRetriesExceededError";
    Object.setPrototypeOf(this, MaxRetriesExceededError.prototype);
  }
}
