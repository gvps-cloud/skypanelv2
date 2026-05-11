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
│   • TanStack Query (server state)                                           │
│   • shadcn/ui + Tailwind component system                                   │
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
│   • Enhance Hosting API for shared hosting                                 │
│   • FraudLabsPro API for fraud screening                                   │
│   • Bunny CDN for static assets                                            │
│   • Email providers (Resend · SMTP)                                        │
│   • PG LISTEN/NOTIFY for real-time events                                  │
│                                                                            │
│ Key Flows                                                                  │
│   SPA → Router → TanStack Query → Middleware → Routes → Services            │
│   SPA (SSE) ← PG ← Services                                                │
│   SPA (WebSocket) ↔ WS ↔ Linode (SSH2)                                     │
│   Services ↔ PostgreSQL / Linode / PayPal / Enhance / Email                │
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

### Enhance Hosting Provisioning Flow

```text
ENHANCE HOSTING PROVISIONING FLOW
-----------------------------------------------------------------------------
1. User → Frontend: browse hosting plans
2. Frontend → API /api/hosting/plans: fetch available plans
3. User selects plan, provides domain
4. Frontend → API /api/hosting/purchase: { planId, domain, ... }
5. API → enhanceOnboardingService:
   a. Get/create Enhance customer org for user's organization
   b. Create hosting_subscription record
   c. Initialize dedicated hosting wallet
   d. Enhance API: add domain → issue SSL → create website
   e. Configure optional services (email, MySQL, apps)
6. API → hostingBillingService: deduct first month from hosting wallet
7. If any step fails: rollback + credit wallet (compensating transaction)
8. API → Frontend: redirect to /hosting/:id detail page
```

### Hosting Management Flow

```text
HOSTING MANAGEMENT (per subscription)
-----------------------------------------------------------------------------
Website: /api/hosting/web — list, update, manage domains and settings
DNS: /api/hosting/dns — zone management, record CRUD
SSL: /api/hosting/ssl — certificate management, force HTTPS
Email: /api/hosting/email — mailboxes, autoresponders, client config
MySQL: /api/hosting/mysql — databases, users, privileges, SQL execution
WordPress: /api/hosting/wordpress — install, configure, manage
Joomla: /api/hosting/joomla — install, configure, manage
Node.js: /api/hosting/node — persistent app management
Apps: /api/hosting/apps — PHP/LSAPI application hosting
FTP: /api/hosting/ftp — FTP account management
SSH: /api/hosting/ssh — SSH key management for hosting
Cron: /api/hosting/cron — scheduled job management
Backups: /api/hosting/backups — backup creation, restore, download
```

### Monthly Hosting Billing Cycle

```text
MONTHLY HOSTING BILLING CYCLE (runs daily to check due subscriptions)
-----------------------------------------------------------------------------
1. hostingBillingService → DB: fetch subscriptions where next_billing_date <= NOW()
2. For each subscription:
   a. Check hosting_wallets balance for the org
   b. If sufficient:
        • Deduct monthly fee from hosting wallet
        • Record payment transaction
        • Update next_billing_date (+30 days)
   c. If insufficient:
        • Mark subscription as past_due
        • Enhance API: suspend website
        • Record failed billing cycle
        • Notify user
3. If user adds funds and balance recovers:
   • Enhance API: unsuspend website
   • Reset subscription status to active
```

### Fraud Screening Flow

```text
FRAUD SCREENING FLOW (FraudLabsPro)
-----------------------------------------------------------------------------
Registration:
  1. User → API /api/auth/register: { email, password, name }
  2. API → fraudLabsProService: screen IP, email, proxy/VPN/TOR
  3. If score > threshold: flag for admin review
  4. Admin → /api/admin/fraud-checks: approve or reject

Payment:
  1. User → API /api/payments/create-order: { amount }
  2. API → fraudLabsProService: screen transaction
  3. If score > threshold: block order creation, flag for review
  4. Admin reviews and can manually allow/block
```

### Refund Flow

