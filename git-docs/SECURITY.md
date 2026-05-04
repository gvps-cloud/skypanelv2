# Security Architecture

Data protection, encryption, access control, and rate limiting.

> **Back to**: [README](../README.md)

---

## Data Protection

```text
SECURITY ARCHITECTURE SNAPSHOT
-----------------------------------------------------------------------------
Encryption at Rest
  • Passwords – bcrypt hashes
  • SSH credentials – AES-256 via SSH_CRED_SECRET
  • Provider API tokens – AES-256 via ENCRYPTION_KEY
  • JWT tokens – HMAC-SHA256 signatures

Encryption in Transit
  • HTTPS/TLS (Caddy-managed certificates)
  • WSS for WebSocket terminals
  • Optional SSL for DB connections

Access Control Layers
  • RBAC (admin vs user) + org-scoped authorization
  • Organization isolation applied to all queries
  • Row-level security on user_api_keys
  • Tiered rate limiting per role with overrides
```

---

## Authentication Security

```text
AUTHENTICATION SECURITY
-----------------------------------------------------------------------------
JWT Authentication
  • Stateless tokens signed with HMAC-SHA256 (JWT_SECRET)
  • Configurable expiration (default: 7 days)
  • Token blacklist service for explicit logout/invalidation
  • Tokens sent as HTTP-only cookies + Authorization header

Two-Factor Authentication
  • TOTP-based 2FA via otplib
  • QR code setup flow for authenticator apps
  • Temporary token during 2FA verification

Password Security
  • bcrypt hashing (bcryptjs)
  • Password reset via email token with expiration
  • Brute force protection (bruteForceProtectionService)
    - Configurable lockout thresholds
    - Per-IP and per-account tracking

Admin Impersonation
  • Admins can act as any user for support
  • Visual banner indicator when impersonating
  • Blocked from certain destructive admin actions while impersonating
```

---

## API Key Security

```text
API KEY SECURITY
-----------------------------------------------------------------------------
  • User-scoped API keys with SHA-256 hashed storage
  • Plain text shown only once at creation
  • Granular permission JSONB per key
  • PostgreSQL RLS on user_api_keys table
  • Bearer token authentication via middleware
  • API key requests count against user's rate limit quota
```

---

## CSRF Protection

```text
CSRF PROTECTION
-----------------------------------------------------------------------------
  • CSRF token middleware (csrfProtection.ts) applied to /api routes
  • Double-submit cookie pattern
  • Tokens validated on state-changing requests (POST, PUT, DELETE, PATCH)
  • HMAC-SHA256 signed tokens with 2-hour TTL
  • Bearer/API-key auth bypasses CSRF (machine-to-machine safe)
  • Shadow mode for non-production testing
```

---

## Request Security

```text
REQUEST SECURITY
-----------------------------------------------------------------------------
  • Helmet middleware — security headers (CSP, XSS protection, etc.)
  • CORS — configurable origins
  • Nonce-based Content Security Policy
  • HTTPS enforcement in production (requireHttps.ts)
  • Body parser size limits
  • Input validation via express-validator + custom validation helpers
```

---

## IP Detection & Rate Limiting

```text
IP DETECTION
-----------------------------------------------------------------------------
  • Multi-header IP resolution (ipDetection.ts)
  • Bunny CDN integration (bunnyCdnService.ts)
    - Auto-fetches edge server IP list from api.bunny.net
    - Parses True-Client-IP header behind CDN
  • Configurable trust proxy settings (TRUST_PROXY env var)
```

---

## Rate Limiting Tiers

| Tier              | Default Max Requests | Window     |
| ----------------- | -------------------- | ---------- |
| **Anonymous**     | 1,000                | 15 minutes |
| **Authenticated** | 5,000                | 15 minutes |
| **Admin**         | 10,000               | 15 minutes |

All tiers are configurable via environment variables. Per-user overrides can be set by admins via the `user_rate_limit_overrides` table.

---

## Fraud Prevention

```text
FRAUD PREVENTION (FraudLabsPro)
-----------------------------------------------------------------------------
  • Real-time IP reputation screening
  • Email validation (disposable email detection)
  • Proxy/VPN/TOR detection and blocking
  • Configurable score thresholds
  • Registration screening before account creation
  • Payment screening before PayPal order creation
  • Admin review queue with manual allow/block override
```

---

## Organization Isolation

```text
ORGANIZATION ISOLATION
-----------------------------------------------------------------------------
  • All resource queries scoped by organization_id
  • Multi-tenant data separation enforced at query level
  • Row-level security on sensitive tables (user_api_keys, billing, egress)
  • Permission-gated access via organization roles (19 granular permissions)
  • Hosting feature gating middleware (hosting.ts) — routes only available when hosting is enabled
```

---

## Hosting Security

```text
HOSTING SECURITY
-----------------------------------------------------------------------------
  • Separate hosting wallets — isolated from VPS billing wallets
  • Enhance API communication over HTTPS
  • Provider token encryption at rest (AES-256 via ENCRYPTION_KEY)
  • normalizeProviderToken() usage for safe token handling
  • Customer org isolation — each org gets its own Enhance customer org
```
