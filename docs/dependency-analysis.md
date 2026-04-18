# Dependency Analysis Report

**Generated**: Task 8.1 - Production Readiness Plan v2
**Requirement**: 3.2 - Unused Dependency Removal
**Tool**: `npx depcheck`

## Summary

This document records the evaluation of each package flagged by `depcheck` as potentially unused. Packages are categorized by recommendation: **REMOVE**, **KEEP**, or **INVESTIGATE FURTHER**.

---

## Production Dependencies Flagged as Unused

### 1. `@radix-ui/react-hover-card` (v1.1.1)

**Status**: ⚠️ REMOVE

**Analysis**:
- No imports found in codebase via grep search
- Not referenced in any `.ts`, `.tsx`, `.js`, or `.jsx` files
- Radix UI component that provides hover card functionality

**Decision**: Remove - No usage detected. Can be re-added if needed in future.

---

### 2. `@radix-ui/react-menubar` (v1.1.1)

**Status**: ⚠️ REMOVE

**Analysis**:
- No imports found in codebase
- Not referenced in any source files
- Radix UI component for menu bar functionality

**Decision**: Remove - No usage detected.

---

### 3. `@radix-ui/react-navigation-menu` (v1.1.3)

**Status**: ⚠️ REMOVE

**Analysis**:
- No imports found in codebase
- Not referenced in any source files
- Radix UI component for navigation menus

**Decision**: Remove - No usage detected. The app uses custom navigation components instead.

---

### 4. `@radix-ui/react-toast` (v1.1.5)

**Status**: ⚠️ REMOVE

**Analysis**:
- No imports found in codebase
- The app uses `sonner` (v1.7.4) for toast notifications instead
- `sonner` is actively used (confirmed in multiple pages and components)

**Decision**: Remove - Superseded by `sonner` which is the active toast library.

---

### 5. `@radix-ui/react-toggle` (v1.1.0)

**Status**: ⚠️ REMOVE

**Analysis**:
- No imports found in codebase
- Not referenced in any source files
- Radix UI toggle component

**Decision**: Remove - No usage detected.

---

### 6. `crypto-js` (v4.2.0)

**Status**: ⚠️ REMOVE

**Analysis**:
- No imports found in codebase (`from 'crypto-js'` search returned no matches)
- The app uses a custom crypto module at `api/lib/crypto.ts`
- The custom module uses Node.js built-in `crypto` module instead

**Decision**: Remove - Superseded by `api/lib/crypto.ts` which uses Node.js native crypto.

---

### 7. `next-themes` (v0.4.6)

**Status**: ⚠️ REMOVE

**Analysis**:
- No imports found in codebase
- This is a Next.js-specific theme library
- The app uses a custom `ThemeContext.tsx` instead
- The app is NOT a Next.js application (uses Vite + React)

**Decision**: Remove - Not applicable to this Vite-based application.

---

### 8. `react-hot-toast` (v2.6.0)

**Status**: ⚠️ REMOVE

**Analysis**:
- No imports found in codebase
- The app uses `sonner` for toast notifications instead
- `sonner` is actively used across the application

**Decision**: Remove - Superseded by `sonner`.

---

### 9. `react-leaflet-cluster` (v2.1.0)

**Status**: ⚠️ INVESTIGATE FURTHER

**Analysis**:
- No direct imports found in codebase
- However, `react-leaflet` (v4.2.1) IS used in `src/components/regions/LeafletMap.tsx`
- This package provides clustering functionality for markers
- May be used indirectly or planned for future use

**Decision**: **KEEP for now** - Investigate if clustering is needed for the regions map. If the map doesn't need marker clustering, this can be removed.

**Action Required**: Review `LeafletMap.tsx` to determine if clustering is implemented or planned.

---

### 10. `react-simple-maps` (v3.0.0)

**Status**: ⚠️ REMOVE

**Analysis**:
- No imports found in codebase
- The app uses `react-leaflet` for maps instead
- `LeafletMap.tsx` is the active map component

**Decision**: Remove - Superseded by `react-leaflet`.

---

### 11. `vaul` (v0.9.6)

**Status**: ⚠️ REMOVE

**Analysis**:
- No imports found in codebase
- Vaul is a drawer component library for React
- Not referenced in any source files

**Decision**: Remove - No usage detected.

