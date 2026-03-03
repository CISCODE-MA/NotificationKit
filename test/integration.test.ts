import { describe, expect, it, beforeAll } from "@jest/globals";
import { Test } from "@nestjs/testing";

import type { NotificationService } from "../src/core/notification.service";
import type { INotificationSender, INotificationRepository } from "../src/core/ports";
import { NotificationChannel, NotificationPriority, NotificationStatus } from "../src/core/types";
import type { Notification } from "../src/core/types";
import { NOTIFICATION_SERVICE } from "../src/nest/constants";
import { NotificationKitModule } from "../src/nest/module";

// Mock repository for testing (in real apps, use @ciscode/notification-kit-mongodb or similar)
class MockRepository implements INotificationRepository {
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

  async find(criteria?: any): Promise<Notification[]> {
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

  async count(criteria?: any): Promise<number> {
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
 * Integration tests for the complete NotificationKit flow
 */
describe("NotificationKit - Integration Tests", () => {
  let app: any;
  let notificationService: NotificationService;
  let repository: MockRepository;
  const sentNotifications: any[] = [];

  // Mock email sender that tracks sent notifications
  class TestEmailSender implements INotificationSender {
    readonly channel = NotificationChannel.EMAIL;

    async send(recipient: any, content: any): Promise<any> {
      sentNotifications.push({ recipient, content });
      return {
        success: true,
        notificationId: "test-id",
        providerMessageId: `test-msg-${Date.now()}`,
      };
    }

    async isReady(): Promise<boolean> {
      return true;
    }

    validateRecipient(recipient: any): boolean {
      return !!recipient.email;
    }
  }

  // Mock SMS sender
  class TestSmsSender implements INotificationSender {
    readonly channel = NotificationChannel.SMS;

    async send(recipient: any, content: any): Promise<any> {
      sentNotifications.push({ recipient, content });
      return {
        success: true,
        notificationId: "test-id",
        providerMessageId: `sms-msg-${Date.now()}`,
      };
    }

    async isReady(): Promise<boolean> {
      return true;
    }

    validateRecipient(recipient: any): boolean {
      return !!recipient.phone;
    }
  }

  beforeAll(async () => {
    repository = new MockRepository();
    const senders = [new TestEmailSender(), new TestSmsSender()];

    const moduleRef = await Test.createTestingModule({
      imports: [
        NotificationKitModule.register({
          senders,
          repository,
          enableRestApi: false,
          enableWebhooks: false,
        }),
      ],
    }).compile();

    app = moduleRef;
    notificationService = app.get(NOTIFICATION_SERVICE);
  });

  describe("Complete Notification Flow", () => {
    it("should create, send, and track email notification", async () => {
      // Create notification
      const created = await notificationService.create({
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.HIGH,
        recipient: {
          id: "user-001",
          email: "user@example.com",
        },
        content: {
          title: "Welcome!",
          body: "Welcome to our platform",
        },
        maxRetries: 3,
      });

      expect(created.id).toBeDefined();
      expect(created.status).toBe(NotificationStatus.QUEUED);

      // Send notification
      const result = await notificationService.sendById(created.id);

      expect(result.success).toBe(true);
      expect(result.providerMessageId).toBeDefined();

      // Fetch notification to verify it was updated
      const sent = await repository.findById(created.id);
      expect(sent).toBeDefined();
      expect(sent!.status).toBe(NotificationStatus.SENT);
      expect(sent!.sentAt).toBeDefined();

      // Verify notification was tracked
      expect(sentNotifications.length).toBeGreaterThan(0);
    });

    it("should handle immediate send workflow", async () => {
      const result = await notificationService.send({
        channel: NotificationChannel.SMS,
        priority: NotificationPriority.URGENT,
        recipient: {
          id: "user-002",
          phone: "+1234567890",
        },
        content: {
          title: "Alert",
          body: "Important security alert",
        },
        maxRetries: 3,
      });

      expect(result.success).toBe(true);

      // Verify notification was sent
      expect(sentNotifications.length).toBeGreaterThan(0);
      const lastSent = sentNotifications[sentNotifications.length - 1];
      expect(lastSent.recipient.phone).toBe("+1234567890");
    });

    it("should query notifications with filters", async () => {
      // Create multiple notifications
      await notificationService.send({
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.NORMAL,
        recipient: {
          id: "user-003",
          email: "user3@example.com",
        },
        content: {
          title: "Newsletter",
          body: "Monthly newsletter",
        },
        maxRetries: 3,
      });

      await notificationService.send({
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.LOW,
        recipient: {
          id: "user-003",
          email: "user3@example.com",
        },
        content: {
          title: "Promotion",
          body: "Special offer",
        },
        maxRetries: 3,
      });

      // Query all notifications for user-003
      const results = await notificationService.query({
        recipientId: "user-003",
        limit: 10,
        offset: 0,
      });

      expect(results.length).toBe(2);

      // Query by channel
      const emailNotifs = await notificationService.query({
        recipientId: "user-003",
        channel: NotificationChannel.EMAIL,
        limit: 10,
        offset: 0,
      });

      expect(emailNotifs.length).toBe(2);
    });

    it("should handle notification lifecycle: create -> send -> deliver", async () => {
      // Create
      const created = await notificationService.create({
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.NORMAL,
        recipient: {
          id: "user-004",
          email: "user4@example.com",
        },
        content: {
          title: "Order Confirmation",
          body: "Your order has been confirmed",
        },
        maxRetries: 3,
      });

      expect(created.status).toBe(NotificationStatus.QUEUED);

      // Send
      const sent = await notificationService.sendById(created.id);
      expect(sent.success).toBe(true);

      // Verify status
      const sentNotification = await repository.findById(created.id);
      expect(sentNotification!.status).toBe(NotificationStatus.SENT);

      // Mark as delivered (simulating webhook callback)
      const delivered = await notificationService.markAsDelivered(created.id, {
        provider: "test-provider",
        deliveryTime: "250ms",
      });

      expect(delivered.status).toBe(NotificationStatus.DELIVERED);
      expect(delivered.deliveredAt).toBeDefined();
      expect(typeof delivered.deliveredAt).toBe("string");
    });

    it("should retry failed notifications", async () => {
      // Create a notification that will fail
      class FailingThenSucceedingSender implements INotificationSender {
        readonly channel = NotificationChannel.EMAIL;
        private attempts = 0;

        async send(_recipient: any, _content: any): Promise<any> {
          this.attempts++;
          if (this.attempts === 1) {
            throw new Error("Temporary failure");
          }
          return { success: true, notificationId: "test-id", providerMessageId: "retry-success" };
        }

        async isReady(): Promise<boolean> {
          return true;
        }

        validateRecipient(recipient: any): boolean {
          return !!recipient.email;
        }
      }

      const retryRepository = new MockRepository();
      const retrySender = new FailingThenSucceedingSender();
      const retrySenders = [retrySender];

      const retryModuleRef = await Test.createTestingModule({
        imports: [
          NotificationKitModule.register({
            senders: retrySenders,
            repository: retryRepository,
            enableRestApi: false,
            enableWebhooks: false,
          }),
        ],
      }).compile();

      const retryService = retryModuleRef.get(NOTIFICATION_SERVICE);

      // First attempt - will fail
      let failedNotificationId: string;
      try {
        await retryService.send({
          channel: NotificationChannel.EMAIL,
          priority: NotificationPriority.NORMAL,
          recipient: {
            id: "user-005",
            email: "user5@example.com",
          },
          content: {
            title: "Test Retry",
            body: "Testing retry mechanism",
          },
          maxRetries: 3,
        });
      } catch (_error) {
        // Expected to fail
        const notifications = await retryRepository.find({});
        const firstNotification = notifications[0];
        if (!firstNotification) {
          throw new Error("Expected to find failed notification");
        }
        failedNotificationId = firstNotification.id;
      }

      // Verify notification is failed
      const failedNotification = await retryRepository.findById(failedNotificationId!);
      expect(failedNotification!.status).toBe(NotificationStatus.FAILED);

      // Retry - should succeed
      const retryResult = await retryService.retry(failedNotificationId!);

      expect(retryResult.success).toBe(true);

      // Verify notification was updated
      const retriedNotification = await retryRepository.findById(failedNotificationId!);
      expect(retriedNotification!.status).toBe(NotificationStatus.SENT);
      expect(retriedNotification!.retryCount).toBeGreaterThan(0);
    });

    it("should cancel pending notifications", async () => {
      const created = await notificationService.create({
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.LOW,
        recipient: {
          id: "user-006",
          email: "user6@example.com",
        },
        content: {
          title: "Cancellable",
          body: "This will be cancelled",
        },
        maxRetries: 3,
      });

      const cancelled = await notificationService.cancel(created.id);

      expect(cancelled.status).toBe(NotificationStatus.CANCELLED);

      // Verify we can still retrieve it
      const retrieved = await notificationService.getById(created.id);
      expect(retrieved.status).toBe(NotificationStatus.CANCELLED);
    });

    it("should count notifications with filters", async () => {
      repository.clear();

      // Create some test notifications
      await notificationService.send({
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.NORMAL,
        recipient: { id: "user-007", email: "user7@example.com" },
        content: { title: "Test 1", body: "Body 1" },
        maxRetries: 3,
      });

      await notificationService.send({
        channel: NotificationChannel.SMS,
        priority: NotificationPriority.NORMAL,
        recipient: { id: "user-007", phone: "+1234567890" },
        content: { title: "Test 2", body: "Body 2" },
        maxRetries: 3,
      });

      const totalCount = await notificationService.count({});
      expect(totalCount).toBe(2);

      const emailCount = await notificationService.count({ channel: NotificationChannel.EMAIL });
      expect(emailCount).toBe(1);

      const smsCount = await notificationService.count({ channel: NotificationChannel.SMS });
      expect(smsCount).toBe(1);
    });
  });

  describe("Bulk Operations", () => {
    it("should handle bulk sending", async () => {
      const recipients = [
        { id: "user-101", email: "user101@example.com" },
        { id: "user-102", email: "user102@example.com" },
        { id: "user-103", email: "user103@example.com" },
      ];

      const results = await Promise.all(
        recipients.map((recipient) =>
          notificationService.send({
            channel: NotificationChannel.EMAIL,
            priority: NotificationPriority.NORMAL,
            recipient,
            content: {
              title: "Bulk Notification",
              body: "This is a bulk notification",
            },
            maxRetries: 3,
          }),
        ),
      );

      expect(results.length).toBe(3);
      expect(results.every((r) => r.success)).toBe(true);
    });
  });
});
