import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import {
  getEnhanceWebsiteOrgId,
  getHostingSubscriptionForOrganization,
  type HostingSubscriptionWithEnhanceOrg,
} from "./hostingEnhanceOrg.js";
import { unwrapItems } from "./unwrapItems.js";

export interface ResolvedHostingContext {
  subscription: HostingSubscriptionWithEnhanceOrg;
  enhanceOrgId: string;
  websiteId: string;
}

export async function resolveHostingContext(
  req: Request,
  res: Response,
): Promise<ResolvedHostingContext | null> {
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

  return {
    subscription,
    enhanceOrgId: getEnhanceWebsiteOrgId(subscription),
    websiteId: String(subscription.enhance_website_id),
  };
}

export function booleanQuery(value: unknown): boolean | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

export function stringQuery(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

export function successPayload(result?: unknown) {
  return typeof result === "undefined" ? { success: true } : { success: true, result };
}

export { unwrapItems };
