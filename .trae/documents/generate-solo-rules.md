# Plan: Generate SOLO Rules from CLAUDE.md/AGENTS.md

Transform the existing project documentation (AGENTS.md, CLAUDE.md) into multiple rules formats for AI coding assistants.

## Summary

Convert skypanelv2's existing contributor guidance into SOLO project rules, per-directory instruction files, and a consolidated format. The existing AGENTS.md and CLAUDE.md serve as the source of truth; new formats will be generated from this content.

## Current State

- **AGENTS.md** — Primary source of truth for coding agents; covers project structure, commands, TypeScript conventions, backend/frontend rules, database patterns, and architecture hotspots
- **CLAUDE.md** — Delegates to AGENTS.md; duplicates some high-level architecture info
- **`.github/instructions/`** — 4 existing per-directory instruction files:
  - `api-routes.instructions.md` (appliesTo: api/routes/**)
  - `frontend.instructions.md` (appliesTo: src/**)
  - `migrations.instructions.md` (appliesTo: migrations/**)
  - `tests.instructions.md` (appliesTo: tests/**, src/**/*.test.*, api/**/*.test.*)

## Proposed Changes

### 1. Create SOLO project_rules.md

Create `.trae/rules/skypanel-rules.md` consolidating all project rules:

```
.trae/
  rules/
    skypanel-rules.md
```

**Content sources:**
- AGENTS.md: Project Structure, Commands, TypeScript & Lint, Commit Conventions, Environment, Backend Rules, Frontend Rules, Database & Migrations, Testing Notes, Enhance Hosting Gotchas, Architecture Hotspots
- CLAUDE.md: High-Level Architecture, Key Commands (deduplicated), Architecture Hotspots (deduplicated), TypeScript & Linting (deduplicated), Security-Sensitive Patterns

### 2. Create SOLO workspace rules

Create `.trae/rules/always-applied.md` for global workspace rules:

**Content:**
- AGENTS.md frontmatter: `alwaysApply: true`
- Project structure summary
- Critical conventions (ESM imports, Zod versions, multi-tenant scope)

### 3. Create SOLO domain-specific rules

Create `.trae/rules/` directory with domain rules:

```
.trae/rules/
  backend.md     — API routes, services, middleware, error handling
  frontend.md    — React components, TanStack Query, routing, theming
  database.md    — Migrations, schema conventions, query patterns
  testing.md     — Vitest config, test locations, security tests
  hosting.md     — Enhance-specific patterns (already covered in AGENTS.md)
```

### 4. Update existing `.github/instructions/` files

Enhance existing instruction files to include frontmatter for better AI tool compatibility:

```yaml
---
name: skypanel-api-routes
description: API route guidelines for skypanelv2
applyTo: "api/routes/**"
---
```

## Files to Create

| File | Source | Purpose |
|------|--------|---------|
| `.trae/rules/skypanel-rules.md` | AGENTS.md + CLAUDE.md | Primary SOLO rules |
| `.trae/rules/always-applied.md` | AGENTS.md frontmatter | Global workspace rules |
| `.trae/rules/backend.md` | AGENTS.md Backend Rules section | Backend-specific guidance |
| `.trae/rules/frontend.md` | AGENTS.md Frontend Rules section | Frontend-specific guidance |
| `.trae/rules/database.md` | AGENTS.md Database & Migrations section | Database patterns |
| `.trae/rules/testing.md` | AGENTS.md Testing Notes section | Testing conventions |
| `.trae/rules/hosting.md` | AGENTS.md Enhance Hosting Gotchas section | Hosting-specific guidance |

## Files to Update

| File | Change |
|------|--------|
| `.github/instructions/api-routes.instructions.md` | Add frontmatter with name/description |
| `.github/instructions/frontend.instructions.md` | Add frontmatter with name/description |
| `.github/instructions/migrations.instructions.md` | Add frontmatter with name/description |
| `.github/instructions/tests.instructions.md` | Add frontmatter with name/description |

## Decisions

1. **Keep existing instruction files** as supplementary docs; SOLO rules will reference them
2. **Deduplicate** duplicated content between AGENTS.md and CLAUDE.md
3. **Preserve original source files** (AGENTS.md, CLAUDE.md) unchanged; new files are derived
4. **SOLO rules structure** follows `.trae/rules/` convention based on AGENTS.md's alwaysApply pattern

## Verification

1. Read generated `.trae/rules/*.md` files to verify content accuracy
2. Confirm all key patterns from AGENTS.md are covered
3. Ensure no conflicting rules between files