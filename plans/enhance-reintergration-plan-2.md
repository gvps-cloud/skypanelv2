# Enhance Web Hosting Reintegration v2 (Repo-Aligned)

Restore the removed Enhance (orchd) hosting integration as a first-class SkyPanelV2 feature without touching unrelated VPS/provider code. This file supersedes the earlier draft and v1 plan wherever they conflict with the current repo.

Changes from v1 are marked with **[v2]** throughout.

## Locked Decisions

- SkyPanelV2 organization maps 1:1 to an Enhance customer org.
- Enhance customer creation is lazy on first hosting purchase, with an admin "Sync to Enhance" action for manual repair/bootstrap.
- Credentials stay in `.env`; the old `enhance_config` table is not coming back.
- `ENHANCE_ENABLED=true|false` is the hard deployment/operator gate.
- `platform_integrations.enabled WHERE slug='enhance'` is the admin runtime gate.
- Effective enablement is `ENHANCE_ENABLED && envConfigured && platform_integrations.enabled`.
- Do not add or use `ENHANCE_HOSTING_UI_ENABLED`.
- Add real predefined `member` and `hosting_manager` org roles before shipping hosting permissions.
- Hosting permissions are snake_case: `hosting_view`, `hosting_manage`.
- `hosting_manager` is a dedicated role scoped to Enhance web hosting with zero VPS permissions, mirroring how `vps_manager` is scoped to Linode VPS with zero hosting permissions.
- Initial purchase and recurring billing use wallet debits plus compensating internal wallet credits on failure; do not model rollback as a customer-facing refund flow.
- `repo-docs/enhance-oas3-api.yaml` is the API contract for endpoint paths, operationIds, and payload shapes.
- Historical commits are implementation references only, not the source of truth.

## Repo Constraints This Plan Must Follow

- Admin is section/hash based inside `/admin`; there are no separate active `/admin/*` hosting pages.
- The active admin router is `api/routes/admin/index.ts`, not the legacy `api/routes/admin.ts` file.
- The org detail/admin surface is `src/components/admin/OrganizationManagement.tsx`.
- Current role code still normalizes legacy `member` to `viewer`; that has to be fixed first.
- Custom-role creation/editing is split across backend validators in `api/routes/organizations.ts` and frontend catalogs in `src/components/settings/CreateRoleWizard.tsx`.
- `/api/hosting/status` must stay public, so the `/api/hosting` mount has to be split into public and authenticated routers.
- `payment_transactions` cannot use `pending`; migration `017_remove_pending_from_payment_transactions.sql` limits statuses to `completed`, `failed`, `cancelled`, `refunded`.
- `platform_integrations` does not exist today, so the runtime toggle must be introduced by migration rather than assumed.
- `enhanceService` should stay remote/API focused; local DB writes belong to the purchase/billing orchestration layer.
- User-facing routes and page params should use local `hosting_subscriptions.id`, not raw Enhance ids.
- The Enhance OAS mixes `/orgs/...`, `/websites/...`, and `/v2/websites/...` paths, so the client layer cannot assume one uniform path pattern.
- **[v2]** The SQL `seed_default_roles_for_organization()` function (migration 015) is severely out of sync with `api/services/roles.ts` — it lacks `notes_*` and `egress_*` permissions and uses `ON CONFLICT DO NOTHING`, so it cannot be simply re-run to update existing roles. The migration must use explicit UPDATE statements instead.
- **[v2]** `egress_view` and `egress_manage` were never seeded into `predefined_permissions`, are missing from the `validPermissions` allowlist in `organizations.ts:1250`, and are missing from the `CreateRoleWizard.tsx` PERMISSIONS array. Part 0 must close all three gaps.

## Part 0: Member Role, Hosting Manager Role, And Permission Foundation

This lands first and is not gated on any Enhance API work. Two new predefined roles are introduced: `member` (general operator) and `hosting_manager` (hosting-only operator, no VPS access).

### Migration `056_add_member_role.sql`

**[v2]** This migration must perform six distinct operations rather than just re-running the seed function:

#### Step 1: Seed new permissions into `predefined_permissions`

Register `hosting_view`, `hosting_manage`, and **[v2]** also register the missing `egress_view` and `egress_manage`:

```sql
INSERT INTO predefined_permissions (name, category, description) VALUES
  ('hosting_view', 'Hosting', 'View hosting subscriptions and details'),
  ('hosting_manage', 'Hosting', 'Purchase, cancel, and manage hosting subscriptions'),
  ('egress_view', 'Egress', 'View egress credit balance and usage'),
  ('egress_manage', 'Egress', 'Purchase and manage egress credits')
ON CONFLICT (name) DO NOTHING;
```

#### Step 2: Append new permissions to existing predefined roles via UPDATE

**[v2]** Because `seed_default_roles_for_organization()` uses `ON CONFLICT DO NOTHING`, simply re-running it will not update existing roles. Use explicit UPDATEs to append permissions to the JSON arrays:

