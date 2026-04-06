// src/services/offersSync.js
const https = require("https");
const db    = require("../db");

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
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("Request timeout")); });
    req.write(buf);
    req.end();
  });
}

// Native HTTPS GET
function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method: "GET", headers: { ...headers, "Connection": "close" } },
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
    req.setTimeout(20000, () => { req.destroy(); reject(new Error("GET timeout")); });
    req.end();
  });
}

// Fetch offer details (tracking URL, preview URL) from Everflow affiliate API
async function fetchOfferDetails(apiKey, externalId) {
  const headers = {
    "X-Eflow-API-Key": apiKey,
    "Content-Type":    "application/json",
    "Accept":          "application/json",
  };
  try {
    const { status, body } = await httpsGet("api.eflow.team", `/v1/affiliates/offers/${externalId}`, headers);
    if (status !== 200 || !body || typeof body !== "object") return null;
    return body;
  } catch { return null; }
}

// Fetch creatives for an offer (banners + email with from/subject)
async function fetchOfferCreatives(apiKey, externalId) {
  const headers = {
    "X-Eflow-API-Key": apiKey,
    "Content-Type":    "application/json",
    "Accept":          "application/json",
  };
  try {
    const { status, body } = await httpsGet("api.eflow.team", `/v1/affiliates/offers/${externalId}/creatives`, headers);
    if (status !== 200 || !body || typeof body !== "object") return null;
    return body;
  } catch { return null; }
}

// Extract tracking URL from offer detail response
function extractTrackingUrl(detail) {
  if (!detail) return "";
  return detail.tracking_url
    || detail.preview_url
    || detail.offer_url
    || detail.landing_page_url
    || detail.url
    || "";
}

// Extract from_name + subject from creatives response (email creatives)
function extractEmailCreatives(creativesBody) {
  const result = { from_name: "", subject: "", creatives: "" };
  if (!creativesBody) return result;

  // creatives array may be at root or nested
  const arr = Array.isArray(creativesBody)
    ? creativesBody
    : (creativesBody.creatives || creativesBody.data || creativesBody.results || []);

  const urls = [];
  for (const cr of arr) {
    // Email creative
    if (cr.type === "email" || cr.creative_type === "email" || cr.from || cr.subject_lines) {
      if (!result.from_name && (cr.from || cr.from_name)) result.from_name = cr.from || cr.from_name;
      if (!result.subject) {
        const subj = cr.subject || (cr.subject_lines && cr.subject_lines[0]);
        if (subj) result.subject = typeof subj === "object" ? subj.subject || subj.text || "" : subj;
      }
    }
    // Banner / image creative URLs
    const url = cr.url || cr.thumbnail_url || cr.preview_url || cr.image_url || cr.creative_url;
    if (url && !urls.includes(url)) urls.push(url);
  }

  result.creatives = urls.join("\n");
  return result;
}

function guessCategory(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("cloud") || n.includes("storage") || n.includes("drive")) return "Cloud Storage";
  if (n.includes("mcafee") || n.includes("norton") || n.includes("security") || n.includes("av ") || n.includes("antivirus")) return "Security";
  if (n.includes("vpn") || n.includes("nordvpn")) return "VPN";
  if (n.includes("forex") || n.includes("crypto") || n.includes("broker") || n.includes("trading")) return "Finance";
  if (n.includes("credit") || n.includes("loan") || n.includes("insurance")) return "Finance";
  if (n.includes("health") || n.includes("medvi") || n.includes("glp") || n.includes("pharma")) return "Health";
  if (n.includes("energy") || n.includes("gas") || n.includes("fuel") || n.includes("electric")) return "Energy";
  if (n.includes("dating") || n.includes("match") || n.includes("singles") || n.includes("mainstream")) return "Dating";
  if (n.includes("ecommerce") || n.includes("shop") || n.includes("gift") || n.includes("box") || n.includes("mystery")) return "eCommerce";
  if (n.includes("hosting") || n.includes("domain")) return "Hosting";
  if (n.includes("saas") || n.includes("software") || n.includes("app")) return "Software";
  if (n.includes("cpl") || n.includes("lead")) return "CPL";
  return "General";
}

// Fetch one date range from Everflow reporting endpoint
async function fetchEverflowRange(headers, from, to) {
  const body = JSON.stringify({
    from, to,
    timezone_id: 67, currency_id: "USD",
    columns: ["offer_id", "offer_name", "total_click", "cv", "revenue", "payout"],
    filters: {},
    pagination: { page: 1, page_size: 1000 },
  });

  try {
    const { status, body: data } = await httpsPost(
      "api.eflow.team",
      "/v1/affiliates/reporting/offer",
      headers,
      body
    );
    if (status !== 200) return [];
    return data?.table || [];
  } catch {
    return [];
  }
}

