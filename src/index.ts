/**
 * @file Main Entry Point for NotificationKit
 *
 * This file serves as the primary export point for the entire NotificationKit package.
 * It exports all modules from three main layers following clean architecture principles:
 *
 * 1. Core Layer (./core): Framework-agnostic business logic, types, and domain entities
 * 2. Infrastructure Layer (./infra): Concrete implementations of senders, repositories, and providers
 * 3. NestJS Integration Layer (./nest): NestJS-specific module configuration and decorators
 *
 * Usage: Import from this file to access any NotificationKit functionality
 * Example: import { NotificationKitModule, NodemailerSender, NotificationChannel } from '@ciscode/notification-kit'
 */

// Core domain layer - Contains pure business logic and domain models
export * from "./core";

// Infrastructure layer - Contains provider implementations and adapters
export * from "./infra";

// NestJS integration layer - Contains NestJS module, controllers, and decorators
export * from "./nest";
