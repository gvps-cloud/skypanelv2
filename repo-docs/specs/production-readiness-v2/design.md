# Design Document: Production Readiness Plan v2

## Overview

This document specifies the technical design for Production Readiness Plan v2, an 8-phase initiative to close all deferred security audit items, patch remaining npm CVEs, finish Linode OpenAPI alignment, and ship a gated volumes-billing roadmap for SkyPanelV2.

### Current State (as of commit e009b19)

- **Phase 0 (CVE Emergency)**: ✅ DONE
- **Phase 1 (Security Hardening)**: ⏳ ~80% complete
- **Phases 2-7**: Not started or partial

### Design Goals

1. **Security First**: Close all security gaps with router-level guards and organization isolation
2. **Maintainability**: Split monolith files into focused, testable modules
3. **Type Safety**: Integrate generated Linode OpenAPI types
4. **Test Coverage**: Achieve 70% lines / 80% branches on critical paths
5. **Operator-Run Verification**: All checks runnable locally without CI

### Hard User Constraints

1. No hosted CI of any kind (no GitHub Actions, Dependabot, Renovate, Socket.dev, Snyk)
2. No email sending during tests
3. No VPS creation during tests
4. Never run destructive database commands (`db:reset`, `db:reset:confirm`, `db:fresh`)
5. Primary deployment is PM2
6. Backend imports must end in `.js` (ESM)
7. One in-progress todo item at a time

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SkyPanelV2 System                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Frontend (React 18 + Vite)                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │   Pages     │  │ Components  │  │   Hooks     │  │  apiClient  │ │   │
│  │  │  (split)    │  │  (split)    │  │             │  │  (unified)  │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    │ HTTP/SSE                                │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Backend (Express 4 + PostgreSQL)              │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    Middleware Stack                              │ │   │
│  │  │  HTTPS → Security → CORS → CSRF → Rate Limit → API Key Auth     │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                    │                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    Route Layer (split)                           │ │   │
│  │  │  auth │ payments │ vps/* │ admin/* │ egress │ volumes           │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                    │                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    Service Layer                                 │ │   │
│  │  │  linodeService │ billingService │ egressService │ volumeService │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        External Services                             │   │
│  │  Linode API │ PayPal API │ PostgreSQL │ Redis (optional)            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Route Organization After Split

```
api/routes/
├── auth.ts                    # Authentication (login, register, 2FA, password reset)
├── payments.ts                # PayPal orders, capture, wallet (router-level org guard)
├── vps/
│   ├── index.ts              # VPS router aggregator
│   ├── providers.ts          # Provider list, regions, types
│   ├── plans.ts              # Plan management
│   ├── instances.ts          # VPS CRUD, lifecycle actions
│   ├── backups.ts            # Backup management
│   ├── disks.ts              # Disk management
│   ├── networking.ts         # IPs, VLANs, firewalls
│   ├── firewalls.ts          # Firewall rules
│   ├── stats.ts              # Metrics and stats
│   └── stackscripts.ts       # StackScripts
├── admin/
│   ├── index.ts              # Admin router aggregator
│   ├── users.ts              # User CRUD, impersonation
│   ├── settings.ts           # Platform settings
│   ├── billing.ts            # Admin billing operations
│   ├── emailTemplates.ts     # Email template management
│   ├── contact.ts            # Contact form management
│   ├── faq.ts                # FAQ management
│   ├── github.ts             # GitHub integration
│   ├── sshKeys.ts            # Admin SSH key management
│   ├── activity.ts           # Activity logs, CSV export
│   ├── documentation.ts      # Documentation articles
│   ├── networking.ts         # RDNS, IP management
│   ├── announcements.ts      # Announcements management
│   ├── categoryMappings.ts   # Category mappings
│   └── volumePricing.ts      # Volume pricing CRUD (Phase 6)
├── volumes.ts                 # Volume management (admin-only during roadmap)
├── egress.ts                  # Egress credits, usage
├── organizations.ts           # Organization CRUD, members, invitations
├── support.ts                 # Support tickets
├── sshKeys.ts                 # User SSH keys
├── invoices.ts                # Invoice listing
├── notifications.ts           # SSE stream, mark read (org-scoped)
├── activity.ts                # Activity stream
├── theme.ts                   # Theme presets
├── health.ts                  # Health check
├── contact.ts                 # Contact form
├── faq.ts                     # Public FAQ
├── pricing.ts                 # Public pricing
├── documentation.ts           # Public docs
├── announcements.ts           # Public announcements
├── notes.ts                   # Personal/org notes
├── apiKeys/                   # API key management
└── github.ts                  # GitHub integration
```

---

## Components and Interfaces

### Phase 1: Security Hardening

#### 1.1 Payments Router Organization Guard

**Current State**: `payments.ts` applies `authenticateToken` at router level, but `requireOrganization` is applied per-handler.

**Design**: Move `requireOrganization` to router level with PayPal webhook exception.

```typescript
// api/routes/payments.ts (after refactor)

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// PayPal webhook route (unauthenticated) - declared BEFORE org guard
// Note: No PayPal webhook route currently exists; if added, place here

// Apply organization guard to all authenticated routes
router.use(requireOrganization);

// All routes below automatically have org context
router.get("/config", (req, res) => { ... });
router.post("/create-payment", billingMutationRateLimiter, [...validators], async (req, res) => { ... });
```

**Migration Steps**:
1. Identify all routes currently using per-handler `requireOrganization`
2. Move `router.use(requireOrganization)` after `authenticateToken`
3. Remove redundant per-handler `requireOrganization` calls
4. Run security test suite to verify

#### 1.2 Notifications Organization Isolation

**Current State**: `notifications.ts` queries `activity_logs` by `user_id` only, not scoped to organization.

**Design**: Add organization scoping to all SELECT queries.

```typescript
// api/routes/notifications.ts (after refactor)

// GET /unread-count - add org scoping
router.get('/unread-count', async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user?.organizationId) {
    return res.status(403).json({ error: 'Organization membership required' });
  }

  const result = await query(
    `SELECT COUNT(*) as count
     FROM activity_logs
     WHERE user_id = $1 
       AND organization_id = $2 
       AND is_read = FALSE`,
    [user.id, user.organizationId]
  );
  // ...
});

// GET /unread - add org scoping
router.get('/unread', async (req: AuthenticatedRequest, res: Response) => {
  // ... add organization_id to WHERE clause
});

// GET / - add org scoping
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  // ... add organization_id to WHERE clause
});

// PATCH /:id/read - verify org ownership
router.patch('/:id/read', async (req: AuthenticatedRequest, res: Response) => {
  // ... verify notification belongs to user's org
});
```

**Cross-Org Access Prevention**:
```typescript
// When accessing a specific notification, verify org ownership
const notificationCheck = await query(
  `SELECT id FROM activity_logs 
   WHERE id = $1 AND organization_id = $2`,
  [notificationId, user.organizationId]
);

if (notificationCheck.rows.length === 0) {
  return res.status(404).json({ error: 'Notification not found' });
}
```

#### 1.3 Payment Isolation Security Test

**Test File**: `tests/security/payment-isolation.test.ts`

```typescript
describe('Payment Isolation', () => {
  let orgA: { user: User; token: string; organizationId: string };
  let orgB: { user: User; token: string; organizationId: string };

  beforeEach(async () => {
    // Seed two organizations with separate users
    orgA = await seedOrganization({ name: 'Org A' });
    orgB = await seedOrganization({ name: 'Org B' });
    
    // Seed payment data for each org
    await seedPaymentTransaction(orgA.organizationId, { id: 'order-a', amount: 100 });
    await seedPaymentTransaction(orgB.organizationId, { id: 'order-b', amount: 200 });
  });

  describe('PayPal Order Capture', () => {
    it('should prevent cross-org order capture', async () => {
      // Org A user tries to capture Org B's order
      const response = await request(app)
        .post('/api/payments/capture-payment/order-b')
        .set('Authorization', `Bearer ${orgA.token}`)
        .set('X-CSRF-Token', csrfToken);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Unauthorized');
    });
  });

  describe('Wallet Balance', () => {
    it('should prevent cross-org wallet access', async () => {
      // Org A user tries to view Org B's wallet
      const response = await request(app)
        .get('/api/payments/wallet')
        .set('Authorization', `Bearer ${orgA.token}`)
        .set('X-Organization-ID', orgB.organizationId);

      // Should either reject or return Org A's wallet (not Org B's)
      expect(response.status).not.toBe(200);
      // Or if 200, balance should be Org A's, not Org B's
    });
  });

  describe('Invoice Access', () => {
    it('should prevent cross-org invoice access', async () => {
      const invoiceB = await seedInvoice(orgB.organizationId);
      
      const response = await request(app)
        .get(`/api/invoices/${invoiceB.id}`)
        .set('Authorization', `Bearer ${orgA.token}`);

      expect(response.status).toBe(404);
    });
  });
});
```

#### 1.4 CORS Allowlist Audit

**Current State**: CORS origins configured via `CLIENT_URL` env var with localhost fallbacks in development.

**Design**: Audit and document CORS configuration.

```typescript
// api/config/index.ts - parseCorsOrigins (current implementation)

function parseCorsOrigins(value?: string): string[] {
  const localDevOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    // ... other localhost variants
  ];

  const parsed = (value || localDevOrigins.join(","))
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  // In development, always include local origins
  if (process.env.NODE_ENV !== "production") {
    localDevOrigins.forEach((origin) => deduped.add(origin));
  }

  return Array.from(deduped);
}
```

**Audit Findings**:
1. Production never emits `*` as allowed origin ✅
2. Development allows localhost origins ✅
3. Unknown origins return `false` (not throw) ✅
4. CORS callback logs rejected origins for monitoring ✅

**Security Review Note**: Document in `SECURITY.md` that `CLIENT_URL` must be set to exact production domain.

#### 1.5 Frontend LocalStorage Auth Token Cleanup

**Current State**: `apiClient` reads `auth_user` from localStorage for organization ID, but auth token is HttpOnly cookie.

**Design**: Remove any remaining `localStorage.auth_token` reads, ensure `AuthContext` is sole source of truth.

```typescript
// src/lib/api.ts - getAuthHeaders (current implementation)

private getAuthHeaders(): HeadersInit {
  const userStr = localStorage.getItem("auth_user");
  let organizationId: string | undefined;
  
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      organizationId = user.organizationId;
    } catch {
      // ignore
    }
  }

  const csrfToken = this.getCsrfToken();
  return {
    "Content-Type": "application/json",
    ...(csrfToken && { "X-CSRF-Token": csrfToken }),
    ...(organizationId && { "X-Organization-ID": organizationId }),
  };
}
```

**Cleanup Required**:
1. Search for `localStorage.auth_token` reads in `src/` - remove any found
2. Verify `AuthContext` uses HttpOnly cookie only
3. Verify `apiClient` uses `credentials: "include"` for all requests

---

### Phase 2: Linode OpenAPI Alignment

#### 2.1 Endpoint Coverage Matrix

**Output**: `docs/linode-coverage-matrix.md`

**Structure**:
```markdown
# Linode API Coverage Matrix

## VPSDetail Actions

| Frontend Action | API Route | linodeService Method | Linode OpenAPI Path | Status |
|-----------------|-----------|---------------------|---------------------|--------|
| Boot instance | POST /api/vps/:id/boot | bootInstance | POST /linode/instances/{linodeId}/boot | ✅ Covered |
| Shutdown instance | POST /api/vps/:id/shutdown | shutdownInstance | POST /linode/instances/{linodeId}/shutdown | ✅ Covered |
| Reboot instance | POST /api/vps/:id/reboot | rebootInstance | POST /linode/instances/{linodeId}/reboot | ✅ Covered |
| List disks | GET /api/vps/:id/disks | listDisks | GET /linode/instances/{linodeId}/disks | ✅ Covered |
| ... | ... | ... | ... | ... |

## Dead Code Flags

- [ ] Frontend calls with no backend route
- [ ] Backend routes with no frontend consumer
- [ ] OpenAPI drift (hand-written types differ from spec)
```

#### 2.2 Generated TypeScript Types Integration

**Current State**: `api/types/linode-openapi.ts` exists with generated types, but `linodeService.ts` uses hand-written interfaces.

**Design**: Replace hand-written interfaces with generated types.

```typescript
// api/services/linodeService.ts (after refactor)

import type { components } from '../types/linode-openapi.js';

// Use generated types
type LinodeInstance = components['schemas']['Linode'];
type LinodeType = components['schemas']['LinodeType'];
type LinodeRegion = components['schemas']['Region'];
type LinodeImage = components['schemas']['Image'];
type LinodeBackup = components['schemas']['Backup'];
type LinodeDisk = components['schemas']['Disk'];
type LinodeIP = components['schemas']['IP'];
type LinodeVolume = components['schemas']['Volume'];

// Replace hand-written interfaces
export type {
  LinodeInstance,
  LinodeType,
  LinodeRegion,
  LinodeImage,
  LinodeBackup,
  LinodeDisk,
  LinodeIP,
  LinodeVolume,
};
```

**Operator Procedure** (document in `SECURITY.md`):
```bash
# Re-run monthly or after visible Linode API changes
npm run linode:types:sync
# This runs: openapi-typescript repo-docs/linode-openapi.json -o api/types/linode-openapi.ts
```

#### 2.3 Disk Management Tests

**Test Files**:
1. `tests/security/disks-isolation.test.ts` - Organization isolation
2. `api/routes/__tests__/vps-disks.test.ts` - Route handler tests
3. `src/components/__tests__/VPSDisksTab.test.tsx` - React component tests

**Mock Strategy**:
```typescript
// Mock Linode API calls
vi.mock('../services/linodeService.js', () => ({
  linodeService: {
    listDisks: vi.fn(),
    createDisk: vi.fn(),
    resizeDisk: vi.fn(),
    deleteDisk: vi.fn(),
  },
}));
```

#### 2.4 VPS Route Error Handling Audit

**Design**: Ensure all VPS routes use `handleProviderError()` for Linode errors.

```typescript
// api/lib/errorHandling.ts - handleProviderError (existing)

export function handleProviderError(
  res: Response,
  error: unknown,
  fallbackMessage = "Provider operation failed"
): void {
  if (isLinodeApiError(error)) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.errors?.[0]?.reason || fallbackMessage;
    res.status(status).json({ error: message });
    return;
  }
  // ... handle other error types
}
```

**Audit Checklist**:
- [ ] All `/api/vps/*` routes use `handleProviderError()`
- [ ] Pagination parameters passed through to Linode API
- [ ] Rate-limit headers surfaced from Linode responses
- [ ] Field limits pre-validated before Linode API calls

---

### Phase 3: npm Safety Strategy

#### 3.1 Dependency Version Pinning

**Design**: Remove all `^` prefixes from `package.json`.

```json
{
  "dependencies": {
    "express": "4.21.2",        // Was "^4.21.2"
    "react": "18.3.1",          // Was "^18.3.1"
    "pg": "8.13.1",             // Was "^8.13.1"
    // ... all other dependencies
  },
  "devDependencies": {
    "typescript": "5.7.3",      // Was "^5.7.3"
    "vite": "6.4.2",            // Was "^6.4.2"
    // ... all other devDependencies
  }
}
```

**Procedure**:
```bash
# Remove all ^ prefixes from package.json
# Rebuild package-lock.json
rm package-lock.json
npm install
npm audit --audit-level=high  # Must exit 0
```

**Deploy Documentation** (in `SECURITY.md`):
```markdown
## Deployment

On deploy hosts, always use:
\`\`\`bash
npm ci --ignore-scripts
\`\`\`

This installs exact versions from package-lock.json without running postinstall scripts.
```

#### 3.2 Unused Dependency Removal

**Analysis Required**:

| Package | Status | Action |
|---------|--------|--------|
| `crypto-js` | Superseded by `api/lib/crypto.ts` | Remove if unused |
| `react-simple-maps` | Duplicate map library | Consolidate to one |
| `react-leaflet` | Duplicate map library | Consolidate to one |
| `leaflet` | Dependency of react-leaflet | Keep if using react-leaflet |
| `react-leaflet-cluster` | Map clustering | Keep if using react-leaflet |
| `vite-plugin-trae-solo-badge` | Unknown usage | Evaluate and remove if unused |

**Procedure**:
```bash
npx depcheck
# Evaluate each flagged package
# Document decision for each
# Remove confirmed unused packages
```

#### 3.3 Manual Dependency Review Cadence

**Documentation**: `docs/dependency-review.md`

```markdown
# Dependency Review Checklist

## Weekly Operator Task

1. Run `npm outdated` to check for updates
2. Run `npm audit` to check for vulnerabilities
3. For high-severity advisories:
   - Review advisory details
   - Assess impact on SkyPanelV2
   - Create PR with version bump
   - Run full test suite before merge

## Review Checklist

- [ ] Check `npm outdated` output
- [ ] Check `npm audit` output
- [ ] Review changelog for major version updates
- [ ] Test in staging before production
- [ ] Document any breaking changes

## Prohibited Automation

- No Dependabot
- No Renovate
- No hosted dependency automation services
```

#### 3.4 Software Bill of Materials

**Procedure** (document in `SECURITY.md`):
```bash
# At release time, generate SBOM
npx @cyclonedx/cyclonedx-npm --output-file sbom.json

# Attach to release notes
# Store in docs/releases/sbom-vX.Y.Z.json
```

---

### Phase 4: Architecture Cleanups

#### 4.1 Duplicate Notification System Consolidation

**Current State**: Three notification-related endpoints:
- `/api/activity` - SSE stream
- `/api/notifications` - SSE stream, CRUD
- `/api/activities` - Activity logging

**Analysis Required**:
1. Map all consumers of each endpoint
2. Identify redundant endpoints
3. Document deprecation plan
4. Migrate consumers to canonical endpoint

**Recommendation**: Consolidate to `/api/notifications` as canonical.

#### 4.2 VPS Route Monolith Split

**Current State**: `api/routes/vps.ts` is 5,322 lines.

**Target Structure**:
```
api/routes/vps/
├── index.ts           # Router aggregator, exports combined router
├── providers.ts       # GET /providers, /providers/:id, /regions, /types
├── plans.ts           # GET /plans
├── instances.ts       # CRUD, lifecycle (boot, shutdown, reboot, rebuild)
├── backups.ts         # GET /backups, POST /backups/:id/enable
├── disks.ts           # CRUD for disks
├── networking.ts      # IPs, VLANs
├── firewalls.ts       # Firewall rules
├── stats.ts           # GET /stats, /stats/:year/:month
└── stackscripts.ts    # StackScript management
```

**Split Strategy**:
1. Create `api/routes/vps/` directory
2. Create each sub-module with proper middleware
3. Create `index.ts` that aggregates all sub-routers
4. Update `api/app.ts` to import from new location
5. Run tests after each sub-module creation

**Sub-Module Template**:
```typescript
// api/routes/vps/instances.ts

import express from 'express';
import { authenticateToken, requireOrganization } from '../../middleware/auth.js';
import { linodeService } from '../../services/linodeService.js';
import { handleProviderError } from '../../lib/errorHandling.js';

const router = express.Router();

// Apply guards at router level
router.use(authenticateToken, requireOrganization);

// GET /api/vps - List instances
router.get('/', async (req, res) => {
  // ... implementation
});

// POST /api/vps - Create instance
router.post('/', async (req, res) => {
  // ... implementation
});

// ... other routes

export default router;
```

**Index Aggregator**:
```typescript
// api/routes/vps/index.ts

import express from 'express';
import providers from './providers.js';
import plans from './plans.js';
import instances from './instances.js';
import backups from './backups.js';
import disks from './disks.js';
import networking from './networking.js';
import firewalls from './firewalls.js';
import stats from './stats.js';
import stackscripts from './stackscripts.js';

const router = express.Router();

router.use('/', providers);
router.use('/', plans);
router.use('/', instances);
router.use('/', backups);
router.use('/', disks);
router.use('/', networking);
router.use('/', firewalls);
router.use('/', stats);
router.use('/', stackscripts);

export default router;
```

#### 4.3 Admin Route Monolith Split

**Current State**: `api/routes/admin.ts` is 5,797 lines.

**Target Structure**:
```
api/routes/admin/
├── index.ts              # Router aggregator
├── users.ts              # User CRUD, impersonation
├── settings.ts           # Platform settings
├── billing.ts            # Admin billing (already exists)
├── emailTemplates.ts     # Email templates (already exists)
├── contact.ts            # Contact form (already exists)
├── faq.ts                # FAQ (already exists)
├── github.ts             # GitHub integration
├── sshKeys.ts            # Admin SSH keys (already exists)
├── activity.ts           # Activity logs (already exists)
├── documentation.ts      # Documentation (already exists)
├── networking.ts         # RDNS, IPs (already exists)
├── announcements.ts      # Announcements (already exists)
├── categoryMappings.ts   # Category mappings (already exists)
└── volumePricing.ts      # Volume pricing (Phase 6)
```

**Note**: The admin router split is active in the current codebase via `api/routes/admin/index.ts`. A root-mounted alias preserves `POST /api/admin/impersonation/exit` while user-management routes remain under `users.ts`.

**Exception Handling**: Two routes must be mounted BEFORE `requireAdmin`:
1. Impersonation exit (`POST /api/admin/impersonation/exit`)
2. Ticket stream (SSE endpoint)

```typescript
// api/routes/admin/index.ts

import express from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import users from './users.js';
// ... other imports

const router = express.Router();

// Exception routes (before admin guard)
router.post('/impersonation/exit', authenticateToken, async (req, res) => {
  // ... impersonation exit handler
});

// Root-mounted alias kept for historical frontend contract
router.post('/impersonation/exit', authenticateToken, async (req, res) => {
  // ... impersonation exit handler
});

// Sub-routers manage their own guards
router.use('/users', users);
router.use('/', settings);
// ... other sub-routers

export default router;
```

#### 4.4 VPSDetail Component Split

**Current State**: `src/pages/VPSDetail.tsx` is a large component with multiple tabs.

**Target Structure**:
```
src/pages/VPSDetail/
├── index.tsx             # Main component, tab routing
├── OverviewTab.tsx       # Overview tab
├── NetworkingTab.tsx     # Networking tab
├── BackupsTab.tsx        # Backups tab
├── DisksTab.tsx          # Disks tab (already exists)
├── FirewallTab.tsx       # Firewall tab
├── ActivityTab.tsx       # Activity tab
├── SettingsTab.tsx       # Settings tab
├── hooks/
│   └── useVPSDetail.ts   # Shared hook for data fetching
└── types.ts              # Shared types
```

#### 4.5 Admin Component Split

**Design**: Mirror the admin route split in frontend components.

```
src/pages/Admin/
├── index.tsx             # Main component, tab routing
├── UsersTab.tsx          # User management
├── SettingsTab.tsx       # Platform settings
├── BillingTab.tsx        # Admin billing
├── EmailTemplatesTab.tsx # Email templates
├── ContactTab.tsx        # Contact form management
├── FaqTab.tsx            # FAQ management
├── GithubTab.tsx         # GitHub integration
├── SshKeysTab.tsx        # Admin SSH keys
├── ActivityTab.tsx       # Activity logs
├── DocumentationTab.tsx  # Documentation management
├── NetworkingTab.tsx     # RDNS, IPs
├── AnnouncementsTab.tsx  # Announcements
├── CategoryMappingsTab.tsx # Category mappings
└── VolumePricingTab.tsx  # Volume pricing (Phase 6)
```

#### 4.6 Raw Fetch to ApiClient Migration

**Current State**: ~165 raw `fetch` calls in `src/` (excluding `apiClient` internals).

**Migration Priority**:
1. **Payment pages** (Billing, Wallet, Checkout) - highest security impact
2. **Admin pages** - second priority
3. **All other pages** - third priority

**Migration Pattern**:
```typescript
// Before (raw fetch)
const response = await fetch('/api/payments/wallet', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-CSRF-Token': csrfToken,
  },
  credentials: 'include',
});

// After (apiClient)
const data = await apiClient.get('/payments/wallet');
```

**Files to Migrate** (partial list):
- `src/contexts/AuthContext.tsx` - auth operations
- `src/contexts/ImpersonationContext.tsx` - impersonation operations
- `src/services/categoryMappingService.ts` - category mappings
- `src/services/egressService.ts` - egress operations
- `src/lib/apiDocsTryIt.ts` - API docs try-it

#### 4.7 Home Page Consolidation

**Analysis Required**: Compare `Home.tsx` vs `HomeRedesign.tsx`.

**Decision Criteria**:
- Which is currently active in `App.tsx`?
- Which has better design/UX?
- Which is more maintainable?

**Action**: Delete non-canonical version, update route.

#### 4.8 Type Drift Consolidation

**Design**: Create `src/types/api.ts` for shared DTOs.

```typescript
// src/types/api.ts

// Import from generated types where possible
import type { components } from '@/types/linode-openapi';

// Shared request/response types
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    page: number;
    totalPages: number;
  };
}

// Re-export generated types for convenience
export type VPS = components['schemas']['Linode'];
export type Region = components['schemas']['Region'];
export type Image = components['schemas']['Image'];
```

#### 4.9 Documentation Consolidation

**Design**: Make `AGENTS.md` canonical, reduce others to pointers.

```markdown
<!-- CLAUDE.md -->
See [AGENTS.md](./AGENTS.md) for AI assistant instructions.

<!-- GEMINI.md -->
See [AGENTS.md](./AGENTS.md) for AI assistant instructions.

<!-- README.md (add section) -->
## AI Assistant Instructions

This project uses `AGENTS.md` as the canonical instruction file for AI assistants.
See [AGENTS.md](./AGENTS.md) for details.
```

---

### Phase 5: Test Infrastructure

#### 5.1 Route-Level Test Coverage

**Test Helpers**: `api/tests/helpers/`

```typescript
// api/tests/helpers/buildAuthedRequest.ts

import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';

export interface AuthedRequestOptions {
  userId?: string;
  email?: string;
  role?: string;
  organizationId?: string;
}

export function buildAuthedRequest(options: AuthedRequestOptions = {}) {
  const userId = options.userId || 'test-user-id';
  const token = jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: '1h' });
  
  return {
    headers: {
      authorization: `Bearer ${token}`,
      'x-organization-id': options.organizationId,
    },
    cookies: { auth_token: token },
  };
}
```

```typescript
// api/tests/helpers/mockLinode.ts

import { vi } from 'vitest';

export function mockLinode() {
  return {
    listInstances: vi.fn().mockResolvedValue([]),
    getInstance: vi.fn().mockResolvedValue({}),
    createInstance: vi.fn().mockResolvedValue({}),
    bootInstance: vi.fn().mockResolvedValue({}),
    shutdownInstance: vi.fn().mockResolvedValue({}),
    rebootInstance: vi.fn().mockResolvedValue({}),
    listDisks: vi.fn().mockResolvedValue([]),
    createDisk: vi.fn().mockResolvedValue({}),
    // ... all other methods
  };
}
```

```typescript
// api/tests/helpers/mockEmail.ts

import { vi } from 'vitest';

export function mockEmail() {
  return {
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
    // Email is sunk in test mode - no real sends
  };
}
```

```typescript
// api/tests/helpers/mockPayPal.ts

import { vi } from 'vitest';

export function mockPayPal() {
  return {
    createPayment: vi.fn().mockResolvedValue({
      success: true,
      paymentId: 'test-payment-id',
      approvalUrl: 'https://sandbox.paypal.com/approve',
    }),
    capturePayment: vi.fn().mockResolvedValue({
      success: true,
      transactionId: 'test-transaction-id',
    }),
  };
}
```

```typescript
// api/tests/helpers/seedDatabase.ts

import { query } from '../../lib/database.js';

export async function seedOrganization(options: { name: string }) {
  const result = await query(
    `INSERT INTO organizations (name, slug, owner_id, created_at, updated_at)
     VALUES ($1, $2, 'system', NOW(), NOW())
     RETURNING id`,
    [options.name, options.name.toLowerCase().replace(/\s+/g, '-')]
  );
  return result.rows[0];
}

export async function seedUser(options: {
  email: string;
  role?: string;
  organizationId?: string;
}) {
  const result = await query(
    `INSERT INTO users (email, role, created_at, updated_at)
     VALUES ($1, $2, NOW(), NOW())
     RETURNING id, email, role`,
    [options.email, options.role || 'user']
  );
  
  const user = result.rows[0];
  
  if (options.organizationId) {
    await query(
      `INSERT INTO organization_members (organization_id, user_id, role, created_at)
       VALUES ($1, $2, 'member', NOW())`,
      [options.organizationId, user.id]
    );
  }
  
  return user;
}
```

**Coverage Target**: 70% lines / 80% branches on `api/routes/` + `api/services/`.

#### 5.2 Playwright E2E Smoke Tests

**Test Directory**: `tests/e2e/`

```typescript
// tests/e2e/smoke.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test.use({ baseURL: 'http://localhost:3001' });

  test('unauthenticated home → login → dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Cloud');
    
    await page.click('text=Login');
    await expect(page).toHaveURL(/\/login/);
    
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('VPS list → detail → boot/shutdown (mocked)', async ({ page }) => {
    // Mock VPS API
    await page.route('**/api/vps', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          instances: [
            { id: 1, label: 'test-vps', status: 'running', region: 'us-east' },
          ],
        }),
      });
    });

    await page.goto('/vps');
    await expect(page.locator('text=test-vps')).toBe{}
