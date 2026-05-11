# Enhance Web Hosting Integration

## Overview

The Enhance integration adds managed web hosting capabilities to SkyPanelV2. It connects to the [Enhance](https://enhance.com) control panel API to provision websites, handle domain mappings, SSL certificates, email accounts, MySQL databases, FTP users, WordPress installations, and Node.js apps. Hosting is sold as a monthly subscription product alongside VPS instances, but renewals and hosting top-ups use a dedicated organization-scoped hosting wallet.

Key capabilities:

- **Website lifecycle** — create, suspend, unsuspend, and cancel hosting subscriptions
- **Domain management** — primary domains, mapped domains, DNS zones, and forced SSL
- **Email hosting** — mailboxes, autoresponders, and client configuration
- **Database hosting** — MySQL databases, users, privileges, and SQL execution
- **Application hosting** — PHP (LSAPI), Node.js persistent apps, and WordPress
- **Security** — SSL generation, mail SSL, and force-SSL toggles
- **File access** — FTP user management

---

## Effective Enablement Model

Enhance is **not** enabled by default. Three independent gates must all be `true` for the integration to be active:

| Gate | Source | Behavior |
|---|---|---|
| **Hard gate** | `ENHANCE_ENABLED` env var | Master on/off switch. If `false`, no hosting routes are available to users. |
| **Environment configured** | `ENHANCE_API_URL`, `ENHANCE_MASTER_ORG_ID`, `ENHANCE_API_KEY` | Runtime validation that required credentials are present. |
| **Runtime toggle** | `platform_integrations.enabled` (DB) | Per-environment runtime switch stored in PostgreSQL. Can be flipped by an admin without restarting the server. |

`effectiveEnabled = hardEnabled && envConfigured && runtimeEnabled`

- Admins can view the full breakdown via `GET /api/admin/enhance/status`.
- Admins can toggle the runtime state via `PATCH /api/admin/enhance/status`.
- Health checks validate API connectivity via `POST /api/admin/enhance/status/test`.

---

## Organization Mapping

Each SkyPanelV2 organization maps 1:1 to an Enhance customer:

- When a user purchases hosting for the first time, the system lazily creates an Enhance customer via `EnhanceService.createCustomer`.
- The resulting `enhance_customer_id` is persisted on the `organizations` row.
- All subsequent purchases for that organization reuse the same customer ID.
- Admins can manually sync an org to Enhance via `POST /api/admin/enhance/orgs/:orgId/sync-customer`.

---

## Plan Sync

Enhance plans are not automatically mirrored. An admin must trigger a sync:

1. Admin calls `POST /api/admin/enhance/plans/sync`.
2. The backend fetches plans from the Enhance API (`GET /orgs/{masterOrgId}/plans`).
3. Each plan is upserted into `hosting_plans` using `enhance_plan_id` as the unique key.
4. Plans that no longer exist remotely are marked `is_active = false` locally.
5. Admin can then edit local commercial fields (`price_monthly`, `is_active`, `service_type`) via `PUT /api/admin/enhance/plans/:id`.

---

## Purchase Flow

Purchasing a hosting subscription is a multi-step process with automatic rollback on failure:

1. **Validation** — `planId` and `domain` are required. The plan must be active.
2. **Hosting wallet lock** — The organization's `hosting_wallets` row is locked (`FOR UPDATE`) and balance verified. Customers can fund it from the main wallet or directly through PayPal.
3. **Debit** — Plan price is deducted from the hosting wallet and a hosting wallet transaction is recorded.
4. **Provisional subscription** — A `hosting_subscriptions` row is inserted with `status = 'provisioning'`.
5. **Remote provisioning** (outside the DB transaction):
   - Ensure the org has an `enhance_customer_id`; create one if missing.
   - Create an Enhance customer subscription.
   - Create an Enhance website attached to the subscription.
6. **Activation** — The local subscription is updated to `status = 'active'` with remote IDs and primary IP.
7. **Failure rollback** — If any remote step fails, the hosting wallet is credited back and a compensating transaction is recorded.

---

## Recurring Billing

A monthly billing scheduler checks all `hosting_subscriptions` where `status = 'active'` and `next_billing_at <= now()`:

1. Lock the organization's hosting wallet (`FOR UPDATE`).
2. Load the plan's `price_monthly`.
3. If balance is sufficient:
   - Debit the hosting wallet.
   - Record a hosting wallet debit transaction.
   - Update `last_billed_at = now()` and `next_billing_at = now() + interval '1 month'`.
4. If balance is insufficient:
   - Suspend the remote website via `EnhanceService.updateWebsite(..., { status: 'suspended' })`.
   - Mark the local subscription `status = 'suspended'`.
   - Log a warning activity entry.

The scheduler silently skips all work when `EnhanceToggleService.isEffectivelyEnabled()` is `false`.

---

## Role Permissions

Hosting operations are gated by two permissions:

| Permission | View services / plans | Purchase / cancel / manage |
|---|---|---|
| `hosting_view` | ✅ | — |
| `hosting_manage` | ✅ | ✅ |

### Predefined role assignments

| Role | `hosting_view` | `hosting_manage` |
|---|---|---|
| `owner` | ✅ | ✅ |
| `admin` | ✅ | ✅ |
| `billing_manager` | ✅ | — |
| `member` | ✅ | ✅ |
| `vps_manager` | — | — |
| `hosting_manager` | ✅ | ✅ |
| `support_agent` | ✅ | — |
| `viewer` | ✅ | — |

Custom roles can be created with any combination of the two permissions.

---

## Environment Variables

### Required (when hosting is enabled)

| Variable | Purpose |
|---|---|
| `ENHANCE_ENABLED` | Master toggle (`true` / `false`). |
| `ENHANCE_API_URL` | Base URL of your Enhance panel — domain only, e.g. `https://panel.yourdomain.com`. **Do not** append `/api`; the application adds that path prefix automatically. |
| `ENHANCE_MASTER_ORG_ID` | Enhance organization ID that owns the plans and customers. |
| `ENHANCE_API_KEY` | Raw API token — **do not** include the `Bearer ` prefix. The application prepends it automatically. Example: `acc9d0f4-xxxx_xxxx`, not `Bearer acc9d0f4-xxxx_xxxx`. |

### Optional

| Variable | Purpose |
|---|---|
| `ENHANCE_DEFAULT_SERVER_GROUP_ID` | Default server group used when `regionId` is not provided during purchase. |

---

## API Routes

### Public

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/hosting/status` | Public hosting platform status. |

### Authenticated (requires `hosting_view` or `hosting_manage`)

| Method | Route | Permission | Description |
|---|---|---|---|
| `GET` | `/api/hosting/plans` | — | List active hosting plans. |
| `GET` | `/api/hosting/regions` | `hosting_view` | List Enhance server groups as regions. |
| `GET` | `/api/hosting/services` | `hosting_view` | List org's hosting subscriptions. |
| `GET` | `/api/hosting/services/:id` | `hosting_view` | Get a single subscription detail. |
| `POST` | `/api/hosting/purchase` | `hosting_manage` | Purchase a new hosting subscription. |
| `POST` | `/api/hosting/services/:id/cancel` | `hosting_manage` | Cancel a hosting subscription. |
| `GET` | `/api/hosting/web/:id/php` | `hosting_view` | Get PHP settings for a website. |
| `PUT` | `/api/hosting/web/:id/php` | `hosting_manage` | Update PHP settings. |
| `POST` | `/api/hosting/web/:id/php/restart` | `hosting_manage` | Restart PHP for a website. |
| `GET` | `/api/hosting/node/:id/apps` | `hosting_view` | List Node apps. |
| `POST` | `/api/hosting/node/:id/apps` | `hosting_manage` | Create a Node app. |
| `DELETE` | `/api/hosting/node/:id/apps/:appId` | `hosting_manage` | Delete a Node app. |
| `GET` | `/api/hosting/node/:id/persistent-apps` | `hosting_view` | List persistent apps. |
| `GET` | `/api/hosting/wordpress/:id/wordpress` | `hosting_view` | List WordPress installations. |
| `GET` | `/api/hosting/wordpress/:id/wordpress/:appId/settings` | `hosting_view` | Get WordPress settings. |
| `PUT` | `/api/hosting/wordpress/:id/wordpress/:appId/settings` | `hosting_manage` | Update WordPress settings. |
| `GET` | `/api/hosting/wordpress/:id/wordpress/:appId/users` | `hosting_view` | List WordPress users. |
| `GET` | `/api/hosting/mysql/:id/mysql-dbs` | `hosting_view` | List MySQL databases. |
| `POST` | `/api/hosting/mysql/:id/mysql-dbs` | `hosting_manage` | Create a MySQL database. |
| `DELETE` | `/api/hosting/mysql/:id/mysql-dbs/:dbName` | `hosting_manage` | Delete a MySQL database. |
| `GET` | `/api/hosting/mysql/:id/mysql-users` | `hosting_view` | List MySQL users. |
| `POST` | `/api/hosting/mysql/:id/mysql-users` | `hosting_manage` | Create a MySQL user. |
| `GET` | `/api/hosting/ftp/:id/ftp-users` | `hosting_view` | List FTP users. |
| `POST` | `/api/hosting/ftp/:id/ftp-users` | `hosting_manage` | Create an FTP user. |
| `GET` | `/api/hosting/ssl/:id/domains/:domainId/ssl` | `hosting_view` | Get SSL status. |
| `POST` | `/api/hosting/ssl/:id/domains/:domainId/ssl` | `hosting_manage` | Generate SSL. |
| `POST` | `/api/hosting/ssl/:id/domains/:domainId/mail_ssl` | `hosting_manage` | Generate mail SSL. |
| `POST` | `/api/hosting/ssl/:id/domains/:domainId/force_ssl` | `hosting_manage` | Toggle force SSL. |

### Admin

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/admin/enhance/status` | Full enablement breakdown. |
| `PATCH` | `/api/admin/enhance/status` | Toggle runtime enabled state. |
| `POST` | `/api/admin/enhance/status/test` | Run health check. |
| `POST` | `/api/admin/enhance/plans/sync` | Sync plans from Enhance. |
| `GET` | `/api/admin/enhance/plans` | List all local hosting plans. |
| `PUT` | `/api/admin/enhance/plans/:id` | Update local plan fields. |
| `GET` | `/api/admin/enhance/subscriptions` | List all subscriptions across orgs. |
| `POST` | `/api/admin/enhance/orgs/:orgId/sync-customer` | Manually sync org to Enhance customer. |
| `POST` | `/api/admin/enhance/subscriptions/:id/suspend` | Admin suspend subscription. |
| `POST` | `/api/admin/enhance/subscriptions/:id/unsuspend` | Admin unsuspend subscription. |

---

## Failure Handling

- **Remote API failures** during purchase trigger automatic hosting wallet rollback.
- **Insufficient balance** during recurring billing suspends the website locally and remotely.
- **Health check failures** are persisted in `platform_integrations.last_health_status` and surfaced in the admin status endpoint.
- **Missing env vars** are enumerated in the status response so admins know exactly what to configure.
