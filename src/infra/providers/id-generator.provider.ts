import type { IIdGenerator } from "../../core";

/**
 * ID generator using UUID v4
 */
export class UuidGenerator implements IIdGenerator {
  generate(): string {
    // Simple UUID v4 implementation
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

/**
 * ID generator using MongoDB ObjectId format
 */
export class ObjectIdGenerator implements IIdGenerator {
  private counter = Math.floor(Math.random() * 0xffffff);

  generate(): string {
    // Generate MongoDB ObjectId-like string (24 hex characters)
    const timestamp = Math.floor(Date.now() / 1000)
      .toString(16)
      .padStart(8, "0");
    const machineId = Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0");
    const processId = Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, "0");
    this.counter = (this.counter + 1) % 0xffffff;
    const counter = this.counter.toString(16).padStart(6, "0");

    return timestamp + machineId + processId + counter;
  }
}

/**
 * ID generator using NanoID (requires nanoid package)
 * Note: Returns synchronous string, loads nanoid on first use
 */
export class NanoIdGenerator implements IIdGenerator {
  private nanoid: (() => string) | null = null;
  private initialized = false;

  generate(): string {
    if (!this.initialized) {
      // For first call, use UUID fallback and initialize in background
      this.initialize();
      return new UuidGenerator().generate();
    }

    if (!this.nanoid) {
      return new UuidGenerator().generate();
    }

    return this.nanoid();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // @ts-expect-error - nanoid is an optional peer dependency
      const { nanoid } = await import("nanoid");
      this.nanoid = nanoid;
    } catch {
      // Fallback to UUID if nanoid is not installed
      this.nanoid = () => new UuidGenerator().generate();
    }

    this.initialized = true;
  }
}
