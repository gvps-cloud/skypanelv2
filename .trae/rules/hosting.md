# Enhance Hosting Rules

Specific guidance for Enhance web hosting integration.

> **Source:** Derived from `AGENTS.md` Enhance Hosting Gotchas section.

## Official API Reference

The official Enhance API reference is `repo-docs/enhance-oas3-api.yaml`. **Always verify endpoint payloads there** before changing hosting routes/services.

## Customer vs Master Organization

### Critical Rule

**Customer websites must use the customer Enhance org id, not the master org.**

### How to Get Customer Org ID

Do NOT use `SELECT * FROM hosting_subscriptions` alone. Instead, use `getHostingSubscriptionForOrganization()`:

```typescript
import { getHostingSubscriptionForOrganization } from '../lib/hostingEnhanceOrg.js';

const subscription = await getHostingSubscriptionForOrganization(organizationId);
const enhanceOrgId = subscription.enhance_customer_org_id;
```

This ensures you get the correct customer org ID associated with the hosting subscription.

## Domain Requirements

### Initial Checkout

**Initial hosting checkout requires a real domain.** Do not:
- Offer free staging domains during checkout
- Auto-generate Enhance staging domains

Customers must provide their own domain for production hosting.

## Provider Token Handling

### Token Normalization

Before creating Enhance provider/client calls, preserve `normalizeProviderToken()` usage for provider tokens:

```typescript
import { normalizeProviderToken } from '../lib/providerTokens.js';

const token = normalizeProviderToken(config.ENHANCE_API_KEY);
```

This handles any token transformations required for API compatibility.

## Hosting Flow Architecture

### Key Files

| File | Purpose |
|------|---------|
| `api/routes/hosting/store.ts` | Hosting purchase/checkout |
| `api/services/enhanceOnboardingService.ts` | Initial site setup |
| `api/services/enhanceService.ts` | Enhance API client |
| `api/services/hostingBillingService.ts` | Monthly recurring billing |

### Onboarding Flow

```
store.ts (checkout) 
  → enhanceOnboardingService.ts (create site, configure)
  → enhanceService.ts (API calls)
```

## Enhance API Configuration

### Exact Requirements

The Enhance hosting config has strict requirements:

```bash
# ✅ Correct
ENHANCE_API_URL=https://panel.example.com          # Panel origin only, NO /api
ENHANCE_API_KEY=raw_token_string                    # Raw token, NO "Bearer " prefix

# ❌ Incorrect
ENHANCE_API_URL=https://panel.example.com/api       # Has /api
ENHANCE_API_KEY=Bearer raw_token_string             # Has Bearer prefix
```

### Required Variables

```bash
ENHANCE_API_URL              # Panel origin (no /api)
ENHANCE_API_KEY              # Raw token from Enhance dashboard
ENHANCE_MASTER_ORG_ID        # Your master organization ID in Enhance
ENHANCE_DEFAULT_SERVER_GROUP_ID  # Default server group for new sites
```

## Hosting Sub-Routes

Hosting routes are split across multiple files in `api/routes/hosting/`:

| Route | Purpose |
|-------|---------|
| `web.ts` | Website management |
| `node.ts` | Node.js apps |
| `email.ts` | Email hosting |
| `dns.ts` | DNS management |
| `wordpress.ts` | WordPress installations |
| `joomla.ts` | Joomla installations |
| `mysql.ts` | MySQL databases |
| `ftp.ts` | FTP accounts |
| `ssl.ts` | SSL certificates |
| `apps.ts` | App marketplace |
| `backups.ts` | Backup management |
| `cron.ts` | Cron jobs |
| `ssh.ts` | SSH access |

Each is individually imported and mounted in `api/app.ts`.

## Hosting Billing

### Monthly Recurring Billing

Handled by `api/services/hostingBillingService.ts`. This runs on a cron schedule to:
- Calculate monthly hosting costs
- Generate invoices
- Handle renewals

### Billing Cycles

Hosting subscriptions have billing cycles tracked in `hosting_billing_cycles` table.

## Error Handling for Hosting

Use the standard `handleProviderError()` for Enhance API errors:

```typescript
import { handleProviderError } from '../lib/errorHandling.js';

try {
  const site = await enhanceService.createSite(data);
} catch (error) {
  handleProviderError(res, error, 'Creating Enhance site');
}
```

## Testing Hosting Features

Common targeted test after changes:
```bash
npx vitest run api/routes/__tests__/hosting-store.test.ts api/tests/hosting-purchase-saga.test.ts
```

## Related Documentation

- `repo-docs/enhance-oas3-api.yaml` — Official API reference
- `repo-docs/enhance-integration.md` — Integration notes
- `plans/enhance-reintegration-plan-2.md` — Historical context