# Project Structure

## Root Organization

```
├── api/              # Backend Express application
├── src/              # Frontend React application
├── migrations/       # Database schema migrations
├── scripts/          # Utility scripts for operations
├── public/           # Static assets (favicon, logo)
├── repo-docs/        # Feature documentation and API references
├── dist/             # Production build output (generated)
└── node_modules/     # Dependencies (generated)
```

## Backend Structure (`api/`)

```
api/
├── app.ts                    # Express app configuration and middleware setup
├── server.ts                 # Server entry point with SSH bridge and billing scheduler
├── index.ts                  # Serverless entry point (Vercel)
├── config/
│   └── index.ts              # Configuration management and validation
├── lib/                      # Shared utilities
│   ├── database.ts           # PostgreSQL query helpers and transactions
│   ├── crypto.ts             # Encryption for provider API tokens
│   ├── validation.ts         # Request validation helpers
│   ├── errorHandling.ts      # Error handling utilities
│   ├── security.ts           # Security utilities
│   └── provider*.ts          # Provider-specific helpers
├── middleware/
│   ├── auth.ts               # JWT authentication middleware
│   ├── rateLimiting.ts       # Smart rate limiting (anonymous/user/admin)
│   └── security.ts           # Security headers and validation
├── routes/                   # API route handlers
│   ├── auth.js               # Authentication endpoints
│   ├── vps.js                # VPS management
│   ├── payments.js           # PayPal and wallet
│   ├── admin.js              # Admin operations
│   ├── support.js            # Support tickets
│   └── admin/                # Admin-specific routes
│       ├── contact.js        # Contact method management
│       └── platform.js       # Platform settings
├── services/                 # Business logic layer
│   ├── authService.ts        # Authentication logic
│   ├── billingService.ts     # Hourly billing automation
│   ├── linodeService.ts      # Linode API integration
│   ├── paypalService.ts      # PayPal integration
│   ├── emailService.ts       # Email notifications
│   ├── invoiceService.ts     # Invoice generation
│   ├── sshBridge.ts          # WebSocket SSH bridge
│   ├── notificationService.ts # Real-time notifications (SSE)
│   ├── activityLogger.ts     # Activity audit logging
│   └── providers/            # Provider abstraction layer
│       ├── IProviderService.ts        # Provider interface
│       ├── BaseProviderService.ts     # Base implementation
│       ├── LinodeProviderService.ts   # Linode implementation
│       ├── ProviderFactory.ts         # Provider factory
│       └── errorNormalizer.ts         # Error normalization
```

## Frontend Structure (`src/`)

```
src/
├── main.tsx                  # React app entry point
├── App.tsx                   # Root component with routing and providers
├── index.css                 # Global styles and Tailwind imports
├── components/
│   ├── AppLayout.tsx         # Main authenticated layout with sidebar
│   ├── AppSidebar.tsx        # Sidebar navigation component
│   ├── Navigation.tsx        # Top navigation bar
│   ├── PublicLayout.tsx      # Public pages layout
│   ├── admin/                # Admin-specific components
│   │   ├── OrganizationManagement.tsx  # Organization CRUD
│   │   ├── OrganizationCreateModal.tsx # Create org modal
│   │   ├── OrganizationEditModal.tsx   # Edit org modal
│   │   ├── MemberAddModal.tsx          # Add member modal
│   │   ├── MemberEditModal.tsx         # Edit member modal
│   │   ├── UserProfileModal.tsx        # User detail modal
│   │   ├── ImpersonationBanner.tsx     # Impersonation UI
│   │   └── ...                         # Other admin components
│   ├── VPS/                  # VPS management components
│   │   ├── CreateVPSSteps.tsx          # Multi-step VPS creation
│   │   ├── VpsTable.tsx                # VPS list table
│   │   ├── SSHTerminal.tsx             # Browser SSH terminal
│   │   └── ...
│   ├── billing/              # Billing components
│   ├── support/              # Support ticket components
│   ├── ui/                   # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   └── ...               # Radix UI-based components
│   └── data-table/           # Reusable table components
├── contexts/
│   ├── AuthContext.tsx       # Authentication state and user info
│   ├── ThemeContext.tsx      # Theme management (dark/light)
│   ├── ImpersonationContext.tsx # Admin impersonation state
│   └── BreadcrumbContext.tsx # Breadcrumb navigation
├── hooks/                    # Custom React hooks
│   ├── use-mobile.tsx        # Mobile detection
│   ├── use-form-persistence.tsx # Form state persistence
│   └── ...
├── lib/                      # Utilities and helpers
│   ├── api.ts                # API client with auth headers
│   ├── validation.ts         # Form validation schemas (Zod)
│   ├── utils.ts              # General utilities (cn, etc.)
│   ├── brand.ts              # White-label branding helpers
│   ├── billingUtils.ts       # Billing calculations
│   ├── errorHandling.ts      # Error handling utilities
│   └── ...
├── pages/                    # Route page components
│   ├── Home.tsx              # Public landing page
│   ├── Login.tsx             # Login page
│   ├── Register.tsx          # Registration page
│   ├── Dashboard.tsx         # User dashboard
│   ├── VPS.tsx               # VPS list page
│   ├── VPSDetail.tsx         # VPS detail page
│   ├── Billing.tsx           # Billing page
│   ├── Support.tsx           # Support tickets
│   ├── Admin.tsx             # Admin dashboard
│   ├── admin/
│   │   └── AdminUserDetail.tsx # Admin user detail page
│   └── ...
├── services/
│   └── paymentService.ts     # Payment-related API calls
├── types/                    # TypeScript type definitions
│   ├── vps.ts
│   ├── provider.ts
│   ├── contact.ts
│   └── ...
└── theme/
    └── presets.ts            # Theme color presets
```

## Key Conventions

### Backend

- **ESM modules**: All imports use `.js` extension even for `.ts` files
- **Service layer**: Business logic in `services/`, routes are thin controllers
- **Database access**: Use `api/lib/database.ts` helpers, never raw `pg` in routes
- **Error handling**: Centralized error middleware in `app.ts`
- **Provider abstraction**: All provider interactions through `services/providers/`
- **Activity logging**: Use `activityLogger.ts` for audit trails

### Frontend

- **Path alias**: Use `@/` for imports from `src/` (e.g., `@/components/ui/button`)
- **API calls**: Route through `src/lib/api.ts` for consistent auth headers
- **State management**: TanStack Query for server state, Zustand for client state
- **Form validation**: Zod schemas in `src/lib/validation.ts`
- **Component structure**: shadcn/ui components in `components/ui/`
- **Route protection**: `ProtectedRoute` for authenticated, `AdminRoute` for admin-only
- **Styling**: Tailwind CSS with custom theme variables in `index.css`

### Database

- **Migrations**: Versioned SQL files in `migrations/` (e.g., `001_initial_schema.sql`)
- **Apply migrations**: `node scripts/run-migration.js`
- **Transactions**: Use `transaction()` helper for atomic operations

### Scripts

- **Naming**: Kebab-case (e.g., `create-test-admin.js`)
- **Purpose**: Database operations, admin utilities, testing, diagnostics
- **Location**: All operational scripts in `scripts/` directory