Visible();
    
    await page.click('text=test-vps');
    await expect(page).toHaveURL(/\/vps\/1/);
  });

  test('billing top-up (sandbox)', async ({ page }) => {
    // Mock PayPal sandbox
    await page.route('**/api/payments/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          config: {
            clientId: 'sandbox-client-id',
            currency: 'USD',
            mode: 'sandbox',
          },
        }),
      });
    });

    await page.goto('/billing');
    await expect(page.locator('text=Wallet')).toBeVisible();
  });
});
```

**Playwright Config**:
```typescript
// playwright.config.ts

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run start:dev',
    url: 'http://localhost:3001/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      MOCK_PROVIDERS: 'true',
    },
  },
});
```

#### 5.3 Test Organization

```
tests/
├── security/           # Security-focused tests
│   ├── admin-auth-coverage.test.ts
│   ├── payment-isolation.test.ts
│   ├── disks-isolation.test.ts
│   ├── volume-isolation.test.ts
│   └── ...
├── e2e/                # Playwright E2E tests
│   ├── smoke.spec.ts
│   └── ...
├── fixtures/           # Test fixtures
│   ├── users.ts
│   ├── organizations.ts
│   └── ...
└── api/                # API route tests (colocated with source)
    └── routes/
        └── __tests__/
            ├── vps-disks.test.ts
            ├── admin-volume-pricing.test.ts
            └── ...
