# AffIntel Platform v3

Affiliate marketing intelligence dashboard — React + Express + NeDB.

## Quick Install (Ubuntu 22 VPS)

```bash
git clone https://github.com/contactmeoctopuspixel-collab/affplatform.git
cd affplatform
chmod +x install.sh
sudo ./install.sh
```

That's it. The script will:
- Install Node.js 20.x + nginx + PM2
- Install backend/frontend dependencies
- Seed the database (admin + team accounts)
- Build the frontend
- Start the backend (PM2, serves both API and frontend)
- Configure nginx reverse proxy on port 80

| Role  | Email                  | Password  |
|-------|------------------------|-----------|
| Admin | admin@affplatform.com  | admin123  |
| Team  | team@affplatform.com   | team123   |

## SSL

```bash
certbot --nginx -d yourdomain.com
```

## Manual Management

| Command | Description |
|---------|-------------|
| `pm2 status` | Check processes |
| `pm2 logs affplatform-backend` | View logs |
| `pm2 restart affplatform-backend` | Restart |
| `sudo systemctl reload nginx` | Reload nginx |

## Architecture

```
affplatform/
├── backend/         ← Node.js + Express + NeDB (port 4000)
│   └── src/
│       ├── db/      ← NeDB (pure JS, no compilation)
│       ├── routes/  ← API routes
│       └── server.js ← Entry point (also serves frontend dist/)
├── frontend/        ← React + Vite + Recharts
│   └── src/
│       ├── App.jsx  ← Main app
│       └── api.js   ← API client
├── install.sh       ← Ubuntu 22 auto-installer
└── docker-compose.yml ← Alternative Docker deployment
```

## Docker Alternative

```bash
cp backend/.env.example backend/.env
nano backend/.env           # fill JWT_SECRET, FRONTEND_URL
docker-compose up -d --build
docker-compose exec backend node src/db/seed.js
```

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/auth/me | User info |
| GET | /api/sponsors | List sponsors |
| POST | /api/sponsors | Add sponsor |
| GET | /api/stats/dashboard | Dashboard KPIs |
| GET | /api/stats/events | Live events |
| GET | /api/health | Health check |

## Local Dev (Windows)

**Terminal 1 — Backend:**
```powershell
cd backend
npm install
copy .env.example .env
node src/db/seed.js
npm run dev
```

**Terminal 2 — Frontend:**
```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```
