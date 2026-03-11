/**
 * NotificationKit NestJS Module
 *
 * This is the main module for integrating NotificationKit with NestJS applications.
 * It provides dynamic module configuration with both synchronous and asynchronous
 * registration methods.
 *
 * Features:
 * - Dynamic module: Configure at runtime with different options
 * - Global module: Services available across entire application
 * - Async support: Load configuration from ConfigService, database, etc.
 * - Optional REST API: Built-in endpoints for sending/querying notifications
 * - Optional webhooks: Endpoints for provider callbacks (Twilio, SendGrid, etc.)
 *
 * Usage - Synchronous (direct configuration):
 * ```typescript
 * @Module({
 *   imports: [
 *     NotificationKitModule.register({
 *       senders: [emailSender, smsSender],
 *       repository: mongoRepository,
 *       enableRestApi: true,
 *       enableWebhooks: true,
 *       idGenerator: new ULIDGenerator(),
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * Usage - Asynchronous (with ConfigService):
 * ```typescript
 * @Module({
 *   imports: [
 *     NotificationKitModule.registerAsync({
 *       imports: [ConfigModule],
 *       useFactory: (config: ConfigService) => ({
 *         senders: [
 *           new NodemailerSender({
 *             host: config.get('SMTP_HOST'),
 *             port: config.get('SMTP_PORT'),
 *             auth: {
 *               user: config.get('SMTP_USER'),
 *               pass: config.get('SMTP_PASS'),
 *             },
 *             from: config.get('FROM_EMAIL'),
 *           }),
 *         ],
 *         repository: new MongoNotificationRepository(connection),
 *         enableRestApi: true,
 *       }),
 *       inject: [ConfigService],
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * What gets registered:
 * - NotificationService: Main business logic service (injectable)
 * - Senders: Email, SMS, push notification providers
 * - Repository: Database persistence layer
 * - Providers: ID generator, date/time, template engine, event emitter
 * - Controllers (optional): REST API and webhook endpoints
 */

