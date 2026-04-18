# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please email **security@<company-domain>** with:
- A description of the issue and its impact
- Reproduction steps (if possible)
- Your suggested mitigation (if any)

Do **not** open a public GitHub issue for security problems.

We aim to respond within 72 hours and ship a fix or mitigation plan within 7 days for high-severity issues.

## Dependency Policy

### Audit Gate (local-only)

`npm run audit:security` runs `npm audit --audit-level=high` and exits non-zero on any **high** or **critical** finding. Run this manually before every merge to `main` and before every deploy.

The `npm run verify:prod` command bundles `audit:security` with type-check, lint, tests, semgrep, and docs audit as the final pre-release gate — run it locally as the last step before `git push` or `npm run pm2:start`.

> We do **not** use hosted CI (GitHub Actions, Dependabot, etc.) on this project. Every security, lint, and test gate is a local command an operator must run before releasing. Treat the list below as a manual checklist.

### Override Strategy

We use the `overrides` block in `@package.json` to force-patch transitive dependencies where a direct-dep upgrade would be breaking. Current overrides:

| Package | Pinned | Reason |
|---|---|---|
| `esbuild` | `^0.25.0` | Upstream CVE fix |
| `undici` | `^6.0.0` | Upstream CVE fix |
| `d3-color` | `^3.1.0` | ReDoS fix |
| `axios` | `^1.13.5` | CVE fix (transitive) |
| `qs` | `>=6.14.2` | Prototype-pollution fix |
| `lodash` | `>=4.18.1` | Prototype-pollution fix |
| `serialize-javascript` | `>=7.0.5` | RCE (GHSA-5c6j-r48x-rmvq) + ReDoS (GHSA-qj8w-gfj5-8c6v); transitive via `vite-plugin-pwa → workbox-build → @rollup/plugin-terser` |

### Removed Dependencies

- **`@vercel/node`** (removed): brought in 6 high-severity CVEs via `@vercel/build-utils`, `@vercel/python-analysis`, `ajv`, `minimatch`, `smol-toml`. The `api/index.ts` Vercel serverless entry point retains type compatibility via a minimal local shim at `@api/types/vercel.d.ts` — when deployed to Vercel, the runtime supplies its own `@vercel/node`. Primary deployment target is PM2 (`npm run pm2:start`), so this dev dependency was not needed locally.

## Accepted Risk Register

Vulnerabilities below the `audit:security` gate (`low` and `moderate` without fix) that are tracked and accepted:

