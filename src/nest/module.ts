import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";

export type NotificationKitModuleOptions = Record<string, never>;

@Module({})
export class NotificationKitModule {
  static register(_options: NotificationKitModuleOptions = {}): DynamicModule {
    void _options;

    return {
      module: NotificationKitModule,
      providers: [],
      exports: [],
    };
  }
}
