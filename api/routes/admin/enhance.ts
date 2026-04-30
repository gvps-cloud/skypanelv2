import express, { type Request, type Response } from "express";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";
import { getEnhanceWebsiteOrgId, getHostingSubscriptionById } from "../../lib/hostingEnhanceOrg.js";
import { query } from "../../lib/database.js";
import { EnhanceToggleService } from "../../services/enhanceToggle.js";
import { EnhanceService } from "../../services/enhanceService.js";
import { logActivity } from "../../services/activityLogger.js";
import { config } from "../../config/index.js";

const router = express.Router();

router.use(authenticateToken, requireAdmin);

/**
 * GET /api/admin/enhance/status
 * Full status breakdown
 */
router.get("/status", async (_req: Request, res: Response) => {
  try {
    const status = await EnhanceToggleService.getStatus();
    res.json(status);
  } catch (error) {
    console.error("Failed to get enhance status:", error);
    res.status(500).json({ error: "Failed to get enhance status" });
  }
});

/**
 * PATCH /api/admin/enhance/status
 * Toggle runtime enabled state
 */
router.patch("/status", async (req: Request, res: Response) => {
  const { enabled } = req.body;
  const userId = (req as any).user?.id;

  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "enabled must be a boolean" });
  }

  try {
    await EnhanceToggleService.setRuntimeEnabled(enabled, userId);
    const status = await EnhanceToggleService.getStatus();
    res.json(status);
  } catch (error: any) {
    console.error("Failed to update enhance status:", error);
    res.status(400).json({ error: error?.message || "Failed to update enhance status" });
  }
});

/**
 * POST /api/admin/enhance/status/test
 * Run health check
 */
router.post("/status/test", async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  try {
    const result = await EnhanceToggleService.runHealthCheck(userId);
    res.json(result);
  } catch (error: any) {
    console.error("Health check failed:", error);
    res.status(500).json({ error: error?.message || "Health check failed" });
  }
});

/**
 * POST /api/admin/enhance/plans/sync
 * Sync plans from Enhance into local catalog
 */
router.post("/plans/sync", async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  try {
    const remotePlans = await EnhanceService.getPlans(config.ENHANCE_MASTER_ORG_ID);
    // Enhance API returns { items: Plan[], total: integer } (PlansListing schema)
    const plans = Array.isArray(remotePlans) ? remotePlans : remotePlans?.items || [];

    const upserted: any[] = [];
    const seenIds = new Set<string>();

    if (plans.length === 0) {
      res.json({
        synced: 0,
        plans: [],
        warning: "Enhance returned 0 plans — verify your ENHANCE_MASTER_ORG_ID is correct and plans exist in your Enhance panel",
      });
      return;
    }

    for (const plan of plans) {
      // Enhance Plan.id is integer — store as string for varchar column
      const planId = String(plan.id);
      seenIds.add(planId);

      // Map Enhance planType (shared|dedicated) → service_type
      const planType = plan.planType || "shared";
      const serviceType = "web"; // Both shared and dedicated are web hosting

      // Build structured features JSONB from Enhance plan data
      // Enhance Plan has: resources, allowances, selections, allowedPhpVersions, etc.
      const resourcesMap: Record<string, { total?: number }> = {};
      if (Array.isArray(plan.resources)) {
        for (const r of plan.resources) {
          resourcesMap[r.name] = r.total !== undefined ? { total: r.total } : {};
        }
      }

      const allowancesList: string[] = [];
      if (Array.isArray(plan.allowances)) {
        for (const a of plan.allowances) {
          allowancesList.push(a.name);
        }
      }

      const selectionsMap: Record<string, string> = {};
      if (Array.isArray(plan.selections)) {
        for (const s of plan.selections) {
          selectionsMap[s.name] = s.value;
        }
      }

      const features = {
        planType,
        resources: resourcesMap,
        allowances: allowancesList,
        selections: selectionsMap,
        subscriptionsCount: plan.subscriptionsCount ?? 0,
        serverGroupIds: plan.serverGroupIds || [],
        allowedPhpVersions: plan.allowedPhpVersions || [],
        defaultPhpVersion: plan.defaultPhpVersion || null,
        redisAllowed: plan.redisAllowed ?? false,
        persistentAppsAllowed: plan.persistentAppsAllowed ?? false,
        cgroupLimits: plan.cgroupLimits || null,
        fsQuotaLimit: plan.fsQuotaLimit || null,
        allowServerGroupSelection: plan.allowServerGroupSelection ?? false,
        createdAt: plan.createdAt || null,
      };

      const result = await query(
        `INSERT INTO hosting_plans (enhance_plan_id, name, description, features, service_type, price_monthly, is_active)
         VALUES ($1, $2, NULL, $3, $4, 0, true)
         ON CONFLICT (enhance_plan_id) DO UPDATE SET
           name = EXCLUDED.name,
           features = EXCLUDED.features,
           service_type = EXCLUDED.service_type,
           is_active = true,
           updated_at = now()
         RETURNING *`,
        [
          planId,
          plan.name || `Plan ${planId}`,
          JSON.stringify(features),
          serviceType,
        ]
      );
      upserted.push(result.rows[0]);
    }

    // Mark missing remote plans as inactive
    if (seenIds.size > 0) {
      await query(
        `UPDATE hosting_plans SET is_active = false
         WHERE enhance_plan_id IS NOT NULL AND NOT (enhance_plan_id = ANY($1))`,
        [Array.from(seenIds)]
      );
    }

    await logActivity({
      userId,
      eventType: "enhance.plans.sync",
      entityType: "platform_integration",
      entityId: "enhance",
      message: `Synced ${upserted.length} hosting plans from Enhance`,
      status: "success",
      metadata: { count: upserted.length },
    });

    res.json({ synced: upserted.length, plans: upserted });
  } catch (error: any) {
    console.error("Failed to sync enhance plans:", error);
    res.status(500).json({ error: error?.message || "Failed to sync plans" });
  }
});

