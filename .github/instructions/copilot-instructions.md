# Copilot Instructions - @ciscode/notification-kit

> **Purpose**: Universal NestJS notification library supporting multi-channel delivery (Email, SMS, Push, In-App, Webhook) with pluggable provider backends, template support, persistence, and a built-in REST + Webhook API.

---

## 🎯 Package Overview

**Package**: `@ciscode/notification-kit`  
**Type**: Backend NestJS Notification Module  
**Purpose**: Centralized, multi-channel notification delivery with pluggable providers, retry logic, status tracking, and scheduling — usable across all `@ciscode/*` services

### This Package Provides:

- CSR (Controller-Service-Repository) architecture with Clean Architecture ports
- `NotificationKitModule` — global NestJS dynamic module (`register` / `registerAsync`)
- `NotificationService` — injectable orchestration service (core, framework-free)
- `NotificationController` — REST API for sending and querying notifications
- `WebhookController` — inbound webhook receiver for provider delivery callbacks
- Channel senders: **Email** (Nodemailer), **SMS** (Twilio / Vonage / AWS SNS), **Push** (Firebase), **In-App**, **Webhook**
- Repository adapters: **MongoDB** (Mongoose) and **In-Memory**
- Template rendering via Handlebars
- Zod-validated configuration
- Changesets for version management
- Husky + lint-staged for code quality
- Copilot-friendly development guidelines

---

## 🏗️ Module Architecture

**NotificationKit uses CSR (Controller-Service-Repository) + Ports & Adapters for maximum reusability and provider interchangeability.**

> **WHY CSR + Ports?** Reusable notification libraries must support multiple providers without coupling business logic to any specific SDK. Ports (interfaces) in `core/` define the contracts; adapters in `infra/` implement them. Apps choose which adapters to wire.

```
src/
  ├── index.ts                                # PUBLIC API — all exports go through here
  │
  ├── core/                                   # ✅ Framework-FREE (no NestJS imports)
  │   ├── index.ts
  │   ├── types.ts                            # Domain entities & enums
  │   ├── dtos/                               # Input/output contracts (Zod-validated)
  │   ├── ports/                              # Abstractions (interfaces the infra implements)
  │   │   ├── notification-sender.port.ts     # INotificationSender
  │   │   ├── notification-repository.port.ts # INotificationRepository
  │   │   └── (template, event, id, datetime ports)
  │   ├── errors/                             # Domain errors
  │   └── notification.service.ts            # Core orchestration logic (framework-free)
  │
  ├── infra/                                  # Concrete adapter implementations
  │   ├── index.ts
  │   ├── senders/                            # Channel sender adapters
  │   │   ├── email/                          # Nodemailer adapter
  │   │   ├── sms/                            # Twilio / Vonage / AWS SNS adapters
  │   │   ├── push/                           # Firebase adapter
  │   │   ├── in-app/                         # In-app adapter
  │   │   └── webhook/                        # Outbound webhook adapter
  │   ├── repositories/                       # Persistence adapters
  │   │   ├── mongodb/                        # Mongoose adapter
  │   │   └── in-memory/                      # In-memory adapter (testing / simple usage)
  │   └── providers/                          # Utility adapters
  │       ├── id-generator/                   # nanoid adapter
  │       ├── datetime/                       # Date/time utilities
  │       ├── template/                       # Handlebars adapter
  │       └── events/                         # Event bus adapter
  │
  └── nest/                                   # NestJS integration layer
      ├── index.ts
      ├── module.ts                           # NotificationKitModule
      ├── interfaces.ts                       # NotificationKitModuleOptions, AsyncOptions, Factory
      ├── constants.ts                        # NOTIFICATION_KIT_OPTIONS token
      ├── providers.ts                        # createNotificationKitProviders() factory
      └── controllers/
          ├── notification.controller.ts      # REST API (enable via enableRestApi)
          └── webhook.controller.ts           # Inbound webhooks (enable via enableWebhooks)
```

**Responsibility Layers:**

