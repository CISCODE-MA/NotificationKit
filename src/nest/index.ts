/**
 * NotificationKit NestJS Integration - Public API
 *
 * This file exports all public NestJS integration components for NotificationKit.
 * Import from '@ciscode/notification-kit/nest' to use NotificationKit with NestJS.
 *
 * What's exported:
 * - NotificationKitModule: Main module to import in your app
 * - Interfaces: TypeScript interfaces for configuration
 * - Constants: Injection tokens for DI
 * - Decorators: Custom decorators (if any)
 * - Controllers: REST API and webhook controllers
 * - Providers: Factory functions for creating providers
 *
 * Quick start:
 * ```typescript
 * import { NotificationKitModule } from '@ciscode/notification-kit/nest';
 * import { NodemailerSender } from '@ciscode/notification-kit';
 *
 * @Module({
 *   imports: [
 *     NotificationKitModule.register({
 *       senders: [
 *         new NodemailerSender({
 *           host: 'smtp.gmail.com',
 *           port: 587,
 *           auth: { user: 'your@email.com', pass: 'app-password' },
 *           from: 'noreply@yourapp.com',
 *         }),
 *       ],
 *       repository: new InMemoryRepository(),
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * To inject NotificationService:
 * ```typescript
 * import { NotificationService } from '@ciscode/notification-kit';
 *
 * @Injectable()
 * export class MyService {
 *   constructor(private readonly notificationService: NotificationService) {}
 *
 *   async sendWelcomeEmail(user: User) {
 *     await this.notificationService.send({
 *       channel: 'email',
 *       recipient: { id: user.id, email: user.email },
 *       content: { title: 'Welcome!', body: 'Thanks for signing up' },
 *     });
 *   }
 * }
 * ```
 */

// Module - Main NestJS module
export * from "./module";

// Interfaces - TypeScript types for configuration
export * from "./interfaces";

// Constants - Injection tokens for dependency injection
export * from "./constants";

// Decorators - Custom decorators for controllers/services
export * from "./decorators";

// Controllers - REST API and webhook endpoints
export * from "./controllers/notification.controller";
export * from "./controllers/webhook.controller";

// Providers - Factory functions for creating NestJS providers
export * from "./providers";