```sql
-- owner: add hosting_view, hosting_manage (egress_view, egress_manage already present from migration 032)
UPDATE organization_roles
SET permissions = permissions || '["hosting_view","hosting_manage"]'::jsonb
WHERE name = 'owner' AND is_custom = false
  AND NOT (permissions ? 'hosting_view');

-- admin: add hosting_view, hosting_manage (egress_view already present from migration 032)
UPDATE organization_roles
SET permissions = permissions || '["hosting_view","hosting_manage"]'::jsonb
WHERE name = 'admin' AND is_custom = false
  AND NOT (permissions ? 'hosting_view');

-- vps_manager: NO hosting permissions (VPS and hosting are fully decoupled) **[v3]**

-- support_agent: add hosting_view
UPDATE organization_roles
SET permissions = permissions || '["hosting_view"]'::jsonb
WHERE name = 'support_agent' AND is_custom = false
  AND NOT (permissions ? 'hosting_view');

-- viewer: add hosting_view
UPDATE organization_roles
SET permissions = permissions || '["hosting_view"]'::jsonb
WHERE name = 'viewer' AND is_custom = false
  AND NOT (permissions ? 'hosting_view');
```

**[v3]** Note: `vps_manager` gets **no** hosting permissions — VPS and hosting are fully decoupled. `hosting_manager` gets **no** VPS permissions in return. `egress_view` was added to `owner` and `admin` roles by migration 032, but `vps_manager`, `support_agent`, and `viewer` never received it. The plan does not add `egress_view` to those roles. If that changes, add separate UPDATEs.

#### Step 3: Insert the new `member` role for all orgs

**[v2]** The `member` role does not exist yet, so INSERT will not conflict:

```sql
INSERT INTO organization_roles (organization_id, name, permissions, is_custom)
SELECT id, 'member',
  '["vps_view","vps_create","vps_manage","notes_view","notes_manage","ssh_keys_view","tickets_view","tickets_create","billing_view","egress_view","hosting_view","hosting_manage"]'::jsonb,
  false
FROM organizations
ON CONFLICT (organization_id, name) DO NOTHING;
```

#### Step 4: Insert the new `hosting_manager` role for all orgs **[v3]**

The `hosting_manager` role is a dedicated hosting-only role with zero VPS permissions, mirroring `vps_manager`:

```sql
INSERT INTO organization_roles (organization_id, name, permissions, is_custom)
SELECT id, 'hosting_manager',
  '["hosting_view","hosting_manage","billing_view","notes_view","ssh_keys_view","tickets_view","tickets_create","egress_view"]'::jsonb,
  false
FROM organizations
ON CONFLICT (organization_id, name) DO NOTHING;
```

#### Step 5: Backfill legacy `member` rows to the new role

**[v2]** Only reassign rows where the legacy `role` column is `'member'`. Other null-role rows stay as `viewer`:

```sql
-- Backfill legacy member -> new member role
UPDATE organization_members om
SET role_id = mr.id
FROM organization_roles mr
WHERE mr.organization_id = om.organization_id
  AND mr.name = 'member'
  AND mr.is_custom = false
  AND om.role_id IS NULL
  AND om.role = 'member';

-- Backfill other null-role rows -> viewer (preserve existing behavior)
UPDATE organization_members om
SET role_id = vr.id
FROM organization_roles vr
WHERE vr.organization_id = om.organization_id
  AND vr.name = 'viewer'
  AND vr.is_custom = false
  AND om.role_id IS NULL
  AND (om.role IS NULL OR om.role NOT IN ('owner', 'admin', 'member'));
```

#### Step 6: Update the `seed_default_roles_for_organization()` function body

**[v2]** Replace the function body entirely to match the current `PREDEFINED_ROLES` in `api/services/roles.ts`, plus the `member` and `hosting_manager` roles and all current permissions (including `notes_*`, `egress_*`, `hosting_*`). The function must:

- Include the `member` and `hosting_manager` roles as new predefined roles (total: 7 predefined roles: owner, admin, member, vps_manager, hosting_manager, support_agent, viewer).
- Use the full, current permission sets for all seven roles matching `api/services/roles.ts` lines 44-76 (plus the new hosting additions).
- Change the backfill CASE from `ELSE viewer_role_id` to `WHEN 'member' THEN member_role_id ELSE viewer_role_id`.
- Keep `ON CONFLICT DO NOTHING` for the INSERTs (new orgs need idempotent seeding).

#### Full predefined role permission sets (post-migration):

| Permission | owner | admin | member | vps_manager | hosting_manager | support_agent | viewer |
|---|---|---|---|---|---|---|---|
| `vps_view` | **Y** | **Y** | **Y** | **Y** | — | — | **Y** |
| `vps_create` | **Y** | **Y** | **Y** | **Y** | — | — | — |
| `vps_delete` | **Y** | **Y** | — | — | — | — | — |
| `vps_manage` | **Y** | **Y** | **Y** | **Y** | — | — | — |
| `notes_view` | **Y** | **Y** | **Y** | **Y** | **Y** | **Y** | **Y** |
| `notes_manage` | **Y** | **Y** | **Y** | — | — | — | — |
| `ssh_keys_view` | **Y** | **Y** | **Y** | **Y** | **Y** | — | — |
| `ssh_keys_manage` | **Y** | **Y** | — | **Y** | — | — | — |
| `tickets_view` | **Y** | **Y** | **Y** | — | **Y** | **Y** | **Y** |
| `tickets_create` | **Y** | **Y** | **Y** | — | **Y** | **Y** | — |
| `tickets_manage` | **Y** | **Y** | — | — | — | **Y** | — |
| `billing_view` | **Y** | **Y** | **Y** | — | **Y** | — | — |
| `billing_manage` | **Y** | — | — | — | — | — | — |
| `egress_view` | **Y** | **Y** | **Y** | — | **Y** | — | — |
| `egress_manage` | **Y** | — | — | — | — | — | — |
| `members_manage` | **Y** | — | — | — | — | — | — |
| `settings_manage` | **Y** | **Y** | — | — | — | — | — |
| `hosting_view` | **Y** | **Y** | **Y** | — | **Y** | **Y** | **Y** |
| `hosting_manage` | **Y** | **Y** | **Y** | — | **Y** | — | — |

