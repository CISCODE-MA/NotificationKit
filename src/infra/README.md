# Infrastructure Layer

This directory contains concrete implementations of the core notification interfaces.

## 📁 Structure

```
infra/
├── senders/          # Notification channel senders
│   ├── email/        # Email providers
│   ├── sms/          # SMS providers
│   └── push/         # Push notification providers
├── repositories/     # Data persistence
│   ├── mongoose/     # MongoDB with Mongoose
│   └── in-memory/    # In-memory (testing)
└── providers/        # Utility providers
    ├── id-generator.provider.ts
    ├── datetime.provider.ts
    ├── template.provider.ts
    └── event-emitter.provider.ts
```

## 🔌 Email Senders

### Nodemailer (SMTP)

Works with any SMTP provider (Gmail, SendGrid, AWS SES via SMTP, etc.)

```typescript
import { NodemailerSender } from "@ciscode/notification-kit/infra";

const emailSender = new NodemailerSender({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "your-email@gmail.com",
    pass: "your-app-password",
  },
  from: "noreply@example.com",
  fromName: "My App",
});
```

**Peer Dependency**: `nodemailer`

## 📱 SMS Senders

### Twilio

```typescript
import { TwilioSmsSender } from "@ciscode/notification-kit/infra";

const smsSender = new TwilioSmsSender({
  accountSid: "your-account-sid",
  authToken: "your-auth-token",
  fromNumber: "+1234567890",
});
```

**Peer Dependency**: `twilio`

### AWS SNS

```typescript
import { AwsSnsSender } from "@ciscode/notification-kit/infra";

const smsSender = new AwsSnsSender({
  region: "us-east-1",
  accessKeyId: "your-access-key",
  secretAccessKey: "your-secret-key",
  senderName: "MyApp", // Optional
});
```

**Peer Dependency**: `@aws-sdk/client-sns`

### Vonage (Nexmo)

```typescript
import { VonageSmsSender } from "@ciscode/notification-kit/infra";

const smsSender = new VonageSmsSender({
  apiKey: "your-api-key",
  apiSecret: "your-api-secret",
  from: "MyApp",
});
```

**Peer Dependency**: `@vonage/server-sdk`

## 🔔 Push Notification Senders

### Firebase Cloud Messaging

```typescript
import { FirebasePushSender } from "@ciscode/notification-kit/infra";

const pushSender = new FirebasePushSender({
  projectId: "your-project-id",
  privateKey: "your-private-key",
  clientEmail: "your-client-email",
});
```

**Peer Dependency**: `firebase-admin`

### OneSignal

```typescript
import { OneSignalPushSender } from "@ciscode/notification-kit/infra";

const pushSender = new OneSignalPushSender({
  appId: "your-app-id",
  restApiKey: "your-rest-api-key",
});
```

**No additional dependencies** (uses fetch API)

### AWS SNS (Push)

```typescript
import { AwsSnsPushSender } from "@ciscode/notification-kit/infra";

const pushSender = new AwsSnsPushSender({
  region: "us-east-1",
  accessKeyId: "your-access-key",
  secretAccessKey: "your-secret-key",
  platformApplicationArn: "arn:aws:sns:...",
});
```

**Peer Dependency**: `@aws-sdk/client-sns`

## 💾 Repositories

> **Note**: Repository implementations are provided by separate database packages.
> Install the appropriate package for your database:

### MongoDB

Install the MongoDB package:

```bash
npm install @ciscode/notification-kit-mongodb
```

```typescript
import { MongooseNotificationRepository } from "@ciscode/notification-kit-mongodb";
import mongoose from "mongoose";

const connection = await mongoose.createConnection("mongodb://localhost:27017/mydb");
const repository = new MongooseNotificationRepository(connection);
```

### PostgreSQL

Install the PostgreSQL package:

```bash
npm install @ciscode/notification-kit-postgres
```

### Custom Repository

Implement the `INotificationRepository` interface:

```typescript
import type { INotificationRepository, Notification } from "@ciscode/notification-kit";

class MyCustomRepository implements INotificationRepository {
  async create(data: Omit<Notification, "id" | "createdAt" | "updatedAt">): Promise<Notification> {
    // Your implementation
  }

  async findById(id: string): Promise<Notification | null> {
    // Your implementation
  }

  // ... implement other methods
}
```

### Schema Reference

The MongoDB schema is exported as a reference:

```typescript
import { notificationSchemaDefinition } from "@ciscode/notification-kit/infra";

// Use this as a reference for your own schema implementations
```

## 🛠️ Utility Providers

### ID Generator

