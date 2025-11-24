# SkyPanelV2 Context for Gemini

## Project Overview
SkyPanelV2 is an open-source cloud service billing panel and PaaS platform. It acts as a white-label control plane for cloud hosting businesses, enabling them to offer VPS hosting (via Linode/Akamai) and PaaS application deployment (via Uncloud).

### Tech Stack

**Frontend (`/src`):**
*   **Framework:** React 18 + Vite 6
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS 3.4 + shadcn/ui
*   **State:** TanStack Query (Server) + Zustand (Client)
*   **Routing:** React Router 7
*   **Forms:** React Hook Form + Zod

**Backend (`/api`):**
*   **Runtime:** Node.js 20+ (ES Modules)
*   **Framework:** Express 4.21
*   **Language:** TypeScript (executed via `tsx` in dev)
*   **Database:** PostgreSQL (via `pg` driver)
*   **Real-time:** WebSockets (`ws`) + SSE

**PaaS Infrastructure:**
*   **Core:** `uncloud` (Orchestration), `unregistry` (Docker Registry)
*   **Builds:** Cloud Native Buildpacks (`pack` CLI)
*   **Isolation:** Docker networks/volumes per tenant

## Scripts Directory (`/scripts`)

The `scripts` directory is the operational heart of the project, containing tools for database management, PaaS infrastructure setup, and system health checks.

### 1. PaaS Infrastructure Setup
These scripts automate the installation of the required CLI tools for the PaaS features.
*   `install-uncloud.js`: Downloads and installs the `uc` CLI (supports Linux/macOS).
*   `install-pack.js`: Installs the Cloud Native Buildpacks `pack` CLI.
*   `install-unregistry.js`: Installs the Docker `pussh` plugin for the internal registry.
*   `install-docker-compose.js`: Helper to ensure Docker Compose is available.

### 2. Health & Diagnostics
*   `paas-health-check.js`: The master diagnostic tool. Checks:
    *   Node.js & npm versions.
    *   Docker & Docker Compose status.
    *   PaaS dependencies (`uc`, `pack`, `pussh`).
    *   PostgreSQL connection.
*   `check-workers.js`: Lists registered PaaS worker nodes from the database.
*   `verify-paas-api.js`: Tests the connectivity of the PaaS API endpoints.

### 3. Database Management
*   **Reset & Seed:**
    *   `reset-database.js`: **Destructive**. Drops all tables/views and re-applies schema.
    *   `seed-marketplace.js`: Populates the application marketplace.
    *   `create-test-admin.js`: Creates a default admin user for development.
*   **Migrations:**
    *   `run-migration.js`: Applies all pending SQL migrations.
    *   `apply-single-migration.js`: Applies a specific SQL file.
    *   `check-schema.js` & `check-users-schema.js`: Utilities to verify DB structure against expected schemas.

### 4. Maintenance Utilities
*   `update-admin-password.js`: Emergency password reset for admin accounts.
*   `promote-to-admin.js`: Elevates a standard user to admin status.
*   `fix-provider-encryption.js`: Re-encrypts provider credentials if keys change.

## Key Commands

### Development
*   `npm run dev`: Start Frontend (5173) and Backend (3001) concurrently.
*   `npm run client:dev`: Start only Frontend.
*   `npm run server:dev`: Start only Backend.
*   `npm run kill-ports`: Kill processes on 3001/5173.

### Database & Setup
*   `npm run db:fresh`: **Reset DB**, apply migrations, and seed. (Destructive!)
*   `npm run db:reset`: Interactive DB reset.
*   `npm run seed:admin`: Create default admin user.
*   `npm run paas:setup`: Install/update all PaaS dependencies (`pack`, `uncloud`, `unregistry`).
*   `npm run paas:check`: Run the full PaaS health check.

### Testing & QA
*   `npm run test`: Run Vitest suite.
*   `npm run lint`: Run ESLint.
*   `npm run check`: Run TypeScript type checking (`tsc --noEmit`).

## Development Conventions

*   **Imports:** Use ES Modules (`import` / `export`) exclusively.
*   **Database:**
    *   Use the `pg` driver directly or the helper in `api/lib/database.ts`.
    *   Migrations are raw SQL files in `migrations/`.
*   **PaaS Integration:**
    *   PaaS features rely on local CLI tools (`pack`, `uc`).
    *   Always run `npm run paas:check` before debugging PaaS issues.
    *   Worker nodes are managed via SSH; ensure SSH keys are synced.
*   **Environment:**
    *   `.env` drives configuration.
    *   `DATABASE_URL` and `SSH_CRED_SECRET` are critical.

## Directory Structure

*   **`api/`**: Backend Application
    *   `server.ts`: Main entry point.
    *   `routes/`: API Endpoints (`admin`, `client`, `public`).
    *   `services/`: Business logic.
*   **`src/`**: Frontend Application
    *   `pages/`: Route components.
    *   `components/`: Reusable UI.
    *   `lib/`: Frontend utilities.
*   **`scripts/`**: Automation & Setup (Current Directory).
*   **`migrations/`**: SQL migration files (001 to 018+).
