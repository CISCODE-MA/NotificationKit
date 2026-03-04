/**
 * Repository schemas and types
 *
 * NOTE: Concrete repository implementations are provided by separate packages.
 * Install the appropriate database package:
 * - @ciscode/notification-kit-mongodb
 * - @ciscode/notification-kit-postgres
 * - etc.
 *
 * These schemas serve as reference for implementing your own repository.
 */

// MongoDB/Mongoose schema (reference)
export * from "./mongoose/notification.schema";
