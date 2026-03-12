# Template Configuration Guide

> ⚠️ **Important Design Principle**: NotificationKit is a **delivery-focused library**, not a content management system. For production applications, you should manage templates in your backend application where you have full control over content, localization, versioning, and business logic.

This guide explains template configuration in NotificationKit for different scenarios:

- **Provider templates** (required for WhatsApp) - Always needed
- **Built-in template engine** (optional) - Use only for prototyping

## When to Use Built-in Templates

**✅ Good for:**

- Quick prototypes and demos
- Simple use cases with static templates
- Learning and testing NotificationKit

**❌ Not recommended for:**

- Production applications
- Multi-language support
- Content that changes frequently
- Complex personalization logic
- A/B testing content
- Template versioning and history

## Recommended: Manage Templates in Your Backend

For production apps, manage templates in your backend:

```typescript
// Your backend handles templates
@Injectable()
export class EmailService {
  async sendWelcome(user: User) {
    // 1. Load & render template from YOUR system (DB, CMS, files)
    const template = await this.templateRepo.findByName("welcome");
    const content = await this.renderEngine.render(template, {
      name: user.name,
      locale: user.locale,
    });

    // 2. NotificationKit delivers pre-rendered content
    await this.notificationService.send({
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

**Benefits:**

- ✅ Update templates without redeploying code
- ✅ Store in database with version history
- ✅ Use any template engine (Handlebars, Pug, EJS, React Email, etc.)
- ✅ Implement i18n properly
- ✅ A/B test different content
- ✅ Separate concerns: content vs delivery

---

## Two Template Systems

NotificationKit provides **two optional template systems** for simple use cases:

1. **Provider-Specific Templates** - Channel-specific templates (e.g., WhatsApp/Twilio templates)
2. **Global Template Engine** - Cross-channel template system for dynamic content

---

## 1. Provider-Specific Templates

### WhatsApp Templates (Twilio)

WhatsApp Business API requires pre-approved templates. Configure them in the sender:

```typescript
import { TwilioWhatsAppSender } from "@ciscode/notification-kit";

new TwilioWhatsAppSender({
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: process.env.TWILIO_AUTH_TOKEN!,
  fromNumber: "+14155238886",

  // Map your app's template IDs to Twilio's approved templates
  templates: {
    orderShipped: "order_shipped_v1",
    orderConfirmed: "order_confirmed_v2",
    otp: "otp_verification_v3",
    welcomeMessage: "welcome_user_v1",
  },
});
```

**Usage:**

```typescript
await notificationService.send({
  channel: NotificationChannel.WHATSAPP,
  recipient: { phone: "+14155551234" },
  content: {
    templateId: "orderShipped", // Maps to 'order_shipped_v1'
    templateVars: {
      orderNumber: "12345",
      trackingUrl: "https://track.com/12345",
    },
  },
});
```

**Setup Steps:**

1. Create templates in [Twilio Console](https://console.twilio.com) → Content API
2. Get templates approved by Twilio/Meta
3. Map approved template names in your config
4. Use `templateId` to reference them

---

## 2. Global Template Engine

Use the global template engine for dynamic content across **all channels** (Email, SMS, Push, WhatsApp).

### Option A: SimpleTemplateEngine

Simple string replacement with `{{variable}}` syntax.

```typescript
import { NotificationKitModule } from '@ciscode/notification-kit';
import { SimpleTemplateEngine } from '@ciscode/notification-kit/infra';

NotificationKitModule.register({
  senders: [/* ... */],
  repository: /* ... */,

  templateEngine: new SimpleTemplateEngine({
    // Email templates
    'welcome-email': {
      title: 'Welcome to {{appName}}!',
      body: 'Hello {{userName}}, welcome to our platform.',
      html: '<h1>Welcome {{userName}}!</h1>',
    },

    'password-reset': {
      title: 'Reset Your Password',
      body: 'Use this code: {{code}}',
      html: '<p>Code: <strong>{{code}}</strong></p>',
    },

    // SMS templates
    'sms-otp': {
      title: 'Verification Code',
      body: 'Your code is {{code}}. Valid for {{minutes}} minutes.',
    },

    // Push notification templates
    'push-new-message': {
      title: 'New Message from {{senderName}}',
      body: '{{preview}}',
    },
  }),
});
```

**Features:**

- ✅ Simple `{{variable}}` replacement
- ✅ No dependencies
- ✅ Fast and lightweight
- ❌ No conditionals or loops

**Usage:**

```typescript
// Email
await notificationService.send({
  channel: NotificationChannel.EMAIL,
  recipient: { email: "user@example.com" },
  content: {
    templateId: "welcome-email",
    templateVars: { appName: "MyApp", userName: "John" },
  },
});

