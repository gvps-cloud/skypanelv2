/**
 * Client PaaS Billing Routes
 * User-facing endpoints for viewing PaaS billing and usage
 */

import express, { Request, Response } from 'express';
import { PaaSBillingService } from '../../services/paasBillingService.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/client/paas/billing/usage
 * Get user's usage records
 */
router.get('/usage', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const usage = await PaaSBillingService.getUserUsage(authReq.user!.id, limit);
    
    res.json({ success: true, usage });
  } catch (error: any) {
    console.error('Error getting usage:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/client/paas/billing/summary
 * Get billing summary for a period
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { periodStart, periodEnd } = req.query;
    
    let start: Date;
    let end: Date;
    
    if (periodStart && periodEnd) {
      start = new Date(periodStart as string);
      end = new Date(periodEnd as string);
    } else {
      // Default to current month
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    
    const summary = await PaaSBillingService.getBillingSummary(authReq.user!.id, start, end);
    
    res.json({ success: true, summary });
  } catch (error: any) {
    console.error('Error getting billing summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/client/paas/billing/projection
 * Get cost projection for next billing period
 */
router.get('/projection', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const projection = await PaaSBillingService.getProjectedCosts(authReq.user!.id);
    
    res.json({ success: true, projection });
  } catch (error: any) {
    console.error('Error getting projection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
