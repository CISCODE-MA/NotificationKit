import type { INotificationEventEmitter, NotificationEvent } from "../../core";

export type NotificationEventHandler = (event: NotificationEvent) => void | Promise<void>;

/**
 * Simple in-memory event emitter implementation
 */
export class InMemoryEventEmitter implements INotificationEventEmitter {
  private handlers: Map<string, NotificationEventHandler[]> = new Map();

  async emit(_event: NotificationEvent): Promise<void> {
    const handlers = this.handlers.get(_event.type) || [];
    const allHandlers = this.handlers.get("*") || [];

    const allPromises = [...handlers, ...allHandlers].map((handler) => {
      try {
        return Promise.resolve(handler(_event));
      } catch (error) {
        console.error(`Error in event handler for ${_event.type}:`, error);
        return Promise.resolve();
      }
    });

    await Promise.all(allPromises);
  }

  /**
   * Register an event handler
   */
  on(eventType: NotificationEvent["type"] | "*", handler: NotificationEventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  /**
   * Unregister an event handler
   */
  off(eventType: NotificationEvent["type"] | "*", handler: NotificationEventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
  }
}

/**
 * Event emitter that logs events to console
 */
export class ConsoleEventEmitter implements INotificationEventEmitter {
  async emit(_event: NotificationEvent): Promise<void> {
    console.log(`[NotificationEvent] ${_event.type}`, _event);
  }
}
