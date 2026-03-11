/**
 * WhatsApp Utilities
 *
 * Shared utility functions for WhatsApp senders to avoid code duplication.
 */

import type { NotificationRecipient } from "../../../core";

/**
 * Validate phone number is in E.164 format
 *
 * E.164 format: +[country code][number]
 * Examples: +14155551234, +447911123456, +212612345678
 *
 * @param phone - Phone number to validate
 * @returns boolean - true if valid E.164 format
 */
export function isValidPhoneNumber(phone: string): boolean {
  // E.164 format: + followed by 1-15 digits
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate recipient has phone number in E.164 format
 *
 * @param recipient - Recipient to validate
 * @returns boolean - true if phone exists and is valid
 */
export function validateWhatsAppRecipient(recipient: NotificationRecipient): boolean {
  return !!recipient.phone && isValidPhoneNumber(recipient.phone);
}

/**
 * Error messages for WhatsApp validation
 */
export const WHATSAPP_ERRORS = {
  PHONE_REQUIRED: "Recipient phone number is required for WhatsApp",
  INVALID_PHONE_FORMAT: (phone: string) =>
    `Invalid phone number format. Must be E.164 format (e.g., +1234567890). Got: ${phone}`,
} as const;
