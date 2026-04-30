# Frontend Architecture

React SPA technology stack, routing, context providers, and key components.

> **Back to**: [README](../README.md)

---

## Technology Stack

| Technology                | Purpose                                                   |
| ------------------------- | --------------------------------------------------------- |
| **React 18**              | Component-based UI framework                              |
| **TypeScript**            | Type-safe development                                     |
| **Vite**                  | Build tool and HMR dev server                             |
| **React Router v7**       | Client-side routing with route guards                     |
| **TanStack Query**        | Server state management with caching & optimistic updates |
| **shadcn/ui**             | Accessible component library (Radix UI primitives)        |
| **Tailwind CSS**          | Utility-first styling                                     |
| **React Hook Form + Zod** | Form validation with schema-based validation              |
| **Framer Motion**         | Animations and transitions                                |
| **Recharts**              | Data visualization and charts                             |
| **xterm.js**              | Browser-based terminal emulator                           |
| **cmdk**                  | Command palette (Ctrl/Cmd + K)                            |

---

## Route Map

```text
FRONTEND ROUTE MAP
-----------------------------------------------------------------------------
Public (no auth)
  /           /pricing    /faq        /about
  /contact    /status     /terms      /privacy
  /docs       /docs/:categorySlug/:articleSlug
  /regions

Auth (redirect if logged in)
  /login      /register   /forgot-password   /reset-password

Protected (auth required)
  /dashboard              /vps              /vps/:id
  /vps/:id/ssh (standalone terminal)
  /hosting                /hosting/store    /hosting/:id
  /ssh-keys               /organizations    /organizations/:id
  /billing                /billing/invoice/:id
  /billing/transaction/:id
  /billing/payment/success   /billing/payment/cancel
  /egress-credits
  /support                /settings         /activity
  /api-docs

Admin (admin role)
  /admin       /admin/user/:id

Invitation
  /organizations/invitations/:token
```

> ★ The SSH console route (`/vps/:id/ssh`) uses a **standalone** protected layout without the sidebar, rendering a full-screen terminal.

---

## React Context Providers

```text
REACT CONTEXT PROVIDER STACK (nesting order)
-----------------------------------------------------------------------------
QueryClientProvider (TanStack Query)
  ↓ ThemeProvider (theme presets, dark/light)
    ↓ AuthProvider (JWT token, user state, logout)
      ↓ ImpersonationProvider (admin acting-as state)
        ↓ BrowserRouter (React Router)
          ↓ AppRoutes
```

---

## Key Frontend Components

| Directory                       | Contents                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/components/ui/`            | Base shadcn/ui primitives (Button, Dialog, Input, Table, etc.)                                     |
| `src/components/admin/`         | Admin dashboard panels (UserManagement, VPSPlanWizard, CategoryManager, RateLimitMonitoring, etc.) |
| `src/components/VPS/`           | VPS creation wizard steps, SSH terminal, provider/region selectors, backup config                  |
| `src/components/billing/`       | Payment forms, transaction history, invoice views, PurchaseEgressCreditsDialog                     |
| `src/components/support/`       | Ticket creation, conversation threads, status management                                           |
| `src/components/organizations/` | Org management, member lists, invitation flows                                                     |
| `src/components/settings/`      | User profile, 2FA setup, API key management                                                        |
| `src/components/Dashboard/`     | Dashboard widgets, stats cards, activity summaries                                                 |
| `src/components/layouts/`       | Page layout wrappers                                                                               |
