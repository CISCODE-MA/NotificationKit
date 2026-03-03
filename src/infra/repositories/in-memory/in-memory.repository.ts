import type {
  INotificationRepository,
  Notification,
  NotificationQueryCriteria,
} from "../../../core";

/**
 * In-memory repository implementation for testing/simple cases
 */
export class InMemoryNotificationRepository implements INotificationRepository {
  private notifications: Map<string, Notification> = new Map();
  private idCounter = 1;

  async create(
    _notification: Omit<Notification, "id" | "createdAt" | "updatedAt">,
  ): Promise<Notification> {
    const now = new Date().toISOString();
    const id = `notif_${this.idCounter++}`;

    const notification: Notification = {
      id,
      ..._notification,
      createdAt: now,
      updatedAt: now,
    };

    this.notifications.set(id, notification);

    return notification;
  }

  async findById(_id: string): Promise<Notification | null> {
    return this.notifications.get(_id) || null;
  }

  async find(_criteria: NotificationQueryCriteria): Promise<Notification[]> {
    let results = Array.from(this.notifications.values());

    // Apply filters
    if (_criteria.recipientId) {
      results = results.filter((n) => n.recipient.id === _criteria.recipientId);
    }

    if (_criteria.channel) {
      results = results.filter((n) => n.channel === _criteria.channel);
    }

    if (_criteria.status) {
      results = results.filter((n) => n.status === _criteria.status);
    }

    if (_criteria.priority) {
      results = results.filter((n) => n.priority === _criteria.priority);
    }

    if (_criteria.fromDate) {
      results = results.filter((n) => n.createdAt >= _criteria.fromDate!);
    }

    if (_criteria.toDate) {
      results = results.filter((n) => n.createdAt <= _criteria.toDate!);
    }

    // Sort by createdAt descending
    results.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

    // Apply pagination
    const offset = _criteria.offset || 0;
    const limit = _criteria.limit || 10;

    return results.slice(offset, offset + limit);
  }

  async update(_id: string, _updates: Partial<Notification>): Promise<Notification> {
    const notification = this.notifications.get(_id);

    if (!notification) {
      throw new Error(`Notification with id ${_id} not found`);
    }

    const updated: Notification = {
      ...notification,
      ..._updates,
      id: notification.id, // Preserve ID
      createdAt: notification.createdAt, // Preserve createdAt
      updatedAt: new Date().toISOString(),
    };

    this.notifications.set(_id, updated);

    return updated;
  }

  async delete(_id: string): Promise<boolean> {
    return this.notifications.delete(_id);
  }

  async count(_criteria: NotificationQueryCriteria): Promise<number> {
    let results = Array.from(this.notifications.values());

    // Apply filters
    if (_criteria.recipientId) {
      results = results.filter((n) => n.recipient.id === _criteria.recipientId);
    }

    if (_criteria.channel) {
      results = results.filter((n) => n.channel === _criteria.channel);
    }

    if (_criteria.status) {
      results = results.filter((n) => n.status === _criteria.status);
    }

    if (_criteria.priority) {
      results = results.filter((n) => n.priority === _criteria.priority);
    }

    if (_criteria.fromDate) {
      results = results.filter((n) => n.createdAt >= _criteria.fromDate!);
    }

    if (_criteria.toDate) {
      results = results.filter((n) => n.createdAt <= _criteria.toDate!);
    }

    return results.length;
  }

  async findReadyToSend(_limit: number): Promise<Notification[]> {
    const now = new Date().toISOString();
    let results = Array.from(this.notifications.values());

    // Find notifications ready to send
    results = results.filter((n) => {
      // Pending notifications that are scheduled and ready
      if (n.status === "pending" && n.scheduledFor && n.scheduledFor <= now) {
        return true;
      }

      // Queued notifications (ready to send immediately)
      if (n.status === "queued") {
        return true;
      }

      // Failed notifications that haven't exceeded retry count
      if (n.status === "failed" && n.retryCount < n.maxRetries) {
        return true;
      }

      return false;
    });

    // Sort by priority (high to low) then by createdAt (oldest first)
    const priorityOrder: Record<string, number> = { urgent: 4, high: 3, normal: 2, low: 1 };
    results.sort((a, b) => {
      const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt > b.createdAt ? 1 : -1;
    });

    return results.slice(0, _limit);
  }

  /**
   * Clear all notifications (for testing)
   */
  clear(): void {
    this.notifications.clear();
    this.idCounter = 1;
  }

  /**
   * Get all notifications (for testing)
   */
  getAll(): Notification[] {
    return Array.from(this.notifications.values());
  }
}
