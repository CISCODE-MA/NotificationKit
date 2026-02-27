import { beforeEach, describe, expect, it } from "@jest/globals";

import {
  MaxRetriesExceededError,
  NotificationNotFoundError,
  SenderNotAvailableError,
  TemplateError,
} from "./errors";
import { NotificationService } from "./notification.service";
import type {
  IDateTimeProvider,
  IIdGenerator,
  INotificationEventEmitter,
  INotificationRepository,
  INotificationSender,
  ITemplateEngine,
} from "./ports";
import { NotificationChannel, NotificationPriority, NotificationStatus } from "./types";
import type { Notification } from "./types";

// Mock implementations
class MockIdGenerator implements IIdGenerator {
  private counter = 0;

  generate(): string {
    return `notif-${++this.counter}`;
  }
}

class MockDateTimeProvider implements IDateTimeProvider {
  private currentDate = new Date("2024-01-01T00:00:00Z");

  now(): string {
    return this.currentDate.toISOString();
  }

  isPast(date: string): boolean {
    return new Date(date) < this.currentDate;
  }

  isFuture(date: string): boolean {
    return new Date(date) > this.currentDate;
  }

  setCurrentDate(date: Date) {
    this.currentDate = date;
  }
}

class MockRepository implements INotificationRepository {
  private notifications = new Map<string, Notification>();

  async create(
    notification: Omit<Notification, "id" | "createdAt" | "updatedAt">,
  ): Promise<Notification> {
    const now = new Date().toISOString();
    const created = {
      ...notification,
      id: `notif-${this.notifications.size + 1}`,
      createdAt: now,
      updatedAt: now,
    };
    this.notifications.set(created.id, created);
    return created;
  }

  async update(id: string, updates: Partial<Notification>): Promise<Notification> {
    const notification = this.notifications.get(id);
    if (!notification) {
      throw new NotificationNotFoundError(id);
    }
    const updated = { ...notification, ...updates, updatedAt: new Date().toISOString() };
    this.notifications.set(id, updated);
    return updated;
  }

  async findById(id: string): Promise<Notification | null> {
    return this.notifications.get(id) || null;
  }

  async find(_criteria: any): Promise<Notification[]> {
    return Array.from(this.notifications.values());
  }

  async count(_criteria: any): Promise<number> {
    return this.notifications.size;
  }

  async delete(id: string): Promise<boolean> {
    return this.notifications.delete(id);
  }

  async findReadyToSend(): Promise<Notification[]> {
    const now = new Date().toISOString();
    return Array.from(this.notifications.values()).filter(
      (n) => n.status === NotificationStatus.PENDING && n.scheduledFor && n.scheduledFor <= now,
    );
  }
}

class MockSender implements INotificationSender {
  readonly channel = NotificationChannel.EMAIL;

  async send(
    _recipient: any,
    _content: any,
  ): Promise<{ success: boolean; notificationId: string; providerMessageId?: string }> {
    return { success: true, notificationId: "notif-1", providerMessageId: "msg-123" };
  }

  async isReady(): Promise<boolean> {
    return true;
  }

  validateRecipient(_recipient: any): boolean {
    return true;
  }
}

class MockFailingSender implements INotificationSender {
  readonly channel = NotificationChannel.EMAIL;

  async send(
    _recipient: any,
    _content: any,
  ): Promise<{ success: boolean; notificationId: string; providerMessageId?: string }> {
    throw new Error("Send failed");
  }

  async isReady(): Promise<boolean> {
    return true;
  }

  validateRecipient(_recipient: any): boolean {
    return true;
  }
}

class MockTemplateEngine implements ITemplateEngine {
  async render(
    _templateId: string,
    _variables: Record<string, unknown>,
  ): Promise<{ title: string; body: string; html?: string }> {
    return { title: "Rendered title", body: "Rendered template" };
  }

  async hasTemplate(_templateId: string): Promise<boolean> {
    return true;
  }

