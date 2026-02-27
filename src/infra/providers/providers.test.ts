import { describe, expect, it } from "@jest/globals";

import { DateTimeProvider } from "./datetime.provider";
import { InMemoryEventEmitter, ConsoleEventEmitter } from "./event-emitter.provider";
import { UuidGenerator, ObjectIdGenerator } from "./id-generator.provider";
import { SimpleTemplateEngine } from "./template.provider";

describe("UuidGenerator", () => {
  it("should generate valid UUID v4", () => {
    const generator = new UuidGenerator();
    const id = generator.generate();

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidRegex);
  });

  it("should generate unique IDs", () => {
    const generator = new UuidGenerator();
    const ids = new Set();

    for (let i = 0; i < 100; i++) {
      ids.add(generator.generate());
    }

    expect(ids.size).toBe(100);
  });
});

describe("ObjectIdGenerator", () => {
  it("should generate MongoDB ObjectId-like strings", () => {
    const generator = new ObjectIdGenerator();
    const id = generator.generate();

    // ObjectId format: 24 hex characters
    const objectIdRegex = /^[0-9a-f]{24}$/i;
    expect(id).toMatch(objectIdRegex);
    expect(id.length).toBe(24);
  });

  it("should generate unique IDs", () => {
    const generator = new ObjectIdGenerator();
    const ids = new Set();

    for (let i = 0; i < 100; i++) {
      ids.add(generator.generate());
    }

    expect(ids.size).toBe(100);
  });

  it("should generate unique IDs", () => {
    const generator = new ObjectIdGenerator();
    const ids = new Set();

    for (let i = 0; i < 100; i++) {
      ids.add(generator.generate());
    }

    expect(ids.size).toBe(100);
  });
});

describe("DateTimeProvider", () => {
  it("should return current date as ISO string", () => {
    const provider = new DateTimeProvider();
    const now = provider.now();

    expect(typeof now).toBe("string");
    // Should be a valid ISO date
    expect(() => new Date(now)).not.toThrow();
    expect(Math.abs(new Date(now).getTime() - Date.now())).toBeLessThan(100);
  });

  it("should check if date is in the past", () => {
    const provider = new DateTimeProvider();
    const pastDate = "2020-01-01T00:00:00Z";
    const futureDate = "2030-01-01T00:00:00Z";

    expect(provider.isPast(pastDate)).toBe(true);
    expect(provider.isPast(futureDate)).toBe(false);
  });

  it("should check if date is in the future", () => {
    const provider = new DateTimeProvider();
    const pastDate = "2020-01-01T00:00:00Z";
    const futureDate = "2030-01-01T00:00:00Z";

    expect(provider.isFuture(pastDate)).toBe(false);
    expect(provider.isFuture(futureDate)).toBe(true);
  });
});

describe("SimpleTemplateEngine", () => {
  it("should render simple template with variables", async () => {
    const engine = new SimpleTemplateEngine({
      welcome: {
        title: "Welcome {{name}}!",
        body: "Hello {{name}}, welcome to {{platform}}!",
      },
    });

    const result = await engine.render("welcome", { name: "John", platform: "NotificationKit" });

    expect(result.title).toBe("Welcome John!");
    expect(result.body).toBe("Hello John, welcome to NotificationKit!");
  });

  it("should handle missing variables gracefully", async () => {
    const engine = new SimpleTemplateEngine({
      greeting: {
        title: "Hello",
        body: "Hello {{name}}, your score is {{score}}",
      },
    });

    const result = await engine.render("greeting", { name: "John" });

    expect(result.body).toBe("Hello John, your score is ");
  });

  it("should handle multiple occurrences of same variable", async () => {
    const engine = new SimpleTemplateEngine({
      repeat: {
        title: "Repeat",
        body: "{{name}} said: Hello {{name}}!",
      },
    });

    const result = await engine.render("repeat", { name: "Alice" });

    expect(result.body).toBe("Alice said: Hello Alice!");
  });

  it("should handle template without variables", async () => {
    const engine = new SimpleTemplateEngine({
      static: {
        title: "Static",
        body: "This is a static message",
      },
    });

    const result = await engine.render("static", {});

    expect(result.body).toBe("This is a static message");
  });

  it("should handle numeric and boolean variables", async () => {
    const engine = new SimpleTemplateEngine({
      stats: {
        title: "Stats",
        body: "Count: {{count}}, Active: {{active}}",
      },
    });

    const result = await engine.render("stats", { count: 42, active: true });

    expect(result.body).toBe("Count: 42, Active: true");
  });

  it("should throw error for missing template", async () => {
    const engine = new SimpleTemplateEngine({});

    await expect(engine.render("nonexistent", {})).rejects.toThrow(
      "Template nonexistent not found",
    );
  });
});

describe("InMemoryEventEmitter", () => {
  it("should register and call event handler", async () => {
    const emitter = new InMemoryEventEmitter();
    const events: any[] = [];

    emitter.on("notification.sent", (event) => {
      events.push(event);
    });

    await emitter.emit({ type: "notification.sent", notification: {} as any, result: {} as any });

    expect(events.length).toBe(1);
    expect(events[0]?.type).toBe("notification.sent");
  });

  it("should handle multiple handlers for same event", async () => {
    const emitter = new InMemoryEventEmitter();
    const events1: any[] = [];
    const events2: any[] = [];

    emitter.on("notification.created", (event) => {
      events1.push(event);
    });
    emitter.on("notification.created", (event) => {
      events2.push(event);
    });

    await emitter.emit({ type: "notification.created", notification: {} as any });

    expect(events1.length).toBe(1);
    expect(events2.length).toBe(1);
  });

  it("should remove event handler", async () => {
    const emitter = new InMemoryEventEmitter();
    const events: any[] = [];
    const handler = (event: any) => {
      events.push(event);
    };

    emitter.on("notification.failed", handler);
    await emitter.emit({ type: "notification.failed", notification: {} as any, error: "Test" });

    emitter.off("notification.failed", handler);
    await emitter.emit({ type: "notification.failed", notification: {} as any, error: "Test2" });

    expect(events.length).toBe(1);
  });

  it("should handle events with no handlers", async () => {
    const emitter = new InMemoryEventEmitter();

    // Should not throw
    await expect(
      emitter.emit({ type: "notification.sent", notification: {} as any, result: {} as any }),
    ).resolves.not.toThrow();
  });

  it("should clear all handlers", async () => {
    const emitter = new InMemoryEventEmitter();
    const events: any[] = [];

    emitter.on("notification.created", (event) => {
      events.push(event);
    });
    emitter.on("notification.sent", (event) => {
      events.push(event);
    });

    emitter.clear();
    await emitter.emit({ type: "notification.created", notification: {} as any });
    await emitter.emit({ type: "notification.sent", notification: {} as any, result: {} as any });

    expect(events.length).toBe(0);
  });
});

describe("ConsoleEventEmitter", () => {
  it("should log events to console", async () => {
    const emitter = new ConsoleEventEmitter();
    const logs: any[] = [];

    // Mock console.log
    const originalLog = console.log;
    console.log = (...args: any[]) => {
      logs.push(args);
    };

    await emitter.emit({ type: "notification.sent", notification: {} as any, result: {} as any });

    console.log = originalLog;

    expect(logs.length).toBeGreaterThan(0);
  });
});
