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
- **Durable Billing Cycles** — Each hosting billing event is persisted in `hosting_billing_cycles` with status tracking (pending/paid/failed/refunded/cancelled) and linked invoices
- **SSO Integration** — Single sign-on between SkyPanelV2 and the Enhance control panel for seamless customer access
- **Hosting Email Templates** — Lifecycle email templates: credentials, welcome, suspended, recovered, cancelled, renewal, suspension warning, admin action

---

## Billing & Payments

- **Prepaid Wallet System** — Organization-scoped wallets funded via PayPal
- **Automated Hourly Billing** — Cron scheduler runs every 60 minutes, deducting `(base_price + markup + backup_cost) / 730` per hour
- **Network Transfer Billing** — Tracks outbound transfer usage against pool quotas with overage cost projection
- **PayPal Integration** — Create order → user approval → capture flow with webhook support
- **Invoice Generation** — Automatic invoice creation linked to billing cycles; HTML invoice downloads with theme-aware styling
- **Billing Summary** — Real-time dashboard showing monthly spend, all-time spend, active VPS count, monthly estimate, and transfer usage
- **Low Balance Alerts** — Daily cron checks for wallets below $5 with active services
- **Hosting Wallets** — Dedicated wallets per organization for hosting billing, separate from VPS wallets, with low-balance alerts and suspension warnings
- **Egress Credit Refunds** — Customers can sell unused egress credits back to their main wallet
- **Hosting Wallet Withdrawal** — Transfer funds from hosting wallet back to main wallet

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

## Notes System

- **Personal Notes** — User-scoped notes with kanban-style board (NotesBoard component)
- **Organization Notes** — Org-scoped notes visible to all members with appropriate permissions
- **Permission-Gated** — `notes_view` and `notes_manage` permissions control access
- **Rich Editing** — Support for note creation, editing, deletion, and board organization

---

## API Key Management

- **User API Keys** — Generate, list, and delete API keys scoped to individual users
- **Hashed Storage** — Keys are stored as SHA-256 hashes; the plain text is shown only once at creation
- **Permission JSONB** — Each key carries a granular permission set controlling which endpoints it can access
- **Row-Level Security** — PostgreSQL RLS on `user_api_keys` table enforces access isolation
- **Bearer Auth** — API keys are sent as `Bearer` tokens; middleware validates against hashed values
- **Rate Limiting** — API key requests count against the user's rate limit quota

---

## Documentation & Knowledge Base

- **Admin-Managed Articles** — Full CRUD for documentation articles organized by categories
- **Public Knowledge Base** — Customers browse articles at `/docs/:categorySlug/:articleSlug`
- **White-Label Content** — Documentation is seeded with branding and scrubbed of provider references
- **Rich Content** — Articles support formatted text, code blocks, and structured content

---

## Announcements

- **Platform Announcements** — Admin-created announcements displayed to all users
- **Banner Integration** — Active announcements shown via AnnouncementBanner at the top of the page
- **Dismissible** — Users can dismiss announcements; state persisted per user

---

## Status Monitoring

- **Better Stack Integration** — Uptime monitoring via Better Stack service
- **Public Status Page** — `/status` page showing service health and uptime
- **Real-Time Status** — Cached status data refreshed periodically

---

## Volume Pricing

- **Admin Volume Configuration** — Configure volume types, pricing tiers, and billing rules
- **Volume Billing Management** — Track volume usage and billing per organization

---

## Content Management

- **FAQ System** — Admin-managed FAQ categories and items displayed publicly
- **Contact Methods** — Configurable contact methods (email, phone, chat) with availability hours
- **Category Mappings** — White-label plan category names for custom branding
- **GitHub Integration** — Optional GitHub token for update checking

---

## Blog & Content Publishing

- **Public Blog** — Blog listing page with category filtering and individual post pages at `/blog/:year/:slug`
- **Admin CMS** — Full blog post management with category and tag management via admin dashboard
- **Rich Editing** — TipTap-based rich text editor for post content with cover images and excerpts
- **SEO Support** — Meta title, meta description, and Open Graph image per post
- **Soft Delete** — Posts are soft-deleted with `deleted_at` timestamp, preserving URL integrity

---

## Support Ticket System