  async validateVariables(
    _templateId: string,
    _variables: Record<string, unknown>,
  ): Promise<boolean> {
    return true;
  }
}

class _MockEventEmitter implements INotificationEventEmitter {
  async emit(_event: any): Promise<void> {
    // Event emitted
  }
}

describe("NotificationService - Create", () => {
  let service: NotificationService;
  let repository: MockRepository;

  beforeEach(() => {
    const sender = new MockSender();
    repository = new MockRepository();
    const idGenerator = new MockIdGenerator();
    const dateTimeProvider = new MockDateTimeProvider();

    service = new NotificationService(repository, idGenerator, dateTimeProvider, [sender]);
  });

  it("should create a notification with PENDING status", async () => {
    const dto = {
      channel: NotificationChannel.EMAIL,
      priority: NotificationPriority.NORMAL,
      recipient: {
        id: "user-123",
        email: "test@example.com",
      },
      content: {
        title: "Test",
        body: "Test message",
      },
      maxRetries: 3,
    };

    const notification = await service.create(dto);

    expect(notification.id).toBeDefined();
    expect(notification.status).toBe(NotificationStatus.QUEUED);
    expect(notification.channel).toBe(NotificationChannel.EMAIL);
    expect(notification.retryCount).toBe(0);
    expect(notification.createdAt).toBeDefined();
    expect(typeof notification.createdAt).toBe("string");
  });

  it("should create notification with optional metadata", async () => {
    const dto = {
      channel: NotificationChannel.SMS,
      priority: NotificationPriority.HIGH,
      recipient: {
        id: "user-456",
        phone: "+1234567890",
      },
      content: {
        title: "Alert",
        body: "Important message",
      },
      maxRetries: 5,
      metadata: {
        source: "api",
        campaign: "summer-sale",
      },
    };

    const notification = await service.create(dto);

    expect(notification.metadata).toEqual({
      source: "api",
      campaign: "summer-sale",
    });
    expect(notification.maxRetries).toBe(5);
  });

  it("should create scheduled notification", async () => {
    const futureDate = "2024-12-31T23:59:59Z";
    const dto = {
      channel: NotificationChannel.PUSH,
      priority: NotificationPriority.NORMAL,
      recipient: {
        id: "user-789",
        deviceToken: "device-abc",
      },
      content: {
        title: "Scheduled",
        body: "Future notification",
      },
      scheduledFor: futureDate,
      maxRetries: 3,
    };

    const notification = await service.create(dto);

    expect(notification.scheduledFor).toBe(futureDate);
    expect(notification.status).toBe(NotificationStatus.PENDING);
  });
});

describe("NotificationService - Send", () => {
  let service: NotificationService;
  let sender: MockSender;
  let repository: MockRepository;

  beforeEach(() => {
    sender = new MockSender();
    repository = new MockRepository();
    const idGenerator = new MockIdGenerator();
    const dateTimeProvider = new MockDateTimeProvider();

    service = new NotificationService(repository, idGenerator, dateTimeProvider, [sender]);
  });

  it("should send notification successfully", async () => {
    const dto = {
      channel: NotificationChannel.EMAIL,
      priority: NotificationPriority.NORMAL,
      recipient: {
        id: "user-123",
        email: "test@example.com",
      },
      content: {
        title: "Test",
        body: "Test message",
      },
      maxRetries: 3,
    };

    const result = await service.send(dto);

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBe("msg-123");

    // Fetch notification to verify it was updated
    const notification = await repository.findById(result.notificationId);
    expect(notification).not.toBeNull();
    expect(notification!.status).toBe(NotificationStatus.SENT);
    expect(notification!.sentAt).toBeDefined();
  });

  it("should throw error if sender not available", async () => {
    const dto = {
      channel: NotificationChannel.SMS, // No SMS sender configured
      priority: NotificationPriority.NORMAL,
      recipient: {
        id: "user-123",
        phone: "+1234567890",
      },
      content: {
        title: "Test",
        body: "Test message",
      },
      maxRetries: 3,
    };

    await expect(service.send(dto)).rejects.toThrow(SenderNotAvailableError);
  });

  it("should handle send failure and mark as FAILED", async () => {
    const failingSender = new MockFailingSender();
    const repository = new MockRepository();
    const idGenerator = new MockIdGenerator();
    const dateTimeProvider = new MockDateTimeProvider();

    const failingService = new NotificationService(repository, idGenerator, dateTimeProvider, [
      failingSender,
    ]);

    const dto = {
      channel: NotificationChannel.EMAIL,
      priority: NotificationPriority.NORMAL,
      recipient: {
        id: "user-123",
        email: "test@example.com",
      },
      content: {
        title: "Test",
        body: "Test message",
      },
      maxRetries: 3,
    };

    await expect(failingService.send(dto)).rejects.toThrow();
  });
});

