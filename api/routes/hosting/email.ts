import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { getEnhanceWebsiteOrgId, getHostingSubscriptionForOrganization } from "../../lib/hostingEnhanceOrg.js";
import { EnhanceService } from "../../services/enhanceService.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken, requireOrganization, requireHostingEnabledForUsers);

import { unwrapItems } from "../../lib/unwrapItems.js";

function normalizeEmail(email: any) {
  const quota = email?.quota;
  return {
    address: String(email?.address ?? ""),
    aliases: Array.isArray(email?.aliases) ? email.aliases : [],
    status: email?.status ?? null,
    hasMailbox: Boolean(email?.hasMailbox),
    quota: typeof quota === "object" && quota !== null ? quota.total : quota ?? null,
    quotaUsage: typeof quota === "object" && quota !== null ? quota.usage : null,
    forwardersCount: Number(email?.forwardersCount ?? 0),
    createdAt: email?.createdAt ?? null,
    ssoAvailable: Boolean(email?.ssoAvailable),
  };
}

function splitEmailAddress(address: string) {
  const trimmed = address.trim();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return null;
  return {
    username: trimmed.slice(0, atIndex),
    domain: trimmed.slice(atIndex + 1).toLowerCase(),
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

// Email Boxes
router.get("/:id/emails", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const emails = await EnhanceService.getWebsiteEmails(enhanceWebsiteOrgId, sub.enhance_website_id);
    res.json({ emails: unwrapItems(emails).map(normalizeEmail) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get emails" });
  }
});

router.post("/:id/emails", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const parsed = splitEmailAddress(String(req.body?.address ?? req.body?.username ?? ""));
    if (!parsed) {
      return res.status(400).json({ error: "A valid email address is required" });
    }

    const domains = await EnhanceService.getWebsiteDomainMappings(enhanceWebsiteOrgId, sub.enhance_website_id);
    const domain = unwrapItems(domains).find((item) => String(item?.domain ?? "").toLowerCase() === parsed.domain);
    const domainId = domain?.domainId ?? domain?.id ?? domain?.domain_id;
    if (!domainId) {
      return res.status(400).json({ error: "Email domain is not mapped to this hosting service" });
    }

    const result = await EnhanceService.createWebsiteEmail(
      enhanceWebsiteOrgId,
      sub.enhance_website_id,
      String(domainId),
      {
        username: parsed.username,
        mailboxPassword: req.body?.password,
        quota: req.body?.quota,
      },
    );
    res.status(201).json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to create email" });
  }
});

router.get("/:id/emails/:emailAddress", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWebsiteEmail(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.emailAddress);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get email" });
  }
});

router.delete("/:id/emails/:emailAddress", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWebsiteEmail(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.emailAddress);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete email" });
  }
});

router.patch("/:id/emails/:emailAddress", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.updateWebsiteEmail(
      enhanceWebsiteOrgId, sub.enhance_website_id, req.params.emailAddress, req.body,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update email" });
  }
});

router.get("/:id/emails/:emailAddress/client-conf", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWebsiteEmailClientConf(
      enhanceWebsiteOrgId, sub.enhance_website_id, req.params.emailAddress,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get email client config" });
  }
});

router.post("/:id/emails/:emailAddress/autoresponder", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.createWebsiteEmailAutoresponder(
      enhanceWebsiteOrgId, sub.enhance_website_id, req.params.emailAddress, req.body,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to create autoresponder" });
  }
});

router.delete("/:id/emails/:emailAddress/autoresponder", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWebsiteEmailAutoresponder(
      enhanceWebsiteOrgId, sub.enhance_website_id, req.params.emailAddress,
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete autoresponder" });
  }
});

export default router;
