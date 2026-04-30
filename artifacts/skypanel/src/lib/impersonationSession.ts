export const IMPERSONATION_TOKEN_STORAGE_KEY = "impersonation_token";
export const IMPERSONATION_USER_STORAGE_KEY = "impersonation_user";
export const IMPERSONATION_ADMIN_STORAGE_KEY = "impersonation_original_admin";
export const IMPERSONATION_EXPIRES_AT_STORAGE_KEY = "impersonation_expires_at";
export const SESSION_ORG_ID_KEY = "skypanel_org_id";

export interface StoredSessionUser {
  id: string;
  email: string;
  role: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  timezone?: string;
  preferences?: unknown;
  twoFactorEnabled?: boolean;
  emailVerified?: boolean;
  organizationId?: string;
  organizationRole?: string | null;
}

export interface StoredOriginalAdmin {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  organizationId?: string;
}

export interface StoredImpersonationSession {
  token: string;
  user: StoredSessionUser;
  originalAdmin: StoredOriginalAdmin;
  expiresAt: string;
}

type JwtPayload = {
  exp?: number;
  iat?: number;
  isImpersonating?: boolean;
  originalAdminId?: string;
  [key: string]: unknown;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function sessionStorageGetItem(key: string): string | null {
  if (!isBrowser()) {
    return null;
  }
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function sessionStorageSetItem(key: string, value: string): void {
  if (!isBrowser()) {
    return;
  }
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Storage full or unavailable
  }
}

function sessionStorageRemoveItem(key: string): void {
  if (!isBrowser()) {
    return;
  }
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

function parseStoredJson<T>(key: string, storage: Storage): T | null {
  if (!isBrowser()) {
    return null;
  }

  const rawValue = storage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

export function decodeJwtPayload(token: string | null | undefined): JwtPayload | null {
  if (!token) {
    return null;
  }

  try {
    const [, base64Url] = token.split(".");
    if (!base64Url) {
      return null;
    }

    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join(""),
    );

    return JSON.parse(jsonPayload) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) {
    return false;
  }

  return Date.now() >= payload.exp * 1000;
}

export function hasImpersonationClaims(token: string | null | undefined): boolean {
  const payload = decodeJwtPayload(token);
  return Boolean(payload?.isImpersonating && payload?.originalAdminId);
}

export function clearImpersonationSessionStorage() {
  if (!isBrowser()) {
    return;
  }

  sessionStorageRemoveItem(IMPERSONATION_TOKEN_STORAGE_KEY);
  sessionStorageRemoveItem(IMPERSONATION_USER_STORAGE_KEY);
  sessionStorageRemoveItem(IMPERSONATION_ADMIN_STORAGE_KEY);
  sessionStorageRemoveItem(IMPERSONATION_EXPIRES_AT_STORAGE_KEY);
}

export function persistImpersonationSession(session: StoredImpersonationSession) {
  if (!isBrowser()) {
    return;
  }

  sessionStorageSetItem(IMPERSONATION_TOKEN_STORAGE_KEY, session.token);
  sessionStorageSetItem(IMPERSONATION_USER_STORAGE_KEY, JSON.stringify(session.user));
  sessionStorageSetItem(IMPERSONATION_ADMIN_STORAGE_KEY, JSON.stringify(session.originalAdmin));
  sessionStorageSetItem(IMPERSONATION_EXPIRES_AT_STORAGE_KEY, session.expiresAt);
}

export function getStoredImpersonationSession(): StoredImpersonationSession | null {
  if (!isBrowser()) {
    return null;
  }

  const token = sessionStorageGetItem(IMPERSONATION_TOKEN_STORAGE_KEY);

  if (!token || !hasImpersonationClaims(token) || isTokenExpired(token)) {
    clearImpersonationSessionStorage();
    return null;
  }

  const payload = decodeJwtPayload(token);
  const user = parseStoredJson<StoredSessionUser>(IMPERSONATION_USER_STORAGE_KEY, sessionStorage);

  if (!user) {
    return null;
  }

  const expiresAt =
    sessionStorageGetItem(IMPERSONATION_EXPIRES_AT_STORAGE_KEY) ??
    (payload?.exp ? new Date(payload.exp * 1000).toISOString() : null);

  if (!expiresAt) {
    return null;
  }

  const originalAdmin =
    parseStoredJson<StoredOriginalAdmin>(IMPERSONATION_ADMIN_STORAGE_KEY, sessionStorage) ??
    (payload?.originalAdminId
      ? {
          id: String(payload.originalAdminId),
          email: "Admin User",
          name: "Admin User",
        }
      : null);

  if (!originalAdmin) {
    return null;
  }

  return {
    token,
    user,
    originalAdmin,
    expiresAt,
  };
}
