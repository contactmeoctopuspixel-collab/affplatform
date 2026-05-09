// conversionSync.js — Auto-detect Everflow conversions endpoint + sync sub3 data
const fetch = require("node-fetch");
const db    = require("../db");

const SUB_NAMES = {
  2: "Oussama", 3: "Mohammed", 4: "Marouan",
  5: "Imad", 6: "Mariam", 7: "Yousra",
  16: "Kaoutar", 17: "Hafssa",
};

// Build attempts using the CORRECT body format discovered via DevTools
function buildAttempts(from, to) {
  // Correct body format as used by the Everflow portal (discovered via DevTools):
  // POST /v1/affiliates/reporting/conversions?page=1&page_size=100&order_field=conversion_unix_timestamp&order_direction=desc
  // Body: { timezone_id: 55, from, to, show_conversions: true, show_events: false, query: { filters: [], search_terms: [] } }

  const qsBase  = "order_field=conversion_unix_timestamp&order_direction=desc";
  const bodyBase = { from, to, show_conversions: true, show_events: false };

  return [
    // ── Exact format used by the portal (timezone 55) ─────────────────────────
    { method: "POST",
      path: `/v1/affiliates/reporting/conversions?page=1&page_size=100&${qsBase}`,
      body: { ...bodyBase, timezone_id: 55, query: { filters: [], search_terms: [] } } },
    // ── Same with page_size=500 ───────────────────────────────────────────────
    { method: "POST",
      path: `/v1/affiliates/reporting/conversions?page=1&page_size=500&${qsBase}`,
      body: { ...bodyBase, timezone_id: 55, query: { filters: [], search_terms: [] } } },
    // ── Without query object ──────────────────────────────────────────────────
    { method: "POST",
      path: `/v1/affiliates/reporting/conversions?page=1&page_size=100&${qsBase}`,
      body: { ...bodyBase, timezone_id: 55 } },
    // ── Try timezone_id 67 (UTC) ──────────────────────────────────────────────
    { method: "POST",
      path: `/v1/affiliates/reporting/conversions?page=1&page_size=100&${qsBase}`,
      body: { ...bodyBase, timezone_id: 67, query: { filters: [], search_terms: [] } } },
    // ── Minimal body, pagination in query string ──────────────────────────────
    { method: "POST",
      path: `/v1/affiliates/reporting/conversions?page=1&page_size=100&${qsBase}`,
      body: { from, to, timezone_id: 55 } },
    // ── With currency_id ──────────────────────────────────────────────────────
    { method: "POST",
      path: `/v1/affiliates/reporting/conversions?page=1&page_size=100&${qsBase}`,
      body: { ...bodyBase, timezone_id: 55, currency_id: "USD", query: { filters: [], search_terms: [] } } },
  ];
}

// Extract conversions array from any response shape
// Returns [] if endpoint works but no data, null if wrong format
function extractRows(json) {
  if (!json || typeof json !== "object") return null;
  const candidates = [
    json.conversions, json.conversion, json.data,
    json.performance, json.rows, json.results, json.report,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c; // return even if empty — endpoint works
  }
  if (Array.isArray(json)) return json;
  return null;
}

// Extract sub3 from a conversion row (try all possible field names)
function getSub3(row) {
  const val = row.sub3 ?? row.sub_3 ?? row["Sub3"] ?? row.sub_id_3 ??
              row.sub_id3 ?? row["sub 3"] ?? row.subid3 ?? "";
  return String(val).trim();
}