```

#### 5.4 Coverage Tracking

**Operator Procedure**:
```bash
# Run coverage locally before release
npm run test:coverage

# Coverage summary saved to docs/coverage-baseline.md
# Example output:
# File                    | % Stmts | % Branch | % Funcs | % Lines |
# ------------------------|---------|----------|---------|---------|
# All files               |   72.3  |   81.5   |   68.9  |   71.8  |
#  api/routes/            |   75.1  |   83.2   |   71.2  |   74.5  |
#  api/services/          |   69.5  |   79.8   |   66.4  |   69.1  |
```

---

### Phase 6: Volumes Billing Roadmap

#### 6.1 Volume Pricing Schema

**Migration**: `migrations/054_volume_pricing.sql`

```sql
-- Volume pricing table (admin-configurable)
CREATE TABLE volume_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id VARCHAR(50) NOT NULL,
  region_id VARCHAR(50) NOT NULL,
  price_per_gb_monthly DECIMAL(10, 4) NOT NULL,
  markup_per_gb_monthly DECIMAL(10, 4) NOT NULL DEFAULT 0,
  min_size_gb INTEGER NOT NULL DEFAULT 10,
  max_size_gb INTEGER NOT NULL DEFAULT 10240,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_provider_region UNIQUE (provider_id, region_id)
);