Permission counts: `owner` 19/19 | `admin` 16/19 | `member` 12/19 | `vps_manager` 6/19 | `hosting_manager` 8/19 | `support_agent` 5/19 | `viewer` 4/19

### Code updates paired with migration `056`

`api/services/roles.ts`

- Extend `Permission` with `hosting_view | hosting_manage`.
- Add `member` and `hosting_manager` to `PREDEFINED_ROLES`.
- Add hosting permissions to the other predefined roles as described in the table above.
- **[v3]** `vps_manager` gets **no** hosting permissions — VPS and hosting are decoupled.
- **[v2]** Verify the `PREDEFINED_ROLES` object exactly matches the updated SQL function body so code and DB never diverge again.
- In `initializeDefaultRoles`, only backfill null `role_id` to `member` when the legacy `organization_members.role` column is `member`; keep `viewer` as the fallback for other null-role rows.

`api/routes/admin/organizations.ts`

- Remove the `member -> viewer` normalization in `normalizeOrganizationRoleName` (line 19-22).
- Map `member` back to the legacy `organization_members.role='member'` string via `toLegacyOrganizationMemberRole` (line 24-30).
- Remove the inline `CASE WHEN om.role = 'member' THEN 'viewer'` rewrites from the admin org/member query (5 occurrences in `buildAdminOrganizationQuery`, 1 in PUT member handler).

`src/components/admin/OrganizationManagement.tsx`

- Default newly assigned members to the predefined `member` role.
- Fall back to `viewer` only if a stale org is somehow missing the `member` role.
- **[v2]** Update `normalizeRoleName` (line 161) to stop converting `'member'` → `'viewer'`.
- **[v2]** Update `getDefaultAssignableRoleId` (line 308-319) to prefer `'member'` over `'viewer'` as the default for new members.

`api/routes/organizations.ts`

- Add `hosting_view` and `hosting_manage` to the `validPermissions` allowlist at line 1250 used by `POST /:id/roles` and `PUT /:id/roles/:roleId`.
- **[v2]** Also add the missing `egress_view` and `egress_manage` to the same `validPermissions` allowlist (existing bug).
- Add `hosting_view` and `hosting_manage` to the `permissions` object returned by `GET /api/organizations/resources` (around line 213-259).
- **[v2]** Update the legacy `member` fallback at lines 245-248 to resolve the actual `member` role permissions from the role system instead of hardcoding `{vps_view, notes_view, tickets_view}`. Once `member` is a real predefined role, this code path should look up `member` role permissions from `organization_roles` the same way custom roles are resolved.
- Fix object-style permission checks in this file to use array semantics or `RoleService.checkPermission` so custom roles keep working once hosting permissions are introduced.

`src/components/settings/CreateRoleWizard.tsx`

- Add a Hosting category and expose `hosting_view` and `hosting_manage` in the permission picker.
- **[v2]** Add an Egress category and expose `egress_view` and `egress_manage` in the permission picker (existing gap — these permissions exist in the backend but are unreachable in the UI).
- **[v2]** Add both categories to `PERMISSION_CATEGORIES` with appropriate icons and gradient colors.

`src/components/settings/TeamSettings.tsx`

- Update any permission labels/badges so hosting permissions and the new predefined `member` role render correctly.

### Tests for Part 0

- `api/services/roles.test.ts`
  - `member` exists in `PREDEFINED_ROLES`
  - `member` has `hosting_manage`
  - `hosting_manager` exists in `PREDEFINED_ROLES`
  - `hosting_manager` has `hosting_view` and `hosting_manage`
  - `hosting_manager` does not have any `vps_*` permissions
  - `viewer` does not have `hosting_manage`
  - **[v2]** All `PREDEFINED_ROLES` entries include `hosting_view`
  - **[v2]** `owner` and `admin` include `hosting_manage`
  - **[v3]** `vps_manager` does not include `hosting_view` or `hosting_manage`
  - **[v2]** `support_agent` does not include `hosting_manage`
- `tests/security/member-role-permissions.test.ts`
  - legacy `member` rows end up attached to the predefined `member` role after migration
  - **[v2]** non-member null-role rows remain attached to `viewer`
  - **[v2]** existing custom roles are untouched by the migration

## Environment And Effective Enablement

Add to `.env.example` and `api/config/index.ts`:

```dotenv
ENHANCE_ENABLED=false
ENHANCE_API_URL=https://api.example.com
ENHANCE_MASTER_ORG_ID=
ENHANCE_API_KEY=
ENHANCE_DEFAULT_SERVER_GROUP_ID=
```

