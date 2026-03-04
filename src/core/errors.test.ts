import { describe, expect, it } from "@jest/globals";

import {
  InvalidRecipientError,
  MaxRetriesExceededError,
  NotificationError,
  NotificationNotFoundError,
  SendFailedError,
  SenderNotAvailableError,
  TemplateError,
  ValidationError,
} from "./errors";

describe("Errors - NotificationError", () => {
  it("should create base error with message and code", () => {
    const error = new NotificationError("Test error", "TEST_ERROR");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(NotificationError);
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("NotificationError");
    expect(error.code).toBe("TEST_ERROR");
  });

  it("should create error with code and details", () => {
    const error = new NotificationError("Test error", "TEST_CODE", { key: "value" });

    expect(error.code).toBe("TEST_CODE");
    expect(error.details).toEqual({ key: "value" });
  });

  it("should have proper stack trace", () => {
    const error = new NotificationError("Test error", "TEST_ERROR");

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("NotificationError");
  });
});

describe("Errors - ValidationError", () => {
  it("should create validation error", () => {
    const error = new ValidationError("Invalid input");

    expect(error).toBeInstanceOf(NotificationError);
    expect(error.message).toBe("Invalid input");
    expect(error.name).toBe("ValidationError");
  });

  it("should include validation details", () => {
    const error = new ValidationError("Email is required", {
      field: "email",
      constraint: "required",
    });

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details?.field).toBe("email");
  });
});

describe("Errors - NotificationNotFoundError", () => {
  it("should create not found error with notification ID", () => {
    const error = new NotificationNotFoundError("notif-123");

    expect(error).toBeInstanceOf(NotificationError);
    expect(error.message).toContain("notif-123");
    expect(error.name).toBe("NotificationNotFoundError");
    expect(error.details?.notificationId).toBe("notif-123");
  });
});

describe("Errors - SenderNotAvailableError", () => {
  it("should create sender not available error", () => {
    const error = new SenderNotAvailableError("EMAIL");

    expect(error).toBeInstanceOf(NotificationError);
    expect(error.message).toContain("EMAIL");
    expect(error.name).toBe("SenderNotAvailableError");
    expect(error.details?.channel).toBe("EMAIL");
  });
});

describe("Errors - SendFailedError", () => {
  it("should create send failed error", () => {
    const error = new SendFailedError("Connection timeout", { notificationId: "notif-456" });

    expect(error).toBeInstanceOf(NotificationError);
    expect(error.message).toContain("Connection timeout");
    expect(error.name).toBe("SendFailedError");
    expect(error.details?.notificationId).toBe("notif-456");
  });

  it("should create send failed error without details", () => {
    const error = new SendFailedError("Network error");

    expect(error.details).toBeUndefined();
    expect(error.message).toContain("Network error");
  });
});

describe("Errors - InvalidRecipientError", () => {
  it("should create invalid recipient error", () => {
    const error = new InvalidRecipientError("Missing email address");

    expect(error).toBeInstanceOf(NotificationError);
    expect(error.message).toContain("Missing email address");
    expect(error.name).toBe("InvalidRecipientError");
  });
});

describe("Errors - TemplateError", () => {
  it("should create template error with template ID", () => {
    const error = new TemplateError("Template not found", { templateId: "welcome-email" });

    expect(error).toBeInstanceOf(NotificationError);
    expect(error.message).toContain("Template not found");
    expect(error.name).toBe("TemplateError");
    expect(error.details?.templateId).toBe("welcome-email");
  });

  it("should create template error without template ID", () => {
    const error = new TemplateError("Invalid template syntax");

    expect(error.details).toBeUndefined();
  });
});

describe("Errors - MaxRetriesExceededError", () => {
  it("should create max retries exceeded error", () => {
    const error = new MaxRetriesExceededError("notif-789", 3);

    expect(error).toBeInstanceOf(NotificationError);
    expect(error.message).toContain("exceeded max retries");
    expect(error.message).toContain("notif-789");
    expect(error.message).toContain("3");
    expect(error.name).toBe("MaxRetriesExceededError");
    expect(error.details?.notificationId).toBe("notif-789");
    expect(error.details?.retryCount).toBe(3);
  });
});

describe("Errors - Error Inheritance", () => {
  it("should allow catching base NotificationError", () => {
    const errors = [
      new ValidationError("Validation failed"),
      new NotificationNotFoundError("notif-1"),
      new SendFailedError("Send failed"),
    ];

    errors.forEach((error) => {
      expect(error).toBeInstanceOf(NotificationError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  it("should allow catching specific error types", () => {
    try {
      throw new NotificationNotFoundError("notif-123");
    } catch (error) {
      expect(error).toBeInstanceOf(NotificationNotFoundError);
      if (error instanceof NotificationNotFoundError) {
        expect(error.details?.notificationId).toBe("notif-123");
      }
    }
  });
});
