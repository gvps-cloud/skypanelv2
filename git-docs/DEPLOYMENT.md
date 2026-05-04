# Deployment

Production architecture, deployment checklists, PM2 workflow, and maintenance.

> **Back to**: [README](../README.md)

---

## Production Architecture

```text
PRODUCTION ARCHITECTURE
-----------------------------------------------------------------------------
Internet → HTTPS (port 443) → reverse proxy
  • Proxy forwards API traffic to `skypanelv2-api` on port 3001
  • Proxy forwards frontend traffic to `skypanelv2-ui` on port 5173

Backend integrations from skypanelv2-api:
  • PostgreSQL database
  • Linode API for infrastructure
  • PayPal API for payments
  • Email providers (Resend / SMTP)
```

---

## Production Checklist

### Security

- Strong `JWT_SECRET` (32+ characters, randomly generated)
- Unique `SSH_CRED_SECRET` and `ENCRYPTION_KEY`
- `ENCRYPTION_KEY` generated via `node scripts/generate-encryption-key.js`
- Secure database password
- HTTPS/SSL configured via Caddy
- PayPal **live** credentials (not sandbox)
- FraudLabsPro credentials if using fraud screening
- Enhance hosting credentials if using web hosting
- `NODE_ENV=production`
- Rate limiting configured appropriately
- Database backups enabled

### Configuration

- Linode production API token
- Production SMTP/Resend credentials
- `CLIENT_URL` set to production domain
- CORS origins configured for production domain
- `TRUST_PROXY=1` (single reverse proxy) or `2` (Cloudflare + proxy)
- Enhance hosting credentials (if enabled)
- FraudLabsPro API key (if enabled)
- PayPal webhook endpoint configured

### CDN Configuration (Bunny CDN)

If your application is deployed behind Bunny CDN, you must enable the integration to accurately capture client IP addresses instead of the CDN's edge server IPs. This is crucial for rate limiting, brute force protection, and logging.

1. Set `BUNNY_CDN_ENABLED=true` in your `.env` file.
2. Ensure your CDN is forwarding the `True-Client-IP` or `X-Forwarded-For` header.
3. The application will dynamically fetch and trust Bunny CDN's edge server lists (`api.bunny.net/system/edgeserverlist`) and automatically parse the real client IP.

### Enhance Hosting Configuration

If using the Enhance web hosting integration:
1. Set `ENHANCE_ENABLED=true` in `.env`
2. Configure `ENHANCE_API_URL` to your Enhance panel domain (no `/api` suffix)
3. Set `ENHANCE_API_KEY` to the raw token (no `Bearer ` prefix)
4. Set `ENHANCE_MASTER_ORG_ID` and `ENHANCE_DEFAULT_SERVER_GROUP_ID` from your Enhance panel

### Fraud Protection (Optional)

If using FraudLabsPro anti-fraud screening:
1. Set `FRAUDLABSPRO_ENABLED=true`
2. Configure `FRAUDLABSPRO_API_KEY` with your API key
3. Adjust `FRAUDLABSPRO_REJECT_SCORE` threshold (default: 80)
4. Configure VPN/proxy/TOR blocking as needed

### Encryption Key Generation

```bash
node scripts/generate-encryption-key.js   # Generates ENCRYPTION_KEY
```

---

## Deployment with PM2

```bash
# Clone and setup
git clone https://github.com/gvps-cloud/skypanelv2.git
cd skypanelv2
npm ci --ignore-scripts

# Configure environment
cp .env.example .env
# Edit .env with production values

# Setup database
node scripts/run-migration.js
node scripts/generate-encryption-key.js   # Generate ENCRYPTION_KEY if not already set
npm run seed:admin

# Build and start
npm run pm2:start

# Monitor
pm2 monit
pm2 logs skypanelv2-api
pm2 logs skypanelv2-ui
```

---

## Health Check

```bash
curl https://panel.gvps.cloud/api/health
```

---

## Maintenance

```bash
# PM2 status
pm2 list
pm2 logs

# Database backup
pg_dump skypanelv2 > backup_$(date +%Y%m%d).sql

# Update deployment
git pull origin main
npm ci --ignore-scripts
npm run build
npm run pm2:reload

# Full pre-production verification
npm run verify:prod    # Runs: check, lint, test, security, coverage, scan, docs:audit, env check

# Environment verification
npm run verify:env     # Verify all required environment variables are set
```
