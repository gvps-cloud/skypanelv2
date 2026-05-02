import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { getEnhanceWebsiteOrgId, getHostingSubscriptionForOrganization } from "../../lib/hostingEnhanceOrg.js";
import { EnhanceApiError, EnhanceService } from "../../services/enhanceService.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken, requireOrganization, requireHostingEnabledForUsers);

import { unwrapItems } from "../../lib/unwrapItems.js";

function normalizeMysqlDatabase(db: any) {
  return {
    id: db?.id ?? db?.dbId ?? null,
    name: String(db?.name ?? ""),
    size: typeof db?.size === "number" ? db.size : Number(db?.size ?? 0),
    createdAt: db?.createdAt ?? db?.created_at ?? null,
  };
}

function normalizeMysqlUser(user: any) {
  return {
    username: String(user?.username ?? ""),
    dbId: user?.dbId ?? null,
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
  const subscription = await getHostingSubscriptionForOrganization(id, organizationId);
  if (!subscription) {
    res.status(404).json({ error: "Service not found" });
    return null;
  }
  if (!subscription.enhance_website_id) {
    res.status(400).json({ error: "Website not yet provisioned" });
    return null;
  }
  return subscription;
}

function getEnhanceErrorMessage(error: EnhanceApiError, fallbackMessage: string): string {
  const body = error.responseBody;
  if (typeof body === "string" && body.trim()) return body;

  if (body && typeof body === "object") {
    const responseBody = body as Record<string, any>;
    if (Array.isArray(responseBody.errors) && responseBody.errors.length > 0) {
      const firstError = responseBody.errors[0];
      if (typeof firstError === "string") return firstError;
      if (firstError && typeof firstError === "object") {
        const nestedMessage = firstError.reason ?? firstError.message ?? firstError.error;
        if (typeof nestedMessage === "string" && nestedMessage.trim()) return nestedMessage;
      }
    }

    const message = responseBody.detail ?? responseBody.message ?? responseBody.reason ?? responseBody.error;
    if (typeof message === "string" && message.trim()) return message;
    if (message && typeof message === "object" && typeof message.message === "string") return message.message;
  }

  return error.message || fallbackMessage;
}

function sendMysqlError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof EnhanceApiError) {
    res.status(error.statusCode ?? 500).json({ error: getEnhanceErrorMessage(error, fallbackMessage) });
    return;
  }

  const message = error instanceof Error && error.message ? error.message : fallbackMessage;
  res.status(500).json({ error: message });
}

// MySQL Databases
router.get("/:id/mysql-dbs", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const dbs = await EnhanceService.getWebsiteMysqlDbs(enhanceWebsiteOrgId, sub.enhance_website_id);
    res.json({ databases: unwrapItems(dbs).map(normalizeMysqlDatabase) });
  } catch (error: any) {
    sendMysqlError(res, error, "Failed to get MySQL databases");
  }
});

router.post("/:id/mysql-dbs", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.createWebsiteMysqlDb(enhanceWebsiteOrgId, sub.enhance_website_id, req.body);
    res.status(201).json({ success: true, result });
  } catch (error: any) {
    sendMysqlError(res, error, "Failed to create MySQL database");
  }
});

router.delete("/:id/mysql-dbs/:dbName", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWebsiteMysqlDb(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.dbName);
    res.json({ success: true });
  } catch (error: any) {
    sendMysqlError(res, error, "Failed to delete MySQL database");
  }
});

router.get("/:id/mysql-dbs/:dbName/sso", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWebsiteMysqlDbSso(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.dbName);
    res.json({ url: typeof result === "string" ? result : result?.url ?? result?.ssoUrl ?? null });
  } catch (error: any) {
    sendMysqlError(res, error, "Failed to get MySQL SSO URL");
  }
});

router.get("/:id/mysql-dbs/:dbName/sql", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.downloadWebsiteMysqlSql(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.dbName);
    res.json({ path: typeof result === "string" ? result : result?.path ?? null });
  } catch (error: any) {
    sendMysqlError(res, error, "Failed to download SQL");
  }
});

// MySQL Users
router.get("/:id/mysql-users", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const users = await EnhanceService.getWebsiteMysqlUsers(enhanceWebsiteOrgId, sub.enhance_website_id);
    res.json({ users: unwrapItems(users).map(normalizeMysqlUser) });
  } catch (error: any) {
    sendMysqlError(res, error, "Failed to get MySQL users");
  }
});

router.post("/:id/mysql-users", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.createWebsiteMysqlUser(enhanceWebsiteOrgId, sub.enhance_website_id, req.body);
    res.status(201).json({ success: true, result });
  } catch (error: any) {
    sendMysqlError(res, error, "Failed to create MySQL user");
  }
});

router.put("/:id/mysql-users/:username", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.updateWebsiteMysqlUser(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.username, req.body);
    res.json({ success: true });
  } catch (error: any) {
    sendMysqlError(res, error, "Failed to update MySQL user");
  }
});

router.delete("/:id/mysql-users/:username", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWebsiteMysqlUser(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.username);
    res.json({ success: true });
  } catch (error: any) {
    sendMysqlError(res, error, "Failed to delete MySQL user");
  }
});

router.put("/:id/mysql-users/:username/privileges", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.updateWebsiteMysqlUserPrivileges(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.username, req.body);
    res.json({ success: true });
  } catch (error: any) {
    sendMysqlError(res, error, "Failed to update MySQL user privileges");
  }
});

router.post("/:id/mysql-users/:username/access-hosts", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.createWebsiteMysqlUserAccessHosts(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.username, req.body);
    res.json({ success: true });
  } catch (error: any) {
    sendMysqlError(res, error, "Failed to add MySQL user access hosts");
  }
});

router.delete("/:id/mysql-users/:username/access-hosts", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWebsiteMysqlUserAccessHosts(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.username, req.body);
    res.json({ success: true });
  } catch (error: any) {
    sendMysqlError(res, error, "Failed to delete MySQL user access hosts");
  }
});

export default router;