```text
REFUND FLOW
-----------------------------------------------------------------------------
Automatic (VPS deletion):
  1. User → API /api/vps/:id (DELETE)
  2. API → billingService: calculate unused hours
  3. API → refundService: create refund record
  4. API → DB: credit wallet with prorated amount

Automatic (Hosting cancellation):
  1. User → API /api/hosting/:id (DELETE)
  2. API → hostingBillingService: calculate remaining days
  3. API → refundService: create refund record
  4. API → DB: credit hosting wallet

Manual (Admin-initiated):
  1. Admin → API /api/admin/refunds: { transactionId, amount, reason }
  2. API → refundService: create PayPal capture refund
  3. API → PayPal API: issue refund via capture ID
  4. API → DB: record refund, update transaction status
```

### Notes System Flow

```text
NOTES SYSTEM
-----------------------------------------------------------------------------
Personal Notes:
  • User → /api/notes (personal): CRUD notes scoped to user
  • Frontend: PersonalNotes.tsx with NotesBoard (kanban-style)

Organization Notes:
  • User → /api/notes (org): CRUD notes scoped to organization
  • Frontend: OrganizationNotes.tsx with NotesBoard
  • Permission-gated: requires notes_view / notes_manage
```

### Support Ticket System Flow

```text
SUPPORT TICKET SYSTEM
-----------------------------------------------------------------------------
Customer:
  1. User → Frontend /support: view/create tickets
  2. Frontend → API /api/support (POST): { subject, message, priority, category, vps_id?, hosting_subscription_id? }
  3. API → DB: INSERT support_tickets with hosting/VPS snapshot fields
  4. API → ticketNotificationService: email staff on new ticket
  5. User → API /api/support/:id/replies (POST): add message
  6. PG LISTEN/NOTIFY pushes updates to connected clients

Admin:
  1. Admin → /api/admin/tickets: list all tickets with filters
  2. Admin → /api/admin/tickets/:id/replies (POST): staff reply (sets has_staff_reply flag)
  3. Admin → /api/admin/tickets/:id/status (PATCH): transition status
  4. Permission-gated: tickets_view, tickets_create, tickets_manage
```

### Blog System Flow

```text
BLOG SYSTEM
-----------------------------------------------------------------------------
Public:
  1. Visitor → Frontend /blog: browse published posts with category filtering
  2. Visitor → Frontend /blog/:year/:slug: view individual post
  3. Frontend → API /api/blog/posts: fetch published posts (status = 'published', deleted_at IS NULL)
  4. Frontend → API /api/blog/posts/:year/:slug: fetch single post by slug + year

Admin CMS:
  1. Admin → /api/admin/blog/posts: CRUD blog posts (draft/published)
  2. Admin → /api/admin/blog/categories: manage categories
  3. Admin → /api/admin/blog/tags: manage tags
  4. Cover image upload via multer, OG image generation from title
```

### Platform Maintenance Mode Flow

```text
PLATFORM MAINTENANCE MODE
-----------------------------------------------------------------------------
Enable:
  1. Admin → API /api/admin/platform (PATCH): { maintenance_mode: true, maintenance_code?: "..." }
  2. API → DB: UPDATE platform_settings SET maintenance_mode = true

Guard Behavior (frontend MaintenanceGuard):
  • Non-admin users → redirected to /maintenance
  • Admin users → always bypass (full access)
  • /blog, /login routes → accessible with maintenance code
  • /api/site-status → public endpoint returns { maintenance_mode: true }

Disable:
  1. Admin → API /api/admin/platform (PATCH): { maintenance_mode: false }
  2. All users regain normal access
```

### Egress Credit Refund Flow

```text
EGRESS CREDIT REFUND
-----------------------------------------------------------------------------
1. User → Frontend /egress-credits: click "Refund Credits"
2. Frontend → API /api/egress/refund (POST): { amount }
3. API → DB: verify egress pack balance ≥ requested amount
4. API → DB: INSERT egress_credit_packs (adjustment_type = 'customer_refund', negative amount)
5. API → DB: increment main wallet balance by refund amount
6. API → Frontend: return updated balances
```

> **Back to**: [README](../README.md)
