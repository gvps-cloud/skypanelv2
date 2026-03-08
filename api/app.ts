/**
 * SkyPanelV2 API Server
 */

// Load environment variables FIRST before any other imports
// ONLY if not in Docker (Docker passes env vars directly)
import dotenv from "dotenv";
if (!process.env.IN_DOCKER) {
  dotenv.config();
}

import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import helmet from "helmet";
import {
  smartRateLimit,
  addRateLimitHeaders,
} from "./middleware/rateLimiting.js";
import { config, validateConfig } from "./config/index.js";
import authRoutes from "./routes/auth.js";
import paymentRoutes from "./routes/payments.js";
import adminRoutes from "./routes/admin.js";
import vpsRoutes from "./routes/vps.js";
import supportRoutes from "./routes/support.js";
import activityRoutes from "./routes/activity.js";
import invoicesRouter from "./routes/invoices.js";
import notificationsRouter from "./routes/notifications.js";
import themeRoutes from "./routes/theme.js";
import healthRoutes from "./routes/health.js";
import contactRouter from "./routes/contact.js";
import adminPlatformRoutes from "./routes/admin/platform.js";
import adminCategoryMappingsRoutes from "./routes/admin/categoryMappings.js";
import faqRoutes from "./routes/faq.js";
import sshKeysRoutes from "./routes/sshKeys.js";
import organizationRoutes from "./routes/organizations.js";
import pricingRoutes from "./routes/pricing.js";
import adminFaqRoutes from "./routes/adminFaq.js";
import adminContactRoutes from "./routes/admin/contact.js";
import adminBillingRoutes from "./routes/admin/billing.js";
import githubRoutes from "./routes/github.js";
import {
  initializeMetricsCollection,
  startMetricsPersistence,
} from "./services/rateLimitMetrics.js";
import { BillingCronService } from "./services/billingCronService.js";

// for esm mode

// Validate configuration
validateConfig();

const app = express();
app.set("trust proxy", config.rateLimiting.trustProxy);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientBuildPath = path.resolve(__dirname, "../dist");
const clientIndexFile = path.join(clientBuildPath, "index.html");

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  }),
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting (API routes only)
app.use("/api", addRateLimitHeaders);
app.use("/api", smartRateLimit);

// Initialize metrics
initializeMetricsCollection();
startMetricsPersistence();
BillingCronService.start();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/platform", adminPlatformRoutes);
app.use("/api/admin", adminCategoryMappingsRoutes);
app.use("/api/vps", vpsRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/invoices", invoicesRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/theme", themeRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/contact", contactRouter);
app.use("/api/admin/contact", adminContactRoutes);
app.use("/api/admin/billing", adminBillingRoutes);
app.use("/api/faq", faqRoutes);
app.use("/api/admin/faq", adminFaqRoutes);
app.use("/api/admin/github", githubRoutes);
app.use("/api/ssh-keys", sshKeysRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/pricing", pricingRoutes);

// Health check routes are now handled by the dedicated health router

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  void _next;
  // Log full error details server-side
  console.error("API error:", error);
  const isDev = process.env.NODE_ENV !== "production";
  res.status(500).json({
    success: false,
    error: isDev
      ? error?.message || "Server internal error"
      : "Server internal error",
  });
});

/**
 * 404 handler
 */
if (process.env.NODE_ENV === "production") {
  // Serve the built frontend from /dist when running in production
  app.use(express.static(clientBuildPath));

  app.get("*", (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api/")) {
      return next();
    }

    res.sendFile(clientIndexFile, (err) => {
      if (err) {
        next(err);
      }
    });
  });
}

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: "API not found",
  });
});

export default app;
