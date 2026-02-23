import type { Model, Connection } from "mongoose";

import type {
  INotificationRepository,
  Notification,
  NotificationQueryCriteria,
} from "../../../core";

import type { CreateNotificationInput, NotificationDocument } from "./notification.schema";
import { notificationSchemaDefinition } from "./notification.schema";

/**
 * MongoDB repository implementation using Mongoose
 */
export class MongooseNotificationRepository implements INotificationRepository {
  private model: Model<NotificationDocument> | null = null;

  constructor(
    private readonly connection: Connection,
    private readonly collectionName: string = "notifications",
  ) {}

  /**
   * Get or create the Mongoose model
   */
  private getModel(): Model<NotificationDocument> {
    if (this.model) {
      return this.model;
    }

    const mongoose = (this.connection as any).base;
    const schema = new mongoose.Schema(notificationSchemaDefinition, {
      collection: this.collectionName,
      timestamps: false, // We handle timestamps manually
    });

    // Add indexes
    schema.index({ "recipient.id": 1, createdAt: -1 });
    schema.index({ status: 1, scheduledFor: 1 });
    schema.index({ channel: 1, createdAt: -1 });
    schema.index({ createdAt: -1 });

    this.model = this.connection.model<NotificationDocument>(
      "Notification",
      schema,
      this.collectionName,
    );

    return this.model;
  }

  async create(
    _notification: Omit<Notification, "id" | "createdAt" | "updatedAt">,
  ): Promise<Notification> {
    const Model = this.getModel();

    const now = new Date().toISOString();
    const doc = await Model.create({
      ..._notification,
      createdAt: now,
      updatedAt: now,
    } as CreateNotificationInput);

    return this.documentToNotification(doc);
  }

  async findById(_id: string): Promise<Notification | null> {
    const Model = this.getModel();
    const doc = await Model.findById(_id).exec();

    if (!doc) {
      return null;
    }

    return this.documentToNotification(doc);
  }

  async find(_criteria: NotificationQueryCriteria): Promise<Notification[]> {
    const Model = this.getModel();

    const filter: any = {};

    if (_criteria.recipientId) {
      filter["recipient.id"] = _criteria.recipientId;
    }

    if (_criteria.channel) {
      filter.channel = _criteria.channel;
    }

    if (_criteria.status) {
      filter.status = _criteria.status;
    }

    if (_criteria.priority) {
      filter.priority = _criteria.priority;
    }

    if (_criteria.fromDate || _criteria.toDate) {
      filter.createdAt = {};
      if (_criteria.fromDate) {
        filter.createdAt.$gte = _criteria.fromDate;
      }
      if (_criteria.toDate) {
        filter.createdAt.$lte = _criteria.toDate;
      }
    }

    const query = Model.find(filter).sort({ createdAt: -1 });

    if (_criteria.limit) {
      query.limit(_criteria.limit);
    }

    if (_criteria.offset) {
      query.skip(_criteria.offset);
    }

    const docs = await query.exec();

    return docs.map((doc) => this.documentToNotification(doc));
  }

  async update(_id: string, _updates: Partial<Notification>): Promise<Notification> {
    const Model = this.getModel();

    const updateData: any = { ..._updates };
    updateData.updatedAt = new Date().toISOString();

    // Remove id and timestamps from updates if present
    delete updateData.id;
    delete updateData.createdAt;

    const doc = await Model.findByIdAndUpdate(_id, updateData, { new: true }).exec();

    if (!doc) {
      throw new Error(`Notification with id ${_id} not found`);
    }

    return this.documentToNotification(doc);
  }

  async delete(_id: string): Promise<boolean> {
    const Model = this.getModel();
    const result = await Model.findByIdAndDelete(_id).exec();
    return !!result;
  }

  async count(_criteria: NotificationQueryCriteria): Promise<number> {
    const Model = this.getModel();

    const filter: any = {};

    if (_criteria.recipientId) {
      filter["recipient.id"] = _criteria.recipientId;
    }

    if (_criteria.channel) {
      filter.channel = _criteria.channel;
    }

    if (_criteria.status) {
      filter.status = _criteria.status;
    }

    if (_criteria.priority) {
      filter.priority = _criteria.priority;
    }

    if (_criteria.fromDate || _criteria.toDate) {
      filter.createdAt = {};
      if (_criteria.fromDate) {
        filter.createdAt.$gte = _criteria.fromDate;
      }
      if (_criteria.toDate) {
        filter.createdAt.$lte = _criteria.toDate;
      }
    }

    return Model.countDocuments(filter).exec();
  }

  async findReadyToSend(_limit: number): Promise<Notification[]> {
    const Model = this.getModel();

    const now = new Date().toISOString();

    const docs = await Model.find({
      $or: [
        // Pending notifications that are scheduled and ready
        {
          status: "pending",
          scheduledFor: { $lte: now },
        },
        // Queued notifications (ready to send immediately)
        {
          status: "queued",
        },
        // Failed notifications that haven't exceeded retry count
        {
          status: "failed",
          $expr: { $lt: ["$retryCount", "$maxRetries"] },
        },
      ],
    })
      .sort({ priority: -1, createdAt: 1 }) // High priority first, then oldest
      .limit(_limit)
      .exec();

    return docs.map((doc) => this.documentToNotification(doc));
  }

  /**
   * Convert Mongoose document to Notification entity
   */
  private documentToNotification(doc: NotificationDocument): Notification {
    return {
      id: doc._id.toString(),
      channel: doc.channel,
      status: doc.status,
      priority: doc.priority,
      recipient: {
        id: doc.recipient.id,
        email: doc.recipient.email,
        phone: doc.recipient.phone,
        deviceToken: doc.recipient.deviceToken,
        metadata: doc.recipient.metadata ? this.mapToRecord(doc.recipient.metadata) : undefined,
      },
      content: {
        title: doc.content.title,
        body: doc.content.body,
        html: doc.content.html,
        data: doc.content.data ? this.mapToRecord(doc.content.data) : undefined,
        templateId: doc.content.templateId,
        templateVars: doc.content.templateVars
          ? this.mapToRecord(doc.content.templateVars)
          : undefined,
      },
      scheduledFor: doc.scheduledFor,
      sentAt: doc.sentAt,
      deliveredAt: doc.deliveredAt,
      error: doc.error,
      retryCount: doc.retryCount,
      maxRetries: doc.maxRetries,
      metadata: doc.metadata ? this.mapToRecord(doc.metadata) : undefined,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  /**
   * Convert Mongoose Map to plain object
   */
  private mapToRecord(map: Map<string, any> | any): Record<string, unknown> {
    if (map instanceof Map) {
      return Object.fromEntries(map);
    }
    return map;
  }
}
