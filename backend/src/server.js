// src/server.js — AffIntel Backend v3
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const express  = require("express");
const cors     = require("cors");
const helmet   = require("helmet");
const morgan   = require("morgan");
const http     = require("http");
const { WebSocketServer } = require("ws");
const rateLimit = require("express-rate-limit");
const db = require("./db");
const { startLiveSync, syncOffersDaily } = require("./services/liveSync");

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 4000;
const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL_MINUTES) || 2;

// ── WebSocket ─────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: "/ws" });
app.set("wss", wss);

wss.on("connection", (ws) => {
  console.log(`🔌 WS client connected (${wss.clients.size} total)`);
  ws.send(JSON.stringify({ type: "connected", message: "AffIntel WS ready" }));

  // Handle incoming client messages (e.g. typing indicators)
  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);
      // Broadcast typing events to all OTHER clients
      if (msg.type === "typing") {
        wss.clients.forEach(c => {
          if (c !== ws && c.readyState === 1) {
            c.send(JSON.stringify(msg));
          }
        });
      }
    } catch (e) {}
  });

  ws.on("close", () => console.log(`🔌 WS disconnected (${wss.clients.size} remaining)`));
  ws.on("error", (e) => console.error("WS error:", e.message));
});

// ── Trust proxy (nginx reverse proxy) ─────────────────────────────────────────
app.set("trust proxy", 1);

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "http://localhost:5173", "http://localhost:4173",
  ],
  credentials: true,
}));
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
// Increase timeout for long-running requests (offer imports)
app.use((req, res, next) => { res.setTimeout(120000); next(); });
app.use("/api/", rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

// ── Postback from Everflow (public — no auth, called by Everflow server) ──────
// Configure in Everflow portal: Settings → Global Postback
// URL: https://affplatform.alphalink.it.com/api/postback?sub3={sub3}&revenue={payout}&offer_id={network_offer_id}&transaction_id={transaction_id}&sponsor={affiliate_name}
app.get("/api/postback", async (req, res) => {
  try {
    const { sub3, revenue, offer_id, transaction_id, sponsor, event_type = "cv", country } = req.query;
    if (!transaction_id) return res.status(400).send("missing transaction_id");
    const exists = await db.conversions.findOne({ transaction_id });
    if (exists) return res.send("ok duplicate");
    const COUNTRY_NAMES = {"united states":"US","usa":"US","united kingdom":"GB","uk":"GB","australia":"AU","new zealand":"NZ","canada":"CA","france":"FR","germany":"DE","italy":"IT","spain":"ES","netherlands":"NL","norway":"NO","finland":"FI","china":"CN","japan":"JP","india":"IN","brazil":"BR","mexico":"MX","russia":"RU","switzerland":"CH","sweden":"SE","denmark":"DK","belgium":"BE","austria":"AT","ireland":"IE","poland":"PL","czech republic":"CZ","portugal":"PT","greece":"GR","romania":"RO","turkey":"TR","egypt":"EG","south africa":"ZA","nigeria":"NG","morocco":"MA","algeria":"DZ","tunisia":"TN","uae":"AE","united arab emirates":"AE","saudi arabia":"SA","israel":"IL","ukraine":"UA","philippines":"PH","thailand":"TH","vietnam":"VN","indonesia":"ID","malaysia":"MY","singapore":"SG","hong kong":"HK","taiwan":"TW"};
    const raw = (country || "").trim().toLowerCase();
    const countryCode = COUNTRY_NAMES[raw] || raw.slice(0, 2).toUpperCase() || "";
    await db.conversions.insert({
      _id: transaction_id,
      transaction_id,
      sub3:     sub3 || "",
      revenue:  parseFloat(revenue || 0),
      offer_id: offer_id || "",
      sponsor:  sponsor || "",
      event_type,
      country: countryCode,
      created_at: new Date().toISOString(),
    });
    // Push live event to WS clients
    wss.clients.forEach(c => {
      if (c.readyState === 1) c.send(JSON.stringify({ type: "postback_conversion", sub3, revenue: parseFloat(revenue||0), offer_id }));
    });
    res.send("ok");
  } catch (e) { res.status(500).send("error: " + e.message); }
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",     require("./routes/auth"));
app.use("/api/sponsors", require("./routes/sponsors"));
app.use("/api/offers",   require("./routes/offers"));
app.use("/api/stats",    require("./routes/stats"));
app.use("/api/ai",       require("./routes/ai"));
app.use("/api/chat",     require("./routes/chat"));

// Debug routes (dev only)
if (process.env.NODE_ENV !== "production") {
  app.use("/api/debug", require("./routes/debug"));
}

// Health check
app.get("/api/health", async (req, res) => {
  const cnt = await db.sponsors.count({});
  res.json({
    status: "ok", version: "3.0.0",
    sponsors: cnt,
    ws_clients: wss.clients.size,
    uptime: process.uptime().toFixed(1) + "s",
    sync_interval: SYNC_INTERVAL + " min",
  });
});

// Serve frontend SPA for all non-API routes (fixes /chat, /suggest, etc.)
const path = require("path");
const FRONTEND_DIST = path.join(__dirname, "../../frontend/dist");
if (require("fs").existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get("*", (req, res) => res.sendFile(path.join(FRONTEND_DIST, "index.html")));
} else {
  app.use((req, res) => res.status(404).json({ error: "Not found" }));
}
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: "Server error" }); });

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀 AffIntel Backend  →  http://localhost:${PORT}`);
  console.log(`   WebSocket         →  ws://localhost:${PORT}/ws`);
  console.log(`   Health            →  http://localhost:${PORT}/api/health`);
  console.log(`   Live sync         →  every ${SYNC_INTERVAL} min\n`);

  // Start live auto-sync
  startLiveSync(wss, SYNC_INTERVAL);
});
