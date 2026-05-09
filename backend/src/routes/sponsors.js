// src/routes/sponsors.js
const express = require("express");
const db = require("../db");
const { authMiddleware, requireAdmin, requireEditor } = require("../middleware/auth");
const { fetchAndSync, testConnection } = require("../services/apiProxy");
const router = express.Router();
router.use(authMiddleware);

const mask = (s) => ({ ...s, api_key: undefined, hasKey: !!s.api_key });

// GET /api/sponsors
router.get("/", async (req, res) => {
  try {
    const sponsors = await db.sponsors.find({});
    // Add offer_count
    const result = await Promise.all(sponsors.map(async s => {
      const cnt = await db.offers.count({ sponsor_id: s.id });
      return { ...mask(s), offer_count: cnt };
    }));
    res.json({ sponsors: result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sponsors
router.post("/", requireEditor, async (req, res) => {
  try {
    const { name, base_url, platform, api_key, color } = req.body;
    if (!name || !base_url || !platform) return res.status(400).json({ error: "name, base_url, platform required" });
    const cnt = await db.sponsors.count({});
    const id = "SP" + String(cnt + 1).padStart(3, "0");
    const sp = { _id: id, id, name, base_url, platform, api_key: api_key || null, color: color || "#00ff9d", status: "pending", revenue: 0, clicks: 0, leads: 0, created_by: req.user.id, created_at: new Date().toISOString() };
    await db.sponsors.insert(sp);
    res.status(201).json({ sponsor: mask(sp) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/sponsors/:id
router.patch("/:id", requireEditor, async (req, res) => {
  try {
    const update = {};
    const allowed = ["name","base_url","color","api_key","status"];
    for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];
    await db.sponsors.update({ id: req.params.id }, { $set: update });
    res.json({ message: "Updated" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/sponsors/:id
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await db.sponsors.remove({ id: req.params.id });
    res.json({ message: "Deleted" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sponsors/:id/sync
router.post("/:id/sync", requireEditor, async (req, res) => {
  try {
    await db.sponsors.update({ id: req.params.id }, { $set: { status: "syncing" } });
    const wss = req.app.get("wss");
    if (wss) bcast(wss, { type: "sponsor_syncing", sponsorId: req.params.id });
    const result = await fetchAndSync(req.params.id);
    if (wss) bcast(wss, { type: "sponsor_synced", sponsorId: req.params.id, ok: !!result.success });
    if (result.error) return res.status(502).json({ error: result.error, noKey: result.noKey });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sponsors/:id/test
router.post("/:id/test", requireEditor, async (req, res) => {
  try { res.json(await testConnection(req.params.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sponsors/:id/manual — manual stats update (for AdSurf etc.)
router.post("/:id/manual", requireEditor, async (req, res) => {
  try {
    const { revenue, clicks, leads } = req.body;
    const update = {};
    if (revenue !== undefined) update.revenue = parseFloat(revenue);
    if (clicks  !== undefined) update.clicks  = parseInt(clicks);
    if (leads   !== undefined) update.leads   = parseInt(leads);
    update.last_sync = new Date().toISOString();
    update.status = "connected";
    await db.sponsors.update({ id: req.params.id }, { $set: update });

    // Save daily stat
    const today = new Date().toISOString().slice(0, 10);
    await db.daily_stats.remove({ _id: `${req.params.id}-${today}` }, {});
    await db.daily_stats.insert({ _id: `${req.params.id}-${today}`, sponsor_id: req.params.id, date: today, ...update });

    res.json({ message: "Stats updated manually" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sponsors/:id/stats
router.get("/:id/stats", async (req, res) => {
  try {
    const stats = await db.daily_stats.find({ sponsor_id: req.params.id }).sort({ date: 1 });
    res.json({ stats });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

function bcast(wss, data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

module.exports = router;