Rules:

- `ENHANCE_ENABLED` is a hard boolean gate parsed in `api/config/index.ts`.
- `ENHANCE_API_URL`, `ENHANCE_MASTER_ORG_ID`, and `ENHANCE_API_KEY` are the required connection vars.
- `ENHANCE_DEFAULT_SERVER_GROUP_ID` is an optional fallback placement value when the purchaser does not pick a region.
- `validateConfig()` should not hard-fail app startup just because Enhance vars are absent; clones that do not use Enhance still need to boot normally.
- The admin toggle may only be turned on when `ENHANCE_ENABLED=true` and all required Enhance vars are present.
- Public/user-facing code only cares about effective enablement, not the individual gates.

Config integration notes **[v2]**:

- Add properties to the `Config` interface (around line 39-95 of `api/config/index.ts`).
- Add `process.env.*` reads with defaults in `getConfig()` (around lines 326-399).
- Do NOT add Enhance vars to `validateConfig()` — absent vars should not block startup.
- The config module uses a dynamic Proxy, so reads are always fresh from `process.env`.

Status model:

- Hard gate: `config.ENHANCE_ENABLED`
- Config gate: required Enhance env vars present
- Runtime gate: `platform_integrations.enabled` for `slug='enhance'`
- Effective enabled: all three true

`GET /api/hosting/status` remains public and should return a small response such as:

```json
{ "enabled": true }
```

Admin status can return the full breakdown:

- `hardEnabled`
- `envConfigured`
- `missingEnv[]`
- `runtimeEnabled`
- `effectiveEnabled`
- `lastHealthCheckAt`
- `lastHealthStatus`
- `lastHealthMessage`

## Migration `057_add_enhance_hosting_schema.sql`

This migration introduces the actual hosting foundation. Do not edit the removed historical migration `006_enhance_suite_schema.sql`.

### `platform_integrations`

Create a generic table for runtime-toggled integrations and seed only one row for Enhance:

- `slug` unique, seeded with `enhance`
- `display_name`
- `description`
- `enabled boolean default false`
- `env_required text[]`
- `last_health_check_at`
- `last_health_status`
- `last_health_message`
- timestamps + updated_at trigger

The seeded Enhance row should default to disabled on fresh installs.

### `organizations`

Add:

- `enhance_customer_id varchar(255)`

This is the local source of truth for the org-to-customer mapping once provisioning succeeds.

### `hosting_plans`

Create a local catalog table for purchasable hosting plans:

- `id uuid`
- `enhance_plan_id varchar(255) unique`
- `name varchar(255) not null`
- `description text`
- `features jsonb`
- **[v2]** `service_type varchar(20) not null check (service_type in ('web','email','wordpress','node'))` — use VARCHAR + CHECK constraint, not MySQL-style `enum()`
- `price_monthly numeric(10,2)`
- `is_active boolean default true`
- timestamps + updated_at trigger

Plan sync rules:

- Sync technical metadata from Enhance into local rows.
- Preserve local commercial fields such as `price_monthly`, `service_type`, and `is_active` on upsert unless an admin explicitly edits them.
- Mark missing remote plans inactive rather than deleting rows that may already be referenced locally.

### `hosting_subscriptions`

Create the per-org purchased hosting records:

- `id uuid default gen_random_uuid()`
- `organization_id uuid not null references organizations(id)`
- `created_by uuid references users(id)`
- `plan_id uuid not null references hosting_plans(id)`
- `domain varchar(255)`
- `enhance_subscription_id varchar(255)`
- `enhance_website_id varchar(255)`
- `primary_ip varchar(45)`
- `status varchar(20) not null default 'provisioning' check (status in ('provisioning','active','suspended','cancelled','error'))`
- `settings jsonb default '{}'`
- `next_billing_at timestamptz`
- `last_billed_at timestamptz`
- timestamps + updated_at trigger

Indexes:

- `idx_hosting_subscriptions_org_id` on `organization_id`
- `idx_hosting_subscriptions_status` on `status`
- `idx_hosting_subscriptions_next_billing` on `next_billing_at` where `status = 'active'`

RLS:

- Enable RLS on `hosting_subscriptions` and mirror the same app-role/org-scoped policy style already used for billing tables in migration `048_add_rls_billing_egress_tables.sql`.
- **[v2]** The RLS policies use session variables `app.current_org_id` and `app.current_user_is_admin`, set by the application at query time. Match the exact policy pattern:

```sql
-- SELECT: user sees rows matching their org, or if no org context, or if admin
FOR SELECT USING (
    organization_id::text = current_setting('app.current_org_id', true)
    OR current_setting('app.current_org_id', true) IS NULL
    OR current_setting('app.current_user_is_admin', true) = 'true'
);

-- INSERT: admin only, or matching org_id
FOR INSERT WITH CHECK (
    current_setting('app.current_user_is_admin', true) = 'true'
    OR organization_id::text = current_setting('app.current_org_id', true)
);

-- UPDATE: admin only
FOR UPDATE USING (current_setting('app.current_user_is_admin', true) = 'true');

-- DELETE: admin only
FOR DELETE USING (current_setting('app.current_user_is_admin', true) = 'true');
```

