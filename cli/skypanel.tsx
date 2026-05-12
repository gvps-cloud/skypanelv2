#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import React from "react";
import { loadConfig, validateConfig, printSetupHelp } from "./lib/config.js";
import { testConnection } from "./lib/client.js";
import { App } from "./components/App.js";

async function main() {
  const cfg = loadConfig();
  const validation = validateConfig(cfg);
  if (!validation.valid) {
    printSetupHelp(validation.errors);
    process.exit(1);
  }

  process.stdout.write("Connecting to SkyPanel API... ");
  const conn = await testConnection();
  if (!conn.ok) {
    console.error(`\n  \u2717 ${conn.error}`);
    console.error(`  URL: ${conn.url || cfg.apiUrl}`);
    process.exit(1);
  }
  console.log(`\u2713 ${conn.user?.email || "connected"}`);

  const renderer = await createCliRenderer();

  const root = createRoot(renderer);
  root.render(
    <App user={{ email: conn.user!.email, role: conn.user!.role }} />
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
