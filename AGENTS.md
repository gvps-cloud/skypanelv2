# Repository Guidelines

## Project Structure & Module Organization
- `src/` React client (Vite + TypeScript) with `components/`, `pages/`, `lib/` utilities, `contexts/`, `hooks/`, `styles/`, and `theme/`. Use the `@/*` alias for imports.
- `api/` Express server (ESM) with domain routes in `routes/`, shared config in `config/`, middleware in `middleware/`, and services such as billing and SSH bridging in `services/`.
- `migrations/` versioned PostgreSQL SQL files; apply in order.
- `scripts/` operational helpers (seed admin, reset DB, apply migrations, billing tests).
- `public/` static assets, `logs/` runtime logs, `repo-docs/ENVIRONMENT_VARIABLES.md` for env reference.

## Build, Test, and Development Commands
- `npm run dev` — start client (5173) and API (3001) together via `concurrently`.
- `npm run client:dev` / `npm run server:dev` — run fronts separately; useful for focused debugging.
- `npm run build` — type-check via project refs then bundle client; `npm start` runs API with `node --import tsx api/server.ts` plus `vite preview --strictPort`.
- Quality gates: `npm run lint`, `npm run check`, `npm test` (vitest --run), `npm run test:watch`.
- Database helpers: `npm run db:fresh` (reset + migrations), `npm run seed:admin` (bootstrap login), `npm run db:reset:confirm` (destructive reset).

## Coding Style & Naming Conventions
- TypeScript + ES modules; keep imports aliased with `@/` where possible.
- Components/pages use PascalCase `.tsx`; hooks use `useX`; utilities/types use `camelCase`.
- Follow existing file conventions (UI uses double quotes, API favors single); keep 2-space indentation and match semicolon usage of the touched file.
- ESLint (React Hooks + refresh rules) is the source of truth; unused variables should be prefixed with `_` or removed.

## Testing Guidelines
- Vitest + React Testing Library with DOM mocks in `src/test-setup.ts`; co-locate specs as `*.test.ts[x]` (e.g., `src/lib/api.test.ts`, `src/lib/vpsStepConfiguration.test.ts`).
- Use `src/test-utils.tsx` for provider wrappers; prefer deterministic fixtures over network calls.
- For API flows, Supertest is available—stub external providers and avoid hitting live billing/SSH services.
- Prioritize coverage when touching billing scheduler, impersonation flows, admin modals, and validation logic.

## Commit & Pull Request Guidelines
- Use Conventional Commit prefixes as in history (`feat:`, `fix:`, `chore:`, `docs:`) with optional scopes (`feat(vps): ...`).
- Before opening a PR, run lint, type-check, tests, and any affected DB scripts; call out known gaps.
- PR descriptions should include motivation, key changes, test evidence (`npm test` output or screenshots), env/migration impact, and UI screenshots/GIFs for visible changes; link related issues or tickets.

## Security & Configuration Tips
- Copy `.env.example` to `.env` and fill secrets from `repo-docs/ENVIRONMENT_VARIABLES.md`; never commit secrets or `logs/`.
- Migrations assume PostgreSQL—backup before `db:reset` and coordinate when altering billing or SSH configuration.
