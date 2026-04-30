import { query } from "../lib/database.js";
import { sendAccountNotificationEmail } from "./emailService.js";
import {
  resolveNotificationPreferences,
  type NotificationPreferenceSettings,
} from "./userNotificationPreferences.js";

type NotificationCategory = "general" | "security" | "billing" | "maintenance";

export interface ActivityEmailPayload {
  userId: string;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  message?: string | null;
  status?: "success" | "warning" | "error" | "info";
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}

const EMAIL_ELIGIBLE_EVENTS = new Set<string>([
  "auth.login",
  "auth.password_change",
  "auth.2fa.enabled",
  "auth.2fa.disabled",
  "api_key.create",
  "api_key.revoke",
  "ticket_reply",
  "impersonation_target",
  "impersonation_ended",
  "billing.payment.completed",
  "billing.payment.failed",
  "billing.payment.cancelled",
  "billing.refund.completed",
  "platform_availability.update",
  "platform_settings.update",
  "theme_update",
]);

const resolveCategory = (eventType: string): NotificationCategory => {
  if (
    eventType.startsWith("auth.") ||
    eventType.startsWith("api_key.") ||
    eventType.startsWith("impersonation")
  ) {
    return "security";
  }

  if (eventType.startsWith("billing.")) {
    return "billing";
  }

  if (
    eventType.startsWith("maintenance.") ||
    eventType.startsWith("platform_") ||
    eventType === "theme_update"
  ) {
    return "maintenance";
  }

  return "general";
};

const resolveTitle = (eventType: string): string => {
  switch (eventType) {
    case "auth.login":
      return "New login detected";
    case "auth.password_change":
      return "Password changed";
    case "auth.2fa.enabled":
      return "Two-factor authentication enabled";
    case "auth.2fa.disabled":
      return "Two-factor authentication disabled";
    case "api_key.create":
      return "API key created";
    case "api_key.revoke":
      return "API key revoked";
    case "ticket_reply":
      return "Support ticket update";
    case "impersonation_target":
      return "Admin account access started";
    case "impersonation_ended":
      return "Admin account access ended";
    case "billing.payment.completed":
      return "Payment completed";
    case "billing.payment.failed":
      return "Payment failed";
    case "billing.payment.cancelled":
      return "Payment cancelled";
    case "billing.refund.completed":
      return "Refund completed";
    case "platform_availability.update":
      return "Platform availability updated";
    case "platform_settings.update":
      return "Platform settings updated";
    case "theme_update":
      return "Platform theme updated";
    default:
      return "Account notification";
  }
};

const resolveFallbackMessage = (
  eventType: string,
  entityType: string,
): string => {
  return `A ${eventType} event was recorded for ${entityType}.`;
};

const canSendForCategory = (
  category: NotificationCategory,
  preferences: NotificationPreferenceSettings,
): boolean => {
  if (!preferences.emailNotifications) {
    return false;
  }

  if (category === "security") {
    return preferences.securityAlerts;
  }

  if (category === "billing") {
    return preferences.billingAlerts;
  }

  if (category === "maintenance") {
    return preferences.maintenanceAlerts;
  }

  return true;
};

export const sendActivityNotificationEmail = async (
  payload: ActivityEmailPayload,
): Promise<void> => {
  const { userId, eventType } = payload;

  if (!EMAIL_ELIGIBLE_EVENTS.has(eventType)) {
    return;
  }

  const userRes = await query(
    "SELECT email, name, preferences FROM users WHERE id = $1 LIMIT 1",
    [userId],
  );

  if (userRes.rows.length === 0) {
    return;
  }

  const user = userRes.rows[0];
  const email = typeof user.email === "string" ? user.email.trim() : "";
  if (!email) {
    return;
  }

  const preferences = resolveNotificationPreferences(user.preferences);
  const category = resolveCategory(eventType);
  if (!canSendForCategory(category, preferences)) {
    return;
  }

  const displayName =
    typeof user.name === "string" && user.name.trim().length > 0
      ? user.name.trim()
      : undefined;

  const message =
    typeof payload.message === "string" && payload.message.trim().length > 0
      ? payload.message.trim()
      : resolveFallbackMessage(eventType, payload.entityType);

  await sendAccountNotificationEmail({
    to: email,
    name: displayName,
    category,
    title: resolveTitle(eventType),
    message,
    eventType,
    occurredAt: payload.occurredAt || new Date().toISOString(),
  });
};
