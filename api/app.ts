/**
 * SkyPanelV2 API Server
 */

// Load environment variables FIRST before any other imports
// ONLY if not in Docker (Docker passes env vars directly)
import dotenv from 'dotenv'
if (!process.env.IN_DOCKER) {
  dotenv.config()
}

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import helmet from 'helmet'
import { smartRateLimit, addRateLimitHeaders } from './middleware/rateLimiting.js'
import { config, validateConfig } from './config/index.js'
import authRoutes from './routes/auth.js'
import paymentRoutes from './routes/payments.js'
import adminRoutes from './routes/admin.js'
import vpsRoutes from './routes/vps.js'
import supportRoutes from './routes/support.js'
import activityRoutes from './routes/activity.js'
import invoicesRouter from './routes/invoices.js';
import notificationsRouter from './routes/notifications.js';
import themeRoutes from './routes/theme.js';
import healthRoutes from './routes/health.js';
import contactRouter from './routes/contact.js';
import adminPlatformRoutes from './routes/admin/platform.js';
import faqRoutes from './routes/faq.js';
import sshKeysRoutes from './routes/sshKeys.js';
import pricingRoutes from './routes/pricing.js';
import adminPaaSWorkersRoutes from './routes/admin/paasWorkers.js';
import adminPaaSLocationsRoutes from './routes/admin/paasLocations.js';
import adminPaaSServicesRoutes from './routes/admin/paasServices.js';
import adminPaaSVolumesRoutes from './routes/admin/paasVolumes.js';
import adminPaaSDnsRoutes from './routes/admin/paasDns.js';
import adminPaaSNetworkingRoutes from './routes/admin/paasNetworking.js';
import adminPaaSSshKeysRoutes from './routes/admin/paasSshKeys.js';
import adminPaaSCaddyRoutes from './routes/admin/paasCaddy.js';
import adminPaaSImagesRoutes from './routes/admin/paasImages.js';
import adminPaaSMarketplaceRoutes from './routes/admin/paasMarketplace.js';
import adminPaaSPricingRoutes from './routes/admin/paasPricing.js';
import adminPaaSApplicationsRoutes from './routes/admin/paasApplications.js';
import adminPaaSDeploymentsRoutes from './routes/admin/paasDeployments.js';
import adminPaaSContainersRoutes from './routes/admin/paasContainers.js';
import clientPaaSApplicationsRoutes from './routes/client/paasApplications.js';
import clientPaaSMarketplaceRoutes from './routes/client/paasMarketplace.js';
import clientPaaSBillingRoutes from './routes/client/paasBilling.js';
import adminFaqRoutes from './routes/adminFaq.js';
import adminContactRoutes from './routes/admin/contact.js';
import { initializeMetricsCollection, startMetricsPersistence } from './services/rateLimitMetrics.js';

// for esm mode

// Validate configuration
validateConfig()

const app = express()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientBuildPath = path.resolve(__dirname, '../dist')
const clientIndexFile = path.join(clientBuildPath, 'index.html')

// Security middleware
app.use(helmet())
app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}))

// Body parsing
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Rate limiting
app.use(addRateLimitHeaders)
app.use(smartRateLimit)

// Initialize metrics
initializeMetricsCollection()
startMetricsPersistence()

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/admin/platform', adminPlatformRoutes)
app.use('/api/vps', vpsRoutes)
app.use('/api/support', supportRoutes)
app.use('/api/activity', activityRoutes)
app.use('/api/invoices', invoicesRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/theme', themeRoutes)
app.use('/api/health', healthRoutes)
app.use('/api/contact', contactRouter)
app.use('/api/admin/contact', adminContactRoutes)
app.use('/api/faq', faqRoutes);
app.use('/api/admin/faq', adminFaqRoutes);
app.use('/api/ssh-keys', sshKeysRoutes)
app.use('/api/pricing', pricingRoutes)

// PaaS Routes
app.use('/api/admin/paas/workers', adminPaaSWorkersRoutes);
app.use('/api/admin/paas/locations', adminPaaSLocationsRoutes);
app.use('/api/admin/paas/services', adminPaaSServicesRoutes);
app.use('/api/admin/paas/volumes', adminPaaSVolumesRoutes);
app.use('/api/admin/paas/dns', adminPaaSDnsRoutes);
app.use('/api/admin/paas/networking', adminPaaSNetworkingRoutes);
app.use('/api/admin/paas/ssh-keys', adminPaaSSshKeysRoutes);
app.use('/api/admin/paas/caddy', adminPaaSCaddyRoutes);
app.use('/api/admin/paas/images', adminPaaSImagesRoutes);
app.use('/api/admin/paas/pricing', adminPaaSPricingRoutes);
app.use('/api/admin/paas/marketplace', adminPaaSMarketplaceRoutes);
app.use('/api/admin/paas/applications', adminPaaSApplicationsRoutes);
app.use('/api/admin/paas/deployments', adminPaaSDeploymentsRoutes);
app.use('/api/admin/paas/containers', adminPaaSContainersRoutes);
app.use('/api/client/paas/applications', clientPaaSApplicationsRoutes);
app.use('/api/client/paas/marketplace', clientPaaSMarketplaceRoutes);
app.use('/api/client/paas/billing', clientPaaSBillingRoutes);

// Health check routes are now handled by the dedicated health router

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  void _next;
  // Log full error details server-side
  console.error('API error:', error)
  const isDev = process.env.NODE_ENV !== 'production'
  res.status(500).json({
    success: false,
    error: isDev ? (error?.message || 'Server internal error') : 'Server internal error',
  })
})

/**
 * 404 handler
 */
if (process.env.NODE_ENV === 'production') {
  // Serve the built frontend from /dist when running in production
  app.use(express.static(clientBuildPath))

  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/')) {
      return next()
    }

    res.sendFile(clientIndexFile, err => {
      if (err) {
        next(err)
      }
    })
  })
}

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
