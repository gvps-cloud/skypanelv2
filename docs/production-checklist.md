# Production Checklist

Pre-deployment verification checklist for SkyPanelV2. Complete every item before promoting to production.

---

## 1. Environment Configuration

- [ ] Copy `.env.example` to `.env` and fill all values
- [ ] Run `node scripts/verify-env.js` — zero errors required
- [ ] `NODE_ENV=production` is set
- [ ] `JWT_SECRET` is a strong, unique value (≥32 chars, not a placeholder)
- [ ] `SSH_CRED_SECRET` is generated via `node scripts/generate-ssh-secret.js`
- [ ] `ENCRYPTION_KEY` is generated via `node scripts/generate-encryption-key.js`
- [ ] `DATABASE_URL` points to the production PostgreSQL instance
- [ ] `PAYPAL_MODE=live` (not `sandbox`) for real transactions
- [ ] `AUTO_CREATE_ORG=false` in production
- [ ] `CSRF_ENFORCE` is not `false`
- [ ] `TRUST_PROXY` is set appropriately for your proxy chain (`1` for single proxy, `2` for Cloudflare + proxy)
- [ ] `RDNS_BASE_DOMAIN` points at a DNS zone you control (not a placeholder or temporary wildcard domain such as `nip.io`)
- [ ] All placeholder values (`your-*`, `example.com`) have been replaced
- [ ] `STARTUP_SIDE_EFFECTS_ENABLED=true` for real production runtime; only set it to `false` for local validation boots

## 2. Database

- [ ] PostgreSQL is accessible from the application host
- [ ] Run `node scripts/run-migration.js` to apply all pending migrations
- [ ] Verify migration count matches expected: compare `migrations/` directory with `schema_migrations` table
- [ ] Run `npm run seed:admin` to create the initial admin account
- [ ] Run `node scripts/seed-branding.js` to sync branding from `.env` to the database
- [ ] Database backups are configured and tested
- [ ] Connection pooling is configured (recommended: PgBouncer or Neon pooler)

## 3. Security

- [ ] Run `npm run audit:security` — no high-severity vulnerabilities
- [ ] Run `npm run test:security` — all security tests pass
- [ ] Run `npm run scan:code` (Semgrep) — should return `0` findings; the immutable bootstrap migration `migrations/001_initial_schema.sql` is intentionally excluded because its seeded bcrypt hash is a documented false positive
- [ ] CORS origins (`CLIENT_URL`) match the production domain only
- [ ] Rate limiting is configured and not disabled
- [ ] HTTPS is enforced (via reverse proxy or load balancer)
- [ ] `HttpOnly` + `Secure` flags on `auth_token` cookie
- [ ] No `localStorage` auth token reads in frontend code
- [ ] Organization data isolation is enforced (all queries scoped by `organization_id`)

## 4. Build & Type Check

- [ ] `npm run check` passes (TypeScript type check)
- [ ] `npm run lint` passes (ESLint, 0 errors)
- [ ] `npm run build` succeeds (includes `docs:api:sync` pre-build hook)
- [ ] No console errors in production build

## 5. Provider Integration

- [ ] `LINODE_API_TOKEN` is valid and has required permissions
- [ ] Linode API connectivity verified: `curl -H "Authorization: Bearer $LINODE_API_TOKEN" https://api.linode.com/v4/account`
- [ ] PayPal credentials verified in live mode
- [ ] Email delivery tested (Resend or SMTP)
- [ ] RDNS base domain (`RDNS_BASE_DOMAIN`) is a valid DNS zone you control

## 6. Infrastructure

- [ ] Reverse proxy (Caddy/Nginx) configured with:
  - HTTPS termination
  - Proxy headers (`X-Forwarded-For`, `X-Forwarded-Proto`)
  - SSE support for `/api/notifications/stream`
  - All frontend, API, SSE, and SSH WebSocket traffic routed to Express on `:3001`
  - WebSocket upgrade support for `/api/vps/:id/ssh`
- [ ] Process manager (PM2) configured: `npm run pm2:start`
- [ ] `ecosystem.config.cjs` reviewed for correct settings
- [ ] If doing a local validation-only PM2 boot, use `STARTUP_SIDE_EFFECTS_ENABLED=false` with alternate ports to avoid touching live schedulers/services
- [ ] Log rotation configured
- [ ] File upload directory (`UPLOAD_PATH`) exists and is writable
- [ ] Firewall rules allow only ports 80/443 (and 22 for SSH admin)

## 7. Monitoring & Alerting

- [ ] Application health endpoint responds: `GET /api/health`
- [ ] Better Stack / Better Uptime integration configured (optional)
- [ ] Log aggregation configured (stdout/PM2 logs)
- [ ] Disk space monitoring on database and upload volumes
- [ ] SSL certificate expiry monitoring

## 8. Pre-Release Verification

- [ ] Run `npm run verify:prod` — full production readiness gate
- [ ] Smoke test: login, create VPS, check billing, view activity
- [ ] Smoke test: admin panel — user management, platform settings
- [ ] SSE notifications stream connects and delivers events
- [ ] PayPal payment flow completes end-to-end
- [ ] Email delivery works (password reset, contact form, notifications)

## 9. Rollback Plan

- [ ] Previous build artifact is archived
- [ ] Database migration rollback plan documented (never modify existing migrations — add new ones)
- [ ] Environment variable changes are tracked in version control (`.env.example`)
- [ ] PM2 reload command tested: `npm run pm2:reload`
- [ ] DNS TTL is low enough for quick failover if applicable
