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

  // Step 1: GET login page — grab _token from HTML form + cookies
  const page = await fetch(`${BASE_URL}/login`, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
    agent, redirect: "follow",
  });
  parseCookies(page);
  const pageHtml = await page.text();

  console.log(`[pxirbid] GET /login → HTTP ${page.status}, html length=${pageHtml.length}`);
  console.log(`[pxirbid] Cookies after GET: ${JSON.stringify(Object.keys(_cookies))}`);

  // Extract _token from form HTML (Laravel CSRF token) — try multiple patterns
  const tokenMatch =
    pageHtml.match(/name=["']_token["'][^>]*value=["']([^"']+)["']/) ||
    pageHtml.match(/value=["']([^"']+)["'][^>]*name=["']_token["']/) ||
    pageHtml.match(/<input[^>]+_token[^>]+value=["']([^"']+)["']/) ||
    pageHtml.match(/csrf[_-]?token["']?\s*:\s*["']([^"']+)["']/i) ||
    pageHtml.match(/meta[^>]+csrf-token[^>]+content=["']([^"']+)["']/i) ||
    pageHtml.match(/content=["']([^"']+)["'][^>]*name=["']csrf-token["']/i);

  const formToken = tokenMatch?.[1] || _xsrf;
  console.log(`[pxirbid] _token extracted: ${formToken ? formToken.slice(0,20)+"..." : "NONE"} (from ${tokenMatch ? "form" : "xsrf cookie"})`);

  // Dump form HTML to see field names
  const formMatch = pageHtml.match(/<form[^>]*>([\s\S]*?)<\/form>/i);
  if (formMatch) {
    const formSnip = formMatch[1].replace(/\s+/g, " ").slice(0, 1000);
    console.log(`[pxirbid] Form HTML: ${formSnip}`);
  } else {
    console.log(`[pxirbid] No <form> found! Page: ${pageHtml.slice(0,500).replace(/\s+/g," ")}`);
  }

  if (!formToken) {
    throw new Error("Could not extract _token from login page");
  }

  // Detect field name: username or email
  const usesEmail = /name=["']email["']/i.test(pageHtml);
  const loginField = usesEmail ? "email" : "username";
  console.log(`[pxirbid] Login field name: "${loginField}"`);

  // Step 2: POST login
  const postBody = new URLSearchParams({
    [loginField]: USERNAME,
    password:     PASSWORD,
    _token:       formToken,
  }).toString();

  const fullCookie = cookieHeader();
  console.log(`[pxirbid] POST body: ${postBody}`);
  console.log(`[pxirbid] POST /login with user="${USERNAME}", pass_len=${PASSWORD.length}, cookie="${fullCookie}"`);

  // POST with redirect:manual to detect success (302 to non-login = success)
  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: {
      "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Content-Type":    "application/x-www-form-urlencoded",
      "Cookie":          cookieHeader(),
      "Referer":         `${BASE_URL}/login`,
      "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Origin":          BASE_URL,
      "X-XSRF-TOKEN":    _xsrf,
    },
    body: postBody, agent, redirect: "manual",
  });
  parseCookies(res);

  const location = res.headers.get("location") || "";
  console.log(`[pxirbid] POST /login → HTTP ${res.status}, location="${location}"`);

  // Success: 302 to anything that's NOT /login
  if (res.status === 302 && !location.includes("/login")) {
    // Follow the redirect to establish full session
    const redirectUrl = location.startsWith("http") ? location : `${BASE_URL}${location}`;
    await fetch(redirectUrl, {
      method: "GET", agent,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Cookie": cookieHeader(),
      },
      redirect: "follow",
    }).then(r => { parseCookies(r); console.log(`[pxirbid] Followed redirect → HTTP ${r.status}`); }).catch(() => {});
    console.log("[pxirbid] Login OK → " + location);
    return;
  }

  // Login failed — try to get error message from response body
  let errBody = "";
  try { errBody = await res.text(); } catch {}
  const errSnip = errBody.slice(0, 500).replace(/\s+/g, " ");
  console.log(`[pxirbid] Login failed body snippet: ${errSnip}`);

  throw new Error(`Login failed — HTTP ${res.status}, location: ${location || "none"}`);
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
