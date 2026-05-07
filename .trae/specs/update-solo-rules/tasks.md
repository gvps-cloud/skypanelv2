# Tasks

- [x] Task 1: Update `skypanel-rules.md` — Add all missing details from AGENTS.md/CLAUDE.md
  - [x] SubTask 1.1: Add missing lib/ details (Orval-generated code warning, pnpm codegen, pnpm push/push-force, git-docs/)
  - [x] SubTask 1.2: Add missing commands (db:fresh, docs:api:audit, test:watch, test:coverage, Playwright e2e)
  - [x] SubTask 1.3: Add missing env vars (STARTUP_SIDE_EFFECTS_ENABLED, DEFAULT_ADMIN_EMAIL/PASSWORD)
  - [x] SubTask 1.4: Add missing route guards (HostingMarketingGate, RegistrationEnabledRoute)
  - [x] SubTask 1.5: Add missing architecture hotspots (egress billing, fraud screening, refund processing, Vite proxy SSE/WS, blog routes, support tickets, platform maintenance)
  - [x] SubTask 1.6: Add missing backend detail (CSRF/API-key auth/rate limits on /api, config validation cron)
  - [x] SubTask 1.7: Add missing activity types (support.ticket_created, support.ticket_replied, blog.post_created, blog.post_updated)
  - [x] SubTask 1.8: Add missing key feature areas list

- [x] Task 2: Update `always-applied.md` — Add missing global rules
  - [x] SubTask 2.1: Add git-docs/ convention
  - [x] SubTask 2.2: Add STARTUP_SIDE_EFFECTS_ENABLED detail
  - [x] SubTask 2.3: Add config validation and metrics/billing cron detail

- [x] Task 3: Update `backend.md` — Add missing backend details
  - [x] SubTask 3.1: Add CSRF, API-key auth, smart rate limits on /api
  - [x] SubTask 3.2: Add missing activity types
  - [x] SubTask 3.3: Add egress billing, fraud screening, refund processing services
  - [x] SubTask 3.4: Add STARTUP_SIDE_EFFECTS_ENABLED config validation detail

- [x] Task 4: Update `frontend.md` — Add missing frontend details
  - [x] SubTask 4.1: Add HostingMarketingGate and RegistrationEnabledRoute guards
  - [x] SubTask 4.2: Add Vite proxy SSE/WebSocket handling detail
  - [x] SubTask 4.3: Add removeMockData plugin detail

- [x] Task 5: Update `database.md` — Add missing database details
  - [x] SubTask 5.1: Add pnpm push/push-force Drizzle detail
  - [x] SubTask 5.2: Add SHA256 checksum validation detail

- [x] Task 6: Update `testing.md` — Add missing testing details
  - [x] SubTask 6.1: Add Playwright e2e config detail
  - [x] SubTask 6.2: Add testTimeout and fileParallelism details
  - [x] SubTask 6.3: Add complete test include globs

- [x] Task 7: Update `.github/instructions/` files — Sync all 4 files with latest details
  - [x] SubTask 7.1: Update api-routes.instructions.md with missing activity types and CSRF/rate limit detail
  - [x] SubTask 7.2: Update frontend.instructions.md with missing guards and Vite proxy detail
  - [x] SubTask 7.3: Update migrations.instructions.md with checksum and pnpm push details
  - [x] SubTask 7.4: Update tests.instructions.md with Playwright, testTimeout, fileParallelism, globs

# Task Dependencies
- Tasks 1-7 are independent and can be parallelized