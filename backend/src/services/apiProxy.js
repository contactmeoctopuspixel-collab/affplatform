// src/services/apiProxy.js
const https = require("https");
const fetch = require("node-fetch");
const db = require("../db");

// Native HTTPS POST — avoids node-fetch hang on long-running Everflow queries
function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(body);
    const req = https.request(
      { hostname, path, method: "POST", headers: { ...headers, "Content-Length": buf.length, "Connection": "close" } },
      res => {
        let data = "";
        res.on("data", c => (data += c));
        res.on("end", () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error("Request timeout")); });
    req.write(buf);
    req.end();
  });
}

// ─── EVERFLOW ─────────────────────────────────────────────────────────────────
// API base: https://api.eflow.team/v1/
// Auth header: X-Eflow-API-Key: YOUR_KEY
async function fetchEverflow(baseUrl, apiKey) {
  if (!apiKey) return { error: "No API key configured" };

  const API = "https://api.eflow.team/v1";
  const today   = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const headers = { "X-Eflow-API-Key": apiKey, "Content-Type": "application/json", "Accept": "application/json" };

  try {
    // 1. Affiliate info + stats (only this endpoint — others timeout)
    const affiliateRes = await fetch(`${API}/affiliates/affiliate?relationship=all`, { headers, timeout: 15000 });

    // Parse affiliate info
    let affiliateData = null;
    if (affiliateRes.ok) {
      const ct = affiliateRes.headers.get("content-type") || "";
      if (ct.includes("application/json")) affiliateData = await affiliateRes.json();
    }

    if (!affiliateData) return { error: "API key invalid or no access" };

    const reporting = affiliateData.relationship?.reporting || {};
    const normalized = {
      affiliate_id: affiliateData.network_affiliate_id,
      name:         affiliateData.name,
      clicks:       reporting.total_click    || 0,
      leads:        reporting.cv             || 0,
      revenue:      reporting.revenue        || 0,
      cvr:          reporting.cvr            || 0,
      rpc:          reporting.rpc            || 0,
      offers:       [],
      report:       [],
    };

    // 2. Fetch Active Offers
    try {
      const offersRes = await fetch(`${API}/affiliates/offers?page_size=1000&relationship=all`, { headers, timeout: 15000 });
      if (offersRes.ok) {
        const odata = await offersRes.json();
        normalized.offers = odata.offers || [];
      }
    } catch (e) {
      console.log("[apiProxy] Failed to fetch offers:", e.message);
    }

    return { success: true, data: normalized };

  } catch (e) {
    return { error: e.message };
  }
}

// ─── BIZAGLO / SPHINXADS shared helper ────────────────────────────────────────
// Both use api.eflow.team with X-Eflow-API-Key — use native https to avoid node-fetch hang
async function fetchEflowDashboard(apiKey) {
  if (!apiKey) return { error: "No API key configured" };

  const headers = {
    "X-Eflow-API-Key": apiKey,
    "Content-Type":    "application/json",
    "Accept":          "application/json",
  };

  try {
    const { status, body: data } = await httpsPost(
      "api.eflow.team",
      "/v1/affiliates/dashboard/summary",
      headers,
      JSON.stringify({ timezone_id: 67, currency_id: "USD" })
    );

    if (status !== 200) return { error: data?.error || data?.message || `HTTP ${status}` };

    const pick = (obj) => {
      if (obj?.today         > 0) return obj.today;
      if (obj?.current_month > 0) return obj.current_month;
      return 0;
    };

    const result = {
      success: true,
      data: {
        clicks:  pick(data.click),
        leads:   pick(data.conversion),
        revenue: pick(data.revenue),
        cvr:     pick(data.cvr),
        current_month: {
          clicks:  data.click?.current_month       || 0,
          leads:   data.conversion?.current_month  || 0,
          revenue: data.revenue?.current_month     || 0,
        },
        last_month: {
          clicks:  data.click?.last_month      || 0,
          leads:   data.conversion?.last_month || 0,
          revenue: data.revenue?.last_month    || 0,
        },
        offers: [],
      }
    };

    // Try to fetch some offers for the dashboard list
    try {
      const { body: odata } = await httpsPost(
        "api.eflow.team",
        "/v1/affiliates/offers?page_size=100&relationship=all",
        headers,
        "{}"
      );
      if (odata && odata.offers) {
        result.data.offers = odata.offers;
      }
    } catch (e) {
      console.log("[apiProxy] Failed to fetch offers for dashboard:", e.message);
    }

    return result;
  } catch (e) {
    return { error: e.message };
  }
}

