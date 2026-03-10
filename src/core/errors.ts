/**
 * NotificationKit Custom Error Classes
 *
 * This file defines all custom error types used throughout the NotificationKit package.
 * All errors extend from a base NotificationError class, which provides:
 * - Consistent error structure (message, code, details)
 * - Proper prototype chain for instanceof checks
 * - Type-safe error handling
 *
 * Error Hierarchy:
 * ```
 * Error (built-in)
 *   └── NotificationError (base class)
 *        ├── ValidationError - Input validation failures
 *        ├── NotificationNotFoundError - Notification doesn't exist
 *        ├── SenderNotAvailableError - No sender configured for channel
 *        ├── SendFailedError - Send operation failed
 *        ├── InvalidRecipientError - Recipient data is invalid
 *        ├── TemplateError - Template rendering failed
 *        └── MaxRetriesExceededError - Retry limit reached
 * ```
 *
 * Why custom errors?
 * - Clear error identification: Each error type has a unique code
 * - Structured details: Attach context data to errors (IDs, counts, etc.)
 * - Better debugging: Stack traces and error names help troubleshoot
 * - Type-safe catching: TypeScript can narrow error types in catch blocks
 * - API consistency: Return standardized error responses to clients
 *
 * Usage:
 * ```typescript
 * try {
 *   await notificationService.send(dto);
 * } catch (error) {
 *   if (error instanceof NotificationNotFoundError) {
 *     // Handle missing notification (404)
 *     return { status: 404, message: error.message, code: error.code };
 *   } else if (error instanceof SendFailedError) {
 *     // Handle send failure (500)
 *     return { status: 500, message: error.message, details: error.details };
 *   }
 *   // Handle other errors...
 * }
 * ```
 */

/**
 * Base error class for all notification-related errors
 *
 * All NotificationKit errors extend from this class to provide a consistent
 * error structure and proper instanceof checks.
 *
 * Properties:
 * - message: Human-readable error description (inherited from Error)
 * - _code: Machine-readable error code (e.g., "NOTIFICATION_NOT_FOUND")
 * - _details: Additional context data (e.g., notificationId, retryCount)
 * - name: Error class name (e.g., "NotificationError")
 * - stack: Stack trace (inherited from Error)
 *
 * Why we use Object.setPrototypeOf?
 * TypeScript transpiles to ES5 by default, which breaks instanceof checks for
 * custom errors. Setting the prototype explicitly fixes this.
 *
 * @param message - Description of what went wrong
 * @param _code - Unique error code for programmatic handling
 * @param _details - Additional structured data about the error
 */
export class NotificationError extends Error {
  constructor(
    message: string,
    public readonly _code: string,
    public readonly _details?: Record<string, unknown>,
  ) {
    super(message); // Call parent Error constructor
    this.name = "NotificationError"; // Set error name for stack traces
    Object.setPrototypeOf(this, NotificationError.prototype); // Fix prototype chain for instanceof
  }

  // Getter for error code (makes it readonly to consumers)
  get code(): string {
    return this._code;
  }

  // Getter for error details (makes it readonly to consumers)
  get details(): Record<string, unknown> | undefined {
    return this._details;
  }
}

/**
 * Validation error - thrown when input data fails validation
 *
 * This error is thrown when:
 * - DTO validation fails (Zod schema validation)
 * - Business rule validation fails (e.g., invalid date range)
 * - Required fields are missing
 * - Field values are out of acceptable range
 *
 * Error Code: "VALIDATION_ERROR"
 * HTTP Status: 400 Bad Request
 *
 * Example usage:
 * ```typescript
 * if (!email || !email.includes('@')) {
 *   throw new ValidationError("Invalid email format", { email });
 * }
 * ```
 *
 * Example error details:
 * ```json
 * {
 *   "message": "Recipient email is required for EMAIL channel",
 *   "code": "VALIDATION_ERROR",
 *   "details": { "channel": "email", "recipient": { "id": "user-123" } }
 * }
 * ```
 */
export class ValidationError extends NotificationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Notification not found error - thrown when looking up a notification that doesn't exist
 *
 * This error is thrown when:
 * - Querying by ID and notification doesn't exist in database
 * - Attempting to update/delete a non-existent notification
 * - Trying to retry a notification that was already deleted
 *
 * Error Code: "NOTIFICATION_NOT_FOUND"
 * HTTP Status: 404 Not Found
 *
 * Example usage:
 * ```typescript
 * const notification = await repository.findById(id);
 * if (!notification) {
 *   throw new NotificationNotFoundError(id);
 * }
 * ```
 *
 * Example error:
 * ```json
 * {
 *   "message": "Notification with ID notif-123 not found",
 *   "code": "NOTIFICATION_NOT_FOUND",
 *   "details": { "notificationId": "notif-123" }
 * }
 * ```
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
 * Sender not available error - thrown when no sender is configured for a channel
 *
 * This error is thrown when:
 * - No sender is registered for the requested channel
 * - Sender exists but isReady() returns false (not configured/connected)
 * - Sender was not provided during module initialization
 *
 * Error Code: "SENDER_NOT_AVAILABLE"
 * HTTP Status: 503 Service Unavailable
 *
 * Common causes:
 * - Forgot to register sender: NotificationKitModule.forRoot({ senders: [emailSender] })
 * - Missing credentials: EMAIL_USER and EMAIL_PASS not set
 * - Connection failure: SMTP server unreachable
 *
 * Example usage:
 * ```typescript
 * const sender = this.senders.get(channel);
 * if (!sender || !(await sender.isReady())) {
 *   throw new SenderNotAvailableError(channel);
 * }
 * ```
 *
 * Example error:
 * ```json
 * {
 *   "message": "No sender available for channel: sms",
 *   "code": "SENDER_NOT_AVAILABLE",
 *   "details": { "channel": "sms" }
 * }
 * ```
 */