/**
 * GET /api/admin/enhance/plans
 * List all local hosting plans (admin view)
 */
router.get("/plans", async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM hosting_plans ORDER BY created_at DESC`
    );
    res.json({ plans: result.rows });
  } catch (error) {
    console.error("Failed to get enhance plans:", error);
    res.status(500).json({ error: "Failed to get plans" });
  }
});

/**
 * PUT /api/admin/enhance/plans/:id
 * Update local commercial fields for a plan
 */
router.put("/plans/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { price_monthly, is_active, service_type } = req.body;

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (price_monthly !== undefined) {
      updates.push(`price_monthly = $${paramIndex++}`);
      values.push(price_monthly);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }
    if (service_type !== undefined) {
      updates.push(`service_type = $${paramIndex++}`);
      values.push(service_type);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date().toISOString());
    values.push(id);

    const result = await query(
      `UPDATE hosting_plans SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Plan not found" });
    }

    res.json({ plan: result.rows[0] });
  } catch (error: any) {
    console.error("Failed to update plan:", error);
    res.status(500).json({ error: error?.message || "Failed to update plan" });
  }
});

/**
 * DELETE /api/admin/enhance/plans/purge-orphans
 * Delete all hosting_plans rows that have no enhance_plan_id (leaked test data, etc.)
 * Must be declared before /:id to avoid route conflict
 */
router.delete("/plans/purge-orphans", async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `DELETE FROM hosting_plans WHERE enhance_plan_id IS NULL RETURNING id, name`
    );
    res.json({ deleted: result.rows.length, plans: result.rows });
  } catch (error: any) {
    console.error("Failed to purge orphan plans:", error);
    res.status(500).json({ error: error?.message || "Failed to purge orphan plans" });
  }
});

/**
 * DELETE /api/admin/enhance/plans/:id
 * Hard-delete a single hosting plan. Blocked if active subscriptions reference it.
 */
router.delete("/plans/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const subCheck = await query(
      `SELECT id FROM hosting_subscriptions WHERE plan_id = $1 AND status = 'active' LIMIT 1`,
      [id]
    );
    if (subCheck.rows.length > 0) {
      return res.status(409).json({ error: "Cannot delete a plan that has active subscriptions" });
    }

    const result = await query(
      `DELETE FROM hosting_plans WHERE id = $1 RETURNING id, name`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Plan not found" });
    }

    res.json({ deleted: result.rows[0] });
  } catch (error: any) {
    console.error("Failed to delete plan:", error);
    res.status(500).json({ error: error?.message || "Failed to delete plan" });
  }
});

