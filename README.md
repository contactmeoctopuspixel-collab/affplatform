# 🚀 AffIntel Platform v3 — Guide Complet

## 📁 Structure
```
affplatform/
├── backend/          ← Node.js + Express + NeDB
│   ├── src/
│   │   ├── db/       ← Database (NeDB pure JS)
│   │   ├── routes/   ← API routes
│   │   ├── services/ ← API proxy (Everflow, etc.)
│   │   ├── middleware/← Auth JWT
│   │   └── server.js ← Entry point
│   ├── .env.example
│   └── package.json
├── frontend/         ← React + Vite + Recharts
│   ├── src/
│   │   ├── App.jsx   ← Full app
│   │   └── api.js    ← API client
│   └── package.json
└── docker-compose.yml← VPS deployment
```

---

## 💻 LOCAL — First Time Setup

### Terminal 1 — Backend
```powershell
cd affplatform\backend
npm install
copy .env.example .env
node src\db\seed.js
npm run dev
```
✅ Backend: http://localhost:4000

### Terminal 2 — Frontend
```powershell
cd affplatform\frontend
npm install
copy .env.example .env
npm run dev
```
✅ Frontend: http://localhost:3000

---

## 🔄 LOCAL — Daily Use (already installed)

### Kill port si bloqué
```powershell
npx kill-port 4000
npx kill-port 3000
```

### Start backend
```powershell
cd affplatform\backend
npm run dev
```

### Start frontend
```powershell
cd affplatform\frontend
npm run dev
```

---

## 🔑 Login
| Role  | Email                      | Password  |
|-------|---------------------------|-----------|
| Admin | admin@affplatform.com     | admin123  |
| Team  | team@affplatform.com      | team123   |

---

## 🌐 API Sponsors — Everflow (M-M)
- **API Base:** `https://api.eflow.team/v1`
- **Header:** `X-Eflow-API-Key: YOUR_KEY`
- **Key location:** Everflow Dashboard → My Account → API tab
- **Working endpoint:** `GET /affiliates/affiliate?relationship=all`

---

## 🐳 VPS DEPLOYMENT

### 1. Install Docker sur VPS
```bash
curl -fsSL https://get.docker.com | sh
apt install docker-compose -y
```

### 2. Upload projet sur VPS
```bash
# Depuis ton PC (PowerShell)
scp -r affplatform/ user@VPS_IP:/home/user/

# Ou via FileZilla / WinSCP
```

### 3. Configure .env sur VPS
```bash
cd /home/user/affplatform
cp backend/.env.example backend/.env
nano backend/.env
```

Rempli:
```env
JWT_SECRET=mets_une_longue_chaine_aleatoire_ici_minimum_32_chars
FRONTEND_URL=http://VPS_IP_OU_DOMAIN
NODE_ENV=production
```

### 4. Build et Start
```bash
docker-compose up -d --build
```

### 5. Seed database (1 seule fois)
```bash
docker-compose exec backend node src/db/seed.js
```

### 6. Vérifier
```bash
docker-compose logs -f backend
curl http://localhost:4000/api/health
```

✅ App accessible: `http://VPS_IP`

---

## 🔧 Commandes utiles

### Restart backend seulement
```bash
docker-compose restart backend
```

### Voir logs
```bash
docker-compose logs -f
```

### Stop tout
```bash
docker-compose down
```

### Update (après modification code)
```bash
docker-compose up -d --build
```

---

## 📡 API Routes Backend

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/auth/me | User info |
| GET | /api/sponsors | List sponsors |
| POST | /api/sponsors | Add sponsor |
| PATCH | /api/sponsors/:id | Update sponsor |
| DELETE | /api/sponsors/:id | Delete sponsor |
| POST | /api/sponsors/:id/sync | Sync real data |
| POST | /api/sponsors/:id/test | Test API key |
| GET | /api/offers | List offers |
| GET | /api/stats/dashboard | Dashboard KPIs |
| GET | /api/stats/events | Live events |
| GET | /api/health | Health check |

---

## ⚡ WebSocket
- URL: `ws://localhost:4000/ws`
- Events: `new_event` (click/lead en temps réel)
- Auto-reconnect: 3 secondes

---

## 🛠 Troubleshooting

### Port already in use
```powershell
npx kill-port 4000
```

### Reset database
```powershell
cd affplatform\backend
Remove-Item -Recurse -Force data\
node src\db\seed.js
```

### npm install error (better-sqlite3)
Projet utilise **nedb-promises** — pure JS, aucune compilation nécessaire ✅

### Everflow API timeout
Normal pour `/affiliates/offers` — seul `/affiliates/affiliate?relationship=all` est stable.
