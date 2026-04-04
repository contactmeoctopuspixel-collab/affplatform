// src/routes/stats.js
const express = require("express");
const fetch   = require("node-fetch");
const { v4: uuid } = require("uuid");
const db = require("../db");
const { authMiddleware } = require("../middleware/auth");
const router = express.Router();
router.use(authMiddleware);

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
// GET /api/stats/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/dashboard", async (req, res) => {
  try {
    const sponsors = await db.sponsors.find({});
    const activeOffers  = await db.offers.count({ status: "active" });
    const connectedApis = sponsors.filter(s => s.status === "connected").length;

    // Date range
    const today   = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const fromDate = req.query.from || weekAgo;
    const toDate   = req.query.to   || today;

    // ── Fetch real stats per sponsor from Everflow API ────────────────────────
    let totalRevenue = 0, totalClicks = 0, totalLeads = 0;
    const sponsorBreakdownMap = {};

    for (const sp of sponsors) {
      if (!sp.api_key || sp.platform === "adsurf") {
        sponsorBreakdownMap[sp.id] = { revenue: 0, clicks: 0, leads: 0 };
        continue;
      }

      // Only call eflow reporting/daily for pure Everflow sponsors.
      // BizAglo/SphinxAds/Commission Shepherd use different internal endpoints —
      // their data is kept fresh by the auto-sync (every 2 min) stored in DB.
      if (sp.platform === "everflow") {
        try {
          const headers = {
            "X-Eflow-API-Key": sp.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
          };
          const r = await fetch("https://api.eflow.team/v1/affiliates/reporting/daily", {
            method: "POST", headers,
            body: JSON.stringify({
              from: fromDate, to: toDate,
              timezone_id: 67, currency_id: "USD",
              filters: {}, pagination: { page: 1, page_size: 100 },
            }),
            timeout: 15000,
          });
          if (r.ok) {
            const ct = r.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
              const data = await r.json();
              const s = data?.summary || {};
              const rev = s.revenue      || 0;
              const clk = s.total_click  || 0;
              const ld  = s.cv           || 0;
              // Use API result — but if it's all 0 and DB has real data, prefer DB
              const dbRev = sp.revenue || 0;
              const dbClk = sp.clicks  || 0;
              const dbLd  = sp.leads   || 0;
              const finalRev = rev > 0 ? rev : dbRev;
              const finalClk = clk > 0 ? clk : dbClk;
              const finalLd  = ld  > 0 ? ld  : dbLd;
              sponsorBreakdownMap[sp.id] = { revenue: finalRev, clicks: finalClk, leads: finalLd };
              totalRevenue += finalRev;
              totalClicks  += finalClk;
              totalLeads   += finalLd;
              continue;
            }
          }
        } catch {}
      }

      // For all other platforms (bizaglo, sphinxads, commissionshepherd, etc.)
      // use stored DB values kept fresh by auto-sync
      const rev = sp.revenue || 0;
      const clk = sp.clicks  || 0;
      const ld  = sp.leads   || 0;
      sponsorBreakdownMap[sp.id] = { revenue: rev, clicks: clk, leads: ld };
      totalRevenue += rev;
      totalClicks  += clk;
      totalLeads   += ld;
    }

    // ── Chart: real daily performance from API ────────────────────────────────
    let weeklyChart = [];
    const firstSp = sponsors.find(s => s.api_key && s.platform !== "adsurf");

    if (firstSp) {
      try {
        const headers = {
          "X-Eflow-API-Key": firstSp.api_key,
          "Content-Type": "application/json",
          "Accept": "application/json",
        };
        const r = await fetch("https://api.eflow.team/v1/affiliates/reporting/daily", {
          method: "POST", headers,
          body: JSON.stringify({
            from: fromDate, to: toDate,
            timezone_id: 67, currency_id: "USD",
            filters: {}, pagination: { page: 1, page_size: 100 },
          }),
          timeout: 15000,
        });
        if (r.ok) {
          const ct = r.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const data = await r.json();
            weeklyChart = (data?.performance || []).map(p => ({
              date:    new Date(p.unix * 1000).toISOString().slice(0, 10),
              revenue: p.reporting?.revenue     || 0,
              clicks:  p.reporting?.total_click || 0,
              leads:   p.reporting?.cv          || 0,
            }));
          }
        }
      } catch {}
    }

    // Fallback to DB
    if (!weeklyChart.length) {
      const allStats = await db.daily_stats.find({ date: { $gte: fromDate, $lte: toDate } }).sort({ date: 1 });
      const byDate = {};
      for (const s of allStats) {
        if (!byDate[s.date]) byDate[s.date] = { date: s.date, revenue: 0, clicks: 0, leads: 0 };
        byDate[s.date].revenue += s.revenue || 0;
        byDate[s.date].clicks  += s.clicks  || 0;
        byDate[s.date].leads   += s.leads   || 0;
      }
      weeklyChart = Object.values(byDate);
    }

    // ── Top offers ────────────────────────────────────────────────────────────
    const offers = await db.offers.find({ status: "active" });
    const spMap  = Object.fromEntries(sponsors.map(s => [s.id, s]));
    const topOffers = offers
      .map(o => ({ ...o, est_revenue: o.payout * o.leads, sponsor_name: spMap[o.sponsor_id]?.name, sponsor_color: spMap[o.sponsor_id]?.color }))
      .sort((a, b) => b.est_revenue - a.est_revenue)
      .slice(0, 5);

    // ── Sponsor breakdown ─────────────────────────────────────────────────────
    const sponsorBreakdown = sponsors.map(s => {
      const f = sponsorBreakdownMap[s.id] || {};
      return {
        id:      s.id,
        name:    s.name,
        color:   s.color || "#00ff9d",
        revenue: f.revenue ?? 0,
        clicks:  f.clicks  ?? 0,
        leads:   f.leads   ?? 0,
        status:  s.status,
      };
    });

    res.json({
      kpis: { totalRevenue, totalClicks, totalLeads, activeOffers, connectedApis, totalSponsors: sponsors.length },
      weeklyChart,
      topOffers,
      sponsorBreakdown,
      dateRange: { from: fromDate, to: toDate },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── EVENTS ───────────────────────────────────────────────────────────────────
router.get("/events", async (req, res) => {
  try {
    const limit    = Math.min(parseInt(req.query.limit) || 30, 100);
    const events   = await db.events.find({}).sort({ created_at: -1 });
    const sponsors = await db.sponsors.find({});
    const offers   = await db.offers.find({});
    const spMap    = Object.fromEntries(sponsors.map(s => [s.id, s]));
    const ofMap    = Object.fromEntries(offers.map(o => [o.id, o]));
    const enriched = events.slice(0, limit).map(e => ({
      ...e,
      offer_name:    ofMap[e.offer_id]?.name   || "Unknown",
      sponsor_name:  spMap[e.sponsor_id]?.name  || "Unknown",
      sponsor_color: spMap[e.sponsor_id]?.color || "#cdd6e0",
    }));
    res.json({ events: enriched });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── WEBHOOK ──────────────────────────────────────────────────────────────────
router.post("/events", async (req, res) => {
  try {
    const { offer_id, sponsor_id, event_type, revenue } = req.body;
    if (!["click","lead"].includes(event_type))
      return res.status(400).json({ error: "event_type must be click or lead" });
    const id = uuid();
    const ev = { _id: id, id, offer_id: offer_id||null, sponsor_id: sponsor_id||null, event_type, revenue: revenue||0, ip: req.ip, created_at: new Date().toISOString() };
    await db.events.insert(ev);
    if (offer_id) {
      if (event_type === "click") await db.offers.update({ id: offer_id }, { $inc: { clicks: 1 } });
      else await db.offers.update({ id: offer_id }, { $inc: { leads: 1 } });
    }
    const wss = req.app.get("wss");
    if (wss) {
      const sponsors = await db.sponsors.find({});
      const allOffers = await db.offers.find({});
      const spMap = Object.fromEntries(sponsors.map(s => [s.id, s]));
      const ofMap = Object.fromEntries(allOffers.map(o => [o.id, o]));
      const msg = JSON.stringify({ type: "new_event", event: { ...ev, offer_name: ofMap[offer_id]?.name, sponsor_name: spMap[sponsor_id]?.name, sponsor_color: spMap[sponsor_id]?.color } });
      wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
    }
    res.status(201).json({ id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── SUB-AFFILIATE LEADERBOARD ───────────────────────────────────────────────
const SUB_NAMES = {
  2:  "Oussama",
  3:  "Mohammed",
  4:  "Marouan",
  5:  "Imad",
  6:  "Mariam",
  7:  "Yousra",
  16: "Kaoutar",
  17: "Hafssa",
};

// Debug: returns raw Everflow sub2 API response — call GET /api/stats/sub-affiliates/debug
router.get("/sub-affiliates/debug", async (req, res) => {
  try {
    const today   = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const fromDate = req.query.from || weekAgo;
    const toDate   = req.query.to   || today;
    const sponsors = await db.sponsors.find({ api_key: { $exists: true, $ne: null } });
    const results = [];
    for (const sp of sponsors) {
      if (!sp.api_key || sp.platform === "adsurf") continue;
      const headers = { "X-Eflow-API-Key": sp.api_key, "Content-Type": "application/json", "Accept": "application/json" };
      const body = JSON.stringify({ from: fromDate, to: toDate, timezone_id: 67, currency_id: "USD", filters: {}, pagination: { page: 1, page_size: 50 } });
      try {
        const r = await fetch("https://api.eflow.team/v1/affiliates/reporting/conversions", { method: "POST", headers, body, timeout: 20000 });
        const text = await r.text();
        let json = null; try { json = JSON.parse(text); } catch {}
        const rows = json ? (json.conversions || json.performance || []) : [];
        results.push({ sponsor: sp.name, platform: sp.platform, status: r.status, total_rows: rows.length, sample: rows.slice(0, 2), keys: rows[0] ? Object.keys(rows[0]) : [] });
      } catch (e) {
        results.push({ sponsor: sp.name, error: e.message });
      }
    }
    res.json({ results, dateRange: { from: fromDate, to: toDate } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/sub-affiliates", async (req, res) => {
  try {
    const today   = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const fromDate = req.query.from || weekAgo;
    const toDate   = req.query.to   || today;

    const sponsors = await db.sponsors.find({ api_key: { $exists: true, $ne: null } });
    const totals = {};

    for (const sp of sponsors) {
      if (!sp.api_key || sp.platform === "adsurf") continue;
      try {
        const headers = {
          "X-Eflow-API-Key": sp.api_key,
          "Content-Type": "application/json",
          "Accept": "application/json",
        };
        // Use conversions endpoint — includes sub1/sub2/sub3 per conversion
        const r = await fetch("https://api.eflow.team/v1/affiliates/reporting/conversions", {
          method: "POST", headers,
          body: JSON.stringify({
            from: fromDate, to: toDate,
            timezone_id: 67, currency_id: "USD",
            filters: {}, pagination: { page: 1, page_size: 500 },
          }),
          timeout: 20000,
        });
        if (!r.ok) continue;
        const ct = r.headers.get("content-type") || "";
        if (!ct.includes("application/json")) continue;
        const data = await r.json();
        for (const row of (data.conversions || data.performance || [])) {
          // Everflow conversions have sub3 as a direct field
          const rawSub = row.sub3 ?? row.sub_id_3 ?? row["Sub3"] ?? "";
          const subId = parseInt(String(rawSub), 10);
          if (!subId || !SUB_NAMES[subId]) continue;
          if (!totals[subId]) totals[subId] = { id: subId, name: SUB_NAMES[subId], leads: 0, clicks: 0, revenue: 0 };
          // Each conversion row = 1 lead
          totals[subId].leads   += 1;
          totals[subId].revenue += Number(row.revenue || row.payout || 0);
          totals[subId].clicks  += Number(row.clicks  || 0);
        }
      } catch {}
    }

    const list = Object.values(totals).sort((a, b) => b.leads - a.leads || b.revenue - a.revenue);
    res.json({ sub_affiliates: list, dateRange: { from: fromDate, to: toDate } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── HOURLY ───────────────────────────────────────────────────────────────────
router.get("/hourly", async (req, res) => {
  try {
    const since  = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const events = await db.events.find({ created_at: { $gt: since } });
    const byHour = {};
    for (const e of events) {
      const h = e.created_at.slice(11, 13);
      if (!byHour[h]) byHour[h] = { hour: h, clicks: 0, leads: 0, revenue: 0 };
      if (e.event_type === "click") byHour[h].clicks++;
      else { byHour[h].leads++; byHour[h].revenue += e.revenue || 0; }
    }
    res.json({ hours: Object.values(byHour).sort((a, b) => a.hour.localeCompare(b.hour)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
