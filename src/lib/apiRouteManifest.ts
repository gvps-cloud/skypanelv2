export type ActiveApiRoute = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  protected: boolean;
};

export const ACTIVE_API_ROUTE_MANIFEST: ActiveApiRoute[] = [
  {
    "method": "GET",
    "path": "/api/activities",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/activities/:id",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/activities/:id/read",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/activities/organization/:organizationId",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/activities/read-all",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/activities/unread-count",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/activity",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/activity/export",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/activity/recent",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/activity/summary",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/billing/invoices",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/billing/invoices/:id",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/billing/invoices/:id/download",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/billing/stats",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/billing/transactions",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/billing/transactions",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/billing/transactions/:transactionId/invoice",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/billing/users",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/category-mappings",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/category-mappings",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/category-mappings/:id",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/category-mappings/:id",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/category-mappings/:id",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/category-mappings/enabled",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/category-mappings/reorder",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/category-mappings/sync",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/contact/categories",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/contact/categories",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/contact/categories/:id",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/contact/categories/:id",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/contact/categories/reorder",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/contact/methods",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/contact/methods/:method_type",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/contact/methods/:method_type",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/egress/execute",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/egress/history",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/egress/live-usage",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/egress/pricing",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/egress/pricing/:regionId",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/egress/pricing/sync",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/email-templates",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/email-templates/:name",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/email-templates/:name",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/email-templates/preview",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/faq/categories",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/faq/categories",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/faq/categories/:id",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/faq/categories/:id",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/faq/categories/reorder",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/faq/items",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/faq/items",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/faq/items/:id",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/faq/items/:id",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/faq/items/reorder",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/faq/updates",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/faq/updates",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/faq/updates/:id",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/faq/updates/:id",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/faq/updates/reorder",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/github/commits",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/impersonation/exit",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/networking/rdns",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/networking/rdns",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/organizations",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/organizations",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/organizations/:id",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/organizations/:id",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/organizations/:id/members",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/organizations/:id/members/:userId",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/organizations/:id/members/:userId",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/plans",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/plans",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/plans/:id",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/plans/:id",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/platform/availability",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/platform/availability",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/platform/region-labels",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/platform/region-labels/:regionId",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/platform/region-labels/:regionId",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/platform/region-labels/:regionId",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/platform/region-labels/bulk",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/providers",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/providers",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/providers/:id",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/providers/:id",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/providers/:id/regions",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/providers/:id/regions",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/providers/:id/validate",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/providers/reorder",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/rate-limits/overrides",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/rate-limits/overrides",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/rate-limits/overrides/:userId",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/servers",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/stackscripts/configs",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/stackscripts/configs",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/stackscripts/configs/:id",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/stackscripts/configs/:id",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/theme",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/theme",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/tickets",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/tickets/:id",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/tickets/:id/replies",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/tickets/:id/replies",
    "protected": true
  },
  {
    "method": "PATCH",
    "path": "/api/admin/tickets/:id/status",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/tickets/:id/stream",
    "protected": false
  },
  {
    "method": "GET",
    "path": "/api/admin/upstream/plans",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/upstream/regions",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/upstream/stackscripts",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/users",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/users/:id",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/users/:id",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/users/:id",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/users/:id/detail",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/admin/users/:id/impersonate",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/admin/users/search",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/auth/2fa/disable",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/auth/2fa/setup",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/auth/2fa/verify",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/auth/api-keys",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/auth/api-keys",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/auth/api-keys/:id",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/auth/debug/user",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/auth/forgot-password",
    "protected": false
  },
  {
    "method": "POST",
    "path": "/api/auth/login",
    "protected": false
  },
  {
    "method": "POST",
    "path": "/api/auth/logout",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/auth/me",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/auth/password",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/auth/preferences",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/auth/profile",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/auth/refresh",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/auth/register",
    "protected": false
  },
  {
    "method": "POST",
    "path": "/api/auth/reset-password",
    "protected": false
  },
  {
    "method": "POST",
    "path": "/api/auth/switch-organization",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/auth/verify-email",
    "protected": false
  },
  {
    "method": "POST",
    "path": "/api/auth/verify-password",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/contact",
    "protected": false
  },
  {
    "method": "GET",
    "path": "/api/contact/config",
    "protected": false
  },
  {
    "method": "POST",
    "path": "/api/egress/admin/billing/run",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/egress/admin/credits/:orgId",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/egress/admin/credits/:orgId",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/egress/admin/credits/:orgId/balance",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/egress/admin/settings/packs",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/egress/admin/settings/packs",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/egress/credits",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/egress/credits/history",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/egress/credits/packs",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/egress/credits/purchase",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/egress/credits/purchase/wallet",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/egress/credits/wallet-balance",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/egress/usage/:vpsId",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/egress/usage/:vpsId/summary",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/faq/categories",
    "protected": false
  },
  {
    "method": "GET",
    "path": "/api/faq/updates",
    "protected": false
  },
  {
    "method": "GET",
    "path": "/api/health",
    "protected": false
  },
  {
    "method": "GET",
    "path": "/api/health/config-validation",
    "protected": false
  },
  {
    "method": "GET",
    "path": "/api/health/detailed",
    "protected": false
  },
  {
    "method": "GET",
    "path": "/api/health/metrics",
    "protected": false
  },
  {
    "method": "GET",
    "path": "/api/health/platform-stats",
    "protected": false
  },
  {
    "method": "GET",
    "path": "/api/health/rate-limiting",
    "protected": false
  },
  {
    "method": "GET",
    "path": "/api/health/stats",
    "protected": false
  },
  {
    "method": "GET",
    "path": "/api/health/status",
    "protected": false
  },
  {
    "method": "GET",
    "path": "/api/invoices",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/invoices/:id",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/invoices/:id/download",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/invoices/from-billing-cycles",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/invoices/from-transaction/:transactionId",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/invoices/from-transactions",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/notifications",
    "protected": true
  },
  {
    "method": "PATCH",
    "path": "/api/notifications/:id/read",
    "protected": true
  },
  {
    "method": "PATCH",
    "path": "/api/notifications/read-all",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/notifications/stream",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/notifications/unread",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/notifications/unread-count",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/organizations",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/organizations/:id",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/organizations/:id/egress",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/organizations/:id/egress/credits",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/organizations/:id/egress/credits/packs",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/organizations/:id/egress/credits/purchase",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/organizations/:id/egress/credits/purchase/complete",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/organizations/:id/invitations",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/organizations/:id/members",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/organizations/:id/members",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/organizations/:id/members/:userId",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/organizations/:id/members/:userId",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/organizations/:id/members/invite",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/organizations/:id/roles",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/organizations/:id/roles",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/organizations/:id/roles/:roleId",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/organizations/:id/roles/:roleId",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/organizations/invitations/:id",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/organizations/invitations/:token",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/organizations/invitations/:token/accept",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/organizations/invitations/:token/decline",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/organizations/resources",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/payments/billing/summary",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/payments/capture-payment/:orderId",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/payments/config",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/payments/create-payment",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/payments/history",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/payments/refund",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/payments/transactions/:id",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/payments/wallet/balance",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/payments/wallet/deduct",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/payments/wallet/transactions",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/pricing",
    "protected": false
  },
  {
    "method": "GET",
    "path": "/api/pricing/category-mappings",
    "protected": false
  },
  {
    "method": "GET",
    "path": "/api/pricing/public-regions",
    "protected": false
  },
  {
    "method": "GET",
    "path": "/api/pricing/vps",
    "protected": false
  },
  {
    "method": "GET",
    "path": "/api/ssh-keys",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/ssh-keys",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/ssh-keys/:keyId",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/support/tickets",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/support/tickets",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/support/tickets/:id",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/support/tickets/:id/assign",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/support/tickets/:id/priority",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/support/tickets/:id/reopen-request",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/support/tickets/:id/replies",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/support/tickets/:id/replies",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/support/tickets/:id/replies/:replyId",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/support/tickets/:id/replies/:replyId",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/support/tickets/:id/status",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/support/tickets/:id/stream",
    "protected": false
  },
  {
    "method": "GET",
    "path": "/api/theme",
    "protected": false
  },
  {
    "method": "GET",
    "path": "/api/vps",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/vps",
    "protected": true
  },
  {
    "method": "DELETE",
    "path": "/api/vps/:id",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/vps/:id",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/backups/:backupId/restore",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/backups/disable",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/backups/enable",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/backups/schedule",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/backups/snapshot",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/boot",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/firewalls/attach",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/firewalls/detach",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/vps/:id/hostname",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/networking/rdns",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/vps/:id/notes",
    "protected": true
  },
  {
    "method": "PUT",
    "path": "/api/vps/:id/notes",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/reboot",
    "protected": true
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/shutdown",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/vps/apps",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/vps/images",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/vps/linode/ssh-keys",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/vps/networking/config",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/vps/plans",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/vps/providers",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/vps/providers/:providerId/plans/:regionId",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/vps/providers/:providerId/regions",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/vps/stackscripts",
    "protected": true
  },
  {
    "method": "GET",
    "path": "/api/vps/uptime-summary",
    "protected": true
  }
];
