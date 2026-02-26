import { DynamicModule, Module, Provider, Type } from "@nestjs/common";

import { NOTIFICATION_KIT_OPTIONS } from "./constants";
import { NotificationController } from "./controllers/notification.controller";
import { WebhookController } from "./controllers/webhook.controller";
import type {
  NotificationKitModuleAsyncOptions,
  NotificationKitModuleOptions,
  NotificationKitOptionsFactory,
} from "./interfaces";
import { createNotificationKitProviders } from "./providers";

@Module({})
export class NotificationKitModule {
  /**
   * Register module synchronously with direct configuration
   */
  static register(options: NotificationKitModuleOptions): DynamicModule {
    const providers = this.createProviders(options);
    const controllers = this.createControllers(options);
    const exports = providers.map((p) => (typeof p === "object" && "provide" in p ? p.provide : p));

    return {
      global: true,
      module: NotificationKitModule,
      controllers,
      providers,
      exports,
    };
  }

  /**
   * Register module asynchronously with factory pattern
   */
  static registerAsync(options: NotificationKitModuleAsyncOptions): DynamicModule {
    const asyncOptionsProvider = this.createAsyncOptionsProvider(options);
    const asyncProviders = this.createAsyncProviders(options);

    // We can't conditionally load controllers in async mode without the options
    // So we'll need to always include them and they can handle being disabled internally
    // Or we can create a factory provider that returns empty array
    const providersFactory: Provider = {
      provide: "NOTIFICATION_PROVIDERS",
      useFactory: (moduleOptions: NotificationKitModuleOptions) => {
        return createNotificationKitProviders(moduleOptions);
      },
      inject: [NOTIFICATION_KIT_OPTIONS],
    };

    const allProviders = [asyncOptionsProvider, ...asyncProviders, providersFactory];
    const exports = allProviders.map((p) =>
      typeof p === "object" && "provide" in p ? p.provide : p,
    );

    return {
      global: true,
      module: NotificationKitModule,
      imports: options.imports || [],
      controllers: [], // Controllers disabled in async mode for simplicity
      providers: allProviders,
      exports,
    };
  }

  /**
   * Create providers including options and service providers
   */
  private static createProviders(options: NotificationKitModuleOptions): Provider[] {
    return [
      {
        provide: NOTIFICATION_KIT_OPTIONS,
        useValue: options,
      },
      ...createNotificationKitProviders(options),
    ];
  }

  /**
   * Create controllers based on options
   */
  private static createControllers(options: NotificationKitModuleOptions): Type<any>[] {
    const controllers: Type<any>[] = [];

    // Add REST API controller if enabled (default: true)
    if (options.enableRestApi !== false) {
      controllers.push(NotificationController);
    }

    // Add webhook controller if enabled (default: true)
    if (options.enableWebhooks !== false) {
      controllers.push(WebhookController);
    }

    return controllers;
  }

  /**
   * Create async providers for registerAsync
   */
  private static createAsyncProviders(options: NotificationKitModuleAsyncOptions): Provider[] {
    if (options.useClass) {
      return [
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
      ];
    }

    return [];
  }

  /**
   * Create async options provider
   */
  private static createAsyncOptionsProvider(options: NotificationKitModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: NOTIFICATION_KIT_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    if (options.useExisting) {
      return {
        provide: NOTIFICATION_KIT_OPTIONS,
        useFactory: async (optionsFactory: NotificationKitOptionsFactory) => {
          return optionsFactory.createNotificationKitOptions();
        },
        inject: [options.useExisting],
      };
    }

    if (options.useClass) {
      return {
        provide: NOTIFICATION_KIT_OPTIONS,
        useFactory: async (optionsFactory: NotificationKitOptionsFactory) => {
          return optionsFactory.createNotificationKitOptions();
        },
        inject: [options.useClass],
      };
    }

    throw new Error("Invalid NotificationKitModuleAsyncOptions");
  }
}
