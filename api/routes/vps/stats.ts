import express from 'express';
import type { Request, Response } from 'express';
import { authenticateToken, requireOrganization } from '../../middleware/auth.js';
import { query } from '../../lib/database.js';
import { RoleService } from '../../services/roles.js';
import { handleProviderError, sendSafeErrorResponse } from '../../lib/errorHandling.js';
import type {
  MetricPoint,
  MetricSummary,
  MetricSeriesPayload,
  AccountTransferPayload,
  TransferPayload,
  bytesToGigabytes,
  extractTransferUsedBytes,
  extractTransferBillableBytes,
  normalizeSeries,
  summarizeSeries,
  deriveTimeframe,
} from './shared/types.js';

const router = express.Router();

router.get("/uptime-summary", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user.id;
    const organizationId = user.organizationId;

    const hasPermission = await RoleService.checkPermission(
      userId,
      organizationId,
      "vps_view",
    );
    if (!hasPermission) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const result = await query(
      `SELECT
          vi.id,
          vi.label,
          vi.status,
          vi.created_at,
          vi.last_billed_at,
          vi.plan_id,
          vp.base_price,
          vp.markup_price,
          vp.provider_plan_id
        FROM vps_instances vi
        LEFT JOIN vps_plans vp ON vi.plan_id::uuid = vp.id
        WHERE vi.organization_id = $1
        ORDER BY vi.created_at DESC`,
      [organizationId],
    );

    const instances = result.rows || [];

    if (instances.length === 0) {
      return res.json({
        totalActiveHours: 0,
        totalEstimatedCost: 0,
        vpsInstances: [],
      });
    }

    const currentTime = new Date();
    let totalActiveHours = 0;
    let totalEstimatedCost = 0;

    const vpsInstances = instances.map((instance: any) => {
      // Calculate active hours from creation to now
      const createdAt = new Date(instance.created_at);
      const activeMilliseconds = currentTime.getTime() - createdAt.getTime();
      const activeHours = activeMilliseconds / (1000 * 60 * 60);

      // Calculate hourly rate from plan pricing
      // Default fallback rate if plan data is missing
      let hourlyRate = 0.027;

      if (instance.base_price !== null && instance.markup_price !== null) {
        const basePrice = parseFloat(instance.base_price) || 0;
        const markupPrice = parseFloat(instance.markup_price) || 0;
        const monthlyPrice = basePrice + markupPrice;
        // Convert monthly to hourly (730 hours per month average)
        hourlyRate = monthlyPrice / 730;
      }

      // Calculate estimated cost
      const estimatedCost = activeHours * hourlyRate;

      totalActiveHours += activeHours;
      totalEstimatedCost += estimatedCost;

      return {
        id: instance.id,
        label: instance.label,
        status: instance.status,
        createdAt: instance.created_at,
        deletedAt: null, // Not tracking deletions yet
        activeHours: Math.round(activeHours * 10) / 10, // Round to 1 decimal
        hourlyRate: Math.round(hourlyRate * 100000) / 100000, // Round to 5 decimals
        estimatedCost: Math.round(estimatedCost * 100) / 100, // Round to 2 decimals
        lastBilledAt: instance.last_billed_at,
      };
    });

    res.json({
      totalActiveHours: Math.round(totalActiveHours * 10) / 10,
      totalEstimatedCost: Math.round(totalEstimatedCost * 100) / 100,
      vpsInstances,
    });
  } catch (err) {
    sendSafeErrorResponse(res, err, 500, { fallbackMessage: "Failed to fetch VPS uptime data" });
  }
});

export default router;