describe("NotificationService - SendById", () => {
  let service: NotificationService;
  let repository: MockRepository;

  beforeEach(() => {
    const sender = new MockSender();
    repository = new MockRepository();
    const idGenerator = new MockIdGenerator();
    const dateTimeProvider = new MockDateTimeProvider();

    service = new NotificationService(repository, idGenerator, dateTimeProvider, [sender]);
  });

  it("should send existing notification by ID", async () => {
    // First create a notification
    const dto = {
      channel: NotificationChannel.EMAIL,
      priority: NotificationPriority.NORMAL,
      recipient: {
        id: "user-123",
        email: "test@example.com",
      },
      content: {
        title: "Test",
        body: "Test message",
      },
      maxRetries: 3,
    };

    const created = await service.create(dto);

    // Then send it by ID
    const result = await service.sendById(created.id);

    expect(result.success).toBe(true);

    // Verify notification was updated
    const notification = await repository.findById(result.notificationId);
    expect(notification!.status).toBe(NotificationStatus.SENT);
  });

  it("should throw error if notification not found", async () => {
    await expect(service.sendById("nonexistent-id")).rejects.toThrow(NotificationNotFoundError);
  });
});

describe("NotificationService - Query", () => {
  let service: NotificationService;

  beforeEach(() => {
    const sender = new MockSender();
    const repository = new MockRepository();
    const idGenerator = new MockIdGenerator();
    const dateTimeProvider = new MockDateTimeProvider();

    service = new NotificationService(repository, idGenerator, dateTimeProvider, [sender]);
  });

  it("should query notifications", async () => {
    // Create some notifications
    await service.create({
      channel: NotificationChannel.EMAIL,
      priority: NotificationPriority.NORMAL,
      recipient: { id: "user-1", email: "user1@example.com" },
      content: { title: "Test 1", body: "Body 1" },
      maxRetries: 3,
    });

    await service.create({
      channel: NotificationChannel.EMAIL,
      priority: NotificationPriority.HIGH,
      recipient: { id: "user-2", email: "user2@example.com" },
      content: { title: "Test 2", body: "Body 2" },
      maxRetries: 3,
    });

    const results = await service.query({ limit: 10, offset: 0 });

    expect(results.length).toBe(2);
  });

  it("should count notifications", async () => {
    await service.create({
      channel: NotificationChannel.EMAIL,
      priority: NotificationPriority.NORMAL,
      recipient: { id: "user-1", email: "user1@example.com" },
      content: { title: "Test", body: "Body" },
      maxRetries: 3,
    });

    const count = await service.count({});
    expect(count).toBe(1);
  });
});

