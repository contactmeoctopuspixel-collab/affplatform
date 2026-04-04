// conversionSync.js — Auto-detect Everflow conversions endpoint + sync sub3 data
const fetch = require("node-fetch");
const db    = require("../db");

const SUB_NAMES = {
  2: "Oussama", 3: "Mohammed", 4: "Marouan",
  5: "Imad", 6: "Mariam", 7: "Yousra",
  16: "Kaoutar", 17: "Hafssa",
};

// All possible body/endpoint combinations to try
function buildAttempts(from, to) {
  const base = { from, to, timezone_id: 67, currency_id: "USD" };
  const pag  = { page: 1, page_size: 500 };
  return [
    // POST variants
    { method: "POST", path: "/v1/affiliates/reporting/conversions",
      body: { ...base, filters: {}, pagination: pag } },
    { method: "POST", path: "/v1/affiliates/reporting/conversions",
      body: { ...base, pagination: pag } },
    { method: "POST", path: "/v1/affiliates/reporting/conversions",
      body: { ...base, filters: {}, columns: ["sub3","revenue","transaction_id"], pagination: pag } },
    { method: "POST", path: "/v1/affiliates/reporting/conversions",
      body: { ...base, filters: { event_type: "cv" }, pagination: pag } },
    { method: "POST", path: "/v1/affiliates/reporting/conversions",
      body: { from, to, timezone_id: 67 } },
    { method: "POST", path: "/v1/affiliates/reporting/conversions",
      body: { ...base, event_type: "cv", page: 1, page_size: 500 } },
    { method: "POST", path: "/v1/affiliates/reporting/conversion",
      body: { ...base, filters: {}, pagination: pag } },
    // GET variants
    { method: "GET", path: `/v1/affiliates/reporting/conversions?from=${from}&to=${to}&timezone_id=67&currency_id=USD&page=1&page_size=500` },
    { method: "GET", path: `/v1/affiliates/conversions?from=${from}&to=${to}&timezone_id=67&page=1&page_size=500` },
    { method: "GET", path: `/v1/affiliates/reporting/conversion?from=${from}&to=${to}&timezone_id=67&currency_id=USD&page=1&page_size=500` },
    { method: "GET", path: `/v1/affiliates/reporting/conversions?from=${from}&to=${to}&page=1&page_size=500` },
  ];
}

// Extract conversions array from any response shape
function extractRows(json) {
  if (!json || typeof json !== "object") return null;
  const candidates = [
    json.conversions, json.conversion, json.data,
    json.performance, json.rows, json.results,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  // If root is array
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
      if (!r.ok) continue;

      const ct = r.headers.get("content-type") || "";
      if (!ct.includes("application/json")) continue;

      const json = await r.json();
      const rows = extractRows(json);
      if (!rows) continue;

      // Check first row has sub3 data
      const sample = rows[0];
      if (!sample) continue;

      const sub3val = getSub3(sample);
      // Acceptable if sub3 exists (even empty string) — we found the right endpoint
      console.log(`[convSync] ✓ Found working endpoint: ${att.method} ${att.path.split("?")[0]} — ${rows.length} rows, sample sub3="${sub3val}"`);
      return { rows, attempt: att };

    } catch (e) {
      // timeout or network error — continue
    }
  }
  return null;
}

// Save conversions to DB, skip duplicates
async function saveConversions(rows, sponsorName) {
  let saved = 0;
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
    const rawDate = row.conversion_date ?? row.date ?? row.created_at ?? row.datetime ?? "";
    let createdAt;
    try {
      createdAt = rawDate ? new Date(rawDate).toISOString() : new Date().toISOString();
    } catch { createdAt = new Date().toISOString(); }

    await db.conversions.insert({
      _id: txId,
      transaction_id: txId,
      sub3: String(subId),
      revenue,
      offer_id: String(row.offer_id ?? row.network_offer_id ?? ""),
      sponsor: sponsorName,
      event_type: "cv",
      created_at: createdAt,
    });
    saved++;
  }
  return saved;
}

// Main sync — called on startup + every N minutes
async function syncConversions(daysBack = 30) {
  const today   = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);

  const sponsors = await db.sponsors.find({ api_key: { $exists: true, $ne: "" } });
  let totalSaved = 0;

  for (const sp of sponsors) {
    if (!sp.api_key || sp.platform === "adsurf") continue;
    try {
      const result = await detectAndFetch(sp.api_key, fromDate, today);
      if (!result) {
        console.log(`[convSync] ${sp.name}: no working endpoint found`);
        continue;
      }
      const saved = await saveConversions(result.rows, sp.name);
      totalSaved += saved;
      if (saved > 0) console.log(`[convSync] ${sp.name}: +${saved} new conversions saved`);
    } catch (e) {
      console.error(`[convSync] ${sp.name} error:`, e.message);
    }
  }

  return totalSaved;
}

module.exports = { syncConversions, SUB_NAMES };
