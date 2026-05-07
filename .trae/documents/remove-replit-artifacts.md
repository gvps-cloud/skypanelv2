# Plan: Remove Replit Artifacts

## Summary

The project no longer uses Replit. This plan removes all Replit-specific files, catalog entries, and documentation references to clean up the codebase.

## Current State

Replit footprint consists of:
- 3 dedicated root-level files (`.replit`, `.replitignore`, `replit.md`)
- 3 Replit Vite plugin catalog entries in `pnpm-workspace.yaml` (not imported anywhere)
- 2 `minimumReleaseAgeExclude` entries for Replit packages in `pnpm-workspace.yaml`
- 1 documentation reference in `git-docs/PROJECT_STRUCTURE.md`

**No source code, CI/CD configs, environment files, or `package.json` files reference Replit.** The Replit vite plugins are catalog entries only — they are not imported in any `vite.config.*` or listed as dependencies in any `package.json`.

## Proposed Changes

### 1. Delete Replit-specific files (3 files)

| File | Reason |
|------|--------|
| `.replit` | Replit workspace config — no longer needed |
| `.replitignore` | Replit deployment ignore file — no longer needed |
| `replit.md` | Replit workspace documentation — no longer needed |

### 2. Edit `pnpm-workspace.yaml` — remove Replit catalog entries

Remove these 3 lines from the `catalog:` section (lines 10-12):
```yaml
  '@replit/vite-plugin-cartographer': ^0.5.1
  '@replit/vite-plugin-dev-banner': ^0.1.1
  '@replit/vite-plugin-runtime-error-modal': ^0.0.6
```

Remove these 2 lines from the `minimumReleaseAgeExclude:` section (lines 36-37):
```yaml
  - '@replit/*'
  - stripe-replit-sync
```

### 3. Regenerate `pnpm-lock.yaml`

After editing `pnpm-workspace.yaml`, run `pnpm install` in the `lib/` workspace to regenerate the lock file without the Replit package entries.

### 4. Edit `git-docs/PROJECT_STRUCTURE.md` — remove Replit file references

Remove the 3 lines listing Replit files from the project structure tree (lines 852-853, 865):
```
├── .replit
├── .replitignore
├── replit.md
```

## Assumptions & Decisions

- The `pnpm-lock.yaml` will be regenerated automatically by `pnpm install` after catalog changes — no manual editing needed.
- The `replit.md` file contains outdated info (references Node.js 24, Express 5, artifacts/ paths) that doesn't match the actual project state, confirming it's stale.
- No `.replit.nix` file exists — nothing to delete there.

## Verification

1. Confirm the 3 Replit files are deleted
2. Confirm `pnpm-workspace.yaml` has no `@replit` or `stripe-replit-sync` references
3. Run `pnpm install` to regenerate lock file
4. Run `npm run check` to verify TypeScript still passes
5. Run `npm run lint` to verify linting still passes
6. Grep for "replit" (case-insensitive) across the repo to confirm no remaining references
