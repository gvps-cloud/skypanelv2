/**
 * Resolve titles, descriptions, and preview images for SPA HTML responses
 * so social crawlers (Discord, Slack, etc.) see real metadata without running JS.
 */
import type { Request } from "express";
import { config } from "../config/index.js";
import { query } from "./database.js";

export type SpaSocialMeta = {
  title: string;
  description: string;
  canonicalUrl: string;
  /** Absolute URL for og:image / twitter:image, or null to use site default */
  imageUrl: string | null;
};

export function getSpaCompanyName(): string {
  const name = typeof config.COMPANY_NAME === "string" ? config.COMPANY_NAME.trim() : "";
  return name.length > 0 ? name : "SkyPanelV2";
}

function defaultTitle(company: string): string {
  return `${company} | Cloud`;
}

const DEFAULT_DESCRIPTION =
  "Cloud VPS and hosting with a modern control panel, transparent pricing, and reliable infrastructure.";

type StaticEntry = { title: string; description: string };

function staticRoutes(company: string): Record<string, StaticEntry> {
  const home: StaticEntry = {
    title: defaultTitle(company),
    description: DEFAULT_DESCRIPTION,
  };
  return {
    "/": home,
    "/maintenance": {
      title: `Scheduled maintenance | ${company}`,
      description:
        "We are performing maintenance. Status updates will appear here when available.",
    },
    "/blog": {
      title: `Blog | ${company}`,
      description: `News, guides, and product updates from ${company}.`,
    },
    "/login": {
      title: `Sign in | ${company}`,
      description: `Log in to your ${company} account to manage cloud services and billing.`,
    },
    "/register": {
      title: `Create account | ${company}`,
      description: `Register for ${company} to deploy VPS, manage hosting, and handle billing in one place.`,
    },
    "/forgot-password": {
      title: `Forgot password | ${company}`,
      description: `Reset your ${company} account password securely.`,
    },
    "/reset-password": {
      title: `Reset password | ${company}`,
      description: `Choose a new password for your ${company} account.`,
    },
    "/pricing": {
      title: `Pricing | ${company}`,
      description: `Compare VPS plans, regions, and hosting options with clear, upfront pricing.`,
    },
    "/web-hosting": {
      title: `Web hosting | ${company}`,
      description: `Managed web hosting with easy onboarding, SSL, email, and day-to-day operations.`,
    },
    "/hosting-web": {
      title: `Web hosting | ${company}`,
      description: `Managed web hosting with easy onboarding, SSL, email, and day-to-day operations.`,
    },
    "/faq": {
      title: `FAQ | ${company}`,
      description: `Answers to common questions about billing, VPS, hosting, and support.`,
    },
    "/docs": {
      title: `Documentation | ${company}`,
      description: `Product documentation, API references, and how-to guides.`,
    },
    "/about": {
      title: `About | ${company}`,
      description: `Learn more about ${company}, our infrastructure, and how we support customers.`,
    },
    "/contact": {
      title: `Contact | ${company}`,
      description: `Get in touch with ${company} for sales, support, and partnership inquiries.`,
    },
    "/status": {
      title: `System status | ${company}`,
      description: `Live service status, incidents, and uptime information for ${company} platforms.`,
    },
    "/regions": {
      title: `Regions & locations | ${company}`,
      description: `Available data center regions and locations for VPS and related services.`,
    },
    "/terms": {
      title: `Terms of service | ${company}`,
      description: `Terms of service for using ${company} products and websites.`,
    },
    "/privacy": {
      title: `Privacy policy | ${company}`,
      description: `How ${company} collects, uses, and protects your personal information.`,
    },
    "/api-docs": {
      title: `API reference | ${company}`,
      description: `Interactive API documentation for integrating with ${company}.`,
    },
  };
}

