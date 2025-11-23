# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Start concurrent frontend (Vite) and backend (nodemon) development servers
- `npm run build` - TypeScript check + Vite build for production
- `npm run test` - Run complete test suite with Vitest
- `npm run lint` - ESLint validation
- `npm run check` - TypeScript type checking without emitting files

### Database Management
- `npm run db:fresh` - Reset database and run all migrations
- `npm run seed:admin` - Create default admin user (admin@skypanelv2.com / admin123)
- `npm run db:seed` - Complete database seeding (admin + marketplace + worker discovery)
- `npm run db:reset` - Interactive database reset with confirmation

### PaaS Platform Setup
- `npm run paas:setup` - Install uncloud CLI, unregistry (docker pussh), and pack CLI
- `npm run paas:check` - Health check for PaaS dependencies and worker connectivity
- `npm run paas:discover` - Auto-discover and register worker nodes

### Production Deployment
- `npm run pm2:start` - Build and start with PM2 process manager
- `npm run pm2:reload` - Reload PM2 processes gracefully
- `npm run pm2:stop` - Stop PM2 processes

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

### PaaS Tables (migrations 004-016)
- `paas_worker_nodes` - Worker node provisioning and management
- `paas_applications` - Application lifecycle and configuration
- `paas_app_ports` - Port mapping for application access
- `paas_app_env_vars` - Encrypted environment variable storage
- `paas_deployments` - Deployment history and logs
- `paas_pricing_plans` - Flexible pricing (monthly or per-resource)
- `paas_marketplace_templates` - One-click application templates

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

## PaaS Deployment Workflow

1. **Application Creation**: User provides Git repository URL and configuration
2. **Build Process**:
   - Clone repository to temporary directory
   - Auto-detect language using buildpacks
   - Build OCI image with `pack` CLI
3. **Deployment**:
   - Push image to workers via `docker pussh`
   - Deploy using `uc deploy` with docker-compose
   - Configure automatic HTTPS via uncloud's Caddy

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
The PaaS system has **critical implementation issues** that need immediate attention:

1. **Incorrect uncloud Commands**: Service implementations use wrong command syntax
   - Use `uc deploy` instead of `uc service deploy`
   - Use `uc machine add` instead of `uc machine addMachineToCluster`
   - Port publishing requires `x-ports` extension, not standard `ports`

2. **Port Format Issues**: Current port mapping format incompatible with uncloud

3. **Missing Validation**: Services don't validate against real uncloud API responses

**Priority**: Fix PaaS service implementations before attempting real deployments.

### Browser Testing Required
Full end-to-end browser testing is essential for the PaaS functionality:
1. Admin worker provisioning flow
2. Complete client application deployment journey
3. Multi-tenant isolation verification
4. Application lifecycle management (start/stop/delete)

## Testing

### Unit Tests
- Frontend: Vitest + React Testing Library
- Backend: Supertest for API endpoint testing
- Run with: `npm run test`

### Manual Testing Checklist
1. Database setup: `npm run db:fresh && npm run seed:admin`
2. PaaS setup: `npm run paas:setup`
3. Worker provisioning via admin dashboard
4. Complete deployment flow in browser

### Default Credentials
- Email: `admin@skypanelv2.com`
- Password: `admin123`