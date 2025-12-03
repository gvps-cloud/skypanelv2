# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Core Development Workflow
- `npm run dev` - Start both frontend (Vite on port 5173) and backend (Express on port 3001) with hot reload
- `npm run client:dev` - Frontend only (useful for focused frontend debugging)
- `npm run server:dev` - Backend only (useful for API development)
- `npm run dev-up` - Kill ports 3001/5173 and start dev servers (recovery from port conflicts)
- `npm run kill-ports` - Free ports 3001 and 5173 when needed

### Testing & Quality Assurance
- `npm run test` - Run complete Vitest test suite once
- `npm run test:watch` - Continuous testing with file watching (recommended during development)
- `npm run lint` - ESLint validation for code quality
- `npm run check` - TypeScript type checking without compilation

### Database Operations
- `npm run db:fresh` - Reset database and run all migrations (destructive)
- `npm run db:reset` - Interactive database reset with confirmation prompt
- `npm run seed:admin` - Create default admin user (admin@skypanelv2.com / admin123)
- `node scripts/run-migration.js` - Apply pending migrations sequentially
- `node scripts/test-connection.js` - Verify PostgreSQL connectivity

### Production Deployment
- `npm run build` - TypeScript check + Vite production build
- `npm run start` - Launch production server (Express + Vite preview)
- `npm run pm2:start` - Build and start with PM2 process manager
- `npm run pm2:reload` - Gracefully reload PM2 processes
- `npm run pm2:stop` - Stop PM2 processes

### Utility Scripts
- `node scripts/generate-ssh-secret.js` - Generate SSH_CRED_SECRET for .env file
- `node scripts/promote-to-admin.js --email user@example.com` - Elevate user to admin role
- `node scripts/update-admin-password.js --email admin@example.com --password newpass` - Rotate admin passwords
- `node scripts/test-smtp.js` - Send SMTP2GO test email
- `node scripts/test-hourly-billing.js` - Dry-run hourly billing workflow

## Architecture Overview

### High-Level System Design
SkyPanelV2 is a white-label cloud service billing panel for VPS hosting providers. The system follows a modern full-stack architecture:

**Frontend → API Gateway → Service Layer → Provider Abstraction → External APIs**

### Backend Architecture (`api/`)

#### Server Initialization Flow
1. `api/server.ts` - Entry point that boots Express app from `api/app.ts`
2. Initializes SSH WebSocket bridge on the same HTTP server
3. Starts hourly billing scheduler (runs every 60 minutes)
4. Handles SIGTERM/SIGINT for graceful shutdown

#### Application Structure (`api/app.ts`)
- Express app with comprehensive middleware stack (helmet, CORS, rate limiting)
- Route mounting pattern separates client and admin endpoints
- Global error handler with dev/production mode distinction
- Serves frontend static files in production mode

#### Core Service Patterns
The backend follows a **service-oriented architecture** with clear separation of concerns:

**Routes (`api/routes/`)** - HTTP endpoint definitions with validation
- Thin controllers that delegate to service layer
- Separate `api/routes/admin/` for administrative endpoints
- Consistent error handling and response formatting

**Services (`api/services/`)** - Business logic and external integrations
- `billingService.ts` - Automated hourly VPS billing with atomic transactions
- `sshBridge.ts` - WebSocket bridge for SSH console access (uses ssh2 library)
- `paypalService.ts` - PayPal REST SDK integration for wallet top-ups
- `linodeService.ts` - Linode/Akamai API integration
- `notificationService.ts` - PostgreSQL LISTEN/NOTIFY for real-time updates
- `activityLogger.ts` - Comprehensive audit trail for system activities

**Provider Abstraction (`api/services/providers/`)** - Multi-provider VPS management
- `IProviderService.ts` - Interface contract for provider capabilities
- `LinodeProviderService.ts` - Linode API implementation behind abstraction
- `ProviderFactory.ts` - Factory pattern for provider instantiation
- `errorNormalizer.ts` - Converts provider errors to consistent shape
- Token encryption/decryption handled transparently

**Database Layer (`api/lib/database.ts`)** - PostgreSQL query execution
- Exports `query()` and `transaction()` helpers
- Connection pooling with proper error handling
- Transaction support for atomic operations (critical for billing)

**Middleware (`api/middleware/`)**
- `auth.ts` - JWT authentication, sets `req.user` on protected routes
- `rateLimiting.ts` - Smart tiered rate limiting (anonymous/authenticated/admin)
- `security.ts` - Additional security headers and validation

#### Critical Backend Flows

**Hourly Billing Process**
1. Scheduled by `setInterval()` in `api/server.ts` (runs every hour)
2. `billingService.runHourlyBilling()` queries active VPS instances
3. For each instance: calculates hours since last billing, charges wallet atomically
4. Uses database transactions to ensure wallet balance consistency
5. Logs activity and creates billing records in `payment_transactions`

