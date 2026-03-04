#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEMPLATE_PATH="${PROJECT_ROOT}/deploy/caddy/Caddyfile.template"

DOMAIN=""
EMAIL=""
API_PORT=3001
UI_PORT=5173
CADDYFILE_PATH="/etc/caddy/Caddyfile"
INSTALL_CADDY=0

usage() {
  cat <<'EOF'
Setup HTTPS for SkyPanelV2 using Caddy + Let's Encrypt.

Usage:
  sudo bash scripts/setup-caddy-ssl.sh --domain panel.example.com --email ops@example.com [options]

Required:
  --domain <fqdn>         Domain that points to this server (A/AAAA DNS record)
  --email <email>         ACME contact email for Let's Encrypt

Optional:
  --api-port <port>       API upstream port (default: 3001)
  --ui-port <port>        UI upstream port (default: 5173)
  --caddyfile <path>      Caddyfile path (default: /etc/caddy/Caddyfile)
  --install-caddy         Install Caddy on Debian/Ubuntu if missing
  -h, --help              Show help

Examples:
  sudo bash scripts/setup-caddy-ssl.sh --domain panel.example.com --email ops@example.com --install-caddy
  sudo bash scripts/setup-caddy-ssl.sh --domain billing.example.com --email devops@example.com --api-port 3001 --ui-port 5173
EOF
}

log() {
  printf '[ssl-setup] %s\n' "$*"
}

error() {
  printf '[ssl-setup] ERROR: %s\n' "$*" >&2
}

escape_sed_replacement() {
  printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'
}

validate_port() {
  local value="$1"
  local label="$2"

  if ! [[ "$value" =~ ^[0-9]+$ ]]; then
    error "${label} must be a number."
    exit 1
  fi
  if (( value < 1 || value > 65535 )); then
    error "${label} must be between 1 and 65535."
    exit 1
  fi
}

install_caddy_debian() {
  log "Installing Caddy (Debian/Ubuntu)..."
  apt-get update
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor --yes -o /etc/apt/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
}

if [[ $# -eq 0 ]]; then
  usage
  exit 1
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      DOMAIN="${2:-}"
      shift 2
      ;;
    --email)
      EMAIL="${2:-}"
      shift 2
      ;;
    --api-port)
      API_PORT="${2:-}"
      shift 2
      ;;
    --ui-port)
      UI_PORT="${2:-}"
      shift 2
      ;;
    --caddyfile)
      CADDYFILE_PATH="${2:-}"
      shift 2
      ;;
    --install-caddy)
      INSTALL_CADDY=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      error "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$DOMAIN" ]]; then
  error "--domain is required."
  usage
  exit 1
fi

if [[ -z "$EMAIL" ]]; then
  error "--email is required."
  usage
  exit 1
fi

if [[ "$DOMAIN" == *" "* ]]; then
  error "Domain must not contain spaces."
  exit 1
fi

validate_port "$API_PORT" "API port"
validate_port "$UI_PORT" "UI port"

if [[ "$EUID" -ne 0 ]]; then
  error "Run this script with sudo/root because it writes ${CADDYFILE_PATH} and manages services."
  exit 1
fi

if [[ ! -f "$TEMPLATE_PATH" ]]; then
  error "Template file not found: ${TEMPLATE_PATH}"
  exit 1
fi

if ! command -v caddy >/dev/null 2>&1; then
  if [[ "$INSTALL_CADDY" -eq 1 ]]; then
    if command -v apt-get >/dev/null 2>&1; then
      install_caddy_debian
    else
      error "Caddy is not installed and auto-install only supports Debian/Ubuntu (apt-get)."
      error "Install Caddy manually, then rerun this script."
      exit 1
    fi
  else
    error "Caddy is not installed. Re-run with --install-caddy or install Caddy manually first."
    exit 1
  fi
fi

backup_path=""
if [[ -f "$CADDYFILE_PATH" ]]; then
  backup_path="${CADDYFILE_PATH}.bak.$(date +%Y%m%d%H%M%S)"
  cp "$CADDYFILE_PATH" "$backup_path"
  log "Backed up existing Caddyfile to ${backup_path}"
fi

tmp_file="$(mktemp)"
cp "$TEMPLATE_PATH" "$tmp_file"

sed -i "s/__ACME_EMAIL__/$(escape_sed_replacement "$EMAIL")/g" "$tmp_file"
sed -i "s/__DOMAIN__/$(escape_sed_replacement "$DOMAIN")/g" "$tmp_file"
sed -i "s/__API_PORT__/$(escape_sed_replacement "$API_PORT")/g" "$tmp_file"
sed -i "s/__UI_PORT__/$(escape_sed_replacement "$UI_PORT")/g" "$tmp_file"

mkdir -p "$(dirname "$CADDYFILE_PATH")"
install -m 0644 "$tmp_file" "$CADDYFILE_PATH"
rm -f "$tmp_file"

log "Wrote Caddy config to ${CADDYFILE_PATH}"

caddy fmt --overwrite "$CADDYFILE_PATH" >/dev/null
caddy validate --config "$CADDYFILE_PATH"

if command -v systemctl >/dev/null 2>&1 && [[ -d /run/systemd/system ]]; then
  systemctl enable caddy >/dev/null 2>&1 || true
  systemctl restart caddy
  log "Caddy restarted successfully."
else
  log "systemctl not found. Start Caddy manually with: caddy run --config ${CADDYFILE_PATH}"
fi

log "HTTPS setup complete for ${DOMAIN}."
log "Make sure DNS points ${DOMAIN} to this server and ports 80/443 are open."
log "Set CLIENT_URL=https://${DOMAIN} and TRUST_PROXY=1 in .env, then restart SkyPanelV2."
