// src/routes/ai.js
const express = require("express");
const fetch   = require("node-fetch");
const db = require("../db");
const { getRecommendations, getScalingPlan } = require("../services/aiEngine");
const { syncAllOffers } = require("../services/offersSync");
const { authMiddleware, requireEditor } = require("../middleware/auth");
const router = express.Router();
router.use(authMiddleware);

// GET /api/ai/recommendations
router.get("/recommendations", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;
    const data  = await getRecommendations(limit);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/ai/scaling
router.get("/scaling", async (req, res) => {
  try {
    const target = parseFloat(req.query.target) || 1000;
    res.json(await getScalingPlan(target));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/ai/sync-offers — import all offers from all sponsors (runs in background)
router.post("/sync-offers", requireEditor, async (req, res) => {
  // Return immediately — sync runs in background to avoid nginx timeout
  res.json({ ok: true, message: "Sync started in background — check logs" });

  const { syncOfferDetails } = require("../services/offersSync");
  const wss = req.app.get("wss");
  try {
    const result = await syncAllOffers();
    if (wss) {
      const msg = JSON.stringify({ type: "offers_synced", ...result });
      wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
    }
    console.log(`✓ sync-offers done: ${result.totalImported} new, ${result.totalUpdated} updated`);
    // Fetch tracking URLs in background
    syncOfferDetails().catch(e => console.error("syncOfferDetails:", e.message));
    // Fetch from/subject/creatives from pxirbidlink in background
    const { syncAssetsFromPxirbid } = require("../services/pxirbidSync");
    syncAssetsFromPxirbid().catch(e => console.error("pxirbidSync:", e.message));
  } catch (e) { console.error("sync-offers background error:", e.message); }
});

// POST /api/ai/cleanup-offers — remove offers not seen in latest import
router.post("/cleanup-offers", requireEditor, async (req, res) => {
  try {
    const { sponsor_id, active_ids } = req.body;
    if (!sponsor_id || !Array.isArray(active_ids))
      return res.status(400).json({ error: "sponsor_id and active_ids required" });

    // Get all offers for this sponsor
    const allOffers = await db.offers.find({ sponsor_id });
    let removed = 0;

    for (const o of allOffers) {
      // If offer not in latest import → mark as expired
      if (o.external_id && !active_ids.includes(o.external_id)) {
        await db.offers.update({ _id: o._id }, { $set: { status: "expired" } });
        removed++;
      }
    }

    res.json({ removed, total: allOffers.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

// POST /api/ai/bulk-import — receive offers from frontend browser fetch
router.post("/bulk-import", requireEditor, async (req, res) => {
  try {
    const { sponsor_id, offers } = req.body;
    if (!sponsor_id || !Array.isArray(offers))
      return res.status(400).json({ error: "sponsor_id and offers array required" });

    const sp = await db.sponsors.findOne({ id: sponsor_id });
    if (!sp) return res.status(404).json({ error: "Sponsor not found" });

    let imported = 0, updated = 0;
    for (const o of offers) {
      if (!o.external_id && !o.id) continue;
      const extId   = String(o.external_id || o.id);
      const offerId = `${sponsor_id}-${extId}`;
      const existing = await db.offers.findOne({ _id: offerId });

      if (existing) {
        await db.offers.update({ _id: offerId }, { $set: {
          name:       o.name || existing.name,
          payout:     o.payout || existing.payout,
          status:     o.status || existing.status,
          category:   o.category || existing.category,
          updated_at: new Date().toISOString(),
        }});
        updated++;
      } else {
        await db.offers.insert({
          _id: offerId, id: offerId,
          sponsor_id,
          name:        o.name || `Offer ${extId}`,
          payout:      o.payout || 0,
          clicks:      o.clicks || 0,
          leads:       o.leads  || 0,
          category:    o.category || "General",
          status:      o.status || "active",
          external_id: extId,
          created_at:  new Date().toISOString(),
        });
        imported++;
      }
    }
    res.json({ imported, updated, total: offers.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/ai/fetch-offers-proxy
router.post("/fetch-offers-proxy", requireEditor, async (req, res) => {
  try {
    const { sponsor_id } = req.body;
    const sp = await db.sponsors.findOne({ id: sponsor_id });
    if (!sp)         return res.status(404).json({ error: "Sponsor not found" });
    if (!sp.api_key) return res.status(400).json({ error: "No API key configured" });

    const r = await fetch("https://api.eflow.team/v1/affiliates/reporting/offer", {
      method: "POST",
      headers: {
        "X-Eflow-API-Key": sp.api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        from: "2020-01-01", // Get ALL offers including those with no recent activity
        to: new Date().toISOString().slice(0, 10),
        timezone_id: 67,
        currency_id: "USD",
        columns: ["offer_id", "offer_name", "total_click", "cv", "revenue"],
        filters: {},
        pagination: { page: 1, page_size: 500 },
      }),
      timeout: 60000,
    });

    if (!r.ok) return res.status(r.status).json({ error: `HTTP ${r.status}` });

    const data = await r.json();
    const rows = data?.table || [];

    // Deduplicate
    const seen = new Set();
    const unique = rows.filter(row => {
      const id = row.columns?.[0]?.id;
      if (!id || seen.has(String(id))) return false;
      seen.add(String(id));
      return true;
    });

    console.log(`[proxy] ${sp.name}: ${unique.length} unique offers`);
    res.json({ rows: unique, total: unique.length });

  } catch (e) {
    console.error("[proxy] error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/ai/bulk-import — receive offers from frontend browser fetch
router.post("/bulk-import", requireEditor, async (req, res) => {
  try {
    const { sponsor_id, offers } = req.body;
    if (!sponsor_id || !Array.isArray(offers))
      return res.status(400).json({ error: "sponsor_id and offers array required" });

    const sp = await db.sponsors.findOne({ id: sponsor_id });
    if (!sp) return res.status(404).json({ error: "Sponsor not found" });

    let imported = 0, updated = 0;
    for (const o of offers) {
      if (!o.external_id && !o.id) continue;
      const extId   = String(o.external_id || o.id);
      const offerId = `${sponsor_id}-${extId}`;
      const existing = await db.offers.findOne({ _id: offerId });

      if (existing) {
        await db.offers.update({ _id: offerId }, { $set: {
          name:       o.name || existing.name,
          payout:     o.payout || existing.payout,
          status:     o.status || existing.status,
          category:   o.category || existing.category,
          updated_at: new Date().toISOString(),
        }});
        updated++;
      } else {
        await db.offers.insert({
          _id: offerId, id: offerId,
          sponsor_id,
          name:        o.name || `Offer ${extId}`,
          payout:      o.payout || 0,
          clicks:      o.clicks || 0,
          leads:       o.leads  || 0,
          category:    o.category || "General",
          status:      o.status || "active",
          external_id: extId,
          created_at:  new Date().toISOString(),
        });
        imported++;
      }
    }
    res.json({ imported, updated, total: offers.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/ai/fetch-offers-proxy — fetch all unique offers across all visibilities
router.post("/fetch-offers-proxy", requireEditor, async (req, res) => {
  try {
    const { sponsor_id } = req.body;
    const sp = await db.sponsors.findOne({ id: sponsor_id });
    if (!sp)         return res.status(404).json({ error: "Sponsor not found" });
    if (!sp.api_key) return res.status(400).json({ error: "No API key configured" });

    // Always use api.eflow.team — NOT the sponsor base_url (which is just the frontend SPA)
    const API_BASE = "https://api.eflow.team/v1";
    const today    = new Date().toISOString().slice(0, 10);
    const twoYears = "2025-01-01"; // Fixed date that works
    const headers  = { "X-Eflow-API-Key": sp.api_key, "Content-Type": "application/json", "Accept": "application/json" };

    const allRows = [];
    const seen    = new Set();

    // Fetch multiple pages to get all offers
    for (let page = 1; page <= 10; page++) {
      try {
        const r = await fetch(`${API_BASE}/affiliates/reporting/offer`, {
          method: "POST", headers,
          body: JSON.stringify({
            from: twoYears, to: today,
            timezone_id: 67, currency_id: "USD",
            columns: ["offer_id", "offer_name", "total_click", "cv", "revenue"],
            filters: {}, pagination: { page, page_size: 100 },
          }),
          timeout: 30000,
        });
        console.log(`[proxy] page ${page} status: ${r.status} ct: ${r.headers.get("content-type")}`);
        if (!r.ok) { console.log(`[proxy] not ok, stopping`); break; }
        const ct = r.headers.get("content-type") || "";
        if (!ct.includes("application/json")) { console.log(`[proxy] not JSON, body:`, (await r.text()).slice(0,100)); break; }
        const data = await r.json();
        const rows = data?.table || [];
        console.log(`[proxy] page ${page} rows: ${rows.length}, keys: ${Object.keys(data).join(",")}`);
        if (!rows.length) break;

        for (const row of rows) {
          const id = row.columns?.[0]?.id;
          if (!id || seen.has(String(id))) continue;
          seen.add(String(id));
          allRows.push(row);
        }

        if (rows.length < 100) break;
        await new Promise(r => setTimeout(r, 200));
      } catch { break; }
    }

    res.json({ rows: allRows, total: allRows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/ai/bulk-import — receive offers from frontend browser fetch
router.post("/bulk-import", requireEditor, async (req, res) => {
  try {
    const { sponsor_id, offers } = req.body;
    if (!sponsor_id || !Array.isArray(offers))
      return res.status(400).json({ error: "sponsor_id and offers array required" });

    const sp = await db.sponsors.findOne({ id: sponsor_id });
    if (!sp) return res.status(404).json({ error: "Sponsor not found" });

    let imported = 0, updated = 0;
    for (const o of offers) {
      if (!o.external_id && !o.id) continue;
      const extId   = String(o.external_id || o.id);
      const offerId = `${sponsor_id}-${extId}`;
      const existing = await db.offers.findOne({ _id: offerId });

      if (existing) {
        await db.offers.update({ _id: offerId }, { $set: {
          name:       o.name || existing.name,
          payout:     o.payout || existing.payout,
          status:     o.status || existing.status,
          category:   o.category || existing.category,
          updated_at: new Date().toISOString(),
        }});
        updated++;
      } else {
        await db.offers.insert({
          _id: offerId, id: offerId,
          sponsor_id,
          name:        o.name || `Offer ${extId}`,
          payout:      o.payout || 0,
          clicks:      o.clicks || 0,
          leads:       o.leads  || 0,
          category:    o.category || "General",
          status:      o.status || "active",
          external_id: extId,
          created_at:  new Date().toISOString(),
        });
        imported++;
      }
    }
    res.json({ imported, updated, total: offers.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/ai/fetch-offers-proxy — fetches ALL unique offers in ONE request
router.post("/fetch-offers-proxy", requireEditor, async (req, res) => {
  try {
    const { sponsor_id } = req.body;

    const sp = await db.sponsors.findOne({ id: sponsor_id });
    if (!sp)         return res.status(404).json({ error: "Sponsor not found" });
    if (!sp.api_key) return res.status(400).json({ error: "No API key configured" });

    const today    = new Date().toISOString().slice(0, 10);
    const lastYear = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);

    // Fetch with large page_size to get all in one shot
    const everflowRes = await fetch("https://api.eflow.team/v1/affiliates/reporting/offer", {
      method: "POST",
      headers: {
        "X-Eflow-API-Key": sp.api_key,
        "Content-Type":    "application/json",
        "Accept":          "application/json",
      },
      body: JSON.stringify({
        from:        lastYear,
        to:          today,
        timezone_id: 67,
        currency_id: "USD",
        columns:     ["offer_id", "offer_name", "total_click", "cv", "revenue"],
        filters:     {},
        pagination:  { page: 1, page_size: 999 }, // max possible
      }),
      timeout: 60000,
    });

    if (!everflowRes.ok) {
      return res.status(everflowRes.status).json({ error: `HTTP ${everflowRes.status}` });
    }

    const ct = everflowRes.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return res.status(502).json({ error: "Non-JSON response from Everflow" });
    }

    const data = await everflowRes.json();
    const rows = data?.table || [];

    // Deduplicate by offer ID
    const seen = new Set();
    const unique = [];
    for (const r of rows) {
      const id = r.columns?.[0]?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      unique.push(r);
    }

    res.json({ rows: unique, total: unique.length });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

// POST /api/ai/bulk-import — receive offers from frontend browser fetch
router.post("/bulk-import", requireEditor, async (req, res) => {
  try {
    const { sponsor_id, offers } = req.body;
    if (!sponsor_id || !Array.isArray(offers))
      return res.status(400).json({ error: "sponsor_id and offers array required" });

    const sp = await db.sponsors.findOne({ id: sponsor_id });
    if (!sp) return res.status(404).json({ error: "Sponsor not found" });

    let imported = 0, updated = 0;
    for (const o of offers) {
      if (!o.external_id && !o.id) continue;
      const extId   = String(o.external_id || o.id);
      const offerId = `${sponsor_id}-${extId}`;
      const existing = await db.offers.findOne({ _id: offerId });

      if (existing) {
        await db.offers.update({ _id: offerId }, { $set: {
          name:       o.name || existing.name,
          payout:     o.payout || existing.payout,
          status:     o.status || existing.status,
          category:   o.category || existing.category,
          updated_at: new Date().toISOString(),
        }});
        updated++;
      } else {
        await db.offers.insert({
          _id: offerId, id: offerId,
          sponsor_id,
          name:        o.name || `Offer ${extId}`,
          payout:      o.payout || 0,
          clicks:      o.clicks || 0,
          leads:       o.leads  || 0,
          category:    o.category || "General",
          status:      o.status || "active",
          external_id: extId,
          created_at:  new Date().toISOString(),
        });
        imported++;
      }
    }
    res.json({ imported, updated, total: offers.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/ai/fetch-offers-proxy — backend proxies Everflow request (no CORS)
router.post("/fetch-offers-proxy", requireEditor, async (req, res) => {
  try {
    const { sponsor_id, page = 1 } = req.body;

    const sp = await db.sponsors.findOne({ id: sponsor_id });
    if (!sp)          return res.status(404).json({ error: "Sponsor not found" });
    if (!sp.api_key)  return res.status(400).json({ error: "No API key configured" });

    const today = new Date().toISOString().slice(0, 10);

    const everflowRes = await fetch("https://api.eflow.team/v1/affiliates/reporting/offer", {
      method: "POST",
      headers: {
        "X-Eflow-API-Key": sp.api_key,
        "Content-Type":    "application/json",
        "Accept":          "application/json",
      },
      body: JSON.stringify({
        from:        new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10), // last 12 months
        to:          today,
        timezone_id: 67,
        currency_id: "USD",
        columns:     ["offer_id", "offer_name", "total_click", "cv", "revenue"],
        filters:     {},
        pagination:  { page, page_size: 100 },
      }),
      timeout: 60000,
    });

    if (!everflowRes.ok) {
      const txt = await everflowRes.text().catch(()=>"");
      return res.status(everflowRes.status).json({ error: `Everflow HTTP ${everflowRes.status}: ${txt.slice(0,100)}` });
    }

    const ct = everflowRes.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const txt = await everflowRes.text();
      return res.status(502).json({ error: "Non-JSON response from Everflow", preview: txt.slice(0,200) });
    }

    const data = await everflowRes.json();
    const rows = data?.table || [];

    // Deduplicate by offer ID
    const seen = new Set();
    const unique = rows.filter(r => {
      const id = r.columns?.[0]?.id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    res.json({ rows: unique, total: unique.length, page, hasMore: rows.length >= 100 });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