**SSH Console Bridge**
1. WebSocket connection initiated to `/api/vps/:id/ssh?token=JWT`
2. `sshBridge.ts` validates JWT, verifies VPS ownership
3. Resolves IP address (from database or Linode API)
4. Decrypts stored SSH password using `crypto.ts`
5. Establishes SSH2 connection and pipes terminal I/O over WebSocket

**Real-Time Notifications**
1. Backend triggers PostgreSQL NOTIFY on relevant events
2. `notificationService.ts` maintains LISTEN connection pool
3. Server-Sent Events (SSE) endpoint streams to frontend
4. Frontend maintains persistent SSE connection for live updates

### Frontend Architecture (`src/`)

#### Application Structure
- **React 18** SPA with TypeScript and strict mode
- **React Router v7** for routing with protected routes
- **TanStack Query v5** for server state management with optimistic updates
- **Zustand** for client state (UI preferences, session data)
- **React Context** for cross-cutting concerns (Auth, Theme, Impersonation)

#### Component Organization
```
src/components/
├── ui/              # Base shadcn/ui components (Button, Dialog, etc.)
├── admin/           # Admin-specific components and modals
├── layouts/         # Layout components (PageHeader, ContentCard, StatsGrid)
├── VPS/             # VPS management components (CreateVPSSteps, SSHTerminal)
├── billing/         # Billing components (PayPalCheckoutDialog)
├── support/         # Support ticket components
└── [feature]/       # Other feature-specific components
```

#### State Management Strategy
**Server State (TanStack Query)**
- API calls wrapped with `useQuery` and `useMutation` hooks
- Optimistic updates for instant UI feedback
- Automatic cache invalidation and refetching
- Example: VPS list, user data, billing info

**Client State (Zustand)**
- UI preferences (sidebar collapse, filters)
- Temporary form data
- Non-persisted session state

**Context API**
- `AuthContext` - User authentication state and JWT token management
- `ThemeContext` - Dark/light mode with system preference detection
- `ImpersonationContext` - Admin user impersonation state

#### Critical Frontend Patterns

**API Communication (`src/lib/api.ts`)**
- All API calls route through centralized service modules
- Automatic JWT token injection via `getAuthHeaders()`
- Consistent error handling and response normalization
- Base URL resolution from `VITE_API_URL` environment variable

**Form Validation (`src/lib/validation.ts`)**
- Comprehensive validation system with real-time feedback
- Pattern matching for emails, UUIDs, slugs, SSH keys
- Custom validation rules with descriptive error messages
- Validation schemas for all admin forms (organization CRUD, user management)
- Supports SSH key format validation (RSA, Ed25519, ECDSA, DSS)

**Admin Modal System (`src/components/admin/`)**
Enhanced organization management with comprehensive modal-based UI:
- `OrganizationCreateModal` - Real-time user search, auto-slug generation
- `OrganizationEditModal` - Pre-populated forms with change detection
- `OrganizationDeleteDialog` - Safe deletion with exact name confirmation
- `MemberAddModal` - Advanced user search with membership status indicators
- `MemberEditModal` - Role management with ownership transfer capabilities
- `MemberRemoveDialog` - Safe member removal with owner protection

All modals include:
- Real-time validation with form field-level error feedback
- Loading states during API operations
- Comprehensive error handling with user-friendly messages
- Optimistic UI updates for instant perceived performance

### Database Schema Architecture

#### Core Tables
- `users` - User accounts with role-based access (admin/user)
- `organizations` - Multi-tenant organization support
- `organization_members` - Many-to-many user-organization relationships with roles
- `wallets` - Prepaid wallet system for billing
- `vps_instances` - VPS instance tracking with provider_instance_id mapping
- `vps_plans` - Available VPS plans with pricing
- `payment_transactions` - Billing and payment history
- `support_tickets` + `support_ticket_replies` - Support ticket system

#### Migration Strategy
- Versioned SQL migrations in `migrations/` directory
- Applied sequentially by `scripts/run-migration.js`
- Tracks applied migrations in `schema_migrations` table
- Supports rollback for development environments

### Testing Architecture

#### Test Setup
- **Vitest** with jsdom environment for frontend tests
- **React Testing Library** for component testing with user-centric queries
- **Supertest** for backend API integration tests
- **Test setup** in `src/test-setup.ts` with common mocks (localStorage, IntersectionObserver)

#### Test Coverage Areas
- Form validation logic (`src/lib/validation.ts`)
- Admin modal components (organization CRUD, member management)
- API integration with mocked responses
- User interaction flows (clicks, form submissions, modal state)
- Error scenarios (network failures, validation errors)

