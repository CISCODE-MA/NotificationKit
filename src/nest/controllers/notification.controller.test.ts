import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { createMockNotification, defaultNotificationDto } from "../../../test/test-utils";
import { NotificationNotFoundError, ValidationError } from "../../core/errors";
import { NotificationChannel, NotificationPriority, NotificationStatus } from "../../core/types";
import { NOTIFICATION_KIT_OPTIONS, NOTIFICATION_SERVICE } from "../constants";

import { NotificationController } from "./notification.controller";

describe("NotificationController", () => {
  let controller: NotificationController;
  let mockService: any;

  beforeEach(async () => {
    mockService = {
      create: jest.fn(),
      send: jest.fn(),
      sendById: jest.fn(),
      getById: jest.fn(),
      query: jest.fn(),
      count: jest.fn(),
      retry: jest.fn(),
      cancel: jest.fn(),
      markAsDelivered: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NOTIFICATION_SERVICE,
          useValue: mockService,
        },
        {
          provide: NOTIFICATION_KIT_OPTIONS,
          useValue: { apiPrefix: "notifications" },
        },
      ],
    }).compile();

    controller = moduleRef.get<NotificationController>(NotificationController);
  });

  describe("send", () => {
    it("should send notification successfully", async () => {
      mockService.send.mockResolvedValue({
        success: true,
        notificationId: "notif-123",
        providerMessageId: "msg-456",
      });

      const result = await controller.send(defaultNotificationDto);

      expect(result.success).toBe(true);
      expect(result.notificationId).toBe("notif-123");
      expect(mockService.send).toHaveBeenCalledWith(defaultNotificationDto);
    });

    it("should throw BadRequestException on validation error", async () => {
      const dto = {
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.NORMAL,
        recipient: {
          id: "user-123",
        },
        content: {
          title: "Test",
          body: "Test body",
        },
        maxRetries: 3,
      };

      mockService.send.mockRejectedValue(new ValidationError("Email is required"));

      await expect(controller.send(dto as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe("bulkSend", () => {
    it("should send bulk notifications", async () => {
      const dto = {
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.NORMAL,
        recipients: [
          { id: "user-1", email: "user1@example.com" },
          { id: "user-2", email: "user2@example.com" },
        ],
        content: {
          title: "Bulk Test",
          body: "Bulk message",
        },
        maxRetries: 3,
      };

      mockService.send.mockResolvedValue({
        success: true,
        notification: createMockNotification(),
      });

      const result = await controller.bulkSend(dto);

      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockService.send).toHaveBeenCalledTimes(2);
    });

    it("should handle partial failures", async () => {
      const dto = {
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.NORMAL,
        recipients: [
          { id: "user-1", email: "user1@example.com" },
          { id: "user-2", email: "user2@example.com" },
        ],
        content: {
          title: "Test",
          body: "Test body",
        },
        maxRetries: 3,
      };

      mockService.send
        .mockResolvedValueOnce({ success: true, notification: createMockNotification() })
        .mockRejectedValueOnce(new Error("Send failed"));

      const result = await controller.bulkSend(dto);

      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe("create", () => {
    it("should create notification without sending", async () => {
      const notification = createMockNotification();
      mockService.create.mockResolvedValue(notification);

      const result = await controller.create(defaultNotificationDto);

      expect(result.id).toBe("notif-123");
      expect(result.status).toBe(NotificationStatus.PENDING);
      expect(mockService.create).toHaveBeenCalledWith(defaultNotificationDto);
    });
  });

  describe("getById", () => {
    it("should get notification by ID", async () => {
      const notification = createMockNotification();
      mockService.getById.mockResolvedValue(notification);

      const result = await controller.getById("notif-123");

      expect(result.id).toBe("notif-123");
      expect(mockService.getById).toHaveBeenCalledWith("notif-123");
    });

    it("should throw NotFoundException if not found", async () => {
      mockService.getById.mockRejectedValue(new NotificationNotFoundError("notif-123"));

      await expect(controller.getById("notif-123")).rejects.toThrow(NotFoundException);
    });
  });

  describe("query", () => {
    it("should query notifications with pagination", async () => {
      const notifications = [createMockNotification(), createMockNotification({ id: "notif-456" })];
      mockService.query.mockResolvedValue(notifications);
      mockService.count.mockResolvedValue(2);

      const queryDto = {
        limit: 10,
        offset: 0,
      };

      const result = await controller.query(queryDto);

      expect(result.data.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
    });

    it("should apply filters", async () => {
      mockService.query.mockResolvedValue([]);
      mockService.count.mockResolvedValue(0);

      const queryDto = {
        recipientId: "user-123",
        channel: NotificationChannel.EMAIL,
        status: "SENT",
        limit: 10,
        offset: 0,
      };

      await controller.query(queryDto);

      expect(mockService.query).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: "user-123",
          channel: NotificationChannel.EMAIL,
          status: "SENT",
        }),
      );
    });
  });

  describe("retry", () => {
    it("should retry failed notification", async () => {
      const notification = createMockNotification({ status: NotificationStatus.SENT });
      mockService.retry.mockResolvedValue({
        success: true,
        notification,
      });

      const result = await controller.retry("notif-123");

      expect(result.success).toBe(true);
      expect(mockService.retry).toHaveBeenCalledWith("notif-123");
    });

    it("should throw NotFoundException if not found", async () => {
      mockService.retry.mockRejectedValue(new NotificationNotFoundError("notif-123"));

      await expect(controller.retry("notif-123")).rejects.toThrow(NotFoundException);
    });
  });

  describe("cancel", () => {
    it("should cancel notification", async () => {
      const notification = createMockNotification({ status: NotificationStatus.CANCELLED });
      mockService.cancel.mockResolvedValue(notification);

      const result = await controller.cancel("notif-123");

      expect(result.status).toBe(NotificationStatus.CANCELLED);
      expect(mockService.cancel).toHaveBeenCalledWith("notif-123");
    });

    it("should throw NotFoundException if not found", async () => {
      mockService.cancel.mockRejectedValue(new NotificationNotFoundError("notif-123"));

      await expect(controller.cancel("notif-123")).rejects.toThrow(NotFoundException);
    });
  });

  describe("markAsDelivered", () => {
    it("should mark notification as delivered", async () => {
      const notification = createMockNotification({
        status: NotificationStatus.DELIVERED,
        deliveredAt: new Date().toISOString(),
      });
      mockService.markAsDelivered.mockResolvedValue(notification);

      const result = await controller.markAsDelivered("notif-123", {
        metadata: { deliveryTime: "500ms" },
      });

      expect(result.status).toBe(NotificationStatus.DELIVERED);
      expect(mockService.markAsDelivered).toHaveBeenCalledWith("notif-123", {
        deliveryTime: "500ms",
      });
    });

    it("should throw NotFoundException if not found", async () => {
      mockService.markAsDelivered.mockRejectedValue(new NotificationNotFoundError("notif-123"));

      await expect(controller.markAsDelivered("notif-123", {})).rejects.toThrow(NotFoundException);
    });
  });
});
