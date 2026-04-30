# Core Features

Complete feature inventory for SkyPanelV2 — VPS management, web hosting, billing, organizations, security, real-time, admin, and UI/UX.

> **Back to**: [README](../README.md)

---

## VPS Management

- **Linode API Integration** — Direct provisioning via the `IProviderService` abstraction layer
- **Multi-Step Creation Wizard** — Provider → Plan → Region → OS/StackScript → SSH Keys → Backup config → Review
- **SSH Console** — Full browser-based terminal via WebSocket bridge + xterm.js with resize support
- **Instance Actions** — Boot, shutdown, reboot, delete with real-time status polling
- **Backup Management** — Configurable daily/weekly backups with admin-defined upcharge pricing
- **White-Label Categories** — Admin-defined category mappings for plan display names
- **StackScript Support** — Curated marketplace apps with user-defined field configuration

---

## Web Hosting (Enhance Integration)

- **Managed Website Hosting** — Provisioning via the Enhance control panel API with lazy customer creation per organization
- **Plan Catalog Sync** — Admin-synced hosting plans with local commercial overrides (`price_monthly`, `is_active`, `service_type`)
- **Domain Lifecycle** — Primary domains, mapped domains, DNS zones, and forced SSL
- **Email Hosting** — Mailboxes, autoresponders, and client configuration retrieval
- **Database Hosting** — MySQL databases, users, privileges, and SQL execution
- **Application Hosting** — PHP (LSAPI), Node.js persistent apps, and WordPress installations
- **Monthly Recurring Billing** — Automated wallet debit with remote suspension on insufficient balance
- **Automatic Rollback** — Compensating wallet credit on provisioning failure

---

## Billing & Payments

- **Prepaid Wallet System** — Organization-scoped wallets funded via PayPal
- **Automated Hourly Billing** — Cron scheduler runs every 60 minutes, deducting `(base_price + markup + backup_cost) / 730` per hour
- **Network Transfer Billing** — Tracks outbound transfer usage against pool quotas with overage cost projection
- **PayPal Integration** — Create order → user approval → capture flow with webhook support
- **Invoice Generation** — Automatic invoice creation linked to billing cycles
- **Billing Summary** — Real-time dashboard showing monthly spend, all-time spend, active VPS count, monthly estimate, and transfer usage
- **Low Balance Alerts** — Daily cron checks for wallets below $5 with active services

---

## Fraud Protection

- **FraudLabsPro Integration** — Real-time transaction screening via IP reputation, email validation, and proxy/VPN/TOR detection
- **Configurable Policies** — Score threshold, VPN/proxy/TOR blocking, disposable email rejection
- **Registration Screening** — New signups are screened before account creation
- **Payment Screening** — Wallet top-ups are screened before PayPal order creation
- **Admin Review Queue** — Flagged transactions are reviewable by admins with manual allow/block override

---

## Refunds

- **Structured Refund Records** — Linked to original transactions, VPS billing cycles, or hosting subscriptions
- **PayPal Capture Refunds** — True PayPal API refunds using capture IDs
- **Admin Refund Management** — Create, process, and track refund status from the admin dashboard
- **Automatic Prorated Refunds** — VPS deletion and hosting cancellation trigger automatic wallet credit refunds

---

## Organizations & Multi-Tenancy

- **Organization-Based Isolation** — All resources (VPS, wallets, tickets, SSH keys, invoices) are scoped to organizations
- **Custom Roles** — Admin-defined roles with granular JSONB permission sets
- **Email Invitations** — Token-based invitation flow with accept/decline endpoints
- **Member Management** — Owner, admin, member, and custom role hierarchy
- **Active Organization** — Users can switch between organizations they belong to

### Predefined Roles & Permissions

Seven predefined roles control access across 19 granular permissions. Orgs can also create custom roles via the role wizard.