| Layer             | Responsibility                                             | Examples                                                    |
| ----------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| **Controllers**   | HTTP handling, REST API, inbound webhook receivers         | `NotificationController`, `WebhookController`               |
| **Core Service**  | Orchestration, channel routing, retry, status lifecycle    | `notification.service.ts`                                   |
| **DTOs**          | Input validation, API contracts (Zod)                      | `SendNotificationDto`, `NotificationQueryDto`               |
| **Ports**         | Abstractions — what `core/` depends on                     | `INotificationSender`, `INotificationRepository`            |
| **Senders**       | Channel delivery — implement `INotificationSender`         | `EmailSender`, `SmsSender`, `PushSender`                    |
| **Repositories**  | Persistence — implement `INotificationRepository`          | `MongoNotificationRepository`, `InMemoryRepository`         |
| **Providers**     | Cross-cutting utilities                                    | `HandlebarsTemplateProvider`, `NanoidGenerator`             |
| **Domain Types**  | Entities, enums, value objects (immutable, framework-free) | `Notification`, `NotificationChannel`, `NotificationStatus` |
| **Domain Errors** | Typed, named error classes                                 | `ChannelNotConfiguredError`, `NotificationNotFoundError`    |

### Layer Import Rules — STRICTLY ENFORCED

| Layer   | Can import from        | Cannot import from |
| ------- | ---------------------- | ------------------ |
| `core`  | Nothing internal       | `infra`, `nest`    |
| `infra` | `core` (ports & types) | `nest`             |
| `nest`  | `core`, `infra`        | —                  |

> **The golden rule**: `core/` must compile with zero NestJS or provider SDK imports. If you're adding a NestJS decorator or importing `nodemailer` inside `core/`, it's in the wrong layer.

---

## 📝 Naming Conventions

### Files

**Pattern**: `kebab-case` + suffix

| Type             | Example                            | Directory                         |
| ---------------- | ---------------------------------- | --------------------------------- |
| Module           | `module.ts`                        | `src/nest/`                       |
| Controller       | `notification.controller.ts`       | `src/nest/controllers/`           |
| Core Service     | `notification.service.ts`          | `src/core/`                       |
| Port interface   | `notification-sender.port.ts`      | `src/core/ports/`                 |
| DTO              | `send-notification.dto.ts`         | `src/core/dtos/`                  |
| Domain Error     | `notification-not-found.error.ts`  | `src/core/errors/`                |
| Sender adapter   | `email.sender.ts`                  | `src/infra/senders/email/`        |
| Repository       | `mongo-notification.repository.ts` | `src/infra/repositories/mongodb/` |
| Utility provider | `handlebars-template.provider.ts`  | `src/infra/providers/template/`   |
| Constants        | `constants.ts`                     | `src/nest/`                       |

### Code Naming

- **Classes & Interfaces**: `PascalCase` → `NotificationService`, `INotificationSender`, `SendNotificationDto`
- **Variables & functions**: `camelCase` → `sendNotification`, `buildProviders`
- **Constants / DI tokens**: `UPPER_SNAKE_CASE` → `NOTIFICATION_KIT_OPTIONS`, `NOTIFICATION_SENDER`, `NOTIFICATION_REPOSITORY`
- **Enums**: Name `PascalCase`, values match protocol strings

```typescript
// ✅ Correct enum definitions
enum NotificationChannel {
  EMAIL = "email",
  SMS = "sms",
  PUSH = "push",
  IN_APP = "in_app",
  WEBHOOK = "webhook",
}

enum NotificationStatus {
  PENDING = "pending",
  QUEUED = "queued",
  SENDING = "sending",
  SENT = "sent",
  DELIVERED = "delivered",
  FAILED = "failed",
  CANCELLED = "cancelled",
}
```

### Path Aliases (`tsconfig.json`)

```typescript
"@/*"       → "src/*"
"@core/*"   → "src/core/*"
"@infra/*"  → "src/infra/*"
"@nest/*"   → "src/nest/*"
```

Use aliases for cleaner imports:

```typescript
import { NotificationService } from "@core/notification.service";
import { INotificationSender } from "@core/ports/notification-sender.port";
import { SendNotificationDto } from "@core/dtos/send-notification.dto";
import { EmailSender } from "@infra/senders/email/email.sender";
```

---

## 📦 Public API — `src/index.ts`

```typescript
// ✅ All exports go through here — never import from deep paths in consuming apps
export * from "./core"; // Types, DTOs, ports, errors, NotificationService
export * from "./infra"; // Senders, repositories, utility providers
export * from "./nest"; // NotificationKitModule, interfaces, constants
```

**What consuming apps should use:**

