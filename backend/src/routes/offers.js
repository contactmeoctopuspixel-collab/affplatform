// src/routes/offers.js
const express = require("express");
const db = require("../db");
const { authMiddleware, requireEditor } = require("../middleware/auth");
const { syncAllOffers } = require("../services/offersSync");
const router = express.Router();
router.use(authMiddleware);

// POST /api/offers/sync — fetch all offers from all affiliate networks
router.post("/sync", requireEditor, async (req, res) => {
  try {
    const result = await syncAllOffers();
    const wss = req.app.get("wss");
    if (wss) {
      const msg = JSON.stringify({ type: "offers_synced", ...result });
      wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
    }
    res.json({ success: true, ...result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/offers
router.get("/", async (req, res) => {
  try {
    const { sponsor_id, status, category, q } = req.query;
    const query = {};
    if (sponsor_id) query.sponsor_id = sponsor_id;
    if (status)     query.status     = status;
    if (category)   query.category   = category;

    let offers = await db.offers.find(query);

    // Text search
    if (q) {
      const ql = q.toLowerCase();
      offers = offers.filter(o => o.name.toLowerCase().includes(ql) || o.id.includes(ql));
    }

    // Join sponsor info
    const sponsors = await db.sponsors.find({});
    const spMap = Object.fromEntries(sponsors.map(s => [s.id, s]));

    const enriched = offers.map(o => ({
      ...o,
      sponsor_name:  spMap[o.sponsor_id]?.name  || o.sponsor_id,
      sponsor_color: spMap[o.sponsor_id]?.color || "#cdd6e0",
      cr:            o.clicks > 0 ? ((o.leads / o.clicks) * 100).toFixed(2) + "%" : "0.00%",
      est_revenue:   +(o.payout * o.leads).toFixed(2),
    }));

    res.json({ offers: enriched });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/offers
router.post("/", requireEditor, async (req, res) => {
  try {
    const { sponsor_id, name, payout, category, status, external_id } = req.body;
    if (!sponsor_id || !name || payout === undefined)
      return res.status(400).json({ error: "sponsor_id, name, payout required" });
    const cnt = await db.offers.count({ sponsor_id });
    const id = `OF-${sponsor_id.replace("SP","")}-${String(cnt+1).padStart(4,"0")}`;
    const offer = {
      _id: id, id, sponsor_id, name, payout,
      category:    category    || "General",
      status:      status      || "active",
      external_id: external_id || "",
      clicks: 0, leads: 0,
      created_at: new Date().toISOString()
    };
    await db.offers.insert(offer);
    res.status(201).json({ offer });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/offers/:id
router.patch("/:id", requireEditor, async (req, res) => {
  try {
    const update = {};
    for (const k of ["name","payout","category","status"]) if (req.body[k] !== undefined) update[k] = req.body[k];
    await db.offers.update({ id: req.params.id }, { $set: update });
    res.json({ message: "Updated" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/offers/clear-demo — delete all demo/seed offers (not imported from sponsors)
router.delete("/clear-demo", requireEditor, async (req, res) => {
  try {
    // Demo offers have IDs like "OF-4421", "OF-4422" etc (not sponsor-prefixed)
    const all = await db.offers.find({});
    const demoOffers = all.filter(o =>
      o.id.startsWith("OF-") && !o.id.match(/^SP\d+-.+/)
    );
    let deleted = 0;
    for (const o of demoOffers) {
      await db.offers.remove({ _id: o._id });
      deleted++;
    }
    res.json({ message: `Deleted ${deleted} demo offers`, deleted });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/offers/:id
router.delete("/:id", requireEditor, async (req, res) => {
  try { await db.offers.remove({ id: req.params.id }); res.json({ message: "Deleted" }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
