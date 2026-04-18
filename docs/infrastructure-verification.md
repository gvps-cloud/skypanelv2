# Infrastructure Verification

How to verify that the production infrastructure is correctly configured for SkyPanelV2.

---

## Network Connectivity

### Database

```bash
# Test PostgreSQL connection from app host
psql "$DATABASE_URL" -c "SELECT 1"

# Verify schema migrations are applied
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM schema_migrations"
```

### Linode API

```bash
# Verify API token is valid
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $LINODE_API_TOKEN" \
  https://api.linode.com/v4/account
# Expected: 200
```

### PayPal API

```bash
# Verify PayPal live credentials
curl -s https://api-m.paypal.com/v1/oauth2/token \
  -u "$PAYPAL_CLIENT_ID:$PAYPAL_CLIENT_SECRET" \
  -d "grant_type=client_credentials"
# Expected: 200 with access_token
```

### Email (Resend)

```bash
# Verify Resend API key
curl -s https://api.resend.com/domains \
  -H "Authorization: Bearer $RESEND_API_KEY"
# Expected: 200 with domain list
```

---

## Reverse Proxy Configuration

### Caddy (recommended)

```Caddyfile
yourdomain.com {
    reverse_proxy localhost:3001

    # WebSocket support for SSE
    reverse_proxy /api/notifications/stream localhost:3001 {
        header_up Connection {>Connection}
        header_up Upgrade {>Upgrade}
    }

    # Static asset caching
    @static path /assets/*
    header @static Cache-Control "public, max-age=31536000, immutable"
}
```

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate     /etc/ssl/certs/yourdomain.pem;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;

    # Proxy headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    location / {
        proxy_pass http://127.0.0.1:3001;
    }

    # SSE endpoint — disable buffering
    location /api/notifications/stream {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
    }

    # Static assets — long cache
    location /assets/ {
        proxy_pass http://127.0.0.1:3001;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Verification

```bash
# HTTPS is working
curl -sI https://yourdomain.com | head -1
# Expected: HTTP/2 200

# Proxy headers are forwarded
curl -s https://yourdomain.com/api/health | jq .
# Should return JSON with status "ok"

# WebSocket/SSE works
curl -N -H "Accept: text/event-stream" \
  "https://yourdomain.com/api/notifications/stream?token=TEST_TOKEN"
# Should receive: data: {"type":"connected",...}
```

---

## Process Manager (PM2)

```bash
# Start production processes
npm run pm2:start

# Verify processes are running
npm run pm2:list
# Expected: "online" status for all processes

# Test graceful reload
npm run pm2:reload

# Check logs
npx pm2 logs --lines 50
```

---

## Health Check

```bash
# Application health
curl -s https://yourdomain.com/api/health | jq .
# Expected: { "status": "ok", ... }

# Database connectivity (via health endpoint)
# The health endpoint tests DB connection internally

# Scheduler status
# Check PM2 logs for "Billing scheduler started" / "Egress billing scheduler started"
npx pm2 logs --lines 100 | Select-String "scheduler"
```

---

## Firewall

Verify only required ports are open:

```bash
# From external host, test port exposure
nmap -p 80,443,3001,5432,22 yourdomain.com
# Expected: 80 open, 443 open, 3001 filtered/closed, 5432 filtered/closed, 22 open (if SSH needed)
```

---

## SSL/TLS

```bash
# Check certificate expiry
echo | openssl s_client -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates
# Ensure not_expired is > 30 days

# Check TLS version
echo | openssl s_client -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -text | Select-String "Protocol"
# Expected: TLSv1.2+ only
```
