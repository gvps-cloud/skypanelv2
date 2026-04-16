/**
 * Generic API client for SkyPanelV2 frontend.
 *
 * Provides:
 *  - `API_BASE_URL` and `buildApiUrl()` for constructing endpoint URLs
 *  - `ApiClient` / `apiClient` / default `api` for HTTP calls that automatically
 *    attach the CSRF token, `X-Organization-ID` header, and `credentials: "include"`
 *    (HttpOnly `auth_token` cookie auth)
 *  - `setupAutoLogout()` to wire 401 handling to the global auth context
 *
 * Payment-specific client code lives in `src/services/paymentService.ts`.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

// Export API_BASE_URL for use in other modules
export { API_BASE_URL };

/**
 * Builds a complete API URL from a path
 * @param path - The API endpoint path
 * @param baseUrl - Optional base URL (defaults to API_BASE_URL)
 * @returns Complete API URL
 */
export function buildApiUrl(path: string, baseUrl?: string): string {
  const base = (baseUrl || API_BASE_URL || "").trim();

  // If path already starts with the base URL or is fully qualified, leave it
  if (base && path.startsWith(base)) {
    return path;
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  // Normalize trailing slash on the base to simplify joining logic
  const normalizedBase =
    base.length > 1 && base.endsWith("/") ? base.slice(0, -1) : base;

  let normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // When both base and path already contain `/api`, avoid duplicating the segment
  if (
    normalizedBase &&
    normalizedBase.endsWith("/api") &&
    normalizedPath.startsWith("/api/")
  ) {
    normalizedPath = normalizedPath.slice(4);
    if (!normalizedPath.startsWith("/")) {
      normalizedPath = `/${normalizedPath}`;
    }
  }

  if (!normalizedBase) {
    return normalizedPath;
  }

  return `${normalizedBase}${normalizedPath}`;
}

/**
 * Generic API Client for making HTTP requests
 * Handles authentication, JSON parsing, and error handling
 */
class ApiClient {
  private getCsrfToken(): string | null {
    const cookie = document.cookie
      .split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith("csrf_token="));
    if (!cookie) {
      return null;
    }
    const value = cookie.split("=")[1];
    return value ? decodeURIComponent(value) : null;
  }

  private getAuthHeaders(): HeadersInit {
    const userStr = localStorage.getItem("auth_user");
    let organizationId: string | undefined;
    
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        organizationId = user.organizationId;
      } catch {
        // ignore
      }
    }

    const csrfToken = this.getCsrfToken();
    return {
      "Content-Type": "application/json",
      ...(csrfToken && { "X-CSRF-Token": csrfToken }),
      ...(organizationId && { "X-Organization-ID": organizationId }),
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      // Handle 401 Unauthorized - token expired or invalid
      if (response.status === 401) {
        const logoutCallback = (window as any).__autoLogoutCallback;

        if (logoutCallback) {
          logoutCallback();
          window.location.href = "/";
        }
      }

      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorData = JSON.parse(errorText);
        const nestedMessage =
          (typeof errorData?.message === "string" && errorData.message) ||
          (typeof errorData?.error === "string" && errorData.error) ||
          (typeof errorData?.error?.message === "string" && errorData.error.message) ||
          errorMessage;

        const codeSuffix =
          typeof errorData?.error?.code === "string"
            ? ` (${errorData.error.code})`
            : "";

        errorMessage = `${nestedMessage}${codeSuffix}`.trim();
      } catch {
        // If not JSON, use the text as error message
        errorMessage = errorText || errorMessage;
      }

      const error = new Error(errorMessage);
      (error as any).status = response.status;
      (error as any).statusText = response.statusText;
      throw error;
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return response.json();
    }

    // For non-JSON responses, return the text
    return response.text() as unknown as T;
  }

  async get<T = any>(path: string): Promise<T> {
    const url = buildApiUrl(path);
    const response = await fetch(url, {
      method: "GET",
      headers: this.getAuthHeaders(),
      credentials: "include",
    });
    return this.handleResponse<T>(response);
  }

  async post<T = any>(path: string, data?: any): Promise<T> {
    const url = buildApiUrl(path);
    const response = await fetch(url, {
      method: "POST",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async put<T = any>(path: string, data?: any): Promise<T> {
    const url = buildApiUrl(path);
    const response = await fetch(url, {
      method: "PUT",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async patch<T = any>(path: string, data?: any): Promise<T> {
    const url = buildApiUrl(path);
    const response = await fetch(url, {
      method: "PATCH",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async delete<T = any>(path: string, body?: any): Promise<T> {
    const url = buildApiUrl(path);
    const response = await fetch(url, {
      method: "DELETE",
      headers: this.getAuthHeaders(),
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(response);
  }
}

/**
 * Setup auto-logout on token expiration
 * This function should be called once during app initialization
 */
export function setupAutoLogout(logoutCallback: () => void | Promise<void>) {
  // Store the callback globally so ApiClient can access it
  (window as any).__autoLogoutCallback = logoutCallback;
}

// Create and export the API client instance
export const apiClient = new ApiClient();

// Default export for backward compatibility
const api = apiClient;
export default api;
