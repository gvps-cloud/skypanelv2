import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { getEnhanceWebsiteOrgId, getHostingSubscriptionForOrganization } from "../../lib/hostingEnhanceOrg.js";
import { booleanQuery } from "../../lib/hostingRouteHelpers.js";
import { EnhanceApiError, EnhanceService } from "../../services/enhanceService.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken, requireOrganization, requireHostingEnabledForUsers);

import { unwrapItems } from "../../lib/unwrapItems.js";

function normalizeFtpUser(user: any) {
  return {
    account: String(user?.account ?? user?.username ?? ""),
    homeDir: String(user?.homeDir ?? user?.homeDirectory ?? ""),
  };
}

function normalizeFtpAccount(value: any) {
  const account = String(value ?? "").trim();
  const atIndex = account.indexOf("@");
  return atIndex >= 0 ? account.slice(0, atIndex).trim() : account;
}

function normalizeFtpHomeDir(value: any) {
  return String(value ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
}

function toEnhanceFtpUserPayload(body: any) {
  return {
    account: normalizeFtpAccount(body?.account ?? body?.username),
    password: body?.password,
    homeDir: normalizeFtpHomeDir(body?.homeDir ?? body?.homeDirectory),
  };
}

function toEnhanceFtpUserUpdatePayload(body: any) {
  return {
    ...(body?.password ? { password: body.password } : {}),
    ...(typeof (body?.homeDir ?? body?.homeDirectory) !== "undefined"
      ? { homeDir: normalizeFtpHomeDir(body?.homeDir ?? body?.homeDirectory) }
      : {}),
  };
}

function getEnhanceErrorMessage(error: EnhanceApiError, fallbackMessage: string): string {
  const body = error.responseBody;
  if (typeof body === "string" && body.trim()) return body;
  if (body && typeof body === "object") {
    const responseBody = body as Record<string, any>;
    const message = responseBody.detail ?? responseBody.message ?? responseBody.reason ?? responseBody.error;
    if (typeof message === "string" && message.trim()) return message;
    if (Array.isArray(responseBody.errors) && responseBody.errors.length > 0) {
      const firstError = responseBody.errors[0];
      if (typeof firstError === "string") return firstError;
      if (firstError && typeof firstError === "object") {
        const nestedMessage = firstError.reason ?? firstError.message ?? firstError.error;
        if (typeof nestedMessage === "string" && nestedMessage.trim()) return nestedMessage;
      }
    }
  }
  return error.message || fallbackMessage;
}

function sendFtpError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof EnhanceApiError) {
    res.status(error.statusCode ?? 500).json({ error: getEnhanceErrorMessage(error, fallbackMessage) });
    return;
  }

  res.status(500).json({ error: error instanceof Error && error.message ? error.message : fallbackMessage });
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

// FTP Users
router.get("/:id/ftp-users", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const users = await EnhanceService.getWebsiteFtpUsers(enhanceWebsiteOrgId, sub.enhance_website_id);
    res.json({ users: unwrapItems(users).map(normalizeFtpUser) });
  } catch (error: any) {
    sendFtpError(res, error, "Failed to get FTP users");
  }
});

router.post("/:id/ftp-users", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const payload = toEnhanceFtpUserPayload(req.body);
    if (!payload.account) {
      return res.status(400).json({ error: "FTP account is required" });
    }
    if (!payload.password) {
      return res.status(400).json({ error: "FTP password is required" });
    }
    const result = await EnhanceService.createWebsiteFtpUser(
      enhanceWebsiteOrgId,
      sub.enhance_website_id,
      payload,
      { createHome: booleanQuery(req.query.createHome) },
    );
    res.status(201).json({ success: true, result });
  } catch (error: any) {
    sendFtpError(res, error, "Failed to create FTP user");
  }
});

router.patch("/:id/ftp-users/:username", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.updateWebsiteFtpUser(
      enhanceWebsiteOrgId,
      sub.enhance_website_id,
      req.params.username,
      toEnhanceFtpUserUpdatePayload(req.body),
    );
    res.json({ success: true });
  } catch (error: any) {
    sendFtpError(res, error, "Failed to update FTP user");
  }
});

router.delete("/:id/ftp-users/:username", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWebsiteFtpUser(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.username, {
      deleteHome: booleanQuery(req.query.deleteHome),
    });
    res.json({ success: true });
  } catch (error: any) {
    sendFtpError(res, error, "Failed to delete FTP user");
  }
});

export default router;
