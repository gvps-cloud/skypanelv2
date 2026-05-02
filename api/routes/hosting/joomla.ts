import express, { type Request, type Response } from "express";
import { authenticateToken, requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { getEnhanceWebsiteOrgId, getHostingSubscriptionForOrganization } from "../../lib/hostingEnhanceOrg.js";
import { unwrapItems } from "../../lib/unwrapItems.js";
import { EnhanceApiError, EnhanceService } from "../../services/enhanceService.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken, requireOrganization, requireHostingEnabledForUsers);

function normalizeJoomlaApp(app: any) {
  const path = app?.path ?? "";
  return {
    id: String(app?.id ?? app?.appId ?? app?.app_id ?? ""),
    name: path ? `Joomla (${path})` : "Joomla",
    path,
    version: app?.version ?? null,
    status: app?.status ?? null,
  };
}

function normalizeJoomlaUser(user: any) {
  return {
    id: String(user?.id ?? ""),
    username: String(user?.username ?? ""),
    name: typeof user?.name === "string" && user.name.trim() ? user.name.trim() : null,
    email: String(user?.email ?? ""),
    blocked: Boolean(user?.blocked),
    superUser: Boolean(user?.super_user ?? user?.superUser),
  };
}

function normalizeJoomlaInfo(info: any) {
  return {
    version: info?.version ?? null,
    siteUrl: info?.site_url ?? info?.siteUrl ?? null,
    pluginCount: Number(info?.plugin_count ?? info?.pluginCount ?? 0),
    userCount: Number(info?.user_count ?? info?.userCount ?? 0),
  };
}

function toNewJoomlaUser(body: any): Record<string, string> {
  const payload: Record<string, string> = {};
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (username) payload.username = username;
  if (password) payload.password = password;
  if (email) payload.email = email;
  return payload;
}

function toJoomlaUserUpdates(body: any): Record<string, string> {
  const payload: Record<string, string> = {};
  if (typeof body?.username === "string" && body.username.trim()) payload.username = body.username.trim();
  if (typeof body?.email === "string" && body.email.trim()) payload.email = body.email.trim();
  if (typeof body?.password === "string" && body.password.trim()) payload.password = body.password;
  return payload;
}

function getEnhanceErrorMessage(error: EnhanceApiError, fallbackMessage: string): string {
  const body = error.responseBody;
  if (typeof body === "string" && body.trim()) return body;
  if (body && typeof body === "object") {
    const responseBody = body as Record<string, any>;
    const message = responseBody.detail ?? responseBody.message ?? responseBody.reason ?? responseBody.error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return error.message || fallbackMessage;
}

function sendJoomlaError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof EnhanceApiError) {
    res.status(error.statusCode ?? 500).json({ error: getEnhanceErrorMessage(error, fallbackMessage) });
    return;
  }
  res.status(500).json({ error: error instanceof Error && error.message ? error.message : fallbackMessage });
}

async function resolveSubscription(req: Request, res: Response) {
  const { organizationId } = (req as AuthenticatedRequest).user;
  const subscription = await getHostingSubscriptionForOrganization(req.params.id, organizationId);
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

router.get("/:id/joomla", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;

  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const apps = await EnhanceService.getWebsiteApps(enhanceWebsiteOrgId, sub.enhance_website_id);
    res.json({
      installations: unwrapItems(apps)
        .filter((app) => String(app?.app ?? app?.kind ?? "").toLowerCase() === "joomla")
        .map(normalizeJoomlaApp)
        .filter((app) => app.id),
    });
  } catch (error) {
    sendJoomlaError(res, error, "Failed to get Joomla installations");
  }
});

router.get("/:id/joomla/:appId/info", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;

  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const info = await EnhanceService.getJoomlaInfo(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId);
    res.json({ info: normalizeJoomlaInfo(info) });
  } catch (error) {
    sendJoomlaError(res, error, "Failed to get Joomla info");
  }
});

router.get("/:id/joomla/:appId/users", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;

  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const users = await EnhanceService.getJoomlaUsers(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId);
    res.json({ users: unwrapItems(users).map(normalizeJoomlaUser) });
  } catch (error) {
    sendJoomlaError(res, error, "Failed to get Joomla users");
  }
});

router.post("/:id/joomla/:appId/users", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;

  try {
    const payload = toNewJoomlaUser(req.body);
    for (const field of ["username", "password", "email"]) {
      if (!payload[field]) {
        res.status(400).json({ error: `Joomla user ${field} is required` });
        return;
      }
    }

    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.createJoomlaUser(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, payload);
    res.json(result ?? { success: true });
  } catch (error) {
    sendJoomlaError(res, error, "Failed to create Joomla user");
  }
});

router.patch("/:id/joomla/:appId/users/:username", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;

  try {
    const payload = toJoomlaUserUpdates(req.body);
    const currentUsername = req.params.username;
    const nextUsername = payload.username && payload.username !== currentUsername ? payload.username : "";
    let operationCount = 0;
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);

    if (payload.email) {
      await EnhanceService.updateJoomlaEmailAddress(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, currentUsername, payload.email);
      operationCount += 1;
    }
    if (payload.password) {
      await EnhanceService.resetJoomlaUserPassword(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, currentUsername, payload.password);
      operationCount += 1;
    }
    if (nextUsername) {
      await EnhanceService.updateJoomlaUsername(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, currentUsername, nextUsername);
      operationCount += 1;
    }

    if (operationCount === 0) {
      res.status(400).json({ error: "At least one of username, email, or password is required" });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    sendJoomlaError(res, error, "Failed to update Joomla user");
  }
});

router.delete("/:id/joomla/:appId/users/:username", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;

  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteJoomlaUser(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, req.params.username);
    res.json({ success: true });
  } catch (error) {
    sendJoomlaError(res, error, "Failed to delete Joomla user");
  }
});

export default router;
