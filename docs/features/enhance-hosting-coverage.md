# Enhance Hosting Detail Coverage Matrix

This matrix tracks `/hosting/:id` coverage against `repo-docs/enhance-oas3-api.yaml`.

## Overview And Backups

| Tab | Covered Enhance operations | Current gaps / follow-up |
| --- | --- | --- |
| Overview | `GET /orgs/{org_id}/subscriptions/{subscription_id}`, `GET /orgs/{org_id}/subscriptions/{subscription_id}/bandwidth`, `GET /orgs/{org_id}/websites/{website_id}/metrics` | Keep month-to-date bandwidth, transfer quota, tracked usage, and website traffic labels distinct. |
| Backups | `GET/POST /orgs/{org_id}/websites/{website_id}/backups`, `GET/PUT/DELETE /orgs/{org_id}/websites/{website_id}/backups/{backup_id}`, `GET /orgs/{org_id}/websites/{website_id}/status/backup`, `GET /orgs/{org_id}/websites/{website_id}/backups/{backup_id}/restore_status`, `GET /orgs/{org_id}/websites/{website_id}/backups/{backup_id}/directory_tree`, `GET /websites/{website_id}/backup/download`, `POST /websites/{website_id}/backup/upload`, `GET/PUT /websites/{website_id}/backups_disabled` | Use live Enhance testing to verify S3 `storageKind` behavior and archive upload size limits. |

## Website, Email, And FTP

| Tab | Covered Enhance operations | Current gaps / follow-up |
| --- | --- | --- |
| Web | Website read/update, metrics, LSPHP settings, PHP restart, PHP error log, PHP extensions, PHP.ini settings, IonCube, Redis, `.htaccess`, FastCGI, webserver rewrites | Add site access token + file manager launch, domain vhost controls, staging/preview/push-live validation, quota/resource limits. |
| Email | Email list/create/update/delete, client config, mapped-domain picker, autoresponder create/delete | Add Roundcube/webmail SSO, autoresponder GET/UI, spam thresholds, richer mailbox edit fields, staging-domain-safe domain selection. |
| FTP | FTP user list/create/update/delete | Add `createHome` and `deleteHome`, clarify `account@primary-domain`, verify whether single-user GET exists. |

## Apps, WordPress, And Runtime

| Tab | Covered Enhance operations | Current gaps / follow-up |
| --- | --- | --- |
| Apps | Subscription installable apps, website apps list/install/delete | Treat as CMS installers, add `version`, `domainId`, delete `backupBeforeOperation`, and avoid collapsing multiple versions of the same app kind. |
| WordPress | Installations, settings, version update, users, user SSO, plugins, themes, activate theme, wp-config backend routes | Add WordPress info, user update/default user, plugin update/version, theme update/auto-update, maintenance mode, URL management, settings field normalization. |
| Runtime | Persistent app create/list/delete/log | Fix raw-array list responses, add edit support, add Node/NVM install, possible versions, installed versions, and default version. Remove or rewire unused `NodeTab`. |

## DNS, SSL, MySQL, Cron, And SSH

| Tab | Covered Enhance operations | Current gaps / follow-up |
| --- | --- | --- |
| DNS | Domain mappings, DNS zone read, DNS record create/update/delete | Add DNS status, DNS query/debug, DNSSEC enable/disable and DS/DNSKEY display, SOA/zone settings, and 204-safe route responses. |
| SSL | Web Let's Encrypt, force SSL, custom web cert upload, mail Let's Encrypt | Add Let's Encrypt preflight, consolidate duplicate mail SSL routes, add mail SSL GET/upload, clarify web vs mail cert status. |
| MySQL | DB list/create/delete, phpMyAdmin SSO, users, privileges, access hosts, backend SQL dump path | Add SQL dump download flow, SQL upload/execute, `shouldRedirect` support for SSO, verify unsupported single-DB GET. |
| Cron | Crontab GET/PATCH/DELETE | Fix 204 response handling and improve editor validation. |
| SSH | SSH key list/create/delete | Add key update/rename/rotate, SSH password setup, and `sanitize` query support. |

## Cross-Cutting Rules

- All Enhance calls must stay behind backend routes.
- Routes must resolve the local hosting subscription and customer Enhance org before calling Enhance.
- Route responses should normalize raw array vs `{ items }` responses for the frontend.
- 204 Enhance responses should become explicit local JSON success payloads or `204`, never normalized `undefined`.
- Redirect and binary Enhance endpoints need explicit proxy handling.
