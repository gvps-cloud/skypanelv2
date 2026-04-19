export type ActiveApiRoute = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  protected: boolean;
  admin: boolean;
};

export const ACTIVE_API_ROUTE_MANIFEST: ActiveApiRoute[] = [
  {
    "method": "GET",
    "path": "/api/activities",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/activities/:id",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/activities/:id/read",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/activities/organization/:organizationId",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/activities/read-all",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/activities/unread-count",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/activity",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/activity/export",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/activity/recent",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/activity/summary",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/admin/impersonation/exit",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/announcements",
    "protected": false,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/auth/2fa/disable",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/auth/2fa/setup",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/auth/2fa/verify",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/auth/api-keys",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/auth/api-keys",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/auth/api-keys/:id",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/auth/debug/user",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/auth/forgot-password",
    "protected": false,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/auth/login",
    "protected": false,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/auth/logout",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/auth/me",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/auth/password",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/auth/preferences",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/auth/profile",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/auth/refresh",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/auth/register",
    "protected": false,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/auth/reset-password",
    "protected": false,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/auth/switch-organization",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/auth/verify-email",
    "protected": false,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/auth/verify-password",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/contact",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/contact/config",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/documentation/articles/:slug",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/documentation/categories",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/documentation/categories/:slug",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/documentation/files/:id",
    "protected": false,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/egress/admin/billing/run",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/egress/admin/credits/:orgId",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/egress/admin/credits/:orgId",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/egress/admin/credits/:orgId/balance",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/egress/admin/settings/packs",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/egress/admin/settings/packs",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/egress/credits",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/egress/credits/history",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/egress/credits/packs",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/egress/credits/purchase",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/egress/credits/purchase/wallet",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/egress/credits/wallet-balance",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/egress/usage/:vpsId",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/egress/usage/:vpsId/summary",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/faq/categories",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/faq/updates",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/health",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/health/config-validation",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/health/detailed",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/health/metrics",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/health/organizations",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/health/platform-stats",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/health/rate-limiting",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/health/stats",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/health/status",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/health/uptime",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/invoices",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/invoices/:id",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/invoices/:id/download",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/invoices/from-billing-cycles",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/invoices/from-transaction/:transactionId",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/invoices/from-transactions",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/notes/organizations",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/notes/personal",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/notes/personal",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/notes/personal/:noteId",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/notes/personal/:noteId",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/notes/personal/:noteId",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/notifications",
    "protected": true,
    "admin": false
  },
  {
    "method": "PATCH",
    "path": "/api/notifications/:id/read",
    "protected": true,
    "admin": false
  },
  {
    "method": "PATCH",
    "path": "/api/notifications/read-all",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/notifications/stream",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/notifications/unread",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/notifications/unread-count",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/organizations",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/organizations/:id",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/organizations/:id/egress",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/organizations/:id/egress/credits",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/organizations/:id/egress/credits/packs",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/organizations/:id/egress/credits/purchase",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/organizations/:id/egress/credits/purchase/complete",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/organizations/:id/invitations",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/organizations/:id/members",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/organizations/:id/members",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/organizations/:id/members/:userId",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/organizations/:id/members/:userId",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/organizations/:id/members/invite",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/organizations/:id/notes",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/organizations/:id/notes",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/organizations/:id/notes/:noteId",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/organizations/:id/notes/:noteId",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/organizations/:id/notes/:noteId",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/organizations/:id/roles",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/organizations/:id/roles",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/organizations/:id/roles/:roleId",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/organizations/:id/roles/:roleId",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/organizations/all",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/organizations/invitations/:id",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/organizations/invitations/:token",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/organizations/invitations/:token/accept",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/organizations/invitations/:token/decline",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/organizations/resources",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/payments/billing/summary",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/payments/capture-payment/:orderId",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/payments/config",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/payments/create-payment",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/payments/history",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/payments/refund",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/payments/transactions/:id",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/payments/wallet/balance",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/payments/wallet/deduct",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/payments/wallet/transactions",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/pricing",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/pricing/category-mappings",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/pricing/public-regions",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/pricing/vps",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/ssh-keys",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/ssh-keys",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/ssh-keys/:keyId",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/support/tickets",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/support/tickets",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/support/tickets/:id",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/support/tickets/:id/assign",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/support/tickets/:id/priority",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/support/tickets/:id/reopen-request",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/support/tickets/:id/replies",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/support/tickets/:id/replies",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/support/tickets/:id/replies/:replyId",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/support/tickets/:id/replies/:replyId",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/support/tickets/:id/status",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/support/tickets/:id/stream",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/theme",
    "protected": false,
    "admin": false
  }
];
