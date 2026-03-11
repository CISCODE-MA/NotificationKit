import { describe, expect, it } from "@jest/globals";

import {
  BulkSendNotificationDtoSchema,
  CreateNotificationDtoSchema,
  QueryNotificationsDtoSchema,
  UpdateNotificationStatusDtoSchema,
  validateDto,
  validateDtoSafe,
} from "./dtos";
import { NotificationChannel, NotificationPriority } from "./types";

describe("DTOs - CreateNotificationDto", () => {
  it("should validate a valid notification DTO", () => {
    const dto = {
      channel: NotificationChannel.EMAIL,
      priority: NotificationPriority.HIGH,
      recipient: {
        id: "user-123",
        email: "test@example.com",
      },
      content: {
        title: "Test Notification",
        body: "This is a test message",
      },
      maxRetries: 3,
    };

    const result = CreateNotificationDtoSchema.safeParse(dto);
    expect(result.success).toBe(true);
  });

  it("should apply default priority if not provided", () => {
    const dto = {
      channel: NotificationChannel.EMAIL,
      recipient: {
        id: "user-123",
        email: "test@example.com",
      },
      content: {
        title: "Test",
        body: "Test body",
      },
    };

    const result = CreateNotificationDtoSchema.parse(dto);
    expect(result.priority).toBe(NotificationPriority.NORMAL);
    expect(result.maxRetries).toBe(3);
  });

  it("should reject email channel without email address", () => {
    const dto = {
      channel: NotificationChannel.EMAIL,
      priority: NotificationPriority.NORMAL,
      recipient: {
        id: "user-123",
        phone: "+1234567890",
      },
      content: {
        title: "Test",
        body: "Test body",
      },
    };

    const result = CreateNotificationDtoSchema.safeParse(dto);
    expect(result.success).toBe(false);
  });

  it("should reject SMS channel without phone number", () => {
    const dto = {
      channel: NotificationChannel.SMS,
      priority: NotificationPriority.NORMAL,
      recipient: {
        id: "user-123",
        email: "test@example.com",
      },
      content: {
        title: "Test",
        body: "Test body",
      },
    };

    const result = CreateNotificationDtoSchema.safeParse(dto);
    expect(result.success).toBe(false);
  });

  it("should reject PUSH channel without device token", () => {
    const dto = {
      channel: NotificationChannel.PUSH,
      priority: NotificationPriority.NORMAL,
      recipient: {
        id: "user-123",
        email: "test@example.com",
      },
      content: {
        title: "Test",
        body: "Test body",
      },
    };

    const result = CreateNotificationDtoSchema.safeParse(dto);
    expect(result.success).toBe(false);
  });

  it("should validate with optional fields", () => {
    const dto = {
      channel: NotificationChannel.EMAIL,
      recipient: {
        id: "user-123",
        email: "test@example.com",
        metadata: { role: "admin" },
      },
      content: {
        title: "Test",
        body: "Test body",
        html: "<p>Test body</p>",
        data: { key: "value" },
        templateId: "welcome-email",
        templateVars: { name: "John" },
      },
      scheduledFor: "2024-12-31T23:59:59Z",
      metadata: { source: "api" },
    };

    const result = CreateNotificationDtoSchema.safeParse(dto);
    expect(result.success).toBe(true);
  });

  it("should reject invalid email format", () => {
    const dto = {
      channel: NotificationChannel.EMAIL,
      recipient: {
        id: "user-123",
        email: "invalid-email",
      },
      content: {
        title: "Test",
        body: "Test body",
      },
    };

    const result = CreateNotificationDtoSchema.safeParse(dto);
    expect(result.success).toBe(false);
  });

  it("should reject maxRetries out of range", () => {
    const dto = {
      channel: NotificationChannel.EMAIL,
      recipient: {
        id: "user-123",
        email: "test@example.com",
      },
      content: {
        title: "Test",
        body: "Test body",
      },
      maxRetries: 15, // Max is 10
    };

    const result = CreateNotificationDtoSchema.safeParse(dto);
    expect(result.success).toBe(false);
  });
});