| Permission | owner | admin | member | vps_manager | hosting_manager | support_agent | viewer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `vps_view` | Y | Y | Y | Y | — | — | Y |
| `vps_create` | Y | Y | Y | Y | — | — | — |
| `vps_delete` | Y | Y | — | — | — | — | — |
| `vps_manage` | Y | Y | Y | Y | — | — | — |
| `notes_view` | Y | Y | Y | Y | Y | Y | Y |
| `notes_manage` | Y | Y | Y | — | — | — | — |
| `ssh_keys_view` | Y | Y | Y | Y | Y | — | — |
| `ssh_keys_manage` | Y | Y | — | Y | — | — | — |
| `tickets_view` | Y | Y | Y | — | Y | Y | Y |
| `tickets_create` | Y | Y | Y | — | Y | Y | — |
| `tickets_manage` | Y | Y | — | — | — | Y | — |
| `billing_view` | Y | Y | Y | — | Y | — | — |
| `billing_manage` | Y | — | — | — | — | — | — |
| `egress_view` | Y | Y | Y | — | Y | — | — |
| `egress_manage` | Y | — | — | — | — | — | — |
| `members_manage` | Y | — | — | — | — | — | — |
| `settings_manage` | Y | Y | — | — | — | — | — |
| `hosting_view` | Y | Y | Y | — | Y | Y | Y |
| `hosting_manage` | Y | Y | Y | — | Y | — | — |

| Role | Permissions | Purpose |
|---|---|---|
| `owner` | 19/19 | Full access to everything |
| `admin` | 16/19 | All except `billing_manage`, `egress_manage`, `members_manage` |
| `member` | 12/19 | General day-to-day operator — VPS + hosting, no destructive ops |
| `vps_manager` | 6/19 | Linode VPS only — no hosting, no egress |
| `hosting_manager` | 8/19 | Enhance hosting only — no VPS |
| `support_agent` | 5/19 | Support tickets + read-only hosting context |
| `viewer` | 4/19 | Read-only across VPS, notes, tickets, hosting |

---

## Authentication & Security

- **JWT Authentication** — Stateless tokens with configurable expiration (default: 7 days)
- **Two-Factor Authentication** — TOTP-based 2FA with QR code setup via `otplib`
- **Password Reset** — Token-based email flow with expiration
- **Admin Impersonation** — Admins can act as any user for support purposes with visual banner indicator
- **AES-256 Encryption** — SSH credentials and provider API tokens encrypted at rest
- **Row-Level Security** — PostgreSQL RLS on `user_api_keys` table
- **Tiered Rate Limiting** — Configurable per-role limits (anonymous/authenticated/admin) with per-user overrides

---

## Real-Time Features

- **PostgreSQL LISTEN/NOTIFY** — Database triggers fire notifications for user-relevant events
- **Server-Sent Events (SSE)** — Push notifications to connected browser clients
- **WebSocket SSH Bridge** — Real-time bidirectional terminal I/O
- **Live Ticket Updates** — Real-time message delivery via PG notify channels per ticket/org

---

## Admin Dashboard

- **User Management** — Search, view, edit, impersonate, promote users
- **Platform Settings** — Global configuration (branding, contact info, availability hours)
- **Provider Configuration** — Manage Linode API tokens, allowed regions, display order
- **VPS Plan Wizard** — Map Linode plan IDs to retail pricing with markup and backup upcharges
- **Email Templates** — Handlebars-based email template CRUD
- **FAQ & Contact Management** — Admin-editable FAQ categories/items and contact methods
- **Category Mappings** — White-label plan category names
- **Rate Limit Monitoring** — View and configure rate limit metrics and per-user overrides
- **GitHub Integration** — Optional GitHub token for update checking
- **Billing Administration** — View all billing cycles, failed charges, wallet balances
- **Fraud Protection** — Review flagged transactions, manual allow/block override
- **Refund Management** — Create and process refunds via PayPal
- **Web Hosting** — Enhance integration status, plan sync, subscription oversight

---

## UI/UX

- **Responsive Design** — Mobile-first with dedicated mobile hooks (`use-mobile.tsx`, `use-orientation.tsx`, `use-virtual-keyboard.tsx`)
- **Theme System** — Backend-stored theme presets with dark/light mode support
- **Command Palette** — Ctrl/Cmd + K for quick navigation via `cmdk`
- **Accessibility** — ARIA-compliant Radix UI primitives throughout
- **Loading States** — Skeleton loaders, progress indicators, optimistic updates
- **Error Boundaries** — Graceful error handling with fallback UI
