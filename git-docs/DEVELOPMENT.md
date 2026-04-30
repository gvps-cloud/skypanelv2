# Development Setup

Prerequisites, environment configuration, quick start, and development commands.

> **Back to**: [README](../README.md)

---

## Prerequisites

| Requirement    | Version | Notes                                 |
| -------------- | ------- | ------------------------------------- |
| **Node.js**    | 22.22.0 | See `.nvmrc`                          |
| **npm**        | 9+      | Bundled with Node.js                  |
| **PostgreSQL** | 12+     | Local or cloud (Neon, Supabase, etc.) |
| **Git**        | Latest  | For cloning                           |

---

## Required API Keys

| Service                                                       | Purpose                   | Where to Get                                                    |
| ------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------- |
| **Linode API Token**                                          | VPS infrastructure        | [Linode Cloud Manager](https://cloud.linode.com/profile/tokens) |
| **PayPal Client ID & Secret**                                 | Payment processing        | [PayPal Developer](https://developer.paypal.com/)               |
| **Resend API Key** *(at least one email provider required)*   | Email delivery            | [Resend Dashboard](https://resend.com/)                         |
| **SMTP Credentials** *(at least one email provider required)* | Email delivery (fallback) | Your SMTP provider                                              |

---

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/gvps-cloud/skypanelv2.git
cd skypanelv2
npm install

# 2. Configure environment
cp .env.example .env
node scripts/generate-ssh-secret.js  # Generates SSH_CRED_SECRET

# 3. Edit .env with your values (see below)

# 4. Setup database
npm run db:fresh       # Reset + run all migrations
npm run seed:admin     # Create admin user

# 5. Apply branding (updates docs, FAQ, contact info to match .env)
node scripts/seed-branding.js

# 6. Start development
npm run dev            # Frontend (5173) + Backend (3001)
```

---

## Essential Environment Variables

```bash
# Database (required)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/skypanelv2

# Security (required)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
SSH_CRED_SECRET=<generated-by-script>
ENCRYPTION_KEY=your-32-character-encryption-key

# PayPal (required for payments)
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=sandbox

# Server URL (required for PayPal return/cancel redirects)
CLIENT_URL=http://localhost:5173

# Linode (required for VPS)
LINODE_API_TOKEN=your-linode-api-token

# Enhance Web Hosting (optional)
ENHANCE_ENABLED=false
ENHANCE_API_URL=https://panel.yourdomain.com   # Domain only — no /api suffix, the app adds it automatically
ENHANCE_MASTER_ORG_ID=your-master-org-id
ENHANCE_API_KEY=your-token-here                # Raw token only — do NOT include the "Bearer " prefix
ENHANCE_DEFAULT_SERVER_GROUP_ID=default-server-group

# FraudLabsPro Anti-Fraud (optional)
FRAUDLABSPRO_ENABLED=false
FRAUDLABSPRO_API_KEY=your-api-key
FRAUDLABSPRO_REJECT_SCORE=80
FRAUDLABSPRO_REJECT_VPN=true
FRAUDLABSPRO_REJECT_PROXY=true
FRAUDLABSPRO_REJECT_TOR=true
FRAUDLABSPRO_REJECT_DISPOSABLE_EMAIL=true

# Branding
VITE_COMPANY_NAME=YourBrand
COMPANY_NAME=YourBrand
COMPANY_BRAND_NAME=YourBrand

# Networking (used for VPS reverse DNS)
RDNS_BASE_DOMAIN=ip.rev.yourdomain.com

# Default Admin Seed (optional, used by scripts/create-test-admin.js)
# DEFAULT_ADMIN_EMAIL=admin@yourdomain.com
# DEFAULT_ADMIN_PASSWORD=ChangeMeImmediately
```

> **Branding**: After setting the env vars above, run `node scripts/seed-branding.js` to update the database with your brand name in documentation articles, FAQ items, contact methods, and networking config. Migrations use generic placeholders; this script replaces them with your configured values.
>
> For the complete environment variable reference, see [`repo-docs/ENVIRONMENT_VARIABLES.md`](../repo-docs/ENVIRONMENT_VARIABLES.md) and [`.env.example`](../.env.example).

> **PayPal Return URLs**: PayPal redirects users back to your site after checkout. The redirect URLs are derived from `CLIENT_URL`:
>
> | Redirect | URL |
> | -------- | --- |
> | **Success** | `{CLIENT_URL}/billing/payment/success` |
> | **Cancel** | `{CLIENT_URL}/billing/payment/cancel` |
>
> Both routes are defined in `src/App.tsx` as protected routes. In production, set `CLIENT_URL` to your public domain (e.g., `https://panel.yourdomain.com`). PayPal also blocks Pay Later / Pay in 4 / PayPal Credit at the order level via `IMMEDIATE_PAYMENT_REQUIRED` — only immediate payment methods are accepted.

---

## Icons & Logo

The site icon and logo are sourced from a single file: **`public/favicon.svg`**. This SVG is used everywhere:

| Usage                  | Location                                               |
| ---------------------- | ------------------------------------------------------ |
| Browser tab favicon    | `index.html` → `<link rel="icon" href="/favicon.svg">` |
| Public navbar logo     | `src/components/MarketingNavbar.tsx` → `<Logo>`        |
| Dashboard sidebar logo | `src/components/AppSidebar.tsx` → `<Logo>`             |
| Footer logo            | `src/components/MarketingFooter.tsx` → `<Logo>`        |

The `Logo` component (`src/components/Logo.tsx`) renders an `<img>` tag pointing to `/favicon.svg`, so all surfaces stay in sync automatically.

**To change the icon:**

1. Replace `public/favicon.svg` with your new SVG
2. Regenerate raster icons using [realfavicongenerator.net](https://realfavicongenerator.net/) — upload your SVG and download the full icon package
3. Place the generated files in `public/` (`favicon.ico`, `favicon-96x96.png`, `apple-touch-icon.png`, etc.)
4. Update `public/site.webmanifest` if icon filenames change

See [`docs/PWA_SETUP.md`](../docs/PWA_SETUP.md) for additional PWA-specific icon requirements (192x192 and 512x512 PNGs).

---

## Default Admin Credentials

Credentials are configurable via `DEFAULT_ADMIN_EMAIL` and `DEFAULT_ADMIN_PASSWORD` environment variables (set in `.env`).

| Field    | Default             |
| -------- | ------------------- |
| Email    | `admin@example.com` |
| Password | `Admin123#`         |

---

## Development Commands

```bash
# --- Development -----------------------------------------------
npm run dev              # Start frontend + backend concurrently
npm run dev-up           # Kill ports first, then start dev
npm run client:dev       # Frontend only (Vite on :5173)
npm run server:dev       # Backend only (Express on :3001)

# --- Database ---------------------------------------------------
npm run db:fresh         # Reset database + run all migrations
npm run db:reset         # Interactive reset with confirmation
npm run db:reset:confirm # Reset without prompt
npm run seed:admin       # Create default admin user

# --- Quality ----------------------------------------------------
npm run check            # TypeScript type checking
npm run lint             # ESLint validation
npm run build            # TypeScript check + Vite production build

# --- API Docs ---------------------------------------------------
npm run docs:api:sync    # Sync API docs manifest (auto-runs on dev/build)
npm run docs:api:audit   # Audit API documentation coverage

# --- Production -------------------------------------------------
npm run build            # Build for production
npm run start            # Start production API server
npm run pm2:start        # Build and start with PM2
npm run pm2:reload       # Graceful PM2 reload
npm run pm2:stop         # Stop PM2 processes
npm run pm2:list         # List PM2 processes

# --- Utilities --------------------------------------------------
npm run kill-ports       # Kill processes on 3001, 5173, 8000
npm run pwa:icons        # Generate PWA icons
```