-- Organization volumes table (tracks user volumes)
CREATE TABLE organization_volumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vps_instance_id INTEGER,
  provider_volume_id INTEGER,
  label VARCHAR(255) NOT NULL,
  size_gb INTEGER NOT NULL,
  region_id VARCHAR(50) NOT NULL,
  monthly_cost DECIMAL(10, 4) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_size CHECK (size_gb > 0)
);

CREATE INDEX idx_organization_volumes_org ON organization_volumes(organization_id);
CREATE INDEX idx_organization_volumes_vps ON organization_volumes(vps_instance_id);
```

#### 6.2 Admin Volume Pricing UI

**Component**: `src/pages/admin/VolumePricingTab.tsx`

**Features**:
- CRUD table for (provider × region) pricing
- Inline editing for price/markup
- Enable/disable pricing per region
- Bulk import/export

**API Routes**: `api/routes/admin/volumePricing.ts`

```typescript
// GET /api/admin/volume-billing/volume-types - List all volume types
// POST /api/admin/volume-billing/volume-types - Create volume type
// PUT /api/admin/volume-billing/volume-types/:id - Update volume type
// DELETE /api/admin/volume-billing/volume-types/:id - Delete volume type
```

#### 6.3 Linode Volumes API Service

**Service**: `api/services/linodeService.ts` (extend)

```typescript
// Add to linodeService