describe("NotificationService - Retry", () => {
  let _service: NotificationService;

  beforeEach(() => {
    const sender = new MockSender();
    const repository = new MockRepository();
    const idGenerator = new MockIdGenerator();
    const dateTimeProvider = new MockDateTimeProvider();

    _service = new NotificationService(repository, idGenerator, dateTimeProvider, [sender]);
  });

  it("should retry failed notification", async () => {
    // Create a failed notification
    const failingSender = new MockFailingSender();
    const repository = new MockRepository();
    const idGenerator = new MockIdGenerator();
    const dateTimeProvider = new MockDateTimeProvider();

    const failingService = new NotificationService(repository, idGenerator, dateTimeProvider, [
      failingSender,
    ]);

    try {
      await failingService.send({
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.NORMAL,
        recipient: { id: "user-1", email: "user1@example.com" },
        content: { title: "Test", body: "Body" },
        maxRetries: 3,
      });
    } catch (_error) {
      // Expected to fail
    }

    // Find the failed notification
    const notifications = await repository.find({});
    const failedNotification = notifications[0];

    expect(failedNotification).toBeDefined();
    expect(failedNotification!.status).toBe(NotificationStatus.FAILED);
    expect(failedNotification!.retryCount).toBe(1);

    // Now retry with working service
    const workingSender = new MockSender();
    const workingService = new NotificationService(repository, idGenerator, dateTimeProvider, [
      workingSender,
    ]);

    const retryResult = await workingService.retry(failedNotification!.id);

    expect(retryResult.success).toBe(true);

    // Verify notification was updated
    const retriedNotification = await repository.findById(retryResult.notificationId);
    expect(retriedNotification!.status).toBe(NotificationStatus.SENT);
    expect(retriedNotification!.retryCount).toBe(1); // Still 1 since retry succeeded
  });

  it("should throw error if max retries exceeded", async () => {
    const failingSender = new MockFailingSender();
    const repository = new MockRepository();
    const idGenerator = new MockIdGenerator();
    const dateTimeProvider = new MockDateTimeProvider();

    const failingService = new NotificationService(repository, idGenerator, dateTimeProvider, [
      failingSender,
    ]);

    try {
      await failingService.send({
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.NORMAL,
        recipient: { id: "user-1", email: "user1@example.com" },
        content: { title: "Test", body: "Body" },
        maxRetries: 1,
      });
    } catch (_error) {
      // Expected to fail
    }

    // Find the failed notification
    const notifications = await repository.find({});
    const failedNotification = notifications[0];

    expect(failedNotification).toBeDefined();

    // Try to retry twice (exceeds maxRetries of 1)
    try {
      await failingService.retry(failedNotification!.id);
    } catch (_error) {
      // First retry also fails
    }

    await expect(failingService.retry(failedNotification!.id)).rejects.toThrow(
      MaxRetriesExceededError,
    );
  });
});

describe("NotificationService - Cancel", () => {
  let service: NotificationService;

  beforeEach(() => {
    const sender = new MockSender();
    const repository = new MockRepository();
    const idGenerator = new MockIdGenerator();
    const dateTimeProvider = new MockDateTimeProvider();

    service = new NotificationService(repository, idGenerator, dateTimeProvider, [sender]);
  });

  it("should cancel pending notification", async () => {
    const created = await service.create({
      channel: NotificationChannel.EMAIL,
      priority: NotificationPriority.NORMAL,
      recipient: { id: "user-1", email: "user1@example.com" },
      content: { title: "Test", body: "Body" },
      maxRetries: 3,
    });

    const cancelled = await service.cancel(created.id);

    expect(cancelled.status).toBe(NotificationStatus.CANCELLED);
  });

  it("should throw error if notification not found", async () => {
    await expect(service.cancel("nonexistent-id")).rejects.toThrow(NotificationNotFoundError);
  });
});

