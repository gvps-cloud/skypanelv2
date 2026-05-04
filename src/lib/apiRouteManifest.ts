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
