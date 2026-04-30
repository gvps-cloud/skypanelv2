# Architecture

SkyPanelV2 system overview, high-level architecture, and application flow diagrams.

> **Back to**: [README](../README.md)

---

## System Overview

### What is SkyPanelV2?

SkyPanelV2 is gvps-cloud's complete business operations platform for managing our Linode VPS reselling business. The platform is split into three distinct product surfaces:

| Surface              | Description                                                                     | Users               |
| -------------------- | ------------------------------------------------------------------------------- | ------------------- |
| **Public Marketing** | Home, pricing, FAQ, about, contact, status, legal pages                         | Anonymous visitors  |
| **Customer Portal**  | Dashboard, VPS management, billing, support, SSH console, organizations         | Authenticated users |
| **Admin Dashboard**  | User management, billing ops, volume pricing, platform settings, provider config, impersonation | Admin users         |

### Revenue Model

```
Linode Base Cost  →  Admin Markup (per plan)  →  Customer Hourly Rate
Example: $0.0075/hr  →  +$0.0068/hr markup  →  $0.0143/hr to customer
         ($5.00/mo)     (+$5.00/mo)             ($10.00/mo)
```

Billing is **hourly** — charges are deducted from the organization's prepaid wallet every hour via an automated cron scheduler. Customers fund their wallets through PayPal.

---

## High-Level Architecture

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ High-Level Architecture                                                    │
├────────────────────────────────────────────────────────────────────────────┤
│ Browser Client                                                             │
│   • React 18 SPA (TypeScript + Vite)                                       │
│   • xterm.js SSH terminal                                                  │
│                                                                            │
│ Frontend Layer                                                             │
│   • React Router v7 (route guards)                                         │
│   • TanStack Query (server state)                                          │
│   • Zustand (client state)                                                 │
│   • shadcn/ui + Tailwind component system                                  │
│                                                                            │
│ Backend API Layer (Express.js)                                             │
│   • Middleware stack: auth, CORS, Helmet, rate limiting                    │
│   • Route handlers serving REST endpoints                                  │
│   • Service layer for business logic                                       │
│   • Billing cron scheduler                                                 │
│                                                                            │
│ Data & External Services                                                   │
│   • PostgreSQL primary database                                            │
│   • WebSocket server for SSH bridge                                        │
│   • Linode/Akamai API for infrastructure                                   │
│   • PayPal REST API for payments                                           │
│   • Email providers (Resend · SMTP)                                        │
│   • PG LISTEN/NOTIFY for real-time events                                  │
│                                                                            │
│ Key Flows                                                                  │
│   SPA → Router → TanStack Query → Middleware → Routes → Services            │
│   SPA (SSE) ← PG ← Services                                                │
│   SPA (WebSocket) ↔ WS ↔ Linode (SSH2)                                     │
│   Services ↔ PostgreSQL / Linode / PayPal / Email                          │
│   Cron → Services for hourly billing                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Application Flow Diagrams

### User Authentication Flow

```text
USER AUTHENTICATION FLOW
-----------------------------------------------------------------------------
1. Browser → Frontend: load /login
2. Frontend → API /api/auth/login: { email, password }
3. API → PostgreSQL: lookup user by email
4. API: bcrypt.compare(password, hash)
5. If user has 2FA:
     a. API → Frontend: { requires2FA: true, tempToken }
     b. Frontend → Browser: render OTP input
     c. Browser → Frontend: submit code
     d. Frontend → API /api/auth/verify-2fa: { tempToken, code }
     e. API: verify TOTP via otplib
6. API: jwt.sign({ userId, role })
7. API → Frontend: { token, user }
8. Frontend: AuthContext.setUser(), redirect to /dashboard

REGISTRATION FLOW (parallel path)
-----------------------------------------------------------------------------
1. Browser → Frontend: load /register
2. Frontend → API /api/auth/register: { email, password, name }
3. API → PostgreSQL: INSERT users
4. API → PostgreSQL: INSERT organizations (auto-create)
5. API → PostgreSQL: INSERT wallets (balance 0)
6. API → Email Service: send welcome email
7. API → Frontend: 201 { token, user }
```

### VPS Provisioning Flow

```text
VPS PROVISIONING FLOW
-----------------------------------------------------------------------------
1. User → Frontend: click "Create VPS"
2. Frontend → API /api/vps/providers
   • API queries service_providers (active = true)
   • Response: providers + allowed regions
3. Frontend → API /api/vps/plans?provider_id
   • API fetches vps_plans for provider
   • Response: plan specs with base + markup pricing
4. Frontend → API /api/vps/images?provider_id
   • API delegates to ProviderService → LinodeProviderService → Linode API /v4/images
   • Response: normalized image catalog
5. User configures plan/region/OS/password/SSH keys in UI
6. Frontend → API /api/vps (POST body with configuration)
7. API → DB: ensure wallet balance ≥ hourly rate
8. API → ProviderService → Linode API: create instance
   • Linode returns instance id + provisioning status
9. API → DB: insert vps_instances record
10. API → BillingService: billVPSCreation()
    • Billing service deducts first hour and records payment transaction
11. API → Frontend: 201 { instance }
12. Frontend → User: redirect to /vps/:id detail
```