export class SenderNotAvailableError extends NotificationError {
  constructor(channel: string) {
    super(`No sender available for channel: ${channel}`, "SENDER_NOT_AVAILABLE", { channel });
    this.name = "SenderNotAvailableError";
    Object.setPrototypeOf(this, SenderNotAvailableError.prototype);
  }
}

/**
 * Send failed error - thrown when notification send operation fails
 *
 * This error is thrown when:
 * - Provider API returns an error (Twilio, SendGrid, Firebase, etc.)
 * - Network request to provider fails
 * - Provider rate limit exceeded
 * - Invalid credentials or authentication failure
 *
 * Error Code: "SEND_FAILED"
 * HTTP Status: 500 Internal Server Error (or 502 Bad Gateway)
 *
 * This error includes details from the provider's error response.
 * The notification will be marked as FAILED and can be retried.
 *
 * Example usage:
 * ```typescript
 * const result = await sender.send(recipient, content);
 * if (!result.success) {
 *   throw new SendFailedError(result.error || "Send failed", {
 *     notificationId: notification.id,
 *     providerError: result.error
 *   });
 * }
 * ```
 *
 * Example error:
 * ```json
 * {
 *   "message": "Twilio error: Invalid 'To' Phone Number",
 *   "code": "SEND_FAILED",
 *   "details": {
 *     "notificationId": "notif-456",
 *     "providerError": "21211: Invalid To Phone Number",
 *     "providerCode": 21211
 *   }
 * }
 * ```
 */
export class SendFailedError extends NotificationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "SEND_FAILED", details);
    this.name = "SendFailedError";
    Object.setPrototypeOf(this, SendFailedError.prototype);
  }
}

/**
 * Invalid recipient error - thrown when recipient data is invalid for the channel
 *
 * This error is thrown when:
 * - EMAIL channel but no email address provided
 * - SMS channel but no phone number provided
 * - PUSH channel but no device token provided
 * - Email address format is invalid
 * - Phone number format is invalid
 *
 * Error Code: "INVALID_RECIPIENT"
 * HTTP Status: 400 Bad Request
 *
 * Example usage:
 * ```typescript
 * if (channel === 'email' && !recipient.email) {
 *   throw new InvalidRecipientError(
 *     "Email address is required for EMAIL channel",
 *     { channel, recipient }
 *   );
 * }
 * ```
 *
 * Example error:
 * ```json
 * {
 *   "message": "Phone number is required for SMS channel",
 *   "code": "INVALID_RECIPIENT",
 *   "details": {
 *     "channel": "sms",
 *     "recipient": { "id": "user-789" }
 *   }
 * }
 * ```
 */
export class InvalidRecipientError extends NotificationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "INVALID_RECIPIENT", details);
    this.name = "InvalidRecipientError";
    Object.setPrototypeOf(this, InvalidRecipientError.prototype);
  }
}

/**
 * Template error - thrown when template rendering fails
 *
 * This error is thrown when:
 * - Template with specified ID doesn't exist
 * - Template has syntax errors (invalid Handlebars/Mustache syntax)
 * - Required template variables are missing
 * - Template engine is not configured but templateId was provided
 *
 * Error Code: "TEMPLATE_ERROR"
 * HTTP Status: 500 Internal Server Error
 *
 * Example usage:
 * ```typescript
 * try {
 *   const rendered = await templateEngine.render(templateId, vars);
 * } catch (error) {
 *   throw new TemplateError(`Failed to render template: ${templateId}`, {
 *     templateId,
 *     error: error.message
 *   });
 * }
 * ```
 *
 * Example error:
 * ```json
 * {
 *   "message": "Failed to render template: welcome-email",
 *   "code": "TEMPLATE_ERROR",
 *   "details": {
 *     "templateId": "welcome-email",
 *     "error": "Missing required variable: userName"
 *   }
 * }
 * ```
 */
export class TemplateError extends NotificationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "TEMPLATE_ERROR", details);
    this.name = "TemplateError";
    Object.setPrototypeOf(this, TemplateError.prototype);
  }
}

/**
 * Max retries exceeded error - thrown when notification has been retried too many times
 *
 * This error is thrown when:
 * - Notification.retryCount >= Notification.maxRetries
 * - Attempting to retry a notification that's already exceeded the limit
 *
 * Error Code: "MAX_RETRIES_EXCEEDED"
 * HTTP Status: 400 Bad Request (if manual retry) or 500 (if auto-retry)
 *
 * When this error is thrown:
 * - Notification status remains FAILED
 * - No further retry attempts will be made
 * - Manual intervention required (fix issue, increase maxRetries, or recreate notification)
 *
 * Example usage:
 * ```typescript
 * if (notification.retryCount >= notification.maxRetries) {
 *   throw new MaxRetriesExceededError(notification.id, notification.retryCount);
 * }
 * ```
 *
 * Example error:
 * ```json
 * {
 *   "message": "Notification notif-999 exceeded max retries (3)",
 *   "code": "MAX_RETRIES_EXCEEDED",
 *   "details": {
 *     "notificationId": "notif-999",
 *     "retryCount": 3
 *   }
 * }
 * ```
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