async listVolumes(params?: { linode_id?: number }): Promise<LinodeVolume[]> {
  const response = await this.request('/volumes', { params });
  return response.data;
}

async createVolume(data: {
  label: string;
  size: number;
  region: string;
  linode_id?: number;
}): Promise<LinodeVolume> {
  const response = await this.request('/volumes', {
    method: 'POST',
    data,
  });
  return response.data;
}

async getVolume(volumeId: number): Promise<LinodeVolume> {
  const response = await this.request(`/volumes/${volumeId}`);
  return response.data;
}

async updateVolume(volumeId: number, data: {
  label?: string;
  size?: number;
}): Promise<LinodeVolume> {
  const response = await this.request(`/volumes/${volumeId}`, {
    method: 'PUT',
    data,
  });
  return response.data;
}

async deleteVolume(volumeId: number): Promise<void> {
  await this.request(`/volumes/${volumeId}`, { method: 'DELETE' });
}

async attachVolume(volumeId: number, linodeId: number): Promise<void> {
  await this.request(`/volumes/${volumeId}/attach`, {
    method: 'POST',
    data: { linode_id: linodeId },
  });
}

async detachVolume(volumeId: number): Promise<void> {
  await this.request(`/volumes/${volumeId}/detach`, { method: 'POST' });
}

