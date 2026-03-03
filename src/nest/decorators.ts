import { Inject } from "@nestjs/common";

import {
  NOTIFICATION_DATETIME_PROVIDER,
  NOTIFICATION_EVENT_EMITTER,
  NOTIFICATION_ID_GENERATOR,
  NOTIFICATION_KIT_OPTIONS,
  NOTIFICATION_REPOSITORY,
  NOTIFICATION_SENDERS,
  NOTIFICATION_SERVICE,
  NOTIFICATION_TEMPLATE_ENGINE,
} from "./constants";

/**
 * Inject NotificationService
 */
export const InjectNotificationService = () => Inject(NOTIFICATION_SERVICE);

/**
 * Inject NotificationKit module options
 */
export const InjectNotificationKitOptions = () => Inject(NOTIFICATION_KIT_OPTIONS);

/**
 * Inject notification repository
 */
export const InjectNotificationRepository = () => Inject(NOTIFICATION_REPOSITORY);

/**
 * Inject notification senders
 */
export const InjectNotificationSenders = () => Inject(NOTIFICATION_SENDERS);

/**
 * Inject ID generator
 */
export const InjectIdGenerator = () => Inject(NOTIFICATION_ID_GENERATOR);

/**
 * Inject DateTime provider
 */
export const InjectDateTimeProvider = () => Inject(NOTIFICATION_DATETIME_PROVIDER);

/**
 * Inject template engine
 */
export const InjectTemplateEngine = () => Inject(NOTIFICATION_TEMPLATE_ENGINE);

/**
 * Inject event emitter
 */
export const InjectEventEmitter = () => Inject(NOTIFICATION_EVENT_EMITTER);
