/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  clearImpersonationSessionStorage,
  decodeJwtPayload,
  getStoredImpersonationSession,
  hasImpersonationClaims,
  persistImpersonationSession,
  type StoredOriginalAdmin,
  type StoredSessionUser,
} from "@/lib/impersonationSession";
import { apiClient } from "@/lib/api";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  timezone?: string;
  role: string;
  emailVerified: boolean;
  preferences?: any;
  twoFactorEnabled?: boolean;
  organizationId?: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isImpersonating: boolean;
  login: (email: string, password: string, code?: string, maintenanceCode?: string) => Promise<any>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  updateProfile: (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    timezone?: string;
  }) => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  updatePreferences: (
    notificationsOrPayload?: any,
    security?: any,
  ) => Promise<void>;
  verifyPassword: (password: string) => Promise<boolean>;
  getApiKeys: () => Promise<any[]>;
  createApiKey: (name: string) => Promise<any>;
  revokeApiKey: (id: string) => Promise<void>;
  setup2FA: () => Promise<{ secret: string; qrCode: string }>;
  verify2FA: (token: string) => Promise<void>;
  disable2FA: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);

  const syncImpersonationSession = (
    nextToken: string | null,
    nextUser: User | null,
  ) => {
    const impersonationActive = Boolean(nextToken && hasImpersonationClaims(nextToken));
    setIsImpersonating(impersonationActive);

    if (!nextToken || !nextUser || !impersonationActive) {
      clearImpersonationSessionStorage();
      return;
    }

    const payload = decodeJwtPayload(nextToken);
    const existingSession = getStoredImpersonationSession();
    const fallbackOriginalAdmin: StoredOriginalAdmin | null = payload?.originalAdminId
      ? {
          id: String(payload.originalAdminId),
          email: existingSession?.originalAdmin.email || "Admin User",
          name: existingSession?.originalAdmin.name || "Admin User",
          firstName: existingSession?.originalAdmin.firstName,
          lastName: existingSession?.originalAdmin.lastName,
          role: existingSession?.originalAdmin.role || "admin",
          organizationId: existingSession?.originalAdmin.organizationId,
        }
      : null;

    if (!payload?.exp || !fallbackOriginalAdmin) {
      clearImpersonationSessionStorage();
      setIsImpersonating(false);
      return;
    }

    persistImpersonationSession({
      token: nextToken,
      user: nextUser as StoredSessionUser,
      originalAdmin: existingSession?.originalAdmin ?? fallbackOriginalAdmin,
      expiresAt: existingSession?.expiresAt ?? new Date(payload.exp * 1000).toISOString(),
    });
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    setIsImpersonating(false);
    clearImpersonationSessionStorage();
    try { sessionStorage.removeItem("skypanel_org_id"); } catch { /* ignore */ }

    void apiClient.post("/auth/logout").catch(() => {
      // Continue with local cleanup even if server request fails
    });
  };

  const refreshToken = async () => {
    try {
      const data = await apiClient.post<{ token?: string; user?: User }>("/auth/refresh");

      if (typeof data.token === "string" && data.token.length > 0) {
        setToken(data.token);
      }

      if (data.user) {
        setUser(data.user);
      }

      if (typeof data.token === "string" && data.token.length > 0) {
        syncImpersonationSession(data.token, data.user ?? user);
      } else {
        syncImpersonationSession(null, null);
      }
    } catch (error) {
      console.error("Token refresh error:", error);
      logout();
      throw error;
    }
  };

  const verifyPassword = async (password: string) => {
    try {
      await apiClient.post("/auth/verify-password", { password });
      return true;
    } catch (error) {
      console.error("Verify password error:", error);
      throw error;
    }
  };

  useEffect(() => {
    // Restore session from HttpOnly cookie via /api/auth/me
    fetch("/api/auth/me", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        return response.json();
      })
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          if (typeof data.token === "string" && data.token.length > 0) {
            setToken(data.token);
          }
          if (data.user.organizationId) {
            try { sessionStorage.setItem("skypanel_org_id", data.user.organizationId); } catch { /* ignore */ }
          }
          syncImpersonationSession(data.token ?? null, data.user);
        }
      })
      .catch(() => {
        // Ignore unauthenticated restore failures
      })
      .finally(() => {
        setLoading(false);
      });

    // Set up periodic token expiration check (every minute)
    const tokenCheckInterval = setInterval(() => {
      // Token is HttpOnly cookie - we can't read it directly
      // If token is expired, API calls will fail and auto-logout will trigger
    }, 60000);

    return () => {
      clearInterval(tokenCheckInterval);
    };
  // We intentionally run this only once on mount to hydrate auth state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string, code?: string, maintenanceCode?: string) => {
    try {
      const data = await apiClient.post<{
        require2fa?: boolean;
        user?: User;
        token?: string;
      }>("/auth/login", { email, password, code, maintenanceCode });

      if (data.require2fa) {
        return { require2fa: true };
      }

      setUser(data.user ?? null);
      setToken(data.token ?? null);
      setIsImpersonating(false);
      clearImpersonationSessionStorage();
      if (data.user?.organizationId) {
        try { sessionStorage.setItem("skypanel_org_id", data.user.organizationId); } catch { /* ignore */ }
      }

      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const result = await apiClient.post<{ user: User; token?: string }>(
        "/auth/register",
        data,
      );

      setUser(result.user);
      setToken(result.token ?? null);
      setIsImpersonating(false);
      clearImpersonationSessionStorage();
      if (result.user.organizationId) {
        try { sessionStorage.setItem("skypanel_org_id", result.user.organizationId); } catch { /* ignore */ }
      }
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  };

  const updateProfile = async (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    timezone?: string;
  }) => {
    try {
      const result = await apiClient.put<{ user: User }>("/auth/profile", data);
      setUser(result.user);
      syncImpersonationSession(token, result.user);
    } catch (error) {
      console.error("Update profile error:", error);
      throw error;
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string,
  ) => {
    try {
      const result = await apiClient.put("/auth/password", {
        currentPassword,
        newPassword,
      });
      return result;
    } catch (error) {
      console.error("Change password error:", error);
      throw error;
    }
  };

  const updatePreferences = async (
    notificationsOrPayload?: any,
    security?: any,
  ) => {
    try {
      const hasPayloadShape =
        notificationsOrPayload &&
        typeof notificationsOrPayload === "object" &&
        !Array.isArray(notificationsOrPayload) &&
        (Object.prototype.hasOwnProperty.call(
          notificationsOrPayload,
          "notifications",
        ) ||
          Object.prototype.hasOwnProperty.call(
            notificationsOrPayload,
            "security",
          ));

      const payload = hasPayloadShape
        ? notificationsOrPayload
        : { notifications: notificationsOrPayload, security };

      const result = await apiClient.put<{ preferences: any }>(
        "/auth/preferences",
        payload,
      );

      if (user) {
        const updatedUser = { ...user, preferences: result.preferences };
        setUser(updatedUser);
      }

      return result.preferences;
    } catch (error) {
      console.error("Update preferences error:", error);
      throw error;
    }
  };

  const getApiKeys = async () => {
    try {
      const result = await apiClient.get<{ apiKeys: any[] }>("/auth/api-keys");
      return result.apiKeys;
    } catch (error) {
      console.error("Get API keys error:", error);
      throw error;
    }
  };

  const createApiKey = async (name: string) => {
    try {
      const result = await apiClient.post<{ apiKey: any }>("/auth/api-keys", {
        name,
      });
      return result.apiKey;
    } catch (error) {
      console.error("Create API key error:", error);
      throw error;
    }
  };

  const revokeApiKey = async (id: string) => {
    try {
      const result = await apiClient.delete(`/auth/api-keys/${id}`);
      return result;
    } catch (error) {
      console.error("Revoke API key error:", error);
      throw error;
    }
  };

  const setup2FA = async () => {
    try {
      const result = await apiClient.post<{ secret: string; qrCode: string }>(
        "/auth/2fa/setup",
      );
      return result;
    } catch (error) {
      console.error("Setup 2FA error:", error);
      throw error;
    }
  };

  const verify2FA = async (otpToken: string) => {
    try {
      await apiClient.post("/auth/2fa/verify", { token: otpToken });

      if (user) {
        const updatedUser = { ...user, twoFactorEnabled: true };
        setUser(updatedUser);
        syncImpersonationSession(token, updatedUser);
      }
    } catch (error) {
      console.error("Verify 2FA error:", error);
      throw error;
    }
  };

  const disable2FA = async () => {
    try {
      await apiClient.post("/auth/2fa/disable");

      if (user) {
        const updatedUser = { ...user, twoFactorEnabled: false };
        setUser(updatedUser);
        syncImpersonationSession(token, updatedUser);
      }
    } catch (error) {
      console.error("Disable 2FA error:", error);
      throw error;
    }
  };

  const switchOrganization = async (orgId: string) => {
    try {
      const data = await apiClient.post<{ user: User }>(
        "/auth/switch-organization",
        { organizationId: orgId },
      );

      const updatedUser = data.user;
      setUser(updatedUser);
      syncImpersonationSession(token, updatedUser);
      if (updatedUser.organizationId) {
        try { sessionStorage.setItem("skypanel_org_id", updatedUser.organizationId); } catch { /* ignore */ }
      }
    } catch (error) {
      console.error("Switch organization error:", error);
      throw error;
    }
  }

  const value = {
    user,
    token,
    loading,
    isImpersonating,
    login,
    register,
    logout,
    refreshToken,
    updateProfile,
    changePassword,
    updatePreferences,
    verifyPassword,
    getApiKeys,
    createApiKey,
    revokeApiKey,
    setup2FA,
    verify2FA,
    disable2FA,
    switchOrganization,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export { AuthContext };
