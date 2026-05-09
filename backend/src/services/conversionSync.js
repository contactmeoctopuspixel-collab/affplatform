// conversionSync.js — Auto-detect Everflow conversions endpoint + sync sub3 data
const fetch = require("node-fetch");
const db    = require("../db");

const SUB_NAMES = {
  2: "Oussama", 3: "Mohammed", 4: "Marouan",
  5: "Imad", 6: "Mariam", 7: "Yousra",
  16: "Kaoutar", 17: "Hafssa",
};

const COUNTRY_NAME_MAP = {
  "united states": "US", "usa": "US", "us": "US", "united states of america": "US", "u.s.a.": "US", "u.s.": "US",
  "united kingdom": "GB", "uk": "GB", "gb": "GB", "great britain": "GB", "england": "GB",
  "australia": "AU", "au": "AU", "aus": "AU",
  "new zealand": "NZ", "nz": "NZ", "nzl": "NZ",
  "canada": "CA", "ca": "CA", "can": "CA",
  "france": "FR", "fr": "FR", "fra": "FR",
  "germany": "DE", "de": "DE", "ger": "DE", "deutschland": "DE",
  "italy": "IT", "it": "IT", "ita": "IT",
  "spain": "ES", "es": "ES", "esp": "ES",
  "netherlands": "NL", "nl": "NL", "nld": "NL", "holland": "NL",
  "belgium": "BE", "be": "BE", "bel": "BE",
  "switzerland": "CH", "ch": "CH", "che": "CH",
  "sweden": "SE", "se": "SE", "swe": "SE",
  "norway": "NO", "no": "NO", "nor": "NO",
  "finland": "FI", "fi": "FI", "fin": "FI",
  "denmark": "DK", "dk": "DK", "dnk": "DK",
  "ireland": "IE", "ie": "IE", "irl": "IE",
  "austria": "AT", "at": "AT", "aut": "AT",
  "portugal": "PT", "pt": "PT", "prt": "PT",
  "poland": "PL", "pl": "PL", "pol": "PL",
  "russia": "RU", "ru": "RU", "rus": "RU", "russian federation": "RU",
  "mexico": "MX", "mx": "MX", "mex": "MX",
  "brazil": "BR", "br": "BR", "bra": "BR",
  "india": "IN", "in": "IN", "ind": "IN",
  "japan": "JP", "jp": "JP", "jpn": "JP",
  "china": "CN", "cn": "CN", "chn": "CN",
  "morocco": "MA", "ma": "MA", "mar": "MA", "maroc": "MA",
  "uae": "AE", "united arab emirates": "AE", "ae": "AE",
  "saudi arabia": "SA", "sa": "SA", "sau": "SA",
  "south africa": "ZA", "za": "ZA", "zaf": "ZA",
  "israel": "IL", "il": "IL", "isr": "IL",
  "ukraine": "UA", "ua": "UA", "ukr": "UA",
};

function countryToCode(raw) {
  if (!raw) return "";
  const v = String(raw).trim().toLowerCase();
  if (COUNTRY_NAME_MAP[v]) return COUNTRY_NAME_MAP[v];
  if (v.length === 2) {
    const upper = v.toUpperCase();
    if (Object.values(COUNTRY_NAME_MAP).includes(upper)) return upper;
  }
  for (const [name, code] of Object.entries(COUNTRY_NAME_MAP)) {
    if (v.includes(name)) return code;
  }
  const fallback = v.slice(0, 2).toUpperCase();
  if (Object.values(COUNTRY_NAME_MAP).includes(fallback)) return fallback;
  return "";
}
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

// Extract values from conversion rows (Everflow uses different formats)
function extractOfferId(row) {
  return String(
    row.offer_id ?? row.network_offer_id ?? row["offer.id"] ??
    row.offer?.id ?? row.offer_id?.id ?? row.offer?._id ??
    row.relationship?.offer?.network_offer_id ??
    row.relationship?.offer?.offer_id ??
    row.offer?.network_offer_id ??
    row.network_offer_id ??
    ""
  ).trim();
}
function extractOfferName(row) {
  return String(
    row.offer_name ?? row.offer?.name ?? row.name ?? row["offer.name"] ??
    row.offer_name?.name ?? 
    row.relationship?.offer?.name ?? 
    row.relationship?.offer?.offer_name ??
    row.offer?.name ??
    ""
  ).trim();
}
function extractCountry(row) {
  return String(
    row.country ?? row.country_code ?? row.country_name ??
    row.geo_country ?? row.geo?.country ?? row["geo.country"] ??
    row.offer?.country ?? 
    row.relationship?.offer?.country ??
    row.offer?.country_code ??
    ""
  ).trim();
}

