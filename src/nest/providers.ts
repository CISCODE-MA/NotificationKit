/**
 * NotificationKit Provider Factory
 *
 * This file contains the factory function for creating NestJS providers for NotificationKit.
 * It handles dependency injection setup for all NotificationKit services and dependencies.
 *
 * What this creates:
 * 1. NOTIFICATION_SENDERS: Array of notification senders (email, SMS, push)
 * 2. NOTIFICATION_REPOSITORY: Database persistence layer
 * 3. NOTIFICATION_ID_GENERATOR: ID generation (defaults to UUID)
 * 4. NOTIFICATION_DATETIME_PROVIDER: Date/time operations (defaults to system time)
 * 5. NOTIFICATION_TEMPLATE_ENGINE: Template rendering (optional)
 * 6. NOTIFICATION_EVENT_EMITTER: Event emission (optional)
 * 7. NOTIFICATION_SERVICE: Main NotificationService instance
 *
 * Dependencies:
 * - Required: senders, repository
 * - Optional with defaults: idGenerator (UUID), dateTimeProvider (system time)
 * - Optional: templateEngine, eventEmitter
 *
 * The factory handles:
 * - Default provider instantiation (UUID generator, system date/time)
 * - Dynamic imports for optional dependencies
 * - Dependency injection setup with proper injection tokens
 * - Optional provider handling (templateEngine, eventEmitter)
 */

import type { Provider } from "@nestjs/common";

import { NotificationService } from "../core/notification.service";
import { DateTimeProvider as _DateTimeProvider } from "../infra/providers/datetime.provider";
import { UuidGenerator as _UuidGenerator } from "../infra/providers/id-generator.provider";

import {
  NOTIFICATION_DATETIME_PROVIDER,
  NOTIFICATION_EVENT_EMITTER,
  NOTIFICATION_ID_GENERATOR,
  NOTIFICATION_REPOSITORY,
  NOTIFICATION_SENDERS,
  NOTIFICATION_SERVICE,
  NOTIFICATION_TEMPLATE_ENGINE,
} from "./constants";
import type { NotificationKitModuleOptions } from "./interfaces";

/**
 * Create providers for NotificationKit module
 *
 * This factory function creates all NestJS providers needed for NotificationKit
 * to work. It's called by NotificationKitModule.register() and registerAsync().
 *
 * @param options - NotificationKit module configuration
 * @returns Provider[] - Array of NestJS provider definitions
 *
 * Provider creation logic:
 * 1. Senders: Always required, provided as-is
 * 2. Repository: Always required, provided as-is
 * 3. ID Generator: Use provided, or default to UuidGenerator
 * 4. DateTime Provider: Use provided, or default to DateTimeProvider (system time)
 * 5. Template Engine: Use provided, or undefined (optional)
 * 6. Event Emitter: Use provided, or undefined (optional)
 * 7. NotificationService: Created with all dependencies injected
 *
 * All providers are registered with injection tokens from constants.ts,
 * allowing them to be injected throughout the application.
 */
export function createNotificationKitProviders(options: NotificationKitModuleOptions): Provider[] {
  const providers: Provider[] = [];

  // 1. Senders provider (REQUIRED)
  // Array of notification senders (email, SMS, push, etc.)
  // Example: [new NodemailerSender(...), new TwilioSender(...)]
  providers.push({
    provide: NOTIFICATION_SENDERS,
    useValue: options.senders,
  });

  // 2. Repository provider (REQUIRED)
  // Database persistence layer for notifications
  // Example: new MongoNotificationRepository(connection)
  providers.push({
    provide: NOTIFICATION_REPOSITORY,
    useValue: options.repository,
  });

  // 3. ID Generator provider (optional, defaults to UUID)
  // Generates unique IDs for notifications
  if (options.idGenerator) {
    // User provided a custom ID generator
    providers.push({
      provide: NOTIFICATION_ID_GENERATOR,
      useValue: options.idGenerator,
    });
  } else {
    // Default to UuidGenerator (generates UUID v4)
    // Uses async factory to allow dynamic import
    providers.push({
      provide: NOTIFICATION_ID_GENERATOR,
      useFactory: async () => {
        const { UuidGenerator } = await import("../infra/providers/id-generator.provider");
        return new UuidGenerator();
      },
    });
  }

  // 4. DateTime Provider (optional, defaults to system time)
  // Provides date/time operations (now(), isPast(), isFuture())
  if (options.dateTimeProvider) {
    // User provided a custom dateTime provider (e.g., for testing with fixed time)
    providers.push({
      provide: NOTIFICATION_DATETIME_PROVIDER,
      useValue: options.dateTimeProvider,
    });
  } else {
    // Default to DateTimeProvider (uses system time)
    // Uses async factory to allow dynamic import
    providers.push({
      provide: NOTIFICATION_DATETIME_PROVIDER,
      useFactory: async () => {
        const { DateTimeProvider } = await import("../infra/providers/datetime.provider");
        return new DateTimeProvider();
      },
    });
  }

  // 5. Template Engine provider (OPTIONAL)
  // Renders notification templates with variables
  // If not provided, notifications must specify content directly
  if (options.templateEngine) {
    providers.push({
      provide: NOTIFICATION_TEMPLATE_ENGINE,
      useValue: options.templateEngine,
    });
  }

  // 6. Event Emitter provider (OPTIONAL)
  // Emits notification lifecycle events for monitoring/logging
  // If not provided, events will not be emitted
  if (options.eventEmitter) {
    providers.push({
      provide: NOTIFICATION_EVENT_EMITTER,
      useValue: options.eventEmitter,
    });
  }

  // 7. NotificationService provider (MAIN SERVICE)
  // Creates the main NotificationService with all dependencies injected
  // This is the service you'll inject into your controllers/services
  providers.push({
    provide: NOTIFICATION_SERVICE,
    useFactory: (
      repository: any, // INotificationRepository implementation
      idGenerator: any, // IIdGenerator implementation
      dateTimeProvider: any, // IDateTimeProvider implementation
      senders: any[], // Array of INotificationSender implementations
      templateEngine?: any, // ITemplateEngine implementation (optional)
      eventEmitter?: any, // INotificationEventEmitter implementation (optional)
    ) => {
      // Instantiate NotificationService with all dependencies
      return new NotificationService(
        repository,
        idGenerator,
        dateTimeProvider,
        senders,
        templateEngine,
        eventEmitter,
      );
    },
    // Specify which tokens to inject into the factory function
    inject: [
      NOTIFICATION_REPOSITORY, // Required
      NOTIFICATION_ID_GENERATOR, // Required (has default)
      NOTIFICATION_DATETIME_PROVIDER, // Required (has default)
      NOTIFICATION_SENDERS, // Required
      { token: NOTIFICATION_TEMPLATE_ENGINE, optional: true }, // Optional
      { token: NOTIFICATION_EVENT_EMITTER, optional: true }, // Optional
    ],
  });

  return providers;
}