// Try all attempts for one sponsor, return { rows, attempt } of first success
async function detectAndFetch(apiKey, from, to) {
  const headers = {
    "X-Eflow-API-Key": apiKey,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  const attempts = buildAttempts(from, to);

  for (const att of attempts) {
    try {
      const opts = att.method === "GET"
        ? { method: "GET", headers, timeout: 20000 }
        : { method: "POST", headers, body: JSON.stringify(att.body), timeout: 20000 };

      const r = await fetch(`https://api.eflow.team${att.path}`, opts);
      const ct = r.headers.get("content-type") || "";

      if (!r.ok) {
        let errBody = "";
        try { errBody = await r.text(); } catch {}
        console.log(`[convSync] ${att.method} ${att.path.split("?")[0]} → ${r.status}: ${errBody.slice(0, 150)}`);
        continue;
      }

      if (!ct.includes("application/json")) {
        console.log(`[convSync] ${att.method} ${att.path.split("?")[0]} → 200 but content-type: ${ct}`);
        continue;
      }

      const json = await r.json();
      const rows = extractRows(json);
      if (!rows) {
        console.log(`[convSync] ${att.method} ${att.path.split("?")[0]} → 200 JSON but no rows. Keys: ${Object.keys(json).join(",")}`);
        continue;
      }

      const sample = rows[0];
      if (!sample) continue;

      const sub3val = getSub3(sample);
      console.log(`[convSync] ✓ Found working endpoint: ${att.method} ${att.path.split("?")[0]} — ${rows.length} rows, sample sub3="${sub3val}"`);
      return { rows, attempt: att };

    } catch (e) {
      console.log(`[convSync] ${att.method} ${att.path.split("?")[0]} → ERROR: ${e.message}`);
    }
  }
  return null;
}

// Save conversions to DB, skip duplicates — returns { saved, newItems }
async function saveConversions(rows, sponsorName) {
  let saved = 0;
  const newItems = [];
  for (const row of rows) {
    const sub3 = getSub3(row);
    const subId = parseInt(sub3, 10);
    if (!subId || !SUB_NAMES[subId]) continue;

    const txId = String(
      row.transaction_id ?? row.conversion_id ?? row.id ?? row.click_id ?? ""
    ).trim();
    if (!txId) continue;

    const exists = await db.conversions.findOne({ transaction_id: txId });
    if (exists) continue;

    const revenue = parseFloat(row.revenue ?? row.payout ?? 0);
    // Everflow returns unix timestamp in seconds as conversion_unix_timestamp
    let createdAt;
    if (row.conversion_unix_timestamp) {
      createdAt = new Date(row.conversion_unix_timestamp * 1000).toISOString();
    } else {
      const rawDate = row.conversion_date ?? row.date ?? row.created_at ?? row.datetime ?? "";
      try {
        createdAt = rawDate ? new Date(rawDate).toISOString() : new Date().toISOString();
      } catch { createdAt = new Date().toISOString(); }
    }

    const country = String(row.country || row.country_code || row.country_name || "").trim().toUpperCase().slice(0, 2) || "";

    await db.conversions.insert({
      _id: txId,
      transaction_id: txId,
      sub3: String(subId),
      revenue,
      offer_id: String(row.offer_id ?? row.network_offer_id ?? ""),
      sponsor: sponsorName,
      event_type: "cv",
      country,
      created_at: createdAt,
    });
    saved++;
    newItems.push({ mailerName: SUB_NAMES[subId], mailerId: subId, revenue, txId });
  }
  return { saved, newItems };
}

// Main sync — called on startup + every N minutes
// Returns { totalSaved, allNewItems }
async function syncConversions(daysBack = 30) {
  const today    = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);

  const sponsors = await db.sponsors.find({ api_key: { $exists: true, $ne: "" } });
  let totalSaved = 0;
  const allNewItems = [];

  for (const sp of sponsors) {
    if (!sp.api_key || sp.platform === "adsurf") continue;
    try {
      const result = await detectAndFetch(sp.api_key, fromDate, today);
      if (!result) {
        console.log(`[convSync] ${sp.name}: no working endpoint found`);
        continue;
      }
      const { saved, newItems } = await saveConversions(result.rows, sp.name);
      totalSaved += saved;
      allNewItems.push(...newItems);
      if (saved > 0) console.log(`[convSync] ${sp.name}: +${saved} new conversions saved`);
    } catch (e) {
      console.error(`[convSync] ${sp.name} error:`, e.message);
    }
  }

  return { totalSaved, allNewItems };
}

module.exports = { syncConversions, SUB_NAMES };
