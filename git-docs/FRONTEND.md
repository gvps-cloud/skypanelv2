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
| **@dnd-kit**              | Drag and drop (sortable lists)                            |
| **Leaflet + react-leaflet** | Interactive maps for regions page                       |
| **@tiptap**               | Rich text editor (code blocks, tables, images, links)     |
| **dompurify**             | HTML sanitization                                         |
| **date-fns**              | Date formatting and manipulation                          |
| **input-otp**             | OTP input component for 2FA                               |
| **react-day-picker**      | Date picker component                                     |
| **sonner**                | Toast notifications                                       |
| **qrcode**                | QR code generation (2FA setup)                            |
| **lucide-react**          | Icon library                                              |

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
  /hosting/marketing      /hosting/plans

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
  /notes                  /organizations/:id/notes
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

> `BreadcrumbContext` provides navigation breadcrumbs throughout the app for page-level wayfinding.

---

## Key Frontend Components

| Directory                       | Contents                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/components/ui/`            | Base shadcn/ui primitives (Button, Dialog, Input, Table, etc.)                                     |
| `src/components/admin/`         | Admin dashboard panels (UserManagement, VPSPlanWizard, CategoryManager, RateLimitMonitoring, etc.) |
| `src/components/VPS/`           | VPS creation wizard steps, SSH terminal, provider/region selectors, backup config                  |
| `src/components/billing/`       | Payment forms, transaction history, invoice views, PurchaseEgressCreditsDialog                     |
| `src/components/support/`       | Ticket creation, conversation threads, status/priority badges, admin ticket view   |
| `src/components/organizations/` | Org management, member lists, resource tables, invitation flows                    |
| `src/components/settings/`      | User profile, 2FA setup, API key management, role wizard, team settings            |
| `src/components/Dashboard/`     | Dashboard widgets, stats cards, activity summaries, monthly reset indicator         |
| `src/components/layouts/`       | Page layout wrappers — ContentCard, PageHeader, StatsGrid                          |
| `src/components/api-docs/`      | API documentation explorer — SwaggerExplorer, RequestBuilder, ResponseViewer, ApiKeyInput |
| `src/components/docs/`          | Documentation article viewer — ApiReference component                              |
| `src/components/home/`          | Landing page sections — DataStreamCanvas, SkyPanelPreview, GlobeRegionPanel |
| `src/components/marketing/`     | Marketing page components — MarketingHero                                          |
| `src/components/fx/`            | Terminal FX effects — BootSequence, AsciiArt, GlitchText, MatrixRain, ScanlineOverlay, TypewriterText, StatusHeartbeat |
| `src/components/terminal/`      | Terminal workspace — TerminalPanel, TerminalEmptyState, TerminalErrorScreen, TerminalLoadingScreen, TerminalPageHeader |
| `src/components/icons/`         | Custom SVG icon components                                                         |
| `src/components/notes/`         | Notes board — NotesBoard (kanban-style), OrganizationNotesSection                  |
| `src/components/regions/`       | Interactive region map — LeafletMap, RegionInfoCard, RegionMarker, RegionPopup, country flags |
| `src/components/data-table/`    | Reusable data table with sorting, filtering, pagination                            |
| `src/components/SSHKeys/`       | SSH key management, Linode sync                                                    |
| `src/components/admin/blog/`    | Blog admin CMS — BlogCategoryManager, BlogPostManager                              |
| `src/components/admin/billing/` | Admin billing panels — BillingDashboard, BillingOverview, BillingInvoices, BillingTransactions, EgressBilling, VolumePricing |
| `src/components/admin/email/`   | Email template management — EmailTemplateEditor, EmailTemplateList, EmailTemplatesManager |
| `src/components/admin/documentation/` | Documentation admin — DocumentationArticleManager, DocumentationCategoryManager, DocumentationManager |
| `src/components/admin/networking/` | Networking admin — FirewallManager, IPAddressTable, IPAssignPanel, IPSharePanel, VLANTable, IPv6RangeRdnsEditor |
| `src/components/admin/rate-limit-monitoring/` | Rate limit admin — OverviewTab, OverridesTab, ConfigurationTab, ViolationsTab, UserTypesTab |

---

## Key Frontend Hooks

| Hook                          | Purpose                                  |
| ----------------------------- | ---------------------------------------- |
| `use-mobile.tsx`              | Mobile device detection                  |
| `use-orientation.tsx`         | Screen orientation tracking              |
| `use-virtual-keyboard.tsx`    | Virtual keyboard detection               |
| `use-mobile-animations.tsx`   | Reduced-motion-aware mobile animations   |
| `use-mobile-assets.tsx`       | Responsive asset loading                 |
| `use-mobile-navigation.tsx`   | Mobile-specific navigation patterns      |
| `use-mobile-performance.tsx`  | Performance optimization for mobile      |
| `use-lazy-loading.tsx`        | Lazy-loaded component patterns           |
| `use-form-persistence.tsx`    | Form state persistence across navigation |
| `useCategoryMappings.ts`      | White-label category mapping hooks       |
| `useEnhanceAdmin.ts`          | Enhance admin status hooks               |
| `useHosting.ts`               | Hosting subscription hooks               |
| `useNotes.ts`                 | Personal/org notes hooks                 |
| `useTheme.ts`                 | Theme preference hooks                   |
| `useSiteStatus.ts`            | Site status and maintenance mode hooks   |

---

> **Back to**: [README](../README.md)