```typescript
import {
  NotificationKitModule,
  NotificationService,
  SendNotificationDto,
  NotificationChannel,
  NotificationStatus,
  NotificationPriority,
  type Notification,
  type NotificationResult,
  type INotificationSender, // for custom adapter implementations
  type INotificationRepository, // for custom adapter implementations
} from "@ciscode/notification-kit";
```

**❌ NEVER export:**

- Internal provider wiring (`createNotificationKitProviders` internals)
- Raw SDK instances (Nodemailer transporter, Twilio client, Firebase app)
- Mongoose schema definitions (infrastructure details)

---

## ⚙️ Module Registration

### `register()` — sync

```typescript
NotificationKitModule.register({
  channels: {
    email: {
      provider: "nodemailer",
      from: "no-reply@ciscode.com",
      smtp: { host: "smtp.example.com", port: 587, auth: { user: "...", pass: "..." } },
    },
    sms: {
      provider: "twilio",
      accountSid: process.env.TWILIO_SID,
      authToken: process.env.TWILIO_TOKEN,
      from: process.env.TWILIO_FROM,
    },
    push: {
      provider: "firebase",
      serviceAccount: JSON.parse(process.env.FIREBASE_SA!),
    },
  },
  repository: { type: "mongodb", uri: process.env.MONGO_URI },
  templates: { engine: "handlebars", dir: "./templates" },
  enableRestApi: true, // default: true
  enableWebhooks: true, // default: true
  retries: { max: 3, backoff: "exponential" },
});
```

### `registerAsync()` — with ConfigService

```typescript
NotificationKitModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    channels: {
      email: { provider: "nodemailer", from: config.get("EMAIL_FROM") /* ... */ },
      sms: { provider: config.get("SMS_PROVIDER") /* ... */ },
    },
    repository: { type: config.get("DB_TYPE"), uri: config.get("MONGO_URI") },
    enableRestApi: config.get<boolean>("NOTIF_REST_API", true),
    enableWebhooks: config.get<boolean>("NOTIF_WEBHOOKS", true),
  }),
});
```

### `registerAsync()` — with `useClass` / `useExisting`

```typescript
// useClass — module instantiates the factory
NotificationKitModule.registerAsync({ useClass: NotificationKitConfigService });

// useExisting — reuse an already-provided factory
NotificationKitModule.registerAsync({ useExisting: NotificationKitConfigService });
```

> **Rule**: All channel credentials must come from env vars or `ConfigService` — never hardcoded in source. Validate all options with Zod at module startup.

> **Controller limitation**: Controllers (`enableRestApi`, `enableWebhooks`) cannot be conditionally mounted in `registerAsync` mode and are excluded. Document this clearly when advising consumers.

---

## 🧩 Core Components

### `NotificationService` (core — framework-free)

The single orchestration point. Inject this in consuming apps. Never inject raw senders or repositories.

```typescript
// Inject in your NestJS service
constructor(private readonly notifications: NotificationService) {}

// Send a single notification
const result = await this.notifications.send({
  channel:   NotificationChannel.EMAIL,
  recipient: { id: 'user-1', email: 'user@example.com' },
  content:   { title: 'Welcome', body: 'Hello!', templateId: 'welcome' },
  priority:  NotificationPriority.HIGH,
});

// Batch send
const results = await this.notifications.sendBatch([...]);
```

**Public methods:**

```typescript
send(dto: SendNotificationDto):                          Promise<NotificationResult>
sendBatch(dtos: SendNotificationDto[]):                  Promise<NotificationResult[]>
getById(id: string):                                     Promise<Notification>
getByRecipient(recipientId: string, filters?):           Promise<Notification[]>
cancel(id: string):                                      Promise<void>
retry(id: string):                                       Promise<NotificationResult>
```

### `INotificationSender` Port

All channel senders implement this port. To add a new channel or provider, implement this interface in `infra/senders/<channel>/`:

```typescript
// core/ports/notification-sender.port.ts
interface INotificationSender {
  readonly channel: NotificationChannel;
  send(notification: Notification): Promise<NotificationResult>;
  isConfigured(): boolean;
}
```

### `INotificationRepository` Port

All persistence adapters implement this. Apps never depend on Mongoose schemas directly:

