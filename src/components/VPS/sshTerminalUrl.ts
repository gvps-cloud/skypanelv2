interface BuildSshWebSocketUrlOptions {
  runtimeConfig?: AppRuntimeConfig;
  locationOrigin?: string;
  locationProtocol?: string;
}

function getDefaultRuntimeConfig(): AppRuntimeConfig | undefined {
  return typeof window === "undefined" ? undefined : window.__APP_RUNTIME_CONFIG__;
}

function getDefaultLocationOrigin(): string | undefined {
  return typeof window === "undefined" ? undefined : window.location.origin;
}

function getDefaultLocationProtocol(): string {
  return typeof window === "undefined" ? "http:" : window.location.protocol;
}

function normalizeOrigin(origin: string | undefined): string | null {
  if (!origin) return null;

  try {
    return new URL(origin).origin;
  } catch (err) {
    console.warn("Ignoring invalid SSH websocket origin:", err);
    return null;
  }
}

function getSshHttpOrigin(options: BuildSshWebSocketUrlOptions = {}): string {
  const browserOrigin = normalizeOrigin(
    options.locationOrigin ?? getDefaultLocationOrigin(),
  );
  if (browserOrigin) return browserOrigin;

  const runtimeConfig = options.runtimeConfig ?? getDefaultRuntimeConfig();
  const configuredOrigin = normalizeOrigin(
    runtimeConfig?.PUBLIC_ORIGIN || runtimeConfig?.CLIENT_URL,
  );
  if (configuredOrigin) return configuredOrigin;

  return "http://localhost";
}

export function buildSshWebSocketUrl(
  instanceId: string,
  rows: number,
  cols: number,
  options: BuildSshWebSocketUrlOptions = {},
): string {
  const url = new URL(
    `/api/vps/${encodeURIComponent(instanceId)}/ssh`,
    getSshHttpOrigin(options),
  );
  const locationProtocol = options.locationProtocol ?? getDefaultLocationProtocol();
  const isHttps = url.protocol === "https:" || locationProtocol === "https:";

  url.protocol = isHttps ? "wss:" : "ws:";
  url.searchParams.set("rows", String(rows));
  url.searchParams.set("cols", String(cols));

  return url.toString();
}