/**
 * GET /api/admin/enhance/subscriptions
 * List all hosting subscriptions across orgs
 */
router.get("/subscriptions", async (req: Request, res: Response) => {
  try {
    const { status, organization_id } = req.query;
    let sql = `SELECT hs.*, org.name as organization_name, hp.name as plan_name
               FROM hosting_subscriptions hs
               JOIN organizations org ON org.id = hs.organization_id
               JOIN hosting_plans hp ON hp.id = hs.plan_id
               WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      sql += ` AND hs.status = $${paramIndex++}`;
      params.push(status);
    }
    if (organization_id) {
      sql += ` AND hs.organization_id = $${paramIndex++}`;
      params.push(organization_id);
    }

    sql += ` ORDER BY hs.created_at DESC`;

    const result = await query(sql, params);
    res.json({ subscriptions: result.rows });
  } catch (error) {
    console.error("Failed to get enhance subscriptions:", error);
    res.status(500).json({ error: "Failed to get subscriptions" });
  }
});

/**
 * POST /api/admin/enhance/orgs/:orgId/sync-customer
 * Manually sync an organization to Enhance as a customer
 */
router.post("/orgs/:orgId/sync-customer", async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const userId = (req as any).user?.id;

  try {
    const orgResult = await query(
      `SELECT id, name, enhance_customer_id FROM organizations WHERE id = $1`,
      [orgId]
    );
    if (orgResult.rows.length === 0) {
      return res.status(404).json({ error: "Organization not found" });
    }
    const org = orgResult.rows[0];

    if (org.enhance_customer_id) {
      return res.status(400).json({ error: "Organization already has an Enhance customer ID" });
    }

    const customer = await EnhanceService.createCustomer(config.ENHANCE_MASTER_ORG_ID, {
      name: org.name,
    });

    await query(
      `UPDATE organizations SET enhance_customer_id = $1 WHERE id = $2`,
      [customer.id, orgId]
    );

    await logActivity({
      userId,
      eventType: "enhance.customer.sync",
      entityType: "organization",
      entityId: orgId,
      message: `Synced organization to Enhance customer ${customer.id}`,
      status: "success",
      metadata: { enhance_customer_id: customer.id },
    });

    res.json({ success: true, enhance_customer_id: customer.id });
  } catch (error: any) {
    console.error("Failed to sync customer:", error);
    res.status(500).json({ error: error?.message || "Failed to sync customer" });
  }
});

/**
 * POST /api/admin/enhance/subscriptions/:id/suspend
 * Admin suspend a subscription
 */
router.post("/subscriptions/:id/suspend", async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;

  try {
    const sub = await getHostingSubscriptionById(id);
    if (!sub) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    if (sub.enhance_website_id) {
      await EnhanceService.updateWebsite(getEnhanceWebsiteOrgId(sub), sub.enhance_website_id, {
        status: "suspended",
      });
    }

    await query(`UPDATE hosting_subscriptions SET status = 'suspended' WHERE id = $1`, [id]);

    await logActivity({
      userId,
      organizationId: sub.organization_id,
      eventType: "hosting.admin.suspend",
      entityType: "hosting_subscription",
      entityId: id,
      message: `Admin suspended hosting subscription`,
      status: "success",
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Failed to suspend subscription:", error);
    res.status(500).json({ error: error?.message || "Failed to suspend subscription" });
  }
});

/**
 * POST /api/admin/enhance/subscriptions/:id/unsuspend
 * Admin unsuspend a subscription
 */
router.post("/subscriptions/:id/unsuspend", async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;

  try {
    const sub = await getHostingSubscriptionById(id);
    if (!sub) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    if (sub.enhance_website_id) {
      await EnhanceService.updateWebsite(getEnhanceWebsiteOrgId(sub), sub.enhance_website_id, {
        status: "active",
      });
    }

    await query(`UPDATE hosting_subscriptions SET status = 'active' WHERE id = $1`, [id]);

    await logActivity({
      userId,
      organizationId: sub.organization_id,
      eventType: "hosting.admin.unsuspend",
      entityType: "hosting_subscription",
      entityId: id,
      message: `Admin unsuspended hosting subscription`,
      status: "success",
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Failed to unsuspend subscription:", error);
    res.status(500).json({ error: error?.message || "Failed to unsuspend subscription" });
  }
});

export default router;
