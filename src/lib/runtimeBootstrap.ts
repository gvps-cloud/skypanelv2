interface AppRuntimeConfig {
  VITE_RYBBIT_SCRIPT_URL?: string;
  VITE_TRACKING_SCRIPT_URL?: string;
  VITE_RYBBIT_SITE_ID?: string;
  VITE_RYBBIT_API_KEY?: string;
  VITE_RYBBIT_TRACK_ERRORS?: boolean | string;
  VITE_RYBBIT_SESSION_REPLAY?: boolean | string;
}

declare global {
  interface Window {
    __APP_RUNTIME_CONFIG__?: AppRuntimeConfig;
  }
}

const truthyValues = new Set(["1", "true", "yes", "on"]);
const falsyValues = new Set(["0", "false", "no", "off"]);

function sanitizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readString(...values: Array<unknown>): string {
  return values.map(sanitizeString).find((value) => value.length > 0) || "";
}

function readBoolean(fallback: boolean, ...values: Array<unknown>): boolean {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }

    const normalizedValue = sanitizeString(value).toLowerCase();
    if (!normalizedValue) {
      continue;
    }

    if (truthyValues.has(normalizedValue)) {
      return true;
    }

    if (falsyValues.has(normalizedValue)) {
      return false;
    }
  }

  return fallback;
}

function registerViteErrorLogger(): void {
  if (!import.meta.hot?.on) {
    return;
  }

  import.meta.hot.on("vite:error", (payload: unknown) => {
    const error = (payload as { err?: { message?: string; frame?: string } })?.err;
    if (!error) {
      return;
    }

    console.error([error.message, error.frame].filter(Boolean).join("\n"));
  });
}

function registerTrackingScript(): void {
  const runtimeConfig = window.__APP_RUNTIME_CONFIG__ || {};
  const env = import.meta.env;
  const scriptId = "gvps-rybbit-script";
  const scriptSrc = readString(
    runtimeConfig.VITE_RYBBIT_SCRIPT_URL,
    runtimeConfig.VITE_TRACKING_SCRIPT_URL,
    env.VITE_RYBBIT_SCRIPT_URL,
    env.VITE_TRACKING_SCRIPT_URL,
  );
  const siteId = readString(
    runtimeConfig.VITE_RYBBIT_SITE_ID,
    env.VITE_RYBBIT_SITE_ID,
  );
  const apiKey = readString(
    runtimeConfig.VITE_RYBBIT_API_KEY,
    env.VITE_RYBBIT_API_KEY,
  );

  if (!scriptSrc || !siteId || document.getElementById(scriptId)) {
    return;
  }

  const script = document.createElement("script");
  script.id = scriptId;
  script.src = scriptSrc;
  script.defer = true;
  script.dataset.siteId = siteId;

  if (apiKey) {
    script.dataset.apiKey = apiKey;
  }

  if (
    readBoolean(
      true,
      runtimeConfig.VITE_RYBBIT_TRACK_ERRORS,
      env.VITE_RYBBIT_TRACK_ERRORS,
    )
  ) {
    script.dataset.trackErrors = "true";
  }

  if (
    readBoolean(
      true,
      runtimeConfig.VITE_RYBBIT_SESSION_REPLAY,
      env.VITE_RYBBIT_SESSION_REPLAY,
    )
  ) {
    script.dataset.sessionReplay = "true";
  }

  document.head.appendChild(script);
}

registerViteErrorLogger();
registerTrackingScript();

export {};
