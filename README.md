# @ciscode/notification-kit

> A flexible, type-safe notification system for NestJS applications supporting multiple channels (Email, SMS, Push) with pluggable providers.

[![npm version](https://img.shields.io/npm/v/@ciscode/notification-kit.svg)](https://www.npmjs.com/package/@ciscode/notification-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## ✨ Features

- 🚀 **Multi-Channel Support** - Email, SMS, and Push notifications in one unified interface
- 🔌 **Pluggable Providers** - Support for multiple providers (Twilio, AWS SNS, Firebase, Nodemailer, etc.)
- 🎯 **NestJS First** - Built specifically for NestJS with dependency injection support
- 📦 **Framework Agnostic Core** - Clean architecture with framework-independent domain logic
- 🔄 **Retry & Queue Management** - Built-in retry logic and notification state management
- 📊 **Event System** - Track notification lifecycle with event emitters
- 🎨 **Template Support** - Handlebars and simple template engines included
- 💾 **Flexible Storage** - MongoDB, PostgreSQL, or custom repository implementations
- ✅ **Fully Tested** - Comprehensive test suite with 133+ tests
- 🔒 **Type Safe** - Written in TypeScript with full type definitions

## 📦 Installation

```bash
npm install @ciscode/notification-kit
```

Install peer dependencies for the providers you need:

```bash
# For NestJS
npm install @nestjs/common @nestjs/core reflect-metadata

# For email (Nodemailer)
npm install nodemailer

# For SMS (choose one)
npm install twilio                    # Twilio
npm install @aws-sdk/client-sns       # AWS SNS
npm install @vonage/server-sdk        # Vonage

# For push notifications (choose one)
npm install firebase-admin            # Firebase
npm install @aws-sdk/client-sns       # AWS SNS

# For database (choose one)
npm install mongoose                  # MongoDB
# Or use custom repository
```

## 🚀 Quick Start

### 1. Import the Module

```typescript
import { Module } from "@nestjs/common";
import { NotificationKitModule } from "@ciscode/notification-kit";
import { NodemailerSender, MongooseNotificationRepository } from "@ciscode/notification-kit/infra";

@Module({
  imports: [
    NotificationKitModule.register({
      senders: [
        new NodemailerSender({
          host: "smtp.gmail.com",
          port: 587,
          secure: false,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
          },
          from: "noreply@example.com",
        }),
      ],
      repository: new MongooseNotificationRepository(/* mongoose connection */),
    }),
  ],
})
export class AppModule {}
```

### 2. Use in a Service

```typescript
import { Injectable } from "@nestjs/common";
import {
  NotificationService,
  NotificationChannel,
  NotificationPriority,
} from "@ciscode/notification-kit";

@Injectable()
export class UserService {
  constructor(private readonly notificationService: NotificationService) {}

  async sendWelcomeEmail(user: User) {
    const result = await this.notificationService.send({
      channel: NotificationChannel.EMAIL,
      priority: NotificationPriority.HIGH,
      recipient: {
        id: user.id,
        email: user.email,
      },
      content: {
        title: "Welcome!",
        body: `Hello ${user.name}, welcome to our platform!`,
      },
    });

    return result;
  }
}
```

### 3. Use via REST API (Optional)

Enable REST endpoints by setting `enableRestApi: true`:

```typescript
NotificationKitModule.register({
  enableRestApi: true,
  // ... other options
});
```

Then use the endpoints:

```bash
# Send notification
POST /notifications/send
{
  "channel": "EMAIL",
  "priority": "HIGH",
  "recipient": { "id": "user-123", "email": "user@example.com" },
  "content": { "title": "Hello", "body": "Welcome!" }
}

# Get notification by ID
GET /notifications/:id

# Query notifications
GET /notifications?status=SENT&limit=10

# Retry failed notification
POST /notifications/:id/retry

# Cancel notification
POST /notifications/:id/cancel
```

## 📚 Documentation

### Core Concepts

#### Notification Channels

- **EMAIL** - Email notifications via SMTP providers
- **SMS** - Text messages via SMS gateways
- **PUSH** - Mobile push notifications
- **WEBHOOK** - HTTP callbacks (coming soon)

#### Notification Status Lifecycle

```
QUEUED → SENDING → SENT → DELIVERED
   ↓         ↓
FAILED → (can retry)
   ↓
CANCELLED
```

#### Priority Levels

- **LOW** - Non-urgent notifications (newsletters, summaries)
- **NORMAL** - Standard notifications (default)
- **HIGH** - Important notifications (account alerts)
- **URGENT** - Critical notifications (security alerts)

### Available Providers

#### Email Senders

- **NodemailerSender** - SMTP email (Gmail, SendGrid, AWS SES, etc.)

#### SMS Senders

- **TwilioSmsSender** - Twilio SMS service
- **AwsSnsSender** - AWS SNS for SMS
- **VonageSmsSender** - Vonage (formerly Nexmo)

#### Push Notification Senders

- **FirebasePushSender** - Firebase Cloud Messaging (FCM)
- **OneSignalPushSender** - OneSignal push notifications
- **AwsSnsPushSender** - AWS SNS for push notifications

#### Repositories

- **MongoDB** - Via separate `@ciscode/notification-kit-mongodb` package
- **PostgreSQL** - Via separate `@ciscode/notification-kit-postgres` package
- **Custom** - Implement `INotificationRepository` interface

See [Infrastructure Documentation](./src/infra/README.md) for detailed provider configuration.

## 🧪 Testing

This package includes comprehensive testing utilities and examples.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov
```

### Test Coverage

The package maintains high test coverage across all components:

- ✅ **133+ tests** across 10 test suites
- ✅ **Unit tests** for all core domain logic
- ✅ **Integration tests** for end-to-end workflows
- ✅ **Controller tests** for REST API endpoints
- ✅ **Module tests** for NestJS dependency injection

### Using Test Utilities

The package provides shared test utilities for your own tests:

```typescript
import {
  createNotificationServiceWithDeps,
  MockRepository,
  MockSender,
  defaultNotificationDto,
} from "@ciscode/notification-kit/test-utils";

describe("My Feature", () => {
  it("should send notification", async () => {
    const { service, repository, sender } = createNotificationServiceWithDeps();

    const result = await service.send(defaultNotificationDto);

    expect(result.success).toBe(true);
  });
});
```

Available test utilities:

- `MockRepository` - In-memory notification repository
- `MockSender` - Mock notification sender
- `MockTemplateEngine` - Mock template engine
- `createNotificationServiceWithDeps()` - Factory for service with mocks
- `defaultNotificationDto` - Standard test notification data

See [Testing Documentation](./.github/instructions/testing.instructions.md) for detailed testing guidelines.

## 🔧 Advanced Configuration

### Async Configuration

```typescript
NotificationKitModule.registerAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    senders: [
      new NodemailerSender({
        host: configService.get("SMTP_HOST"),
        port: configService.get("SMTP_PORT"),
        auth: {
          user: configService.get("SMTP_USER"),
          pass: configService.get("SMTP_PASS"),
        },
      }),
    ],
    repository: new MongooseNotificationRepository(/* connection */),
    templateEngine: new HandlebarsTemplateEngine({
      templates: {
        welcome: {
          title: "Welcome {{name}}!",
          body: "Hello {{name}}, thanks for joining {{appName}}!",
        },
      },
    }),
    eventEmitter: new InMemoryEventEmitter(),
  }),
  inject: [ConfigService],
});
```

### Event Handling

```typescript
import { InMemoryEventEmitter } from "@ciscode/notification-kit/infra";