## Enhance API Contract To Implement Against

Use `repo-docs/enhance-oas3-api.yaml` directly for payload schemas. The main paths and operationIds already confirmed are:

| Concern | Path(s) | OperationId(s) |
|---|---|---|
| Connectivity | `/orgs/{org_id}`, `/servers/groups`, `/orgs/{org_id}/plans` | `getOrg`, `getServerGroups`, `getPlans` |
| Customers | `/orgs/{org_id}/customers` | `getOrgCustomers`, `createCustomer` |
| Customer subscriptions | `/orgs/{org_id}/customers/{customer_org_id}/subscriptions`, `/orgs/{org_id}/subscriptions/{subscription_id}` | `getCustomerSubscriptions`, `createCustomerSubscription`, `getSubscription`, `updateSubscription`, `deleteSubscription` |
| Website lifecycle | `/orgs/{org_id}/websites`, `/orgs/{org_id}/websites/{website_id}` | `getWebsites`, `createWebsite`, `getWebsite`, `updateWebsite`, `deleteWebsite` |
| Domain mappings | `/orgs/{org_id}/websites/{website_id}/domains`, `/orgs/{org_id}/websites/{website_id}/domains/primary` | `getWebsiteDomainMappings`, `createWebsiteMappedDomain`, `getWebsiteDomainMapping`, `updateWebsiteDomainMapping`, `deleteWebsiteDomainMapping`, `updateWebsitePrimaryDomain` |
| DNS | `/orgs/{org_id}/websites/{website_id}/domains/{domain_id}/dns-zone`, `/orgs/{org_id}/websites/{website_id}/domains/{domain_id}/dns-zone/records` | `getWebsiteDomainDnsZone`, `updateWebsiteDomainDnsZone`, `createWebsiteDomainDnsZoneRecord`, `updateWebsiteDomainDnsZoneRecord`, `deleteWebsiteDomainDnsZoneRecord` |
| Email | `/orgs/{org_id}/websites/{website_id}/emails`, `/orgs/{org_id}/websites/{website_id}/domains/{domain_id}/emails`, `/orgs/{org_id}/websites/{website_id}/emails/{email_address}` | `getWebsiteEmails`, `createWebsiteEmail`, `getWebsiteEmail`, `updateWebsiteEmail`, `deleteWebsiteEmail`, `getWebsiteEmailClientConf`, `createWebsiteEmailAutoresponder`, `deleteWebsiteEmailAutoresponder` |
| PHP | `/websites/{website_id}/lsphp_settings`, `/v2/websites/{website_id}/restart_php` | `getWebsiteLsphpSettings`, `setWebsiteLsphpSettings`, `restartWebsitePhp` |
| Node / apps | `/orgs/{org_id}/websites/{website_id}/apps`, `/websites/{website_id}/apps/persistent`, `/websites/{website_id}/apps/node*` | `getWebsiteApps`, `createWebsiteApp`, `deleteWebsiteApp`, `createWebsitePersistentApp`, `getWebsitePersistentApps`, `updateWebsitePersistentApp`, `getWebsitePersistentAppLog`, `deleteWebsitePersistentApp`, `installNvm`, `getPossibleNodeVersions`, `installNodeVersion`, `listInstalledNodeVersions`, `setDefaultNodeVersion` |
| WordPress | `/orgs/{org_id}/websites/{website_id}/apps/wordpress`, `/orgs/{org_id}/websites/{website_id}/apps/{app_id}/wordpress*` | `getWordpressInstallations`, `getWordpressSettings`, `updateWordpressSettings`, `updateWordpressAppVersion`, `getWordpressAppVersion`, `getWordpressUsers`, `createWordpressUser`, `updateWordpressUser`, `deleteWordpressUser`, `getWordpressUserSsoUrl`, `getWordpressConfig`, `setWordpressConfig`, `getWordpressPlugins`, `installWordpressPlugin`, `deleteWordpressPlugin`, `getWordpressThemes`, `installWordpressTheme`, `deleteWordpressTheme`, `updateWordpressTheme`, `activateWordpressTheme` |

While implementing, use the request/response schemas from the OAS rather than reconstructing payloads from removed code. The key schema families still to read carefully are `NewCustomer`, `NewSubscription`, `NewWebsite`, `UpdateSubscription`, `UpdateWebsite`, `NewMappedDomain`, `NewEmail`, `LsphpSettings`, `PersistentApp`, and the WordPress app schemas.

## Backend Services And Boundaries

### `api/services/enhanceToggle.ts` (new)

This service owns effective enablement state, not `enhanceService`.

Suggested surface:

- `getStatus()`
- `isEffectivelyEnabled()`
- `setRuntimeEnabled(enabled, actorUserId)`
- `runHealthCheck(actorUserId)`
- `invalidateCache()`

Behavior:

- Read `ENHANCE_ENABLED` from config.
- Read runtime state from `platform_integrations`.
- Compute `missingEnv[]` from required Enhance env vars.
- Reject attempts to enable runtime state when the hard gate is off or required env vars are missing.
- Persist health-check results back to `platform_integrations`.
- Emit `logActivity()` for state changes and health checks.

### `api/services/enhanceService.ts` (new)

