# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Start concurrent frontend (Vite) and backend (nodemon) development servers
- `npm run dev-up` - Kill ports 3001/5173 and start development servers
- `npm run client:dev` - Frontend only (Vite dev server on port 5173)
- `npm run server:dev` - Backend only (Express API on port 3001)
- `npm run build` - TypeScript check + Vite build for production
- `npm run test` - Run complete test suite with Vitest
- `npm run test:watch` - Run Vitest in watch mode for continuous testing
- `npm run lint` - ESLint validation
- `npm run check` - TypeScript type checking without emitting files
- `npm run preview` - Preview production build locally

### Database Management
- `npm run db:fresh` - Reset database and run all migrations
- `npm run db:reset` - Interactive database reset with confirmation
- `npm run db:reset:confirm` - Reset database without prompt
- `npm run seed:admin` - Create default admin user (admin@skypanelv2.com / admin123)
- `npm run seed:marketplace` - Seed PaaS marketplace templates
- `npm run db:seed` - Complete database seeding (admin + marketplace + worker discovery)

### PaaS Platform Setup
- `npm run paas:setup` - Install uncloud CLI, unregistry (docker pussh), and pack CLI
- `npm run paas:check` - Health check for PaaS dependencies and worker connectivity
- `npm run paas:discover` - Auto-discover and register worker nodes

### Production Deployment
- `npm run start` - Launch production Express server + Vite preview
- `npm run pm2:start` - Build and start with PM2 process manager
- `npm run pm2:reload` - Reload PM2 processes gracefully
- `npm run pm2:stop` - Stop PM2 processes
- `npm run pm2:list` - List PM2 processes

## Architecture Overview

SkyPanelV2 is a full-stack cloud service reseller billing panel with integrated PaaS capabilities:

### Frontend (`src/`)
- **React 18** SPA with TypeScript and Vite
- **shadcn/ui** component library with Tailwind CSS
- **TanStack Query** for server state management with optimistic updates
- **Zustand** for client state management
- **React Router v7** for routing with protected routes
- **React Hook Form + Zod** for form validation

### Backend (`api/`)
- **Express.js** REST API with ES modules
- **PostgreSQL** database with UUID primary keys
- **JWT authentication** with role-based access (admin/user)
- **Rate limiting** with tiered configuration (anonymous/authenticated/admin)
- **Comprehensive middleware** stack (CORS, helmet, validation)

### PaaS Integration
- **Cloud Native Buildpacks** via `pack` CLI for Heroku-like deployments
- **uncloud** for container orchestration and cluster management
- **unregistry** (docker pussh) for SSH-based image distribution
- **Multi-language support**: Auto-detection for Node.js, Python, Ruby, Go, Java, PHP, Rust
- **Multi-tenant security** with network and storage isolation

## Environment Configuration

Copy `.env.example` to `.env` and configure:

### Required for Development
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/skypanelv2
JWT_SECRET=your-super-secret-jwt-key-here
SSH_CRED_SECRET=your-32-character-encryption-key
ENCRYPTION_KEY=your-32-character-encryption-key
```

### External Services
```bash
# Cloud Provider (Linode/Akamai)
LINODE_API_TOKEN=your-linode-api-token

# Payment Processing
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=sandbox

