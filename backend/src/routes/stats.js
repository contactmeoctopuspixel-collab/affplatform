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

    // ── Top offers — show best offers from active sponsors in period ──────────
    const offers = await db.offers.find({ status: "active" });
    const spMap  = Object.fromEntries(sponsors.map(s => [s.id, s]));

    // Sponsors that had leads OR revenue in the period
    const activeSponsorsInPeriod = new Set(
      Object.entries(sponsorBreakdownMap)
        .filter(([, v]) => v.leads > 0 || v.revenue > 0)
        .map(([k]) => k)
    );

    const topOffers = offers
      .filter(o => (o.leads || 0) > 0 && activeSponsorsInPeriod.has(o.sponsor_id))
      .map(o => {
        const sp = spMap[o.sponsor_id];
        return {
          ...o,
          est_revenue:   o.payout * o.leads,
          sponsor_name:  sp?.name,
          sponsor_color: sp?.color,
        };
      })
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


router.get("/sub-affiliates", async (req, res) => {
  try {
    const today   = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const fromDate = req.query.from || weekAgo;
    const toDate   = req.query.to   || today;

    const toEnd    = toDate   + "T23:59:59.999Z";
    const fromStart = fromDate + "T00:00:00.000Z";
    const conversions = await db.conversions.find({
      created_at: { $gte: fromStart, $lte: toEnd },
      event_type: { $ne: "click" },
    });

    const totals = {};
    for (const cv of conversions) {
      const subId = parseInt(String(cv.sub3 || ""), 10);
      if (!subId || !SUB_NAMES[subId]) continue;
      if (!totals[subId]) totals[subId] = { id: subId, name: SUB_NAMES[subId], leads: 0, revenue: 0 };
      totals[subId].leads   += 1;
      totals[subId].revenue += cv.revenue || 0;
    }

    const list = Object.values(totals).sort((a, b) => b.leads - a.leads || b.revenue - a.revenue);
    const total = await db.conversions.count({});
    res.json({ sub_affiliates: list, total_conversions: conversions.length, total_in_db: total, dateRange: { from: fromDate, to: toDate } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── IMPORT CONVERSIONS FROM EVERFLOW ────────────────────────────────────────
router.post("/import-conversions", async (req, res) => {
  try {
    const today   = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const fromDate = req.body?.from || weekAgo;
    const toDate   = req.body?.to   || today;

    const sponsors = await db.sponsors.find({ api_key: { $exists: true, $ne: null } });
    let imported = 0;
    let tried = 0;
    const errors = [];

    for (const sp of sponsors) {
      if (!sp.api_key || sp.platform === "adsurf") continue;
      tried++;
      const headers = { "X-Eflow-API-Key": sp.api_key, "Content-Type": "application/json", "Accept": "application/json" };

      // Try multiple body formats for the conversions endpoint
      const bodies = [
        { from: fromDate, to: toDate, timezone_id: 67, currency_id: "USD", filters: {}, pagination: { page: 1, page_size: 500 } },
        { from: fromDate, to: toDate, timezone_id: 67, currency_id: "USD", page: 1, page_size: 500 },
        { from: fromDate, to: toDate, currency_id: "USD", pagination: { page: 1, page_size: 500 } },
        { from: fromDate, to: toDate, timezone_id: 67 },
      ];

      let data = null;
      for (const body of bodies) {
        try {
          const r = await fetch("https://api.eflow.team/v1/affiliates/reporting/conversions", {
            method: "POST", headers, body: JSON.stringify(body), timeout: 20000,
          });
          if (r.ok) {
            const ct = r.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
              const j = await r.json();
              if (j.conversions || j.performance) { data = j; break; }
            }
          }
        } catch {}
      }

      if (!data) { errors.push(`${sp.name}: conversions API unavailable`); continue; }

      const rows = data.conversions || data.performance || [];
      for (const row of rows) {
        const txId = row.transaction_id || row.conversion_id || row.id || `${sp.id}-${row.click_date}-${Math.random()}`;
        const sub3 = String(row.sub3 || row.sub_id_3 || "");
        const revenue = parseFloat(row.revenue || row.payout || 0);
        const createdAt = row.conversion_date || row.created_at || new Date().toISOString();

        const exists = await db.conversions.findOne({ transaction_id: txId });
        if (exists) continue;
        await db.conversions.insert({
          _id: txId, transaction_id: txId,
          sub3, revenue, offer_id: String(row.offer_id || row.network_offer_id || ""),
          sponsor: sp.name, event_type: "cv",
          created_at: new Date(createdAt).toISOString(),
        });
        imported++;
      }
    }

    res.json({ ok: true, imported, tried, errors, dateRange: { from: fromDate, to: toDate } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── IMPORT CSV FROM EVERFLOW ─────────────────────────────────────────────────
// User exports CSV from Everflow Reports → Conversions, pastes here
router.post("/import-csv", async (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv || typeof csv !== "string") return res.status(400).json({ error: "No CSV provided" });

    const lines = csv.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return res.json({ imported: 0, error: "CSV too short" });

    // Parse header — find Sub3, Revenue, Transaction ID, Date columns
    const header = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
    const col = (names) => {
      for (const n of names) {
        const i = header.findIndex(h => h.includes(n));
        if (i >= 0) return i;
      }
      return -1;
    };

    const iSub3  = col(["sub3", "sub 3", "sub_3", "sub id 3"]);
    const iRev   = col(["revenue", "payout", "amount"]);
    const iTxId  = col(["transaction", "tx_id", "conv_id", "conversion id"]);
    const iDate  = col(["date", "conversion date", "conv date"]);

    if (iSub3 < 0) return res.json({ imported: 0, error: "Colonne Sub3 introuvable dans le CSV" });

    let imported = 0, skipped = 0;
    for (let i = 1; i < lines.length; i++) {
      // Handle quoted CSV fields
      const parts = lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || lines[i].split(",");
      const get = (idx) => idx >= 0 && parts[idx] ? parts[idx].replace(/"/g, "").trim() : "";

      const sub3 = get(iSub3);
      const subId = parseInt(sub3, 10);
      if (!subId || !SUB_NAMES[subId]) { skipped++; continue; }

      const revenue = parseFloat(get(iRev) || "0");
      const txId    = get(iTxId) || `csv-${i}-${sub3}-${Date.now()}`;
      const rawDate = get(iDate);
      const createdAt = rawDate
        ? new Date(rawDate.replace(/(\d+)\/(\d+)\/(\d+)(.*)/, "$3-$1-$2$4")).toISOString()
        : new Date().toISOString();

      const exists = await db.conversions.findOne({ transaction_id: txId });
      if (exists) { skipped++; continue; }

      await db.conversions.insert({
        _id: txId, transaction_id: txId,
        sub3: String(subId), revenue, offer_id: "",
        sponsor: "csv-import", event_type: "cv",
        created_at: createdAt,
      });
      imported++;
    }

    res.json({ imported, skipped, total: lines.length - 1 });
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
