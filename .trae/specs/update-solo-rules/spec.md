# Update SOLO Rules Spec

## Why
The SOLO rules files (`.trae/rules/`) and `.github/instructions/` files were generated from AGENTS.md and CLAUDE.md but are missing several details present in the source documents. This update brings all derived docs into full alignment with the current source of truth.

## What Changes
- Add missing commands: `npm run db:fresh`, `npm run docs:api:audit`, Playwright e2e details
- Add missing env vars: `STARTUP_SIDE_EFFECTS_ENABLED`, `DEFAULT_ADMIN_EMAIL`/`DEFAULT_ADMIN_PASSWORD`
- Add missing route guards: `HostingMarketingGate`, `RegistrationEnabledRoute`
- Add missing activity types: `support.ticket_created`, `support.ticket_replied`, `blog.post_created`, `blog.post_updated`
- Add missing architecture hotspots: egress billing, fraud screening, refund processing, Vite proxy SSE/WebSocket
- Add missing lib/ details: Orval-generated code warning, `pnpm codegen`, `pnpm push`/`pnpm push-force`
- Add missing backend detail: CSRF, API-key auth, smart rate limits on `/api`
- Add missing testing details: `testTimeout`, `fileParallelism`, integration/e2e globs, Playwright config
- Add missing database detail: SHA256 checksum validation, `pnpm push`/`pnpm push-force`
- Add missing frontend detail: Vite proxy SSE/WebSocket handling
- Update `.github/instructions/` files with all missing details

## Impact
- Affected specs: All SOLO rules files, all `.github/instructions/` files
- Affected code: Documentation only (no runtime code changes)

## ADDED Requirements
### Requirement: Complete SOLO Rules
All SOLO rules files SHALL contain every detail present in AGENTS.md and CLAUDE.md, with no omissions.

#### Scenario: Source document has a detail
- **WHEN** AGENTS.md or CLAUDE.md contains a rule, command, env var, or pattern
- **THEN** the corresponding SOLO rule file SHALL include that detail

## MODIFIED Requirements
### Requirement: Existing SOLO Rules
All existing SOLO rules files are updated to include missing details from the source documents.

## REMOVED Requirements
None.