#### Testing Best Practices
- Co-locate test files with source code (`*.test.ts` or `*.test.tsx`)
- Use deterministic fixtures over network calls
- Mock external dependencies (sonner, validation libraries)
- Test user interactions, not implementation details

## Critical Development Patterns

### Provider Abstraction Flow
1. API route resolves provider record from `service_providers` table
2. Token normalized via `normalizeProviderToken()` in `api/lib/providerTokens.ts`
3. `ProviderFactory.createProvider('linode', token)` returns `LinodeProviderService`
4. Service methods: `createInstance()`, `getInstance()`, `performAction()`, etc.
5. Responses normalized before persisting or returning to client
6. Errors normalized via `errorNormalizer.ts` for consistent error handling

### Authentication & Authorization
**JWT Token Flow**
1. User logs in via `/api/auth/login`
2. Backend generates JWT with `userId`, `email`, `role`
3. Frontend stores token in localStorage
4. All API requests include `Authorization: Bearer <token>` header
5. `authenticateToken` middleware validates and sets `req.user`

**Role-Based Access**
- Routes protected with `authenticateToken` middleware
- Admin routes additionally check `req.user.role === 'admin'`
- Frontend routes protected with `ProtectedRoute` component
- Impersonation system allows admin to act as another user

### Billing System Architecture
**Atomic Wallet Operations**
- All wallet operations must use `transaction()` from `database.ts`
- Lock wallet row with `SELECT ... FOR UPDATE` to prevent race conditions
- Update balance and create transaction record in same transaction
- Rollback on any failure to maintain consistency

**Hourly Billing Cycle**
1. Query all VPS instances with status in ('running', 'provisioning')
2. Calculate hours since `last_billed_at` (or `created_at` if never billed)
3. Charge: `hours * hourly_rate` (includes backup pricing if enabled)
4. Deduct from wallet atomically
5. Update `last_billed_at` timestamp
6. Log activity and create payment transaction record

### Real-Time Features
**Server-Sent Events (SSE)**
- Endpoint: `/api/notifications/stream`
- Backend maintains persistent SSE connections per user
- PostgreSQL NOTIFY triggers push notifications
- Frontend reconnects automatically on disconnect

**WebSocket SSH Console**
- Endpoint: `/api/vps/:id/ssh?token=JWT&rows=30&cols=120`
- Bidirectional communication for terminal I/O
- Messages: `{type: 'input'|'output'|'resize'|'error'|'connected'|'close'}`
- Terminal resizing supported via resize messages

## Environment Configuration

### Required Environment Variables
Copy `.env.example` to `.env` and configure:

**Core Application**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing (32+ characters)
- `SSH_CRED_SECRET` - AES-256 encryption key for provider tokens (generate with script)
- `ENCRYPTION_KEY` - Alternative encryption key for sensitive data
- `PORT` - Backend server port (default: 3001)

**External Services**
- `LINODE_API_TOKEN` - Linode/Akamai API token
- `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` - PayPal REST credentials
- `PAYPAL_MODE` - 'sandbox' or 'live'
- `SMTP2GO_API_KEY` / `SMTP2GO_USERNAME` / `SMTP2GO_PASSWORD` - Email service

**White-Label Branding**
- `COMPANY_NAME` / `VITE_COMPANY_NAME` - Company name for branding
- `COMPANY_BRAND_NAME` - Alternative brand name

**Rate Limiting**
- `RATE_LIMIT_ANON` - Anonymous user rate limit (default: 200/15min)
- `RATE_LIMIT_AUTH` - Authenticated user rate limit (default: 500/15min)
- `RATE_LIMIT_ADMIN` - Admin rate limit (default: 1000/15min)

### Frontend Environment Variables
Variables prefixed with `VITE_` are exposed to frontend:
- `VITE_API_URL` - API base URL (default: '/api' for same-origin)
- `VITE_COMPANY_NAME` - Company name for frontend branding

## Common Development Tasks

### Adding a New API Endpoint
1. Create route handler in `api/routes/` or `api/routes/admin/`
2. Add business logic to appropriate service in `api/services/`
3. Use `authenticateToken` middleware for protected routes
4. Follow existing error handling patterns (try/catch with status codes)
5. Update API documentation if applicable

### Creating a New Admin Modal
1. Create modal component in `src/components/admin/`
2. Add validation schema in `src/lib/validation.ts`
3. Use `useQuery` for data fetching, `useMutation` for updates
4. Include loading states, error handling, and optimistic updates
5. Write comprehensive tests in `__tests__/` subdirectory

### Database Schema Changes
1. Create new migration file in `migrations/` (sequential numbering)
2. Test migration with `node scripts/run-migration.js`
3. Update TypeScript types if adding new tables/columns
4. Consider adding indexes for frequently queried columns
5. Update seed data if necessary

## Troubleshooting Guide