// Save conversions to DB, skip duplicates — returns { saved, newItems }
async function saveConversions(rows, sponsorName) {
  // Build offer name lookup (raw offer ID → name)
  const allDbOffers = await db.offers.find({});
  const offerNameByRawId = {};
  for (const o of allDbOffers) {
    const raw = (o.id || o._id || "").replace(/^[A-Z0-9]+-/, "");
    if (raw && o.name && !offerNameByRawId[raw]) offerNameByRawId[raw] = o.name;
  }

  let saved = 0;
  const newItems = [];
  for (const row of rows) {
    const txId = String(
      row.transaction_id ?? row.conversion_id ?? row.id ?? row.click_id ?? ""
    ).trim();
    if (!txId) continue;

    const revenue = parseFloat(row.revenue ?? row.payout ?? 0);
    let createdAt;
    if (row.conversion_unix_timestamp) {
      createdAt = new Date(row.conversion_unix_timestamp * 1000).toISOString();
    } else {
      const rawDate = row.conversion_date ?? row.date ?? row.created_at ?? row.datetime ?? "";
      try {
        createdAt = rawDate ? new Date(rawDate).toISOString() : new Date().toISOString();
      } catch { createdAt = new Date().toISOString(); }
    }

    const rawOid = extractOfferId(row);
    const offerName = extractOfferName(row);

    // Extract country using unified logic
    let rawCountry = extractCountry(row);
    let country = countryToCode(rawCountry);

    if (!country && offerName) {
      // Aggressive scanning for US/AU/NZ variants
      const v = offerName.toLowerCase();
      if (v.includes("united states") || v.includes(" usa") || v.includes("[us]") || v.includes("_us")) country = "US";
      else if (v.includes("australia") || v.includes(" aus") || v.includes("[au]") || v.includes("_au")) country = "AU";
      else if (v.includes("new zealand") || v.includes(" nz") || v.includes("[nz]") || v.includes("_nz")) country = "NZ";
      else {
        // Sort keys by length descending to match longer names first
        const sortedKeys = Object.keys(COUNTRY_NAME_MAP).sort((a, b) => b.length - a.length);
        for (const key of sortedKeys) {
          const regex = new RegExp(`(^|[^a-z])${key.replace('.', '\\.')}([^a-z]|$)`, 'i');
          if (regex.test(v)) {
            country = COUNTRY_NAME_MAP[key];
            break;
          }
        }
      }
    }

    if (!country && rawOid) {
      const dbOfferName = offerNameByRawId[rawOid];
      if (dbOfferName) {
        const lowDbOfferName = dbOfferName.toLowerCase();
        const sortedKeys = Object.keys(COUNTRY_NAME_MAP).sort((a, b) => b.length - a.length);
        for (const key of sortedKeys) {
          const regex = new RegExp(`(^|[^a-z])${key.replace('.', '\\.')}([^a-z]|$)`, 'i');
          if (regex.test(lowDbOfferName)) {
            country = COUNTRY_NAME_MAP[key];
            break;
          }
        }
      }
    }

    // Last resort old prefix match
    if (!country) {
      const m = offerName.match(/^([A-Za-z]{2,3})\s*-\s/);
      if (m) country = countryToCode(m[1]);
    }
    const exists = await db.conversions.findOne({ transaction_id: txId });
    if (exists) {
      const updates = {};
      if ((!exists.offer_id || exists.offer_id === "") && rawOid) updates.offer_id = rawOid;
      if ((!exists.offer_name || exists.offer_name === "") && offerName) updates.offer_name = offerName;
      if ((!exists.country || exists.country === "Unknown") && country) updates.country = country;
      
      if (Object.keys(updates).length > 0) {
        await db.conversions.update({ _id: exists._id }, { $set: updates });
      }
      continue;
    }

    await db.conversions.insert({
      _id: txId, transaction_id: txId,
      sub3: String(subId), revenue,
      offer_id: rawOid,
      offer_name: offerName,
      sponsor: sponsorName,
      country: country || "Unknown",
      created_at: createdAt
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

// Re-run country detection on all conversions that are missing it
async function backfillGeographicData() {
  const conversions = await db.conversions.find({ country: { $in: ["", null, "Unknown", "unknown"] } });
  const allOffers = await db.offers.find({});
  const offerNameByRawId = {};
  for (const o of allOffers) {
    const raw = (o.id || o._id || "").replace(/^[A-Z0-9]+-/, "");
    if (raw && o.name && !offerNameByRawId[raw]) offerNameByRawId[raw] = o.name;
  }

  let fixed = 0;
  for (const conv of conversions) {
    let country = "";
    const offerName = offerNameByRawId[conv.offer_id] || "";
    if (offerName) {
      const lowOfferName = offerName.toLowerCase();
      const sortedKeys = Object.keys(COUNTRY_NAME_MAP).sort((a, b) => b.length - a.length);
      for (const key of sortedKeys) {
        const regex = new RegExp(`(^|[^a-z])${key.replace('.', '\\.')}([^a-z]|$)`, 'i');
        if (regex.test(lowOfferName)) {
          country = COUNTRY_NAME_MAP[key];
          break;
        }
      }
    }

    if (country) {
      await db.conversions.update({ _id: conv._id }, { $set: { country } });
      fixed++;
    }
  }
  return { total: conversions.length, fixed };
}

module.exports = { syncConversions, backfillGeographicData, SUB_NAMES };

