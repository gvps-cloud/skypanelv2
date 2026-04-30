# Environment Variables Reference

This document provides a comprehensive reference for all environment variables used in SkyPanelV2.

## Core Application Settings

### Basic Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Application environment (`development`, `production`, `test`) |
| `PORT` | No | `3001` | Port for the Express.js backend server |
| `CLIENT_URL` | No | `http://localhost:5173` | Frontend application URL for CORS and redirects |
| `STARTUP_SIDE_EFFECTS_ENABLED` | No | `true` | Enables startup-time side effects such as schedulers, DB LISTEN clients, and external refresh jobs; set to `false` only for local validation-only production boots |
| `JWT_SECRET` | **Yes** | - | Secret key for JWT token signing (use strong random string) |
| `JWT_EXPIRES_IN` | No | `7d` | JWT token expiration time (e.g., `7d`, `24h`, `3600s`) |

### Security & Encryption

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SSH_CRED_SECRET` | **Yes** | - | 32+ character key for encrypting provider API tokens |
| `ENCRYPTION_KEY` | **Yes** | - | 32-character key for general encryption operations |
| `TRUST_PROXY` | No | `true` | Proxy trust configuration for proper IP detection |

### CDN Integration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BUNNY_CDN_ENABLED` | No | `false` | Enable dynamic proxy trusting for Bunny CDN edge IPs |
| `BUNNY_CDN_API_URL_IPV4` | No | `https://api.bunny.net/system/edgeserverlist` | Bunny CDN IPv4 edge IP list URL |
| `BUNNY_CDN_API_URL_IPV6` | No | `https://api.bunny.net/system/edgeserverlist/IPv6` | Bunny CDN IPv6 edge IP list URL |
| `BUNNY_CDN_REFRESH_INTERVAL_MS` | No | `86400000` | How often to fetch edge IPs in milliseconds (default: 24h) |

**Security Notes:**
- Generate `SSH_CRED_SECRET` using: `node scripts/generate-ssh-secret.js`
- Use cryptographically secure random strings for all secrets
- Rotate secrets regularly in production environments

### Default Admin Seed (Optional)

Used by the `scripts/create-test-admin.js` script.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DEFAULT_ADMIN_EMAIL` | No | `admin@example.com` | Default admin email address to seed |
| `DEFAULT_ADMIN_PASSWORD` | No | `Admin123#` | Default admin password to seed |

## Database & Caching Configuration

### PostgreSQL

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | **Yes** | - | PostgreSQL connection string |
| `DB_SSL_REJECT_UNAUTHORIZED` | No | `true` | Only used when PostgreSQL SSL is enabled; set to `false` only for trusted self-signed/internal certificates |

**Examples:**
```bash
# Local PostgreSQL
DATABASE_URL=postgresql://postgres:password@localhost:5432/skypanelv2

# Neon.tech (cloud PostgreSQL)
DATABASE_URL=postgresql://username:password@ep-example-123456.us-east-1.aws.neon.tech/skypanelv2?sslmode=require

# Other cloud providers
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require

# EasyPanel / private-network Postgres without TLS
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=disable
```

**SSL behavior notes:**
- If `DATABASE_URL` includes `?sslmode=disable`, the app and maintenance scripts keep PostgreSQL SSL disabled even in production.
- If `DATABASE_URL` includes `?sslmode=require` (or another SSL mode), the app enables SSL automatically.
- `DB_SSL_REJECT_UNAUTHORIZED=false` is only relevant when SSL is enabled and you intentionally trust a self-signed or private CA certificate.

### Redis (Optional)

Used for rate limiting and token blacklisting/brute force protection.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL |
| `REDIS_PASSWORD` | No | - | Redis authentication password |

## Branding & UI Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COMPANY_NAME` | No | `SkyPanelV2` | Company name displayed in the backend |
| `VITE_COMPANY_NAME` | No | `SkyPanelV2` | Company name displayed in the frontend |
| `COMPANY_BRAND_NAME` | No | `SkyPanelV2` | Brand name used in marketing materials |

**Note:** Frontend variables must be prefixed with `VITE_` to be accessible in the React application.

