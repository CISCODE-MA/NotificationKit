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
 */
export function createNotificationKitProviders(options: NotificationKitModuleOptions): Provider[] {
  const providers: Provider[] = [];

  // Senders provider
  providers.push({
    provide: NOTIFICATION_SENDERS,
    useValue: options.senders,
  });

  // Repository provider
  providers.push({
    provide: NOTIFICATION_REPOSITORY,
    useValue: options.repository,
  });

  // ID Generator provider
  if (options.idGenerator) {
    providers.push({
      provide: NOTIFICATION_ID_GENERATOR,
      useValue: options.idGenerator,
    });
  } else {
    // Default to UuidGenerator
    providers.push({
      provide: NOTIFICATION_ID_GENERATOR,
      useFactory: async () => {
        const { UuidGenerator } = await import("../infra/providers/id-generator.provider");
        return new UuidGenerator();
      },
    });
  }

  // DateTime Provider
  if (options.dateTimeProvider) {
    providers.push({
      provide: NOTIFICATION_DATETIME_PROVIDER,
      useValue: options.dateTimeProvider,
    });
  } else {
    // Default to DateTimeProvider
    providers.push({
      provide: NOTIFICATION_DATETIME_PROVIDER,
      useFactory: async () => {
        const { DateTimeProvider } = await import("../infra/providers/datetime.provider");
        return new DateTimeProvider();
      },
    });
  }

  // Template Engine provider (optional)
  if (options.templateEngine) {
    providers.push({
      provide: NOTIFICATION_TEMPLATE_ENGINE,
      useValue: options.templateEngine,
    });
  }

  // Event Emitter provider (optional)
  if (options.eventEmitter) {
    providers.push({
      provide: NOTIFICATION_EVENT_EMITTER,
      useValue: options.eventEmitter,
    });
  }

  // NotificationService provider
  providers.push({
    provide: NOTIFICATION_SERVICE,
    useFactory: (
      repository: any,
      idGenerator: any,
      dateTimeProvider: any,
      senders: any[],
      templateEngine?: any,
      eventEmitter?: any,
    ) => {
      return new NotificationService(
        repository,
        idGenerator,
        dateTimeProvider,
        senders,
        templateEngine,
        eventEmitter,
      );
    },
    inject: [
      NOTIFICATION_REPOSITORY,
      NOTIFICATION_ID_GENERATOR,
      NOTIFICATION_DATETIME_PROVIDER,
      NOTIFICATION_SENDERS,
      { token: NOTIFICATION_TEMPLATE_ENGINE, optional: true },
      { token: NOTIFICATION_EVENT_EMITTER, optional: true },
    ],
  });

  return providers;
}
