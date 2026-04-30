# Dependency Review

**Purpose**: Weekly dependency review checklist for maintaining supply chain hygiene and security.

## Weekly Review Checklist

### 1. Audit for New Vulnerabilities
```bash
npm run audit:security
```
- Review all HIGH and CRITICAL vulnerabilities
- Accept false positives (e.g., development-only packages)
- Create tickets for genuine vulnerabilities requiring package updates

### 2. Check for Outdated Dependencies
```bash
npm outdated
```
- Review any packages with newer versions
- Prioritize: security patches first, then minor releases
- Avoid major version upgrades without testing

### 3. Run Dependency Checker
```bash
npx depcheck
```
- Identify newly unused packages (may have been replaced by refactoring)
- Identify missing dependencies (packages used but not listed)
- Update `docs/dependency-analysis.md` with findings

### 4. Review Lockfile for Anomalies
```bash
npm ls --depth=0
```
- Verify no unexpected deduplication
- Check for packages with unusually large dependency trees

### 5. Security Scan
```bash
npm run scan:code
```
- Run semgrep static analysis
- Address any new findings

### 6. Verify Production Build
```bash
npm run build
```
- Confirm build succeeds with current dependencies

---

## Dependency Categories

### Production Dependencies
| Category | Examples | Review Frequency |
|---|---|---|
| Security-sensitive | `jsonwebtoken`, `bcryptjs`, `helmet` | Weekly |
| Network/Integration | `@paypal/paypal-server-sdk`, `ioredis` | Bi-weekly |
| Database | `pg` | Monthly |
| UI/Rendering | `react`, `framer-motion`, `recharts` | Monthly |
| Type definitions | `@types/*` | Monthly |

### Dev Dependencies
| Category | Examples | Review Frequency |
|---|---|---|
| Testing | `vitest`, `@playwright/test` | Bi-weekly |
| Build | `vite`, `typescript`, `tsx` | Monthly |
| Linting | `eslint`, `semgrep` | Bi-weekly |

---

## Adding New Dependencies

Before adding a new package:

1. **Verify need**: Does an existing package already provide this functionality?
2. **Check maintenance**: Is the package actively maintained? Last release date?
3. **Audit footprint**: `npm pack --dry-run <package>` to check bundle size
4. **Check alternatives**: Compare with similar packages
5. **Security**: Run `npm audit` on the package name before adding
6. **Pin version**: Remove `^`/`~` prefixes before committing

---

## Known Active Packages (do not remove)

| Package | Purpose |
|---|---|
| `sonner` | Toast notifications |
| `zod` | Schema validation |
| `clsx` / `tailwind-merge` | Class name utility |
| `react-hook-form` | Form management |
| `@tanstack/react-query` | Server state |
| `lucide-react` | Icons |
| `@tiptap/*` | Rich text editor |
| `nodemailer` / `resend` | Email delivery |
| `@dnd-kit/*` | Drag and drop |
| `framer-motion` | Animations |
| `recharts` | Charts |
| `leaflet` / `react-leaflet` | Region maps |
| `three` / `@types/three` | 3D components |

---

## Dependency Update Cadence

| Priority | Trigger | Action |
|---|---|---|
| Emergency | CVE in transitive dep | Update immediately |
| High | HIGH vuln in direct dep | Within 48h |
| Medium | LOW/MEDIUM vuln | Next sprint |
| Low | Minor version available | Weekly batch |
| Cosmetic | Patch available | Monthly batch |

---

## Lockfile Management

- `package-lock.json` is committed — it is the source of truth
- `npm ci` is used for CI/deploy (not `npm install`)
- `npm install` (which updates lockfile) is never run in CI
- Local dev: `npm install` is fine, but commit lockfile changes if version pins change

## SBOM

Generate a Software Bill of Materials for vulnerability scanning:

```bash
# Full SBOM (CycloneDX format)
npx @cyclonedx/cyclonedx-npm --output-file sbom.json

# Quick inventory
npm ls --depth=0 > dependency-inventory.txt
```