### Port Conflicts
**Symptom**: "Port 3001 or 5173 already in use"
**Solution**: Run `npm run kill-ports` before starting dev servers

### Database Connection Issues
**Symptom**: "Connection refused" or "Could not connect to database"
**Solution**: 
1. Verify PostgreSQL is running
2. Check `DATABASE_URL` in `.env`
3. Run `node scripts/test-connection.js` to diagnose

### Build Failures
**Symptom**: TypeScript errors during build
**Solution**:
1. Run `npm run check` to see type errors
2. Run `npm run lint` to check ESLint issues
3. Ensure all dependencies are installed (`npm install`)

### Test Failures
**Symptom**: Vitest tests failing
**Solution**:
1. Check if tests are properly mocked (see `src/test-setup.ts`)
2. Verify test environment variables in `vitest.config.ts`
3. Run `npm run test:watch` to debug specific test failures

### SSH Console Not Working
**Symptom**: SSH terminal connection fails
**Solution**:
1. Verify VPS has valid IP address
2. Check SSH credentials are properly encrypted in database
3. Ensure WebSocket connection is not blocked by proxy/firewall
4. Check browser console for WebSocket error messages

### Admin User Management Errors
**Symptom**: User detail page shows errors or fails to load
**Solution**:
1. Verify user ID is valid UUID format
2. Check admin authentication token is valid
3. Review AdminUserDetail component error handling
4. Check network tab for API response errors

### Organization Management Issues
**Symptom**: Organization CRUD operations fail
**Solution**:
1. Ensure admin role authentication
2. Verify organization name/slug uniqueness for edits
3. Check validation errors in modal forms
4. Review member management for ownership conflicts

### Form Validation Not Working
**Symptom**: Real-time validation not showing errors
**Solution**:
1. Check validation schemas in `src/lib/validation.ts`
2. Ensure form fields have proper `name` attributes
3. Verify validation patterns match expected format
4. Review browser console for validation errors

## Code Style & Conventions

### TypeScript Patterns
- Use ES modules (`import`/`export`) throughout
- Prefer `interface` over `type` for object shapes
- Use `type` for unions, intersections, utility types
- Enable strict mode in `tsconfig.json`

### Naming Conventions
- Components: PascalCase (e.g., `AdminUserDetail.tsx`)
- Hooks: `useX` prefix (e.g., `useAuth.ts`)
- Services: camelCase with Service suffix (e.g., `billingService.ts`)
- Constants: UPPER_SNAKE_CASE

### Import Alias
Use `@/` alias for `src/` imports:
```typescript
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
```

### Error Handling Patterns
**Backend**:
```typescript
try {
  const result = await someOperation();
  res.json({ success: true, data: result });
} catch (error) {
  console.error('Operation failed:', error);
  res.status(500).json({ error: error.message });
}
```

**Frontend**:
```typescript
const mutation = useMutation({
  mutationFn: async (data) => await api.post('/endpoint', data),
  onSuccess: () => {
    toast.success('Operation successful');
    queryClient.invalidateQueries(['cache-key']);
  },
  onError: (error) => {
    toast.error(error.message || 'Operation failed');
  }
});
```

## Security Considerations

### Token Encryption
- Provider API tokens stored encrypted in database using AES-256
- Use `encryptSecret()` and `decryptSecret()` from `api/lib/crypto.ts`
- SSH_CRED_SECRET must be 32 characters (256 bits)

### Rate Limiting
- Configured in `api/middleware/rateLimiting.ts`
- Tiered limits based on user authentication level
- Bypass available for admin health checks

### SQL Injection Prevention
- Always use parameterized queries: `query('SELECT * FROM users WHERE id = $1', [userId])`
- Never concatenate user input into SQL strings

### XSS Prevention
- React escapes JSX content by default
- Helmet middleware adds security headers
- Validate and sanitize user input on backend

## Resources

### Documentation
- **API Documentation**: `api-docs/` directory
- **Environment Variables**: `repo-docs/ENVIRONMENT_VARIABLES.md`
- **Provider System**: `api/services/providers/README.md`
- **Organization API**: `api-docs/admin/organizations.md`

### External Dependencies
- **React**: https://react.dev/
- **Vite**: https://vitejs.dev/
- **TanStack Query**: https://tanstack.com/query/latest
- **shadcn/ui**: https://ui.shadcn.com/
- **Linode API**: https://www.linode.com/docs/api/
- **PayPal SDK**: https://developer.paypal.com/

### Project-Specific Notes
- Default admin credentials: `admin@skypanelv2.com` / `admin123` (change in production!)
- Billing runs hourly starting 5 seconds after server boot
- SSH console requires JWT token in WebSocket query string
- Organization slug must be unique and lowercase with hyphens only
- All UUIDs are v4 format (use `uuid_generate_v4()` in PostgreSQL)
