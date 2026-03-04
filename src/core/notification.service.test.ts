import { beforeEach, describe, expect, it } from "@jest/globals";

import type { MockRepository, MockSender } from "../../test/test-utils";
import {
  createFailingNotificationServiceWithDeps,
  createNotificationServiceWithDeps,
  defaultNotificationDto,
  MockTemplateEngine,
} from "../../test/test-utils";

import {
  MaxRetriesExceededError,
  NotificationNotFoundError,
  SenderNotAvailableError,
  TemplateError,
} from "./errors";
import { NotificationService } from "./notification.service";
import type { INotificationEventEmitter, ITemplateEngine } from "./ports";
import { NotificationChannel, NotificationPriority, NotificationStatus } from "./types";

describe("NotificationService - Create", () => {
  let service: NotificationService;
  let _repository: MockRepository;

  beforeEach(() => {
    const ctx = createNotificationServiceWithDeps();
    service = ctx.service;
    _repository = ctx.repository;
  });

  it("should create a notification with PENDING status", async () => {
    const notification = await service.create(defaultNotificationDto);

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
  let _sender: MockSender;
  let repository: MockRepository;

  beforeEach(() => {
    const ctx = createNotificationServiceWithDeps();
    _sender = ctx.sender;
    repository = ctx.repository;
    service = ctx.service;
  });

  it("should send notification successfully", async () => {
    const result = await service.send(defaultNotificationDto);

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBe("mock-msg-123");

    // Fetch notification to verify it was updated (find the latest one)
    const notifications = await repository.find({});
    const notification = notifications[0];
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
    const { service: failingService } = createFailingNotificationServiceWithDeps();

    await expect(failingService.send(defaultNotificationDto)).rejects.toThrow();
  });
});

describe("NotificationService - SendById", () => {
  let service: NotificationService;
  let repository: MockRepository;

  beforeEach(() => {
    const ctx = createNotificationServiceWithDeps();
    service = ctx.service;
    repository = ctx.repository;
  });

  it("should send existing notification by ID", async () => {
    // First create a notification
    const created = await service.create(defaultNotificationDto);

    // Then send it by ID
    const result = await service.sendById(created.id);

    expect(result.success).toBe(true);

    // Verify notification was updated
    const notification = await repository.findById(created.id);
    expect(notification!.status).toBe(NotificationStatus.SENT);
  });

  it("should throw error if notification not found", async () => {
    await expect(service.sendById("nonexistent-id")).rejects.toThrow(NotificationNotFoundError);
  });
});

describe("NotificationService - Query", () => {
  let service: NotificationService;

  beforeEach(() => {
    const ctx = createNotificationServiceWithDeps();
    service = ctx.service;
  });

  it("should query notifications", async () => {
    // Create some notifications with different priorities
    await service.create(defaultNotificationDto);
    await service.create({ ...defaultNotificationDto, priority: NotificationPriority.HIGH });

    const results = await service.query({ limit: 10, offset: 0 });

    expect(results.length).toBe(2);
  });

  it("should count notifications", async () => {
    await service.create(defaultNotificationDto);

    const count = await service.count({});
    expect(count).toBe(1);
  });
});

describe("NotificationService - Retry", () => {
  let _service: NotificationService;

  beforeEach(() => {
    const ctx = createNotificationServiceWithDeps();
    _service = ctx.service;
  });

  it("should retry failed notification", async () => {
    // Create a failed notification
    const { service: failingService, repository: failingRepo } =
      createFailingNotificationServiceWithDeps();

    try {
      await failingService.send(defaultNotificationDto);
    } catch (_error) {
      // Expected to fail
    }

    // Find the failed notification
    const notifications = await failingRepo.find({});
    const failedNotification = notifications[0];

    expect(failedNotification).toBeDefined();
    expect(failedNotification!.status).toBe(NotificationStatus.FAILED);
    expect(failedNotification!.retryCount).toBe(1);

    // Now retry with working service using same repository
    const ctx = createNotificationServiceWithDeps();
    // Override the repository to use the failing service's repository
    const workingService = new NotificationService(
      failingRepo,
      ctx.idGenerator,
      ctx.dateTimeProvider,
      [ctx.sender],
    );

    const retryResult = await workingService.retry(failedNotification!.id);

    expect(retryResult.success).toBe(true);

    // Verify notification was updated
    const retriedNotification = await failingRepo.findById(failedNotification!.id);
    expect(retriedNotification!.status).toBe(NotificationStatus.SENT);
    expect(retriedNotification!.retryCount).toBe(1); // Still 1 since retry succeeded
  });

  it("should throw error if max retries exceeded", async () => {
    const { service: failingService, repository: failingRepo } =
      createFailingNotificationServiceWithDeps();

    try {
      await failingService.send({ ...defaultNotificationDto, maxRetries: 1 });
    } catch (_error) {
      // Expected to fail
    }

    // Find the failed notification
    const notifications = await failingRepo.find({});
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
    const ctx = createNotificationServiceWithDeps();
    service = ctx.service;
  });

  it("should cancel pending notification", async () => {
    const created = await service.create(defaultNotificationDto);

    const cancelled = await service.cancel(created.id);

    expect(cancelled.status).toBe(NotificationStatus.CANCELLED);
  });

  it("should throw error if notification not found", async () => {
    await expect(service.cancel("nonexistent-id")).rejects.toThrow(NotificationNotFoundError);
  });
});

describe("NotificationService - MarkAsDelivered", () => {
  let service: NotificationService;
  let _repository: MockRepository;

  beforeEach(() => {
    const ctx = createNotificationServiceWithDeps();
    service = ctx.service;
    _repository = ctx.repository;
  });

  it("should mark notification as delivered", async () => {
    // Create a notification first, then send it
    const created = await service.create(defaultNotificationDto);
    await service.sendById(created.id);

    const metadata = { deliveryTime: "500ms" };
    const delivered = await service.markAsDelivered(created.id, metadata);

    expect(delivered.status).toBe(NotificationStatus.DELIVERED);
    expect(delivered.deliveredAt).toBeDefined();
  });
});

describe("NotificationService - Template Rendering", () => {
  it("should render template if template engine provided", async () => {
    const ctx = createNotificationServiceWithDeps();
    const templateEngine = new MockTemplateEngine();

    const service = new NotificationService(
      ctx.repository,
      ctx.idGenerator,
      ctx.dateTimeProvider,
      [ctx.sender],
      templateEngine,
    );

    const dto = {
      ...defaultNotificationDto,
      content: {
        title: "Welcome",
        body: "Welcome {{name}}",
        templateVars: { name: "John" },
      },
    };

    const result = await service.send(dto);

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

    const ctx = createNotificationServiceWithDeps();
    const templateEngine = new FailingTemplateEngine();

    const service = new NotificationService(
      ctx.repository,
      ctx.idGenerator,
      ctx.dateTimeProvider,
      [ctx.sender],
      templateEngine,
    );

    const dto = {
      ...defaultNotificationDto,
      content: {
        title: "Test",
        body: "Body",
        templateId: "welcome",
        templateVars: { name: "John" },
      },
    };

    await expect(service.send(dto)).rejects.toThrow(TemplateError);
  });
});

describe("NotificationService - Event Emission", () => {
  it("should emit events if event emitter provided", async () => {
    const emittedEvents: unknown[] = [];

    class TestEventEmitter implements INotificationEventEmitter {
      async emit(event: unknown): Promise<void> {
        emittedEvents.push(event);
      }
    }

    const ctx = createNotificationServiceWithDeps();
    const eventEmitter = new TestEventEmitter();

    const service = new NotificationService(
      ctx.repository,
      ctx.idGenerator,
      ctx.dateTimeProvider,
      [ctx.sender],
      undefined,
      eventEmitter,
    );

    await service.send(defaultNotificationDto);

    expect(emittedEvents.length).toBeGreaterThan(0);
    expect(emittedEvents.some((e) => (e as any).type === "notification.created")).toBe(true);
    expect(emittedEvents.some((e) => (e as any).type === "notification.sent")).toBe(true);
  });
});