---

### 12. `zustand` (v5.0.3)

**Status**: ⚠️ REMOVE

**Analysis**:
- No imports found in codebase
- The app uses React Context for state management (`AuthContext`, `ThemeContext`, etc.)
- TanStack Query is used for server state
- No Zustand stores found in the codebase

**Decision**: Remove - No usage detected. App uses Context API + TanStack Query for state management.

---

## Dev Dependencies Flagged as Unused

### 1. `@playwright/test` (v1.56.1)

**Status**: ✅ KEEP

**Analysis**:
- Listed as unused because no `.spec.ts` files exist yet
- Phase 5 (Task 30) of the Production Readiness Plan includes creating E2E tests
- Will be used for E2E smoke tests in `tests/e2e/`

**Decision**: Keep - Required for planned E2E testing infrastructure.

---

### 2. `@testing-library/jest-dom` (v6.9.1)

**Status**: ✅ KEEP

**Analysis**:
- Listed as unused because no tests currently import it directly
- Provides DOM matchers like `toBeInTheDocument()`
- Current tests use `@testing-library/react` but may not use jest-dom matchers
- Standard testing library for React applications

**Decision**: Keep - Standard testing utility. May be used in future tests.

---

### 3. `@types/crypto-js` (v4.2.1)

**Status**: ⚠️ REMOVE (with `crypto-js`)

**Analysis**:
- Type definitions for `crypto-js`
- If `crypto-js` is removed, this should also be removed

**Decision**: Remove - No longer needed if `crypto-js` is removed.

---

### 4. `@vitest/coverage-v8` (v3.2.4)

**Status**: ✅ KEEP

**Analysis**:
- Required for `npm run test:coverage` script
- Provides code coverage reporting for Vitest
- Used in `npm run verify:prod` command

**Decision**: Keep - Required for coverage tracking (Requirement 5.4).

---

### 5. `autoprefixer` (v10.4.21)

**Status**: ✅ KEEP

**Analysis**:
- Used in `postcss.config.js` for Tailwind CSS
- Required for CSS vendor prefixing
- Essential for Tailwind CSS build process

**Decision**: Keep - Required by PostCSS/Tailwind configuration.

---

### 6. `babel-plugin-react-dev-locator` (v1.0.0)

**Status**: ⚠️ REMOVE

**Analysis**:
- No babel configuration found that uses this plugin
- Not referenced in any configuration files
- Appears to be unused

**Decision**: Remove - No usage detected.

---

### 7. `baseline-browser-mapping` (v2.10.0)

**Status**: ⚠️ REMOVE

**Analysis**:
- No imports or configuration found
- Not referenced in any source or config files
- Unclear purpose in this project

**Decision**: Remove - No usage detected.

---

### 8. `cross-env` (v10.1.0)

**Status**: ✅ KEEP

**Analysis**:
- Used in `package.json` scripts: `"start": "cross-env NODE_ENV=production node --import tsx api/server.ts"`
- Required for cross-platform environment variable setting
- Essential for Windows/Linux/macOS compatibility

**Decision**: Keep - Used in npm scripts.

---

### 9. `playwright` (v1.56.1)

**Status**: ✅ KEEP

**Analysis**:
- Core Playwright package for E2E testing
- Used with `@playwright/test` for browser automation
- Required for Phase 5 E2E testing

**Decision**: Keep - Required for planned E2E testing infrastructure.

---

### 10. `postcss` (v8.5.3)

**Status**: ✅ KEEP

**Analysis**:
- Required by Tailwind CSS
- Used in `postcss.config.js`
- Essential for CSS processing

**Decision**: Keep - Required by Tailwind CSS.

---

### 11. `semgrep` (v1.0.0)

**Status**: ✅ KEEP

**Analysis**:
- Used in `npm run scan:code` script: `"scan:code": "semgrep --config=auto --error"`
- Required for `npm run verify:security` command
- Static analysis security tool

**Decision**: Keep - Used in security verification workflow.

---

### 12. `shadcn` (v3.5.0)

**Status**: ✅ KEEP

**Analysis**:
- CLI tool for adding shadcn/ui components
- Used to manage UI component library
- The string "shadcn" appears in source as a badge text, but the CLI is a dev tool

**Decision**: Keep - Required for UI component management.