# Email (SMTP2GO)
SMTP2GO_API_KEY=your-smtp2go-api-key
SMTP2GO_USERNAME=your-smtp2go-username
SMTP2GO_PASSWORD=your-smtp2go-password
```

### Rate Limiting Configuration
- Anonymous users: 200 requests per 15 minutes
- Authenticated users: 500 requests per 15 minutes
- Admin users: 1000 requests per 15 minutes

## Database Schema

### Core Tables
- `users`, `organizations` - User management with role-based access
- `vps_instances`, `vps_plans` - VPS hosting management
- `payment_transactions` - PayPal billing integration
- `support_tickets` - Customer support system

### PaaS Tables (migrations 004-018)
- `paas_worker_nodes` - Worker node provisioning and management with location assignments
- `paas_locations` - Datacenter locations for geographic organization of workers
- `paas_applications` - Application lifecycle and configuration
- `paas_app_ports` - Port mapping for application access
- `paas_app_env_vars` - Encrypted environment variable storage
- `paas_deployments` - Deployment history and logs
- `paas_pricing_plans` - Flexible pricing (monthly or per-resource)
- `paas_marketplace_templates` - One-click application templates
- `paas_services` - PaaS service definitions and configurations
- `paas_volumes` - Persistent storage management
- `paas_dns` - DNS zone and record management
- `paas_networking` - Network configuration and firewall rules
- `paas_ssh_keys` - SSH key management for PaaS services
- `paas_caddy` - Caddy reverse proxy configuration
- `paas_images` - Container image management
- `paas_applications` and `paas_deployments` - Application deployment management

All PaaS tables include tenant isolation with `organization_id` foreign keys.

## Key Service Patterns

### Database Operations
Use `api/lib/database.js` helper:
```typescript
import { query } from '../lib/database.js';
const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
```

### Authentication Middleware
Protected routes use JWT authentication:
```typescript
import { authenticateToken } from '../../middleware/auth.js';
router.use(authenticateToken); // Sets req.user
```

### Error Handling
Structured error responses:
```typescript
res.status(500).json({ error: error.message });
// or
res.json({ success: true, data: result });
```

### PaaS Service Architecture
- `uncloudService.ts` - Cluster and machine management
- `buildpackService.ts` - Buildpack-based application building
- `paasApplicationService.ts` - Application lifecycle (start/stop/delete)
- `paasWorkerService.ts` - Worker provisioning and health checks
- `paasLocationService.ts` - Datacenter location management for worker organization
- `paasService.ts` - Core PaaS service management
- `paasVolumeService.ts` - Persistent storage volume management
- `paasDnsService.ts` - DNS zone and record management
- `paasNetworkingService.ts` - Network configuration and firewall management
- `paasSshKeyService.ts` - SSH key management for PaaS services
- `paasCaddyService.ts` - Caddy reverse proxy configuration
- `paasImageService.ts` - Container image management
- `paasMarketplaceService.ts` - Marketplace template management
- `paasPricingService.ts` - Pricing plan management
- `paasDeploymentService.ts` - Deployment tracking and management

## PaaS Deployment Workflow

1. **Location Assignment**: Workers are organized by geographic datacenter locations via `paas_locations`
2. **Application Creation**: User provides Git repository URL and configuration
3. **Build Process**:
   - Clone repository to temporary directory
   - Auto-detect language using buildpacks
   - Build OCI image with `pack` CLI
4. **Deployment**:
   - Push image to workers via `docker pussh`
   - Deploy using `uc deploy` with docker-compose
   - Configure automatic HTTPS via uncloud's Caddy
   - Assign to specific datacenter locations for geographic distribution

### Supported Languages (Auto-detected)
- **Node.js** - `package.json`
- **Python** - `requirements.txt`, `Pipfile`, `pyproject.toml`
- **Ruby** - `Gemfile`
- **Go** - `go.mod`
- **Java** - `pom.xml`, `build.gradle`
- **PHP** - `composer.json`
- **Rust** - `Cargo.toml`

## Security Architecture

### Multi-tenant Isolation
- **Network Isolation**: Per-tenant Docker networks prevent cross-tenant communication
- **Storage Isolation**: Tenant-specific labeled volumes with access controls
- **Container Security**: Non-root users, read-only filesystems, capability dropping
- **Resource Quotas**: CPU, RAM, and storage limits per pricing plan

### Data Protection
- SSH credentials and API tokens encrypted at rest
- Environment variables stored with AES-256 encryption
- JWT tokens with configurable expiration
- Rate limiting with tiered access controls

## Known Issues & Critical Notes

### PaaS Implementation Status
The PaaS system includes comprehensive worker location management and service orchestration:

1. **Location Management**: New `paas_locations` table with `paasLocationService.ts` for geographic organization
2. **Worker Assignment**: Workers can be assigned to specific datacenter locations for better resource management
3. **Service Architecture**: Complete CRUD operations for locations, workers, services, volumes, DNS, networking, and more
4. **Enhanced CLI Integration**: Proper uncloud command patterns and service integration

**Recent Additions**:
- PaaS datacenter locations with full CRUD API (`/api/admin/paas/locations`)
- Worker location assignment and management
- Comprehensive PaaS service management (volumes, DNS, networking, SSH keys, Caddy, images)
- Enhanced marketplace and pricing management

### Browser Testing Required
Full end-to-end browser testing is essential for the PaaS functionality:
1. Admin worker provisioning flow
2. Complete client application deployment journey
3. Multi-tenant isolation verification
4. Application lifecycle management (start/stop/delete)

## Testing

### Test Architecture
- **Frontend**: Vitest + React Testing Library with jsdom environment
- **Backend**: Supertest for API endpoint testing
- **Test Setup**: Configuration in `src/test-setup.ts` with common mocks
- **Mock Strategy**: Comprehensive browser API mocking for component tests

### Running Tests
- `npm run test` - Run complete test suite once
- `npm run test:watch` - Continuous testing during development with file watching
- Test files use `.test.ts` or `.test.tsx` extensions

### Manual Testing Checklist
1. **Database Setup**: `npm run db:fresh && npm run seed:admin`
2. **PaaS Setup**: `npm run paas:setup`
3. **Admin Interface**:
   - Worker provisioning via admin dashboard
   - PaaS location management (`/api/admin/paas/locations`)
   - Service configuration (volumes, DNS, networking, etc.)
4. **Application Deployment**: Complete deployment flow in browser
5. **Multi-tenant Testing**: Verify organization isolation and permissions

### Default Credentials
- **Email**: `admin@skypanelv2.com`
- **Password**: `admin123`

## Project Structure

### Core Directories
```
├── api/                    # Express.js backend API
│   ├── routes/            # API route definitions (client/admin separation)
│   ├── services/          # Business logic and service layer
│   ├── middleware/        # Express middleware (auth, rate limiting, validation)
│   ├── config/           # Configuration management
│   └── lib/              # Database helpers and utilities
├── src/                   # React frontend SPA
│   ├── components/       # Reusable UI components (shadcn/ui based)
│   │   ├── ui/          # Base shadcn/ui components
│   │   ├── admin/       # Admin-specific components
│   │   └── layouts/     # Layout components
│   ├── pages/           # Page components with routing
│   ├── contexts/        # React contexts (Auth, Theme, Impersonation)
│   ├── services/        # API client services and data fetching
│   └── lib/            # Utility libraries and configurations
├── migrations/           # Sequential SQL migrations (001-018)
├── scripts/             # Node utilities for database, billing, and diagnostics
├── public/             # Static assets served by Vite
└── tests/              # Test files and utilities
```

### Key Architectural Patterns
- **Service Layer**: Business logic separated from route definitions in `api/services/`
- **Database Helper**: Consistent query execution via `api/lib/database.js`
- **React Context**: Global state management (Auth, Theme, Impersonation)
- **TanStack Query**: Server state management with optimistic updates
- **Protected Routes**: Role-based access control throughout the application

## Utility Scripts

### Database & Migration Scripts
- `node scripts/generate-ssh-secret.js` - Generate SSH_CRED_SECRET for .env file
- `node scripts/run-migration.js` - Apply pending database migrations
- `node scripts/test-connection.js` - Verify PostgreSQL connectivity
- `node scripts/reset-database.js` - Interactive database reset with confirmation

### Admin & System Scripts
- `node scripts/create-test-admin.js` - Create admin user with custom credentials
- `node scripts/promote-to-admin.js` - Elevate existing user to admin role
- `node scripts/update-admin-password.js` - Rotate admin passwords
- `node scripts/test-smtp.js` - Send SMTP2GO test email

### Development & Diagnostics
- `node scripts/test-hourly-billing.js` - Dry-run hourly billing workflow
- `node scripts/discover-workers.js` - Auto-discover and register PaaS workers
- `node scripts/paas-health-check.js` - Check PaaS dependencies and connectivity