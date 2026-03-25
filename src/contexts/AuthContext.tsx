/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from "react";

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
  login: (email: string, password: string, code?: string) => Promise<any>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
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

// Check if token is expired
const isTokenExpired = (token: string): boolean => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    const decoded = JSON.parse(jsonPayload);

    if (decoded.exp) {
      // JWT exp is in seconds, Date.now() is in milliseconds
      const expirationTime = decoded.exp * 1000;
      return Date.now() >= expirationTime;
    }

    return false;
  } catch {
    return true; // If we can't decode, assume expired
  }
};

/**
 * Get authentication token from multiple sources
 * Priority: localStorage > cookies
 * This supports both traditional localStorage auth and HttpOnly cookie auth
 */
const getAuthToken = (): string | null => {
  // First, try localStorage (existing implementation)
  const localToken = localStorage.getItem("auth_token");
  if (localToken && !isTokenExpired(localToken)) {
    return localToken;
  }

  // Fallback: try to read from document.cookie
  // Note: This only works for non-HttpOnly cookies
  // HttpOnly cookies are sent automatically with requests
  const cookies = document.cookie.split(";");
  const authCookie = cookies.find((cookie) =>
    cookie.trim().startsWith("auth_token=")
  );

  if (authCookie) {
    const tokenValue = authCookie.split("=")[1]?.trim();
    if (tokenValue && !isTokenExpired(tokenValue)) {
      // Store in localStorage for consistency
      localStorage.setItem("auth_token", tokenValue);
      return tokenValue;
    }
  }

  return null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsImpersonating(false);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
  };

  const refreshToken = async (currentToken?: string) => {
    try {
      const tokenToUse = currentToken || token;
      if (!tokenToUse) {
        throw new Error("No token available");
      }

      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenToUse}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Token refresh failed");
      }

      const data = await response.json();

      setToken(data.token);
      localStorage.setItem("auth_token", data.token);

      // Update user data if returned from refresh
      if (data.user) {
        setUser(data.user);
        localStorage.setItem("auth_user", JSON.stringify(data.user));
      }
    } catch (error) {
      console.error("Token refresh error:", error);
      logout(); // If refresh fails, logout the user
      throw error;
    }
  };

  const verifyPassword = async (password: string) => {
    try {
      if (!token) throw new Error("Not authenticated");
      const response = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Incorrect password");
      }

      return true;
    } catch (error) {
      console.error("Verify password error:", error);
      throw error;
    }
  };

  useEffect(() => {
    // Check for existing token using multi-source token retrieval
    const storedToken = getAuthToken();
    const storedUser = localStorage.getItem("auth_user");

    if (storedToken && storedUser) {
      // Check if token is expired
      if (isTokenExpired(storedToken)) {
        logout();
        window.location.href = "/";
        setLoading(false);
        return;
      }

      setToken(storedToken);
      setUser(JSON.parse(storedUser));

      // Check if this is an impersonation token
      try {
        const base64Url = storedToken.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join(""),
        );
        const decoded = JSON.parse(jsonPayload);
        setIsImpersonating(Boolean(decoded?.isImpersonating));
      } catch {
        setIsImpersonating(false);
      }

      // Automatically refresh user data (and ensure org membership) on load
      refreshToken(storedToken).catch((err) => {
        console.warn("Background refresh failed on load:", err);
        // We don't necessarily want to logout here if it's just a network blip,
        // but refreshToken already calls logout on error.
      });
    }

    setLoading(false);

    // Set up periodic token expiration check (every minute)
    const tokenCheckInterval = setInterval(() => {
      const currentToken = getAuthToken();
      if (currentToken && isTokenExpired(currentToken)) {
        logout();
        window.location.href = "/";
      }
    }, 60000); // Check every 60 seconds

    return () => {
      clearInterval(tokenCheckInterval);
    };
  // We intentionally run this only once on mount to hydrate auth state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string, code?: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, code }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Login failed");
      }

      const data = await response.json();

      if (data.require2fa) {
        return { require2fa: true };
      }

      setUser(data.user);
      setToken(data.token);

      // Store in localStorage
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));

      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Registration failed");
      }

      const result = await response.json();

      setUser(result.user);
      setToken(result.token);

      // Store in localStorage
      localStorage.setItem("auth_token", result.token);
      localStorage.setItem("auth_user", JSON.stringify(result.user));
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
      if (!token) throw new Error("Not authenticated");
      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update profile");
      }
      setUser(result.user);
      localStorage.setItem("auth_user", JSON.stringify(result.user));
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
      if (!token) throw new Error("Not authenticated");
      const response = await fetch("/api/auth/password", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to change password");
      }
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
      if (!token) throw new Error("Not authenticated");

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

      const response = await fetch("/api/auth/preferences", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update preferences");
      }

      // Update local user state
      if (user) {
        const updatedUser = { ...user, preferences: result.preferences };
        setUser(updatedUser);
        localStorage.setItem("auth_user", JSON.stringify(updatedUser));
      }

      return result.preferences;
    } catch (error) {
      console.error("Update preferences error:", error);
      throw error;
    }
  };

  const getApiKeys = async () => {
    try {
      if (!token) throw new Error("Not authenticated");
      const response = await fetch("/api/auth/api-keys", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch API keys");
      }
      return result.apiKeys;
    } catch (error) {
      console.error("Get API keys error:", error);
      throw error;
    }
  };

  const createApiKey = async (name: string) => {
    try {
      if (!token) throw new Error("Not authenticated");
      const response = await fetch("/api/auth/api-keys", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to create API key");
      }
      return result.apiKey;
    } catch (error) {
      console.error("Create API key error:", error);
      throw error;
    }
  };

  const revokeApiKey = async (id: string) => {
    try {
      if (!token) throw new Error("Not authenticated");
      const response = await fetch(`/api/auth/api-keys/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to revoke API key");
      }
      return result;
    } catch (error) {
      console.error("Revoke API key error:", error);
      throw error;
    }
  };

  const setup2FA = async () => {
    try {
      if (!token) throw new Error("Not authenticated");
      const response = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to setup 2FA");
      return result;
    } catch (error) {
      console.error("Setup 2FA error:", error);
      throw error;
    }
  };

  const verify2FA = async (otpToken: string) => {
    try {
      if (!token) throw new Error("Not authenticated");
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: otpToken }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to verify 2FA");

      // Update local user state
      if (user) {
        const updatedUser = { ...user, twoFactorEnabled: true };
        setUser(updatedUser);
        localStorage.setItem("auth_user", JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error("Verify 2FA error:", error);
      throw error;
    }
  };

  const disable2FA = async () => {
    try {
      if (!token) throw new Error("Not authenticated");
      const response = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Failed to disable 2FA");

      // Update local user state
      if (user) {
        const updatedUser = { ...user, twoFactorEnabled: false };
        setUser(updatedUser);
        localStorage.setItem("auth_user", JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error("Disable 2FA error:", error);
      throw error;
    }
  };

  const switchOrganization = async (orgId: string) => {
      if (!user || !token) return;

      try {
        // Call backend API to persist organization context
        const response = await fetch("/api/auth/switch-organization", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ organizationId: orgId }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to switch organization context");
        }

        const data = await response.json();

        // Update local state with the returned user object
        const updatedUser = data.user;
        setUser(updatedUser);
        localStorage.setItem("auth_user", JSON.stringify(updatedUser));
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