---

### 13. `vite-plugin-trae-solo-badge` (v1.0.0)

**Status**: ⚠️ REMOVE

**Analysis**:
- Not imported in `vite.config.ts`
- Not referenced in any configuration files
- Not used in the Vite plugin chain

**Decision**: Remove - No usage detected.

---

## Missing Dependencies (Flagged by depcheck)

### 1. `node-fetch`

**Status**: ⚠️ INVESTIGATE

**Analysis**:
- Flagged as missing for `scripts/verify-admin-status.js`
- Node.js 22 has built-in `fetch` - may not need `node-fetch`
- Script should be updated to use native `fetch` or add dependency

**Decision**: Update script to use native `fetch` (Node.js 22.22.0 has built-in fetch support).

---

### 2. `@vercel/node`

**Status**: ⚠️ INVESTIGATE

**Analysis**:
- Flagged as missing for `api/index.ts`
- This is for Vercel serverless functions
- The app uses PM2 for deployment, not Vercel

**Decision**: Review `api/index.ts` - if Vercel deployment is not used, this import can be removed.

---

## Summary Table

### Production Dependencies - Recommended for Removal

| Package | Version | Reason |
|---------|---------|--------|
| `@radix-ui/react-hover-card` | 1.1.1 | No usage |
| `@radix-ui/react-menubar` | 1.1.1 | No usage |
| `@radix-ui/react-navigation-menu` | 1.1.3 | No usage |
| `@radix-ui/react-toast` | 1.1.5 | Superseded by `sonner` |
| `@radix-ui/react-toggle` | 1.1.0 | No usage |
| `crypto-js` | 4.2.0 | Superseded by native crypto |
| `next-themes` | 0.4.6 | Not applicable (not Next.js) |
| `react-hot-toast` | 2.6.0 | Superseded by `sonner` |
| `vaul` | 0.9.6 | No usage |
| `zustand` | 5.0.3 | No usage |

### Production Dependencies - Investigate Further

| Package | Version | Action |
|---------|---------|--------|
| (none remaining) | | |

### Dev Dependencies - Recommended for Removal

| Package | Version | Reason |
|---------|---------|--------|
| `@types/crypto-js` | 4.2.1 | Remove with `crypto-js` |
| `babel-plugin-react-dev-locator` | 1.0.0 | No usage |
| `baseline-browser-mapping` | 2.10.0 | No usage |
| `vite-plugin-trae-solo-badge` | 1.0.0 | No usage |

### Dev Dependencies - Keep

| Package | Version | Reason |
|---------|---------|--------|
| `@playwright/test` | 1.56.1 | Planned E2E tests |
| `@testing-library/jest-dom` | 6.9.1 | Testing utility |
| `@vitest/coverage-v8` | 3.2.4 | Coverage reporting |
| `autoprefixer` | 10.4.21 | Tailwind/PostCSS |
| `cross-env` | 10.1.0 | npm scripts |
| `playwright` | 1.56.1 | E2E testing |
| `postcss` | 8.5.3 | Tailwind CSS |
| `semgrep` | 1.0.0 | Security scanning |
| `shadcn` | 3.5.0 | UI component CLI |

---

## Next Steps

1. ~~Review `react-leaflet-cluster` usage in `LeafletMap.tsx`~~ ✅ Done - removed (not used)
2. Review `api/index.ts` for `@vercel/node` necessity
3. Update `scripts/verify-admin-status.js` to use native `fetch`
4. Proceed to Task 8.4 for `vite-plugin-trae-solo-badge` evaluation

---

## Map Library Consolidation Note

Per Requirement 3.2, map libraries have been consolidated. Completed state:

| Library | Status | Action Taken |
|---------|--------|--------------|
| `react-leaflet` | ✅ Kept | Active in `LeafletMap.tsx` |
| `leaflet` | ✅ Kept | Required dependency of `react-leaflet` |
| `@types/leaflet` | ✅ Kept | TypeScript types |
| `react-leaflet-cluster` | ✅ Removed | No direct imports, not needed |
| `react-simple-maps` | ✅ Removed | No usage |

**Decision**: Keep `react-leaflet` + `leaflet` + `@types/leaflet`. Removed `react-simple-maps` and `react-leaflet-cluster` as they had no actual usage.
