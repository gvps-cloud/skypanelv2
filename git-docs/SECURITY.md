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

## Rate Limiting Tiers

| Tier              | Default Max Requests | Window     |
| ----------------- | -------------------- | ---------- |
| **Anonymous**     | 1,000                | 15 minutes |
| **Authenticated** | 5,000                | 15 minutes |
| **Admin**         | 10,000               | 15 minutes |

All tiers are configurable via environment variables. Per-user overrides can be set by admins via the `user_rate_limit_overrides` table.
