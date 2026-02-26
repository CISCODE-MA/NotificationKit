/**
 * Infrastructure Layer
 *
 * This layer contains concrete implementations of the core interfaces.
 * It includes:
 * - Notification senders (email, SMS, push)
 * - Repositories (MongoDB, in-memory)
 * - Utility providers (ID generator, datetime, templates, events)
 *
 * These implementations are internal and not exported by default.
 * They can be used when configuring the NestJS module.
 */

// Senders
export * from "./senders";

// Repositories
export * from "./repositories";

// Providers
export * from "./providers";
