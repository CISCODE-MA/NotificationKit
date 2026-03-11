import { describe, expect, it } from "@jest/globals";

import {
  NOTIFICATION_SERVICE,
  NOTIFICATION_REPOSITORY,
  NOTIFICATION_SENDERS,
  NOTIFICATION_ID_GENERATOR,
  NOTIFICATION_DATETIME_PROVIDER,
  NOTIFICATION_TEMPLATE_ENGINE,
  NOTIFICATION_EVENT_EMITTER,
} from "./constants";
import {
  InjectNotificationService,
  InjectNotificationRepository,
  InjectNotificationSenders,
  InjectIdGenerator,
  InjectDateTimeProvider,
  InjectTemplateEngine,
  InjectEventEmitter,
} from "./decorators";

describe("Injectable Decorators", () => {
  it("should create InjectNotificationService decorator", () => {
    const decorator = InjectNotificationService();
    expect(decorator).toBeDefined();
    expect(typeof decorator).toBe("function");
  });

  it("should create InjectNotificationRepository decorator", () => {
    const decorator = InjectNotificationRepository();
    expect(decorator).toBeDefined();
    expect(typeof decorator).toBe("function");
  });

  it("should create InjectNotificationSenders decorator", () => {
    const decorator = InjectNotificationSenders();
    expect(decorator).toBeDefined();
    expect(typeof decorator).toBe("function");
  });

  it("should create InjectIdGenerator decorator", () => {
    const decorator = InjectIdGenerator();
    expect(decorator).toBeDefined();
    expect(typeof decorator).toBe("function");
  });

  it("should create InjectDateTimeProvider decorator", () => {
    const decorator = InjectDateTimeProvider();
    expect(decorator).toBeDefined();
    expect(typeof decorator).toBe("function");
  });

  it("should create InjectTemplateEngine decorator", () => {
    const decorator = InjectTemplateEngine();
    expect(decorator).toBeDefined();
    expect(typeof decorator).toBe("function");
  });

  it("should create InjectEventEmitter decorator", () => {
    const decorator = InjectEventEmitter();
    expect(decorator).toBeDefined();
    expect(typeof decorator).toBe("function");
  });
});

describe("DI Constants", () => {
  it("should define all injection tokens", () => {
    expect(NOTIFICATION_SERVICE).toBeDefined();
    expect(NOTIFICATION_REPOSITORY).toBeDefined();
    expect(NOTIFICATION_SENDERS).toBeDefined();
    expect(NOTIFICATION_ID_GENERATOR).toBeDefined();
    expect(NOTIFICATION_DATETIME_PROVIDER).toBeDefined();
    expect(NOTIFICATION_TEMPLATE_ENGINE).toBeDefined();
    expect(NOTIFICATION_EVENT_EMITTER).toBeDefined();
  });

  it("should use symbols for injection tokens", () => {
    expect(typeof NOTIFICATION_SERVICE).toBe("symbol");
    expect(typeof NOTIFICATION_REPOSITORY).toBe("symbol");
    expect(typeof NOTIFICATION_SENDERS).toBe("symbol");
    expect(typeof NOTIFICATION_ID_GENERATOR).toBe("symbol");
    expect(typeof NOTIFICATION_DATETIME_PROVIDER).toBe("symbol");
    expect(typeof NOTIFICATION_TEMPLATE_ENGINE).toBe("symbol");
    expect(typeof NOTIFICATION_EVENT_EMITTER).toBe("symbol");
  });

  it("should have unique symbols", () => {
    const tokens = [
      NOTIFICATION_SERVICE,
      NOTIFICATION_REPOSITORY,
      NOTIFICATION_SENDERS,
      NOTIFICATION_ID_GENERATOR,
      NOTIFICATION_DATETIME_PROVIDER,
      NOTIFICATION_TEMPLATE_ENGINE,
      NOTIFICATION_EVENT_EMITTER,
    ];

    const uniqueTokens = new Set(tokens);
    expect(uniqueTokens.size).toBe(tokens.length);
  });
});
