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
*   `npm run paas:discover`: Discover existing PaaS workers.

### Testing & QA
*   `npm run test`: Run Vitest suite.
*   `npm run lint`: Run ESLint.
*   `npm run check`: Run TypeScript type checking (`tsc --noEmit`).

## Directory Structure

*   **`api/`**: Backend Application
    *   `server.ts`: Main entry point.
    *   `routes/`: API Endpoints (`admin`, `client`, `public`).
    *   `services/`: Business logic (Billing, PaaS, Providers).
    *   `lib/`: Utilities (Crypto, DB, Validation).
*   **`src/`**: Frontend Application
    *   `pages/`: Route components.
    *   `components/`: Reusable UI (shadcn in `ui/`).
    *   `lib/`: Frontend utilities & API client.
    *   `hooks/`: Custom React hooks.
*   **`scripts/`**: Critical maintenance & setup scripts.
    *   *Note:* Contains logic for DB migrations, seeding, and PaaS installation.
*   **`migrations/`**: SQL migration files (001 to 018+).
*   **`repo-docs/`**: Detailed documentation.
    *   `ENVIRONMENT_VARIABLES.md`: Full env var reference.
    *   `ADMIN_TROUBLESHOOTING.md`: Operational guides.

## Configuration & Environment

*   **`.env`**: Main configuration file. See `repo-docs/ENVIRONMENT_VARIABLES.md` for a complete reference.
    *   **Key Vars:** `DATABASE_URL`, `JWT_SECRET`, `LINODE_API_TOKEN`, `SSH_CRED_SECRET`.
*   **`vite.config.ts`**: Frontend build config + API proxy (`/api` -> `localhost:3001`).
*   **`components.json`**: Shadcn UI configuration.

## Development Conventions

*   **Imports:** Use ES Modules (`import` / `export`).
*   **Styling:** Use Tailwind utility classes.
*   **Types:** Strict TypeScript usage. Shared types often in `src/types` or co-located.
*   **API:** Frontend uses `src/lib/api.ts` for authenticated requests.
*   **PaaS:** PaaS features depend on local CLI tools (`pack`, `uc`, `docker`). Ensure `npm run paas:setup` has been run if working on PaaS features.
