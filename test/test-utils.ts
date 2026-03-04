/**
 * Shared test utilities and mock implementations
 * Centralized to reduce code duplication across test files
 */
import { NotificationService } from "../src/core/notification.service";
import type {
  IDateTimeProvider,
  IIdGenerator,
  INotificationEventEmitter,
  INotificationRepository,
  INotificationSender,
  ITemplateEngine,
  NotificationQueryCriteria,
} from "../src/core/ports";
import { NotificationChannel, NotificationPriority, NotificationStatus } from "../src/core/types";
import type { Notification } from "../src/core/types";

/**
 * Mock ID generator for testing
 */
export class MockIdGenerator implements IIdGenerator {
  private counter = 0;

  generate(): string {
    return `notif-${++this.counter}`;
  }

  reset(): void {
    this.counter = 0;
  }
}

/**
 * Mock datetime provider for testing
 */
export class MockDateTimeProvider implements IDateTimeProvider {
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

  setCurrentDate(date: Date): void {
    this.currentDate = date;
  }
}

/**
 * Mock repository implementation for testing
 * Supports filtering and test helper methods
 */
export class MockRepository implements INotificationRepository {
  private notifications: Map<string, Notification> = new Map();
  private idCounter = 0;

  async create(data: Omit<Notification, "id" | "createdAt" | "updatedAt">): Promise<Notification> {
    const notification: Notification = {
      ...data,
      id: `notif_${++this.idCounter}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.notifications.set(notification.id, notification);
    return notification;
  }

  async findById(id: string): Promise<Notification | null> {
    return this.notifications.get(id) || null;
  }

  async find(criteria: NotificationQueryCriteria): Promise<Notification[]> {
    let results = Array.from(this.notifications.values());

    if (criteria) {
      if (criteria.status) {
        results = results.filter((n) => n.status === criteria.status);
      }
      if (criteria.channel) {
        results = results.filter((n) => n.channel === criteria.channel);
      }
      if (criteria.recipientId) {
        results = results.filter((n) => n.recipient.id === criteria.recipientId);
      }
    }

    return results;
  }

  async update(id: string, updates: Partial<Notification>): Promise<Notification> {
    const notification = this.notifications.get(id);
    if (!notification) throw new Error("Not found");
    const updated = { ...notification, ...updates, updatedAt: new Date().toISOString() };
    this.notifications.set(id, updated);
    return updated;
  }

  async count(criteria: NotificationQueryCriteria): Promise<number> {
    if (!criteria) return this.notifications.size;
    const results = await this.find(criteria);
    return results.length;
  }

  async delete(id: string): Promise<boolean> {
    return this.notifications.delete(id);
  }

  async findReadyToSend(): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(
      (n) => n.status === NotificationStatus.PENDING,
    );
  }

  // Test helper methods
  clear(): void {
    this.notifications.clear();
    this.idCounter = 0;
  }

  getAll(): Notification[] {
    return Array.from(this.notifications.values());
  }
}

/**
 * Mock sender implementation for testing
 */
export class MockSender implements INotificationSender {
  readonly channel: NotificationChannel;
  private shouldFail = false;

  constructor(channel: NotificationChannel = NotificationChannel.EMAIL) {
    this.channel = channel;
  }

  async send(
    _recipient: unknown,
    _content: unknown,
  ): Promise<{ success: boolean; notificationId: string; providerMessageId?: string }> {
    if (this.shouldFail) {
      throw new Error("Send failed");
    }
    return { success: true, notificationId: "notif-123", providerMessageId: "mock-msg-123" };
  }

  async isReady(): Promise<boolean> {
    return true;
  }

  validateRecipient(_recipient: unknown): boolean {
    return true;
  }

  // Test helper to simulate failures
  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }
}

/**
 * Mock template engine for testing
 */
export class MockTemplateEngine implements ITemplateEngine {
  private templates: Map<string, boolean> = new Map([["welcome", true]]);

  async render(
    _templateId: string,
    _variables: Record<string, unknown>,
  ): Promise<{ title: string; body: string; html?: string }> {
    return { title: "Rendered title", body: "Rendered template" };
  }

  async hasTemplate(templateId: string): Promise<boolean> {
    return this.templates.has(templateId);
  }

  async validateVariables(
    _templateId: string,
    _variables: Record<string, unknown>,
  ): Promise<boolean> {
    return true;
  }

  // Test helper
  setTemplateExists(templateId: string, exists: boolean): void {
    if (exists) {
      this.templates.set(templateId, true);
    } else {
      this.templates.delete(templateId);
    }
  }
}

/**
 * Mock event emitter for testing
 */
export class MockEventEmitter implements INotificationEventEmitter {
  public emittedEvents: unknown[] = [];

  async emit(event: unknown): Promise<void> {
    this.emittedEvents.push(event);
  }

  clear(): void {
    this.emittedEvents = [];
  }
}

/**
 * Factory function to create mock notification objects
 */
export function createMockNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "notif-123",
    channel: NotificationChannel.EMAIL,
    priority: NotificationPriority.NORMAL,
    status: NotificationStatus.PENDING,
    recipient: {
      id: "user-123",
      email: "test@example.com",
    },
    content: {
      title: "Test",
      body: "Test body",
    },
    maxRetries: 3,
    retryCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Default test notification DTO for creating notifications
 */
export const defaultNotificationDto = {
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

/**
 * Create default module options for testing
 */
export function createModuleTestOptions(overrides: Record<string, unknown> = {}) {
  return {
    senders: [new MockSender()],
    repository: new MockRepository(),
    enableRestApi: false,
    enableWebhooks: false,
    ...overrides,
  };
}

/**
 * Context for notification service tests
 */
export interface ServiceTestContext {
  service: unknown;
  repository: MockRepository;
  sender: MockSender;
  idGenerator: MockIdGenerator;
  dateTimeProvider: MockDateTimeProvider;
}

/**
 * Create dependencies for notification service tests
 */
export function createServiceDependencies() {
  const sender = new MockSender();
  const repository = new MockRepository();
  const idGenerator = new MockIdGenerator();
  const dateTimeProvider = new MockDateTimeProvider();
  return { sender, repository, idGenerator, dateTimeProvider };
}

/**
 * Helper type for service dependencies
 */
export type ServiceDependencies = ReturnType<typeof createServiceDependencies>;

/**
 * Mock failing sender for testing error scenarios
 */
export class MockFailingSender implements INotificationSender {
  readonly channel = NotificationChannel.EMAIL;

  async send(
    _recipient: unknown,
    _content: unknown,
  ): Promise<{ success: boolean; notificationId: string; providerMessageId?: string }> {
    throw new Error("Send failed");
  }

  async isReady(): Promise<boolean> {
    return true;
  }

  validateRecipient(_recipient: unknown): boolean {
    return true;
  }
}

/**
 * Create dependencies with a failing sender for error testing
 */
export function createFailingServiceDependencies() {
  const sender = new MockFailingSender();
  const repository = new MockRepository();
  const idGenerator = new MockIdGenerator();
  const dateTimeProvider = new MockDateTimeProvider();
  return { sender, repository, idGenerator, dateTimeProvider };
}

/**
 * Helper type for failing service dependencies
 */
export type FailingServiceDependencies = ReturnType<typeof createFailingServiceDependencies>;

/**
 * Create a NotificationService instance with its dependencies
 */
export function createNotificationServiceWithDeps() {
  const deps = createServiceDependencies();
  const service = new NotificationService(
    deps.repository,
    deps.idGenerator,
    deps.dateTimeProvider,
    [deps.sender],
  );
  return { service, ...deps };
}

/**
 * Create a NotificationService instance with failing sender and dependencies
 */
export function createFailingNotificationServiceWithDeps() {
  const deps = createFailingServiceDependencies();
  const service = new NotificationService(
    deps.repository,
    deps.idGenerator,
    deps.dateTimeProvider,
    [deps.sender],
  );
  return { service, ...deps };
}
