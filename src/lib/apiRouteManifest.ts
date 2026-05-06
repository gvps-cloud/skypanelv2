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
    "path": "/api/admin/activity",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/activity/export",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/activity/summary",
    "protected": true,
    "admin": true
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
    "path": "/api/admin/blog/categories",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/blog/categories",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/blog/categories/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/blog/categories/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/blog/categories/reorder",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/blog/posts",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/blog/posts",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/blog/posts/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/blog/posts/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/blog/posts/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/blog/posts/:id/cover-image",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/blog/posts/:id/cover-image",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/blog/tags",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/blog/tags",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/blog/tags/:id",
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
    "method": "POST",
    "path": "/api/admin/enhance/orgs/:orgId/sync-customer",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/enhance/plans",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/enhance/plans/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/enhance/plans/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/enhance/plans/purge-orphans",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/enhance/plans/sync",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/enhance/status",
    "protected": true,
    "admin": true
  },
  {
    "method": "PATCH",
    "path": "/api/admin/enhance/status",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/enhance/status/test",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/enhance/subscriptions",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/enhance/subscriptions/:id/invoice",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/enhance/subscriptions/:id/refund",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/enhance/subscriptions/:id/retry-billing",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/enhance/subscriptions/:id/suspend",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/enhance/subscriptions/:id/unsuspend",
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
    "path": "/api/admin/fraud-checks",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/fraud-checks/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/fraud-checks/:id/override",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/fraud-checks/stats/summary",
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
    "method": "POST",
    "path": "/api/admin/networking/ipv6/range-rdns",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/networking/ipv6/range-rdns-records",
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
    "path": "/api/admin/networking/rdns-config",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/networking/rdns-config",
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
    "path": "/api/admin/platform/maintenance",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/platform/maintenance",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/platform/maintenance/code",
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
    "path": "/api/admin/refunds",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/refunds",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/refunds/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/refunds/:id/cancel",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/refunds/:id/process",
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
    "protected": true,
    "admin": true
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
    "method": "POST",
    "path": "/api/admin/users/bulk-delete",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/users/impersonation/exit",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/admin/users/search",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/volume-billing/volume-types",
    "protected": true,
    "admin": true
  },
  {
    "method": "POST",
    "path": "/api/admin/volume-billing/volume-types",
    "protected": true,
    "admin": true
  },
  {
    "method": "DELETE",
    "path": "/api/admin/volume-billing/volume-types/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "PUT",
    "path": "/api/admin/volume-billing/volume-types/:id",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/volume-billing/volumes",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/volume-billing/volumes/:id/billing",
    "protected": true,
    "admin": true
  },
  {
    "method": "GET",
    "path": "/api/admin/volume-billing/volumes/overview",
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
    "method": "GET",
    "path": "/api/blog/categories",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/blog/images/:filename",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/blog/posts",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/blog/posts/:year/:slug",
    "protected": false,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/blog/tags",
    "protected": false,
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
    "method": "POST",
    "path": "/api/egress/credits/refund/wallet",
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
    "path": "/api/hosting/apps/:id/apps",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/apps/:id/apps",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/apps/:id/apps/:appId",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/apps/:id/installable",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/backups/:id/backup-status",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/backups/:id/backup/download",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/backups/:id/backup/upload",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/backups/:id/backups",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/backups/:id/backups",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/backups/:id/backups-disabled",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/hosting/backups/:id/backups-disabled",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/backups/:id/backups/:backupId",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/backups/:id/backups/:backupId",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/hosting/backups/:id/backups/:backupId",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/backups/:id/backups/:backupId/directory-tree",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/backups/:id/backups/:backupId/restore-status",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/cron/:id/crontab",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/cron/:id/crontab",
    "protected": true,
    "admin": false
  },
  {
    "method": "PATCH",
    "path": "/api/hosting/cron/:id/crontab",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/dns/:id/domains",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/dns/:id/domains",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/dns/:id/domains/:domainId",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/dns/:id/domains/:domainId/dns",
    "protected": true,
    "admin": false
  },
  {
    "method": "PATCH",
    "path": "/api/hosting/dns/:id/domains/:domainId/dns",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/dns/:id/domains/:domainId/dns-query",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/dns/:id/domains/:domainId/dns/records",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/dns/:id/domains/:domainId/dns/records/:recordId",
    "protected": true,
    "admin": false
  },
  {
    "method": "PATCH",
    "path": "/api/hosting/dns/:id/domains/:domainId/dns/records/:recordId",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/dns/:id/domains/:domainId/dnssec",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/dns/:id/domains/:domainId/dnssec",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/hosting/dns/:id/domains/primary",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/email/:id/domains",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/email/:id/emails",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/email/:id/emails",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/email/:id/emails/:emailAddress",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/email/:id/emails/:emailAddress",
    "protected": true,
    "admin": false
  },
  {
    "method": "PATCH",
    "path": "/api/hosting/email/:id/emails/:emailAddress",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/email/:id/emails/:emailAddress/autoresponder",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/email/:id/emails/:emailAddress/autoresponder",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/email/:id/emails/:emailAddress/autoresponder",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/email/:id/emails/:emailAddress/client-conf",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/email/:id/emails/:emailAddress/spam-thresholds",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/hosting/email/:id/emails/:emailAddress/spam-thresholds",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/email/:id/emails/:emailAddress/sso",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/ftp/:id/ftp-users",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/ftp/:id/ftp-users",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/ftp/:id/ftp-users/:username",
    "protected": true,
    "admin": false
  },
  {
    "method": "PATCH",
    "path": "/api/hosting/ftp/:id/ftp-users/:username",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/joomla/:id/joomla",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/joomla/:id/joomla/:appId/info",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/joomla/:id/joomla/:appId/users",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/joomla/:id/joomla/:appId/users",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/joomla/:id/joomla/:appId/users/:username",
    "protected": true,
    "admin": false
  },
  {
    "method": "PATCH",
    "path": "/api/hosting/joomla/:id/joomla/:appId/users/:username",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/mysql/:id/mysql-dbs",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/mysql/:id/mysql-dbs",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/mysql/:id/mysql-dbs/:dbName",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/mysql/:id/mysql-dbs/:dbName/sql",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/mysql/:id/mysql-dbs/:dbName/sso",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/mysql/:id/mysql-users",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/mysql/:id/mysql-users",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/mysql/:id/mysql-users/:username",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/hosting/mysql/:id/mysql-users/:username",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/mysql/:id/mysql-users/:username/access-hosts",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/mysql/:id/mysql-users/:username/access-hosts",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/hosting/mysql/:id/mysql-users/:username/privileges",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/nameservers",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/node/:id/node/possible-versions",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/node/:id/node/versions",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/node/:id/node/versions",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/hosting/node/:id/node/versions/default",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/node/:id/nvm",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/node/:id/persistent-apps",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/node/:id/persistent-apps",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/node/:id/persistent-apps/:appId",
    "protected": true,
    "admin": false
  },
  {
    "method": "PATCH",
    "path": "/api/hosting/node/:id/persistent-apps/:appId",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/node/:id/persistent-apps/:appId/log",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/plans",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/purchase",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/regions",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/services",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/services/:id",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/services/:id/bandwidth",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/services/:id/billing",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/services/:id/cancel",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/ssh/:id/ssh-keys",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/ssh/:id/ssh-keys",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/ssh/:id/ssh-keys/:keyId",
    "protected": true,
    "admin": false
  },
  {
    "method": "PATCH",
    "path": "/api/hosting/ssh/:id/ssh-keys/:keyId",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/ssh/:id/ssh-password",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/hosting/ssl/:id/domains/:domainId/force_ssl",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/ssl/:id/domains/:domainId/mail_ssl",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/ssl/:id/domains/:domainId/mail_ssl",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/ssl/:id/domains/:domainId/mail_ssl/upload",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/ssl/:id/domains/:domainId/ssl",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/ssl/:id/domains/:domainId/ssl",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/ssl/:id/domains/:domainId/ssl/upload",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/sso",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/staging-domain",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/status",
    "protected": false,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/web/:id/domains/:domainId/mail-ssl",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/web/:id/domains/:domainId/modsec-status",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/hosting/web/:id/domains/:domainId/modsec-status",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/web/:id/domains/:domainId/nginx-fastcgi",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/web/:id/domains/:domainId/nginx-fastcgi",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/hosting/web/:id/domains/:domainId/nginx-fastcgi",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/web/:id/domains/:domainId/nginx-fastcgi/excluded-paths",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/web/:id/domains/:domainId/nginx-fastcgi/excluded-paths",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/web/:id/domains/:domainId/nginx-fastcgi/excluded-paths",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/web/:id/domains/:domainId/vhost",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/web/:id/domains/:domainId/vhost",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/hosting/web/:id/domains/:domainId/vhost",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/web/:id/domains/:domainId/webserver-rewrites",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/web/:id/domains/:domainId/webserver-rewrites",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/hosting/web/:id/domains/:domainId/webserver-rewrites",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/web/:id/file-manager",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/web/:id/htaccess",
    "protected": true,
    "admin": false
  },
  {
    "method": "PATCH",
    "path": "/api/hosting/web/:id/htaccess",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/web/:id/htaccess/ips",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/hosting/web/:id/htaccess/ips",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/web/:id/ioncube",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/hosting/web/:id/ioncube",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/web/:id/metrics",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/web/:id/php",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/hosting/web/:id/php",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/web/:id/php/error-log",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/web/:id/php/extensions",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/web/:id/php/extensions/:name",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/web/:id/php/extensions/:name",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/web/:id/php/extensions/available",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/web/:id/php/extensions/built-in",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/web/:id/php/ini",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/web/:id/php/ini/:key",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/hosting/web/:id/php/ini/:key",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/web/:id/php/restart",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/web/:id/redis",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/hosting/web/:id/redis",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/web/:id/webserver-kind",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/web/:id/website",
    "protected": true,
    "admin": false
  },
  {
    "method": "PATCH",
    "path": "/api/hosting/web/:id/website",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/hosting/web/:id/website",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/wordpress/:id/wordpress",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/maintenance-mode",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/maintenance-mode",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/plugins",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/plugins",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/plugins/:pluginId",
    "protected": true,
    "admin": false
  },
  {
    "method": "PATCH",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/plugins/:pluginId",
    "protected": true,
    "admin": false
  },
  {
    "method": "PATCH",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/plugins/:pluginId/version",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/settings",
    "protected": true,
    "admin": false
  },
  {
    "method": "PATCH",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/settings",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/themes",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/themes",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/themes/:themeId",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/themes/:themeId/activate",
    "protected": true,
    "admin": false
  },
  {
    "method": "PATCH",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/themes/:themeId/auto-update",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/themes/:themeId/update",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/users",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/users",
    "protected": true,
    "admin": false
  },
  {
    "method": "DELETE",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/users/:userId",
    "protected": true,
    "admin": false
  },
  {
    "method": "PATCH",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/users/:userId",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/users/:userId/sso",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/version",
    "protected": true,
    "admin": false
  },
  {
    "method": "PATCH",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/version",
    "protected": true,
    "admin": false
  },
  {
    "method": "PUT",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/wp-config",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/wordpress/:id/wordpress/:appId/wp-config/:wpOption",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/wordpress/catalog/plugins",
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/hosting/wordpress/catalog/themes",
    "protected": true,
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
    "path": "/api/invoices/from-hosting-cycles",
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
    "path": "/api/payments/wallet/hosting/balance",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/payments/wallet/hosting/fund",
    "protected": true,
    "admin": false
  },
  {
    "method": "POST",
    "path": "/api/payments/wallet/hosting/withdraw",
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
    "path": "/api/pricing/hosting",
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
    "path": "/api/site-status",
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
    "protected": true,
    "admin": false
  },
  {
    "method": "GET",
    "path": "/api/theme",
    "protected": false,
    "admin": false
  }
];
