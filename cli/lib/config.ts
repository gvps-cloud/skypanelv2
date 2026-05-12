import { config as loadEnv } from "dotenv";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env");
loadEnv({ path: envPath, override: false });

export interface SkyPanelConfig {
  apiUrl: string;
  apiToken: string;
}

function normalizeApiUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed.replace(/\/api$/i, "");
}

export function loadConfig(): SkyPanelConfig {
  const apiUrl = normalizeApiUrl(
    process.env.SKYPANEL_API_URL || "http://localhost:3001"
  );
  const apiToken = (process.env.SKYPANEL_API_TOKEN || "").trim();
  return { apiUrl, apiToken };
}

export function validateConfig(cfg: SkyPanelConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!cfg.apiToken) {
    errors.push("SKYPANEL_API_TOKEN is not set.");
  }
  if (!cfg.apiUrl || !/^https?:\/\//.test(cfg.apiUrl)) {
    errors.push("SKYPANEL_API_URL must be a valid HTTP(S) URL.");
  }
  return { valid: errors.length === 0, errors };
}

export function printSetupHelp(errors: string[]): void {
  console.error("\n  SkyPanel CLI — Configuration Error\n");
  for (const err of errors) {
    console.error(`  \u2717 ${err}`);
  }
  console.error(`
  Set environment variables:

    SKYPANEL_API_URL=http://localhost:3001
    SKYPANEL_API_TOKEN=your-admin-jwt-or-sk_live-api-key

  The token must belong to an admin user. API keys can be created from
  /settings while logged in as an admin.
`);
}
