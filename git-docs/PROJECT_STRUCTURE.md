# Project Structure

Complete directory tree for the SkyPanelV2 repository.

> **Back to**: [README](../README.md)

---

```
skypanelv2/
├── api/                              # Backend API (Express.js + TypeScript)
│   ├── app.ts                        # Express app wiring, middleware, route registration
│   ├── server.ts                     # HTTP server bootstrap, SSH bridge init, billing scheduler
│   ├── index.ts                      # Entry point
│   ├── config/
│   │   └── index.ts                  # Environment config, rate limit parsing, validation
│   ├── lib/                          # Shared backend utilities
│   │   ├── database.ts               # PostgreSQL query/transaction helpers
│   │   ├── crypto.ts                 # AES-256 encrypt/decrypt
│   │   ├── providerTokens.ts         # Provider API token resolution
│   │   ├── providerRegions.ts        # Region filtering logic
│   │   ├── whiteLabel.ts             # White-label category mapping
│   │   ├── validation.ts             # Input validation helpers
│   │   ├── security.ts               # Security utilities
│   │   ├── ipDetection.ts            # Client IP resolution
│   │   ├── errorHandling.ts          # Error formatting
│   │   ├── diagnostics.ts            # System diagnostics
│   │   ├── fsUtils.ts                # File system helpers
│   │   └── animalSuffix.ts           # Random label generation
│   ├── middleware/
│   │   ├── auth.ts                   # JWT authentication (sets req.user)
│   │   ├── permissions.ts            # Organization-based RBAC
│   │   ├── rateLimiting.ts           # Tiered rate limiting + headers
│   │   ├── security.ts               # Helmet, CORS, nonce-based CSP
│   │   ├── csrfProtection.ts         # CSRF token middleware for API routes
│   │   └── requireHttps.ts           # Force HTTPS in production
│   ├── routes/
│   │   ├── admin/                    # Admin-only route handlers
│   │   │   ├── billing.ts            # Admin billing management
│   │   │   ├── categoryMappings.ts   # White-label category CRUD
│   │   │   ├── contact.ts            # Contact message management
│   │   │   ├── emailTemplates.ts     # Email template CRUD
│   │   │   ├── platform.ts           # Platform settings
│   │   │   ├── sshKeys.ts            # Admin SSH key management
│   │   │   ├── networking.ts         # rDNS and IPv6 config
│   │   │   ├── announcements.ts      # Platform announcements
│   │   │   ├── users.ts              # Admin users + impersonation
│   │   │   ├── organizations.ts      # Admin organization operations
│   │   │   ├── providers.ts          # Admin provider operations
│   │   │   ├── plans.ts              # Admin VPS plan operations
│   │   │   ├── servers.ts            # Admin server operations
│   │   │   ├── tickets.ts            # Admin support operations
│   │   │   ├── activity.ts           # Admin activity feed
│   │   │   ├── documentation.ts      # Admin docs CRUD
│   │   │   ├── volumePricing.ts      # Admin volume billing operations
│   │   │   └── index.ts              # Admin route aggregator
│   │   ├── auth.ts                   # Login, register, 2FA, password reset
│   │   ├── vps/                      # VPS route modules and aggregator
│   │   ├── payments.ts               # PayPal order creation/capture
│   │   ├── organizations.ts          # Org CRUD, members, invitations, roles
│   │   ├── support.ts                # Ticket CRUD, replies
│   │   ├── sshKeys.ts                # SSH key management + Linode sync
│   │   ├── invoices.ts               # Invoice listing/detail
│   │   ├── activity.ts               # User activity feed
│   │   ├── activities.ts             # Activity logging
│   │   ├── notifications.ts          # SSE notification stream
│   │   ├── adminFaq.ts               # Admin FAQ management
│   │   ├── faq.ts                    # Public FAQ content
│   │   ├── contact.ts                # Contact form submission
│   │   ├── pricing.ts                # Public pricing data
│   │   ├── theme.ts                  # Theme preset management
│   │   ├── github.ts                 # GitHub integration
│   │   ├── health.ts                 # Health check endpoint
│   │   ├── documentation.ts          # Public documentation articles
│   │   ├── adminDocumentation.ts     # Admin documentation CRUD
│   │   ├── announcements.ts          # Public announcements
│   │   └── apiKeys/                  # User API key routes
│   └── services/
│       ├── providers/                # Cloud provider abstraction
│       │   ├── IProviderService.ts   # Provider interface contract
│       │   ├── BaseProviderService.ts # Shared provider logic
│       │   ├── LinodeProviderService.ts # Linode implementation
│       │   ├── ProviderFactory.ts    # Provider instantiation
│       │   └── index.ts              # Provider exports
│       ├── authService.ts            # JWT token management
│       ├── billingService.ts         # Hourly billing engine
│       ├── billingCronService.ts     # 24h billing reminder cron
│       ├── egressBillingService.ts   # Transfer pool tracking (monthly)
│       ├── egressCreditService.ts    # Pre-paid egress credit management
│       ├── egressHourlyBillingService.ts # Hourly egress billing
│       ├── betterStackService.ts     # Better Stack uptime integration
│       ├── bruteForceProtectionService.ts # Brute force lockout
│       ├── ipService.ts              # IP address management
│       ├── linodeService.ts          # Linode REST API wrapper
│       ├── paypalService.ts          # PayPal order/capture/wallet
│       ├── emailService.ts           # Email with provider fallback
│       ├── emailTemplateService.ts   # Handlebars template rendering
│       ├── invoiceService.ts         # Invoice generation
│       ├── activityLogger.ts         # Activity log recording
│       ├── activityFeed.ts           # Activity feed queries
│       ├── activityEmailService.ts   # Activity email notifications
│       ├── notificationService.ts    # PG LISTEN/NOTIFY → EventEmitter
│       ├── userNotificationPreferences.ts # User notification settings
│       ├── themeService.ts           # Theme configuration
│       ├── categoryMappingService.ts # White-label categories
│       ├── providerService.ts        # Provider CRUD
│       ├── providerResourceCache.ts  # Cached provider data
│       ├── platformStatsService.ts   # Admin dashboard stats
│       ├── githubService.ts          # GitHub API integration
│       ├── invitations.ts            # Organization invitation logic
│       ├── roles.ts                  # Role/permission management
│       ├── sshBridge.ts              # WebSocket SSH terminal bridge
│       ├── tokenBlacklistService.ts  # JWT token blacklist
│       ├── rateLimitMetrics.ts       # Rate limit metrics collection
│       ├── rateLimitConfigValidator.ts # Rate limit config validation
│       └── rateLimitOverrideService.ts # Per-user rate limit overrides
│
├── src/                              # Frontend (React SPA)
│   ├── App.tsx                       # Root component, route definitions, providers
│   ├── main.tsx                      # React DOM entry point
│   ├── index.css                     # Global styles + Tailwind imports
│   ├── components/
│   │   ├── ui/                       # shadcn/ui base components
│   │   ├── admin/                    # Admin dashboard components
│   │   ├── VPS/                      # VPS creation wizard, SSH terminal
│   │   ├── billing/                  # Payment and billing components (PurchaseEgressCreditsDialog)
│   │   ├── support/                  # Ticket management components
│   │   ├── organizations/            # Org management components
│   │   ├── settings/                 # User settings components
│   │   ├── Dashboard/                # Dashboard widgets
│   │   ├── SSHKeys/                  # SSH key management
│   │   ├── data-table/               # Reusable data table
│   │   ├── layouts/                  # Layout wrappers
│   │   ├── hooks/                    # Component-level hooks
│   │   ├── AppLayout.tsx             # Main app shell with sidebar
│   │   ├── AppSidebar.tsx            # Navigation sidebar
│   │   ├── PublicLayout.tsx          # Public page layout
│   │   ├── MarketingNavbar.tsx       # Public navigation bar
│   │   ├── MarketingFooter.tsx       # Public footer
│   │   ├── NotificationDropdown.tsx  # Notification bell dropdown
│   │   ├── ActivityFeed.tsx          # Activity feed component
│   │   └── ErrorBoundary.tsx         # Error boundary wrapper
│   ├── pages/                        # Route page components
│   │   ├── admin/                    # Admin pages
│   │   ├── user/                     # User-specific pages
│   │   ├── HomeRedesign.tsx          # Landing page
│   │   ├── Dashboard.tsx             # User dashboard
│   │   ├── VPS.tsx                   # VPS list
│   │   ├── VPSDetail.tsx             # VPS detail view
│   │   ├── VpsSshConsole.tsx         # Full-screen SSH terminal
│   │   ├── Billing.tsx               # Billing overview
│   │   ├── Organizations.tsx         # Organization management
│   │   └── ...                       # Other page components
│   ├── contexts/
│   │   ├── AuthContext.tsx            # Authentication state + JWT
│   │   ├── ThemeContext.tsx           # Theme management
│   │   ├── ImpersonationContext.tsx   # Admin impersonation state
│   │   └── BreadcrumbContext.tsx      # Navigation breadcrumbs
│   ├── hooks/                        # Reusable React hooks
│   ├── services/                     # Frontend API service wrappers
│   ├── lib/                          # Utility libraries
│   │   ├── api.ts                    # Axios API client + auto-logout
│   │   ├── utils.ts                  # General utilities (cn, etc.)
│   │   ├── billingUtils.ts           # Billing calculation helpers
│   │   ├── brand.ts                  # Branding utilities
│   │   └── ...                       # Other utilities
│   ├── theme/
│   │   └── presets.ts                # Theme preset definitions
│   ├── types/                        # TypeScript type definitions
│   └── styles/                       # Page-specific CSS
│
├── git-docs/                         # Split documentation (this directory)
├── migrations/                       # Sequential SQL migrations (001–059)
├── scripts/                          # Node.js utility scripts
│   ├── run-migration.js              # Apply pending migrations
│   ├── reset-database.js             # Interactive DB reset
│   ├── seed-admin.js                 # Create default admin
│   ├── generate-ssh-secret.js        # Generate encryption key
│   ├── audit-api-docs.mjs            # API docs audit
│   └── ...                           # Admin, diagnostic, migration helpers
├── repo-docs/                        # Internal documentation
│   ├── ADMIN_COMPONENTS.md           # Admin component reference
│   ├── ADMIN_TROUBLESHOOTING.md      # Admin troubleshooting guide
│   ├── ENVIRONMENT_VARIABLES.md      # Complete env var reference
│   ├── enhance-integration.md        # Enhance hosting integration docs
│   ├── linode-openapi.json           # Linode API spec
│   └── enhance-oas3-api.yaml         # Enhance API spec
├── public/                           # Static assets (icons, logos)
├── data/                             # Static data files
├── AGENTS.md                         # AI agent coding guidelines
├── CLAUDE.md                         # Claude Code development reference
├── ecosystem.config.cjs              # PM2 process configuration
├── vite.config.ts                    # Vite build configuration
├── vitest.config.ts                  # Vitest test configuration
├── playwright.config.ts              # Playwright E2E configuration
├── tailwind.config.js                # Tailwind CSS configuration
├── tsconfig.json                     # TypeScript configuration
├── package.json                      # Dependencies and scripts
└── .env.example                      # Environment variable template
```
