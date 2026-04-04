// conversionSync.js — Auto-detect Everflow conversions endpoint + sync sub3 data
const fetch = require("node-fetch");
const db    = require("../db");

const SUB_NAMES = {
  2: "Oussama", 3: "Mohammed", 4: "Marouan",
  5: "Imad", 6: "Mariam", 7: "Yousra",
  16: "Kaoutar", 17: "Hafssa",
};

// Fetch affiliate account info to get network_affiliate_id
async function fetchAffiliateInfo(apiKey) {
  const headers = {
    "X-Eflow-API-Key": apiKey,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  try {
    const r = await fetch("https://api.eflow.team/v1/affiliates/account", { method: "GET", headers, timeout: 15000 });
    if (!r.ok) return null;
    const json = await r.json();
    // Try various shapes: { affiliate_id, network_affiliate_id, id, account: { id } }
    const id = json.network_affiliate_id ?? json.affiliate_id ?? json.id
             ?? json.account?.network_affiliate_id ?? json.account?.id ?? null;
    if (id) console.log(`[convSync] Affiliate ID resolved: ${id}`);
    return { id, raw: json };
  } catch { return null; }
}

// All possible body combinations to try — now parametrised with optional affiliate_id
function buildAttempts(from, to, affiliateId) {
  const base  = { from, to, timezone_id: 67, currency_id: "USD" };
  const pag   = { page: 1, page_size: 500 };
  const affF  = affiliateId ? { network_affiliate_id: [affiliateId] } : {};
  const affF2 = affiliateId ? { affiliate_id: [affiliateId] } : {};

  return [
    // ── With affiliate_id in filters (most likely required) ───────────────────
    ...(affiliateId ? [
      { method: "POST", path: "/v1/affiliates/reporting/conversions",
        body: { ...base, filters: affF, page: 1, page_size: 500 } },
      { method: "POST", path: "/v1/affiliates/reporting/conversions",
        body: { ...base, filters: affF2, page: 1, page_size: 500 } },
      { method: "POST", path: "/v1/affiliates/reporting/conversions",
        body: { ...base, filters: affF, pagination: pag } },
      { method: "POST", path: "/v1/affiliates/reporting/conversions",
        body: { ...base, network_affiliate_id: affiliateId, page: 1, page_size: 500 } },
      { method: "POST", path: "/v1/affiliates/reporting/conversions",
        body: { ...base, affiliate_id: affiliateId, page: 1, page_size: 500 } },
    ] : []),

    // ── Without affiliate_id ──────────────────────────────────────────────────
    { method: "POST", path: "/v1/affiliates/reporting/conversions",
      body: { from, to, page: 1, page_size: 500 } },
    { method: "POST", path: "/v1/affiliates/reporting/conversions",
      body: { from, to, timezone_id: 67, page: 1, page_size: 500 } },
    { method: "POST", path: "/v1/affiliates/reporting/conversions",
      body: { ...base, page: 1, page_size: 500 } },
    { method: "POST", path: "/v1/affiliates/reporting/conversions",
      body: { ...base, filters: {}, page: 1, page_size: 500 } },
    { method: "POST", path: "/v1/affiliates/reporting/conversions",
      body: { ...base, filters: {}, pagination: pag } },
    { method: "POST", path: "/v1/affiliates/reporting/conversions",
      body: { ...base, filters: {}, columns: ["sub3","revenue","transaction_id","conversion_date"], pagination: pag } },
    { method: "POST", path: "/v1/affiliates/reporting/conversions",
      body: { from, to, timezone_id: 67, currency_id: "USD", report_type: "affiliate", page: 1, page_size: 500 } },
    // ── Different page_size ───────────────────────────────────────────────────
    { method: "POST", path: "/v1/affiliates/reporting/conversions",
      body: { from, to, timezone_id: 67, page: 1, page_size: 25 } },
    { method: "POST", path: "/v1/affiliates/reporting/conversions",
      body: { from, to, page: 1, limit: 500 } },
  ];
}

// Extract conversions array from any response shape
function extractRows(json) {
  if (!json || typeof json !== "object") return null;
  const candidates = [
    json.conversions, json.conversion, json.data,
    json.performance, json.rows, json.results, json.report,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
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

  // Step 1: resolve affiliate ID (used to build more accurate request bodies)
  const accInfo = await fetchAffiliateInfo(apiKey);
  const affiliateId = accInfo?.id ?? null;

  const attempts = buildAttempts(from, to, affiliateId);

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
  const today    = new Date().toISOString().slice(0, 10);
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