// ─── BIZAGLO ─────────────────────────────────────────────────────────────────
async function fetchBizAglo(apiKey)   { return fetchEflowDashboard(apiKey); }

// ─── SPHINXADS ────────────────────────────────────────────────────────────────
async function fetchSphinxAds(apiKey) { return fetchEflowDashboard(apiKey); }

// ─── ADSURF ──────────────────────────────────────────────────────────────────
// AdSurf uses Laravel session cookies — no public API key support
// Manual data entry only
async function fetchAdSurf(apiKey) {
  return {
    error: "AdSurf Network does not support API key authentication. Please update stats manually in Settings.",
    manual: true,
  };
}

// ─── MASTER FETCH + SYNC ──────────────────────────────────────────────────────
async function fetchAndSync(sponsorId) {
  const sponsor = await db.sponsors.findOne({ id: sponsorId });
  if (!sponsor)         return { error: "Sponsor not found" };
  if (!sponsor.api_key) return { error: "No API key configured", noKey: true };

  let result;
  switch (sponsor.platform) {
    case "everflow":  result = await fetchEverflow(sponsor.base_url, sponsor.api_key); break;
    case "bizaglo":   result = await fetchBizAglo(sponsor.api_key);   break;
    case "sphinxads": result = await fetchSphinxAds(sponsor.api_key); break;
    case "adsurf":    result = await fetchAdSurf(sponsor.api_key);    break;
    default: result = { error: `Unknown platform: ${sponsor.platform}` };
  }

  const now    = new Date().toISOString();
  const status = result.success ? "connected" : "error";

  // Update sponsor stats in DB from real API data
  if (result.success && result.data) {
    const d = result.data;
    await db.sponsors.update({ id: sponsorId }, {
      $set: {
        status,
        last_sync: now,
        ...(d.clicks  !== undefined && { clicks:  d.clicks  }),
        ...(d.leads   !== undefined && { leads:   d.leads   }),
        ...(d.revenue !== undefined && { revenue: d.revenue }),
      },
    });

    // Save daily stat snapshot
    const today = now.slice(0, 10);
    await db.daily_stats.remove({ _id: `${sponsorId}-${today}` }, {});
    await db.daily_stats.insert({
      _id: `${sponsorId}-${today}`, sponsor_id: sponsorId, date: today,
      revenue: d.revenue || 0, clicks: d.clicks || 0, leads: d.leads || 0,
    });

    // Sync offers if available
    if (d.offers && Array.isArray(d.offers) && d.offers.length > 0) {
      for (const o of d.offers) {
        const rawId = String(o.network_offer_id || o.offer_id || o.id || "");
        if (!rawId) continue;
        const offerId = `${sponsorId}-${rawId}`;
        const name = o.name || o.offer_name || `Offer ${rawId}`;
        const payout = o.payout || o.default_goal_name?.payout || 0;
        const status = (o.status === "active" || o.status === 1) ? "active" : "paused";

        await db.offers.update(
          { _id: offerId },
          { 
            $set: { 
              id: offerId, 
              sponsor_id: sponsorId,
              name, 
              payout: parseFloat(payout),
              status,
              external_id: rawId,
              updated_at: now
            },
            $setOnInsert: { created_at: now }
          },
          { upsert: true }
        );
      }
    }
  } else {
    await db.sponsors.update({ id: sponsorId }, { $set: { status, last_sync: now } });
  }

  return result;
}

async function testConnection(sponsorId) {
  const result = await fetchAndSync(sponsorId);
  if (result.noKey)   return { ok: false, message: "No API key configured" };
  if (result.error)   return { ok: false, message: result.error };
  const d = result.data;
  return {
    ok: true,
    message: `✓ Connected — Clicks: ${d.clicks}, Leads: ${d.leads}, Revenue: $${d.revenue}`,
  };
}

module.exports = { fetchAndSync, testConnection };
