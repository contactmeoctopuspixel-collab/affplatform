#!/usr/bin/env bash
set -euo pipefail

# ───────────────────────────────────────────────────────────────────────────────
#  AffIntel Platform v3 — Ubuntu 22.04 Auto-Installer
#  Usage:  chmod +x install.sh && sudo ./install.sh
#          sudo ./install.sh clean   ← full reset (removes data, .env, node_modules)
# ───────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERR]${NC}  $1"; }
run()   { echo -e "${CYAN}>>>${NC} $1"; eval "$1"; }
bail()  { err "$1"; exit 1; }

if [[ $EUID -ne 0 ]]; then bail "This script must be run as root (sudo)"; fi

# ── Clean mode ────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "clean" ]]; then
  echo ""
  echo "========================================"
  echo "  CLEAN MODE — Resetting everything"
  echo "========================================"
  info "Stopping PM2 processes..."
  pm2 delete affplatform-backend 2>/dev/null || true
  pm2 kill 2>/dev/null || true
  info "Removing backend data, .env, and node_modules..."
  rm -rf "$SCRIPT_DIR/backend/data" "$SCRIPT_DIR/backend/.env" "$SCRIPT_DIR/backend/node_modules" "$SCRIPT_DIR/backend/package-lock.json"
  info "Removing frontend node_modules and dist..."
  rm -rf "$SCRIPT_DIR/frontend/node_modules" "$SCRIPT_DIR/frontend/package-lock.json" "$SCRIPT_DIR/frontend/dist"
  info "Removing nginx config..."
  rm -f /etc/nginx/sites-enabled/affplatform /etc/nginx/sites-available/affplatform
  systemctl reload nginx 2>/dev/null || true
  info "Clearing npm cache..."
  npm cache clean --force 2>/dev/null || true
  ok "Clean complete — server is reset. Run ./install.sh to reinstall."
  exit 0
fi

# ── OS check ──────────────────────────────────────────────────────────────────
if ! grep -qi "ubuntu" /etc/os-release 2>/dev/null; then
  warn "Designed for Ubuntu 22.04 — proceed at your own risk."
fi

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 1 — System packages + Node.js 20.x
# ═══════════════════════════════════════════════════════════════════════════════
info "Updating system packages..."
apt-get update -qq

info "Installing required packages (nginx, curl, git, certbot)..."
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx 2>&1 | tail -1

info "Installing Node.js 20.x from NodeSource..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>&1 | tail -1
apt-get install -y -qq nodejs 2>&1 | tail -1

NODE_VER=$(node -v)
NPM_VER=$(npm -v)
ok "Node.js ${NODE_VER} / npm ${NPM_VER}"

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 2 — Backend setup
# ═══════════════════════════════════════════════════════════════════════════════
info "Setting up backend..."
cd "$SCRIPT_DIR/backend"

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
npm install --no-fund --no-audit 2>&1 | tail -3
ok "Backend dependencies installed"

info "Seeding database..."
rm -f data/*.db 2>/dev/null || true
node src/db/seed.js 2>&1
ok "Database seeded"

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 3 — Frontend setup
# ═══════════════════════════════════════════════════════════════════════════════
info "Setting up frontend..."
cd "$SCRIPT_DIR/frontend"

if [[ ! -f .env ]]; then
  cp .env.example .env
  ok "Created frontend .env"
fi

# Pin exact compatible versions to avoid vite 8 incompatibility
info "Ensuring compatible Vite version..."
node -e "
const pkg = require('./package.json');
pkg.devDependencies.vite = '^5.0.8';
pkg.devDependencies['@vitejs/plugin-react'] = '^4.2.1';
require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
" 2>&1
ok "Vite pinned to ^5.0.8"

info "Installing frontend dependencies..."
rm -rf node_modules package-lock.json
if npm install --no-fund --no-audit 2>&1; then
  ok "Frontend dependencies installed"
else
  warn "First attempt failed — retrying with --legacy-peer-deps..."
  npm install --no-fund --no-audit --legacy-peer-deps 2>&1
  ok "Frontend dependencies installed (legacy-peer-deps)"
fi

info "Building frontend..."
npm run build 2>&1
ok "Frontend built (dist/)"

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 4 — PM2 process manager
# ═══════════════════════════════════════════════════════════════════════════════
info "Installing PM2 globally..."
npm install -g pm2 2>&1 | tail -3
ok "PM2 installed"

pm2 delete affplatform-backend 2>/dev/null || true

info "Starting backend with PM2..."
cd "$SCRIPT_DIR/backend"
NODE_ENV=production pm2 start src/server.js --name affplatform-backend 2>&1
pm2 save 2>&1
pm2 startup systemd -u root --hp /root 2>&1 || true
ok "Backend running (port 4000, PM2)"

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 5 — nginx reverse proxy (port 80 → backend 4000)
# ═══════════════════════════════════════════════════════════════════════════════
info "Configuring nginx..."

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

if nginx -t 2>&1; then
  systemctl reload nginx
  ok "nginx configured — listening on port 80"
else
  warn "nginx config test failed — check /etc/nginx/sites-available/affplatform"
fi

# ── Firewall ──────────────────────────────────────────────────────────────────
if command -v ufw &>/dev/null; then
  ufw allow 80/tcp 2>/dev/null
  ufw allow 443/tcp 2>/dev/null
fi

# ═══════════════════════════════════════════════════════════════════════════════
#  DONE
# ═══════════════════════════════════════════════════════════════════════════════
SERVER_IP=$(curl -4 -s ifconfig.me 2>/dev/null || echo "<your-server-ip>")

echo ""
echo "========================================"
echo -e " ${GREEN}Installation complete!${NC}"
echo "========================================"
echo ""
echo -e "  ${CYAN}App:${NC}        http://${SERVER_IP}"
echo -e "  ${CYAN}Backend API:${NC} http://${SERVER_IP}/api/health"
echo ""
echo -e "  ${YELLOW}Login:${NC}"
echo -e "    Admin: admin@affplatform.com / admin123"
echo -e "    Team:  team@affplatform.com  / team123"
echo ""
echo -e "  ${YELLOW}Commands:${NC}"
echo -e "    pm2 status"
echo -e "    pm2 logs affplatform-backend"
echo -e "    pm2 restart affplatform-backend"
echo ""
echo -e "  ${YELLOW}SSL:${NC}   certbot --nginx -d yourdomain.com"
echo -e "  ${YELLOW}Reset:${NC} sudo ./install.sh clean"
echo ""
