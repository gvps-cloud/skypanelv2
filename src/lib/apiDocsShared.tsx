// Shared data source for ApiDocs and ApiReference
// Extracted from ApiDocs.tsx so both /api-docs and /docs/api-reference show the same endpoints.

import React from "react";
import {
  Lock,
  Code2,
  DollarSign,
  HelpCircle,
  Mail,
  Palette,
  Activity,
  Server,
  Zap,
} from "lucide-react";
import { ACTIVE_API_ROUTE_MANIFEST } from "@/lib/apiRouteManifest";
import { BRAND_NAME } from "@/lib/brand";

// ── Types ────────────────────────────────────────────────────────────────────

export type EndpointDefinition = {
  method: string;
  path: string;
  description: string;
  auth?: boolean;
  body?: unknown;
  params?: Record<string, unknown>;
  response?: unknown;
};

export type SectionDefinition = {
  title: string;
  base: string;
  description: string;
  icon?: React.ReactNode;
  endpoints: EndpointDefinition[];
};

export type EndpointKey = `${string} ${string}`;
export type ActiveRoute = (typeof ACTIVE_API_ROUTE_MANIFEST)[number];

// ── Constants ────────────────────────────────────────────────────────────────

export const methodStyles: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800",
  POST: "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400 dark:border-blue-800",
  PUT: "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-800",
  PATCH: "bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-400 dark:border-purple-800",
  DELETE: "bg-red-500/10 text-red-700 border-red-200 dark:text-red-400 dark:border-red-800",
  DEFAULT: "bg-muted text-foreground border-border",
};

// ── Utility Functions ────────────────────────────────────────────────────────

export const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

const normalizePath = (value: string): string => {
  if (!value) {
    return "/";
  }
  const collapsed = value.replace(/\/{2,}/g, "/");
  if (collapsed.length > 1 && collapsed.endsWith("/")) {
    return collapsed.slice(0, -1);
  }
  return collapsed;
};

const extractApiPathFromBase = (base: string): string => {
  try {
    const parsed = new URL(base);
    return normalizePath(parsed.pathname);
  } catch {
    return normalizePath(base.replace(/^https?:\/\/[^/]+/i, ""));
  }
};

const endpointKey = (method: string, path: string): EndpointKey =>
  `${method.toUpperCase()} ${normalizePath(path)}` as EndpointKey;

const sectionEndpointKey = (
  sectionApiBase: string,
  endpoint: EndpointDefinition,
): EndpointKey => endpointKey(endpoint.method, `${sectionApiBase}${endpoint.path}`);

const routeRelativePath = (routePath: string, sectionApiBase: string): string => {
  if (routePath === sectionApiBase) {
    return "/";
  }
  const suffix = routePath.slice(sectionApiBase.length);
  if (!suffix) {
    return "/";
  }
  return suffix.startsWith("/") ? suffix : `/${suffix}`;
};

const assignSectionForRoute = (
  route: ActiveRoute,
  sectionApiBases: string[],
  sectionTitles: string[],
): number | null => {
  const candidates: number[] = [];
  for (let i = 0; i < sectionApiBases.length; i++) {
    const base = sectionApiBases[i];
    if (route.path === base || route.path.startsWith(`${base}/`)) {
      candidates.push(i);
    }
  }

  if (candidates.length === 0) {
    return null;
  }
  if (candidates.length === 1) {
    return candidates[0];
  }

  const vpsCandidates = candidates.filter((idx) =>
    sectionTitles[idx].startsWith("VPS "),
  );
  if (vpsCandidates.length > 0) {
    if (
      /^\/api\/vps\/(plans|providers|regions|stackscripts)(\/|$)/.test(route.path)
    ) {
      const match = vpsCandidates.find((idx) =>
        sectionTitles[idx].includes("Catalog"),
      );
      if (match !== undefined) {
        return match;
      }
    }

    if (
      route.path.includes("/networking") ||
      route.path.includes("/rdns") ||
      route.path.includes("/ipam")
    ) {
      const match = vpsCandidates.find((idx) =>
        sectionTitles[idx].includes("Networking"),
      );
      if (match !== undefined) {
        return match;
      }
    }

    const lifecycleMatch = vpsCandidates.find((idx) =>
      sectionTitles[idx].includes("Lifecycle"),
    );
    if (lifecycleMatch !== undefined) {
      return lifecycleMatch;
    }
  }

  return candidates.sort(
    (a, b) => sectionApiBases[b].length - sectionApiBases[a].length,
  )[0];
};

const getAutoSectionBase = (routePath: string): string => {
  const parts = routePath.split("/").filter(Boolean);
  if (parts.length >= 2) {
    return `/${parts[0]}/${parts[1]}`;
  }
  return "/api/misc";
};

const getAutoSectionTitle = (basePath: string): string => {
  if (basePath === "/api/contact") {
    return "Contact";
  }
  if (basePath === "/api/faq") {
    return "FAQ & Updates";
  }
  if (basePath === "/api/pricing") {
    return "Pricing";
  }
  const suffix = basePath.replace(/^\/api\//, "");
  if (!suffix) {
    return "Additional APIs";
  }
  const words = suffix
    .split("/")
    .flatMap((part) => part.split("-"))
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.join(" ");
};


const getAutoSectionIcon = (basePath: string): React.ReactNode => {
  switch (basePath) {
    case "/api/contact":
      return <Mail className="h-4 w-4" />;
    case "/api/faq":
      return <HelpCircle className="h-4 w-4" />;
    case "/api/pricing":
      return <DollarSign className="h-4 w-4" />;
    case "/api/theme":
      return <Palette className="h-4 w-4" />;
    default:
      return <Code2 className="h-4 w-4" />;
  }
};

export const syncSectionsWithActiveRoutes = (
  baseSections: SectionDefinition[],
  apiBase: string,
): SectionDefinition[] => {
  const sectionApiBases = baseSections.map((section) =>
    extractApiPathFromBase(section.base),
  );
  const sectionTitles = baseSections.map((section) => section.title);

  const manualKeyToSectionIndex = new Map<EndpointKey, number>();
  for (let i = 0; i < baseSections.length; i++) {
    const section = baseSections[i];
    const sectionApiBase = sectionApiBases[i];
    for (const endpoint of section.endpoints) {
      manualKeyToSectionIndex.set(sectionEndpointKey(sectionApiBase, endpoint), i);
    }
  }

  const routeByKey = new Map<EndpointKey, ActiveRoute>();
  const routeKeysBySection = baseSections.map(() => new Set<EndpointKey>());
  const unmatchedRoutes: ActiveRoute[] = [];

  for (const route of ACTIVE_API_ROUTE_MANIFEST) {
    const key = endpointKey(route.method, route.path);
    routeByKey.set(key, route);

    const mappedSectionIndex = manualKeyToSectionIndex.get(key);
    if (mappedSectionIndex !== undefined) {
      routeKeysBySection[mappedSectionIndex].add(key);
      continue;
    }

    const inferredSectionIndex = assignSectionForRoute(
      route,
      sectionApiBases,
      sectionTitles,
    );
    if (inferredSectionIndex !== null) {
      routeKeysBySection[inferredSectionIndex].add(key);
    } else {
      unmatchedRoutes.push(route);
    }
  }

  const syncedBaseSections = baseSections
    .map((section, sectionIndex) => {
      const sectionApiBase = sectionApiBases[sectionIndex];
      const activeKeys = routeKeysBySection[sectionIndex];
      const activeManualEndpoints = section.endpoints
        .filter((endpoint) =>
          activeKeys.has(sectionEndpointKey(sectionApiBase, endpoint)),
        )
        .map((endpoint) => {
          const key = sectionEndpointKey(sectionApiBase, endpoint);
          const route = routeByKey.get(key);
          return {
            ...endpoint,
            auth: route ? route.protected : endpoint.auth,
          };
        });

      const existingKeys = new Set(
        activeManualEndpoints.map((endpoint) =>
          sectionEndpointKey(sectionApiBase, endpoint),
        ),
      );

      const missingAutoEndpoints = Array.from(activeKeys)
        .filter((key) => !existingKeys.has(key))
        .map((key) => routeByKey.get(key))
        .filter((route): route is ActiveRoute => Boolean(route))
        .sort((a, b) =>
          `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`),
        )
        .map((route) => ({
          method: route.method,
          path: routeRelativePath(route.path, sectionApiBase),
          description:
            "Auto-discovered endpoint from the current server route registry.",
          auth: route.protected,
          response: { success: true },
        }));

      return {
        ...section,
        endpoints: [...activeManualEndpoints, ...missingAutoEndpoints],
      };
    })
    .filter((section) => section.endpoints.length > 0);

  if (unmatchedRoutes.length === 0) {
    return syncedBaseSections;
  }

  const unmatchedByBase = new Map<string, ActiveRoute[]>();
  for (const route of unmatchedRoutes) {
    const basePath = getAutoSectionBase(route.path);
    if (!unmatchedByBase.has(basePath)) {
      unmatchedByBase.set(basePath, []);
    }
    unmatchedByBase.get(basePath)?.push(route);
  }

  const autoSections: SectionDefinition[] = Array.from(unmatchedByBase.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([basePath, routes]) => ({
      title: getAutoSectionTitle(basePath),
      base: `${apiBase}${basePath.replace(/^\/api/, "")}`,
      description:
        "Automatically generated from currently mounted backend routes.",
      icon: getAutoSectionIcon(basePath),
      endpoints: routes
        .sort((a, b) =>
          `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`),
        )
        .map((route) => ({
          method: route.method,
          path: routeRelativePath(route.path, basePath),
          description:
            "Auto-discovered endpoint from the current server route registry.",
          auth: route.protected,
          response: { success: true },
        })),
    }));

  return [...syncedBaseSections, ...autoSections];
};


export const buildCurlCommand = (base: string, endpoint: EndpointDefinition) => {
  const query = endpoint.params
    ? new URLSearchParams(
      Object.entries(endpoint.params).map(([key, value]) => [
        key,
        value === undefined || value === null ? "" : String(value),
      ]),
    ).toString()
    : "";

  const url = query
    ? `${base}${endpoint.path}?${query}`
    : `${base}${endpoint.path}`;

  const lines = [`curl -X ${endpoint.method} "${url}"`];

  if (endpoint.auth) {
    lines.push('-H "Authorization: Bearer YOUR_TOKEN"');
  }

  if (endpoint.body) {
    lines.push('-H "Content-Type: application/json"');
    lines.push(`-d '${JSON.stringify(endpoint.body)}'`);
  }

  return lines
    .map((line, index) => (index === 0 ? line : `  ${line}`))
    .join(" \\\n");
};

// ── Base Sections Builder ───────────────────────────────────────────────────

