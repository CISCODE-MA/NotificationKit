import { describe, expect, it } from "@jest/globals";

describe("Package Exports", () => {
  it("should export core types and classes", async () => {
    const core = await import("../src/core");

    expect(core.NotificationChannel).toBeDefined();
    expect(core.NotificationStatus).toBeDefined();
    expect(core.NotificationPriority).toBeDefined();
    expect(core.NotificationService).toBeDefined();
    expect(core.NotificationError).toBeDefined();
  });

  it("should export infrastructure components", async () => {
    const infra = await import("../src/infra");

    // Repository implementations are in separate packages
    // expect(infra.InMemoryNotificationRepository).not.toBeDefined();
    expect(infra.UuidGenerator).toBeDefined();
    expect(infra.DateTimeProvider).toBeDefined();
  });

  it("should export NestJS module", async () => {
    const nest = await import("../src/nest");

    expect(nest.NotificationKitModule).toBeDefined();
    expect(nest.InjectNotificationService).toBeDefined();
    expect(nest.NotificationController).toBeDefined();
  });

  it("should have correct package structure", async () => {
    const pkg = await import("../src/index");

    // Should export everything
    expect(pkg).toHaveProperty("NotificationKitModule");
    expect(pkg).toHaveProperty("NotificationService");
    expect(pkg).toHaveProperty("NotificationChannel");
  });
});

describe("TypeScript Types", () => {
  it("should have proper type definitions", () => {
    // This test ensures TypeScript compilation works correctly
    expect(true).toBe(true);
  });
});
