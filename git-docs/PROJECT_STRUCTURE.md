# Project Structure

Complete directory tree for the SkyPanelV2 repository.

> **Back to**: [README](../README.md)

---

```
skypanelv2/
├── api/                                    # Backend API (Express 4 + TypeScript, ESM)
│   ├── app.ts                              # Express app wiring, middleware, route registration
│   ├── server.ts                           # HTTP server bootstrap, SSH bridge, billing scheduler
│   ├── index.ts                            # Vercel serverless deploy entry handler
│   ├── config/
│   │   └── index.ts                        # Environment config, rate limit parsing, validation
│   ├── lib/                                # Shared backend utilities
│   │   ├── database.ts                     # PostgreSQL query/transaction helpers (raw pg)
│   │   ├── crypto.ts                       # AES-256 encrypt/decrypt
│   │   ├── providerTokens.ts               # Provider API token resolution
│   │   ├── providerRegions.ts              # Region filtering logic
│   │   ├── whiteLabel.ts                   # White-label category mapping
│   │   ├── validation.ts                   # Input validation helpers
│   │   ├── security.ts                     # Security utilities
│   │   ├── ipDetection.ts                  # Client IP resolution
│   │   ├── ipv6.ts                         # IPv6 address utilities
│   │   ├── errorHandling.ts                # Error formatting (handleProviderError)
│   │   ├── diagnostics.ts                  # System diagnostics
│   │   ├── fsUtils.ts                      # File system helpers
│   │   ├── animalSuffix.ts                 # Random label generation
│   │   ├── clientBaseUrl.ts                # Client base URL resolution
│   │   ├── secureRandom.ts                 # Cryptographically secure random generation
│   │   ├── unwrapItems.ts                  # Response item unwrapping
│   │   ├── hostingBackups.ts               # Hosting backup helpers
│   │   ├── hostingEnhanceOrg.ts            # Enhance org resolution helpers
│   │   ├── hostingRouteHelpers.ts          # Hosting route shared logic
│   │   ├── activityFilters.ts              # Activity log filter logic
│   │   ├── pgListenHeartbeat.ts            # PG LISTEN heartbeat
│   │   └── spaSocialMeta.ts                # SPA social meta tag injection
│   ├── middleware/
│   │   ├── auth.ts                         # JWT authentication (sets req.user)
│   │   ├── permissions.ts                  # Organization-based RBAC
│   │   ├── rateLimiting.ts                 # Tiered rate limiting + headers
│   │   ├── security.ts                     # Helmet, CORS, nonce-based CSP
│   │   ├── csrfProtection.ts              # CSRF token middleware
│   │   ├── requireHttps.ts                # Force HTTPS in production
│   │   └── hosting.ts                      # Hosting feature gating middleware
│   ├── routes/
│   │   ├── admin/                          # Admin-only route handlers
│   │   │   ├── __tests__/                  # Admin route tests (4 files)
│   │   │   ├── index.ts                    # Admin route aggregator
│   │   │   ├── activity.ts                 # Admin activity feed
│   │   │   ├── announcements.ts            # Platform announcements
│   │   │   ├── billing.ts                  # Admin billing management
│   │   │   ├── blog.ts                     # Blog admin
│   │   │   ├── categoryMappings.ts         # White-label category CRUD
│   │   │   ├── contact.ts                  # Contact message management
│   │   │   ├── documentation.ts            # Admin docs CRUD
│   │   │   ├── egress.ts                   # Admin egress management
│   │   │   ├── emailTemplates.ts           # Email template CRUD
│   │   │   ├── enhance.ts                  # Admin Enhance hosting operations
│   │   │   ├── faq.ts                      # Admin FAQ management
│   │   │   ├── fraud.ts                    # Fraud detection management
│   │   │   ├── github.ts                   # Admin GitHub integration
│   │   │   ├── networking.ts               # rDNS and IPv6 config
│   │   │   ├── organizations.ts            # Admin organization operations
│   │   │   ├── plans.ts                    # Admin VPS plan operations
│   │   │   ├── platform.ts                 # Platform settings
│   │   │   ├── providers.ts                # Admin provider operations
│   │   │   ├── rateLimits.ts               # Rate limit configuration
│   │   │   ├── refunds.ts                  # Refund management
│   │   │   ├── servers.ts                  # Admin server operations
│   │   │   ├── sshKeys.ts                  # Admin SSH key management
│   │   │   ├── stackscripts.ts             # StackScript management
│   │   │   ├── theme.ts                    # Admin theme management
│   │   │   ├── tickets.ts                  # Admin support operations
│   │   │   ├── upstream.ts                 # Upstream provider config
│   │   │   ├── users.ts                    # Admin users + impersonation
│   │   │   └── volumePricing.ts            # Admin volume billing operations
│   │   ├── hosting/                        # Hosting route handlers
│   │   │   ├── apps.ts                     # Hosting applications
│   │   │   ├── backups.ts                  # Hosting backups
│   │   │   ├── cron.ts                     # Cron job management
│   │   │   ├── dns.ts                      # DNS management
│   │   │   ├── email.ts                    # Email account management
│   │   │   ├── ftp.ts                      # FTP account management
│   │   │   ├── joomla.ts                   # Joomla site management
│   │   │   ├── mysql.ts                    # MySQL database management
│   │   │   ├── node.ts                     # Node.js app management
│   │   │   ├── public.ts                   # Public hosting status
│   │   │   ├── ssh.ts                      # Hosting SSH management
│   │   │   ├── ssl.ts                      # SSL certificate management
│   │   │   ├── store.ts                    # Hosting purchase/store
│   │   │   ├── web.ts                      # Website management
│   │   │   └── wordpress.ts                # WordPress site management
│   │   ├── vps/                            # VPS route modules
│   │   │   ├── backups.ts                  # VPS backup operations
│   │   │   ├── disks.ts                    # Disk management
│   │   │   ├── firewalls.ts                # Firewall management
│   │   │   ├── instances.ts                # VPS CRUD, power, rebuild
│   │   │   ├── networking.ts               # IP, rDNS, VLAN operations
│   │   │   ├── plans.ts                    # VPS plan listing
│   │   │   ├── providers.ts                # VPS provider operations
│   │   │   ├── stackscripts.ts             # StackScript operations
│   │   │   ├── stats.ts                    # VPS stats/endpoints
│   │   │   ├── index.ts                    # VPS route aggregator
│   │   │   └── shared/                     # Shared VPS route helpers
│   │   │       ├── types.ts
│   │   │       └── utils.ts
│   │   ├── apiKeys/                        # User API key routes
│   │   │   ├── create.ts                   # API key creation
│   │   │   ├── delete.ts                   # API key deletion
│   │   │   ├── index.ts                    # API key route aggregator
│   │   │   ├── list.ts                     # API key listing
│   │   │   └── middleware.ts              # API key auth middleware
│   │   ├── __tests__/                      # Route-level tests (12 files)
│   │   │   ├── activity-routes-filter.test.ts
│   │   │   ├── admin-blog-cover-image.test.ts
│   │   │   ├── admin-enhance-status.test.ts
│   │   │   ├── admin-volume-pricing.test.ts
│   │   │   ├── auth-login-maintenance-reset.test.ts
│   │   │   ├── billing-egress.test.ts
│   │   │   ├── hosting-backups.test.ts
│   │   │   ├── hosting-detail-fixes.test.ts
│   │   │   ├── hosting-store.test.ts
│   │   │   ├── notifications.test.ts
│   │   │   ├── organizations-resources.test.ts
│   │   │   ├── site-status.test.ts
│   │   │   ├── support-ticket-vps-org-scope.test.ts
│   │   │   ├── vps-disks.test.ts
│   │   │   └── vps-instances.test.ts
│   │   ├── activities.ts                   # Activity logging
│   │   ├── activity.ts                     # User activity feed
│   │   ├── admin.ts                        # Admin route mounting
│   │   ├── announcements.ts                # Public announcements
│   │   ├── auth.ts                         # Login, register, 2FA, password reset
│   │   ├── blog.ts                         # Blog public routes
│   │   ├── contact.ts                      # Contact form submission
│   │   ├── documentation.ts                # Public documentation articles
│   │   ├── egress.ts                       # Egress transfer data
│   │   ├── faq.ts                          # Public FAQ content
│   │   ├── health.ts                       # Health check endpoint
│   │   ├── invoices.ts                     # Invoice listing/detail
│   │   ├── notes.ts                        # Notes CRUD (org + personal)
│   │   ├── notifications.ts                # SSE notification stream
│   │   ├── organizations.ts                # Org CRUD, members, invitations, roles
│   │   ├── payments.ts                     # PayPal order creation/capture
│   │   ├── pricing.ts                      # Public pricing data
│   │   ├── siteStatus.ts                   # Site status endpoint
│   │   ├── sshKeys.ts                      # SSH key management + Linode sync
│   │   ├── support.ts                      # Ticket CRUD, replies
│   │   └── theme.ts                        # Theme preset management
│   ├── services/                           # Business logic services
│   │   ├── providers/                      # Cloud provider abstraction layer
│   │   │   ├── IProviderService.ts         # Provider interface contract
│   │   │   ├── BaseProviderService.ts      # Shared provider logic
│   │   │   ├── LinodeProviderService.ts    # Linode implementation
│   │   │   ├── ProviderFactory.ts          # Provider instantiation
│   │   │   ├── errorNormalizer.ts          # Provider error normalization
│   │   │   ├── index.ts                    # Provider exports
│   │   │   ├── ARCHITECTURE.md             # Provider architecture docs
│   │   │   ├── README.md                   # Provider usage docs
│   │   │   ├── CACHING.md                  # Provider caching strategy
│   │   │   └── API_DOCUMENTATION.md        # Provider API reference
│   │   ├── egress/
│   │   │   └── egressUtils.ts              # Egress calculation utilities
│   │   ├── authService.ts                  # JWT token management
│   │   ├── billingService.ts               # Hourly billing engine
│   │   ├── billingCronService.ts           # 24h billing reminder cron
│   │   ├── egressBillingService.ts         # Transfer pool tracking (monthly)
│   │   ├── egressCreditService.ts          # Pre-paid egress credit management
│   │   ├── egressHourlyBillingService.ts   # Hourly egress billing
│   │   ├── betterStackService.ts           # Better Stack uptime integration
│   │   ├── bruteForceProtectionService.ts  # Brute force lockout
│   │   ├── bunnyCdnService.ts              # Bunny CDN integration
│   │   ├── ipService.ts                    # IP address management
│   │   ├── linodeService.ts                # Linode REST API wrapper
│   │   ├── paypalService.ts                # PayPal order/capture/wallet
│   │   ├── emailService.ts                 # Email with provider fallback
│   │   ├── emailTemplateService.ts         # Handlebars template rendering
│   │   ├── invoiceService.ts               # Invoice generation
│   │   ├── activityLogger.ts               # Activity log recording
│   │   ├── activityFeed.ts                 # Activity feed queries
│   │   ├── activityEmailService.ts         # Activity email notifications
│   │   ├── notificationService.ts          # PG LISTEN/NOTIFY → EventEmitter
│   │   ├── userNotificationPreferences.ts  # User notification settings
│   │   ├── ticketNotificationService.ts    # Ticket email notifications
│   │   ├── themeService.ts                 # Theme configuration
│   │   ├── categoryMappingService.ts       # White-label categories
│   │   ├── providerService.ts              # Provider CRUD
│   │   ├── providerResourceCache.ts        # Cached provider data
│   │   ├── platformStatsService.ts         # Admin dashboard stats
│   │   ├── platformSettingsService.ts      # Platform settings service
│   │   ├── githubService.ts                # GitHub API integration
│   │   ├── invitations.ts                  # Organization invitation logic
│   │   ├── roles.ts                        # Role/permission management
│   │   ├── notes.ts                        # Notes service logic
│   │   ├── sshBridge.ts                    # WebSocket SSH terminal bridge
│   │   ├── tokenBlacklistService.ts        # JWT token blacklist
│   │   ├── tokenBlacklistService.js        # Legacy JS token blacklist
│   │   ├── enhanceService.ts               # Enhance API integration
│   │   ├── enhanceOnboardingService.ts     # Enhance site onboarding
│   │   ├── enhanceToggle.ts                # Enhance feature toggle
│   │   ├── hostingBillingService.ts        # Hosting subscription billing
│   │   ├── fraudLabsProService.ts          # Fraud detection integration
│   │   ├── refundService.ts                # Refund processing
│   │   ├── rateLimitMetrics.ts             # Rate limit metrics collection
│   │   ├── rateLimitConfigValidator.ts     # Rate limit config validation
│   │   └── rateLimitOverrideService.ts     # Per-user rate limit overrides
│   ├── tests/                              # Integration test suites
│   │   ├── helpers/                        # Test utilities
│   │   │   ├── buildAuthedRequest.ts
│   │   │   ├── mockDatabase.ts
│   │   │   ├── mockEmail.ts
│   │   │   ├── mockLinode.ts
│   │   │   ├── mockPayPal.ts
│   │   │   └── seedDatabase.ts
│   │   ├── egress-wallet-purchase.test.ts
│   │   ├── hosting-purchase-saga.test.ts
│   │   └── hosting-wallet-withdraw.test.ts
│   └── types/
│       ├── linode-openapi.ts               # Linode API type definitions
│       └── vercel.d.ts                     # Vercel type declarations
│
├── cli/                                    # TUI Admin Console (Bun + OpenTUI + React 19)
│   ├── skypanel.tsx                        # Entry point: validate config, test API, boot renderer
│   ├── package.json                        # Bun deps: @opentui/core, @opentui/react, dotenv
│   ├── tsconfig.json                       # JSX config (jsxImportSource: @opentui/react)
│   ├── theme.ts                            # Centralized palette + getStatusColor()
│   ├── lib/
│   │   ├── client.ts                       # HTTP API client (Bearer auth, normalized URLs)
│   │   └── config.ts                       # Env var loading and validation
│   ├── components/
│   │   ├── App.tsx                         # Root layout: sidebar + content + status bar + toast
│   │   ├── Sidebar.tsx                     # Navigation sidebar (1-9 screen keys)
│   │   ├── StatusBar.tsx                   # Connection info bar
│   │   ├── DataTable.tsx                   # Scrollable list with columns and search
│   │   ├── DetailPanel.tsx                 # Key-value detail view with action buttons
│   │   ├── FormDialog.tsx                  # Modal form for inputs
│   │   ├── ConfirmDialog.tsx               # Destructive action confirmation
│   │   └── Toast.tsx                       # Success/error notifications
│   └── screens/
│       ├── MetricsScreen.tsx               # Dashboard / platform overview
│       ├── UsersScreen.tsx                 # User management
│       ├── OrgsScreen.tsx                  # Organization management
│       ├── VpsScreen.tsx                   # Server power control
│       ├── HostingScreen.tsx               # Hosting subscription management
│       ├── TicketsScreen.tsx               # Support ticket management
│       ├── BillingScreen.tsx               # Billing and transactions
│       ├── PlatformScreen.tsx              # Platform controls
│       └── BlogScreen.tsx                  # Blog CMS
│
├── src/                                    # Frontend (React 18 + Vite + TypeScript)
│   ├── App.tsx                             # Root component, route definitions, providers
│   ├── main.tsx                            # React DOM entry point
│   ├── index.css                           # Global styles + Tailwind imports
│   ├── vite-env.d.ts                       # Vite type declarations
│   ├── test-utils.tsx                      # Test utility helpers
│   ├── components/
│   │   ├── ui/                             # shadcn/ui base components (~50 files)
│   │   │   ├── __tests__/
│   │   │   │   └── AccordionSelect.wheel.test.tsx
│   │   │   ├── cyber/                      # Cyberpunk-themed UI variants
│   │   │   ├── accordion.tsx
│   │   │   ├── AccordionSelect.tsx
│   │   │   ├── alert-dialog.tsx
│   │   │   ├── alert.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── breadcrumb.tsx
│   │   │   ├── button.tsx
│   │   │   ├── button-variants.ts
│   │   │   ├── calendar.tsx
│   │   │   ├── card.tsx
│   │   │   ├── chart.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── collapsible.tsx
│   │   │   ├── command.tsx
│   │   │   ├── date-picker.tsx
│   │   │   ├── decrypted-text.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dialog-stack.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── input-group.tsx
│   │   │   ├── input-otp.tsx
│   │   │   ├── kbd.tsx
│   │   │   ├── label.tsx
│   │   │   ├── mobile-form-feedback.tsx
│   │   │   ├── mobile-loading.tsx
│   │   │   ├── mobile-step-navigation.tsx
│   │   │   ├── mobile-toast.tsx
│   │   │   ├── Pagination.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── progress.tsx
│   │   │   ├── rich-text-editor.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   ├── select.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── shape-landing-hero.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── sidebar-context.ts
│   │   │   ├── skeleton.tsx
│   │   │   ├── slider.tsx
│   │   │   ├── sonner.tsx
│   │   │   ├── status.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── textarea.tsx
│   │   │   └── tooltip.tsx
│   │   ├── admin/                          # Admin dashboard components
│   │   │   ├── billing/                    # Admin billing views (7 files)
│   │   │   ├── blog/                       # Blog admin (2 files)
│   │   │   ├── documentation/              # Documentation admin (3 files)
│   │   │   ├── email/                      # Email template admin (3 files)
│   │   │   ├── networking/                 # Networking admin (9 files)
│   │   │   ├── rate-limit-monitoring/      # Rate limit dashboard (12 files)
│   │   │   ├── AccessibilityEnhancer.tsx
│   │   │   ├── AdminActivityLog.tsx
│   │   │   ├── AdminSupportView.tsx
│   │   │   ├── AnnouncementsManager.tsx
│   │   │   ├── CategoryManager.tsx
│   │   │   ├── CategoryMappingManager.tsx
│   │   │   ├── ConfirmationDialog.tsx
│   │   │   ├── ContactCategoryManager.tsx
│   │   │   ├── ContactMethodManager.tsx
│   │   │   ├── EgressCreditManager.tsx
│   │   │   ├── EgressPackSettings.tsx
│   │   │   ├── EnhanceIntegrationCard.tsx
│   │   │   ├── EnhancePlans.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── FAQItemManager.tsx
│   │   │   ├── FraudCheckList.tsx
│   │   │   ├── ImpersonationLoadingOverlay.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── MaintenanceManager.tsx
│   │   │   ├── OptimizedList.tsx
│   │   │   ├── OrganizationManagement.tsx
│   │   │   ├── PerformanceOptimizer.ts
│   │   │   ├── PlatformAvailabilityManager.tsx
│   │   │   ├── ProgressIndicator.tsx
│   │   │   ├── RefundList.tsx
│   │   │   ├── RegionAccessManager.tsx
│   │   │   ├── RegionLabelManager.tsx
│   │   │   ├── SSHKeyManagement.tsx
│   │   │   ├── UpdatesManager.tsx
│   │   │   ├── UserActionMenu.tsx
│   │   │   ├── UserBillingInfo.tsx
│   │   │   ├── UserEditModal.tsx
│   │   │   ├── UserHostingList.tsx
│   │   │   ├── UserManagement.tsx
│   │   │   ├── UserManagementSkeleton.tsx
│   │   │   ├── UserProfileCard.tsx
│   │   │   ├── UserProfileModal.tsx
│   │   │   ├── UserVPSList.tsx
│   │   │   ├── VPSPlanWizard.tsx
│   │   │   └── index.ts
│   │   ├── VPS/                            # VPS creation wizard, SSH terminal
│   │   │   ├── ActiveHoursDisplay.tsx
│   │   │   ├── BackupConfiguration.tsx
│   │   │   ├── BulkDeleteModal.tsx
│   │   │   ├── CostSummary.tsx
│   │   │   ├── CreateVPSSteps.tsx
│   │   │   ├── LazyDeploymentSelection.tsx
│   │   │   ├── LazyOSSelection.tsx
│   │   │   ├── LazyStackScriptConfig.tsx
│   │   │   ├── LinodeConfiguration.tsx
│   │   │   ├── OSAccordionSelect.tsx
│   │   │   ├── PlanAccordionSelect.tsx
│   │   │   ├── ProviderAccordionSelect.tsx
│   │   │   ├── ProviderErrorDisplay.tsx
│   │   │   ├── ProviderSelector.tsx
│   │   │   ├── RebuildOSSelect.tsx
│   │   │   ├── RegionAccordionSelect.tsx
│   │   │   ├── RegionMultiSelect.tsx
│   │   │   ├── RegionSelector.tsx
│   │   │   ├── SearchableOptionSelect.tsx
│   │   │   ├── SSHKeyAccordionSelect.tsx
│   │   │   ├── SSHTerminal.tsx
│   │   │   ├── StackScriptAccordionSelect.tsx
│   │   │   └── VpsTable.tsx
│   │   ├── billing/
│   │   │   ├── PayPalCheckoutDialog.tsx
│   │   │   └── PurchaseEgressCreditsDialog.tsx
│   │   ├── support/                        # Ticket management components
│   │   │   ├── UserSupportView.tsx
│   │   │   └── shared/                     # Shared support components (8 files)
│   │   │       ├── constants.ts
│   │   │       ├── CreateTicketDialog.tsx
│   │   │       ├── MessageBubble.tsx
│   │   │       ├── TicketDetailHeader.tsx
│   │   │       ├── TicketInfoSidebar.tsx
│   │   │       ├── TicketList.tsx
│   │   │       ├── TicketListItem.tsx
│   │   │       ├── TicketPriorityBadge.tsx
│   │   │       └── TicketStatusBadge.tsx
│   │   ├── organizations/
│   │   │   ├── OrganizationResourceTables.tsx
│   │   │   └── OrganizationResourceTables.test.tsx
│   │   ├── settings/
│   │   │   ├── CreateRoleWizard.tsx
│   │   │   └── TeamSettings.tsx
│   │   ├── Dashboard/
│   │   │   └── MonthlyResetIndicator.tsx
│   │   ├── SSHKeys/
│   │   │   ├── DeleteSSHKeyDialog.tsx
│   │   │   └── SSHKeyForm.tsx
│   │   ├── data-table/                     # Reusable data table (3 files)
│   │   │   ├── data-table.tsx
│   │   │   ├── data-table-pagination.tsx
│   │   │   └── data-table-skeleton.tsx
│   │   ├── layouts/                        # Layout wrappers
│   │   │   ├── ContentCard.tsx
│   │   │   ├── PageHeader.tsx
│   │   │   ├── StatsGrid.tsx
│   │   │   └── index.ts
│   │   ├── hooks/
│   │   │   └── use-mobile.tsx
│   │   ├── api-docs/                       # API docs explorer (5 files)
│   │   │   ├── ApiKeyInput.tsx
│   │   │   ├── RequestBuilder.tsx
│   │   │   ├── ResponseViewer.tsx
│   │   │   ├── SwaggerExplorer.tsx
│   │   │   └── index.ts
│   │   ├── docs/
│   │   │   └── ApiReference.tsx
│   │   ├── home/                           # Landing page components
│   │   │   ├── DataStreamCanvas.tsx
│   │   │   ├── GlobeRegionPanel.tsx
│   │   │   └── SkyPanelPreview.tsx
│   │   ├── icons/
│   │   │   └── tech/                       # Technology icon components
│   │   ├── notes/
│   │   │   ├── NotesBoard.tsx
│   │   │   └── OrganizationNotesSection.tsx
│   │   ├── regions/                        # Region map components (7 files)
│   │   │   ├── LeafletMap.tsx
│   │   │   ├── RegionInfoCard.tsx
│   │   │   ├── RegionMarker.tsx
│   │   │   ├── RegionPopup.tsx
│   │   │   ├── countryFlags.tsx
│   │   │   ├── index.ts
│   │   │   └── useSpiderfy.ts
│   │   ├── fx/                             # Visual effects components
│   │   │   ├── ascii/
│   │   │   │   └── logo.ts
│   │   │   ├── AsciiArt.tsx
│   │   │   ├── AsciiBox.tsx
│   │   │   ├── AsciiDivider.tsx
│   │   │   ├── BootSequence.tsx
│   │   │   ├── CursorBlink.tsx
│   │   │   ├── GlitchText.tsx
│   │   │   ├── MatrixRain.tsx
│   │   │   ├── ScanlineOverlay.tsx
│   │   │   ├── StatusHeartbeat.tsx
│   │   │   ├── TypewriterText.tsx
│   │   │   ├── usePrefersReducedMotion.ts
│   │   │   └── index.ts
│   │   ├── terminal/                       # Terminal/SSH components
│   │   │   ├── TerminalPanel.tsx
│   │   │   ├── TerminalEmptyState.tsx
│   │   │   ├── TerminalErrorScreen.tsx
│   │   │   ├── TerminalLoadingScreen.tsx
│   │   │   ├── TerminalPageHeader.tsx
│   │   │   ├── TerminalPromptLabel.tsx
│   │   │   ├── TerminalRule.tsx
│   │   │   ├── index.ts
│   │   │   └── __snapshots__/
│   │   ├── cyberpunk/                      # Cyberpunk-themed components
│   │   ├── __tests__/                      # Component tests
│   │   │   └── VPSDisksTab.test.tsx
│   │   ├── AppLayout.tsx                   # Main app shell with sidebar
│   │   ├── AppSidebar.tsx                  # Navigation sidebar
│   │   ├── PublicLayout.tsx                # Public page layout
│   │   ├── MarketingNavbar.tsx             # Public navigation bar
│   │   ├── MarketingFooter.tsx             # Public footer
│   │   ├── MarketingPageShell.tsx          # Marketing page wrapper
│   │   ├── Navigation.tsx                  # Navigation component
│   │   ├── NotificationDropdown.tsx        # Notification bell dropdown
│   │   ├── ActivityFeed.tsx                # Activity feed component
│   │   ├── AnnouncementBanner.tsx          # Top announcement banner
│   │   ├── BackToTopButton.tsx             # Scroll-to-top button
│   │   ├── Empty.tsx                       # Empty state component
│   │   ├── ErrorBoundary.tsx               # Error boundary wrapper
│   │   ├── FooterPartnerLinks.tsx          # Footer partner links
│   │   ├── GlobalTrackingScript.tsx        # Analytics tracking
│   │   ├── ImpersonationSidebarPanel.tsx   # Admin impersonation panel
│   │   ├── Logo.tsx                        # Brand logo component
│   │   ├── NotFound.tsx                    # 404 page component
│   │   ├── ScrollToTop.tsx                 # Route scroll reset
│   │   ├── VPSInfrastructureCard.tsx       # VPS infrastructure card
│   │   ├── nav-main.tsx                    # Main nav items
│   │   ├── nav-projects.tsx                # Project nav items
│   │   ├── nav-secondary.tsx               # Secondary nav items
│   │   └── nav-user.tsx                    # User menu nav
│   ├── pages/                              # Route page components
│   │   ├── admin/                          # Admin page sections
│   │   │   ├── AdminContactManagementSection.tsx
│   │   │   ├── AdminNetworkingSection.tsx
│   │   │   ├── AdminProvidersSection.tsx
│   │   │   ├── AdminServersSection.tsx
│   │   │   ├── AdminThemeSection.tsx
│   │   │   └── AdminUserDetail.tsx
│   │   ├── hosting-detail/                 # Hosting detail tabs
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
│   │   │   ├── SslTab.tsx
│   │   │   ├── WebTab.tsx
│   │   │   ├── WordPressTab.tsx
│   │   │   ├── ssl-tab/                    # SSL sub-components
│   │   │   │   ├── MailSslCard.tsx
│   │   │   │   └── mergeMailSslDomainLists.ts
│   │   │   └── web-tab/                    # Web sub-components (17 files)
│   │   │       ├── HtaccessIpRulesCard.tsx
│   │   │       ├── IoncubeRedisCard.tsx
│   │   │       ├── LsphpSettingsCard.tsx
│   │   │       ├── MetricsCard.tsx
│   │   │       ├── ModSecurityCard.tsx
│   │   │       ├── NginxCacheCard.tsx
│   │   │       ├── PhpErrorLogCard.tsx
│   │   │       ├── PhpExtensionsCard.tsx
│   │   │       ├── PhpIniEditorCard.tsx
│   │   │       ├── PhpSettingsCard.tsx
│   │   │       ├── RedisCard.tsx
│   │   │       ├── RewritesCard.tsx
│   │   │       ├── VhostEditorCard.tsx
│   │   │       ├── WebserverProfileCard.tsx
│   │   │       ├── WebsiteStatusCard.tsx
│   │   │       └── webserverTools.ts
│   │   ├── vps-detail/                     # VPS detail sub-components
│   │   │   ├── VPSDisksTab.tsx
│   │   │   └── VPSDisksTab.test.tsx
│   │   ├── VPSDetail/                      # VPS detail sub-components
│   │   │   ├── ActivityTab.tsx
│   │   │   ├── BackupsTab.tsx
│   │   │   ├── FirewallTab.tsx
│   │   │   ├── NetworkingTab.tsx
│   │   │   ├── NotesTab.tsx
│   │   │   ├── OverviewTab.tsx
│   │   │   └── types.ts
│   │   ├── AboutUs.tsx
│   │   ├── AcceptInvitation.tsx
│   │   ├── Activity.tsx
│   │   ├── Admin.tsx
│   │   ├── ApiDocs.tsx
│   │   ├── Billing.tsx
│   │   ├── BillingPaymentCancel.tsx
│   │   ├── BillingPaymentSuccess.tsx
│   │   ├── Blog.tsx
│   │   ├── BlogPost.tsx
│   │   ├── Contact.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Documentation.tsx
│   │   ├── EgressCredits.tsx
│   │   ├── FAQ.tsx
│   │   ├── ForgotPassword.tsx
│   │   ├── HomeRedesign.tsx               # Landing page
│   │   ├── Hosting.tsx
│   │   ├── HostingDetail.tsx
│   │   ├── HostingMarketing.tsx
│   │   ├── HostingStore.tsx
│   │   ├── InvoiceDetail.tsx
│   │   ├── Login.tsx
│   │   ├── Maintenance.tsx
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
│   │   ├── VPS.tsx                         # VPS list
│   │   └── VPSDetail.tsx                   # VPS detail view
│   ├── contexts/
│   │   ├── AuthContext.tsx                  # Authentication state + JWT
│   │   ├── ThemeContext.tsx                 # Theme management
│   │   ├── ImpersonationContext.tsx         # Admin impersonation state
│   │   └── BreadcrumbContext.tsx            # Navigation breadcrumbs
│   ├── hooks/                              # Reusable React hooks
│   │   ├── use-form-persistence.tsx
│   │   ├── use-lazy-loading.tsx
│   │   ├── use-mobile.tsx
│   │   ├── use-mobile-animations.tsx
│   │   ├── use-mobile-assets.tsx
│   │   ├── use-mobile-navigation.tsx
│   │   ├── use-mobile-performance.tsx
│   │   ├── use-orientation.tsx
│   │   ├── use-virtual-keyboard.tsx
│   │   ├── useCategoryMappings.ts
│   │   ├── useEnhanceAdmin.ts
│   │   ├── useHosting.ts
│   │   ├── useNotes.ts
│   │   ├── useSiteStatus.ts
│   │   └── useTheme.ts
│   ├── services/                           # Frontend API service wrappers
│   │   ├── adminEmailTemplateService.ts
│   │   ├── categoryMappingService.ts
│   │   ├── egressService.ts
│   │   ├── ipamService.ts
│   │   ├── notesService.ts
│   │   └── paymentService.ts
│   ├── lib/                                # Utility libraries
│   │   ├── api.ts                          # Axios API client + auto-logout
│   │   ├── utils.ts                        # General utilities (cn, etc.)
│   │   ├── apiDocsShared.tsx               # Shared API docs data/components
│   │   ├── apiDocsTryIt.ts                 # API docs try-it functionality
│   │   ├── apiRouteManifest.ts             # Auto-generated API route catalog
│   │   ├── billingUtils.ts                 # Billing calculation helpers
│   │   ├── brand.ts                        # Branding utilities
│   │   ├── breadcrumbs.ts                  # Breadcrumb helpers
│   │   ├── color.ts                        # Color utilities
│   │   ├── errorHandling.ts                # Frontend error handling
│   │   ├── formatters.ts                   # Number/date formatters
│   │   ├── hostingPlanFeatures.ts          # Hosting plan feature maps
│   │   ├── impersonationSession.ts         # Impersonation session helpers
│   │   ├── invoiceTheme.ts                 # Invoice PDF theming
│   │   ├── osGroupUtils.ts                 # OS grouping utilities
│   │   ├── providerErrors.ts               # Provider error mapping
│   │   ├── regionCoordinates.ts            # Region coordinate data
│   │   ├── runtimeBootstrap.ts             # Runtime bootstrap data
│   │   ├── timezones.ts                    # Timezone utilities
│   │   ├── validation.ts                   # Frontend validation helpers
│   │   ├── vpsLabelGenerator.ts            # VPS name/label generation
│   │   ├── vpsStepConfiguration.ts         # VPS wizard step config
│   │   ├── activeHoursUtils.ts             # Active hours calculation
│   │   ├── supportAdminTickets.ts          # Support admin ticket helpers
│   │   └── supportTicketDisplay.ts         # Ticket display utilities
│   ├── theme/
│   │   └── presets.ts                       # Theme preset definitions
│   ├── types/                              # TypeScript type definitions
│   │   ├── api.ts
│   │   ├── categoryMappings.ts
│   │   ├── contact.ts
│   │   ├── documentation.ts
│   │   ├── faq.ts
│   │   ├── notes.ts
│   │   ├── organizations.ts
│   │   ├── provider.ts
│   │   ├── react-table.d.ts
│   │   ├── support.ts
│   │   └── vps.ts
│   ├── styles/                             # Page-specific CSS
│   │   ├── auth.css
│   │   ├── dashboard.css
│   │   ├── home.css
│   │   └── terminal-fx.css
│   └── assets/
│       └── react.svg
│
├── lib/                                    # Shared workspace packages (pnpm)
│   ├── api-client-react/                   # TanStack Query hooks (Orval-generated)
│   │   ├── src/
│   │   │   ├── generated/
│   │   │   │   ├── api.ts                 # Generated API client functions
│   │   │   │   └── api.schemas.ts         # Generated schema types
│   │   │   ├── custom-fetch.ts            # Custom fetch wrapper
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── api-spec/                           # OpenAPI spec + Orval codegen
│   │   ├── openapi.yaml                   # OpenAPI 3.x specification
│   │   ├── orval.config.ts                # Orval codegen configuration
│   │   └── package.json
│   ├── api-zod/                            # Zod request/response schemas (generated)
│   │   ├── src/
│   │   │   ├── generated/
│   │   │   │   ├── api.ts                 # Generated Zod schemas
│   │   │   │   └── types/
│   │   │   │       ├── healthStatus.ts    # Health status schema
│   │   │   │       └── index.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── db/                                 # Drizzle ORM schema definitions
│       ├── src/
│       │   ├── schema/
│       │   │   └── index.ts               # Drizzle table definitions
│       │   └── index.ts                    # Query helpers
│       ├── drizzle.config.ts               # Drizzle Kit configuration
│       ├── package.json
│       └── tsconfig.json
│
├── migrations/                             # Sequential SQL migrations (72 files)
│   ├── 001_initial_schema.sql
│   ├── 002_relax_activity_logs_constraint.sql
│   ├── 003_remove_legacy_container_artifacts.sql
│   ├── ...                                 # (3–070 omitted for brevity)
│   ├── 071_create_blog.sql
│   └── 072_add_linode_platform_integration.sql
│
├── scripts/                                # Node.js utility scripts (37 files)
│   ├── lib/
│   │   └── database.js                     # Shared script DB helper
│   ├── run-migration.js                    # Apply pending migrations
│   ├── apply-single-migration.js           # Apply one migration file
│   ├── apply-stackscript-migration.js      # StackScript data migration
│   ├── reset-database.js                   # Interactive DB reset
│   ├── create-test-admin.js                # Create test admin user
│   ├── ensure-admin-user.js                # Ensure admin exists
│   ├── promote-to-admin.js                 # Promote user to admin
│   ├── update-admin-password.js            # Update admin password
│   ├── check-admin-users.js                # Verify admin users
│   ├── verify-admin-status.js              # Check admin status
│   ├── verify-env.js                       # Validate environment config
│   ├── verify-active-org-column.js         # Verify active org column
│   ├── generate-ssh-secret.js              # Generate SSH encryption key
│   ├── generate-encryption-key.js          # Generate AES encryption key
│   ├── generate-pwa-icons.js               # Generate PWA icon assets
│   ├── audit-api-docs.mjs                  # API docs coverage audit
│   ├── fix-api-docs.mjs                    # Fix API doc issues
│   ├── check-routes.mjs                    # Validate route registration
│   ├── check-platform-settings.js          # Check platform settings
│   ├── check-migration.js                  # Migration status check
│   ├── check-users-schema.js               # Verify users table schema
│   ├── check-vps-plans.js                  # Verify VPS plan data
│   ├── check-contact-methods-status.js     # Contact methods status
│   ├── clean-migration.js                  # Clean up migration state
│   ├── debug-admin-login.js                # Debug admin login issues
│   ├── fix-duplicates.js                   # Fix duplicate DB records
│   ├── fix-duplicates.mjs                  # Fix duplicates (ESM)
│   ├── fix-provider-encryption.js          # Re-encrypt provider tokens
│   ├── migrate-backup-pricing-data.js      # Backup pricing migration
│   ├── migrate-vps-plan-type-class.js      # VPS plan type migration
│   ├── migrate-vps-provider-data.js        # VPS provider data migration
│   ├── reseed-faq.js                       # Reseed FAQ content
│   ├── seed-branding.js                    # Seed brand configuration
│   ├── run-semgrep.js                      # Run Semgrep security scan
│   ├── update-theme-to-mono.js             # Migrate theme to mono
│   └── README.md                           # Scripts documentation
│
├── tests/
│   ├── e2e/                                # Playwright E2E tests
│   │   └── smoke.spec.ts                   # Smoke test suite
│   ├── security/                           # Security/isolation tests (20 files)
│   │   ├── README.md                       # Security test documentation
│   │   ├── admin-auth-coverage.test.ts
│   │   ├── admin-networking.test.ts
│   │   ├── animalSuffix.test.ts
│   │   ├── api-hardening.test.ts
│   │   ├── apiKeys.test.ts
│   │   ├── auth.test.ts
│   │   ├── blog-public.test.ts
│   │   ├── disks-isolation.test.ts
│   │   ├── hosting-org-isolation.test.ts
│   │   ├── linode-provider-networking.test.ts
│   │   ├── member-role-permissions.test.ts
│   │   ├── notes.test.ts
│   │   ├── notifications-isolation.test.ts
│   │   ├── payment-isolation.test.ts
│   │   ├── payments-org-guard.test.ts
│   │   ├── ssh-keys-isolation.test.ts
│   │   ├── volume-isolation.test.ts
│   │   ├── whitelabel-provider.test.ts
│   │   └── xss.test.ts
│   └── visual-regression/                  # Visual regression tests
│
├── public/                                 # Static assets
│   ├── favicon.svg                         # Brand favicon (logo source of truth)
│   ├── favicon.ico
│   ├── favicon-96x96.png
│   ├── apple-touch-icon.png
│   ├── og-default.png                      # Default Open Graph image
│   ├── pwa-192x192.png                     # PWA icons
│   ├── pwa-512x512.png
│   ├── web-app-manifest-192x192.png
│   ├── web-app-manifest-512x512.png
│   ├── site.webmanifest                    # PWA manifest
│   └── OpenCode Brand Assets/              # Brand asset files
│       ├── Logo/                           # (4 files: dark/light PNG+SVG)
│       ├── Wordmark/                       # (4 files: dark/light PNG+SVG)
│       └── Wordmark Simple/               # (4 files: dark/light PNG+SVG)
│
├── data/                                   # Static data files
│   ├── api-docs-audit-report.json
│   └── api-docs-incomplete.json
│
├── config/
│   └── mcporter.json
│
├── docs/                                   # Documentation
│   ├── README.md
│   ├── PWA_SETUP.md
│   ├── SECURITY.md
│   ├── coverage-baseline.md
│   ├── dependency-analysis.md
│   ├── dependency-review.md
│   ├── enhance-hosting-detail-coverage.md
│   ├── infrastructure-verification.md
│   ├── linode-coverage-matrix.md
│   ├── linode-feature-roadmap.md
│   ├── migration-verification.md
│   ├── notification-consolidation.md
│   ├── pre-release-verification.md
│   ├── production-checklist.md
│   ├── rollout-checklist.md
│   ├── volumes-user-flow.md
│   └── XSS_PROTECTION_SUMMARY.md
│
├── git-docs/                               # Prose documentation
│   ├── ARCHITECTURE.md
│   ├── BACKEND.md
│   ├── CODE_WIKI.md
│   ├── DATABASE.md
│   ├── DEPLOYMENT.md
│   ├── DEVELOPMENT.md
│   ├── FEATURES.md
│   ├── FRONTEND.md
│   ├── PROJECT_STRUCTURE.md                # This file
│   ├── SECURITY.md
│   └── TESTING.md
│
├── repo-docs/                              # Internal documentation
│   ├── ADMIN_COMPONENTS.md
│   ├── ADMIN_TROUBLESHOOTING.md
│   ├── ENVIRONMENT_VARIABLES.md
│   ├── enhance-integration.md
│   ├── enhance-oas3-api.yaml              # Enhance API spec (OAS 3)
│   ├── linode-openapi.json                # Linode API spec
│   └── shadcn-ui-docs/                    # shadcn/ui reference docs (~20 .mdx files)
│
├── uploads/                                # User uploads (blog images, etc.)
│   ├── blog/
│   └── documentation/
│
├── .github/                                # GitHub configuration
│   ├── agents/
│   │   └── Plan.agent.md
│   └── instructions/
│       ├── api-routes.instructions.md
│       ├── frontend.instructions.md
│       ├── migrations.instructions.md
│       └── tests.instructions.md
│
├── .opencode/                              # OpenCode configuration
│   ├── config.json
│   ├── package.json
│   ├── package-lock.json
│   ├── .gitignore
│   └── plugins/
│       └── emdash-notifications.js
│
├── .claude/                                # Claude Code configuration
│   ├── launch.json
│   └── settings.local.json
│
│                                          # Root configuration files
├── .env.example                            # Environment variable template
├── .gitignore
├── .npmrc
├── .nvmrc                                  # Node.js version (22.22.0)
├── .release
├── .vercelignore
├── .emdash.json
├── AGENTS.md                               # AI agent coding guidelines
├── CLAUDE.md                               # Claude Code development reference
├── GEMINI.md                               # Gemini development reference
├── LICENSE
├── README.md
├── egress-readme.md
├── IP-WALL-OF-SHAME.md
├── new_component.tsx
├── skills-lock.json
├── test-phpini.ts
├── index.html                              # Vite HTML entry point
├── package.json                            # Dependencies and scripts (npm)
├── package-lock.json                       # npm lockfile
├── pnpm-workspace.yaml                     # pnpm workspace config (lib/*)
├── pnpm-lock.yaml                          # pnpm lockfile for workspace packages
├── ecosystem.config.cjs                    # PM2 process configuration
├── vite.config.ts                          # Vite build configuration
├── vitest.config.ts                        # Vitest test configuration
├── playwright.config.ts                    # Playwright E2E configuration
├── tailwind.config.js                      # Tailwind CSS configuration
├── tsconfig.json                           # TypeScript configuration
├── tsconfig.base.json                      # Shared TypeScript base config
├── postcss.config.js                       # PostCSS configuration
├── eslint.config.js                        # ESLint flat config
├── biome.json                              # Biome linter config (no root script)
├── components.json                         # shadcn/ui component registry
├── nodemon.json                            # Nodemon dev configuration
├── vercel.json                             # Vercel deployment config
└── Procfile                                # Heroku process definition
```

## Key Statistics

| Area | Count |
|------|-------|
| SQL Migrations | 71 |
| API Route Files | ~100 |
| API Service Files | ~65 |
| shadcn/ui Components | ~50 |
| Security Tests | 20 |
| Utility Scripts | 37 |
| Lib Workspace Packages | 4 (`api-client-react`, `api-spec`, `api-zod`, `db`) |
| Hosting Detail Tabs | 15 |
| VPS Detail Tabs | 7 |
| Admin Sub-sections | 25+ |

## Excluded Directories

These directories exist but are excluded from the tree:
- `node_modules/` — npm/pnpm dependencies
- `dist/` — Vite build output
- `.git/` — Git repository data
- `artifacts/` — Build artifacts
- `attached_assets/` — Attached assets
- `plans/` — Planning documents
- `repo-docs/specs/` — Specification documents