- **Ticket Lifecycle** — Create, view, reply, close, and reopen tickets with status tracking (open/in_progress/resolved/closed)
- **Priority & Category** — Tickets have priority levels (low/medium/high/urgent) and categories
- **Role-Based Access** — Access controlled by `tickets_view`, `tickets_create`, and `tickets_manage` permissions
- **Admin Ticket Management** — Dedicated admin view for managing all tickets across organizations with staff reply tracking
- **Hosting Context** — Tickets linked to hosting subscriptions capture domain and plan name snapshots at creation time
- **VPS Context** — Tickets can reference VPS instances for infrastructure support
- **Real-Time Updates** — New replies and status changes propagate via PG LISTEN/NOTIFY

---

## Platform Maintenance Mode

- **Maintenance Toggle** — Admin can enable/disable maintenance mode from the platform settings
- **Maintenance Code** — Optional bypass code allowing non-admin users to access the platform during maintenance
- **Page Guard** — `MaintenanceGuard` redirects non-admin users to `/maintenance` page; admins always bypass
- **Selective Access** — Blog and login pages remain accessible during maintenance (with code)
- **Public API** — `/api/site-status` provides public maintenance status without authentication

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

- **PostgreSQL LISTEN/NOTIFY** — Database triggers fire notifications for user-relevant events, with heartbeat and reconnect guards for connection stability
- **Server-Sent Events (SSE)** — Push notifications to connected browser clients
- **WebSocket SSH Bridge** — Real-time bidirectional terminal I/O
- **Live Ticket Updates** — Real-time message delivery via PG notify channels per ticket/org

---

## IP Detection & CDN

- **Client IP Resolution** — Multi-header IP detection (X-Forwarded-For, True-Client-IP, etc.)
- **Bunny CDN Integration** — Automatic fetching and trusting of Bunny CDN edge server IPs for accurate rate limiting
- **Proxy/VPN Detection** — Via FraudLabsPro integration during screening

---

## Admin Dashboard

- **User Management** — Search, view, edit, impersonate, promote users
- **Platform Settings** — Global configuration (branding, contact info, availability hours)
- **Platform Maintenance** — Toggle maintenance mode with optional bypass code
- **Provider Configuration** — Manage Linode API tokens, allowed regions, display order
- **VPS Plan Wizard** — Map Linode plan IDs to retail pricing with markup and backup upcharges
- **Email Templates** — Handlebars-based email template CRUD including hosting lifecycle templates
- **FAQ & Contact Management** — Admin-editable FAQ categories/items and contact methods
- **Category Mappings** — White-label plan category names
- **Rate Limit Monitoring** — View and configure rate limit metrics and per-user overrides
- **GitHub Integration** — Optional GitHub token for update checking
- **Billing Administration** — View all billing cycles, failed charges, wallet balances
- **Fraud Protection** — Review flagged transactions with stats, filters, and detail view; manual allow/block override
- **Refund Management** — Create and process refunds via PayPal
- **Web Hosting** — Enhance integration status, plan sync, subscription oversight
- **Announcements** — Platform-wide announcement management
- **Documentation** — Knowledge base article CRUD
- **Blog CMS** — Post and category management with cover image upload and tag system
- **Support Tickets** — Cross-organization ticket management with staff reply tracking and status transitions
- **Networking** — IP allocation, rDNS editing, IPv6 range management, firewall configuration, VLAN management
- **Server Management** — Server list and configuration
- **Volume Pricing** — Volume type and billing configuration
- **Theme Management** — Theme preset configuration and preview

---

## UI/UX

- **Responsive Design** — Mobile-first with dedicated mobile hooks (`use-mobile.tsx`, `use-orientation.tsx`, `use-virtual-keyboard.tsx`)
- **Theme System** — Backend-stored theme presets with dark/light mode support, applied to invoices and exports
- **Command Palette** — Ctrl/Cmd + K for quick navigation via `cmdk`
- **Accessibility** — ARIA-compliant Radix UI primitives throughout
- **Loading States** — Skeleton loaders, progress indicators, optimistic updates
- **Error Boundaries** — Graceful error handling with fallback UI
- **Marketing Pages** — Redesigned homepage with hero section, particle globe, console showcase, and data stream canvas
- **Terminal FX** — Decorative terminal components (boot sequence, ASCII art, glitch text, matrix rain, scanline overlay) for marketing pages
- **Dashboard Preview** — Interactive dashboard preview component on marketing pages
- **ScrollArea Components** — Consistent scroll behavior across all panels via shadcn/ui ScrollArea
- **Floating Dashboard Footer** — Animated footer with offset calculation for main content