async cloneVolume(volumeId: number, data: {
  label: string;
  region?: string;
}): Promise<LinodeVolume> {
  const response = await this.request(`/volumes/${volumeId}/clone`, {
    method: 'POST',
    data,
  });
  return response.data;
}

async resizeVolume(volumeId: number, size: number): Promise<LinodeVolume> {
  const response = await this.request(`/volumes/${volumeId}/resize`, {
    method: 'POST',
    data: { size },
  });
  return response.data;
}
```

#### 6.4 User Volume Purchase Flow Design

**Documentation**: `docs/volumes-user-flow.md`

```markdown
# User Volume Purchase Flow (Feature-Flagged OFF)

## Overview

This document describes the user volume purchase flow, which is implemented
but disabled via feature flag until ready for production.

## Feature Flag

Set `FEATURE_VOLUMES_USER_PURCHASE=false` in production.

## Flow

1. **Disks Tab CTA**: "Attach additional storage" button (disabled with "Coming soon" tooltip)
2. **Size Picker**: Select size in GB (min/max from volume_pricing table)
3. **Cost Preview**: Show monthly cost based on pricing table
4. **Wallet Top-Up**: If insufficient balance, prompt top-up
5. **Volume Creation**: Call Linode API to create volume
6. **Hourly Billing**: Extend egress billing cron to include volumes
7. **Detach/Delete**: Volume removal with prorated refund policy

## Implementation Status

- [ ] UI components (gated by feature flag)
- [ ] API routes (gated by feature flag)
- [ ] Billing cron extension
- [ ] Refund policy implementation
```

#### 6.5 Volume Isolation Tests

**Test File**: `tests/security/volume-isolation.test.ts`

```typescript
describe('Volume Isolation', () => {
  let orgA: { user: User; token: string; organizationId: string };
  let orgB: { user: User; token: string; organizationId: string };

  beforeEach(async () => {
    orgA = await seedOrganization({ name: 'Org A' });
    orgB = await seedOrganization({ name: 'Org B' });
  });

  it('should prevent cross-org volume access', async () => {
    // Create volume for Org B
    const volumeB = await seedVolume(orgB.organizationId, { label: 'vol-b' });
    
    // Org A tries to access Org B's volume
    const response = await request(app)
      .get(`/api/volumes/${volumeB.id}`)
      .set('Authorization', `Bearer ${orgA.token}`);
    
    expect(response.status).toBe(404);
  });

  it('should prevent cross-org volume pricing modification', async () => {
    // Org A user (non-admin) tries to modify volume pricing
    const response = await request(app)
      .post('/api/admin/volume-billing/volume-types')
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ provider_id: 'linode', region_id: 'us-east', price_per_gb_monthly: 0.10 });
    
    expect(response.status).toBe(403);
  });
});
```

---

### Phase 7: Production Readiness Checklist

#### 7.1 Environment Configuration Verification

**Checklist** (operator-run):

```bash
# Verify required environment variables
node -e "
const required = ['DATABASE_URL', 'JWT_SECRET', 'SSH_CRED_SECRET', 'ENCRYPTION_KEY', 'LINODE_API_TOKEN'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error('Missing required env vars:', missing.join(', '));
  process.exit(1);
}
console.log('✓ All required env vars set');
"