// SMS
await notificationService.send({
  channel: NotificationChannel.SMS,
  recipient: { phone: "+14155551234" },
  content: {
    templateId: "sms-otp",
    templateVars: { code: "123456", minutes: "5" },
  },
});
```

---

### Option B: HandlebarsTemplateEngine

Advanced templating with conditionals, loops, and helpers.

```typescript
import { HandlebarsTemplateEngine } from "@ciscode/notification-kit/infra";

NotificationKitModule.register({
  templateEngine: new HandlebarsTemplateEngine({
    templates: {
      "welcome-email": {
        title: "Welcome {{name}}!",
        body: `
          Hello {{name}},
          
          {{#if isPremium}}
          Welcome to Premium! 🎉
          {{else}}
          Upgrade to Premium for exclusive features.
          {{/if}}
          
          Features:
          {{#each features}}
          - {{this}}
          {{/each}}
        `,
        html: `
          <h1>Welcome {{name}}!</h1>
          {{#if isPremium}}
          <div class="badge">Premium</div>
          {{/if}}
          <ul>
          {{#each features}}
            <li>{{this}}</li>
          {{/each}}
          </ul>
        `,
      },

      "order-summary": {
        title: "Order #{{orderId}} - ${{total}}",
        body: `
          Order Confirmed!
          
          Items:
          {{#each items}}
          - {{name}} x{{qty}} = ${{ price }}
          {{/each}}
          
          Subtotal: ${{ subtotal }}
          Tax: ${{ tax }}
          Total: ${{ total }}
          
          {{#if shippingAddress}}
          Shipping to:
          {{shippingAddress.street}}
          {{shippingAddress.city}}, {{shippingAddress.zip}}
          {{/if}}
        `,
      },
    },
  }),
});
```

**Features:**

- ✅ Conditionals: `{{#if}}`, `{{#unless}}`
- ✅ Loops: `{{#each}}`
- ✅ Nested objects: `{{user.name}}`
- ✅ Helpers: Custom functions
- ⚠️ Requires `handlebars` peer dependency

**Installation:**

```bash
npm install handlebars
```

**Usage:**

```typescript
await notificationService.send({
  channel: NotificationChannel.EMAIL,
  recipient: { email: "user@example.com" },
  content: {
    templateId: "order-summary",
    templateVars: {
      orderId: "12345",
      items: [
        { name: "Product A", qty: 2, price: 29.99 },
        { name: "Product B", qty: 1, price: 49.99 },
      ],
      subtotal: 109.97,
      tax: 11.0,
      total: 120.97,
      shippingAddress: {
        street: "123 Main St",
        city: "San Francisco",
        zip: "94105",
      },
    },
  },
});
```

---

## Complete Configuration Example

Here's a full example using both template systems:

```typescript
import { Module } from "@nestjs/common";
import {
  NotificationKitModule,
  TwilioWhatsAppSender,
  NodemailerSender,
  TwilioSmsSender,
  HandlebarsTemplateEngine,
  InMemoryNotificationRepository,
} from "@ciscode/notification-kit";

@Module({
  imports: [
    NotificationKitModule.register({
      // Configure senders with channel-specific templates
      senders: [
        // Email sender (uses global template engine)
        new NodemailerSender({
          host: "smtp.gmail.com",
          port: 587,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
          from: "noreply@myapp.com",
        }),

        // SMS sender (uses global template engine)
        new TwilioSmsSender({
          accountSid: process.env.TWILIO_ACCOUNT_SID!,
          authToken: process.env.TWILIO_AUTH_TOKEN!,
          fromNumber: "+14155551234",
        }),

        // WhatsApp sender (has its OWN templates)
        new TwilioWhatsAppSender({
          accountSid: process.env.TWILIO_ACCOUNT_SID!,
          authToken: process.env.TWILIO_AUTH_TOKEN!,
          fromNumber: "+14155238886",

          // WhatsApp-specific templates (pre-approved on Twilio)
          templates: {
            orderShipped: "order_shipped_v1",
            otp: "otp_verification_v2",
            welcomeMessage: "welcome_user_v1",
          },
        }),
      ],

      // Global template engine for ALL channels
      templateEngine: new HandlebarsTemplateEngine({
        templates: {
          // Email templates
          "welcome-email": {
            title: "Welcome to {{appName}}!",
            body: "Hello {{userName}}, welcome to our platform!",
            html: "<h1>Welcome {{userName}}!</h1>",
          },

          "password-reset-email": {
            title: "Reset Your Password",
            body: "Click here: {{resetLink}}",
            html: '<a href="{{resetLink}}">Reset Password</a>',
          },

          // SMS templates
          "sms-verification": {
            title: "Verification Code",
            body: "Your code: {{code}}. Valid {{minutes}}min.",
          },

          "sms-alert": {
            title: "Alert",
            body: "{{message}}",
          },

          // Push notification templates
          "push-new-message": {
            title: "New message from {{senderName}}",
            body: "{{preview}}",
          },

          // WhatsApp fallback templates (when not using Twilio templates)
          "whatsapp-custom": {
            title: "Order Update",
            body: "Hi {{name}}, your order #{{id}} is {{status}}",
          },
        },
      }),

      repository: new InMemoryNotificationRepository(),
    }),
  ],
})
export class AppModule {}
```

---

## Usage Examples

### Email with Global Template

```typescript
await notificationService.send({
  channel: NotificationChannel.EMAIL,
  recipient: { id: "user-1", email: "john@example.com" },
  content: {
    templateId: "welcome-email",
    templateVars: { appName: "MyApp", userName: "John" },
  },
});
```

### SMS with Global Template

```typescript
await notificationService.send({
  channel: NotificationChannel.SMS,
  recipient: { id: "user-2", phone: "+14155551234" },
  content: {
    templateId: "sms-verification",
    templateVars: { code: "123456", minutes: "5" },
  },
});
```

### WhatsApp with Provider Template

```typescript
await notificationService.send({
  channel: NotificationChannel.WHATSAPP,
  recipient: { id: "user-3", phone: "+447911123456" },
  content: {
    templateId: "orderShipped", // Uses Twilio's 'order_shipped_v1'
    templateVars: {
      orderNumber: "12345",
      trackingUrl: "https://track.com/12345",
    },
  },
});
```

### WhatsApp with Global Template (Fallback)

```typescript
await notificationService.send({
  channel: NotificationChannel.WHATSAPP,
  recipient: { id: "user-4", phone: "+212612345678" },
  content: {
    templateId: "whatsapp-custom", // Uses global template engine
    templateVars: {
      name: "Alice",
      id: "67890",
      status: "shipped",
    },
  },
});
```

---

## Template Priority

When sending a notification with a `templateId`:

1. **Check provider-specific templates first** (e.g., WhatsApp sender's `templates` map)

### 🎯 Primary Recommendation: Backend Template Management

**For production applications**, manage templates in your backend:

```typescript
// ✅ Best: Full control in your backend
class TemplateService {
  async render(name: string, vars: any, locale: string) {
    const template = await this.db.templates.findOne({ name, locale });
    return this.engine.render(template, vars);
  }
}
```

**Benefits:**

- Update templates without code deployment
- Store in database with full audit trail
- Support multiple languages properly
- A/B test content variations
- Use any template engine you prefer

2. **Fall back to global template engine** if not found in provider

- **Manage templates in your backend** for production apps (recommended)

3. **Use raw content** if no templates match

---

## Best Practices

### ✅ Do:

- Use built-in templates for production (manage in backend instead)
- Use **provider templates** for WhatsApp (required by Twilio/Meta)
- Pass **pre-rendered content** to NotificationKit
- Use built-in templates **only for prototypes/demos**
- Keep templates **simple and reusable** (if using built-in)
- Store production templates in NotificationKit config
- Test templates with **real data**
- Version your templates (e.g., `welcome_v2`)

### ❌ Don't:

- Hard-code content in your app logic
- Mix template systems unnecessarily
- Forget to handle missing variables
- Use complex logic in templates (move to app code)

---

## Configuration File Organization

For large apps, organize templates in separate files:

```typescript
// templates/email.templates.ts
export const emailTemplates = {
  'welcome-email': {
    title: 'Welcome to {{appName}}!',
    body: '...',
    html: '...',
  },
  // ... more email templates
};

// templates/sms.templates.ts
export const smsTemplates = {
  'sms-otp': { ... },
  'sms-alert': { ... },
};

// templates/whatsapp.config.ts
export const whatsappTemplates = {
  orderShipped: 'order_shipped_v1',
  otp: 'otp_verification_v2',
};

// app.module.ts
import { emailTemplates } from './templates/email.templates';
import { smsTemplates } from './templates/sms.templates';
import { whatsappTemplates } from './templates/whatsapp.config';

NotificationKitModule.register({
  senders: [
    new TwilioWhatsAppSender({
      // ...
      templates: whatsappTemplates,
    }),
  ],
  templateEngine: new HandlebarsTemplateEngine({
    templates: {
      ...emailTemplates,
      ...smsTemplates,
    },
  }),
});
```

---

## Summary

| Template Type         | Where Configured | Used For                    | Example                                               |
| --------------------- | ---------------- | --------------------------- | ----------------------------------------------------- |
| **Provider-Specific** | Sender config    | WhatsApp (Twilio templates) | `new TwilioWhatsAppSender({ templates: {...} })`      |
| **Global Engine**     | Module config    | Email, SMS, Push, WhatsApp  | `templateEngine: new HandlebarsTemplateEngine({...})` |

**Key Difference:**

- **Provider templates** = Pre-approved by provider (Twilio/Meta)
- **Global templates** = Your own custom templates for any channel

---

## Need Help?

- Check [Core Documentation](../src/core/README.md)
- See [Infrastructure Providers](../src/infra/README.md)
- Review [Test Examples](../src/core/notification.service.test.ts)
