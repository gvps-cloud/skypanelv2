import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { query } from "../../lib/database.js";
import { EnhanceService } from "../../services/enhanceService.js";
import { config } from "../../config/index.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken, requireOrganization, requireHostingEnabledForUsers);

import { unwrapItems } from "../../lib/unwrapItems.js";

function normalizeMysqlDatabase(db: any) {
  return {
    name: String(db?.name ?? ""),
    size: typeof db?.size === "number" ? db.size : Number(db?.size ?? 0),
    createdAt: db?.createdAt ?? db?.created_at ?? null,
  };
}

function normalizeMysqlUser(user: any) {
  return {
    username: String(user?.username ?? ""),
    accessHosts: Array.isArray(user?.accessHosts) ? user.accessHosts : [],
    authPlugin: user?.authPlugin ?? null,
    grants: user?.grants ?? {},
    createdAt: user?.createdAt ?? user?.created_at ?? null,
    isEphemeral: Boolean(user?.isEphemeral ?? user?.is_ephemeral),
  };
}

async function resolveSubscription(req: Request, res: Response) {
  const { organizationId } = (req as AuthenticatedRequest).user;
  const { id } = req.params;
  const result = await query(
    `SELECT * FROM hosting_subscriptions WHERE id = $1 AND organization_id = $2`,
    [id, organizationId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: "Service not found" });
    return null;
  }
  return result.rows[0];
}

// MySQL Databases
router.get("/:id/mysql-dbs", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const dbs = await EnhanceService.getWebsiteMysqlDbs(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id);
    res.json({ databases: unwrapItems(dbs).map(normalizeMysqlDatabase) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get MySQL databases" });
  }
});

router.post("/:id/mysql-dbs", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.createWebsiteMysqlDb(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.body);
    res.status(201).json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to create MySQL database" });
  }
});

router.delete("/:id/mysql-dbs/:dbName", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    await EnhanceService.deleteWebsiteMysqlDb(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.dbName);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete MySQL database" });
  }
});

router.get("/:id/mysql-dbs/:dbName/sso", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.getWebsiteMysqlDbSso(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.dbName);
    res.json({ url: typeof result === "string" ? result : result?.url ?? result?.ssoUrl ?? null });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get MySQL SSO URL" });
  }
});

router.get("/:id/mysql-dbs/:dbName/sql", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.downloadWebsiteMysqlSql(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.dbName);
    res.json({ path: typeof result === "string" ? result : result?.path ?? null });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to download SQL" });
  }
});

// MySQL Users
router.get("/:id/mysql-users", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const users = await EnhanceService.getWebsiteMysqlUsers(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id);
    res.json({ users: unwrapItems(users).map(normalizeMysqlUser) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get MySQL users" });
  }
});

router.post("/:id/mysql-users", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.createWebsiteMysqlUser(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.body);
    res.status(201).json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to create MySQL user" });
  }
});

router.put("/:id/mysql-users/:username", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    await EnhanceService.updateWebsiteMysqlUser(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.username, req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update MySQL user" });
  }
});

router.delete("/:id/mysql-users/:username", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    await EnhanceService.deleteWebsiteMysqlUser(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.username);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete MySQL user" });
  }
});

router.put("/:id/mysql-users/:username/privileges", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    await EnhanceService.updateWebsiteMysqlUserPrivileges(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.username, req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update MySQL user privileges" });
  }
});

router.post("/:id/mysql-users/:username/access-hosts", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    await EnhanceService.createWebsiteMysqlUserAccessHosts(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.username, req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to add MySQL user access hosts" });
  }
});

router.delete("/:id/mysql-users/:username/access-hosts", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    await EnhanceService.deleteWebsiteMysqlUserAccessHosts(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.username, req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete MySQL user access hosts" });
  }
});

export default router;
