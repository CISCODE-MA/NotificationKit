import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { createMockNotification } from "../../../test/test-utils";
import { NotificationNotFoundError } from "../../core/errors";
import { NotificationStatus } from "../../core/types";
import { NOTIFICATION_KIT_OPTIONS, NOTIFICATION_SERVICE } from "../constants";

import { WebhookController } from "./webhook.controller";

describe("WebhookController", () => {
  let controller: WebhookController;
  let mockService: any;

  beforeEach(async () => {
    mockService = {
      getById: jest.fn(),
      retry: jest.fn(),
      markAsDelivered: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: NOTIFICATION_SERVICE,
          useValue: mockService,
        },
        {
          provide: NOTIFICATION_KIT_OPTIONS,
          useValue: {
            webhookPath: "webhooks/notifications",
            webhookSecret: "test-secret-123",
          },
        },
      ],
    }).compile();

    controller = moduleRef.get<WebhookController>(WebhookController);
  });

  describe("handleWebhook", () => {
    it("should process single webhook payload", async () => {
      const payload = {
        notificationId: "notif-123",
        status: "delivered" as const,
        deliveredAt: "2024-01-01T12:00:00Z",
        metadata: { deliveryTime: "500ms" },
      };

      const notification = createMockNotification({ status: NotificationStatus.DELIVERED });
      mockService.markAsDelivered.mockResolvedValue(notification);

      const result = await controller.handleWebhook("test-secret-123", undefined, payload);

      expect(result.received).toBe(1);
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockService.markAsDelivered).toHaveBeenCalledWith(
        "notif-123",
        expect.objectContaining({ deliveryTime: "500ms" }),
      );
    });

    it("should process batch webhook payloads", async () => {
      const payloads = [
        {
          notificationId: "notif-1",
          status: "delivered" as const,
        },
        {
          notificationId: "notif-2",
          status: "delivered" as const,
        },
      ];

      mockService.markAsDelivered.mockResolvedValue(createMockNotification());

      const result = await controller.handleWebhook("test-secret-123", undefined, payloads);

      expect(result.received).toBe(2);
      expect(result.processed).toBe(2);
      expect(mockService.markAsDelivered).toHaveBeenCalledTimes(2);
    });

    it("should reject request without webhook secret", async () => {
      const payload = {
        notificationId: "notif-123",
        status: "delivered" as const,
      };

      await expect(controller.handleWebhook(undefined, undefined, payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should reject request with invalid webhook secret", async () => {
      const payload = {
        notificationId: "notif-123",
        status: "delivered" as const,
      };

      await expect(controller.handleWebhook("wrong-secret", undefined, payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should handle failed status and retry", async () => {
      const payload = {
        notificationId: "notif-123",
        status: "failed" as const,
      };

      const notification = createMockNotification({ retryCount: 1, maxRetries: 3 });
      mockService.getById.mockResolvedValue(notification);
      mockService.retry.mockResolvedValue({ success: true, notification });

      const result = await controller.handleWebhook("test-secret-123", undefined, payload);

      expect(result.processed).toBe(1);
      expect(mockService.retry).toHaveBeenCalledWith("notif-123");
    });

    it("should not retry if max retries exceeded", async () => {
      const payload = {
        notificationId: "notif-123",
        status: "failed" as const,
      };

      const notification = createMockNotification({ retryCount: 3, maxRetries: 3 });
      mockService.getById.mockResolvedValue(notification);

      const result = await controller.handleWebhook("test-secret-123", undefined, payload);

      expect(result.processed).toBe(1);
      expect(mockService.retry).not.toHaveBeenCalled();
    });

    it("should handle bounced status", async () => {
      const payload = {
        notificationId: "notif-123",
        status: "bounced" as const,
      };

      const notification = createMockNotification({ retryCount: 0, maxRetries: 3 });
      mockService.getById.mockResolvedValue(notification);
      mockService.retry.mockResolvedValue({ success: true, notification });

      const result = await controller.handleWebhook("test-secret-123", undefined, payload);

      expect(result.processed).toBe(1);
      expect(mockService.retry).toHaveBeenCalled();
    });

    it("should handle notification not found error", async () => {
      const payload = {
        notificationId: "nonexistent",
        status: "delivered" as const,
      };

      mockService.markAsDelivered.mockRejectedValue(new NotificationNotFoundError("nonexistent"));

      const result = await controller.handleWebhook("test-secret-123", undefined, payload);

      expect(result.received).toBe(1);
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
    });

    it("should handle unknown status", async () => {
      const payload = {
        notificationId: "notif-123",
        status: "complained" as const,
      };

      const result = await controller.handleWebhook("test-secret-123", undefined, payload);

      expect(result.processed).toBe(1);
    });

    it("should reject payload without notificationId", async () => {
      const payload = {
        status: "delivered" as const,
      };

      const result = await controller.handleWebhook("test-secret-123", undefined, payload as any);

      expect(result.failed).toBe(1);
      expect(result.processed).toBe(0);
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0]?.success).toBe(false);
      expect(result.results[0]?.error).toContain("Missing notificationId");
    });

    it("should handle mixed success and failure in batch", async () => {
      const payloads = [
        { notificationId: "notif-1", status: "delivered" as const },
        { notificationId: "nonexistent", status: "delivered" as const },
      ];

      mockService.markAsDelivered
        .mockResolvedValueOnce(createMockNotification())
        .mockRejectedValueOnce(new NotificationNotFoundError("nonexistent"));

      const result = await controller.handleWebhook("test-secret-123", undefined, payloads);

      expect(result.received).toBe(2);
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe("webhook secret configuration", () => {
    it("should allow webhook without secret if not configured", async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [WebhookController],
        providers: [
          {
            provide: NOTIFICATION_SERVICE,
            useValue: mockService,
          },
          {
            provide: NOTIFICATION_KIT_OPTIONS,
            useValue: {
              webhookPath: "webhooks/notifications",
              // No webhookSecret configured
            },
          },
        ],
      }).compile();

      const noSecretController = moduleRef.get<WebhookController>(WebhookController);

      const payload = {
        notificationId: "notif-123",
        status: "delivered" as const,
      };

      mockService.markAsDelivered.mockResolvedValue(createMockNotification());

      // Should not throw without secret
      const result = await noSecretController.handleWebhook(undefined, undefined, payload);

      expect(result.processed).toBe(1);
    });
  });
});
