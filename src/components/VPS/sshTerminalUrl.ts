interface BuildSshWebSocketUrlOptions {
  runtimeConfig?: AppRuntimeConfig;
  locationOrigin?: string;
  locationProtocol?: string;
}

function getDefaultRuntimeConfig(): AppRuntimeConfig | undefined {
  return typeof window === "undefined" ? undefined : window.__APP_RUNTIME_CONFIG__;
}

function getDefaultLocationOrigin(): string {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin;
}

function getDefaultLocationProtocol(): string {
  return typeof window === "undefined" ? "http:" : window.location.protocol;
}

function getRuntimePublicOrigin(options: BuildSshWebSocketUrlOptions = {}): string {
  const runtimeConfig = options.runtimeConfig ?? getDefaultRuntimeConfig();
  const configuredOrigin = runtimeConfig?.PUBLIC_ORIGIN || runtimeConfig?.CLIENT_URL;
  const fallbackOrigin = options.locationOrigin ?? getDefaultLocationOrigin();

  if (configuredOrigin) {
    try {
      return new URL(configuredOrigin).origin;
    } catch (err) {
      console.warn("Ignoring invalid runtime public origin:", err);
    }
  }

  return fallbackOrigin;
}

export function buildSshWebSocketUrl(
  instanceId: string,
  rows: number,
  cols: number,
  options: BuildSshWebSocketUrlOptions = {},
): string {
  const url = new URL(
    `/api/vps/${encodeURIComponent(instanceId)}/ssh`,
    getRuntimePublicOrigin(options),
  );
  const locationProtocol = options.locationProtocol ?? getDefaultLocationProtocol();
  const isHttps = url.protocol === "https:" || locationProtocol === "https:";

  url.protocol = isHttps ? "wss:" : "ws:";
  url.searchParams.set("rows", String(rows));
  url.searchParams.set("cols", String(cols));

  return url.toString();
}
