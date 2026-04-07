/**
 * API Docs Try It - Request execution utility
 * Handles API key authentication and request execution for the interactive API docs
 */

export interface ExecuteRequestOptions {
  method: string;
  url: string;
  body?: unknown;
  params?: Record<string, string>;
  apiKey: string;
  organizationId?: string;
}

export interface ExecuteRequestResult {
  status: number;
  statusText: string;
  data: unknown;
  duration: number;
  headers: Record<string, string>;
  error?: string;
}

/**
 * Execute an API request with API key authentication
 */
export async function executeRequest(options: ExecuteRequestOptions): Promise<ExecuteRequestResult> {
  const { method, url, body, apiKey, organizationId } = options;
  const startTime = performance.now();

  try {
    const headers: Record<string, string> = {
      "Accept": "application/json",
    };

    if (apiKey) {
      headers["X-API-Key"] = apiKey;
    }

    if (organizationId) {
      headers["X-Organization-ID"] = organizationId;
    }

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include", // Include cookies for potential JWT fallback
    });

    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    // Extract response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Parse response body
    let data: unknown;
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch {
        data = await response.text();
      }
    } else if (contentType.includes("text/")) {
      data = await response.text();
    } else {
      // For binary responses, just indicate the type
      data = `[Binary data: ${contentType}]`;
    }

    return {
      status: response.status,
      statusText: response.statusText,
      data,
      duration,
      headers: responseHeaders,
    };
  } catch (error) {
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    // Handle network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return {
        status: 0,
        statusText: "Network Error",
        data: null,
        duration,
        headers: {},
        error: "Unable to connect to the server. Please check your network connection.",
      };
    }

    return {
      status: 0,
      statusText: "Error",
      data: null,
      duration,
      headers: {},
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

/**
 * Validate an API key by making a test request
 */
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  if (!apiKey || !apiKey.startsWith("sk_live_")) {
    return { valid: false, error: "Invalid API key format. Must start with sk_live_" };
  }

  try {
    // Use /api/auth/me as a lightweight validation endpoint
    const apiBase = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
    const response = await fetch(`${apiBase}/auth/me`, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
        "Accept": "application/json",
      },
    });

    if (response.status === 401) {
      return { valid: false, error: "Invalid API key or key has been revoked" };
    }

    if (response.status === 200) {
      return { valid: true };
    }

    // Other status codes might indicate server issues, but key might still be valid
    if (response.status >= 500) {
      return { valid: false, error: "Server error during validation. Please try again." };
    }

    // For other 2xx/3xx responses, consider the key valid
    if (response.status >= 200 && response.status < 400) {
      return { valid: true };
    }

    return { valid: false, error: `Unexpected response: ${response.status}` };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Validation failed",
    };
  }
}

/**
 * Build a URL with query parameters
 */
export function buildUrl(base: string, path: string, params?: Record<string, string>): string {
  const url = `${base}${path}`;

  if (!params || Object.keys(params).length === 0) {
    return url;
  }

  const queryString = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  return queryString ? `${url}?${queryString}` : url;
}

/**
 * Format a JSON value for display
 */
export function formatJson(value: unknown, indent = 2): string {
  try {
    return JSON.stringify(value, null, indent);
  } catch {
    return String(value);
  }
}

/**
 * Check if an endpoint requires authentication
 */
export function requiresAuth(endpoint: { auth?: boolean; method: string; path: string }): boolean {
  // Explicitly marked as auth required
  if (endpoint.auth === true) {
    return true;
  }

  // Public endpoints
  const publicPaths = [
    "/api/health",
    "/api/pricing",
    "/api/faq",
    "/api/contact",
    "/api/theme",
    "/api/documentation",
  ];

  // Check if path starts with any public path
  for (const publicPath of publicPaths) {
    if (endpoint.path.startsWith(publicPath)) {
      return false;
    }
  }

  // Auth endpoints are public (login, register, etc.)
  if (endpoint.path.startsWith("/api/auth/")) {
    const publicAuthEndpoints = [
      "/api/auth/login",
      "/api/auth/register",
      "/api/auth/forgot-password",
      "/api/auth/reset-password",
      "/api/auth/verify-email",
    ];
    return !publicAuthEndpoints.some((p) => endpoint.path === p);
  }

  // Default to requiring auth
  return true;
}