describe("DTOs - QueryNotificationsDto", () => {
  it("should validate query with all fields", () => {
    const dto = {
      recipientId: "user-123",
      channel: NotificationChannel.EMAIL,
      status: "SENT",
      priority: NotificationPriority.HIGH,
      fromDate: "2024-01-01T00:00:00Z",
      toDate: "2024-12-31T23:59:59Z",
      limit: 50,
      offset: 10,
    };

    const result = QueryNotificationsDtoSchema.safeParse(dto);
    expect(result.success).toBe(true);
  });

  it("should apply default limit and offset", () => {
    const dto = {};
    const result = QueryNotificationsDtoSchema.parse(dto);

    expect(result.limit).toBe(10);
    expect(result.offset).toBe(0);
  });

  it("should reject limit exceeding maximum", () => {
    const dto = {
      limit: 150, // Max is 100
    };

    const result = QueryNotificationsDtoSchema.safeParse(dto);
    expect(result.success).toBe(false);
  });

  it("should reject negative offset", () => {
    const dto = {
      offset: -5,
    };

    const result = QueryNotificationsDtoSchema.safeParse(dto);
    expect(result.success).toBe(false);
  });
});

describe("DTOs - BulkSendNotificationDto", () => {
  it("should validate bulk notification with multiple recipients", () => {
    const dto = {
      channel: NotificationChannel.EMAIL,
      priority: NotificationPriority.NORMAL,
      recipients: [
        { id: "user-1", email: "user1@example.com" },
        { id: "user-2", email: "user2@example.com" },
        { id: "user-3", email: "user3@example.com" },
      ],
      content: {
        title: "Bulk Test",
        body: "This is a bulk notification",
      },
    };

    const result = BulkSendNotificationDtoSchema.safeParse(dto);
    expect(result.success).toBe(true);
  });

  it("should reject empty recipients array", () => {
    const dto = {
      channel: NotificationChannel.EMAIL,
      recipients: [],
      content: {
        title: "Test",
        body: "Test body",
      },
    };

    const result = BulkSendNotificationDtoSchema.safeParse(dto);
    expect(result.success).toBe(false);
  });

  it("should reject exceeding maximum recipients", () => {
    const dto = {
      channel: NotificationChannel.EMAIL,
      recipients: Array.from({ length: 1001 }, (_, i) => ({
        id: `user-${i}`,
        email: `user${i}@example.com`,
      })),
      content: {
        title: "Test",
        body: "Test body",
      },
    };

    const result = BulkSendNotificationDtoSchema.safeParse(dto);
    expect(result.success).toBe(false);
  });
});

describe("DTOs - UpdateNotificationStatusDto", () => {
  it("should validate status update", () => {
    const dto = {
      notificationId: "notif-123",
      status: "DELIVERED",
      providerMessageId: "msg-456",
      metadata: { deliveryTime: "1000ms" },
    };

    const result = UpdateNotificationStatusDtoSchema.safeParse(dto);
    expect(result.success).toBe(true);
  });

  it("should reject empty notificationId", () => {
    const dto = {
      notificationId: "",
      status: "SENT",
    };

    const result = UpdateNotificationStatusDtoSchema.safeParse(dto);
    expect(result.success).toBe(false);
  });
});

describe("DTOs - Helper Functions", () => {
  it("should validate DTO with validateDto", () => {
    const dto = {
      channel: NotificationChannel.SMS,
      recipient: {
        id: "user-123",
        phone: "+1234567890",
      },
      content: {
        title: "Test",
        body: "Test body",
      },
    };

    const result = validateDto(CreateNotificationDtoSchema, dto);
    expect(result.channel).toBe(NotificationChannel.SMS);
  });

  it("should throw error for invalid DTO with validateDto", () => {
    const dto = {
      channel: "INVALID_CHANNEL",
      recipient: {},
      content: {},
    };

    expect(() => validateDto(CreateNotificationDtoSchema, dto)).toThrow();
  });

  it("should return success for valid DTO with validateDtoSafe", () => {
    const dto = {
      channel: NotificationChannel.PUSH,
      recipient: {
        id: "user-123",
        deviceToken: "device-token-abc",
      },
      content: {
        title: "Test",
        body: "Test body",
      },
    };

    const result = validateDtoSafe(CreateNotificationDtoSchema, dto);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.channel).toBe(NotificationChannel.PUSH);
    }
  });

  it("should return errors for invalid DTO with validateDtoSafe", () => {
    const dto = {
      channel: NotificationChannel.EMAIL,
      recipient: {
        id: "user-123",
      },
      content: {
        title: "",
        body: "",
      },
    };

    const result = validateDtoSafe(CreateNotificationDtoSchema, dto);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toBeDefined();
    }
  });
});