// Fetch ALL offers across multiple date ranges to include offers with 0 recent clicks
async function fetchEverflowOffers(apiKey) {
  if (!apiKey) return [];

  const headers = {
    "X-Eflow-API-Key": apiKey,
    "Content-Type":    "application/json",
    "Accept":          "application/json",
  };

  const d = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

  // Split into 90-day windows — each responds fast, together covers 2+ years
  const ranges = [
    { from: d(90),   to: d(0),    label: "last 90d"    },
    { from: d(180),  to: d(91),   label: "90-180d ago" },
    { from: d(365),  to: d(181),  label: "180-365d ago"},
    { from: "2023-01-01", to: d(366), label: "2023+"  },
  ];

  console.log(`📋 Fetching all offers from Everflow (${ranges.length} date ranges)...`);

  const seen   = new Map(); // external_id → merged offer
  let total = 0;

  for (const range of ranges) {
    const rows = await fetchEverflowRange(headers, range.from, range.to);
    console.log(`  ${range.label}: ${rows.length} rows`);
    total += rows.length;

    for (const r of rows) {
      const col = r.columns?.[0];
      if (!col?.id) continue;
      const extId = String(col.id);

      if (seen.has(extId)) {
        // Merge stats — keep the highest values across periods
        const existing = seen.get(extId);
        existing.clicks  += r.reporting?.total_click || 0;
        existing.leads   += r.reporting?.cv          || 0;
        existing.revenue += r.reporting?.revenue     || 0;
      } else {
        const cv  = r.reporting?.cv      || 0;
        const rev = r.reporting?.revenue || 0;
        seen.set(extId, {
          external_id: extId,
          name:        col.label || `Offer ${extId}`,
          clicks:      r.reporting?.total_click || 0,
          leads:       cv,
          revenue:     rev,
          payout:      cv > 0 ? +(rev / cv).toFixed(2) : 0,
          status:      "active",
          category:    guessCategory(col.label),
        });
      }
    }

    await new Promise(r => setTimeout(r, 200));
  }

  const allOffers = Array.from(seen.values());
  console.log(`  ✓ ${allOffers.length} unique offers (from ${total} total rows across ${ranges.length} ranges)`);
  return allOffers;
}

async function syncAllOffers() {
  const sponsors = await db.sponsors.find({});
  let totalImported = 0;
  let totalUpdated  = 0;
  const results = [];

  for (const sp of sponsors) {
    if (!sp.api_key) continue;

    let offers = [];
    switch (sp.platform) {
      case "everflow":
      case "bizaglo":
      case "sphinxads":
        offers = await fetchEverflowOffers(sp.api_key);
        break;
      default:
        continue;
    }

    let imported = 0, updated = 0;
    for (const o of offers) {
      if (!o.external_id) continue;
      const offerId  = `${sp.id}-${o.external_id}`;
      const existing = await db.offers.findOne({ _id: offerId });

      if (existing) {
        const updates = { updated_at: new Date().toISOString() };
        if (o.clicks  > 0) updates.clicks  = o.clicks;
        if (o.leads   > 0) updates.leads   = o.leads;
        if (o.revenue > 0) updates.revenue = o.revenue;
        if (o.payout  > 0 && !existing.payout) updates.payout = o.payout;
        // Backfill missing details fields
        if (!existing.tracking_url) updates._needsDetails = true;
        await db.offers.update({ _id: offerId }, { $set: updates });
        updated++;
        totalUpdated++;
      } else {
        await db.offers.insert({
          _id:         offerId, id: offerId,
          sponsor_id:  sp.id,
          name:        o.name,
          payout:      o.payout   || 0,
          clicks:      o.clicks   || 0,
          leads:       o.leads    || 0,
          revenue:     o.revenue  || 0,
          category:    o.category,
          status:      o.status   || "active",
          external_id: o.external_id,
          created_at:  new Date().toISOString(),
        });
        imported++;
        totalImported++;
      }

      // ── Fetch details + creatives (only for new offers or those missing tracking_url) ──
      const currentOffer = await db.offers.findOne({ _id: offerId });
      if ((sp.platform === "everflow" || sp.platform === "bizaglo" || sp.platform === "sphinxads")
          && currentOffer && !currentOffer.tracking_url) {
        try {
          const [detail, creativesBody] = await Promise.all([
            fetchOfferDetails(sp.api_key, o.external_id),
            fetchOfferCreatives(sp.api_key, o.external_id),
          ]);
          const trackingUrl = extractTrackingUrl(detail);
          const emailData   = extractEmailCreatives(creativesBody);

          const detailUpdate = {};
          if (trackingUrl)          detailUpdate.tracking_url = trackingUrl;
          if (emailData.from_name)  detailUpdate.from_name    = emailData.from_name;
          if (emailData.subject)    detailUpdate.subject      = emailData.subject;
          if (emailData.creatives)  detailUpdate.creatives    = emailData.creatives;
          detailUpdate._needsDetails = false;

          if (Object.keys(detailUpdate).length > 1) { // >1 because _needsDetails always set
            await db.offers.update({ _id: offerId }, { $set: detailUpdate });
            console.log(`  📎 ${o.name}: tracking URL + creatives fetched`);
          }
        } catch { /* non-blocking */ }
        await new Promise(r => setTimeout(r, 150));
      }
    }

    results.push({ sponsor: sp.name, found: offers.length, imported, updated });
    console.log(`📋 ${sp.name}: ${offers.length} found, ${imported} new, ${updated} updated`);
  }

  return { totalImported, totalUpdated, results };
}

module.exports = { syncAllOffers, fetchEverflowOffers };
