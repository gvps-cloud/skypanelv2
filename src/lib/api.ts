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
    let organizationId: string | undefined;
    try {
      organizationId = sessionStorage.getItem("skypanel_org_id") ?? undefined;
    } catch {
      // sessionStorage unavailable
    }

    const csrfToken = this.getCsrfToken();
    return {
      "Content-Type": "application/json",
      ...(csrfToken && { "X-CSRF-Token": csrfToken }),
      ...(organizationId && { "X-Organization-ID": organizationId }),
    };
  }

  /**
   * 401 is used both for invalid credentials (login) and for expired/invalid sessions.
   * Only the latter should trigger global logout + hard redirect to home.
   */
  private shouldSkip401SessionExpiredRedirect(
    response: Response,
    apiErrorString: string | undefined,
  ): boolean {
    let pathname = "";
    try {
      pathname = new URL(response.url).pathname;
    } catch {
      return false;
    }

    if (pathname.endsWith("/auth/login") || pathname.endsWith("/auth/logout") || pathname.endsWith("/auth/register")) {
      return true;
    }

    if (
      pathname.endsWith("/auth/verify-password") &&
      apiErrorString === "Incorrect password"
    ) {
      return true;
    }

    return false;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let apiErrorString: string | undefined;

      try {
        const errorData = JSON.parse(errorText) as Record<string, unknown>;
        apiErrorString =
          typeof errorData.error === "string" ? errorData.error : undefined;

        const validationMsgs = Array.isArray(errorData.errors)
          ? (errorData.errors as unknown[])
              .map((entry) =>
                entry &&
                typeof entry === "object" &&
                typeof (entry as { msg?: string }).msg === "string"
                  ? (entry as { msg: string }).msg
                  : "",
              )
              .filter(Boolean)
          : [];

        const nestedMessage =
          (validationMsgs.length > 0 ? validationMsgs.join(" ") : "") ||
          (typeof errorData.message === "string" && errorData.message) ||
          apiErrorString ||
          (typeof errorData.error === "object" &&
            errorData.error !== null &&
            typeof (errorData.error as { message?: string }).message === "string" &&
            (errorData.error as { message: string }).message) ||
          errorMessage;

        const codeSuffix =
          typeof errorData.error === "object" &&
          errorData.error !== null &&
          typeof (errorData.error as { code?: string }).code === "string"
            ? ` (${(errorData.error as { code: string }).code})`
            : "";

        errorMessage = `${nestedMessage}${codeSuffix}`.trim();
      } catch {
        // If not JSON, use the text as error message
        errorMessage = errorText || errorMessage;
      }

      if (response.status === 401) {
        const skipRedirect = this.shouldSkip401SessionExpiredRedirect(
          response,
          apiErrorString,
        );

        if (!skipRedirect) {
          const logoutCallback = (window as any).__autoLogoutCallback;

          if (logoutCallback) {
            logoutCallback();
            window.location.href = "/";
          }
        }
      }

      const error = new Error(errorMessage);
      (error as any).status = response.status;
      (error as any).statusText = response.statusText;
      throw error;
    }

    const responseText = await response.text();
    if (!responseText.trim()) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return JSON.parse(responseText) as T;
    }

    return responseText as unknown as T;
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

  async getBlob(path: string): Promise<{ blob: Blob; filename?: string }> {
    const url = buildApiUrl(path);
    const headers = this.getAuthHeaders() as Record<string, string>;
    delete headers["Content-Type"];

    const response = await fetch(url, {
      method: "GET",
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      await this.handleResponse(response);
    }

    const disposition = response.headers.get("content-disposition") ?? "";
    const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
    const filename = filenameMatch?.[1]
      ? decodeURIComponent(filenameMatch[1])
      : filenameMatch?.[2];

    return {
      blob: await response.blob(),
      filename,
    };
  }

  async postBinary<T = any>(path: string, data: Blob | ArrayBuffer, contentType = "application/octet-stream"): Promise<T> {
    const url = buildApiUrl(path);
    const headers = this.getAuthHeaders() as Record<string, string>;
    headers["Content-Type"] = contentType;

    const response = await fetch(url, {
      method: "POST",
      headers,
      credentials: "include",
      body: data,
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