This service is remote/API only.

- Build one authenticated HTTP client from `config.ENHANCE_API_URL` + `config.ENHANCE_API_KEY`.
- Normalize remote failures into a single `EnhanceApiError` shape.
- Expose low-level remote methods for plans, customers, subscriptions, websites, DNS, email, PHP, Node, and WordPress.
- Do not create or update local `hosting_subscriptions`, `hosting_plans`, or wallet/payment rows here.

Important boundary:

- Local DB writes belong in route/orchestration code and in recurring billing code.
- `enhanceService` should accept explicit ids because the OAS mixes org-scoped, website-scoped, and `/v2/websites/...` endpoints.

## Local Orchestration, Purchase Flow, And Billing

### Purchase orchestration boundary

The initial purchase saga should live in the hosting purchase route or a very small hosting provisioning/orchestration service if the route becomes too large. It should not be folded into `enhanceService`.

### Initial purchase saga

Because `payment_transactions` cannot use `pending`, use the existing internal wallet conventions already present in `paypalService.ts` and egress billing:

- debit rows use negative amounts with `payment_method='wallet_debit'`, `payment_provider='internal'`, `status='completed'`
- rollback rows use positive amounts with `payment_method='wallet_credit'`, `payment_provider='internal'`, `status='completed'`

Flow:

1. DB transaction
   - lock the org wallet row
   - verify balance
   - deduct the first monthly amount
   - insert a completed internal wallet-debit transaction with metadata referencing the local provisional subscription id
   - insert a provisional `hosting_subscriptions` row with `status='provisioning'`
2. Remote Enhance calls
   - ensure local org has an Enhance customer id; if not, create one and persist `organizations.enhance_customer_id`
   - create the remote customer subscription via `createCustomerSubscription`
   - create the remote website via `createWebsite`
   - create/update domain mapping separately if the `NewWebsite` payload from the OAS does not cover the required domain outcome directly
3. Success DB transaction
   - update the local row with remote ids, primary IP, status `active`, `last_billed_at`, `next_billing_at`
   - enrich the original wallet-debit transaction metadata with the remote ids
4. Failure DB transaction
   - restore the wallet balance
   - insert a completed compensating wallet-credit transaction tied back to the original debit row
   - mark the local hosting row `error`
   - store error/context in `hosting_subscriptions.settings`
5. Best-effort remote cleanup
   - if the website was created, try `deleteWebsite`
   - if the subscription was created without a surviving website, try `deleteSubscription`
   - if cleanup fails, leave the local row in `error` with the remote ids captured for admin remediation

### Recurring billing

Add `api/services/hostingBillingService.ts` with `runMonthlyHostingBilling()`.

Behavior:

- Run hourly, checking only subscriptions whose `status='active'` and `next_billing_at <= now()`.
- Deduct wallet balance using the same internal debit conventions as other billing services.
- On success, update `last_billed_at` and push `next_billing_at` forward one month.
- On insufficient balance, suspend the remote resource using the OAS-backed `updateWebsite` and/or `updateSubscription` path that matches the confirmed payload shape, then mark the local row `suspended`.
- Log activity and send notifications to the org owner/admin path already used elsewhere.

Scheduler registration **[v2]**:

- Add `runMonthlyHostingBilling()` to the `startBillingScheduler()` function in `api/server.ts`.
- Include it in both the initial `Promise.all` block (lines 103-107) and the hourly interval (lines 113-116).
- Guard with an effective-enablement check so it no-ops when hosting is off.

## Middleware And Route Mounting

### `api/middleware/hosting.ts` (new)

- `requireHostingEnabled`: 503 when effective enablement is false.
- `requireHostingEnabledForUsers`: same check, but platform admins bypass it so they can still inspect/administer the feature while it is off for customers.
- `requireOrgPermission(permission)`: new helper that reads `req.organizationId` instead of `req.params.id` and delegates to `RoleService.checkPermission()`.

### `api/app.ts`

Mount hosting routes in two pieces **[v2]** (insert after line 311, before the error handler at line 319):

- `app.use("/api/hosting", hostingPublicRoutes)` — public router for `/api/hosting/status`
- `app.use("/api/hosting", hostingAuthenticatedRoutes)` — authenticated router for every other `/api/hosting/*` endpoint

CSRF is already applied globally on `/api` (line 271), so both routers are covered automatically.

Do not put a blanket app-level enablement gate around the whole `/api/hosting` namespace, because that would also block the public status endpoint.

## Backend Routes

### Admin routes: `api/routes/admin/enhance.ts` (new)

Mount from `api/routes/admin/index.ts` as `router.use('/enhance', enhanceAdminRouter)` **[v2]** (add alongside the existing mount points around lines 43-67).

Endpoints:

- `GET /api/admin/enhance/status`
- `PATCH /api/admin/enhance/status`
- `POST /api/admin/enhance/status/test`
- `POST /api/admin/enhance/plans/sync`
- `GET /api/admin/enhance/plans`
- `PUT /api/admin/enhance/plans/:id`
- `GET /api/admin/enhance/subscriptions`
- `POST /api/admin/enhance/orgs/:orgId/sync-customer`
- admin-only suspend/unsuspend/cancel actions for troubleshooting and billing remediation

Notes:

- Status/config endpoints stay reachable even when hosting is effectively disabled.
- Plan sync reads from Enhance and upserts into local `hosting_plans`.
- Cross-org admin listings come from local tables, not from recursive remote reads.

### Public hosting route

`api/routes/hosting/public.ts`

- `GET /api/hosting/status` returns effective enablement only

### Authenticated store route

`api/routes/hosting/store.ts`

- `GET /api/hosting/plans`
- `GET /api/hosting/regions`
- `GET /api/hosting/services`
- `GET /api/hosting/services/:id`
- `POST /api/hosting/purchase`
- `POST /api/hosting/services/:id/cancel`

Rules:

- User-facing `:id` params are local `hosting_subscriptions.id` values.
- `GET` routes require `hosting_view`.
- Purchase/cancel/suspend style mutations require `hosting_manage`.
- The route must resolve the local row first, then use the stored Enhance ids to call remote APIs.

### Module routes restored from history

Restore and modernize:

- `api/routes/hosting/web.ts`
- `api/routes/hosting/node.ts`
- `api/routes/hosting/email.ts`
- `api/routes/hosting/dns.ts`
- `api/routes/hosting/wordpress.ts`

Rules for all module routes:

- Scope by local service id plus `organization_id`, not by user id.
- Translate local service id to remote website/subscription ids server-side.
- Use `hosting_view` for reads and `hosting_manage` for mutations.
- Do not copy historical bugs from the removed codebase; re-read and adapt the logic instead.

Module expectations:

- `web.ts`: overview, PHP settings, PHP restart, and the previously shipped website/PHP actions from the historical integration
- `node.ts`: app listing plus persistent-app and Node/NVM operations
- `email.ts`: mailbox/forwarder CRUD, client config, autoresponder
- `dns.ts`: mapped domains, primary domain, zone read/update, record CRUD
- `wordpress.ts`: discovery/install/settings/version/plugins/themes/users/SSO

If the removed historical UI exposed MySQL, FTP, SSL, or related website management inside the old web surface, restore those in this same phase after verifying the old behavior against the OAS rather than leaving them as a silent omission.

## Frontend

### Hooks

Add query-key factory hooks following repo conventions.

Examples:

- `src/hooks/useHosting.ts`
- `src/hooks/useEnhanceIntegration.ts`

They should cover:

- public status
- user plan list, regions, services, service detail
- admin status, plans, subscriptions, sync actions

### User routes and pages

Add protected routes in `src/App.tsx` **[v2]** (insert after the VPS routes around line 281):

- `/hosting`
- `/hosting/store`
- `/hosting/:id`

Restore the removed user-facing hosting pages using the historical implementation as reference, but update them to current repo conventions:

- use `apiClient`, not raw `fetch`
- use shadcn/ui primitives already in the repo
- use `cn()` for composed class names
- keep local route params bound to local service ids

Expected page tree:

- `src/pages/user/Hosting/HostingList.tsx`
- `src/pages/user/Hosting/HostingStore.tsx`
- `src/pages/user/Hosting/HostingDashboard.tsx`
- `src/pages/user/Hosting/tabs/*`

### Admin section

Add a new section `enhance-hosting` to the active admin shell.

Required updates:

- extend the `AdminSection` union in `src/pages/Admin.tsx` (line 186-210)
- add `enhance-hosting` to `ADMIN_SECTIONS` (line 220-245)
- add the new `<SectionPanel section="enhance-hosting" ...>` block
- add the corresponding hash-based nav item in `src/components/AppSidebar.tsx` admin mode nav (lines 72-184)
- update any strategic-panel/catalog data inside `Admin.tsx` that assumes the closed set of admin sections

New admin components:

- `src/components/admin/EnhanceIntegrationCard.tsx`
- `src/components/admin/EnhancePlans.tsx`
- `src/components/admin/UserHostingList.tsx`

`EnhanceIntegrationCard` should:

- show effective status
- show whether the hard env gate is off
- show missing env vars
- allow toggle on/off only when the hard gate is on and env vars are complete
- run connection tests

### Org detail/admin surface

Update `src/components/admin/OrganizationManagement.tsx` to add:

- Enhance customer id badge/value
- "Sync to Enhance" button wired to `POST /api/admin/enhance/orgs/:orgId/sync-customer`

### Conditional UI rules

- `AppSidebar` should only show hosting navigation when public hosting status is enabled and the current org permissions indicate `hosting_view`.
- **[v2]** Add hosting nav item to `userNavItems` (after line 208) with appropriate icon (e.g., `Globe` or `Cloud`).
- `Dashboard` should only show hosting summary cards when the same conditions are true.
- The `/api/organizations/resources` hosting permission flags added in Part 0 should be reused here rather than inventing a second permission source.

## Testing

Use the repo's actual test layout:

- `api/services/*.test.ts`
- `api/routes/__tests__/*.test.ts`
- `api/tests/*.test.ts`
- `tests/security/*.test.ts`

Planned coverage:

- `api/services/enhanceService.test.ts`
- `api/services/enhanceToggle.test.ts`
- `api/services/hostingBillingService.test.ts`
- `api/routes/__tests__/admin-enhance-status.test.ts`
- `api/routes/__tests__/hosting-store.test.ts`
- `api/tests/hosting-purchase-saga.test.ts`
- `tests/security/hosting-org-isolation.test.ts`
- the Part 0 role tests listed earlier

