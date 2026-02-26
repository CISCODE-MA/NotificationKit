import type { ModuleMetadata, Type } from "@nestjs/common";

import type {
  IDateTimeProvider,
  IIdGenerator,
  INotificationEventEmitter,
  INotificationRepository,
  INotificationSender,
  ITemplateEngine,
} from "../core";

/**
 * Options for configuring NotificationKit module
 */
export interface NotificationKitModuleOptions {
  /**
   * Array of notification senders for different channels
   */
  senders: INotificationSender[];

  /**
   * Repository implementation for persisting notifications
   */
  repository: INotificationRepository;

  /**
   * ID generator for creating notification IDs
   * @default UuidGenerator
   */
  idGenerator?: IIdGenerator;

  /**
   * DateTime provider for timestamps
   * @default DateTimeProvider
   */
  dateTimeProvider?: IDateTimeProvider;

  /**
   * Optional template engine for rendering notification templates
   */
  templateEngine?: ITemplateEngine;

  /**
   * Optional event emitter for notification events
   */
  eventEmitter?: INotificationEventEmitter;

  /**
   * Enable REST API endpoints
   * @default true
   */
  enableRestApi?: boolean;

  /**
   * REST API route prefix
   * @default 'notifications'
   */
  apiPrefix?: string;

  /**
   * Enable webhook endpoint for delivery status callbacks
   * @default true
   */
  enableWebhooks?: boolean;

  /**
   * Webhook route path
   * @default 'notifications/webhooks'
   */
  webhookPath?: string;

  /**
   * Webhook secret for validating incoming requests
   */
  webhookSecret?: string;
}

/**
 * Factory for creating NotificationKit options asynchronously
 */
export interface NotificationKitOptionsFactory {
  createNotificationKitOptions():
    | Promise<NotificationKitModuleOptions>
    | NotificationKitModuleOptions;
}

/**
 * Options for registerAsync
 */
export interface NotificationKitModuleAsyncOptions extends Pick<ModuleMetadata, "imports"> {
  /**
   * Use existing options factory
   */
  useExisting?: Type<NotificationKitOptionsFactory>;

  /**
   * Use class as options factory
   */
  useClass?: Type<NotificationKitOptionsFactory>;

  /**
   * Use factory function
   */
  useFactory?: (
    ...args: any[]
  ) => Promise<NotificationKitModuleOptions> | NotificationKitModuleOptions;

  /**
   * Dependencies to inject into factory function
   */
  inject?: any[];
}