```typescript
import { UuidGenerator, ObjectIdGenerator, NanoIdGenerator } from "@ciscode/notification-kit/infra";

// UUID v4
const uuidGen = new UuidGenerator();
uuidGen.generate(); // "a1b2c3d4-..."

// MongoDB ObjectId format
const objectIdGen = new ObjectIdGenerator();
objectIdGen.generate(); // "507f1f77bcf86cd799439011"

// NanoID (requires nanoid package)
const nanoIdGen = new NanoIdGenerator();
nanoIdGen.generate(); // "V1StGXR8_Z5jdHi6B-myT"
```

### DateTime Provider

```typescript
import { DateTimeProvider } from "@ciscode/notification-kit/infra";

const dateTime = new DateTimeProvider();

dateTime.now(); // "2024-01-15T10:30:00.000Z"
dateTime.isPast("2024-01-01T00:00:00.000Z"); // true
dateTime.isFuture("2025-01-01T00:00:00.000Z"); // true
```

### Template Engine

#### Handlebars

```typescript
import { HandlebarsTemplateEngine } from "@ciscode/notification-kit/infra";

const templateEngine = new HandlebarsTemplateEngine({
  templates: {
    welcome: {
      title: "Welcome {{name}}!",
      body: "Hello {{name}}, thanks for joining!",
      html: "<h1>Welcome {{name}}!</h1>",
    },
  },
});

const result = await templateEngine.render("welcome", { name: "John" });
// { title: 'Welcome John!', body: 'Hello John, thanks for joining!', html: '<h1>Welcome John!</h1>' }
```

**Peer Dependency**: `handlebars`

#### Simple Template Engine

```typescript
import { SimpleTemplateEngine } from "@ciscode/notification-kit/infra";

const templateEngine = new SimpleTemplateEngine({
  welcome: {
    title: "Welcome {{name}}!",
    body: "Hello {{name}}, thanks for joining!",
  },
});

const result = await templateEngine.render("welcome", { name: "John" });
// Uses simple {{variable}} replacement
```

**No dependencies**

### Event Emitter

#### In-Memory Event Emitter

```typescript
import { InMemoryEventEmitter } from "@ciscode/notification-kit/infra";

const eventEmitter = new InMemoryEventEmitter();

// Listen to specific events
eventEmitter.on("notification.sent", (event) => {
  console.log("Notification sent:", event.notification.id);
});

// Listen to all events
eventEmitter.on("*", (event) => {
  console.log("Event:", event.type);
});
```

#### Console Event Emitter

```typescript
import { ConsoleEventEmitter } from "@ciscode/notification-kit/infra";

const eventEmitter = new ConsoleEventEmitter();
// Logs all events to console
```

## 📦 Installation

Install only the peer dependencies you need:

### Email (Nodemailer)

```bash
npm install nodemailer
npm install -D @types/nodemailer
```

### SMS

```bash
# Twilio
npm install twilio

# AWS SNS
npm install @aws-sdk/client-sns

# Vonage
npm install @vonage/server-sdk
```

### Push Notifications

```bash
# Firebase
npm install firebase-admin

# AWS SNS (same as SMS)
npm install @aws-sdk/client-sns
```

### Repository

```bash
# Mongoose
npm install mongoose
```

### Template Engine

```bash
# Handlebars
npm install handlebars
npm install -D @types/handlebars
```

### ID Generator

```bash
# NanoID (optional)
npm install nanoid
```

## 🎯 Usage with NestJS Module

These implementations will be used when configuring the NotificationKit module:

```typescript
import { Module } from "@nestjs/common";
import { NotificationKitModule } from "@ciscode/notification-kit";
import {
  NodemailerSender,
  TwilioSmsSender,
  FirebasePushSender,
  MongooseNotificationRepository,
  UuidGenerator,
  DateTimeProvider,
  InMemoryEventEmitter,
} from "@ciscode/notification-kit/infra";

@Module({
  imports: [
    NotificationKitModule.register({
      senders: [
        new NodemailerSender({
          /* config */
        }),
        new TwilioSmsSender({
          /* config */
        }),
        new FirebasePushSender({
          /* config */
        }),
      ],
      repository: new MongooseNotificationRepository(/* mongoose connection */),
      idGenerator: new UuidGenerator(),
      dateTimeProvider: new DateTimeProvider(),
      eventEmitter: new InMemoryEventEmitter(),
    }),
  ],
})
export class AppModule {}
```

## 🔒 Architecture Notes

- All implementations use **lazy loading** for peer dependencies
- External packages are imported dynamically to avoid build-time dependencies
- TypeScript errors for missing packages are suppressed with `@ts-expect-error`
- Only install the peer dependencies you actually use