Core scenarios to cover:

- hard gate off keeps hosting disabled even if the DB toggle is on
- missing env vars block runtime enablement
- plan sync upserts without clobbering local commercial fields
- initial purchase happy path
- remote failure creates compensating wallet credit and leaves the org whole
- recurring billing success
- recurring billing insufficient-funds suspension path
- cross-org access isolation on all hosting routes
- admin bypass behavior while hosting is disabled for users
- **[v2]** custom roles with egress permissions are accepted (existing bug fix validation)
- **[v2]** `member` role permissions are correctly resolved via the `/resources` endpoint (not hardcoded)

## Docs

- Update `README.md` to describe the restored hosting surface and required env vars.
- Update `README.md` Organizations & Multi-Tenancy section to include the full predefined roles & permissions matrix table.
- Add `repo-docs/enhance-integration.md` with the effective enablement model, org mapping, plan sync, purchase flow, and recurring billing behavior.
- Run `npm run docs:api:sync` after the route work lands.

## Rollout Order

1. Part 0: `member` and `hosting_manager` roles, hosting permissions, and egress gap fix
2. `057_add_enhance_hosting_schema.sql`, `.env.example`, and `api/config/index.ts`
3. `enhanceToggle` service plus hosting enablement middleware/helpers
4. OAS-backed `enhanceService` with tests
5. Admin status/toggle/sync-plans routes and the `enhance-hosting` admin section
6. User store routes and the initial purchase saga
7. Recurring hosting billing service and scheduler registration in `api/server.ts`
8. Restore `web`, `node`, `email`, `dns`, and `wordpress` routes/pages
9. Org admin polish, nav/dashboard gating, docs, and security tests

## Explicit Non-Goals

- No Linode/provider/VPS scope expansion
- No `ENHANCE_HOSTING_UI_ENABLED`
- No reintroduction of a DB-backed `enhance_config` table
- No edits to old migrations
- No customer-facing refund workflow for failed provisioning; use compensating internal wallet credits instead
- No multi-cluster Enhance support in this pass

## v2 Changelog

This section summarizes every change from v1 for quick diff:

1. **Migration 056 restructured**: Split into 6 explicit steps (seed permissions → UPDATE existing roles → INSERT member role → INSERT hosting_manager role → backfill rows → replace function body) instead of "re-run the seed function" which would be a no-op due to `ON CONFLICT DO NOTHING`.
2. **`predefined_permissions` gap**: Added `egress_view` and `egress_manage` alongside the new hosting permissions (these were never seeded).
3. **`validPermissions` allowlist**: Added `egress_view` and `egress_manage` to the custom-role allowlist fix (existing bug).
4. **`CreateRoleWizard.tsx` Egress category**: Added alongside the Hosting category (existing gap).
5. **`organizations.ts` `/resources` endpoint**: Updated to resolve `member` role permissions from the role system instead of hardcoding a minimal set.
6. **`OrganizationManagement.tsx` normalizeRoleName**: Added explicit instruction to stop the `member` → `viewer` conversion.
7. **`OrganizationManagement.tsx` default role**: Changed to prefer `member` over `viewer` via `getDefaultAssignableRoleId`.
8. **`hosting_plans.service_type`**: Changed from MySQL `enum()` to PostgreSQL `VARCHAR + CHECK`.
9. **`hosting_subscriptions` columns**: Added explicit types, foreign keys, indexes, and default values.
10. **RLS policy**: Included the exact SQL pattern from migration 048 rather than a vague reference.
11. **Config integration**: Added concrete instructions for `api/config/index.ts` (interface, `getConfig()`, no `validateConfig()`).
12. **Route mounting**: Added specific line numbers in `api/app.ts` and `api/routes/admin/index.ts`.
13. **Scheduler registration**: Added concrete location in `api/server.ts` for the billing scheduler hook.
14. **Frontend routing**: Added line number references in `src/App.tsx` and `src/components/AppSidebar.tsx`.
15. **Additional tests**: Added tests for egress custom-role acceptance, member role via `/resources`, custom-role preservation during migration, and predefined role hosting permission distribution.

### v3 Changelog (from v2)

16. **`hosting_manager` predefined role**: Added as a 7th predefined role — hosting-only with zero VPS permissions, mirroring `vps_manager` which has VPS-only with zero hosting permissions.
17. **`vps_manager` decoupled from hosting**: Removed `hosting_view` from `vps_manager` — VPS and hosting are now fully decoupled at the role level.
18. **Migration 056 Step 4**: Added INSERT for `hosting_manager` role across all orgs.
19. **Seed function**: Updated to include 7 predefined roles (owner, admin, member, vps_manager, hosting_manager, support_agent, viewer).
20. **Permission matrix**: Replaced inline role lists with a full cross-referenced permission matrix table.
21. **README.md docs**: Added instruction to include the predefined roles & permissions matrix in the Organizations & Multi-Tenancy section.
22. **Tests**: Added `hosting_manager` existence, hosting permissions, and absence of VPS permissions assertions. Updated `vps_manager` test to confirm zero hosting permissions.