```typescript
// core/ports/notification-repository.port.ts
interface INotificationRepository {
  save(notification: Notification): Promise<Notification>;
  findById(id: string): Promise<Notification | null>;
  findByRecipient(recipientId: string, filters?): Promise<Notification[]>;
  updateStatus(id: string, status: NotificationStatus, extra?): Promise<Notification>;
  delete(id: string): Promise<void>;
}
```

### `NotificationController` (REST API)

Mounted when `enableRestApi: true`. Provides:

| Method | Path                           | Description                    |
| ------ | ------------------------------ | ------------------------------ |
| `POST` | `/notifications`               | Send a notification            |
| `POST` | `/notifications/batch`         | Send multiple notifications    |
| `GET`  | `/notifications/:id`           | Get notification by ID         |
| `GET`  | `/notifications/recipient/:id` | Get notifications by recipient |
| `POST` | `/notifications/:id/cancel`    | Cancel a pending notification  |
| `POST` | `/notifications/:id/retry`     | Retry a failed notification    |

### `WebhookController`

Mounted when `enableWebhooks: true`. Receives delivery status callbacks from providers (Twilio, Firebase, etc.) and updates notification status accordingly. Must verify provider-specific signatures.

---

## 🔌 Optional Provider Peer Dependencies

All channel provider SDKs are **optional peer dependencies**. Only install what you use:

| Channel | Provider    | Peer dep              | Install when...              |
| ------- | ----------- | --------------------- | ---------------------------- |
| Email   | Nodemailer  | `nodemailer`          | Using email channel          |
| SMS     | Twilio      | `twilio`              | Using Twilio SMS             |
| SMS     | Vonage      | `@vonage/server-sdk`  | Using Vonage SMS             |
| SMS     | AWS SNS     | `@aws-sdk/client-sns` | Using AWS SNS SMS            |
| Push    | Firebase    | `firebase-admin`      | Using push notifications     |
| Any     | Persistence | `mongoose`            | Using MongoDB repository     |
| Any     | Templates   | `handlebars`          | Using template rendering     |
| Any     | ID gen      | `nanoid`              | Using the default ID adapter |

> **Rule for adding a new provider**: implement `INotificationSender` in `infra/senders/<channel>/<provider>.sender.ts`, guard the import with a clear startup error if the peer dep is missing, and document the peer dep in JSDoc and README.

---

## 🧪 Testing - RIGOROUS for Modules

### Coverage Target: 80%+

**Unit Tests — MANDATORY:**

- ✅ `core/notification.service.ts` — channel routing, retry logic, status lifecycle, error handling
- ✅ All DTOs — Zod schema validation, edge cases, invalid inputs
- ✅ All domain errors — correct messages, inheritance
- ✅ Each sender adapter — success path, failure path, `isConfigured()` guard
- ✅ Each repository adapter — CRUD operations, query filters
- ✅ Template provider — variable substitution, missing template errors
- ✅ ID generator and datetime providers

**Integration Tests:**

- ✅ `NotificationKitModule.register()` — correct provider wiring per channel config
- ✅ `NotificationKitModule.registerAsync()` — factory injection, full options resolved
- ✅ `NotificationController` — full HTTP request/response lifecycle
- ✅ `WebhookController` — provider callback → status update flow
- ✅ MongoDB repository — real schema operations (with test DB or `mongodb-memory-server`)

**E2E Tests:**

- ✅ Send notification → delivery → status update (per channel)
- ✅ Retry flow (failure → retry → success)
- ✅ Scheduled notification lifecycle

**Test file location:** same directory as source (`*.spec.ts`)

```
src/core/
  ├── notification.service.ts
  └── notification.service.spec.ts

src/infra/senders/email/
  ├── email.sender.ts
  └── email.sender.spec.ts
```

**Mocking senders and repositories in unit tests:**

```typescript
const mockSender: INotificationSender = {
  channel: NotificationChannel.EMAIL,
  send: jest.fn().mockResolvedValue({ success: true, notificationId: "n1" }),
  isConfigured: jest.fn().mockReturnValue(true),
};

const mockRepository: INotificationRepository = {
  save: jest.fn(),
  findById: jest.fn(),
  findByRecipient: jest.fn(),
  updateStatus: jest.fn(),
  delete: jest.fn(),
};
```

**Jest Configuration:**

```javascript
coverageThreshold: {
  global: {
    branches:   80,
    functions:  80,
    lines:      80,
    statements: 80,
  },
}
```