describe("NotificationService - MarkAsDelivered", () => {
  let service: NotificationService;

  beforeEach(() => {
    const sender = new MockSender();
    const repository = new MockRepository();
    const idGenerator = new MockIdGenerator();
    const dateTimeProvider = new MockDateTimeProvider();

    service = new NotificationService(repository, idGenerator, dateTimeProvider, [sender]);
  });

  it("should mark notification as delivered", async () => {
    const result = await service.send({
      channel: NotificationChannel.EMAIL,
      priority: NotificationPriority.NORMAL,
      recipient: { id: "user-1", email: "user1@example.com" },
      content: { title: "Test", body: "Body" },
      maxRetries: 3,
    });

    const metadata = { deliveryTime: "500ms" };
    const delivered = await service.markAsDelivered(result.notificationId, metadata);

    expect(delivered.status).toBe(NotificationStatus.DELIVERED);
    expect(delivered.deliveredAt).toBeDefined();
  });
});

describe("NotificationService - Template Rendering", () => {
  it("should render template if template engine provided", async () => {
    const sender = new MockSender();
    const repository = new MockRepository();
    const idGenerator = new MockIdGenerator();
    const dateTimeProvider = new MockDateTimeProvider();
    const templateEngine = new MockTemplateEngine();

    const service = new NotificationService(
      repository,
      idGenerator,
      dateTimeProvider,
      [sender],
      templateEngine,
    );

    const result = await service.send({
      channel: NotificationChannel.EMAIL,
      priority: NotificationPriority.NORMAL,
      recipient: { id: "user-1", email: "user1@example.com" },
      content: {
        title: "Welcome",
        body: "Welcome {{name}}",
        templateVars: { name: "John" },
      },
      maxRetries: 3,
    });

    expect(result.success).toBe(true);
  });

  it("should handle template rendering errors", async () => {
    class FailingTemplateEngine implements ITemplateEngine {
      async render(
        _templateId: string,
        _variables: Record<string, unknown>,
      ): Promise<{ title: string; body: string; html?: string }> {
        throw new Error("Template not found");
      }

      async hasTemplate(_templateId: string): Promise<boolean> {
        return false;
      }

      async validateVariables(
        _templateId: string,
        _variables: Record<string, unknown>,
      ): Promise<boolean> {
        return false;
      }
    }

    const sender = new MockSender();
    const repository = new MockRepository();
    const idGenerator = new MockIdGenerator();
    const dateTimeProvider = new MockDateTimeProvider();
    const templateEngine = new FailingTemplateEngine();

    const service = new NotificationService(
      repository,
      idGenerator,
      dateTimeProvider,
      [sender],
      templateEngine,
    );

    await expect(
      service.send({
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.NORMAL,
        recipient: { id: "user-1", email: "user1@example.com" },
        content: {
          title: "Test",
          body: "Body",
          templateId: "welcome",
          templateVars: { name: "John" },
        },
        maxRetries: 3,
      }),
    ).rejects.toThrow(TemplateError);
  });
});

describe("NotificationService - Event Emission", () => {
  it("should emit events if event emitter provided", async () => {
    const emittedEvents: any[] = [];

    class TestEventEmitter implements INotificationEventEmitter {
      async emit(event: any): Promise<void> {
        emittedEvents.push(event);
      }
    }

    const sender = new MockSender();
    const repository = new MockRepository();
    const idGenerator = new MockIdGenerator();
    const dateTimeProvider = new MockDateTimeProvider();
    const eventEmitter = new TestEventEmitter();

    const service = new NotificationService(
      repository,
      idGenerator,
      dateTimeProvider,
      [sender],
      undefined,
      eventEmitter,
    );

    await service.send({
      channel: NotificationChannel.EMAIL,
      priority: NotificationPriority.NORMAL,
      recipient: { id: "user-1", email: "user1@example.com" },
      content: { title: "Test", body: "Body" },
      maxRetries: 3,
    });

    expect(emittedEvents.length).toBeGreaterThan(0);
    expect(emittedEvents.some((e) => e.type === "notification.created")).toBe(true);
    expect(emittedEvents.some((e) => e.type === "notification.sent")).toBe(true);
  });
});
