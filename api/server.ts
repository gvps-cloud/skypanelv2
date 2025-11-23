/**
 * local server entry file, for local development
 * Updated to trigger restart
 */
import app from "./app.js";
import { initSSHBridge } from "./services/sshBridge.js";
import { BillingService } from "./services/billingService.js";
import { PaaSWorkerService } from "./services/paasWorkerService.js";

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  // Initialize websocket SSH bridge on same HTTP server
  initSSHBridge(server);

  // Auto-discover PaaS workers on startup (async, non-blocking)
  setTimeout(() => {
    void discoverPaaSWorkers();
  }, 2000); // Wait 2 seconds for server to stabilize

  // Start hourly billing scheduler
  startBillingScheduler();
});

/**
 * Auto-discover PaaS workers from uncloud on startup
 */
async function discoverPaaSWorkers() {
  try {
    console.log("🔍 Auto-discovering PaaS workers from uncloud...");
    const result = await PaaSWorkerService.discoverAndRegisterWorkers();
    if (result.registered > 0) {
      console.log(`✅ Discovered and registered ${result.registered} worker(s)`);
    } else if (result.discovered > 0) {
      console.log(`ℹ️  Found ${result.discovered} worker(s) (already registered)`);
    } else {
      console.log("ℹ️  No uncloud workers found");
    }
  } catch (error) {
    console.error("⚠️  Failed to auto-discover workers:", error);
    // Don't crash the server if discovery fails
  }
}

/**
 * Start the hourly billing scheduler
 */
function startBillingScheduler() {
  console.log("🕐 Starting hourly VPS billing scheduler...");

  // Run billing immediately on startup (for any missed billing)
  setTimeout(async () => {
    await runHourlyBilling("initial");
  }, 5000); // Wait 5 seconds after server start

  // Schedule hourly billing (every hour)
  setInterval(async () => {
    await runHourlyBilling("scheduled");
  }, 60 * 60 * 1000); // Run every hour (3600000 ms)
}

/**
 * Run hourly billing for all active VPS instances
 */
async function runHourlyBilling(runType: "initial" | "scheduled") {
  try {
    console.log(`🔄 Starting ${runType} hourly VPS billing process...`);
    const result = await BillingService.runHourlyBilling();
    console.log(
      `✅ Billing completed: ${
        result.billedInstances
      } instances billed, $${result.totalAmount.toFixed(2)} total`
    );

    if (result.failedInstances.length > 0) {
      console.warn(
        `⚠️ ${result.failedInstances.length} instances failed billing:`,
        result.errors
      );
    }
  } catch (error) {
    console.error(`❌ Error in ${runType} billing:`, error);
  }
}

/**
 * close server
 */
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

export default app;
