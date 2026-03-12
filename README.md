# @ciscode/notification-kit

> A lightweight, delivery-focused notification library for NestJS. Send notifications through multiple channels (Email, SMS, Push, WhatsApp) with pluggable providers. **Your app manages content and templates, NotificationKit handles delivery.**

[![npm version](https://img.shields.io/npm/v/@ciscode/notification-kit.svg)](https://www.npmjs.com/package/@ciscode/notification-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## ✨ Features

- 🎯 **Lightweight & Focused** - Does one thing well: delivers notifications. No bloat, no unnecessary dependencies.
- 🚀 **Multi-Channel Support** - Email, SMS, Push, and WhatsApp notifications in one unified interface
- 🔌 **Pluggable Providers** - Support for multiple providers (Twilio, AWS SNS, Firebase, Nodemailer, etc.)
- 📱 **WhatsApp Support** - Send WhatsApp messages with media support via Twilio API
- 🎯 **NestJS First** - Built specifically for NestJS with dependency injection support
- 📦 **Framework Agnostic Core** - Clean architecture with framework-independent domain logic
- 🔄 **Retry & Queue Management** - Built-in retry logic and notification state management
- 📊 **Event System** - Track notification lifecycle with event emitters
- 💾 **Flexible Storage** - MongoDB, PostgreSQL, or custom repository implementations
- ✅ **Fully Tested** - Comprehensive test suite with 133+ tests
- 🔒 **Type Safe** - Written in TypeScript with full type definitions

> **📐 Design Philosophy**: NotificationKit is a **delivery library**, not a content management system. Your application should manage templates, content, and business logic. NotificationKit focuses solely on reliable multi-channel delivery.

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

# For WhatsApp
npm install twilio                    # Twilio WhatsApp API

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

## � WhatsApp Support

NotificationKit now supports WhatsApp messaging via Twilio's WhatsApp API with full media and template support!

### Setup WhatsApp Sender

```typescript
import { TwilioWhatsAppSender, MockWhatsAppSender } from "@ciscode/notification-kit";

// For production (real Twilio API)
NotificationKitModule.register({
  senders: [
    new TwilioWhatsAppSender({
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.TWILIO_WHATSAPP_FROM, // e.g., '+14155238886'
      templates: {
        orderShipped: "order_shipped_v1",
        welcomeMessage: "welcome_v2",
      },
    }),
  ],
  // ... other config
});

// For development/testing (no credentials needed)
NotificationKitModule.register({
  senders: [new MockWhatsAppSender({ logMessages: true })],
  // ... other config
});
```

### Send WhatsApp Messages

#### Basic Text Message

```typescript
await notificationService.send({
  channel: NotificationChannel.WHATSAPP,
  priority: NotificationPriority.HIGH,
  recipient: {
    id: "user-123",
    phone: "+14155551234", // E.164 format required
  },
  content: {
    title: "Order Update",
    body: "Your order #12345 has been shipped!",
  },
});
```

#### WhatsApp with Media (Images/PDFs/Videos)

```typescript
await notificationService.send({
  channel: NotificationChannel.WHATSAPP,
  recipient: {
    id: "user-456",
    phone: "+447911123456",
  },
  content: {
    title: "Invoice Ready",
    body: "Your invoice is attached",
    data: {
      mediaUrl: "https://example.com/invoice.pdf",
    },
  },
});
```

#### WhatsApp with Templates

```typescript
await notificationService.send({
  channel: NotificationChannel.WHATSAPP,
  recipient: {
    id: "user-789",
    phone: "+212612345678",
  },
  content: {
    title: "OTP Code",
    body: "Your verification code is {{code}}",
    templateId: "otp_verification",
    templateVars: {
      code: "123456",
      expiryMinutes: "5",
    },
  },
});
```

### WhatsApp Requirements

- **Phone Format**: Must be E.164 format (`+[country code][number]`)
  - ✅ Valid: `+14155551234`, `+447911123456`, `+212612345678`
  - ❌ Invalid: `4155551234`, `+1-415-555-1234`, `+1 (415) 555-1234`
- **Twilio Account**: Required for production use
- **WhatsApp Opt-in**: Recipients must opt-in to receive messages (send "join [code]" to Twilio number)
- **Media Support**: Images, videos, audio, PDFs (max 16MB for videos, 5MB for images)
- **Templates**: Some message types require pre-approved WhatsApp templates

### Testing WhatsApp Without Twilio

Use `MockWhatsAppSender` for development:

```typescript
const mockSender = new MockWhatsAppSender({ logMessages: true });

// Simulates sending and logs to console
// No actual API calls or credentials needed
```

Console output example:

```
═══════════════════════════════════════════
📱 [MockWhatsApp] Simulating WhatsApp send
═══════════════════════════════════════════
To: +14155551234
Recipient ID: user-123

💬 Message: Your order has been shipped!
═══════════════════════════════════════════
```

## �📚 Documentation

### Core Concepts

#### Notification Channels

- **EMAIL** - Email notifications via SMTP providers
- **SMS** - Text messages via SMS gateways
- **PUSH** - Mobile push notifications
- **WHATSAPP** - WhatsApp messages via Twilio or Meta Business API
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

#### WhatsApp Senders

- **TwilioWhatsAppSender** - Twilio WhatsApp API (supports media & templates)
- **MockWhatsAppSender** - Mock sender for testing without credentials

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
    // templateEngine: optional - most apps manage templates in backend
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

### Content Management

> ⚠️ **Best Practice**: Manage templates and content in your backend application, not in NotificationKit. Your app knows your business logic, user preferences, and localization needs better than a delivery library.

**Recommended Approach** (Render in Your Backend):

```typescript
@Injectable()
export class NotificationService {
  constructor(
    private templateService: TemplateService, // Your template service
    private notificationKit: NotificationService, // From NotificationKit
  ) {}

  async sendWelcomeEmail(user: User) {
    // 1. Your backend renders the template
    const content = await this.templateService.render("welcome", {
      name: user.name,
      appName: "MyApp",
    });

    // 2. NotificationKit delivers it
    await this.notificationKit.send({
      channel: NotificationChannel.EMAIL,
      recipient: { id: user.id, email: user.email },
      content: {
        title: content.subject,
        body: content.text,
        html: content.html,
      },
    });
  }
}
```

**Built-in Template Engine** (Optional, for simple use cases):

NotificationKit includes optional template engines for quick prototyping:

```typescript
import { SimpleTemplateEngine } from "@ciscode/notification-kit/infra";

// Only use for demos/prototyping
NotificationKitModule.register({
  templateEngine: new SimpleTemplateEngine({
    welcome: {
      title: "Welcome {{name}}!",
      body: "Hello {{name}}, welcome to {{appName}}!",
    },
  }),
});

// Send using template
await notificationService.send({
  content: {
    templateId: "welcome",
    templateVars: { name: "John", appName: "MyApp" },
  },
});
```

### Webhook Handling

> **Note**: Built-in templates are optional and best suited for prototyping. Production apps should manage templates in the backend for flexibility, versioning, and localization. See [Template Configuration Guide](./docs/TEMPLATE_CONFIGURATION.md) for details.

````


Enable webhook endpoints to receive delivery notifications from providers:

```typescript
NotificationKitModule.register({
  enableWebhooks: true,
  webhookSecret: process.env.WEBHOOK_SECRET,
  // ... other options
});
````

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
