/**
 * @file Core Layer Export Index
 *
 * This file manages all exports from the core domain layer of NotificationKit.
 * The core layer is completely framework-agnostic and contains:
 *
 * - Types & Enums: Domain types, enums for channels, status, and priority
 * - DTOs: Data Transfer Objects for API operations (validation with Zod)
 * - Ports: Interface abstractions for senders, repositories, and services
 * - Errors: Custom error classes for domain-specific exceptions
 * - Services: Core business logic for managing notifications
 *
 * Design Principle: This layer has zero framework dependencies (no NestJS, no Express, etc.)
 * This ensures the business logic can be reused in any context.
 */

// Types and enums - Core domain models and enumeration values
export * from "./types";

// DTOs and schemas - Data Transfer Objects with Zod validation
export * from "./dtos";

// Port interfaces (abstractions) - Contracts that infrastructure must implement
export * from "./ports";

// Errors - Domain-specific custom exception classes
export * from "./errors";

// Core service - Main notification business logic
export * from "./notification.service";
