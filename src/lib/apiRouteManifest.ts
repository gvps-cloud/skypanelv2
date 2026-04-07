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
    "method": "GET",
    "path": "/api/admin/announcements",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/announcements",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/announcements/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/announcements/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/announcements/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/billing/invoices",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/billing/invoices/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/billing/invoices/:id/download",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/billing/stats",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/billing/transactions",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/billing/transactions",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/billing/transactions/:transactionId/invoice",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/billing/users",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/category-mappings",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/category-mappings",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/category-mappings/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/category-mappings/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/category-mappings/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/category-mappings/enabled",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/admin/category-mappings/reorder",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/category-mappings/sync",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/contact/categories",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/contact/categories",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/contact/categories/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/contact/categories/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/contact/categories/reorder",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/contact/methods",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/contact/methods/:method_type",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/contact/methods/:method_type",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/documentation/articles",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/documentation/articles",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/documentation/articles/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/documentation/articles/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/documentation/articles/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/documentation/articles/:id/files",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/documentation/articles/reorder",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/documentation/categories",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/documentation/categories",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/documentation/categories/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/documentation/categories/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/documentation/categories/reorder",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/documentation/files/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/egress/execute",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/egress/history",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/egress/live-usage",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/egress/pricing",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/egress/pricing/:regionId",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/egress/pricing/sync",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/email-templates",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/email-templates/:name",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/email-templates/:name",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/email-templates/preview",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/faq/categories",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/faq/categories",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/faq/categories/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/faq/categories/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/faq/categories/reorder",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/faq/items",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/faq/items",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/faq/items/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/faq/items/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/faq/items/reorder",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/faq/updates",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/faq/updates",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/faq/updates/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/faq/updates/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/faq/updates/reorder",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/github/commits",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/impersonation/exit",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/admin/networking/firewall-settings",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/networking/firewall-settings",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/networking/firewall-templates",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/networking/firewall-templates/:slug",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/networking/firewalls",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/networking/firewalls",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/networking/firewalls/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/networking/firewalls/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/networking/firewalls/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/networking/firewalls/:id/devices",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/networking/firewalls/:id/devices",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/networking/firewalls/:id/devices/:deviceId",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/networking/firewalls/:id/history",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/networking/firewalls/:id/rules",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/networking/firewalls/:id/rules",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/networking/ips",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/networking/ips",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/networking/ips/:address",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/networking/ips/:address/rdns",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/networking/ips/:instanceId/:address",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/networking/ips/assign",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/networking/ips/share",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/networking/ipv6/pools",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/networking/ipv6/ranges",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/networking/ipv6/ranges",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/networking/ipv6/ranges/:range",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/networking/rdns",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/networking/rdns",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/networking/vlans",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/networking/vlans/:regionId/:label",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/organizations",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/organizations",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/organizations/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/organizations/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/organizations/:id/members",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/organizations/:id/members/:userId",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/organizations/:id/members/:userId",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/plans",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/plans",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/plans/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/plans/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/platform/availability",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/platform/availability",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/platform/region-labels",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/platform/region-labels/:regionId",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/platform/region-labels/:regionId",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/platform/region-labels/:regionId",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/platform/region-labels/bulk",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/providers",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/providers",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/providers/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/providers/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/providers/:id/regions",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/providers/:id/regions",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/providers/:id/validate",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/providers/reorder",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/rate-limits/overrides",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/rate-limits/overrides",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/rate-limits/overrides/:userId",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/servers",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/ssh-keys",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/ssh-keys",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/ssh-keys/:keyId",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/ssh-keys/:keyId",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/stackscripts/configs",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/stackscripts/configs",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/stackscripts/configs/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/stackscripts/configs/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/theme",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/theme",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/tickets",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/tickets/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/tickets/:id/replies",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/tickets/:id/replies",
    "protected": true,
    "admin": true
  },
  {
    "method": "PATCH",
    "path": "/api/admin/tickets/:id/status",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/tickets/:id/stream",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/admin/upstream/plans",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/upstream/regions",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/upstream/stackscripts",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/users",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/users/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/users/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/users/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/users/:id/detail",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/users/:id/impersonate",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/users/search",
    "protected": true,
    "admin": true
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
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/health/detailed",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/health/metrics",
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
    "protected": false,
    "admin": false
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
  },
  {
    "method": "GET",
    "path": "/api/vps",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/vps",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/vps/:id",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/vps/:id",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/backups/:backupId/restore",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/backups/disable",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/backups/enable",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/backups/schedule",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/backups/snapshot",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/boot",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/firewalls/attach",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/firewalls/detach",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/vps/:id/hostname",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/networking/rdns",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/vps/:id/notes",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/vps/:id/notes",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/reboot",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/rebuild",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/vps/:id/shutdown",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/vps/apps",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/vps/images",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/vps/networking/config",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/vps/plans",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/vps/providers",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/vps/providers/:providerId/plans/:regionId",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/vps/providers/:providerId/regions",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/vps/providers/:providerId/ssh-keys",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/vps/stackscripts",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/vps/uptime-summary",
    "protected": true,
    "admin": false
  }
];