const eventEmitter = new InMemoryEventEmitter();

// Listen to specific events
eventEmitter.on("notification.sent", (event) => {
  console.log("Notification sent:", event.notification.id);
});

eventEmitter.on("notification.failed", (event) => {
  console.error("Notification failed:", event.error);
});

// Listen to all events
eventEmitter.on("*", (event) => {
  logger.log(`Event: ${event.type}`, event);
});
```

### Template Rendering

```typescript
import { HandlebarsTemplateEngine } from "@ciscode/notification-kit/infra";

const templateEngine = new HandlebarsTemplateEngine({
  templates: {
    welcome: {
      title: "Welcome {{name}}!",
      body: "Hello {{name}}, welcome to {{appName}}!",
      html: "<h1>Welcome {{name}}!</h1><p>Thanks for joining {{appName}}!</p>",
    },
  },
});

// Use in notification
await notificationService.send({
  channel: NotificationChannel.EMAIL,
  recipient: { id: "user-123", email: "user@example.com" },
  content: {
    templateId: "welcome",
    templateVars: {
      name: "John Doe",
      appName: "My App",
    },
  },
});
```

### Webhook Handling

Enable webhook endpoints to receive delivery notifications from providers:

```typescript
NotificationKitModule.register({
  enableWebhooks: true,
  webhookSecret: process.env.WEBHOOK_SECRET,
  // ... other options
});
```

Webhook endpoint: `POST /notifications/webhook`

## 🏗️ Architecture

NotificationKit follows Clean Architecture principles:

```
src/
├── core/              # Domain logic (framework-agnostic)
│   ├── types.ts       # Domain types and interfaces
│   ├── ports.ts       # Port interfaces (repository, sender, etc.)
│   ├── dtos.ts        # Data transfer objects with validation
│   ├── errors.ts      # Domain errors
│   └── notification.service.ts  # Core business logic
├── infra/             # Infrastructure implementations
│   ├── senders/       # Provider implementations
│   ├── repositories/  # Data persistence
│   └── providers/     # Utility providers
└── nest/              # NestJS integration layer
    ├── module.ts      # NestJS module
    ├── controllers/   # REST API controllers
    └── decorators.ts  # DI decorators
```

**Key principles:**

- 🎯 Domain logic is isolated and testable
- 🔌 Infrastructure is pluggable
- 🚀 Framework code is minimized
- ✅ Everything is fully typed

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/CISCODE-MA/NotificationKit.git
cd NotificationKit

# Install dependencies
npm install

# Run tests
npm test

# Run linter
npm run lint

# Type check
npm run typecheck

# Build
npm run build
```

### Code Quality

Before submitting a PR, ensure:

```bash
npm run lint        # Lint passes
npm run typecheck   # No TypeScript errors
npm test            # All tests pass
npm run build       # Build succeeds
```

## 📄 License

MIT © [CisCode](https://github.com/CISCODE-MA)

## 🔗 Links

- [GitHub Repository](https://github.com/CISCODE-MA/NotificationKit)
- [npm Package](https://www.npmjs.com/package/@ciscode/notification-kit)
- [Infrastructure Documentation](./src/infra/README.md)
- [Contributing Guidelines](./CONTRIBUTING.md)
- [Change Log](https://github.com/CISCODE-MA/NotificationKit/releases)

## 💡 Support

- 🐛 [Report Bug](https://github.com/CISCODE-MA/NotificationKit/issues/new?labels=bug)
- ✨ [Request Feature](https://github.com/CISCODE-MA/NotificationKit/issues/new?labels=enhancement)
- 💬 [GitHub Discussions](https://github.com/CISCODE-MA/NotificationKit/discussions)

---

Made with ❤️ by [CisCode](https://github.com/CISCODE-MA)
