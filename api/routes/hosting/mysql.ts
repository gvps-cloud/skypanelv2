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
    res.json(dbs);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get MySQL databases" });
  }
});

router.post("/:id/mysql-dbs", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.createWebsiteMysqlDb(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.body);
    res.json(result);
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
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get MySQL SSO URL" });
  }
});

router.post("/:id/mysql-dbs/:dbName/sql", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.executeWebsiteMysqlSql(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.dbName, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to execute SQL" });
  }
});

// MySQL Users
router.get("/:id/mysql-users", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const users = await EnhanceService.getWebsiteMysqlUsers(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id);
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get MySQL users" });
  }
});

router.post("/:id/mysql-users", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.createWebsiteMysqlUser(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to create MySQL user" });
  }
});

router.get("/:id/mysql-users/:username", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.getWebsiteMysqlUser(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.username);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get MySQL user" });
  }
});

router.put("/:id/mysql-users/:username", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.updateWebsiteMysqlUser(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.username, req.body);
    res.json(result);
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

router.get("/:id/mysql-users/:username/privileges", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.getWebsiteMysqlUserPrivileges(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.username);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get MySQL user privileges" });
  }
});

router.put("/:id/mysql-users/:username/privileges", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.updateWebsiteMysqlUserPrivileges(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.username, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update MySQL user privileges" });
  }
});

router.get("/:id/mysql-users/:username/access-hosts", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.getWebsiteMysqlUserAccessHosts(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.username);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get MySQL user access hosts" });
  }
});

router.put("/:id/mysql-users/:username/access-hosts", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.updateWebsiteMysqlUserAccessHosts(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.username, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update MySQL user access hosts" });
  }
});

export default router;