| Package | Advisory | Severity | Why accepted | Plan |
|---|---|---|---|---|
| `pm2` | [GHSA-x5gf-qvw8-r2rm](https://github.com/advisories/GHSA-x5gf-qvw8-r2rm) — Regular Expression DoS | low | `pm2` is a dev/ops tool invoked from controlled scripts (`npm run pm2:*`), not exposed to user-supplied input. No upstream fix available. Attack surface limited to operators running `pm2 ls`, `pm2 start`, etc. on trusted configuration files. | Re-evaluate when upstream ships a patched release; consider alternative process manager (systemd, docker) if fix does not land within 90 days. |

Low/moderate findings without fixes should be reviewed quarterly against this table.

## Deployment

On deploy hosts, **always use**:

```bash
npm ci --ignore-scripts
```

This command:

1. Installs **exact versions** from `package-lock.json` (ignoring `package.json` ranges)
2. **Skips post-install scripts** — blocks a known supply-chain attack vector where malicious packages execute arbitrary code during `npm install`
3. Ensures reproducible builds across all environments

**Never use** `npm install` on production deploy hosts — it may resolve different versions and runs post-install scripts.

## Supply-Chain Practices

- **Exact versions** — devDeps and deps avoid `^` where feasible; `package-lock.json` is committed. Local installs use `npm ci --ignore-scripts` to block post-install hooks (a known supply-chain attack vector).
- **Override audit** — every entry in the `overrides` block must cite an advisory or upstream issue in this file.
- **Pre-release verification** — `npm run verify:prod` is the operator-run gate before every release. Do not skip it.

## Software Bill of Materials (SBOM)

At every release, generate a Software Bill of Materials (SBOM) to maintain a complete inventory of all dependencies:

### Generation Procedure

1. **Run the SBOM generator** before tagging the release:

   ```bash
   npx @cyclonedx/cyclonedx-npm --output-file sbom.json
   ```

2. **Attach the SBOM to release notes** — Include the generated `sbom.json` file as an attachment in the release notes on GitHub or your release management system.

3. **Store for audit trail** — Consider committing the SBOM to a `docs/releases/` directory with version naming:

   ```bash
   mkdir -p docs/releases
   mv sbom.json docs/releases/sbom-vX.Y.Z.json
   ```

### Why SBOM Matters

- **Supply-chain transparency** — Know exactly what dependencies (including transitive) are in each release
- **Vulnerability response** — Quickly identify affected releases when a CVE is disclosed
- **Compliance** — Meet regulatory requirements for software provenance
- **Audit trail** — Maintain historical record of dependency changes across releases

### Weekly Dependency Review Task

Every week, an operator shall perform a manual dependency review:

1. **Check for outdated packages**: `npm outdated`
2. **Check for vulnerabilities**: `npm audit`
3. **Review changelogs** for any packages with updates available
4. **Create PRs** for high/critical severity advisories following the process in `docs/dependency-review.md`

**Detailed checklist**: See [docs/dependency-review.md](docs/dependency-review.md) for the complete review process, including high-severity advisory handling, testing requirements, and prohibited automation.

**Prohibited automation**: No Dependabot, Renovate, Snyk, Socket.dev, or any hosted dependency automation service. All dependency updates require manual operator review.

This project intentionally does not use hosted CI (GitHub Actions / Dependabot / Renovate). Security responsibility lies with the operator running the verify commands before release.

## Runtime Security Controls

High-level summary (see `@AGENTS.md` and `@api/middleware/*.ts` for details):

- **Auth** — JWT in HttpOnly cookie + CSRF double-submit (`X-CSRF-Token` header vs `csrf_token` cookie). Token blacklist via Redis.
- **Rate limiting** — tiered per role (`anon`, `authenticated`, `admin`) with Redis-backed sliding windows.
- **CORS** — production allowlist only; dev fallback never emits `*`. See [CORS Configuration](#cors-configuration) for details.
- **CSP / HSTS** — applied via `helmet` + NGINX/Cloudflare in production.
- **SQL** — parameterized via `pg` only; no ORM DSL, no string interpolation.
- **Secrets** — rotated on any leak; generated by `@scripts/generate-ssh-secret.js` and `@scripts/generate-encryption-key.js`.
- **CSRF shadow mode** — refuses to start in production (`@api/middleware/csrfProtection.ts`).

## CORS Configuration

The CORS (Cross-Origin Resource Sharing) configuration is designed to be secure by default:

### Production Requirements

**`CLIENT_URL` must be set to the exact production domain.** This environment variable defines the allowed origins for cross-origin requests. In production:

- The `CLIENT_URL` value is the only origin allowed (plus any comma-separated additional origins)
- Localhost origins are **NOT** automatically included in production
- The wildcard `*` is **NEVER** emitted as an allowed origin

Example production configuration:
```bash
CLIENT_URL=https://panel.example.com
# Or multiple origins:
CLIENT_URL=https://panel.example.com,https://admin.example.com
```

### Development Behavior

When `NODE_ENV` is not `production`, the following localhost origins are automatically allowed to prevent accidental lockouts during local development:

- `http://localhost:5173` / `https://localhost:5173` (Vite dev server)
- `http://127.0.0.1:5173` / `https://127.0.0.1:5173`
- `http://localhost:3001` / `https://localhost:3001` (Express server)
- `http://127.0.0.1:3001` / `https://127.0.0.1:3001`

These development origins are **never** allowed in production.

### Security Properties

1. **No wildcard in production** — The origin callback never returns `*`; each origin is explicitly validated against the allowlist.
2. **Graceful rejection** — Unknown origins receive `callback(null, false)` which omits CORS headers without throwing an error. This prevents information leakage and ensures clean request rejection.
3. **Logged rejections** — Rejected origins are logged via `console.warn("[Security] CORS rejected origin", { origin })` for monitoring and debugging.
4. **Credentials supported** — The `credentials: true` option allows cookies and authorization headers for authenticated requests, but only from allowed origins.

### Audit Findings (Task 4.1)

| Property | Status | Notes |
|---|---|---|
| Production never emits `*` | ✅ Verified | Origin callback explicitly checks allowlist |
| Unknown origins return `false` | ✅ Verified | `callback(null, false)` pattern used |
| Localhost only in development | ✅ Verified | `NODE_ENV !== "production"` guard in place |
| Rejected origins logged | ✅ Verified | `console.warn` for security monitoring |

## Verification Checklist (before release)

```
npm run verify:prod
```

This runs, in order: `check` (tsc) → `lint` → `test` → `test:security` → `test:coverage` → `scan:code` (semgrep) → `docs:api:audit` → `audit:security`. All must pass.
