/**
 * Infrastructure Layer
 *
 * This layer contains concrete implementations of the core interfaces.
 * It includes:
 * - Notification senders (email, SMS, push)
 * - Repository schemas (reference implementations)
 * - Utility providers (ID generator, datetime, templates, events)
 *
 * NOTE: Repository implementations are provided by separate database packages.
 * Install the appropriate package: @ciscode/notification-kit-mongodb, etc.
 */

// Senders
export * from "./senders";

// Repositories
export * from "./repositories";

// Providers
export * from "./providers";
