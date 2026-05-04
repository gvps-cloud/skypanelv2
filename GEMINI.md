# SkyPanelV2

## Project Overview
**SkyPanelV2** is an open-source full-stack VPS management and billing platform. It provides a customer portal, admin dashboard, automated billing, SSH console access, and support ticketing.
It is a monolithic repository containing both the frontend client and the backend API.

**Tech Stack:**
- **Language:** TypeScript
- **Frontend:** React, Vite, Tailwind CSS, shadcn/ui (Radix UI), React Router, React Query
- **Backend:** Node.js, Express, PostgreSQL (with `pg`), ioredis for caching/rate-limiting
- **Testing:** Vitest (Unit/Integration), Playwright (E2E)

## Building and Running

### Development
The project uses `concurrently` to run both the frontend and backend in development mode.
- **Start both (Frontend :5173, Backend :3001):** `npm run dev`
- **PREFERED METHOD - Kill ports and start:** `npm run dev-up`
- **Start frontend only:** `npm run client:dev`
- **Start backend only:** `npm run server:dev`

### Database
- **Reset and run migrations:** `npm run db:fresh`
- **Seed default admin user:** `npm run seed:admin`
- **Run pending migrations:** `node scripts/run-migration.js`

### Production / Build
- **Build the project:** `npm run build` (runs `tsc -b` and `vite build`)
- **Start in production (PM2):** `npm run pm2:start`
- **Start backend natively:** `npm run start`

### Testing and Linting
- **Type Checking:** `npm run check`
- **Linting:** `npm run lint`
- **Unit Testing:** `npm run test:unit`
- **Full Test Suite:** `npm run test`
- **Coverage:** `npm run test:coverage`

## Development Conventions
- **Code Quality:** The project enforces TypeScript strict checking (`npm run check`) and ESLint (`npm run lint`).
- **Monorepo Structure:** 
  - `api/` contains the Express backend and backend specific configurations.
  - `src/` contains the React frontend.
  - `git-docs/` contains comprehensive documentation for architectural and domain-specific details.
- **Scripting:** Utility and maintenance scripts are located in the `scripts/` directory.

## Key Resources
- Always check `git-docs/ARCHITECTURE.md`, `git-docs/FRONTEND.md`, and `git-docs/BACKEND.md` for deep technical context.
- Refer to `AGENTS.md` and `CLAUDE.md` for specific coding agent rules established by the maintainers.