## Payment Integration

### PayPal Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PAYPAL_CLIENT_ID` | **Yes** | - | PayPal REST API client ID |
| `PAYPAL_CLIENT_SECRET` | **Yes** | - | PayPal REST API client secret |
| `PAYPAL_MODE` | No | `sandbox` | PayPal environment (`sandbox` or `live`) |

**Setup Instructions:**
1. Create PayPal developer account at https://developer.paypal.com
2. Create a new application to get client credentials
3. Use sandbox credentials for development, live for production

## Email Configuration

### Email Delivery Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EMAIL_PROVIDER_PRIORITY` | No | `resend,smtp` | Order of email providers to try |
| `RESEND_API_KEY` | No | - | API key for Resend (if used) |
| `SMTP_HOST` | No | - | SMTP server hostname |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_SECURE` | No | `false` | Use SSL/TLS encryption |
| `SMTP_REQUIRE_TLS` | No | `true` | Require STARTTLS |
| `SMTP_USERNAME` | No | - | SMTP username |
| `SMTP_PASSWORD` | No | - | SMTP password |

### Email Addresses

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FROM_EMAIL` | **Yes** | - | Default sender email address |
| `FROM_NAME` | No | `COMPANY_BRAND_NAME` | Default sender name (falls back to `COMPANY_BRAND_NAME` if unset) |
| `CONTACT_FORM_RECIPIENT` | **Yes** | - | Email address for contact form submissions |
| `TEST_EMAIL` | No | - | Email address for testing SMTP configuration |

## Cloud Provider Integration

### Linode (Required)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LINODE_API_TOKEN` | **Yes** | - | Linode API personal access token |
| `LINODE_API_URL` | No | `https://api.linode.com/v4` | Linode API base URL |

**Setup Instructions:**
1. **Linode**: Create token at https://cloud.linode.com/profile/tokens

### GitHub (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_TOKEN` | No | - | GitHub Personal Access Token to increase API rate limits for checking application updates |



## Rate Limiting Configuration

### Anonymous Users (Unauthenticated)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_ANONYMOUS_WINDOW_MS` | No | `900000` | Time window in milliseconds (15 minutes) |
| `RATE_LIMIT_ANONYMOUS_MAX` | No | `1000` | Maximum requests per window |

### Authenticated Users

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_AUTHENTICATED_WINDOW_MS` | No | `900000` | Time window in milliseconds (15 minutes) |
| `RATE_LIMIT_AUTHENTICATED_MAX` | No | `5000` | Maximum requests per window |

### Admin Users

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_ADMIN_WINDOW_MS` | No | `900000` | Time window in milliseconds (15 minutes) |
| `RATE_LIMIT_ADMIN_MAX` | No | `10000` | Maximum requests per window |

### Password Reset Rate Limiting

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_PASSWORD_RESET_WINDOW_MS` | No | `3600000` | Time window (1 hour) |
| `RATE_LIMIT_PASSWORD_RESET_MAX` | No | `3` | Max password reset requests per window |
| `RATE_LIMIT_PASSWORD_RESET_SKIP_IN_DEV` | No | `false` | Skip rate limit in development |

## Networking & VPS Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RDNS_BASE_DOMAIN` | No | `ip.rev.example.com` | Base domain for VPS reverse DNS entries |
| `VPS_TAG` | No | `skypanelv2` | Tag applied to all provisioned Linode VPS instances |

## File Upload Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MAX_FILE_SIZE` | No | `10485760` | Maximum file upload size in bytes (10MB) |
| `UPLOAD_PATH` | No | `./uploads` | Directory for temporary file uploads |

## Monitoring & Analytics (Optional)

### Better Stack (Uptime Monitoring)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BETTERUPTIME_API_KEY` | No | - | Better Stack API key for status monitors |
| `BETTERUPTIME_STATUS_PAGE_ID` | No | - | Better Stack status page ID |

