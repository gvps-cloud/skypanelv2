# SSL Setup (Caddy + Let's Encrypt)

This guide sets up HTTPS for SkyPanelV2 on a VPS or dedicated server using Caddy as a reverse proxy.

## What this gives you

- Automatic TLS certificate issuance (Let's Encrypt)
- Automatic certificate renewal
- HTTP to HTTPS redirection
- Reverse proxy routing:
  - `/api/*` -> `http://127.0.0.1:3001`
  - all other routes -> `http://127.0.0.1:5173`

## Prerequisites

1. DNS `A`/`AAAA` record for your domain points to your server IP.
2. Ports `80` and `443` are open in your firewall/security group.
3. SkyPanelV2 is running in production (recommended via PM2).
4. Server is Debian/Ubuntu if you want auto-install via `--install-caddy`.

## 1) Start SkyPanelV2

```bash
npm run pm2:start
```

## 2) Apply SSL config

From project root:

```bash
sudo bash scripts/setup-caddy-ssl.sh \
  --domain panel.example.com \
  --email ops@example.com \
  --install-caddy
```

If Caddy is already installed, remove `--install-caddy`.

## 3) Update environment values

Set production URL values in `.env`:

```bash
NODE_ENV=production
CLIENT_URL=https://panel.example.com
TRUST_PROXY=1
```

Then restart app processes:

```bash
npm run pm2:reload
```

## 4) Validate

```bash
curl -I https://panel.example.com
curl -I https://panel.example.com/api/health
```

Expected result: HTTP `200` responses and a valid certificate chain.

## Notes

- Caddyfile template used by the script: `deploy/caddy/Caddyfile.template`
- Default upstream ports:
  - API: `3001`
  - UI: `5173`
- Override ports with:
  - `--api-port <port>`
  - `--ui-port <port>`

## Rollback

The setup script creates a timestamped backup of the previous Caddyfile:

`/etc/caddy/Caddyfile.bak.YYYYMMDDHHMMSS`

To rollback:

```bash
sudo cp /etc/caddy/Caddyfile.bak.<timestamp> /etc/caddy/Caddyfile
sudo systemctl restart caddy
```