### Hourly Billing Cycle

```text
HOURLY BILLING CYCLE (runs every 60 minutes)
-----------------------------------------------------------------------------
1. Scheduler → BillingService: runHourlyBilling()
2. BillingService → DB: fetch active VPS instances with last_billed_at ≤ 1 hour ago
3. For each instance:
     a. Load plan pricing (base + markup + backup)
     b. Compute hours elapsed and totalAmount = hourlyRate × hours
     c. Fetch wallet balance
     d. If balance sufficient:
          • Deduct wallet funds via PayPalService helper
          • Record payment_transactions entry
          • Insert vps_billing_cycles row (status: billed)
          • Update vps_instances.last_billed_at = NOW()
        Else (insufficient):
          • Insert vps_billing_cycles row (status: failed)
          • Emit warning for potential suspension
4. BillingService → Scheduler: summary { billedInstances, totalAmount, failures }
```

### SSH Console Access Flow

```text
SSH CONSOLE ACCESS FLOW
-----------------------------------------------------------------------------
1. Browser (xterm.js) → WebSocket Server: wss://host/api/vps/:id/ssh?token=JWT&rows=x&cols=y
2. WebSocket Server → Auth module: verify JWT and membership
3. Auth module → DB: fetch user + org membership → return success to WS server
4. WS server → DB: load vps_instance (IP + encrypted password) scoped to user org
5. WS server: decrypt stored credentials
6. WS server → SSH2 client: connect(host IP, root credentials)
7. SSH2 client ↔ VPS: TCP handshake on port 22 until ready
8. WS server → SSH2: open shell (term = xterm-256color, rows/cols as requested)
9. WS server → Browser: send { type: connected }
10. Interactive loop:
      • Browser inputs → WS server → SSH stream write
      • VPS output → SSH stream → WS server → Browser display
11. Resizes: Browser sends { rows, cols } → WS server → SSH stream.setWindow()
```

### Real-Time Notification Flow

```text
REAL-TIME NOTIFICATION FLOW
-----------------------------------------------------------------------------
1. User/system action → ActivityLogger.logActivity(event_type, entity, message)
2. ActivityLogger → DB: INSERT activity_logs row
3. DB trigger notify_new_activity() publishes payload via PG LISTEN/NOTIFY
   • Only fires for user-relevant events (vps.create, vps.boot, auth.login, etc.)
4. NotificationService listens on channel:
   • Receives payload, emits internal "notification" event
   • Streams payload to SSE endpoint subscribers
5. Browser connected to SSE endpoint receives event → updates badge/feed
```

### Organization & Multi-Tenancy Flow

```text
ORGANIZATION & MULTI-TENANCY MODEL
-----------------------------------------------------------------------------
User Account
  • Fields: id, email, role
  • Relationships: owns an organization, belongs to many via memberships

Organization (Tenant)
  • Attributes: id, name, slug, owner_id
  • Associated records: wallet (balance, currency), custom roles (permissions JSONB)

Membership Roles
  • Owner – full access
  • Admin – elevated access
  • Member – limited access

Org-Scoped Resources
  • VPS instances, SSH keys, support tickets, invoices, billing cycles, payment transactions

Invitations
  • Email + token + intended role; accepted via /organizations/invitations/:token

Relationship Summary
  • User owns Organization and may belong to multiple via Memberships
  • Organization links to Wallet, Roles, Members, Invitations, and all scoped resources
  • Members gain permissions derived from their role definitions
```

### Payment & Wallet Flow

```text
PAYMENT & WALLET FLOW
-----------------------------------------------------------------------------
1. User → Frontend: click "Add Funds" ($50)
2. Frontend → API /api/payments/create-order { amount: 50 }
3. API → PayPalService → PayPal REST API: create order → returns ORDER-123
4. PayPalService → Frontend: orderId for checkout
5. Frontend → User: show PayPal popup → user approves via PayPal UI
6. PayPal SDK → Frontend: onApprove callback fires
7. Frontend → API /api/payments/capture-order { orderId: ORDER-123 }
8. API → PayPalService → PayPal REST API: capture order → status COMPLETED
9. PayPalService → DB: increment wallet balance by $50 and insert payment_transactions row
10. API → Frontend: success + new balance → UI confirms funds added
11. Hourly billing cron later deducts usage fees from the wallet automatically
```
