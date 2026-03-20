/**
 * local server entry file, for local development
 * Updated to trigger restart
 */
import app from "./app.js";
import { initSSHBridge } from "./services/sshBridge.js";
import { BillingService } from "./services/billingService.js";
import { EgressBillingService } from "./services/egressBillingService.js";
import { EgressHourlyBillingService } from "./services/egressHourlyBillingService.js";
import { notificationService } from "./services/notificationService.js";

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;
let lastScheduledEgressMonth: string | null = null;

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  // Initialize websocket SSH bridge on same HTTP server
  initSSHBridge(server);

  notificationService.start().catch((error) => {
    console.error("Failed to start notification service:", error);
  });

  // Start hourly billing scheduler
  startBillingScheduler();
});

/**
 * Start the hourly billing scheduler
 */
function startBillingScheduler() {
  console.log("🕐 Starting hourly VPS billing scheduler...");

  // Run billing immediately on startup (for any missed billing)
  setTimeout(async () => {
    await Promise.all([
      runHourlyBilling("initial"),
      runMonthlyEgressBillingIfDue("initial"),
      runHourlyEgressBilling("initial"),
    ]);
  }, 5000); // Wait 5 seconds after server start

  // Schedule hourly billing (every hour)
  setInterval(
    async () => {
      await Promise.all([
        runHourlyBilling("scheduled"),
        runMonthlyEgressBillingIfDue("scheduled"),
        runHourlyEgressBilling("scheduled"),
      ]);
    },
    60 * 60 * 1000,
  ); // Run every hour (3600000 ms)
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
      } instances billed, $${result.totalAmount.toFixed(4)} total`,
    );

    if (result.failedInstances.length > 0) {
      console.warn(
        `⚠️ ${result.failedInstances.length} instances failed billing:`,
        result.errors,
      );
    }
  } catch (error) {
    console.error(`❌ Error in ${runType} billing:`, error);
  }
}

function getPreviousBillingMonth(referenceDate = new Date()): string {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const previousMonthDate = new Date(Date.UTC(year, month - 1, 1));
  return previousMonthDate.toISOString().slice(0, 7);
}

function shouldRunMonthlyEgressBilling(now = new Date()): boolean {
  return now.getUTCDate() === 1;
}

async function runMonthlyEgressBillingIfDue(runType: "initial" | "scheduled") {
  const now = new Date();
  if (!shouldRunMonthlyEgressBilling(now)) {
    return;
  }

  const billingMonth = getPreviousBillingMonth(now);
  if (lastScheduledEgressMonth === billingMonth) {
    return;
  }

  try {
    console.log(
      `🌐 Starting ${runType} monthly egress billing finalization for ${billingMonth}...`,
    );
    await EgressBillingService.getLiveUsage(billingMonth);
    const result = await EgressBillingService.executeLiveBilling(billingMonth);
    console.log(
      `✅ Egress billing completed for ${billingMonth}: ${result.billedCount} billed, ${result.failedCount} failed, ${result.invoiceCount} invoices`,
    );
    if (result.errors.length > 0) {
      console.warn(
        `⚠️ Egress billing completed with ${result.errors.length} errors for ${billingMonth}:`,
        result.errors,
      );
    }
    lastScheduledEgressMonth = billingMonth;
  } catch (error) {
    console.error(
      `❌ Error in ${runType} monthly egress billing for ${billingMonth}:`,
      error,
    );
  }
}

/**
 * Run hourly egress billing for all active VPS instances
 * Polls Linode for transfer usage and deducts pre-paid credits
 */
async function runHourlyEgressBilling(runType: "initial" | "scheduled") {
  try {
    console.log(`🌐 Starting ${runType} hourly egress billing process...`);
    const result = await EgressHourlyBillingService.runHourlyBilling();
    console.log(
      `✅ Hourly egress billing completed: ` +
      `${result.billedCount} billed, ${result.suspendedCount} suspended, ` +
      `${result.skippedCount} skipped, ${result.errorCount} errors`,
    );

    if (result.errors.length > 0) {
      console.warn(
        `⚠️ Hourly egress billing completed with ${result.errors.length} errors:`,
        result.errors,
      );
    }
  } catch (error) {
    console.error(`❌ Error in ${runType} hourly egress billing:`, error);
  }
}

/**
 * close server
 */
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received");
  void notificationService.stop();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received");
  void notificationService.stop();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

export default app;