/** Public site origin for absolute URLs (og:image, canonical). */
export function resolvePublicOrigin(req: Request): string {
  const host = (req.get("x-forwarded-host") || req.get("host") || "").trim();
  const rawProto = req.get("x-forwarded-proto") || req.protocol || "https";
  const proto = rawProto.split(",")[0].trim() || "https";

  if (host) {
    return `${proto}://${host}`;
  }

  try {
    const u = new URL(config.CLIENT_URL);
    return u.origin;
  } catch {
    return "";
  }
}

export function resolveCanonicalUrl(req: Request): string {
  const origin = resolvePublicOrigin(req);
  const path = req.path || "/";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalized}`;
}

function absolutizeUrl(origin: string, url: string | null | undefined): string | null {
  if (url == null || typeof url !== "string") return null;
  const t = url.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("//")) return `https:${t}`;
  if (t.startsWith("/")) return `${origin}${t}`;
  return `${origin}/${t}`;
}

const BLOG_PATH = /^\/blog\/(\d{4})\/([^/]+)\/?$/;

export async function resolveSpaSocialMeta(req: Request): Promise<SpaSocialMeta> {
  const company = getSpaCompanyName();
  const canonicalUrl = resolveCanonicalUrl(req);
  const origin = resolvePublicOrigin(req);
  const path = req.path || "/";
  const normalizedPath = path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;

  const blogMatch = normalizedPath.match(BLOG_PATH);
  if (blogMatch) {
    const yearNum = parseInt(blogMatch[1], 10);
    const slug = blogMatch[2];
    if (!Number.isNaN(yearNum) && slug) {
      try {
        const row = await fetchPublishedBlogMeta(slug, yearNum);
        if (row) {
          const title =
            (row.meta_title && String(row.meta_title).trim()) ||
            String(row.title || "").trim() ||
            `Blog | ${company}`;
          const description =
            (row.meta_description && String(row.meta_description).trim()) ||
            (row.excerpt && String(row.excerpt).trim()) ||
            DEFAULT_DESCRIPTION;
          const imageRaw =
            (row.og_image_url && String(row.og_image_url).trim()) ||
            (row.cover_image_url && String(row.cover_image_url).trim()) ||
            null;
          const imageUrl = absolutizeUrl(origin, imageRaw);
          return { title, description, canonicalUrl, imageUrl };
        }
      } catch (err) {
        console.error("[spaSocialMeta] blog metadata lookup failed", err);
      }
    }
  }

  const table = staticRoutes(company);
  const entry =
    table[normalizedPath] ||
    (normalizedPath === "/docs" || normalizedPath.startsWith("/docs/")
      ? table["/docs"]
      : undefined);
  if (entry) {
    return {
      title: entry.title,
      description: entry.description,
      canonicalUrl,
      imageUrl: null,
    };
  }

  return {
    title: defaultTitle(company),
    description: DEFAULT_DESCRIPTION,
    canonicalUrl,
    imageUrl: null,
  };
}

type BlogMetaRow = {
  title?: string;
  meta_title?: string | null;
  meta_description?: string | null;
  excerpt?: string | null;
  og_image_url?: string | null;
  cover_image_url?: string | null;
};

async function fetchPublishedBlogMeta(
  slug: string,
  year: number,
): Promise<BlogMetaRow | null> {
  const result = await query(
    `SELECT title, meta_title, meta_description, excerpt, og_image_url, cover_image_url
     FROM blog_posts bp
     WHERE bp.slug = $1 AND bp.published_year = $2
       AND bp.status = 'published' AND bp.deleted_at IS NULL
     LIMIT 1`,
    [slug, year],
  );
  if (result.rows.length === 0) return null;
  return result.rows[0] as BlogMetaRow;
}

/** Default Open Graph image path (served from /public). */
export const DEFAULT_OG_IMAGE_PATH = "/og-default.png";

export function defaultOgImageUrl(origin: string): string {
  return `${origin}${DEFAULT_OG_IMAGE_PATH}`;
}
