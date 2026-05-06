# Project Structure

Complete directory tree for the SkyPanelV2 repository.

> **Back to**: [README](../README.md)

---

```
skypanelv2/
├── api/                              # Backend API (Express.js + TypeScript)
│   ├── app.ts                        # Express app wiring, middleware, route registration
│   ├── server.ts                     # HTTP server bootstrap, SSH bridge init, billing scheduler
│   ├── index.ts                      # Vercel serverless deploy entry handler
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
│   │   ├── ipv6.ts                   # IPv6 address utilities
│   │   ├── errorHandling.ts          # Error formatting (handleProviderError)
│   │   ├── diagnostics.ts            # System diagnostics
│   │   ├── fsUtils.ts                # File system helpers
│   │   ├── animalSuffix.ts           # Random label generation
│   │   ├── clientBaseUrl.ts          # Client base URL resolution
│   │   ├── secureRandom.ts           # Cryptographically secure random generation
│   │   ├── unwrapItems.ts            # Response item unwrapping
│   │   ├── hostingBackups.ts         # Hosting backup helpers
│   │   ├── hostingEnhanceOrg.ts      # Enhance org resolution helpers
│   │   └── hostingRouteHelpers.ts    # Hosting route shared logic
│   ├── middleware/
│   │   ├── auth.ts                   # JWT authentication (sets req.user)
│   │   ├── permissions.ts            # Organization-based RBAC
│   │   ├── rateLimiting.ts           # Tiered rate limiting + headers
│   │   ├── security.ts               # Helmet, CORS, nonce-based CSP
│   │   ├── csrfProtection.ts         # CSRF token middleware
│   │   ├── requireHttps.ts           # Force HTTPS in production
│   │   └── hosting.ts                # Hosting feature gating middleware
│   ├── routes/
│   │   ├── admin/                    # Admin-only route handlers
│   │   │   ├── activity.ts           # Admin activity feed
│   │   │   ├── announcements.ts      # Platform announcements
│   │   │   ├── billing.ts            # Admin billing management
│   │   │   ├── categoryMappings.ts   # White-label category CRUD
│   │   │   ├── contact.ts            # Contact message management
│   │   │   ├── documentation.ts      # Admin docs CRUD
│   │   │   ├── egress.ts             # Admin egress management
│   │   │   ├── emailTemplates.ts     # Email template CRUD
│   │   │   ├── enhance.ts            # Admin Enhance hosting operations
│   │   │   ├── faq.ts                # Admin FAQ management
│   │   │   ├── fraud.ts              # Fraud detection management
│   │   │   ├── github.ts             # Admin GitHub integration
│   │   │   ├── networking.ts         # rDNS and IPv6 config
│   │   │   ├── organizations.ts      # Admin organization operations
│   │   │   ├── plans.ts              # Admin VPS plan operations
│   │   │   ├── platform.ts           # Platform settings
│   │   │   ├── providers.ts          # Admin provider operations
│   │   │   ├── rateLimits.ts         # Rate limit configuration
│   │   │   ├── refunds.ts            # Refund management
│   │   │   ├── servers.ts            # Admin server operations
│   │   │   ├── sshKeys.ts            # Admin SSH key management
│   │   │   ├── stackscripts.ts       # StackScript management
│   │   │   ├── theme.ts              # Admin theme management
│   │   │   ├── tickets.ts            # Admin support operations
│   │   │   ├── upstream.ts           # Upstream provider config
│   │   │   ├── users.ts              # Admin users + impersonation
│   │   │   ├── volumePricing.ts      # Admin volume billing operations
│   │   │   └── index.ts              # Admin route aggregator
│   │   ├── hosting/                  # Hosting route handlers
│   │   │   ├── apps.ts               # Hosting applications
│   │   │   ├── backups.ts            # Hosting backups
│   │   │   ├── cron.ts               # Cron job management
│   │   │   ├── dns.ts                # DNS management
│   │   │   ├── email.ts              # Email account management
│   │   │   ├── ftp.ts                # FTP account management
│   │   │   ├── joomla.ts             # Joomla site management
│   │   │   ├── mysql.ts              # MySQL database management
│   │   │   ├── node.ts               # Node.js app management
│   │   │   ├── public.ts             # Public hosting status
│   │   │   ├── ssh.ts                # Hosting SSH management
│   │   │   ├── ssl.ts                # SSL certificate management
│   │   │   ├── store.ts              # Hosting purchase/store
│   │   │   ├── web.ts                # Website management
│   │   │   └── wordpress.ts          # WordPress site management
│   │   ├── vps/                      # VPS route modules
│   │   │   ├── backups.ts            # VPS backup operations
│   │   │   ├── disks.ts              # Disk management
│   │   │   ├── firewalls.ts          # Firewall management
│   │   │   ├── instances.ts          # VPS CRUD, power, rebuild
│   │   │   ├── networking.ts         # IP, rDNS, VLAN operations
│   │   │   ├── plans.ts              # VPS plan listing
│   │   │   ├── providers.ts          # VPS provider operations
│   │   │   ├── stackscripts.ts       # StackScript operations
│   │   │   ├── stats.ts              # VPS stats/endpoints
│   │   │   ├── index.ts              # VPS route aggregator
│   │   │   └── shared/               # Shared VPS route helpers
│   │   ├── apiKeys/                  # User API key routes
│   │   │   ├── create.ts             # API key creation
│   │   │   ├── delete.ts             # API key deletion
│   │   │   ├── index.ts              # API key route aggregator
│   │   │   ├── list.ts               # API key listing
│   │   │   └── middleware.ts         # API key auth middleware
│   │   ├── __tests__/                # Route-level tests
│   │   │   ├── admin-enhance-status.test.ts
│   │   │   ├── admin-volume-pricing.test.ts
│   │   │   ├── billing-egress.test.ts
│   │   │   ├── hosting-backups.test.ts
│   │   │   ├── hosting-detail-fixes.test.ts
│   │   │   ├── hosting-store.test.ts
│   │   │   ├── notifications.test.ts
│   │   │   ├── organizations-resources.test.ts
│   │   │   ├── vps-disks.test.ts
│   │   │   └── vps-instances.test.ts
│   │   ├── auth.ts                   # Login, register, 2FA, password reset
│   │   ├── payments.ts               # PayPal order creation/capture
│   │   ├── organizations.ts          # Org CRUD, members, invitations, roles
│   │   ├── support.ts                # Ticket CRUD, replies
│   │   ├── sshKeys.ts                # SSH key management + Linode sync
│   │   ├── invoices.ts               # Invoice listing/detail
│   │   ├── activity.ts               # User activity feed
│   │   ├── activities.ts             # Activity logging
│   │   ├── notifications.ts          # SSE notification stream
│   │   ├── faq.ts                    # Public FAQ content
│   │   ├── contact.ts                # Contact form submission
│   │   ├── pricing.ts                # Public pricing data
│   │   ├── theme.ts                  # Theme preset management
│   │   ├── health.ts                 # Health check endpoint
│   │   ├── documentation.ts          # Public documentation articles
│   │   ├── announcements.ts          # Public announcements
│   │   ├── admin.ts                  # Admin route mounting
│   │   ├── egress.ts                 # Egress transfer data
│   │   └── notes.ts                  # Notes CRUD (org + personal)
│   └── services/
│       ├── providers/                # Cloud provider abstraction
│       │   ├── IProviderService.ts   # Provider interface contract
│       │   ├── BaseProviderService.ts # Shared provider logic
│       │   ├── LinodeProviderService.ts # Linode implementation
│       │   ├── ProviderFactory.ts    # Provider instantiation
│       │   ├── errorNormalizer.ts    # Provider error normalization
│       │   ├── index.ts              # Provider exports
│       │   ├── ARCHITECTURE.md       # Provider architecture docs
│       │   ├── README.md             # Provider usage docs
│       │   ├── CACHING.md            # Provider caching strategy
│       │   └── API_DOCUMENTATION.md  # Provider API reference
│       ├── egress/
│       │   └── egressUtils.ts        # Egress calculation utilities
│       ├── authService.ts            # JWT token management
│       ├── billingService.ts         # Hourly billing engine
│       ├── billingCronService.ts     # 24h billing reminder cron
│       ├── egressBillingService.ts   # Transfer pool tracking (monthly)
│       ├── egressCreditService.ts    # Pre-paid egress credit management
│       ├── egressHourlyBillingService.ts # Hourly egress billing
│       ├── betterStackService.ts     # Better Stack uptime integration
│       ├── bruteForceProtectionService.ts # Brute force lockout
│       ├── bunnyCdnService.ts        # Bunny CDN integration
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
│       ├── ticketNotificationService.ts # Ticket email notifications
│       ├── themeService.ts           # Theme configuration
│       ├── categoryMappingService.ts # White-label categories
│       ├── providerService.ts        # Provider CRUD
│       ├── providerResourceCache.ts  # Cached provider data
│       ├── platformStatsService.ts   # Admin dashboard stats
│       ├── githubService.ts          # GitHub API integration
│       ├── invitations.ts            # Organization invitation logic
│       ├── roles.ts                  # Role/permission management
│       ├── notes.ts                  # Notes service logic
│       ├── sshBridge.ts              # WebSocket SSH terminal bridge
│       ├── tokenBlacklistService.ts  # JWT token blacklist
│       ├── tokenBlacklistService.js  # Legacy JS token blacklist
│       ├── enhanceService.ts         # Enhance API integration
│       ├── enhanceOnboardingService.ts # Enhance site onboarding
│       ├── enhanceToggle.ts          # Enhance feature toggle
│       ├── hostingBillingService.ts  # Hosting subscription billing
│       ├── fraudLabsProService.ts    # Fraud detection integration
│       ├── refundService.ts          # Refund processing
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
│   │   ├── billing/                  # Payment and billing components
│   │   ├── support/                  # Ticket management components
│   │   ├── organizations/            # Org management components
│   │   ├── settings/                 # User settings components
│   │   ├── Dashboard/                # Dashboard widgets
│   │   ├── SSHKeys/                  # SSH key management
│   │   ├── data-table/               # Reusable data table
│   │   ├── layouts/                  # Layout wrappers
│   │   ├── hooks/                    # Component-level hooks
│   │   ├── api-docs/                 # API docs explorer
│   │   │   ├── ApiKeyInput.tsx       # API key input component
│   │   │   ├── RequestBuilder.tsx    # Request builder UI
│   │   │   ├── ResponseViewer.tsx    # Response display component
│   │   │   ├── SwaggerExplorer.tsx   # OpenAPI spec explorer
│   │   │   └── index.ts
│   │   ├── docs/                     # Documentation viewer (ApiReference)
│   │   ├── home/                     # Landing page components
│   │   ├── icons/                    # Custom icon components
│   │   ├── notes/                    # Notes board
│   │   │   ├── NotesBoard.tsx        # Notes kanban board
│   │   │   └── OrganizationNotesSection.tsx
│   │   ├── regions/                  # Region map components
│   │   │   ├── LeafletMap.tsx        # Interactive Leaflet map
│   │   │   ├── RegionInfoCard.tsx    # Region detail card
│   │   │   ├── RegionMarker.tsx      # Map marker component
│   │   │   ├── RegionPopup.tsx       # Marker popup
│   │   │   ├── countryFlags.tsx      # Country flag icons
│   │   │   ├── useSpiderfy.ts        # Marker spiderfy hook
│   │   │   └── index.ts
│   │   ├── __tests__/                # Component tests
│   │   ├── AppLayout.tsx             # Main app shell with sidebar
│   │   ├── AppSidebar.tsx            # Navigation sidebar
│   │   ├── PublicLayout.tsx          # Public page layout
│   │   ├── MarketingNavbar.tsx       # Public navigation bar
│   │   ├── MarketingFooter.tsx       # Public footer
│   │   ├── Navigation.tsx            # Navigation component
│   │   ├── NotificationDropdown.tsx  # Notification bell dropdown
│   │   ├── ActivityFeed.tsx          # Activity feed component
│   │   ├── AnnouncementBanner.tsx    # Top announcement banner
│   │   ├── BackToTopButton.tsx       # Scroll-to-top button
│   │   ├── Empty.tsx                 # Empty state component
│   │   ├── ErrorBoundary.tsx         # Error boundary wrapper
│   │   ├── FooterPartnerLinks.tsx    # Footer partner links
│   │   ├── GlobalTrackingScript.tsx  # Analytics tracking
│   │   ├── ImpersonationSidebarPanel.tsx # Admin impersonation panel
│   │   ├── Logo.tsx                  # Brand logo component
│   │   ├── NotFound.tsx              # 404 page component
│   │   ├── ScrollToTop.tsx           # Route scroll reset
│   │   ├── VPSInfrastructureCard.tsx # VPS infrastructure card
│   │   ├── nav-main.tsx              # Main nav items
│   │   ├── nav-projects.tsx          # Project nav items
│   │   ├── nav-secondary.tsx         # Secondary nav items
│   │   └── nav-user.tsx              # User menu nav
│   ├── pages/                        # Route page components
│   │   ├── admin/                    # Admin page sections
│   │   │   ├── AdminContactManagementSection.tsx
│   │   │   ├── AdminNetworkingSection.tsx
│   │   │   ├── AdminProvidersSection.tsx
│   │   │   ├── AdminServersSection.tsx
│   │   │   ├── AdminThemeSection.tsx
│   │   │   └── AdminUserDetail.tsx
│   │   ├── hosting-detail/           # Hosting tab components
│   │   │   ├── AppsTab.tsx
│   │   │   ├── BackupsTab.tsx
│   │   │   ├── CronTab.tsx
│   │   │   ├── DnsTab.tsx
│   │   │   ├── EmailTab.tsx
│   │   │   ├── FtpTab.tsx
│   │   │   ├── JoomlaTab.tsx
│   │   │   ├── MysqlTab.tsx
│   │   │   ├── NodeTab.tsx
│   │   │   ├── OverviewTab.tsx
│   │   │   ├── RuntimeTab.tsx
│   │   │   ├── SshKeysTab.tsx
│   │   │   ├── ssl-tab/
│   │   │   │   └── SslTab.tsx
│   │   │   ├── web-tab/
│   │   │   │   └── WebTab.tsx
│   │   │   └── WordPressTab.tsx
│   │   ├── vps-detail/               # VPS detail sub-components
│   │   ├── VPSDetail/                # VPS detail sub-components (legacy casing)
│   │   ├── AboutUs.tsx
│   │   ├── AcceptInvitation.tsx
│   │   ├── Activity.tsx
│   │   ├── Admin.tsx
│   │   ├── ApiDocs.tsx
│   │   ├── Billing.tsx
│   │   ├── BillingPaymentCancel.tsx
│   │   ├── BillingPaymentSuccess.tsx
│   │   ├── Contact.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Documentation.tsx
│   │   ├── EgressCredits.tsx
│   │   ├── FAQ.tsx
│   │   ├── ForgotPassword.tsx
│   │   ├── HomeRedesign.tsx          # Landing page
│   │   ├── Hosting.tsx
│   │   ├── HostingDetail.tsx
│   │   ├── HostingMarketing.tsx
│   │   ├── HostingStore.tsx
│   │   ├── InvoiceDetail.tsx
│   │   ├── Login.tsx
│   │   ├── OrganizationNotes.tsx
│   │   ├── Organizations.tsx
│   │   ├── PersonalNotes.tsx
│   │   ├── Pricing.tsx
│   │   ├── PrivacyPolicy.tsx
│   │   ├── Regions.tsx
│   │   ├── Register.tsx
│   │   ├── ResetPassword.tsx
│   │   ├── Settings.tsx
│   │   ├── SSHKeys.tsx
│   │   ├── Status.tsx
│   │   ├── Support.tsx
│   │   ├── TermsOfService.tsx
│   │   ├── TransactionDetail.tsx
│   │   ├── VPS.tsx                   # VPS list
│   │   └── VPSDetail.tsx             # VPS detail view
│   ├── contexts/
│   │   ├── AuthContext.tsx            # Authentication state + JWT
│   │   ├── ThemeContext.tsx           # Theme management
│   │   ├── ImpersonationContext.tsx   # Admin impersonation state
│   │   └── BreadcrumbContext.tsx      # Navigation breadcrumbs
│   ├── hooks/                        # Reusable React hooks
│   │   ├── use-form-persistence.tsx  # Form state persistence
│   │   ├── use-lazy-loading.tsx      # Lazy loading hook
│   │   ├── use-mobile.tsx            # Mobile detection
│   │   ├── use-mobile-animations.tsx # Mobile animation control
│   │   ├── use-mobile-assets.tsx     # Mobile asset loading
│   │   ├── use-mobile-navigation.tsx # Mobile navigation hook
│   │   ├── use-mobile-performance.tsx # Mobile performance hooks
│   │   ├── use-orientation.tsx       # Screen orientation hook
│   │   ├── use-virtual-keyboard.tsx  # Virtual keyboard detection
│   │   ├── useCategoryMappings.ts    # Category mapping data
│   │   ├── useEnhanceAdmin.ts        # Enhance admin hooks
│   │   ├── useHosting.ts             # Hosting data hooks
│   │   ├── useNotes.ts              # Notes CRUD hooks
│   │   └── useTheme.ts              # Theme toggle hook
│   ├── services/                     # Frontend API service wrappers
│   │   ├── adminEmailTemplateService.ts
│   │   ├── categoryMappingService.ts
│   │   ├── egressService.ts
│   │   ├── ipamService.ts
│   │   ├── notesService.ts
│   │   └── paymentService.ts
│   ├── lib/                          # Utility libraries
│   │   ├── api.ts                    # Axios API client + auto-logout
│   │   ├── utils.ts                  # General utilities (cn, etc.)
│   │   ├── apiDocsShared.tsx         # Shared API docs data/components
│   │   ├── apiDocsTryIt.ts           # API docs try-it functionality
│   │   ├── apiRouteManifest.ts       # Auto-generated API route catalog
│   │   ├── billingUtils.ts           # Billing calculation helpers
│   │   ├── brand.ts                  # Branding utilities
│   │   ├── breadcrumbs.ts            # Breadcrumb helpers
│   │   ├── color.ts                  # Color utilities
│   │   ├── errorHandling.ts          # Frontend error handling
│   │   ├── formatters.ts             # Number/date formatters
│   │   ├── hostingPlanFeatures.ts    # Hosting plan feature maps
│   │   ├── impersonationSession.ts   # Impersonation session helpers
│   │   ├── invoiceTheme.ts           # Invoice PDF theming
│   │   ├── osGroupUtils.ts           # OS grouping utilities
│   │   ├── providerErrors.ts         # Provider error mapping
│   │   ├── regionCoordinates.ts      # Region coordinate data
│   │   ├── runtimeBootstrap.ts       # Runtime bootstrap data
│   │   ├── timezones.ts              # Timezone utilities
│   │   ├── validation.ts             # Frontend validation helpers
│   │   ├── vpsLabelGenerator.ts      # VPS name/label generation
│   │   ├── vpsStepConfiguration.ts   # VPS wizard step config
│   │   └── activeHoursUtils.ts       # Active hours calculation
│   ├── theme/
│   │   └── presets.ts                # Theme preset definitions
│   ├── types/                        # TypeScript type definitions
│   └── styles/                       # Page-specific CSS
│
├── lib/                              # Shared workspace packages (pnpm)
│   ├── api-client-react/             # TanStack Query hooks (generated)
│   ├── api-spec/                     # OpenAPI spec + orval codegen
│   ├── api-zod/                      # Zod request/response schemas (generated)
│   └── db/                           # Drizzle ORM schema definitions
│
├── migrations/                       # Sequential SQL migrations (001–065)
├── scripts/                          # Node.js utility scripts
│   ├── lib/
│   │   └── database.js               # Shared script DB helper
│   ├── run-migration.js              # Apply pending migrations
│   ├── apply-single-migration.js     # Apply one migration file
│   ├── apply-stackscript-migration.js # StackScript data migration
│   ├── reset-database.js             # Interactive DB reset
│   ├── create-test-admin.js          # Create test admin user
│   ├── ensure-admin-user.js          # Ensure admin exists
│   ├── promote-to-admin.js           # Promote user to admin
│   ├── update-admin-password.js      # Update admin password
│   ├── check-admin-users.js          # Verify admin users
│   ├── verify-admin-status.js        # Check admin status
│   ├── verify-env.js                 # Validate environment config
│   ├── verify-active-org-column.js   # Verify active org column
│   ├── generate-ssh-secret.js        # Generate SSH encryption key
│   ├── generate-encryption-key.js    # Generate AES encryption key
│   ├── generate-pwa-icons.js         # Generate PWA icon assets
│   ├── audit-api-docs.mjs            # API docs coverage audit
│   ├── fix-api-docs.mjs              # Fix API doc issues
│   ├── check-routes.mjs              # Validate route registration
│   ├── check-platform-settings.js    # Check platform settings
│   ├── check-migration.js            # Migration status check
│   ├── check-users-schema.js         # Verify users table schema
│   ├── check-vps-plans.js            # Verify VPS plan data
│   ├── check-contact-methods-status.js # Contact methods status
│   ├── clean-migration.js            # Clean up migration state
│   ├── debug-admin-login.js          # Debug admin login issues
│   ├── fix-duplicates.js             # Fix duplicate DB records
│   ├── fix-duplicates.mjs            # Fix duplicates (ESM)
│   ├── fix-provider-encryption.js    # Re-encrypt provider tokens
│   ├── migrate-backup-pricing-data.js # Backup pricing migration
│   ├── migrate-vps-plan-type-class.js # VPS plan type migration
│   ├── migrate-vps-provider-data.js  # VPS provider data migration
│   ├── reseed-faq.js                 # Reseed FAQ content
│   ├── seed-branding.js              # Seed brand configuration
│   ├── run-semgrep.js                # Run Semgrep security scan
│   └── update-theme-to-mono.js       # Migrate theme to mono
│
├── tests/
│   ├── e2e/                          # Playwright E2E tests
│   │   └── smoke.spec.ts             # Smoke test suite
│   └── security/                     # Security/isolation tests
│       ├── README.md                 # Security test documentation
│       ├── auth.test.ts              # Authentication security
│       ├── admin-auth-coverage.test.ts
│       ├── admin-networking.test.ts
│       ├── apiKeys.test.ts
│       ├── api-hardening.test.ts
│       ├── disks-isolation.test.ts
│       ├── hosting-org-isolation.test.ts
│       ├── linode-provider-networking.test.ts
│       ├── member-role-permissions.test.ts
│       ├── notes.test.ts
│       ├── notifications-isolation.test.ts
│       ├── payment-isolation.test.ts
│       ├── payments-org-guard.test.ts
│       ├── ssh-keys-isolation.test.ts
│       ├── volume-isolation.test.ts
│       ├── whitelabel-provider.test.ts
│       ├── xss.test.ts
│       └── animalSuffix.test.ts
│
├── git-docs/                         # Split documentation (this directory)
├── repo-docs/                        # Internal documentation
│   ├── ADMIN_COMPONENTS.md           # Admin component reference
│   ├── ADMIN_TROUBLESHOOTING.md      # Admin troubleshooting guide
│   ├── ENVIRONMENT_VARIABLES.md      # Complete env var reference
│   ├── enhance-integration.md        # Enhance hosting integration docs
│   ├── linode-openapi.json           # Linode API spec
│   ├── enhance-oas3-api.yaml         # Enhance API spec
│   ├── shadcn-ui-docs/               # shadcn/ui reference docs
├── public/                           # Static assets (icons, logos)
├── data/                             # Static data files (audit reports)
├── docs/
│   └── PWA_SETUP.md                  # PWA setup documentation
│
├── .nvmrc                            # Node.js version (22.22.0)
├── .env.example                      # Environment variable template
├── AGENTS.md                         # AI agent coding guidelines
├── CLAUDE.md                         # Claude Code development reference
├── pnpm-workspace.yaml               # pnpm workspace config (lib/*)
├── pnpm-lock.yaml                    # pnpm lockfile for workspace packages
├── package.json                      # Dependencies and scripts (npm)
├── package-lock.json                 # npm lockfile
├── ecosystem.config.cjs              # PM2 process configuration
├── vite.config.ts                    # Vite build configuration
├── vitest.config.ts                  # Vitest test configuration
├── playwright.config.ts              # Playwright E2E configuration
├── tailwind.config.js                # Tailwind CSS configuration
├── tsconfig.json                     # TypeScript configuration
└── biome.json                        # Biome linter config (no root script)
```
