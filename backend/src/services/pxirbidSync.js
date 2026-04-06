// pxirbidSync.js — Auto-fetch From/Subject/Creatives from pxirbidlink.com
const fetch  = require("node-fetch");
const db     = require("../db");
const { HttpsProxyAgent } = require("https-proxy-agent");

// Disable SSL verification for internal app with mismatched cert
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE_URL  = process.env.PXIRBIDLINK_URL  || "https://app.pxirbidlink.com";
const USERNAME  = process.env.PXIRBIDLINK_USER || "";
const PASSWORD  = process.env.PXIRBIDLINK_PASS || "";
const PROXY_RAW = process.env.PXIRBIDLINK_PROXY || "";

function getAgent() {
  if (!PROXY_RAW) return undefined;
  return new HttpsProxyAgent(PROXY_RAW, { rejectUnauthorized: false });
}

let _cookies = {}; // { name: value }
let _xsrf    = "";

function cookieHeader() {
  return Object.entries(_cookies).map(([k, v]) => `${k}=${v}`).join("; ");
}

function parseCookies(res) {
  const raw = res.headers.raw?.()?.["set-cookie"] || res.headers.get?.("set-cookie") || "";
  const lines = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  for (const line of lines) {
    const part = line.split(";")[0].trim();
    const eq = part.indexOf("=");
    if (eq > 0) _cookies[part.slice(0, eq)] = part.slice(eq + 1);
  }
  if (_cookies["XSRF-TOKEN"]) _xsrf = decodeURIComponent(_cookies["XSRF-TOKEN"]);
}

async function login() {
  const agent = getAgent();

  // Step 1: GET login page — grab initial XSRF token
  const page = await fetch(`${BASE_URL}/login`, {
    method: "GET",
    headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" },
    agent, redirect: "follow",
  });
  parseCookies(page);

  // Step 2: POST login — try email field (Laravel default)
  const body = new URLSearchParams({
    username: USERNAME,
    password: PASSWORD,
    _token:   _xsrf,
  }).toString();

  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: {
      "User-Agent":   "Mozilla/5.0",
      "Content-Type": "application/x-www-form-urlencoded",
      "X-XSRF-TOKEN": _xsrf,
      "Cookie":       cookieHeader(),
      "Referer":      `${BASE_URL}/login`,
      "Accept":       "text/html,application/xhtml+xml,*/*",
      "Origin":       BASE_URL,
    },
    body, agent, redirect: "follow",
  });
  parseCookies(res);

  const resText = await res.text();
  // Check if redirected to dashboard (login success) or still on login page
  const isLoggedIn = _cookies["pxirbidlink_session"] &&
    (res.url?.includes("/dashboard") || res.url?.includes("/admin") ||
     !resText.includes('<title>LOGIN</title>'));

  if (!isLoggedIn) {
    // Extract _token from HTML if XSRF didn't work
    const tokenMatch = resText.match(/name="_token"\s+value="([^"]+)"/);
    if (tokenMatch) {
      // Try again with HTML token
      const body2 = new URLSearchParams({
        email: USERNAME, password: PASSWORD, _token: tokenMatch[1],
      }).toString();
      const res2 = await fetch(`${BASE_URL}/login`, {
        method: "POST",
        headers: {
          "User-Agent":   "Mozilla/5.0",
          "Content-Type": "application/x-www-form-urlencoded",
          "X-XSRF-TOKEN": tokenMatch[1],
          "Cookie":       cookieHeader(),
          "Referer":      `${BASE_URL}/login`,
          "Accept":       "text/html,application/xhtml+xml,*/*",
          "Origin":       BASE_URL,
        },
        body: body2, agent, redirect: "follow",
      });
      parseCookies(res2);
      const t2 = await res2.text();
      if (t2.includes('<title>LOGIN</title>')) {
        throw new Error(`Login failed — check credentials. Response: ${t2.slice(0,200)}`);
      }
    } else {
      throw new Error(`Login failed HTTP ${res.status}: ${resText.slice(0, 200)}`);
    }
  }
  console.log("[pxirbid] Login OK");
}

async function fetchAssets(offerId, type) {
  const agent = getAgent();
  const qs = `type=${type}&draw=1&columns[0][data]=&columns[0][name]=&columns[0][searchable]=false&columns[0][orderable]=false&columns[1][data]=id&columns[1][name]=&columns[1][searchable]=true&columns[1][orderable]=true&order[0][column]=1&order[0][dir]=desc&start=0&length=200`;
  const url = `${BASE_URL}/admin/offers/${offerId}/assets?${qs}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent":   "Mozilla/5.0",
      "Accept":       "application/json",
      "X-XSRF-TOKEN": _xsrf,
      "Cookie":       cookieHeader(),
      "Referer":      `${BASE_URL}/admin/offers/${offerId}`,
    },
    agent, timeout: 15000,
  });

  parseCookies(res);
  if (res.status === 401 || res.status === 419) return null; // session expired
  const json = await res.json().catch(() => null);
  return json;
}

async function fetchOfferAssets(offerId) {
  const tryAll = async () => {
    const [froms, subjects, creatives] = await Promise.all([
      fetchAssets(offerId, "from"),
      fetchAssets(offerId, "subjects"),
      fetchAssets(offerId, "creatives"),
    ]);
    return { froms, subjects, creatives };
  };

  let result = await tryAll();

  // If session expired — re-login once
  if (!result.froms) {
    await login();
    result = await tryAll();
  }

  return {
    from_names:    (result.froms?.data    || []).map(r => r.value).filter(Boolean),
    subjects:      (result.subjects?.data || []).map(r => r.value).filter(Boolean),
    creative_urls: (result.creatives?.data|| []).map(r => r.value || r.url || r.image_url).filter(Boolean),
  };
}

async function syncAssetsFromPxirbid() {
  if (!USERNAME || !PASSWORD) {
    console.log("[pxirbid] No credentials — skipping");
    return 0;
  }

  console.log("[pxirbid] Starting asset sync...");
  await login();

  const offers  = await db.offers.find({ external_id: { $exists: true, $ne: "" } });
  const missing = offers.filter(o => !o.from_name && !o._pxir_synced);
  console.log(`[pxirbid] ${missing.length} offers need from/subject/creatives`);

  let synced = 0;
  for (const offer of missing) {
    try {
      const assets = await fetchOfferAssets(offer.external_id);
      const upd = { _pxir_synced: true, _pxir_synced_at: new Date().toISOString() };
      if (assets.from_names[0])       upd.from_name       = assets.from_names[0];
      if (assets.subjects[0])         upd.subject         = assets.subjects[0];
      if (assets.creative_urls.length) upd.creatives      = assets.creative_urls.join("\n");
      if (assets.from_names.length > 1) upd.from_names_all = assets.from_names;
      if (assets.subjects.length > 1)   upd.subjects_all   = assets.subjects;

      await db.offers.update({ _id: offer._id }, { $set: upd });
      if (assets.from_names[0] || assets.subjects[0]) {
        console.log(`[pxirbid] ${offer.external_id}: from="${assets.from_names[0]||""}" subj="${assets.subjects[0]||""}"`);
        synced++;
      }
    } catch (e) {
      console.error(`[pxirbid] ${offer.external_id} error:`, e.message);
      _cookies = {}; _xsrf = ""; // reset session on error
      try { await login(); } catch {}
    }
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`[pxirbid] Done — ${synced}/${missing.length} offers synced`);
  return synced;
}

module.exports = { syncAssetsFromPxirbid, fetchOfferAssets };