# Verify secret lengths
node -e "
const secrets = [
  ['JWT_SECRET', process.env.JWT_SECRET, 64],
  ['SSH_CRED_SECRET', process.env.SSH_CRED_SECRET, 32],
  ['ENCRYPTION_KEY', process.env.ENCRYPTION_KEY, 32],
];
const errors = secrets.filter(([name, val, min]) => val && val.length < min);
if (errors.length) {
  console.error('Secrets too short:', errors.map(([n, , m]) => \`\${n} needs \${m}+ chars\`).join(', '));
  process.exit(1);
}
console.log('✓ All secrets meet minimum length');
"

# Verify NODE_ENV
node -e "
if (process.env.NODE_ENV !== 'production') {
  console.error('NODE_ENV must be production');
  process.exit(1);
}
console.log('✓ NODE_ENV=production');
"

# Verify TRUST_PROXY
node -e "
if (process.env.TRUST_PROXY !== 'true') {
  console.warn('⚠ TRUST_PROXY should be true if behind load balancer');
}
console.log('✓ TRUST_PROXY checked');
"

# Verify CLIENT_URL
node -e "
const url = process.env.CLIENT_URL;
if (!url || url.includes('localhost')) {
  console.error('CLIENT_URL must be production domain');
  process.exit(1);
}
console.log('✓ CLIENT_URL is production domain');
"
```

#### 7.2 Infrastructure Verification

**Checklist** (operator-run):

```markdown
## Infrastructure Verification

### PostgreSQL
- [ ] Daily backups configured
- [ ] WAL archiving enabled
- [ ] Connection pooling configured (PgBouncer or similar)
- [ ] SSL enabled for connections

### Redis (if used)
- [ ] Persistence configured (RDB + AOF)
- [ ] Memory limit set appropriately
- [ ] Eviction policy configured

### PM2
- [ ] ecosystem.config.cjs reviewed
- [ ] Cluster mode enabled (if applicable)
- [ ] Log rotation configured
- [ ] Graceful shutdown configured

### NGINX/Cloudflare
- [ ] CSP headers configured
- [ ] HSTS enabled (max-age=31536000)
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] TLS 1.3 enabled
- [ ] Auto-renewal configured

### Monitoring
- [ ] 5xx error alerts configured
- [ ] Slow query alerts configured
- [ ] Error rate alerts configured
- [ ] Uptime monitoring configured
```

#### 7.3 Data Migration Verification

**Checklist** (operator-run):

```bash
# Verify egress migrations 025-033 are applied
psql $DATABASE_URL -c "
SELECT migration_name 
FROM schema_migrations 
WHERE migration_name BETWEEN '025' AND '033'
ORDER BY migration_name;
"

# Verify all migrations applied
node scripts/run-migration.js --dry-run

# Run seed:admin with strong password
npm run seed:admin
# (Rotate password after first login)

# Verify API docs audit is clean
npm run docs:api:audit
```

#### 7.4 Pre-Release Verification Commands

**Script**: `npm run verify:prod`

```json
{
  "scripts": {
    "verify:prod": "npm-run-all check lint test test:security test:coverage scan:code docs:api:audit audit:security"
  }
}
```

**Manual Checklist**:
```markdown
## Pre-Release Verification

### Automated Checks
- [ ] `npm run check` — zero TypeScript errors
- [ ] `npm run lint` — zero errors
- [ ] `npm run test` — all tests pass
- [ ] `npm run test:coverage` — at least 70% line coverage
- [ ] `npm run audit:security` — exits 0
- [ ] `npm run scan:code` (semgrep) — zero errors
- [ ] `npm run test:security` — all security tests pass
- [ ] Playwright smoke tests pass

### Manual Staging Smoke
- [ ] Signup flow works
- [ ] VPS list loads
- [ ] VPS detail page works (all tabs including Disks)
- [ ] Billing flow works
- [ ] Logout works
```

#### 7.5 Rollout Preparation

**Documentation**: `docs/rollout-checklist.md`

```markdown
## Rollout Preparation

### Blue-Green / Rolling Deploy
- [ ] Document deploy procedure
- [ ] Test rollback on staging
- [ ] Verify database migrations are reversible

### Migration Rollback Plan
- [ ] Document rollback SQL for each migration
- [ ] Test rollback procedure on staging

### Feature Flags
- [ ] Volumes user purchase: OFF
- [ ] Notification system changes: documented

### Status Page
- [ ] Schedule maintenance window
- [ ] Prepare status page entry

### Rollback Tested
- [ ] Staging rollback verified
```

---

## Data Models

### Existing Tables (Reference)

- `users` — User accounts
- `organizations` — Organization accounts
- `organization_members` — User-organization membership
- `vps_instances` — VPS instances
- `payment_transactions` — Payment records
- `wallets` — Organization wallets
- `activity_logs` — Activity logs (used by notifications)
- `egress_credits` — Egress credit packs
- `egress_usage` — Egress usage records

### New Tables (Phase 6)

#### `volume_pricing`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `provider_id` | VARCHAR(50) | Provider identifier (e.g., 'linode') |
| `region_id` | VARCHAR(50) | Region identifier (e.g., 'us-east') |
| `price_per_gb_monthly` | DECIMAL(10,4) | Base price per GB per month |
| `markup_per_gb_monthly` | DECIMAL(10,4) | Markup per GB per month |
| `min_size_gb` | INTEGER | Minimum volume size |
| `max_size_gb` | INTEGER | Maximum volume size |
| `active` | BOOLEAN | Whether pricing is active |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Update timestamp |

**Constraints**:
- `unique_provider_region`: UNIQUE (provider_id, region_id)

#### `organization_volumes`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | Organization FK |
| `vps_instance_id` | INTEGER | VPS instance FK (nullable) |
| `provider_volume_id` | INTEGER | Linode volume ID |
| `label` | VARCHAR(255) | Volume label |
| `size_gb` | INTEGER | Volume size in GB |
| `region_id` | VARCHAR(50) | Region identifier |
| `monthly_cost` | DECIMAL(10,4) | Monthly cost |
| `status` | VARCHAR(50) | Volume status |
| `created_at` | TIMESTAMP | Creation timestamp |
| `deleted_at` | TIMESTAMP | Deletion timestamp (soft delete) |

**Indexes**:
- `idx_organization_volumes_org` ON (organization_id)
- `idx_organization_volumes_vps` ON (vps_instance_id)

---

## Error Handling

### Provider Error Normalization

All Linode API errors are normalized via `handleProviderError()`:

```typescript
// api/lib/errorHandling.ts

export function handleProviderError(
  res: Response,
  error: unknown,
  fallbackMessage = "Provider operation failed"
): void {
  // Linode API error
  if (isLinodeApiError(error)) {
    const status = error.response?.status || 500;
    const linodeError = error.response?.data?.errors?.[0];
    const message = linodeError?.reason || fallbackMessage;
    
    // Log for debugging
    console.error('Linode API error:', {
      status,
      message,
      details: linodeError,
    });
    
    res.status(status).json({ error: message });
    return;
  }
  
  // Database error
  if (isDatabaseError(error)) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database operation failed' });
    return;
  }
  
  // Generic error
  console.error('Unexpected error:', error);
  res.status(500).json({ error: fallbackMessage });
}
```

### Error Response Format

All API errors follow a consistent format:

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  details?: any;  // Optional validation details
  code?: string;  // Optional error code (e.g., 'TOKEN_REVOKED')
}
```

---

## Testing Strategy

### Test Types

| Type | Location | Purpose |
|------|----------|---------|
| Unit | `*.test.ts` colocated | Test individual functions/components |
| Integration | `api/routes/__tests__/` | Test route handlers with mocked services |
| Security | `tests/security/` | Test authorization, isolation, hardening |
| E2E | `tests/e2e/` | Test critical user flows |

### Mock Strategy

**Linode API**: All Linode API calls are mocked in tests. No real VPS operations.

```typescript
vi.mock('../services/linodeService.js', () => ({
  linodeService: {
    listInstances: vi.fn().mockResolvedValue([]),
    createInstance: vi.fn().mockResolvedValue({ id: 1 }),
    // ... all methods mocked
  },
}));
```

**PayPal API**: All PayPal calls are mocked. No real sandbox calls.

```typescript
vi.mock('../services/paypalService.js', () => ({
  PayPalService: {
    createPayment: vi.fn().mockResolvedValue({ success: true, paymentId: 'test' }),
    capturePayment: vi.fn().mockResolvedValue({ success: true }),
  },
}));
```

**Email Service**: Email is sunk in test mode. No real emails sent.

```typescript
vi.mock('../services/emailService.js', () => ({
  emailService: {
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
  },
}));
```

### Coverage Targets

| Area | Lines | Branches |
|------|-------|----------|
| `api/routes/` | 70% | 80% |
| `api/services/` | 70% | 80% |
| `api/middleware/` | 70% | 80% |

### Test Priorities

1. **Payments** — Highest security impact
2. **VPS lifecycle** — Core functionality
3. **Disks** — Data safety
4. **Admin user CRUD** — Authorization
5. **Billing/egress** — Financial accuracy

---

## Implementation Notes

### ESM Import Convention

All backend imports must end in `.js`:

```typescript
// ✅ Correct
import { query } from '../lib/database.js';
import { linodeService } from '../services/linodeService.js';

// ❌ Incorrect (breaks at runtime)
import { query } from '../lib/database';
import { linodeService } from '../services/linodeService';
```

### Router-Level Middleware Pattern

Apply auth middleware at router level, not per-handler:

```typescript
// ✅ Correct
const router = express.Router();
router.use(authenticateToken, requireOrganization);

router.get('/', async (req, res) => { /* ... */ });
router.post('/', async (req, res) => { /* ... */ });

// ❌ Incorrect (redundant, error-prone)
router.get('/', authenticateToken, requireOrganization, async (req, res) => { /* ... */ });
router.post('/', authenticateToken, requireOrganization, async (req, res) => { /* ... */ });
```

### Organization Scoping

All resource queries must be scoped to `organization_id`:

```typescript
// ✅ Correct
const result = await query(
  'SELECT * FROM vps_instances WHERE organization_id = $1',
  [req.user.organizationId]
);

// ❌ Incorrect (data leak risk)
const result = await query('SELECT * FROM vps_instances');
```

### Feature Flag Pattern

Gate new features with environment variables:

```typescript
const VOLUMES_USER_PURCHASE_ENABLED = 
  process.env.FEATURE_VOLUMES_USER_PURCHASE === 'true';

if (!VOLUMES_USER_PURCHASE_ENABLED) {
  return res.status(503).json({ 
    error: 'This feature is not yet available' 
  });
}
```

---

## Verification Commands

### Development

```bash
# Type check
npm run check

# Lint
npm run lint

# Run all tests
npm run test

# Run security tests
npm run test:security

# Run coverage
npm run test:coverage

# Security audit
npm run audit:security

# Code scan (semgrep)
npm run scan:code

# Full security verification
npm run verify:security
```

### Pre-Release

```bash
# Full verification
npm run verify:prod

# Manual staging smoke
# 1. Signup → verify email (mocked)
# 2. VPS list → detail → boot/shutdown (mocked)
# 3. Billing → top-up (sandbox)
# 4. Logout
```

### Production

```bash
# Deploy
npm run pm2:start

# Reload (zero-downtime)
npm run pm2:reload

# Check status
npm run pm2:list
```

---

## References

- [AGENTS.md](../../AGENTS.md) — AI assistant instructions
- [CLAUDE.md](../../CLAUDE.md) — Claude-specific instructions
- [api/types/linode-openapi.ts](../../api/types/linode-openapi.ts) — Generated Linode types
- [api/middleware/auth.ts](../../api/middleware/auth.ts) — Auth middleware
- [api/lib/errorHandling.ts](../../api/lib/errorHandling.ts) — Error handling utilities
