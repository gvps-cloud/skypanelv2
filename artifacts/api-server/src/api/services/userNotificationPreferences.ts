export interface NotificationPreferenceSettings {
  emailNotifications: boolean;
  billingAlerts: boolean;
  securityAlerts: boolean;
  maintenanceAlerts: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferenceSettings = {
  emailNotifications: true,
  billingAlerts: true,
  securityAlerts: true,
  maintenanceAlerts: true,
};

const coerceBoolean = (
  value: unknown,
): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

export const extractNotificationPreferenceInput = (
  input: unknown,
): Partial<NotificationPreferenceSettings> => {
  const direct = asObject(input);
  const nested = asObject(direct?.notifications);
  const source = nested ?? direct;

  if (!source) {
    return {};
  }

  const partial: Partial<NotificationPreferenceSettings> = {};

  const emailNotifications = coerceBoolean(source.emailNotifications);
  if (typeof emailNotifications === "boolean") {
    partial.emailNotifications = emailNotifications;
  }

  const billingAlerts = coerceBoolean(source.billingAlerts);
  if (typeof billingAlerts === "boolean") {
    partial.billingAlerts = billingAlerts;
  }

  const securityAlerts = coerceBoolean(source.securityAlerts);
  if (typeof securityAlerts === "boolean") {
    partial.securityAlerts = securityAlerts;
  }

  const maintenanceAlerts = coerceBoolean(source.maintenanceAlerts);
  if (typeof maintenanceAlerts === "boolean") {
    partial.maintenanceAlerts = maintenanceAlerts;
  }

  return partial;
};

export const resolveNotificationPreferences = (
  rawPreferences: unknown,
): NotificationPreferenceSettings => {
  const root = asObject(rawPreferences) ?? {};
  const normalizedInput = extractNotificationPreferenceInput(root.notifications);

  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...normalizedInput,
  };
};

export const mergeNotificationPreferences = (
  currentPreferences: unknown,
  updates: unknown,
): Record<string, unknown> => {
  const currentRoot = asObject(currentPreferences) ?? {};
  const currentNotifications = resolveNotificationPreferences(currentRoot);
  const incoming = extractNotificationPreferenceInput(updates);

  return {
    ...currentRoot,
    notifications: {
      ...currentNotifications,
      ...incoming,
    },
  };
};
