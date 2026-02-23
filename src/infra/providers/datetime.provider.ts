import type { IDateTimeProvider } from "../../core";

/**
 * DateTime provider implementation using native Date
 */
export class DateTimeProvider implements IDateTimeProvider {
  now(): string {
    return new Date().toISOString();
  }

  isPast(_datetime: string): boolean {
    try {
      const date = new Date(_datetime);
      return date.getTime() < Date.now();
    } catch {
      return false;
    }
  }

  isFuture(_datetime: string): boolean {
    try {
      const date = new Date(_datetime);
      return date.getTime() > Date.now();
    } catch {
      return false;
    }
  }
}