import { Module, type DynamicModule, type Provider, type Type } from "@nestjs/common";

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
   *
   * Use this when:
   * - Configuration is hardcoded or imported directly
   * - No async dependencies (no ConfigService, database lookups, etc.)
   * - Simple setup for development/testing
   *
   * @param options - NotificationKit configuration object
   * @returns DynamicModule - Configured NestJS module
   *
   * What this does:
   * 1. Creates providers (NotificationService, senders, repository, etc.)
   * 2. Creates controllers (REST API, webhooks) if enabled
   * 3. Exports providers for use throughout the application
   * 4. Marks module as global (no need to import in every module)
   *
   * Example:
   * ```typescript
   * NotificationKitModule.register({
   *   senders: [new NodemailerSender({ ... })],
   *   repository: new InMemoryRepository(),
   *   enableRestApi: true,
   *   enableWebhooks: false,
   * })
   * ```
   */
  static register(options: NotificationKitModuleOptions): DynamicModule {
    // Create all providers (NotificationService + dependencies)
    const providers = this.createProviders(options);

    // Create controllers if enabled (REST API + webhooks)
    const controllers = this.createControllers(options);

    // Export providers so they can be injected in other modules
    const exports = providers.map((p) => (typeof p === "object" && "provide" in p ? p.provide : p));

    return {
      global: true, // Module is global (providers available everywhere)
      module: NotificationKitModule, // This module class
      controllers, // REST API + webhook controllers (if enabled)
      providers, // All services and dependencies
      exports, // Make providers available for injection
    };
  }

  /**
   * Register module asynchronously with factory pattern
   *
   * Use this when:
   * - Configuration comes from ConfigService, environment variables, etc.
   * - Need to load settings from database or external API
   * - Want to inject dependencies into configuration factory
   *
   * @param options - Async configuration options (useFactory, useClass, useExisting)
   * @returns DynamicModule - Configured NestJS module
   *
   * Three async patterns supported:
   *
   * 1. useFactory: Factory function that returns configuration
   * ```typescript
   * registerAsync({
   *   useFactory: (config: ConfigService) => ({
   *     senders: [new NodemailerSender({ host: config.get('SMTP_HOST') })]
   *   }),
   *   inject: [ConfigService],
   * })
   * ```
   *
   * 2. useClass: Class that implements NotificationKitOptionsFactory
   * ```typescript
   * registerAsync({
   *   useClass: NotificationKitConfigService,
   * })
   * ```
   *
   * 3. useExisting: Reference to existing provider
   * ```typescript
   * registerAsync({
   *   useExisting: ConfigService,
   * })
   * ```
   *
   * Note: Controllers are disabled in async mode for simplicity.
   * You can add them manually in a separate module if needed.
   */
  static registerAsync(options: NotificationKitModuleAsyncOptions): DynamicModule {
    // Create provider that resolves module options asynchronously
    const asyncOptionsProvider = this.createAsyncOptionsProvider(options);

    // Create any additional async providers (useClass providers)
    const asyncProviders = this.createAsyncProviders(options);

    // Create a factory provider that creates NotificationKit providers
    // once the module options are available
    const providersFactory: Provider = {
      provide: "NOTIFICATION_PROVIDERS",
      useFactory: (moduleOptions: NotificationKitModuleOptions) => {
        return createNotificationKitProviders(moduleOptions);
      },
      inject: [NOTIFICATION_KIT_OPTIONS], // Wait for options to be resolved
    };

    // Combine all providers
    const allProviders = [asyncOptionsProvider, ...asyncProviders, providersFactory];

    // Export providers for injection
    const exports = allProviders.map((p) =>
      typeof p === "object" && "provide" in p ? p.provide : p,
    );

    return {
      global: true, // Module is global
      module: NotificationKitModule, // This module class
      imports: options.imports || [], // Import dependencies (ConfigModule, etc.)
      controllers: [], // Controllers disabled in async mode for simplicity
      providers: allProviders, // Async providers + factory
      exports, // Make providers available for injection
    };
  }

  /**
   * Create providers including options and service providers (private helper)
   *
   * This creates:
   * - OPTIONS provider: Configuration object
   * - NotificationService: Main business logic
   * - Senders: Email, SMS, push providers
   * - Repository: Database persistence
   * - ID generator, date/time provider, template engine, event emitter
   *
   * @param options - Module configuration
   * @returns Provider[] - Array of NestJS providers
   * @private
   */
  private static createProviders(options: NotificationKitModuleOptions): Provider[] {
    return [
      // Provide options object (injectable as NOTIFICATION_KIT_OPTIONS)
      {
        provide: NOTIFICATION_KIT_OPTIONS,
        useValue: options,
      },
      // Create all NotificationKit providers (service + dependencies)
      ...createNotificationKitProviders(options),
    ];
  }

  /**
   * Create controllers based on options (private helper)
   *
   * Conditionally includes controllers based on enableRestApi and enableWebhooks flags.
   *
   * Controllers:
   * - NotificationController: REST API endpoints for sending/querying notifications
   *   * POST /notifications - Send a notification
   *   * POST /notifications/bulk - Send to multiple recipients
   *   * GET /notifications - Query notifications
   *   * GET /notifications/:id - Get by ID
   *   * POST /notifications/:id/retry - Retry failed notification
   *   * POST /notifications/:id/cancel - Cancel notification
   *
   * - WebhookController: Webhook endpoints for provider callbacks
   *   * POST /webhooks/twilio - Twilio status callbacks
   *   * POST /webhooks/sendgrid - SendGrid event webhooks
   *   * POST /webhooks/firebase - Firebase delivery receipts
   *
   * @param options - Module configuration
   * @returns Type<any>[] - Array of controller classes
   * @private
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
   * Create async providers for registerAsync (private helper)
   *
   * When using useClass, we need to register the class as a provider
   * so it can be injected into the async options factory.
   *
   * @param options - Async configuration options
   * @returns Provider[] - Array of providers
   * @private
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
   * Create async options provider (private helper)
   *
   * This creates a provider that resolves the module options asynchronously
   * using one of three patterns:
   *
   * 1. useFactory: Direct factory function
   * 2. useExisting: Factory method on existing provider
   * 3. useClass: Factory method on new provider instance
   *
   * @param options - Async configuration options
   * @returns Provider - The options provider
   * @throws Error - If invalid async options provided
   * @private
   */
  private static createAsyncOptionsProvider(options: NotificationKitModuleAsyncOptions): Provider {
    // Pattern 1: useFactory - Factory function that returns options
    if (options.useFactory) {
      return {
        provide: NOTIFICATION_KIT_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [], // Dependencies to inject into factory
      };
    }

    // Pattern 2: useExisting - Call createNotificationKitOptions() on existing provider
    if (options.useExisting) {
      return {
        provide: NOTIFICATION_KIT_OPTIONS,
        useFactory: async (optionsFactory: NotificationKitOptionsFactory) => {
          return optionsFactory.createNotificationKitOptions();
        },
        inject: [options.useExisting], // Inject the existing provider
      };
    }

    // Pattern 3: useClass - Instantiate class and call createNotificationKitOptions()
    if (options.useClass) {
      return {
        provide: NOTIFICATION_KIT_OPTIONS,
        useFactory: async (optionsFactory: NotificationKitOptionsFactory) => {
          return optionsFactory.createNotificationKitOptions();
        },
        inject: [options.useClass], // Inject the new class instance
      };
    }

    // No valid async pattern provided
    throw new Error("Invalid NotificationKitModuleAsyncOptions");
  }
}