---

## 📚 Documentation - Complete

### JSDoc/TSDoc - ALWAYS for:

````typescript
/**
 * Sends a notification through the specified channel.
 * Routes to the appropriate sender adapter, persists the notification,
 * and updates its status throughout the delivery lifecycle.
 *
 * @param dto - Validated send notification payload
 * @returns Result containing success status and provider message ID
 *
 * @throws {ChannelNotConfiguredError} If the channel has no configured provider
 * @throws {RecipientMissingFieldError} If the recipient is missing required fields for the channel
 *
 * @example
 * ```typescript
 * const result = await notificationService.send({
 *   channel:   NotificationChannel.EMAIL,
 *   recipient: { id: 'user-1', email: 'user@example.com' },
 *   content:   { title: 'Welcome', body: 'Hello!' },
 *   priority:  NotificationPriority.NORMAL,
 * });
 * ```
 */
async send(dto: SendNotificationDto): Promise<NotificationResult>
````

**Required for:**

- All public methods on `NotificationService`
- All port interfaces in `core/ports/`
- All exported DTOs (with per-property descriptions)
- All exported domain error classes
- Both `register()` and `registerAsync()` on `NotificationKitModule`
- All sender adapters' `send()` methods (document provider-specific behavior and peer dep)

### Swagger/OpenAPI — ALWAYS on controllers:

```typescript
@ApiTags('notifications')
@ApiOperation({ summary: 'Send a notification' })
@ApiBody({ type: SendNotificationDto })
@ApiResponse({ status: 201, description: 'Notification queued successfully', type: NotificationResultDto })
@ApiResponse({ status: 400, description: 'Invalid input or missing recipient field' })
@ApiResponse({ status: 422, description: 'Channel not configured' })
@Post()
async send(@Body() dto: SendNotificationDto): Promise<NotificationResult> {}
```

---

## 🚀 Module Development Principles

### 1. Exportability

**Export ONLY public API:**

```typescript
// src/index.ts
export * from "./core"; // Types, DTOs, ports, errors, NotificationService
export * from "./infra"; // Senders, repositories, providers
export * from "./nest"; // NotificationKitModule, interfaces
```

**❌ NEVER export:**

- Raw SDK clients (Nodemailer transporter, Twilio client instances)
- Internal `createNotificationKitProviders()` wiring details
- Mongoose schema definitions

### 2. Configuration

**All three async patterns supported:**

```typescript
@Module({})
export class NotificationKitModule {
  static register(options: NotificationKitModuleOptions): DynamicModule {
    /* ... */
  }
  static registerAsync(options: NotificationKitModuleAsyncOptions): DynamicModule {
    // supports useFactory, useClass, useExisting
  }
}
```

**Controllers are opt-out, not opt-in:**

```typescript
// Both default to true — apps must explicitly disable
NotificationKitModule.register({ enableRestApi: false, enableWebhooks: false });
```

### 3. Zero Business Logic Coupling

- No hardcoded recipients, templates, credentials, or channel preferences
- All provider credentials from options (never from `process.env` directly inside the module)
- Channel senders are stateless — no shared mutable state between requests
- Repository is swappable — core service depends only on `INotificationRepository`
- Apps bring their own Mongoose connection — this module never creates its own DB connection

---

## 🔄 Workflow & Task Management

### Task-Driven Development

**1. Branch Creation:**

```bash
feature/NOTIF-123-add-vonage-sms-sender
bugfix/NOTIF-456-fix-firebase-retry-on-token-expiry
refactor/NOTIF-789-extract-retry-logic-to-core
```

**2. Task Documentation:**
Create task file at branch start:

```
docs/tasks/active/NOTIF-123-add-vonage-sms-sender.md
```

**3. On Release:**
Move to archive:

```
docs/tasks/archive/by-release/v1.0.0/NOTIF-123-add-vonage-sms-sender.md
```

### Development Workflow

**Simple changes**: Read context → Implement → Update docs → **Create changeset**

**Complex changes**: Read context → Discuss approach → Implement → Update docs → **Create changeset**

**When blocked**:

- **DO**: Ask immediately
- **DON'T**: Generate incorrect output

---

## 📦 Versioning & Breaking Changes

### Semantic Versioning (Strict)

**MAJOR** (x.0.0) — Breaking changes:

- Changed `NotificationService` public method signatures
- Removed or renamed fields in `SendNotificationDto` or `Notification`
- Changed `NotificationKitModuleOptions` required fields
- Renamed `register()` / `registerAsync()` or changed their call signatures
- Changed `INotificationSender` or `INotificationRepository` port contracts
- Removed a supported channel or provider

**MINOR** (0.x.0) — New features:

- New channel support (e.g. WhatsApp sender)
- New optional fields in `NotificationKitModuleOptions`
- New provider for an existing channel (e.g. Vonage alongside Twilio)
- New `NotificationService` methods (additive)
- New exported utilities or decorators

**PATCH** (0.0.x) — Bug fixes:

- Provider-specific delivery fix
- Retry backoff correction
- Template rendering edge case
- Documentation updates

### Changesets Workflow

**ALWAYS create a changeset for user-facing changes:**

```bash
npx changeset
```

**When to create a changeset:**

- ✅ New features, bug fixes, breaking changes, performance improvements
- ❌ Internal refactoring (no user impact)
- ❌ Documentation updates only
- ❌ Test improvements only

**Before completing any task:**

- [ ] Code implemented
- [ ] Tests passing
- [ ] Documentation updated
- [ ] **Changeset created** ← CRITICAL
- [ ] PR ready

**Changeset format:**

```markdown
---
"@ciscode/notification-kit": minor
---

Added Vonage SMS sender adapter as an alternative to Twilio
```

### CHANGELOG Required

Changesets automatically generates CHANGELOG. For manual additions:

```markdown
## [1.0.0] - 2026-02-26

### BREAKING CHANGES

- `NotificationService.send()` now requires `priority` field in `SendNotificationDto`
- Removed `createDefaultNotificationService()` — use `NotificationKitModule.register()` instead

### Added

- Vonage SMS sender adapter
- `sendBatch()` method on `NotificationService`
- In-memory repository for testing and lightweight usage

### Fixed

- Firebase push sender now correctly retries on token expiry (401)
```

---

## 🔐 Security Best Practices

**ALWAYS:**

- ✅ Validate all DTOs with Zod at module boundary
- ✅ All provider credentials from env vars — never hardcoded
- ✅ Sanitize notification content before logging — never log full `templateVars` (may contain PII)
- ✅ Webhook endpoints must verify provider signatures (e.g. `X-Twilio-Signature`)
- ✅ Rate-limit the REST API endpoints in production (document this requirement for consumers)
- ✅ Recipient `metadata` must never appear in error messages or stack traces

```typescript
// ❌ WRONG — logs PII from templateVars
this.logger.error("Template render failed", { notification });

// ✅ CORRECT — log only safe identifiers
this.logger.error("Template render failed", {
  notificationId: notification.id,
  channel: notification.channel,
});
```

---

## 🚫 Restrictions — Require Approval

**NEVER without approval:**

- Breaking changes to `NotificationService` public methods
- Removing or renaming fields in `SendNotificationDto`, `Notification`, or `NotificationResult`
- Changing `INotificationSender` or `INotificationRepository` port contracts
- Removing a supported channel or provider adapter
- Renaming `register()` / `registerAsync()` or their option shapes
- Security-related changes (webhook signature verification, credential handling)

**CAN do autonomously:**

- Bug fixes (non-breaking)
- New optional `NotificationKitModuleOptions` fields
- New sender adapter for an existing channel (e.g. AWS SES alongside Nodemailer)
- Internal refactoring within a single layer (no public API or port contract change)
- Test and documentation improvements

---

## ✅ Release Checklist

Before publishing:

- [ ] All tests passing (100% of test suite)
- [ ] Coverage >= 80%
- [ ] No ESLint warnings (`--max-warnings=0`)
- [ ] TypeScript strict mode passing (`tsc --noEmit`)
- [ ] `npm run build` succeeds — both `.mjs` and `.cjs` outputs in `dist/`
- [ ] All public APIs documented (JSDoc)
- [ ] All new `NotificationKitModuleOptions` fields documented in README
- [ ] Optional peer deps documented (which to install for which channel)
- [ ] Changeset created
- [ ] Breaking changes highlighted in changeset
- [ ] Integration tested via `npm link` in a real consuming NestJS app

---

## 🔄 Development Workflow

### Working on the Module:

1. Clone the repo
2. Create branch: `feature/NOTIF-123-description` from `develop`
3. Implement with tests
4. **Create changeset**: `npx changeset`
5. Verify checklist
6. Create PR → `develop`

### Testing in a Consuming App:

```bash
# In notification-kit
npm run build
npm link

# In your NestJS app
cd ~/ciscode/backend
npm link @ciscode/notification-kit

# Develop and test
# Unlink when done
npm unlink @ciscode/notification-kit
```

---

## 🎨 Code Style

- ESLint `--max-warnings=0`
- Prettier formatting
- TypeScript strict mode
- Pure functions in `core/` (no side effects, no SDK calls)
- OOP classes for NestJS providers and sender/repository adapters
- Dependency injection via constructor — never property-based `@Inject()`
- Sender adapters are stateless — no mutable instance variables after construction

```typescript
// ✅ Correct — constructor injection, stateless sender
@Injectable()
export class EmailSender implements INotificationSender {
  readonly channel = NotificationChannel.EMAIL;

  constructor(
    @Inject(NOTIFICATION_KIT_OPTIONS)
    private readonly options: NotificationKitModuleOptions,
  ) {}

  async send(notification: Notification): Promise<NotificationResult> {
    /* ... */
  }
  isConfigured(): boolean {
    return !!this.options.channels?.email;
  }
}

// ❌ Wrong — property injection, mutable state
@Injectable()
export class EmailSender {
  @Inject(NOTIFICATION_KIT_OPTIONS) private options: NotificationKitModuleOptions;
  private transporter: any; // mutated after construction ← FORBIDDEN
}
```

---

## 🐛 Error Handling

**Custom domain errors — ALWAYS in `core/errors/`:**

```typescript
export class ChannelNotConfiguredError extends Error {
  constructor(channel: NotificationChannel) {
    super(
      `Channel "${channel}" is not configured. Did you pass options for it in NotificationKitModule.register()?`,
    );
    this.name = "ChannelNotConfiguredError";
  }
}

export class NotificationNotFoundError extends Error {
  constructor(id: string) {
    super(`Notification "${id}" not found`);
    this.name = "NotificationNotFoundError";
  }
}
```

**Structured logging — safe identifiers only:**

```typescript
this.logger.error("Notification delivery failed", {
  notificationId: notification.id,
  channel: notification.channel,
  provider: "twilio",
  attempt: notification.retryCount,
});
```

**NEVER silent failures:**

```typescript
// ❌ WRONG
try {
  await sender.send(notification);
} catch {
  // silent
}

// ✅ CORRECT
try {
  await sender.send(notification);
} catch (error) {
  await this.repository.updateStatus(notification.id, NotificationStatus.FAILED, {
    error: (error as Error).message,
  });
  throw error;
}
```

---

## 💬 Communication Style

- Brief and direct
- Reference the correct layer (`core`, `infra`, `nest`) when discussing changes
- Always name the channel and provider when discussing sender-related changes
- Flag breaking changes immediately — even suspected ones
- This module is consumed by multiple services — when in doubt about impact, ask

---

## 📋 Summary

**Module Principles:**

1. Reusability over specificity
2. Comprehensive testing (80%+)
3. Complete documentation
4. Strict versioning
5. Breaking changes = MAJOR bump + changeset
6. Zero app coupling — no hardcoded credentials, recipients, or templates
7. Configurable behavior via `NotificationKitModuleOptions`

**Layer ownership — quick reference:**

| Concern                      | Owner                              |
| ---------------------------- | ---------------------------------- |
| Domain types & enums         | `src/core/types.ts`                |
| DTOs & Zod validation        | `src/core/dtos/`                   |
| Port interfaces              | `src/core/ports/`                  |
| Orchestration logic          | `src/core/notification.service.ts` |
| Domain errors                | `src/core/errors/`                 |
| Channel sender adapters      | `src/infra/senders/<channel>/`     |
| Persistence adapters         | `src/infra/repositories/`          |
| Utility adapters             | `src/infra/providers/`             |
| NestJS DI, module, providers | `src/nest/`                        |
| REST API & webhook endpoints | `src/nest/controllers/`            |
| All public exports           | `src/index.ts`                     |

**When in doubt:** Ask, don't assume. This module delivers notifications across production services.

---

_Last Updated: February 26, 2026_  
_Version: 1.0.0_