### Rybbit Analytics (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_RYBBIT_SCRIPT_URL` | No | - | Rybbit analytics script URL (leave empty to disable) |
| `VITE_RYBBIT_SITE_ID` | No | - | Rybbit site ID |
| `VITE_RYBBIT_API_KEY` | No | - | Rybbit API key |
| `VITE_RYBBIT_TRACK_ERRORS` | No | `true` | Enable JavaScript error tracking |
| `VITE_RYBBIT_SESSION_REPLAY` | No | `true` | Enable session replay recording |
| `VITE_TRACKING_SCRIPT_URL` | No | - | Generic tracking script URL fallback (prefer Rybbit) |

## Backup Configuration (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BACKUP_STORAGE_PROVIDER` | No | `local` | Backup storage provider (`local`, `s3`, etc.) |
| `BACKUP_RETENTION_DAYS` | No | `30` | Number of days to retain backups |

## Environment-Specific Configurations

### Development Environment

```bash
NODE_ENV=development
PORT=3001
CLIENT_URL=http://localhost:5173
PAYPAL_MODE=sandbox
TRUST_PROXY=true
```

### Production Environment

```bash
NODE_ENV=production
PORT=3001
CLIENT_URL=https://your-domain.com
STARTUP_SIDE_EFFECTS_ENABLED=true
PAYPAL_MODE=live
TRUST_PROXY=1  # Adjust based on your proxy setup
```

### Validation-Only Production Boot

Use this only for local boot verification when you need production-mode startup without kicking off schedulers or other startup side effects:

```bash
NODE_ENV=production
STARTUP_SIDE_EFFECTS_ENABLED=false
PORT=3101
UI_PORT=4173
```

### Testing Environment

```bash
NODE_ENV=test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/skypanelv2_test
```

## Security Best Practices

### Secret Management

1. **Never commit secrets to version control**
2. **Use strong, randomly generated secrets**
3. **Rotate secrets regularly**
4. **Use different secrets for each environment**
5. **Store secrets securely (e.g., AWS Secrets Manager, HashiCorp Vault)**

### Production Checklist

- [ ] Strong `JWT_SECRET` (32+ characters, cryptographically random)
- [ ] Secure `SSH_CRED_SECRET` and `ENCRYPTION_KEY`
- [ ] PayPal live credentials (not sandbox)
- [ ] Proper `TRUST_PROXY` configuration for your infrastructure
- [ ] PostgreSQL SSL/TLS enabled
- [ ] Rate limiting configured appropriately
- [ ] Monitoring and logging enabled

## Troubleshooting

### Common Issues

**Database Connection Fails**
- Verify `DATABASE_URL` format and credentials
- Check network connectivity and firewall rules
- Ensure PostgreSQL is running and accepting connections

**PayPal Integration Issues**
- Verify client ID and secret are correct
- Check `PAYPAL_MODE` matches your credentials (sandbox vs live)
- Ensure frontend can reach PayPal SDK

**Email Delivery Problems**
- Test SMTP configuration with `node scripts/test-smtp.js`
- Verify SMTP credentials and settings
- Check firewall rules for SMTP ports

**Rate Limiting Too Restrictive**
- Adjust rate limit values based on usage patterns
- Consider different limits for different user types
- Monitor rate limit hit rates in logs

**Provider API Errors**
- Verify API tokens are valid and have required permissions
- Check API token expiration dates
- Ensure network connectivity to provider APIs

### Validation Scripts

Use these scripts to validate your configuration:

```bash
# Check admin users
node scripts/check-admin-users.js

# Check platform settings
node scripts/check-platform-settings.js

# Check migration status
node scripts/check-migration.js

# Verify admin status
node scripts/verify-admin-status.js
```

## Migration Notes

### Upgrading from Previous Versions

When upgrading SkyPanelV2, check for new environment variables:

1. Compare your `.env` with the latest `.env.example`
2. Add any missing variables with appropriate values
3. Update deprecated variables as noted in release notes
4. Test configuration with validation scripts

### Environment Variable Changes


- **v2.0.0**: Enhanced rate limiting configuration
- **v1.5.0**: Added InfluxDB monitoring support
- **v1.4.0**: Improved SMTP2GO configuration options

---

For additional help with environment configuration, see:
- [Main README](../README.md)
- [.env.example](../.env.example)
