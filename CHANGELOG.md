# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Comprehensive test suite with 133+ tests across 10 test suites
- Shared test utilities in `test/test-utils.ts` for easier testing
- Integration tests for end-to-end notification workflows
- Controller tests for REST API endpoints
- Module tests for NestJS dependency injection
- Mock implementations for testing: `MockRepository`, `MockSender`, `MockTemplateEngine`
- Test helper functions: `createNotificationServiceWithDeps()`, `createFailingNotificationServiceWithDeps()`
- Default test data: `defaultNotificationDto`

### Changed

- Reduced code duplication from 4.3% to 2.66% (passing SonarQube quality gate)
- Improved test organization with centralized test utilities
- Enhanced documentation with comprehensive README and testing guidelines

### Fixed

- ESLint configuration for test files
- TypeScript strict mode compatibility across all test files

## [0.0.0] - Initial Release

### Added

- Core notification service with support for Email, SMS, and Push notifications
- Multi-provider support (Twilio, AWS SNS, Firebase, Nodemailer, etc.)
- NestJS module integration with dependency injection
- Pluggable repository pattern for flexible data storage
- Event system for notification lifecycle tracking
- Template engine support (Handlebars and simple templates)
- Retry logic and notification state management
- REST API controllers (optional)
- Webhook handling (optional)
- Clean architecture with framework-agnostic core
- Full TypeScript support with type definitions

[Unreleased]: https://github.com/CISCODE-MA/NotificationKit/compare/v0.0.0...HEAD
[0.0.0]: https://github.com/CISCODE-MA/NotificationKit/releases/tag/v0.0.0
