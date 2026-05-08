#!/usr/bin/env bash
set -euo pipefail

# ───────────────────────────────────────────────────────────────────────────────
#  AffIntel Platform v3 — Ubuntu 22.04 Auto-Installer
#  Usage:  chmod +x install.sh && sudo ./install.sh
# ───────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo " AffIntel Platform v3 — Ubuntu Install"
echo "========================================"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERR]${NC}  $1"; }

# ── Check root ────────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  err "This script must be run as root (sudo)"
  exit 1
fi

# ── Detect OS ─────────────────────────────────────────────────────────────────
if ! grep -qi "ubuntu" /etc/os-release 2>/dev/null; then
  warn "This script is designed for Ubuntu 22.04. Proceed at your own risk."
fi

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 1 — System packages + Node.js 20.x
# ═══════════════════════════════════════════════════════════════════════════════
info "Updating system packages..."
apt-get update -qq

info "Installing required system packages..."
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx 2>/dev/null

info "Installing Node.js 20.x via NodeSource..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
apt-get install -y -qq nodejs 2>/dev/null

NODE_VER=$(node -v)
NPM_VER=$(npm -v)
ok "Node.js ${NODE_VER} / npm ${NPM_VER}"

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 2 — Backend setup
# ═══════════════════════════════════════════════════════════════════════════════
info "Setting up backend..."
cd "$SCRIPT_DIR/backend"

# Create .env if missing, or fix JWT_SECRET if still default
if [[ ! -f .env ]]; then
  cp .env.example .env
  ok "Created backend .env from .env.example"
fi
if grep -q "change_this_to" .env 2>/dev/null; then
  JWT_SECRET="affintel_$(openssl rand -hex 32)"
  sed -i "s|change_this_to_a_very_long_random_secret_string_min_32_chars|$JWT_SECRET|" .env
  ok "JWT_SECRET set to random value"
fi

info "Installing backend dependencies..."
rm -rf node_modules package-lock.json
npm install --no-fund --no-audit 2>/dev/null
ok "Backend dependencies installed"

info "Cleaning old data and re-seeding..."
rm -rf "$SCRIPT_DIR"/backend/data/*.db 2>/dev/null || true
node src/db/seed.js
ok "Database seeded"

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 3 — Frontend setup
# ═══════════════════════════════════════════════════════════════════════════════
info "Setting up frontend..."
cd "$SCRIPT_DIR/frontend"

if [[ ! -f .env ]]; then
  cp .env.example .env
  ok "Created frontend .env"
else
  ok "Frontend .env already exists"
fi

info "Installing frontend dependencies..."
rm -rf node_modules package-lock.json
npm install --no-fund --no-audit 2>/dev/null
ok "Frontend dependencies installed"

info "Building frontend..."
npm run build 2>/dev/null
ok "Frontend built (dist/)"

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 4 — PM2 process manager
# ═══════════════════════════════════════════════════════════════════════════════
info "Installing PM2..."
npm install -g pm2 2>/dev/null
ok "PM2 installed"

# Stop any existing process
pm2 delete affplatform-backend 2>/dev/null || true

info "Starting backend with PM2..."
cd "$SCRIPT_DIR/backend"
NODE_ENV=production pm2 start src/server.js --name affplatform-backend 2>/dev/null
pm2 save 2>/dev/null
pm2 startup systemd -u root --hp /root 2>/dev/null || true
ok "Backend running on port 4000 (PM2)"

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 5 — nginx reverse proxy
# ═══════════════════════════════════════════════════════════════════════════════
info "Configuring nginx..."

SERVER_IP=$(curl -4 -s ifconfig.me 2>/dev/null || echo "localhost")

cat > /etc/nginx/sites-available/affplatform <<NGINX
server {
    listen 80;
    server_name _;

    client_max_body_size 10m;

    location /api {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    location /ws {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
    }

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/affplatform /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t 2>/dev/null && systemctl reload nginx && ok "nginx configured and running" || warn "nginx config test failed — check manually"

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 6 — Firewall
# ═══════════════════════════════════════════════════════════════════════════════
if command -v ufw &>/dev/null; then
  ufw allow 80/tcp 2>/dev/null
  ufw allow 443/tcp 2>/dev/null
  ok "Firewall: ports 80, 443 opened"
fi

# ═══════════════════════════════════════════════════════════════════════════════
#  DONE
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "========================================"
echo -e " ${GREEN}Installation complete!${NC}"
echo "========================================"
echo ""
echo -e "  ${CYAN}App:${NC}       http://${SERVER_IP}"
echo -e "  ${CYAN}Backend:${NC}   http://${SERVER_IP}/api/health"
echo ""
echo -e "  ${YELLOW}Login credentials:${NC}"
echo -e "    Admin:  admin@affplatform.com / admin123"
echo -e "    Team:   team@affplatform.com  / team123"
echo ""
echo -e "  ${YELLOW}Useful commands:${NC}"
echo -e "    pm2 status                   # check processes"
echo -e "    pm2 logs affplatform-backend # view logs"
echo -e "    pm2 restart affplatform-backend # restart"
echo ""
echo -e "  ${YELLOW}SSL (optional):${NC}"
echo -e "    certbot --nginx -d yourdomain.com"
echo ""
