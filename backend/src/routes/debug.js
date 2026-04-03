// src/routes/debug.js
const express = require("express");
const fetch = require("node-fetch");
const db = require("../db");
const { authMiddleware } = require("../middleware/auth");
const router = express.Router();
router.use(authMiddleware);

router.get("/everflow/:sponsorId", async (req, res) => {
  const sponsor = await db.sponsors.findOne({ id: req.params.sponsorId });
  if (!sponsor)       return res.status(404).json({ error: "Sponsor not found" });
  if (!sponsor.api_key) return res.status(400).json({ error: "No API key set" });

  const base    = sponsor.base_url.replace(/\/$/, "");
  const apiKey  = sponsor.api_key;
  const today   = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const headers = { "X-Eflow-API-Key": apiKey, "Content-Type": "application/json", "Accept": "application/json" };

  const tests = [
    { name: "offer_categories (GET)",  url: `${base}/api/v1/affiliate/offer_categories`,  method: "GET" },
    { name: "offers/finds (POST)",     url: `${base}/api/v1/affiliate/offers/finds`,       method: "POST", body: JSON.stringify({ page: 1, page_size: 5 }) },
    { name: "conversions (POST)",      url: `${base}/api/v1/affiliate/conversions`,        method: "POST", body: JSON.stringify({ from: weekAgo, to: today, timezone_id: 67, currency_id: "USD", pagination: { page: 1, page_size: 5 } }) },
    { name: "clicks (POST)",           url: `${base}/api/v1/affiliate/clicks`,             method: "POST", body: JSON.stringify({ from: weekAgo, to: today, timezone_id: 67, pagination: { page: 1, page_size: 5 } }) },
  ];

  const results = [];
  for (const t of tests) {
    try {
      const r   = await fetch(t.url, { method: t.method, headers, body: t.body, timeout: 12000 });
      const ct  = r.headers.get("content-type") || "";
      const txt = await r.text();
      let parsed = null;
      try { parsed = JSON.parse(txt); } catch {}
      results.push({ name: t.name, status: r.status, is_json: !!parsed, response: parsed || txt.slice(0, 200), success: r.ok && !!parsed });
    } catch (e) {
      results.push({ name: t.name, error: e.message, success: false });
    }
  }

  res.json({
    sponsor: sponsor.name,
    base_url: base,
    key_masked: apiKey.slice(0, 4) + "••••" + apiKey.slice(-4),
    working: results.filter(r => r.success).map(r => r.name),
    results,
  });
});

module.exports = router;

// GET /api/debug/offers-list/:sponsorId — test offers list endpoint
router.get("/offers-list/:sponsorId", async (req, res) => {
  const sponsor = await db.sponsors.findOne({ id: req.params.sponsorId });
  if (!sponsor || !sponsor.api_key) return res.status(400).json({ error: "No sponsor or API key" });

  const headers = { "X-Eflow-API-Key": sponsor.api_key, "Content-Type": "application/json", "Accept": "application/json" };
  const results = [];

  const tests = [
    { name: "affiliates/offers GET",        url: "https://api.eflow.team/v1/affiliates/offers", method: "GET" },
    { name: "affiliates/offers POST",       url: "https://api.eflow.team/v1/affiliates/offers", method: "POST", body: JSON.stringify({ page: 1, page_size: 5 }) },
    { name: "affiliates/offers/finds POST", url: "https://api.eflow.team/v1/affiliates/offers/finds", method: "POST", body: JSON.stringify({ page: 1, page_size: 5 }) },
    { name: "network/offers GET",           url: "https://api.eflow.team/v1/networks/offers?page=1&page_size=5", method: "GET" },
  ];

  for (const t of tests) {
    try {
      const r = await require("node-fetch")(t.url, { method: t.method, headers, body: t.body, timeout: 12000 });
      const ct = r.headers.get("content-type") || "";
      const txt = await r.text();
      let parsed = null;
      try { parsed = JSON.parse(txt); } catch {}
      results.push({ name: t.name, status: r.status, is_json: !!parsed, response: parsed || txt.slice(0, 200), success: r.ok && !!parsed });
    } catch (e) {
      results.push({ name: t.name, error: e.message, success: false });
    }
  }
  res.json({ results, working: results.filter(r => r.success).map(r => r.name) });
});