export const buildBaseSections = (apiBase: string): SectionDefinition[] => [
      {
        title: "Authentication & Profile",
        base: `${apiBase}/auth`,
        description: "User authentication, session management, and profile settings.",
        icon: <Lock className="h-4 w-4" />,
        endpoints: [
          {
            method: "POST",
            path: "/register",
            description:
              "Create a new customer account and return an authenticated session.",
            body: {
              email: "admin@example.com",
              password: "Sup3rSecure!",
              firstName: "Sky",
              lastName: "Panel",
              company: "Example Corp",
              agreeToTerms: true,
            },
            response: {
              token: "jwt_token_here",
              user: {
                id: "user_123",
                email: "admin@example.com",
                firstName: "Sky",
                lastName: "Panel",
                role: "owner",
              },
            },
          },
          {
            method: "POST",
            path: "/login",
            description:
              "Authenticate an existing user and issue a fresh JWT token.",
            body: {
              email: "admin@example.com",
              password: "Sup3rSecure!",
            },
            response: {
              token: "jwt_token_here",
              user: {
                id: "user_123",
                email: "admin@example.com",
                firstName: "Sky",
                lastName: "Panel",
                role: "owner",
              },
            },
          },
          {
            method: "POST",
            path: "/refresh",
            description:
              "Refresh the JWT token for authenticated session.",
            auth: true,
            response: {
              token: "new_jwt_token",
              user: {
                id: "user_123",
                email: "admin@example.com",
                role: "owner",
              },
            },
          },
          {
            method: "GET",
            path: "/me",
            description: "Get currently authenticated user information.",
            auth: true,
            response: {
              user: {
                id: "user_123",
                email: "admin@example.com",
                firstName: "Sky",
                lastName: "Panel",
                role: "owner",
              },
            },
          },
          {
            method: "POST",
            path: "/verify-password",
            description:
              "Verify user password before sensitive operations (SSH access, deletion).",
            auth: true,
            body: {
              password: "Sup3rSecure!",
            },
            response: {
              success: true,
              message: "Password verified",
            },
          },
          {
            method: "POST",
            path: "/logout",
            description: "End user session (client-side token removal).",
            auth: true,
            response: {
              success: true,
              message: "Logged out successfully",
            },
          },
          {
            method: "PUT",
            path: "/profile",
            description:
              "Update profile attributes such as display name, phone number, or preferred timezone.",
            auth: true,
            body: {
              firstName: "Sky",
              lastName: "Panel",
              phone: "+1-555-555-0100",
              timezone: "America/New_York",
            },
            response: {
              user: {
                id: "user_123",
                email: "admin@example.com",
                firstName: "Sky",
                lastName: "Panel",
                phone: "+1-555-555-0100",
                timezone: "America/New_York",
              },
            },
          },

          {
            method: "PUT",
            path: "/password",
            description:
              "Change the account password after verifying the existing credentials.",
            auth: true,
            body: {
              currentPassword: "Sup3rSecure!",
              newPassword: "N3wSecurePass!",
            },
            response: {
              success: true,
              message: "Password updated successfully",
            },
          },
          {
            method: "PUT",
            path: "/preferences",
            description:
              "Persist user preference toggles such as notification channels or security options.",
            auth: true,
            body: {
              notifications: { email: true, push: false },
              security: { multiFactorEnabled: true },
            },
            response: {
              preferences: {
                notifications: { email: true, push: false },
                security: { multiFactorEnabled: true },
              },
            },
          },
          {
            method: "GET",
            path: "/api-keys",
            description: "List API keys scoped to the authenticated user.",
            auth: true,
            response: {
              apiKeys: [
                {
                  id: "key_123",
                  name: "production",
                  token: "sk_live_************************",
                  createdAt: "2024-10-20T12:00:00Z",
                  lastUsedAt: "2024-10-25T08:30:00Z",
                },
              ],
            },
          },
          {
            method: "POST",
            path: "/api-keys",
            description: "Issue a new API key for programmatic access.",
            auth: true,
            body: {
              name: "automation",
            },
            response: {
              apiKey: {
                id: "key_456",
                name: "automation",
                token: "sk_live_************************",
                createdAt: "2024-10-26T09:00:00Z",
              },
            },
          },
          {
            method: "DELETE",
            path: "/api-keys/:id",
            description: "Revoke an API key immediately.",
            auth: true,
            response: {
              message: "API key revoked successfully",
            },
          },
          {
            method: "POST",
            path: "/forgot-password",
            description:
              "Initiate the password reset workflow by emailing a recovery link.",
            body: {
              email: "admin@example.com",
            },
            response: {
              success: true,
              message:
                "If an account exists for admin@example.com we have sent password reset instructions.",
            },
          },
          {
            method: "POST",
            path: "/reset-password",
            description:
              "Complete the reset flow by providing a valid token and new password.",
            body: {
              email: "admin@example.com",
              token: "reset_token_here",
              password: "N3wSecurePass!",
            },
            response: {
              success: true,
              message: "Password reset successfully",
            },
          },
          {
            method: "POST",
            path: "/verify-email",
            description: "Verify user email address using verification token.",
            body: {
              token: "verification_token_here",
            },
            response: {
              success: true,
              message: "Email verified successfully",
            },
          },
          {
            method: "POST",
            path: "/2fa/setup",
            description: "Initialize 2FA setup and return QR code URI for authenticator apps.",
            auth: true,
            response: {
              success: true,
              qrCodeUri: "otpauth://totp/SkyPanel:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=SkyPanel",
              backupCodes: ["code1", "code2", "code3", "code4"],
            },
          },
          {
            method: "POST",
            path: "/2fa/verify",
            description: "Verify a 2FA code to enable or validate two-factor authentication.",
            auth: true,
            body: {
              code: "123456",
            },
            response: {
              success: true,
              verified: true,
            },
          },
          {
            method: "POST",
            path: "/2fa/disable",
            description: "Disable 2FA for the authenticated user (requires password confirmation).",
            auth: true,
            body: {
              password: "Sup3rSecure!",
            },
            response: {
              success: true,
              message: "2FA has been disabled",
            },
          },
          {
            method: "GET",
            path: "/debug/user",
            description: "Debug endpoint returning current user session details (development only).",
            auth: true,
            response: {
              user: { id: "user_123", email: "admin@example.com" },
              session: { createdAt: "2024-10-26T10:00:00Z" },
            },
          },
          {
            method: "DELETE",
            path: "/api-keys/:id",
            description: "Revoke a specific API key by its ID.",
            auth: true,
            response: {
              message: "API key revoked successfully",
            },
          },
          {
            method: "POST",
            path: "/switch-organization",
            description: "Switch the active organization context for the authenticated session.",
            auth: true,
            body: {
              organizationId: "org_456",
            },
            response: {
              success: true,
              organization: { id: "org_456", name: "Acme Corp" },
            },
          },
        ],
      },
      {
        title: "Billing & Payments",
        base: `${apiBase}/payments`,
        description:
          "Wallet management, PayPal integration, transaction history.",
        icon: <Server className="h-4 w-4" />,
        endpoints: [
          {
            method: "POST",
            path: "/create-payment",
            description:
              "Create a PayPal payment intent used to top up the wallet balance.",
            auth: true,
            body: {
              amount: 100.0,
              currency: "USD",
              description: "Wallet top-up",
            },
            response: {
              success: true,
              paymentId: "PAYID-MOCK123",
              approvalUrl: "https://paypal.com/checkout?token=PAYID-MOCK123",
            },
          },
          {
            method: "POST",
            path: "/capture-payment/:orderId",
            description:
              "Capture a PayPal payment after the customer approves the order.",
            auth: true,
            response: {
              success: true,
              paymentId: "PAYID-MOCK123",
            },
          },
          {
            method: "GET",
            path: "/config",
            description:
              "Fetch the PayPal client configuration (client ID, mode, allowed funding sources).",
            auth: true,
            response: {
              success: true,
              config: {
                clientId: "PAYPAL_CLIENT_ID",
                currency: "USD",
                intent: "capture",
                mode: "sandbox",
                disableFunding: ["paylater"],
                brandName: `${BRAND_NAME}`,
              },
            },
          },
          {
            method: "GET",
            path: "/wallet/balance",
            description:
              "Return the user's wallet balance used to provision VPS resources.",
            auth: true,
            response: {
              balance: 245.67,
              currency: "USD",
              updatedAt: "2024-10-26T15:00:00Z",
            },
          },
          {
            method: "POST",
            path: "/wallet/deduct",
            description: "Manually deduct credits from the wallet (admin or internal use).",
            auth: true,
            body: {
              amount: 10.00,
              description: "VPS hourly billing",
              referenceId: "vps_001",
            },
            response: {
              success: true,
              newBalance: 235.67,
            },
          },
          {
            method: "GET",
            path: "/wallet/transactions",
            description:
              "Paginated wallet ledger containing credits, debits, and running balance adjustments.",
            auth: true,
            params: { limit: 20, offset: 0 },
            response: {
              transactions: [
                {
                  id: "txn_001",
                  type: "credit",
                  amount: 100,
                  currency: "USD",
                  description: "Wallet top-up via PayPal",
                  balanceBefore: 145.67,
                  balanceAfter: 245.67,
                  createdAt: "2024-10-26T14:55:00Z",
                },
              ],
              pagination: { hasMore: false },
            },
          },
          {
            method: "GET",
            path: "/history",
            description:
              "Historical payment events across all providers (currently PayPal).",
            auth: true,
            params: { limit: 20, status: "completed" },
            response: {
              payments: [
                {
                  id: "pay_001",
                  amount: 100,
                  currency: "USD",
                  description: "Wallet top-up",
                  status: "completed",
                  provider: "paypal",
                  providerPaymentId: "PAYID-MOCK123",
                  createdAt: "2024-10-26T14:54:00Z",
                  updatedAt: "2024-10-26T14:55:00Z",
                },
              ],
              pagination: { hasMore: false },
            },
          },
          {
            method: "GET",
            path: "/transactions/:id",
            description:
              "Detailed view of a single payment transaction used by the transaction drawer.",
            auth: true,
            response: {
              transaction: {
                id: "txn_001",
                amount: 100,
                currency: "USD",
                description: "Wallet top-up",
                status: "completed",
                provider: "paypal",
                paymentMethod: "paypal-balance",
                providerPaymentId: "PAYID-MOCK123",
                type: "credit",
                balanceBefore: 145.67,
                balanceAfter: 245.67,
                createdAt: "2024-10-26T14:54:00Z",
                updatedAt: "2024-10-26T14:55:00Z",
              },
            },
          },
          {
            method: "POST",
            path: "/refund",
            description:
              "Issue a manual refund or payout through PayPal to a customer email address.",
            auth: true,
            body: {
              email: "customer@example.com",
              amount: 25.0,
              currency: "USD",
              reason: "Service credit",
            },
            response: {
              success: true,
              paymentId: "PAYOUT-001",
            },
          },
          {
            method: "GET",
            path: "/billing/summary",
            description:
              "Aggregated spend metrics displayed on the billing overview cards.",
            auth: true,
            response: {
              success: true,
              summary: {
                totalSpentThisMonth: 320.5,
                totalSpentAllTime: 1480.25,
                activeVPSCount: 6,
                monthlyEstimate: 340.0,
              },
            },
          },
        ],
      },
      {
        title: "Invoices & Financial Records",
        base: `${apiBase}/invoices`,
        description:
          "Invoice generation, viewing, and download.",
        icon: <Code2 className="h-4 w-4" />,
        endpoints: [
          {
            method: "GET",
            path: "/",
            description:
              "List invoices for the user with pagination information.",
            auth: true,
            params: { limit: 50, offset: 0 },
            response: {
              invoices: [
                {
                  id: "inv_001",
                  invoiceNumber: "INV-2024-001",
                  totalAmount: 120.5,
                  currency: "USD",
                  createdAt: "2024-10-01T00:00:00Z",
                },
              ],
              pagination: { hasMore: false },
            },
          },
          {
            method: "GET",
            path: "/:id",
            description:
              "Retrieve a single invoice record for detailed display.",
            auth: true,
            response: {
              invoice: {
                id: "inv_001",
                invoiceNumber: "INV-2024-001",
                totalAmount: 120.5,
                currency: "USD",
                createdAt: "2024-10-01T00:00:00Z",
                lineItems: [
                  {
                    description: "VPS usage",
                    quantity: 720,
                    unitPrice: 0.12,
                    amount: 86.4,
                  },
                ],
              },
            },
          },
          {
            method: "GET",
            path: "/:id/download",
            description:
              "Download the generated PDF for an invoice (requires authenticated fetch).",
            auth: true,
            response: {
              contentType: "application/pdf",
              body: "<binary stream>",
            },
          },
          {
            method: "POST",
            path: "/from-transaction/:transactionId",
            description:
              "Generate an invoice artifact from a historical payment transaction.",
            auth: true,
            response: {
              success: true,
              invoiceId: "inv_001",
              invoiceNumber: "INV-2024-001",
            },
          },
          {
            method: "POST",
            path: "/from-transactions",
            description:
              "Create invoice from multiple payment transactions.",
            auth: true,
            body: {
              transactionIds: ["txn_001", "txn_002"],
            },
            response: {
              success: true,
              invoiceId: "inv_002",
            },
          },
          {
            method: "POST",
            path: "/from-billing-cycles",
            description:
              "Create invoice from VPS billing cycles with itemized backup costs.",
            auth: true,
            params: { startDate: "2024-10-01", endDate: "2024-10-31" },
            response: {
              success: true,
              invoiceId: "inv_003",
            },
          },
        ],
      },
      {
        title: "VPS Provisioning & Lifecycle",
        base: `${apiBase}/vps`,
        description:
          "VPS instance management, power control, backups, and configuration.",
        icon: <Server className="h-4 w-4" />,
        endpoints: [
          {
            method: "GET",
            path: "/",
            description:
              "List VPS instances for the authenticated user with live metrics where available.",
            auth: true,
            response: {
              instances: [
                {
                  id: "vps_001",
                  provider_instance_id: "123456",
                  label: "production-web-1",
                  status: "running",
                  ip_address: "203.0.113.12",
                  configuration: {
                    type: "g6-standard-2",
                    region: "us-east",
                    image: "ubuntu-24-04",
                  },
                  plan_specs: {
                    vcpus: 2,
                    memory: 4096,
                    disk: 81920,
                    transfer: 4000,
                  },
                  plan_pricing: { hourly: 0.027, monthly: 20 },
                },
              ],
            },
          },
          {
            method: "POST",
            path: "/",
            description:
              "Provision a new VPS instance with the configured Linode provider.",
            auth: true,
            body: {
              label: "production-web-1",
              provider_id: "linode",
              provider_type: "linode",
              type: "g6-standard-2",
              region: "us-east",
              image: "linode/ubuntu24.04",
              rootPassword: "Sup3rSecure!",
              sshKeys: ["123"],
              backups: true,
              privateIP: false,
            },
            response: {
              instance: {
                id: "vps_001",
                status: "provisioning",
                label: "production-web-1",
              },
            },
          },
          {
            method: "GET",
            path: "/:id",
            description:
              "Fetch an enriched detail view including metrics, networking, backups, and provider metadata.",
            auth: true,
            response: {
              instance: {
                id: "vps_001",
                label: "production-web-1",
                status: "running",
                ipAddress: "203.0.113.12",
                region: "us-east",
                plan: {
                  id: "g6-standard-2",
                  pricing: { hourly: 0.027, monthly: 20 },
                  specs: {
                    vcpus: 2,
                    memory: 4096,
                    disk: 81920,
                    transfer: 4000,
                  },
                },
                metrics: {
                  cpu: { summary: { average: 18.3, peak: 72.5, last: 21.9 } },
                  network: {
                    inbound: {
                      summary: {
                        average: 1200000,
                        peak: 8200000,
                        last: 1500000,
                      },
                    },
                    outbound: {
                      summary: {
                        average: 950000,
                        peak: 6500000,
                        last: 1100000,
                      },
                    },
                  },
                },
              },
            },
          },
          {
            method: "POST",
            path: "/:id/boot",
            description: "Power on a stopped VPS instance.",
            auth: true,
            response: {
              success: true,
              message: "VPS boot initiated",
            },
          },
          {
            method: "POST",
            path: "/:id/shutdown",
            description: "Gracefully shut down a running VPS instance.",
            auth: true,
            response: {
              success: true,
              message: "VPS shutdown initiated",
            },
          },
          {
            method: "POST",
            path: "/:id/reboot",
            description: "Reboot a VPS instance.",
            auth: true,
            response: {
              success: true,
              message: "VPS reboot initiated",
            },
          },
          {
            method: "DELETE",
            path: "/:id",
            description:
              "Delete a VPS instance (requires password confirmation).",
            auth: true,
            body: {
              password: "Sup3rSecure!",
            },
            response: {
              success: true,
              message: "VPS deletion initiated",
            },
          },
          {
            method: "GET",
            path: "/:id/notes",
            description: "Get notes/description for a VPS instance.",
            auth: true,
            response: {
              notes: "Production web server",
            },
          },
          {
            method: "PUT",
            path: "/:id/notes",
            description: "Update notes/description for a VPS instance.",
            auth: true,
            body: {
              notes: "Updated server description",
            },
            response: {
              success: true,
              notes: "Updated server description",
              message: "Notes updated successfully",
            },
          },
          {
            method: "GET",
            path: "/uptime-summary",
            description:
              "Get VPS uptime summary for billing calculations.",
            auth: true,
            response: {
              success: true,
              data: {
                totalActiveHours: 985.4,
                totalEstimatedCost: 265.42,
                vpsInstances: [
                  {
                    id: "vps_001",
                    label: "production-web-1",
                    estimatedCost: 9.62,
                  },
                ],
              },
            },
          },
          {
            method: "PUT",
            path: "/:id/hostname",
            description:
              "Update the VPS hostname/label used for reverse DNS and UI display.",
            auth: true,
            body: { hostname: "new-hostname" },
            response: {
              success: true,
              message: "Hostname updated successfully",
            },
          },
          {
            method: "POST",
            path: "/:id/backups/enable",
            description:
              "Enable provider-managed backups for the VPS instance.",
            auth: true,
            response: {
              success: true,
              message: "Backups enabled",
            },
          },
          {
            method: "POST",
            path: "/:id/backups/disable",
            description: "Disable recurring backups on the VPS instance.",
            auth: true,
            response: {
              success: true,
              message: "Backups disabled",
            },
          },
          {
            method: "POST",
            path: "/:id/backups/snapshot",
            description: "Request an on-demand snapshot backup.",
            auth: true,
            body: { label: "Before maintenance" },
            response: {
              success: true,
              message: "Snapshot requested",
            },
          },
          {
            method: "POST",
            path: "/:id/backups/schedule",
            description: "Update the provider backup schedule (day/window).",
            auth: true,
            body: { day: "Sunday", window: "W2" },
            response: {
              success: true,
              message: "Backup schedule updated",
            },
          },
          {
            method: "POST",
            path: "/:id/backups/:backupId/restore",
            description:
              "Restore a specific automatic or snapshot backup to the instance.",
            auth: true,
            body: { overwrite: true },
            response: {
              success: true,
              message: "Backup restore initiated",
            },
          },
          {
            method: "POST",
            path: "/:id/firewalls/attach",
            description: "Attach a firewall profile to the VPS instance.",
            auth: true,
            body: { firewallId: "fw_123" },
            response: {
              success: true,
              message: "Firewall attached",
            },
          },
          {
            method: "POST",
            path: "/:id/firewalls/detach",
            description: "Detach the firewall profile from the VPS instance.",
            auth: true,
            body: { firewallId: "fw_123" },
            response: {
              success: true,
              message: "Firewall detached",
            },
          },
        ],
      },
      {
        title: "VPS Catalog & Integrations",
        base: `${apiBase}/vps`,
        description:
          "Available plans, images, regions, and provider configurations.",
        icon: <Zap className="h-4 w-4" />,
        endpoints: [
          {
            method: "GET",
            path: "/providers",
            description:
              "List configured cloud providers available to the tenant (e.g. Linode).",
            auth: true,
            response: {
              providers: [{ id: "linode", name: "Linode", type: "linode" }],
            },
          },
          {
            method: "GET",
            path: "/providers/:providerId/regions",
            description:
              "Fetch regions for a specific provider, merged across admin-configured accounts.",
            auth: true,
            response: {
              regions: [
                { id: "us-east", label: "Newark, NJ", country: "US" },
                { id: "eu-west", label: "Frankfurt", country: "DE" },
              ],
            },
          },
          {
            method: "GET",
            path: "/plans",
            description:
              "List VPS plans (CPU, RAM, disk, transfer, pricing) used on the create VPS screen.",
            auth: true,
            response: {
              plans: [
                {
                  id: "g6-standard-2",
                  label: "Shared 2GB",
                  disk: 81920,
                  memory: 4096,
                  vcpus: 2,
                  transfer: 4000,
                  price: { hourly: 0.027, monthly: 20 },
                },
              ],
            },
          },
          {
            method: "GET",
            path: "/images",
            description:
              "Available base operating system images per provider (Linode variant).",
            auth: true,
            response: {
              images: [
                { id: "linode/ubuntu24.04", label: "Ubuntu 24.04 LTS" },
                { id: "linode/debian12", label: "Debian 12" },
              ],
            },
          },
          {
            method: "GET",
            path: "/stackscripts",
            description: "Admin curated StackScripts (when `configured=true`).",
            auth: true,
            params: { configured: true },
            response: {
              stackscripts: [
                {
                  id: 12345,
                  label: "SkyPanel StackScript",
                  user_defined_fields: [
                    { name: "db_password", label: "Database Password" },
                  ],
                },
              ],
            },
          },
          {
            method: "GET",
            path: "/linode/ssh-keys",
            description:
              "Linode SSH keys available to the authenticated organization.",
            auth: true,
            response: {
              ssh_keys: [
                {
                  id: 2001,
                  label: "shared-key",
                  ssh_key: "ssh-ed25519 AAAA...",
                },
              ],
            },
          },
          {
            method: "GET",
            path: "/apps",
            description: "Get available One-Click Apps for VPS deployment.",
            auth: true,
            response: {
              apps: [
                { id: "wordpress", name: "WordPress", description: "Popular CMS" },
                { id: "lamp", name: "LAMP", description: "Linux Apache MySQL PHP" },
              ],
            },
          },
          {
            method: "GET",
            path: "/providers/:providerId/plans/:regionId",
            description: "Get available VPS plans for a specific provider and region combination.",
            auth: true,
            response: {
              plans: [
                { id: "g6-standard-1", label: "Nanode 1GB", available: true },
              ],
            },
          },
        ],
      },
      {
        title: "VPS Networking",
        base: `${apiBase}/vps`,
        description:
          "Network configuration and reverse DNS management.",
        icon: <Server className="h-4 w-4" />,
        endpoints: [
          {
            method: "GET",
            path: "/networking/config",
            description:
              "Return platform-wide networking defaults such as the base rDNS domain.",
            auth: true,
            response: {
              config: {
                rdns_base_domain: "example.sky.network",
              },
            },
          },
          {
            method: "POST",
            path: "/:id/networking/rdns",
            description:
              "Create or update reverse DNS records for IPv4/IPv6 addresses on the instance.",
            auth: true,
            body: {
              address: "203.0.113.12",
              rdns: "host1.example.sky.network",
            },
            response: {
              success: true,
              message: "rDNS updated",
            },
          },
        ],
      },
      {
        title: "Organization SSH Keys",
        base: `${apiBase}/ssh-keys`,
        description:
          "Organization-scoped SSH key management for VPS access.",
        icon: <Lock className="h-4 w-4" />,
        endpoints: [
          {
            method: "GET",
            path: "/",
            description: "List SSH keys registered for the authenticated organization.",
            auth: true,
            response: {
              keys: [
                {
                  id: "ssh_001",
                  name: "Work Laptop",
                  public_key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA...",
                  fingerprint: "SHA256:abcd...",
                  created_at: "2024-10-20T08:00:00Z",
                },
              ],
            },
          },
          {
            method: "POST",
            path: "/",
            description: "Create a new SSH key entry for the authenticated organization.",
            auth: true,
            body: {
              name: "Work Laptop",
              publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA...",
            },
            response: {
              success: true,
              key: {
                id: "ssh_002",
                name: "Work Laptop",
                fingerprint: "SHA256:abcd...",
              },
            },
          },
          {
            method: "DELETE",
            path: "/:keyId",
            description: "Remove an SSH key from the authenticated organization.",
            auth: true,
            response: {
              success: true,
              message: "SSH key 'Work Laptop' deleted successfully",
              description: "Key removed from local database and all connected providers",
              partialSuccess: false,
            },
          },
        ],
      },
      {
        title: "Egress & Network Billing",
        base: `${apiBase}/egress`,
        description:
          "Prepaid network transfer credits, usage tracking, and hourly billing enforcement.",
        icon: <Server className="h-4 w-4" />,
        endpoints: [
          {
            method: "GET",
            path: "/credits",
            description: "Get current egress credit balance for the user's organization.",
            auth: true,
            response: {
              credits: {
                balance: 500,
                used: 125.5,
                remaining: 374.5,
                unit: "GB",
              },
            },
          },
          {
            method: "GET",
            path: "/credits/history",
            description: "Get purchase history for egress credits.",
            auth: true,
            response: {
              history: [
                {
                  id: "purchase_001",
                  amount: 1000,
                  price: 80,
                  purchasedAt: "2024-10-01T00:00:00Z",
                },
              ],
            },
          },
          {
            method: "GET",
            path: "/credits/packs",
            description: "Get available egress credit packs for purchase.",
            auth: true,
            response: {
              packs: [
                { id: "pack_100gb", name: "100GB", amount: 100, price: 10 },
                { id: "pack_1tb", name: "1TB", amount: 1000, price: 80 },
                { id: "pack_5tb", name: "5TB", amount: 5000, price: 350 },
                { id: "pack_10tb", name: "10TB", amount: 10000, price: 600 },
              ],
            },
          },
          {
            method: "POST",
            path: "/credits/purchase",
            description: "Initiate purchase of egress credit packs via PayPal.",
            auth: true,
            body: {
              packId: "pack_1tb",
            },
            response: {
              success: true,
              paymentId: "PAYID-MOCK123",
              approvalUrl: "https://paypal.com/checkout?token=PAYID-MOCK123",
            },
          },
          {
            method: "POST",
            path: "/credits/purchase/complete",
            description: "Complete egress credit purchase after PayPal approval.",
            auth: true,
            body: {
              paymentId: "PAYID-MOCK123",
            },
            response: {
              success: true,
              credits: {
                balance: 1374.5,
              },
            },
          },
          {
            method: "GET",
            path: "/usage/:vpsId",
            description: "Get hourly egress usage readings for a specific VPS.",
            auth: true,
            response: {
              readings: [
                {
                  vpsId: "vps_001",
                  timestamp: "2024-10-26T14:00:00Z",
                  inboundBytes: 1024000,
                  outboundBytes: 512000,
                },
              ],
            },
          },
          {
            method: "GET",
            path: "/usage/:vpsId/summary",
            description: "Get summarized egress usage for a VPS (totals, averages).",
            auth: true,
            response: {
              summary: {
                vpsId: "vps_001",
                totalInbound: 102400000,
                totalOutbound: 51200000,
                periodStart: "2024-10-01T00:00:00Z",
                periodEnd: "2024-10-26T23:59:59Z",
              },
            },
          },
        ],
      },
      {
        title: "Organizations",
        base: `${apiBase}/organizations`,
        description:
          "Organization management, members, roles, invitations, and egress credits.",
        icon: <Server className="h-4 w-4" />,
        endpoints: [
          {
            method: "GET",
            path: "/",
            description:
              "List organizations the authenticated user belongs to.",
            auth: true,
            response: {
              organizations: [
                {
                  id: "org_001",
                  name: "Acme Corp",
                  role: "owner",
                  createdAt: "2024-01-01T00:00:00Z",
                },
              ],
            },
          },
          {
            method: "PUT",
            path: "/:id",
            description: "Update organization details (name, settings).",
            auth: true,
            body: {
              name: "Acme Corp Updated",
            },
            response: {
              success: true,
              organization: {
                id: "org_001",
                name: "Acme Corp Updated",
              },
            },
          },
          {
            method: "GET",
            path: "/:id/members",
            description: "List members of an organization.",
            auth: true,
            response: {
              members: [
                {
                  userId: "user_123",
                  email: "admin@example.com",
                  role: "owner",
                  joinedAt: "2024-01-01T00:00:00Z",
                },
              ],
            },
          },
          {
            method: "POST",
            path: "/:id/members",
            description: "Add a user directly to an organization.",
            auth: true,
            body: {
              userId: "user_456",
              role: "member",
            },
            response: {
              success: true,
              member: {
                userId: "user_456",
                role: "member",
              },
            },
          },
          {
            method: "DELETE",
            path: "/:id/members/:userId",
            description: "Remove a member from an organization.",
            auth: true,
            response: {
              success: true,
            },
          },
          {
            method: "PUT",
            path: "/:id/members/:userId",
            description: "Update a member's role in an organization.",
            auth: true,
            body: {
              role: "admin",
            },
            response: {
              success: true,
            },
          },
          {
            method: "POST",
            path: "/:id/members/invite",
            description: "Invite a user to join an organization via email.",
            auth: true,
            body: {
              email: "newuser@example.com",
              role: "member",
            },
            response: {
              success: true,
              invitation: {
                id: "inv_001",
                email: "newuser@example.com",
                role: "member",
                token: "inv_token_abc123",
              },
            },
          },
          {
            method: "GET",
            path: "/:id/invitations",
            description: "List pending invitations for an organization.",
            auth: true,
            response: {
              invitations: [
                {
                  id: "inv_001",
                  email: "pending@example.com",
                  role: "member",
                  expiresAt: "2024-10-30T00:00:00Z",
                },
              ],
            },
          },
          {
            method: "GET",
            path: "/:id/roles",
            description: "List available roles for an organization.",
            auth: true,
            response: {
              roles: [
                { id: "owner", name: "Owner", permissions: ["*"] },
                { id: "admin", name: "Admin", permissions: ["vps.*", "billing.view"] },
                { id: "member", name: "Member", permissions: ["vps.view", "vps.create"] },
              ],
            },
          },
          {
            method: "POST",
            path: "/:id/roles",
            description: "Create a custom role for an organization.",
            auth: true,
            body: {
              name: "Billing Manager",
              permissions: ["billing.view", "billing.manage"],
            },
            response: {
              success: true,
              role: {
                id: "role_custom_001",
                name: "Billing Manager",
                permissions: ["billing.view", "billing.manage"],
              },
            },
          },
          {
            method: "PUT",
            path: "/:id/roles/:roleId",
            description: "Update a custom organization's role.",
            auth: true,
            body: {
              name: "Billing Manager",
              permissions: ["billing.view", "billing.manage", "billing.refund"],
            },
            response: {
              id: "role_001",
              organization_id: "org_001",
              name: "Billing Manager",
              permissions: ["billing.view", "billing.manage", "billing.refund"],
              is_system: false,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-10-25T10:00:00Z",
            },
          },
          {
            method: "DELETE",
            path: "/:id/roles/:roleId",
            description: "Delete a custom organization role.",
            auth: true,
            response: {
              message: "Role deleted successfully",
            },
          },
          {
            method: "GET",
            path: "/resources",
            description: "Get aggregated resource usage across all organizations the user has access to.",
            auth: true,
            response: {
              resources: {
                vpsCount: 10,
                totalCpu: 20,
                totalMemory: 40960,
                totalStorage: 819200,
              },
            },
          },
          {
            method: "GET",
            path: "/invitations/:token",
            description: "Get details of a pending invitation by token.",
            auth: true,
            response: {
              invitation: {
                id: "inv_001",
                organizationName: "Acme Corp",
                role: "member",
                expiresAt: "2024-10-30T00:00:00Z",
              },
            },
          },
          {
            method: "POST",
            path: "/invitations/:token/accept",
            description: "Accept an organization invitation.",
            auth: true,
            response: {
              success: true,
              message: "Invitation accepted",
            },
          },
          {
            method: "POST",
            path: "/invitations/:token/decline",
            description: "Decline an organization invitation.",
            auth: true,
            response: {
              success: true,
              message: "Invitation declined",
            },
          },
          {
            method: "DELETE",
            path: "/invitations/:id",
            description: "Cancel a pending invitation.",
            auth: true,
            response: {
              message: "Invitation cancelled successfully",
            },
          },
          {
            method: "GET",
            path: "/:id/egress",
            description: "Get egress data for an organization.",
            auth: true,
            response: {
              egress: {
                totalUsed: 125.5,
                unit: "GB",
              },
            },
          },
          {
            method: "GET",
            path: "/:id/egress/credits",
            description: "Get egress credit balance for an organization.",
            auth: true,
            response: {
              credits: {
                balance: 500,
                used: 125.5,
                remaining: 374.5,
                unit: "GB",
              },
            },
          },
          {
            method: "GET",
            path: "/:id/egress/credits/packs",
            description: "Get available egress credit packs for purchase.",
            auth: true,
            response: {
              packs: [
                { id: "pack_100gb", name: "100GB", amount: 100, price: 10 },
                { id: "pack_1tb", name: "1TB", amount: 1000, price: 80 },
              ],
            },
          },
          {
            method: "POST",
            path: "/:id/egress/credits/purchase",
            description: "Initiate purchase of egress credit packs via PayPal.",
            auth: true,
            body: {
              packId: "pack_1tb",
            },
            response: {
              success: true,
              paymentId: "PAYID-MOCK123",
              approvalUrl: "https://paypal.com/checkout?token=PAYID-MOCK123",
            },
          },
          {
            method: "POST",
            path: "/:id/egress/credits/purchase/complete",
            description: "Complete egress credit purchase after PayPal approval.",
            auth: true,
            body: {
              paymentId: "PAYID-MOCK123",
            },
            response: {
              success: true,
              credits: {
                balance: 1374.5,
              },
            },
          },
        ],
      },
      {
        title: "Activity & Audit Log",
        base: `${apiBase}/activity`,
        description:
          "Activity logging, filtering, and CSV export.",
        icon: <Code2 className="h-4 w-4" />,
        endpoints: [
          {
            method: "GET",
            path: "/",
            description:
              "Fetch paginated activity events filtered by date, type, and status.",
            auth: true,
            params: { page: 1, status: "success" },
            response: {
              activities: [
                {
                  id: "act_001",
                  type: "vps",
                  message: "Provisioned production-web-1",
                  status: "success",
                  timestamp: "2024-10-25T08:00:00Z",
                },
              ],
              pagination: { page: 1, totalPages: 5 },
            },
          },
          {
            method: "GET",
            path: "/recent",
            description:
              "Return the latest activity entries for dashboard summaries (limit fixed to 10).",
            auth: true,
            params: { limit: 10 },
            response: {
              activities: [
                {
                  id: "act_001",
                  type: "billing",
                  message: "Wallet credited via PayPal",
                  status: "success",
                  timestamp: "2024-10-26T14:55:00Z",
                },
              ],
            },
          },
          {
            method: "GET",
            path: "/export",
            description:
              "Export activity log as CSV.",
            auth: true,
            params: { format: "csv" },
            response: {
              contentType: "text/csv",
              body: "CSV data stream",
            },
          },
          {
            method: "GET",
            path: "/summary",
            description: "Get activity summary counts by type and status.",
            auth: true,
            response: {
              summary: {
                total: 150,
                byType: { vps: 80, billing: 40, support: 30 },
                byStatus: { success: 140, error: 10 },
              },
            },
          },
        ],
      },
      {
        title: "Activities Feed",
        base: `${apiBase}/activities`,
        description:
          "User activity feed management with organization-scoped queries and bulk read operations.",
        icon: <Activity className="h-4 w-4" />,
        endpoints: [
          {
            method: "GET",
            path: "/",
            description:
              "Fetch paginated activity events filtered by organization membership.",
            auth: true,
            params: { limit: 50, offset: 0 },
            response: {
              activities: [
                {
                  id: "act_001",
                  type: "vps",
                  message: "VPS created",
                  organizationId: "org_001",
                  userId: "user_123",
                  status: "success",
                  createdAt: "2024-10-25T08:00:00Z",
                  isRead: false,
                },
              ],
              pagination: { hasMore: false },
            },
          },
          {
            method: "DELETE",
            path: "/:id",
            description: "Delete a specific activity item.",
            auth: true,
            response: {
              message: "Activity deleted",
            },
          },
          {
            method: "PUT",
            path: "/:id/read",
            description: "Mark a specific activity item as read.",
            auth: true,
            response: {
              message: "Activity marked as read",
            },
          },
          {
            method: "GET",
            path: "/organization/:organizationId",
            description: "Fetch activities filtered by a specific organization.",
            auth: true,
            params: { organizationId: "org_123" },
            response: {
              activities: [
                {
                  id: "act_001",
                  type: "vps",
                  message: "VPS created",
                  organizationId: "org_123",
                  status: "success",
                  createdAt: "2024-10-25T08:00:00Z",
                },
              ],
            },
          },
          {
            method: "PUT",
            path: "/read-all",
            description: "Mark all activity items as read for the authenticated user.",
            auth: true,
            response: {
              message: "All activities marked as read",
            },
          },
          {
            method: "GET",
            path: "/unread-count",
            description: "Get the count of unread activity items for the authenticated user.",
            auth: true,
            response: {
              count: 5,
            },
          },
        ],
      },
      {
        title: "Support Tickets",
        base: `${apiBase}/support`,
        description:
          "Support ticket management and real-time updates.",
        icon: <Server className="h-4 w-4" />,
        endpoints: [
          {
            method: "GET",
            path: "/tickets",
            description:
              "List support tickets created by the authenticated organization.",
            auth: true,
            response: {
              tickets: [
                {
                  id: "ticket_001",
                  subject: "Unable to reach SSH",
                  status: "open",
                  priority: "high",
                  category: "vps",
                  created_at: "2024-10-24T10:00:00Z",
                  updated_at: "2024-10-24T12:00:00Z",
                  has_staff_reply: true,
                },
              ],
            },
          },
          {
            method: "POST",
            path: "/tickets",
            description: "Create a new support ticket from the dashboard.",
            auth: true,
            body: {
              subject: "Unable to reach SSH",
              message: "Port 22 is timing out after provisioning.",
              priority: "high",
              category: "vps",
            },
            response: {
              ticket: {
                id: "ticket_002",
                subject: "Unable to reach SSH",
                status: "open",
              },
            },
          },
          {
            method: "GET",
            path: "/tickets/:id/replies",
            description:
              "Fetch threaded replies for a ticket when opening the detail drawer.",
            auth: true,
            response: {
              replies: [
                {
                  id: "reply_001",
                  ticket_id: "ticket_001",
                  sender_type: "admin",
                  message: "We're investigating the networking configuration.",
                  created_at: "2024-10-24T11:00:00Z",
                },
              ],
            },
          },
          {
            method: "POST",
            path: "/tickets/:id/replies",
            description: "Submit a reply to an existing support ticket.",
            auth: true,
            body: {
              message: "Thanks! Issue resolved after reboot.",
            },
            response: {
              reply: {
                id: "reply_002",
                ticket_id: "ticket_001",
                message: "Thanks! Issue resolved after reboot.",
                created_at: "2024-10-24T12:30:00Z",
              },
            },
          },
          {
            method: "GET",
            path: "/tickets/:id/stream",
            description:
              "Server-sent event stream for live ticket updates; token is passed via query string.",
            auth: false,
            params: { token: "JWT_TOKEN" },
            response: {
              eventStream: true,
              examples: [
                'data: {"type":"ticket_message","ticket_id":"ticket_001","message_id":"reply_002","message":"New reply","is_staff_reply":true}',
                'data: {"type":"ticket_status_change","ticket_id":"ticket_001","new_status":"resolved"}',
              ],
            },
          },
          {
            method: "DELETE",
            path: "/tickets/:id",
            description: "Delete a support ticket (admin or owner only).",
            auth: true,
            response: {
              message: "Ticket deleted successfully",
              ticket_id: "ticket_001",
            },
          },
          {
            method: "PUT",
            path: "/tickets/:id/assign",
            description: "Assign a support ticket to a staff member.",
            auth: true,
            body: { assignedTo: "admin@company.com" },
            response: {
              ticket: {
                id: "ticket_001",
                subject: "Unable to reach SSH",
                status: "open",
                priority: "high",
                assigned_to: "user_123",
                updated_at: "2024-10-24T12:00:00Z",
              },
            },
          },
          {
            method: "PUT",
            path: "/tickets/:id/priority",
            description: "Update the priority level of a support ticket.",
            auth: true,
            body: { priority: "high" },
            response: {
              ticket: {
                id: "ticket_001",
                subject: "Unable to reach SSH",
                status: "open",
                priority: "high",
                updated_at: "2024-10-24T12:00:00Z",
              },
            },
          },
          {
            method: "POST",
            path: "/tickets/:id/reopen-request",
            description: "Request to reopen a closed support ticket.",
            auth: true,
            body: { reason: "Issue has returned" },
            response: {
              success: true,
              message: "Reopen request submitted",
            },
          },
          {
            method: "PUT",
            path: "/tickets/:id/status",
            description: "Update the status of a support ticket.",
            auth: true,
            body: { status: "resolved" },
            response: {
              ticket: {
                id: "ticket_001",
                subject: "Unable to reach SSH",
                status: "resolved",
                priority: "high",
                updated_at: "2024-10-24T12:00:00Z",
              },
            },
          },
          {
            method: "PUT",
            path: "/tickets/:id/replies/:replyId",
            description: "Edit an existing reply on a ticket.",
            auth: true,
            body: { message: "Updated reply content" },
            response: {
              reply: {
                id: "reply_001",
                ticket_id: "ticket_001",
                message: "Updated reply content",
                created_at: "2024-10-24T11:00:00Z",
              },
            },
          },
          {
            method: "DELETE",
            path: "/tickets/:id/replies/:replyId",
            description: "Delete a reply from a ticket.",
            auth: true,
            response: {
              message: "Reply deleted successfully",
              reply_id: "reply_001",
            },
          },
        ],
      },
      {
        title: "Notifications",
        base: `${apiBase}/notifications`,
        description:
          "Real-time notifications via SSE with read status management.",
        icon: <Zap className="h-4 w-4" />,
        endpoints: [
          {
            method: "GET",
            path: "/",
            description: "List all notifications for the authenticated user.",
            auth: true,
            params: { limit: 50, offset: 0 },
            response: {
              notifications: [
                {
                  id: "notif_001",
                  event_type: "vps.created",
                  message: "VPS production-web-1 provisioned successfully",
                  is_read: false,
                  created_at: "2024-10-26T14:55:00Z",
                },
              ],
              pagination: { hasMore: false },
            },
          },
          {
            method: "GET",
            path: "/unread",
            description:
              "Load the latest unread notifications for the dropdown.",
            auth: true,
            params: { limit: 20 },
            response: {
              notifications: [
                {
                  id: "notif_001",
                  event_type: "vps.created",
                  entity_type: "vps",
                  entity_id: "vps_001",
                  message: "VPS production-web-1 provisioned successfully",
                  status: "success",
                  created_at: "2024-10-26T14:55:00Z",
                  is_read: false,
                },
              ],
            },
          },
          {
            method: "GET",
            path: "/unread-count",
            description:
              "Return the unread notification count used for the badge indicator.",
            auth: true,
            response: {
              count: 3,
            },
          },
          {
            method: "PATCH",
            path: "/:id/read",
            description: "Mark a notification as read after the user opens it.",
            auth: true,
            response: {
              success: true,
              message: "Notification marked as read",
            },
          },
          {
            method: "PATCH",
            path: "/read-all",
            description: "Mark every notification as read.",
            auth: true,
            response: {
              success: true,
              message: "3 notification(s) marked as read",
              count: 3,
            },
          },
          {
            method: "GET",
            path: "/stream",
            description:
              "Server-sent event stream delivering live notifications. Token supplied via query string.",
            auth: true,
            params: { token: "JWT_TOKEN" },
            response: {
              eventStream: true,
              examples: [
                'data: {"type":"notification","data":{"id":"notif_001","event_type":"vps.created","message":"VPS ready"}}',
              ],
            },
          },
        ],
      },
      {
        title: "Admin Platform Management",
        base: `${apiBase}/admin`,
        description:
          "Admin-only endpoints for user management, tickets, FAQs, and platform configuration.",
        icon: <Lock className="h-4 w-4" />,
        endpoints: [
          {
            method: "GET",
            path: "/users",
            description:
              "List users in the tenant including role, status, and MFA state.",
            auth: true,
            response: {
              users: [
                {
                  id: "user_123",
                  email: "admin@example.com",
                  role: "owner",
                  status: "active",
                  mfaEnabled: true,
                  createdAt: "2024-01-05T00:00:00Z",
                },
              ],
            },
          },
          {
            method: "PUT",
            path: "/users/:id",
            description:
              "Update a user's role or account status (used by the admin user editor).",
            auth: true,
            body: {
              role: "admin",
              status: "active",
            },
            response: {
              success: true,
              user: { id: "user_456", role: "admin", status: "active" },
            },
          },
          {
            method: "POST",
            path: "/users/:id/impersonate",
            description:
              "Start an impersonation session as the target user (admin only).",
            auth: true,
            response: {
              success: true,
              token: "impersonation_jwt",
            },
          },
          {
            method: "POST",
            path: "/impersonation/exit",
            description:
              "End an active impersonation session and restore the admin's identity.",
            auth: true,
            response: {
              adminToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
              admin: {
                id: "user_123",
                email: "admin@skypanelv2.com",
                name: "Admin User",
                firstName: "Admin",
                lastName: "User",
                role: "admin",
                phone: "+1-555-555-0100",
                timezone: "America/New_York",
                preferences: {},
                twoFactorEnabled: true,
                organizationId: "org_001",
              },
              message: "Impersonation session ended successfully",
            },
          },
          {
            method: "GET",
            path: "/tickets",
            description:
              "Administrative view of all support tickets across the tenant.",
            auth: true,
            response: {
              tickets: [
                {
                  id: "ticket_001",
                  organization: "Example Corp",
                  subject: "Unable to reach SSH",
                  status: "open",
                  priority: "high",
                  created_at: "2024-10-24T10:00:00Z",
                },
              ],
            },
          },
          {
            method: "POST",
            path: "/tickets/:id/replies",
            description: "Post an admin reply to a customer ticket.",
            auth: true,
            body: { message: "Please reboot the VPS and confirm." },
            response: {
              reply: {
                id: "reply_admin_001",
                ticket_id: "ticket_001",
                message: "Please reboot the VPS and confirm.",
                created_at: "2024-10-24T11:30:00Z",
              },
            },
          },
          {
            method: "PATCH",
            path: "/tickets/:id/status",
            description:
              "Update a ticket's status (open, pending, resolved, closed).",
            auth: true,
            body: { status: "resolved" },
            response: {
              ticket: {
                id: "ticket_001",
                organization_id: "org_001",
                created_by: "user_123",
                subject: "Unable to reach SSH",
                message: "Port 22 is timing out",
                priority: "high",
                category: "vps",
                status: "resolved",
                vps_id: "vps_001",
                vps_label_snapshot: "web-server-01",
                vps_ip_snapshot: "192.168.1.100",
                created_at: "2024-10-24T10:00:00Z",
                updated_at: "2024-10-24T12:00:00Z",
                has_staff_reply: true,
              },
            },
          },
          {
            method: "DELETE",
            path: "/tickets/:id",
            description: "Delete a ticket (used for spam/cleanup).",
            auth: true,
            response: null,
          },
          {
            method: "GET",
            path: "/faq/categories",
            description:
              "List FAQ categories surfaced on the public marketing site.",
            auth: true,
            response: {
              categories: [
                {
                  id: "cat_general",
                  name: "General",
                  display_order: 1,
                  is_enabled: true,
                },
              ],
            },
          },
          {
            method: "POST",
            path: "/faq/categories",
            description: "Create a new FAQ category.",
            auth: true,
            body: { name: "Billing", description: "Invoices, refunds" },
            response: {
              category: {
                id: "cat_billing",
                name: "Billing",
                display_order: 2,
                is_enabled: true,
              },
            },
          },
          {
            method: "PUT",
            path: "/faq/categories/:id",
            description: "Update category metadata.",
            auth: true,
            body: {
              name: "Billing",
              description: "Invoices, refunds",
              is_enabled: true,
            },
            response: {
              category: {
                id: "cat_billing",
                name: "Billing",
                is_enabled: true,
              },
            },
          },
          {
            method: "DELETE",
            path: "/faq/categories/:id",
            description: "Remove a category (questions must be moved first).",
            auth: true,
            response: null,
          },
          {
            method: "POST",
            path: "/faq/categories/reorder",
            description: "Persist drag-and-drop ordering of FAQ categories.",
            auth: true,
            body: { order: ["cat_general", "cat_billing"] },
            response: {
              message: "Categories reordered successfully",
            },
          },
          {
            method: "GET",
            path: "/faq/items",
            description: "List FAQ entries and their content.",
            auth: true,
            response: {
              items: [
                {
                  id: "faq_001",
                  category_id: "cat_general",
                  question: "What is SkyPANEL?",
                  answer: "SkyPANEL manages VPS workloads across providers.",
                },
              ],
            },
          },
          {
            method: "POST",
            path: "/faq/items",
            description: "Create a new FAQ item.",
            auth: true,
            body: {
              category_id: "cat_general",
              question: "How do I reset my password?",
              answer: "Use the Forgot Password link on the login page.",
            },
            response: {
              item: { id: "faq_002", question: "How do I reset my password?" },
            },
          },
          {
            method: "PUT",
            path: "/faq/items/:id",
            description: "Update an existing FAQ entry.",
            auth: true,
            body: {
              category_id: "cat_general",
              question: "How do I reset my password?",
              answer: "Click Forgot Password on the login page.",
            },
            response: {
              item: { id: "faq_002", question: "How do I reset my password?" },
            },
          },
          {
            method: "DELETE",
            path: "/faq/items/:id",
            description: "Delete an FAQ item.",
            auth: true,
            response: null,
          },
          {
            method: "POST",
            path: "/faq/items/reorder",
            description: "Persist the order of FAQ items within a category.",
            auth: true,
            body: { order: ["faq_001", "faq_002"] },
            response: {
              message: "Items reordered successfully",
            },
          },
          {
            method: "GET",
            path: "/faq/updates",
            description:
              "Changelog/updates entries surfaced on marketing pages.",
            auth: true,
            response: {
              updates: [
                {
                  id: "update_001",
                  title: "October platform update",
                  content: "Enhanced Linode support",
                  display_order: 1,
                },
              ],
            },
          },
          {
            method: "POST",
            path: "/faq/updates",
            description: "Create a changelog update.",
            auth: true,
            body: {
              title: "October platform update",
              content: "Enhanced Linode support",
            },
            response: {
              update: { id: "update_001", title: "October platform update" },
            },
          },
          {
            method: "PUT",
            path: "/faq/updates/:id",
            description: "Edit a changelog update entry.",
            auth: true,
            body: {
              title: "October platform update",
              content: "Added provider integrations",
            },
            response: {
              update: { id: "update_001", title: "October platform update" },
            },
          },
          {
            method: "DELETE",
            path: "/faq/updates/:id",
            description: "Delete a changelog entry.",
            auth: true,
            response: null,
          },
          {
            method: "POST",
            path: "/faq/updates/reorder",
            description: "Persist update ordering for marketing pages.",
            auth: true,
            body: { order: ["update_001", "update_002"] },
            response: {
              message: "Updates reordered successfully",
            },
          },
          {
            method: "GET",
            path: "/contact/categories",
            description:
              "List support contact categories (used on contact page).",
            auth: true,
            response: {
              categories: [{ id: "sales", label: "Sales", is_enabled: true }],
            },
          },
          {
            method: "POST",
            path: "/contact/categories",
            description: "Create a support contact category.",
            auth: true,
            body: {
              label: "Sales",
              email: "sales@example.com",
              is_enabled: true,
            },
            response: {
              category: { id: "sales", label: "Sales", is_enabled: true },
            },
          },
          {
            method: "PUT",
            path: "/contact/categories/:id",
            description: "Update contact category metadata.",
            auth: true,
            body: {
              label: "Sales",
              email: "sales@example.com",
              is_enabled: true,
            },
            response: {
              category: { id: "sales", label: "Sales", is_enabled: true },
            },
          },
          {
            method: "DELETE",
            path: "/contact/categories/:id",
            description: "Delete a contact category.",
            auth: true,
            response: null,
          },
          {
            method: "POST",
            path: "/contact/categories/reorder",
            description: "Reorder contact categories.",
            auth: true,
            body: { order: ["sales", "support"] },
            response: {
              categories: [
                {
                  id: "sales",
                  label: "Sales",
                  value: "sales",
                  display_order: 1,
                  is_active: true,
                  created_at: "2024-01-01T00:00:00Z",
                  updated_at: "2024-10-01T00:00:00Z",
                },
              ],
            },
          },
          {
            method: "GET",
            path: "/contact/methods",
            description:
              "Retrieve available contact methods (email, phone, chat).",
            auth: true,
            response: {
              methods: {
                email: { is_enabled: true, address: "support@example.com" },
                phone: { is_enabled: false },
              },
            },
          },
          {
            method: "PUT",
            path: "/contact/methods/:method_type",
            description:
              "Update a specific contact method configuration (e.g. toggle live chat).",
            auth: true,
            body: { is_enabled: true, address: "support@example.com" },
            response: {
              method: { type: "email", is_enabled: true },
            },
          },
          {
            method: "GET",
            path: "/contact/methods/:method_type",
            description: "Get a specific contact method configuration.",
            auth: true,
            response: {
              method: { type: "email", is_enabled: true, address: "support@example.com" },
            },
          },
          {
            method: "GET",
            path: "/providers",
            description:
              "List infrastructure providers configured in the admin panel.",
            auth: true,
            response: {
              providers: [{ id: "linode", name: "Linode", type: "linode" }],
            },
          },
          {
            method: "GET",
            path: "/providers/:id/regions",
            description:
              "Return provider regions with admin-specific metadata (availability, visibility).",
            auth: true,
            response: {
              regions: [{ id: "us-east", label: "Newark, NJ", enabled: true }],
            },
          },
          {
            method: "GET",
            path: "/rate-limits/overrides",
            description: "List rate limit overrides applied to specific users.",
            auth: true,
            response: {
              overrides: [{ userId: "user_123", window: 60, maxRequests: 120 }],
            },
          },
          {
            method: "POST",
            path: "/rate-limits/overrides",
            description: "Create or update a rate limit override for a user.",
            auth: true,
            body: { userId: "user_123", window: 60, maxRequests: 120 },
            response: {
              success: true,
              override: {
                id: "override_001",
                user_id: "user_123",
                max_requests: 120,
                window_ms: 60000,
                reason: "Customer support case",
                created_by: "admin_001",
                expires_at: null,
                created_at: "2024-10-25T10:00:00Z",
                updated_at: "2024-10-25T10:00:00Z",
              },
            },
          },
          {
            method: "DELETE",
            path: "/rate-limits/overrides/:userId",
            description: "Remove a rate limit override.",
            auth: true,
            response: {
              success: true,
              message: "Rate limit override deleted",
            },
          },
          {
            method: "GET",
            path: "/platform/availability",
            description:
              "Return global maintenance mode / availability settings displayed on the status page.",
            auth: true,
            response: {
              availability: {
                status: "operational",
                message: "All systems operational",
                updatedAt: "2024-10-25T10:00:00Z",
              },
            },
          },
          {
            method: "PUT",
            path: "/platform/availability",
            description:
              "Update availability messaging for the hosted status page.",
            auth: true,
            body: {
              status: "maintenance",
              message: "Scheduled maintenance at 22:00 UTC",
            },
            response: {
              availability: [
                {
                  id: "avail_001",
                  day_of_week: "monday",
                  is_open: true,
                  hours_text: "9:00 AM - 6:00 PM EST",
                  display_order: 1,
                  created_at: "2024-01-01T00:00:00Z",
                  updated_at: "2024-10-25T10:00:00Z",
                },
              ],
              emergency_support_text: "support@example.com",
            },
          },
          {
            method: "GET",
            path: "/theme",
            description:
              "Retrieve theming configuration (colors, logos) for the tenant.",
            auth: true,
            response: {
              theme: {
                primary: "#2563eb",
                accent: "#9333ea",
                logoUrl: "https://cdn.example.com/logo.svg",
              },
            },
          },
          {
            method: "PUT",
            path: "/theme",
            description: "Update theming configuration.",
            auth: true,
            body: {
              primary: "#2563eb",
              accent: "#9333ea",
              logoUrl: "https://cdn.example.com/logo.svg",
            },
            response: {
              theme: {
                presetId: "custom",
                customPreset: {
                  primary: "#2563eb",
                  accent: "#9333ea",
                  logoUrl: "https://cdn.example.com/logo.svg",
                },
                updatedAt: "2024-10-25T10:00:00Z",
                updatedBy: "admin_001",
              },
            },
          },
          {
            method: "GET",
            path: "/billing/stats",
            description: "Get billing statistics across all organizations.",
            auth: true,
            response: {
              stats: {
                totalRevenue: 45230.5,
                totalTransactions: 1234,
                averageTransaction: 36.65,
              },
            },
          },
          {
            method: "GET",
            path: "/billing/transactions",
            description: "List all billing transactions across the platform.",
            auth: true,
            params: {
              limit: 50,
              offset: 0,
              status: "completed",
              type: "credit",
              userId: "uuid",
            },
            response: {
              transactions: [
                {
                  id: "txn_001",
                  organizationId: "org_001",
                  amount: 100,
                  type: "credit",
                  description: "Wallet top-up",
                  createdAt: "2024-10-26T14:55:00Z",
                },
              ],
              pagination: { total: 1234, limit: 50, offset: 0 },
            },
          },
          {
            method: "POST",
            path: "/billing/transactions",
            description: "Create a manual billing transaction for an organization.",
            auth: true,
            body: {
              organizationId: "org_001",
              amount: 50,
              type: "credit",
              description: "Manual credit",
            },
            response: {
              success: true,
              transaction: { id: "txn_002" },
            },
          },
          {
            method: "POST",
            path: "/billing/transactions/:transactionId/invoice",
            description: "Generate an invoice from a billing transaction.",
            auth: true,
            response: {
              success: true,
              invoiceId: "inv_001",
            },
          },
          {
            method: "GET",
            path: "/billing/users",
            description: "Get billing summary for all users.",
            auth: true,
            params: {
              limit: 20,
              offset: 0,
              search: "example",
              sort: "balance_desc",
            },
            response: {
              success: true,
              users: [
                {
                  id: "user_123",
                  name: "John Doe",
                  email: "john@example.com",
                  created_at: "2024-01-05T00:00:00Z",
                  organization_id: "org_001",
                  organization_name: "Acme Corp",
                  balance: 125.50,
                  currency: "USD",
                  active_services: 3,
                },
              ],
              pagination: { total: 150, limit: 20, offset: 0 },
            },
          },
          {
            method: "GET",
            path: "/billing/invoices",
            description: "List all invoices across the platform.",
            auth: true,
            params: {
              limit: 20,
              offset: 0,
              userId: "uuid",
            },
            response: {
              success: true,
              invoices: [
                {
                  id: "inv_001",
                  invoiceNumber: "INV-2024-001",
                  organizationId: "org_001",
                  totalAmount: 120.5,
                  currency: "USD",
                  status: "paid",
                  createdAt: "2024-10-01T00:00:00Z",
                },
              ],
              pagination: { total: 45, limit: 20, offset: 0 },
            },
          },
          {
            method: "GET",
            path: "/billing/invoices/:id",
            description: "Get details of a specific invoice.",
            auth: true,
            response: {
              invoice: {
                id: "inv_001",
                invoiceNumber: "INV-2024-001",
                totalAmount: 120.5,
                lineItems: [{ description: "VPS usage", amount: 120.5 }],
              },
            },
          },
          {
            method: "GET",
            path: "/billing/invoices/:id/download",
            description: "Download invoice PDF.",
            auth: true,
            response: {
              contentType: "application/pdf",
              body: "<binary stream>",
            },
          },
          {
            method: "GET",
            path: "/category-mappings",
            description: "List all VPS category mappings for white-labeling.",
            auth: true,
            response: {
              categoryMappings: [
                { id: "cat_001", providerCategory: "Nanode 1GB", displayName: "Starter VPS", displayOrder: 1, isEnabled: true },
              ],
            },
          },
          {
            method: "POST",
            path: "/category-mappings",
            description: "Create a new category mapping.",
            auth: true,
            body: { providerCategory: "Nanode 1GB", displayName: "Starter VPS", displayOrder: 1 },
            response: { success: true, categoryMapping: { id: "cat_002" } },
          },
          {
            method: "GET",
            path: "/category-mappings/:id",
            description: "Get a specific category mapping.",
            auth: true,
            response: { categoryMapping: { id: "cat_001", providerCategory: "Nanode 1GB", displayName: "Starter VPS" } },
          },
          {
            method: "PUT",
            path: "/category-mappings/:id",
            description: "Update a category mapping.",
            auth: true,
            body: { displayName: "Budget VPS", displayOrder: 2 },
            response: {
              mapping: {
                id: "cat_001",
                provider_id: "provider_001",
                original_category: "Nanode 1GB",
                custom_name: "Budget VPS",
                custom_description: "Affordable starter option",
                display_order: 2,
                enabled: true,
                created_at: "2024-01-01T00:00:00Z",
                updated_at: "2024-10-25T10:00:00Z",
              },
            },
          },
          {
            method: "DELETE",
            path: "/category-mappings/:id",
            description: "Delete a category mapping.",
            auth: true,
            response: null,
          },
          {
            method: "GET",
            path: "/category-mappings/enabled",
            description: "List only enabled category mappings.",
            auth: true,
            response: { categoryMappings: [{ id: "cat_001", displayName: "Starter VPS" }] },
          },
          {
            method: "POST",
            path: "/category-mappings/reorder",
            description: "Reorder category mappings.",
            auth: true,
            body: { order: ["cat_002", "cat_001"] },
            response: {
              mappings: [
                {
                  id: "cat_002",
                  provider_id: "provider_001",
                  original_category: "Nanode 1GB",
                  custom_name: "Budget VPS",
                  custom_description: null,
                  display_order: 1,
                  enabled: true,
                  created_at: "2024-01-01T00:00:00Z",
                  updated_at: "2024-10-25T10:00:00Z",
                },
              ],
            },
          },
          {
            method: "POST",
            path: "/category-mappings/sync",
            description: "Sync category mappings from provider.",
            auth: true,
            response: { success: true, synced: 15 },
          },
          {
            method: "GET",
            path: "/email-templates",
            description: "List all email templates.",
            auth: true,
            response: {
              templates: [{ name: "welcome", subject: "Welcome to SkyPanel" }],
            },
          },
          {
            method: "GET",
            path: "/email-templates/:name",
            description: "Get a specific email template content.",
            auth: true,
            response: {
              template: { name: "welcome", subject: "Welcome to SkyPanel", body: "<html>...</html>" },
            },
          },
          {
            method: "PUT",
            path: "/email-templates/:name",
            description: "Update an email template.",
            auth: true,
            body: { subject: "Welcome to SkyPanel!", body: "<html>updated...</html>" },
            response: {
              id: 1,
              name: "welcome",
              subject: "Welcome to SkyPanel!",
              html_body: "<html>updated...</html>",
              text_body: "Welcome to SkyPanel!",
              use_default_theme: false,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-10-25T10:00:00Z",
            },
          },
          {
            method: "POST",
            path: "/email-templates/preview",
            description: "Preview an email template with variables substituted.",
            auth: true,
            body: { name: "welcome", variables: { userName: "John" } },
            response: { html: "<html>Hi John...</html>" },
          },
          {
            method: "GET",
            path: "/github/commits",
            description: "Get recent commits from the platform GitHub repository.",
            auth: true,
            response: {
              commits: [{ sha: "abc123", message: "Fix bug", author: "dev", date: "2024-10-26T10:00:00Z" }],
            },
          },
          {
            method: "GET",
            path: "/networking/rdns",
            description: "Get platform-wide reverse DNS configuration.",
            auth: true,
            response: {
              rdns: { baseDomain: "example.sky.network", enabled: true },
            },
          },
          {
            method: "PUT",
            path: "/networking/rdns",
            description: "Update reverse DNS configuration.",
            auth: true,
            body: { baseDomain: "newexample.sky.network" },
            response: {
              config: {
                id: "net_001",
                rdns_base_domain: "newexample.sky.network",
                created_at: "2024-01-01T00:00:00Z",
                updated_at: "2024-10-25T10:00:00Z",
              },
            },
          },
          {
            method: "GET",
            path: "/organizations",
            description: "List all organizations on the platform.",
            auth: true,
            response: {
              organizations: [{ id: "org_001", name: "Acme Corp", memberCount: 5 }],
            },
          },
          {
            method: "POST",
            path: "/organizations",
            description: "Create a new organization.",
            auth: true,
            body: { name: "New Corp" },
            response: { success: true, organization: { id: "org_002", name: "New Corp" } },
          },
          {
            method: "PUT",
            path: "/organizations/:id",
            description: "Update an organization.",
            auth: true,
            body: { name: "Updated Corp" },
            response: {
              message: "Organization updated",
              organization: {
                id: "org_001",
                name: "Updated Corp",
                owner_id: "user_001",
                created_at: "2024-01-01T00:00:00Z",
                updated_at: "2024-10-25T10:00:00Z",
              },
            },
          },
          {
            method: "DELETE",
            path: "/organizations/:id",
            description: "Delete an organization.",
            auth: true,
            response: null,
          },
          {
            method: "POST",
            path: "/organizations/:id/members",
            description: "Add a user to an organization.",
            auth: true,
            body: { userId: "user_456", role: "member" },
            response: {
              success: true,
              member: {
                user_id: "user_456",
                organization_id: "org_001",
                role_id: "role_member",
                joined_at: "2024-10-25T10:00:00Z",
              },
            },
          },
          {
            method: "PUT",
            path: "/organizations/:id/members/:userId",
            description: "Update a member's role in an organization.",
            auth: true,
            body: { role: "admin" },
            response: {
              message: "Member role updated",
              memberId: "user_456",
              newRole: "admin",
            },
          },
          {
            method: "DELETE",
            path: "/organizations/:id/members/:userId",
            description: "Remove a member from an organization.",
            auth: true,
            response: {
              message: "Member removed",
              memberId: "user_456",
            },
          },
          {
            method: "GET",
            path: "/plans",
            description: "List all VPS plans available on the platform.",
            auth: true,
            response: {
              plans: [{ id: "g6-standard-2", label: "Shared 2GB", price: { hourly: 0.027, monthly: 20 } }],
            },
          },
          {
            method: "POST",
            path: "/plans",
            description: "Create a new VPS plan.",
            auth: true,
            body: { label: "Custom Plan", price: { hourly: 0.05, monthly: 40 } },
            response: { success: true, plan: { id: "plan_001" } },
          },
          {
            method: "PUT",
            path: "/plans/:id",
            description: "Update a VPS plan.",
            auth: true,
            body: { label: "Updated Plan", price: { hourly: 0.06, monthly: 45 } },
            response: {
              success: true,
              plan: {
                id: "g6-standard-2",
                label: "Updated Plan",
                provider: "linode",
                type_class: "standard",
                price: { hourly: 0.06, monthly: 45 },
                updated_at: "2024-10-25T10:00:00Z",
              },
            },
          },
          {
            method: "DELETE",
            path: "/plans/:id",
            description: "Delete a VPS plan.",
            auth: true,
            response: null,
          },
          {
            method: "GET",
            path: "/providers",
            description: "List all configured infrastructure providers.",
            auth: true,
            response: {
              providers: [{ id: "linode", name: "Linode", type: "linode", status: "active" }],
            },
          },
          {
            method: "POST",
            path: "/providers",
            description: "Add a new infrastructure provider.",
            auth: true,
            body: { name: "New Provider", type: "linode", apiToken: "token" },
            response: { success: true, provider: { id: "prov_001" } },
          },
          {
            method: "PUT",
            path: "/providers/:id",
            description: "Update a provider configuration.",
            auth: true,
            body: { name: "Updated Provider", apiToken: "newtoken" },
            response: {
              success: true,
              provider: {
                id: "linode",
                name: "Updated Provider",
                type: "linode",
                status: "active",
                metadata: { regions_enabled: 10 },
                created_at: "2024-01-01T00:00:00Z",
                updated_at: "2024-10-25T10:00:00Z",
              },
            },
          },
          {
            method: "DELETE",
            path: "/providers/:id",
            description: "Remove a provider.",
            auth: true,
            response: null,
          },
          {
            method: "GET",
            path: "/providers/:id/regions",
            description: "Get available regions for a provider.",
            auth: true,
            response: {
              regions: [{ id: "us-east", label: "Newark, NJ", country: "US", enabled: true }],
            },
          },
          {
            method: "PUT",
            path: "/providers/:id/regions",
            description: "Update provider region configuration.",
            auth: true,
            body: { mode: "custom", regions: ["us-east", "us-west"] },
            response: {
              success: true,
              mode: "custom",
              allowedRegions: ["us-east", "us-west"],
              message: "Configured 2 allowed regions",
            },
          },
          {
            method: "POST",
            path: "/providers/:id/validate",
            description: "Validate provider credentials.",
            auth: true,
            response: { valid: true, message: "Credentials are valid" },
          },
          {
            method: "PUT",
            path: "/providers/reorder",
            description: "Reorder providers for display priority.",
            auth: true,
            body: { order: ["linode", "aws"] },
            response: {
              success: true,
              providers: [
                { id: "linode", name: "Linode", type: "linode", display_order: 1 },
                { id: "aws", name: "AWS", type: "aws", display_order: 2 },
              ],
            },
          },
          {
            method: "GET",
            path: "/servers",
            description: "Get list of infrastructure servers.",
            auth: true,
            response: {
              servers: [{ id: "srv_001", hostname: "node1", status: "online", provider: "linode" }],
            },
          },
          {
            method: "GET",
            path: "/stackscripts/configs",
            description: "List curated StackScript configurations.",
            auth: true,
            response: {
              configs: [{ id: 12345, label: "LAMP Stack", description: "Linux Apache MySQL PHP" }],
            },
          },
          {
            method: "POST",
            path: "/stackscripts/configs",
            description: "Create a new StackScript configuration.",
            auth: true,
            body: { label: "MEAN Stack", scriptId: 12346 },
            response: { success: true, config: { id: 12347 } },
          },
          {
            method: "PUT",
            path: "/stackscripts/configs/:id",
            description: "Update a StackScript configuration.",
            auth: true,
            body: { label: "Updated MEAN Stack" },
            response: {
              success: true,
              config: {
                id: 12345,
                label: "Updated MEAN Stack",
                description: "MongoDB Express Angular Node.js",
                script_id: 12346,
                updated_at: "2024-10-25T10:00:00Z",
              },
            },
          },
          {
            method: "DELETE",
            path: "/stackscripts/configs/:id",
            description: "Delete a StackScript configuration.",
            auth: true,
            response: null,
          },
          {
            method: "GET",
            path: "/tickets/:id/replies",
            description: "Get all replies for an admin ticket view.",
            auth: true,
            response: {
              replies: [{ id: "reply_001", message: "Customer reply", createdAt: "2024-10-24T10:00:00Z" }],
            },
          },
          {
            method: "GET",
            path: "/tickets/:id/stream",
            description: "SSE stream for admin ticket updates.",
            auth: false,
            params: { token: "ADMIN_TOKEN" },
            response: { eventStream: true },
          },
          {
            method: "GET",
            path: "/upstream/plans",
            description: "Fetch available plans from upstream provider.",
            auth: true,
            response: {
              plans: [{ id: "g6-standard-1", label: "Nanode 1GB", price: { hourly: 0.0075 } }],
            },
          },
          {
            method: "GET",
            path: "/upstream/regions",
            description: "Fetch available regions from upstream provider.",
            auth: true,
            response: {
              regions: [{ id: "us-east", label: "Newark, NJ" }],
            },
          },
          {
            method: "GET",
            path: "/upstream/stackscripts",
            description: "Fetch available StackScripts from upstream provider.",
            auth: true,
            response: {
              stackscripts: [{ id: 12345, label: "My Script" }],
            },
          },
          {
            method: "GET",
            path: "/users/:id",
            description: "Get a specific user by ID.",
            auth: true,
            response: {
              user: { id: "user_123", email: "user@example.com", role: "user", status: "active" },
            },
          },
          {
            method: "GET",
            path: "/users/:id/detail",
            description: "Get detailed user information including billing and VPS summary.",
            auth: true,
            response: {
              user: {
                id: "user_123",
                email: "user@example.com",
                billing: { totalSpent: 450.75 },
                vpsCount: 3,
              },
            },
          },
          {
            method: "GET",
            path: "/users/search",
            description: "Search users by email or name.",
            auth: true,
            params: { q: "user@example.com" },
            response: {
              users: [{ id: "user_123", email: "user@example.com" }],
            },
          },
          {
            method: "DELETE",
            path: "/users/:id",
            description: "Delete a user account.",
            auth: true,
            response: null,
          },
          {
            method: "GET",
            path: "/egress/pricing",
            description: "Get current egress pricing configuration.",
            auth: true,
            response: {
              pricing: { basePricePerGB: 0.01, regions: [{ id: "us-east", pricePerGB: 0.008 }] },
            },
          },
          {
            method: "POST",
            path: "/egress/pricing/sync",
            description: "Sync egress pricing from upstream provider.",
            auth: true,
            response: { success: true, synced: true },
          },
          {
            method: "PUT",
            path: "/egress/pricing/:regionId",
            description: "Update egress pricing for a specific region.",
            auth: true,
            body: { pricePerGB: 0.009 },
            response: {
              success: true,
              region: {
                id: "us-east",
                price_per_gb: 0.009,
                updated_at: "2024-10-25T10:00:00Z",
              },
            },
          },
          {
            method: "GET",
            path: "/egress/live-usage",
            description: "Get live egress usage across all organizations.",
            auth: true,
            response: {
              usage: [{ organizationId: "org_001", currentUsageGB: 125.5, poolQuotaGB: 1000 }],
            },
          },
          {
            method: "POST",
            path: "/egress/execute",
            description: "Execute egress billing operations (charge organizations).",
            auth: true,
            body: { operation: "charge" },
            response: { success: true, charged: 15 },
          },
          {
            method: "GET",
            path: "/egress/history",
            description: "Get egress billing history.",
            auth: true,
            params: { limit: 50 },
            response: {
              history: [{ id: "egress_001", amount: 100, chargedAt: "2024-10-26T10:00:00Z" }],
            },
          },
        ],
      },
      {
        title: "Platform Health",
        base: `${apiBase}/health`,
        description:
          "Public and authenticated health check endpoints.",
        icon: <Server className="h-4 w-4" />,
        endpoints: [
          {
            method: "GET",
            path: "/",
            description: "Basic health check.",
            response: {
              success: true,
              message: "API is healthy",
              timestamp: "2024-10-25T10:00:00Z",
            },
          },
          {
            method: "GET",
            path: "/status",
            description: "Public platform status with VPS counts.",
            response: {
              status: "operational",
              vpsStats: { running: 150, stopped: 20, provisioning: 5 },
              updatedAt: "2024-10-25T10:00:00Z",
            },
          },
          {
            method: "GET",
            path: "/detailed",
            description: "Detailed health check with rate limiting info.",
            response: {
              health: "ok",
              rateLimiting: { status: "healthy" },
            },
          },
          {
            method: "GET",
            path: "/stats",
            description: "VPS infrastructure metrics.",
            response: {
              totalInstances: 175,
              byStatus: { running: 150, stopped: 20 },
            },
          },
          {
            method: "GET",
            path: "/platform-stats",
            description: "All-time platform statistics for about page.",
            response: {
              totalVPS: 500,

            },
          },
          {
            method: "GET",
            path: "/metrics",
            description:
              "Rolling metrics (request rate, error rate) used by the admin rate-limit dashboard.",
            auth: false,
            params: { window: 15 },
            response: {
              metrics: {
                requestRate: 85,
                errorRate: 1.2,
                windowMinutes: 15,
              },
            },
          },
          {
            method: "GET",
            path: "/rate-limiting",
            description:
              "Detailed rate limit performance and current throttle states.",
            auth: false,
            response: {
              activeRules: [
                { route: "/api/vps", limit: 60, window: 60, current: 15 },
              ],
            },
          },
          {
            method: "GET",
            path: "/config-validation",
            description: "Validate platform configuration and environment variables.",
            auth: false,
            response: {
              valid: true,
              checks: [{ name: "database", status: "ok" }, { name: "redis", status: "ok" }],
            },
          },
        ],
      },
      {
        title: "Theme",
        base: `${apiBase}/theme`,
        description: "Platform theme and branding configuration.",
        icon: <Palette className="h-4 w-4" />,
        endpoints: [
          {
            method: "GET",
            path: "/",
            description: "Get current theme configuration.",
            response: {
              theme: {
                id: "default",
                name: "Default",
                colors: { primary: "#2563eb", accent: "#9333ea" },
              },
            },
          },
        ],
      },
      {
        title: "Contact",
        base: `${apiBase}/contact`,
        description: "Contact form submission and configuration.",
        icon: <Mail className="h-4 w-4" />,
        endpoints: [
          {
            method: "GET",
            path: "/config",
            description: "Get contact page configuration including available categories and methods.",
            response: {
              config: {
                categories: [{ id: "sales", label: "Sales", enabled: true }],
                methods: { email: { enabled: true, address: "sales@example.com" } },
              },
            },
          },
          {
            method: "POST",
            path: "/",
            description: "Submit a contact form message.",
            body: {
              name: "John Doe",
              email: "john@example.com",
              category: "sales",
              message: "I have a question about VPS hosting.",
            },
            response: {
              success: true,
              message: "Your message has been sent.",
            },
          },
        ],
      },
      {
        title: "FAQ & Updates",
        base: `${apiBase}/faq`,
        description: "Frequently asked questions and platform update announcements.",
        icon: <HelpCircle className="h-4 w-4" />,
        endpoints: [
          {
            method: "GET",
            path: "/categories",
            description: "Get FAQ categories for the public marketing site.",
            response: {
              categories: [
                { id: "cat_001", name: "General", displayOrder: 1, itemCount: 10 },
              ],
            },
          },
          {
            method: "GET",
            path: "/updates",
            description: "Get platform update changelog entries.",
            response: {
              updates: [
                { id: "update_001", title: "New VPS Features", content: "Added backup scheduling", displayOrder: 1 },
              ],
            },
          },
        ],
      },
      {
        title: "Pricing",
        base: `${apiBase}/pricing`,
        description: "Public pricing information for VPS plans and regions.",
        icon: <DollarSign className="h-4 w-4" />,
        endpoints: [
          {
            method: "GET",
            path: "/",
            description: "Get public pricing overview.",
            response: {
              pricing: {
                startingAt: 4.99,
                currency: "USD",
                period: "monthly",
              },
            },
          },
          {
            method: "GET",
            path: "/public-regions",
            description: "Get available public regions with pricing.",
            response: {
              regions: [
                { id: "us-east", label: "Newark, NJ", country: "US", available: true },
              ],
            },
          },
          {
            method: "GET",
            path: "/category-mappings",
            description: "Get enabled category mappings for white-label display on public pages.",
            response: {
              success: true,
              mappings: [
                {
                  original_category: "nanode",
                  custom_name: "Basic VPS",
                  custom_description: "Entry-level plans perfect for testing and development",
                  display_order: 1,
                },
                {
                  original_category: "standard",
                  custom_name: "Standard VPS",
                  custom_description: "Balanced performance and value for most workloads",
                  display_order: 2,
                },
              ],
            },
          },
          {
            method: "GET",
            path: "/vps",
            description: "Get public VPS pricing information.",
            response: {
              plans: [
                { id: "g6-standard-1", label: "Nanode 1GB", price: { monthly: 4.99 } },
              ],
            },
          },
        ],
      },
      {
        title: "Admin Egress Management",
        base: `${apiBase}/egress/admin`,
        description: "Admin egress billing management, credit overrides, and billing run operations.",
        icon: <Server className="h-4 w-4" />,
        endpoints: [
          {
            method: "POST",
            path: "/billing/run",
            description: "Manually trigger hourly egress billing run for all organizations.",
            auth: true,
            response: {
              success: true,
              processed: 45,
              totalCharged: 125.50,
            },
          },
          {
            method: "GET",
            path: "/credits/:orgId/balance",
            description: "Get egress credit balance for a specific organization.",
            auth: true,
            response: {
              organizationId: "org_001",
              balance: 500,
              used: 125.5,
              remaining: 374.5,
              unit: "GB",
            },
          },
          {
            method: "POST",
            path: "/credits/:orgId",
            description: "Add egress credits to an organization (admin adjustment).",
            auth: true,
            body: { amount: 100, reason: "Compensation" },
            response: {
              success: true,
              newBalance: 600,
            },
          },
          {
            method: "DELETE",
            path: "/credits/:orgId",
            description: "Remove egress credits from an organization.",
            auth: true,
            body: { amount: 50, reason: "Correction" },
            response: {
              success: true,
              newBalance: 550,
            },
          },
          {
            method: "GET",
            path: "/settings/packs",
            description: "Get configured egress credit packs for purchase.",
            auth: true,
            response: {
              packs: [
                { id: "pack_100gb", name: "100GB", amount: 100, price: 10, pricePerGB: 0.10 },
              ],
            },
          },
          {
            method: "PUT",
            path: "/settings/packs",
            description: "Update egress credit pack configuration.",
            auth: true,
            body: { packs: [{ id: "pack_100gb", gb: 100, price: 9.50, isPopular: true }] },
            response: {
              success: true,
              message: "Credit pack configuration updated",
              data: {
                packs: [{ id: "pack_100gb", gb: 100, price: 9.50, isPopular: true }],
                warningThresholdGb: 10,
              },
            },
          },
        ],
      },
];
