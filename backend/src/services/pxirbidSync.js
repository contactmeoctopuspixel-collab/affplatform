// pxirbidSync.js — Auto-fetch From/Subject/Creatives from pxirbidlink.com
const https = require("https");
const http  = require("http");
const db    = require("../db");

const BASE_URL  = process.env.PXIRBIDLINK_URL  || "https://app.pxirbidlink.com";
const USERNAME  = process.env.PXIRBIDLINK_USER || "";
const PASSWORD  = process.env.PXIRBIDLINK_PASS || "";
const PROXY_RAW = process.env.PXIRBIDLINK_PROXY || "";

// Parse proxy: http://user:pass@host:port
function parseProxy(raw) {
  if (!raw) return null;
  try {
    const url  = new URL(raw);
    return { host: url.hostname, port: parseInt(url.port), user: url.username, pass: url.password };
  } catch { return null; }
}

// Make request through HTTP proxy (CONNECT tunnel for HTTPS)
function proxyRequest(opts, proxy) {
  return new Promise((resolve, reject) => {
    if (!proxy) {
      // Direct request
      const mod = opts.protocol === "https:" ? https : http;
      const req = mod.request(opts, res => {
        let d = ""; res.on("data", c => d += c);
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
      });
      req.on("error", reject);
      req.setTimeout(20000, () => { req.destroy(); reject(new Error("timeout")); });
      if (opts.body) req.write(opts.body);
      req.end();
      return;
    }

    // CONNECT tunnel
    const tunnel = http.request({
      host: proxy.host, port: proxy.port, method: "CONNECT",
      path: `${opts.hostname}:443`,
      headers: {
        "Proxy-Authorization": "Basic " + Buffer.from(`${proxy.user}:${proxy.pass}`).toString("base64"),
        "Host": `${opts.hostname}:443`,
      },
    });
    tunnel.on("connect", (res, socket) => {
      const tlsSocket = require("tls").connect({ socket, servername: opts.hostname, rejectUnauthorized: false }, () => {
        const reqStr = [
          `${opts.method || "GET"} ${opts.path} HTTP/1.1`,
          `Host: ${opts.hostname}`,
          ...Object.entries(opts.headers || {}).map(([k, v]) => `${k}: ${v}`),
          opts.body ? `Content-Length: ${Buffer.byteLength(opts.body)}` : "",
          "", opts.body || "",
        ].filter((l, i) => i < 3 || l !== "").join("\r\n") + "\r\n\r\n";

        tlsSocket.write(reqStr);
        let raw = "";
        tlsSocket.on("data", c => raw += c);
        tlsSocket.on("end", () => {
          const [headerPart, ...bodyParts] = raw.split("\r\n\r\n");
          const statusLine = headerPart.split("\r\n")[0];
          const status = parseInt(statusLine.split(" ")[1]) || 0;
          const headerLines = headerPart.split("\r\n").slice(1);
          const headers = {};
          for (const l of headerLines) {
            const idx = l.indexOf(":"); if (idx > 0)
            headers[l.slice(0,idx).toLowerCase().trim()] = l.slice(idx+1).trim();
          }
          resolve({ status, headers, body: bodyParts.join("\r\n\r\n") });
        });
        tlsSocket.on("error", reject);
      });
      tlsSocket.on("error", reject);
    });
    tunnel.on("error", reject);
    tunnel.setTimeout(25000, () => { tunnel.destroy(); reject(new Error("proxy tunnel timeout")); });
    tunnel.end();
  });
}

// Extract Set-Cookie values
function extractCookies(headers) {
  const raw = headers["set-cookie"] || "";
  const cookies = {};
  const lines = Array.isArray(raw) ? raw : [raw];
  for (const line of lines) {
    const part = line.split(";")[0].trim();
    const eq = part.indexOf("=");
    if (eq > 0) cookies[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return cookies;
}

function cookieHeader(cookies) {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
}

let _session = null; // cached session { cookies, xsrf }

// Login to pxirbidlink and get session cookies
async function login() {
  const proxy = parseProxy(PROXY_RAW);
  const hostname = new URL(BASE_URL).hostname;

  // Step 1: GET login page — get initial XSRF token
  const page = await proxyRequest({
    protocol: "https:", hostname, path: "/login",
    method: "GET",
    headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" },
  }, proxy);

  const cookies = extractCookies(page.headers);
  const xsrf = cookies["XSRF-TOKEN"] ? decodeURIComponent(cookies["XSRF-TOKEN"]) : "";

  // Step 2: POST login
  const body = new URLSearchParams({ username: USERNAME, password: PASSWORD }).toString();
  const login = await proxyRequest({
    protocol: "https:", hostname, path: "/login",
    method: "POST",
    headers: {
      "User-Agent":     "Mozilla/5.0",
      "Content-Type":   "application/x-www-form-urlencoded",
      "X-XSRF-TOKEN":   xsrf,
      "Cookie":         cookieHeader(cookies),
      "Referer":        `${BASE_URL}/login`,
      "Accept":         "application/json, text/html",
    },
    body,
  }, proxy);

  const sessionCookies = { ...cookies, ...extractCookies(login.headers) };
  const newXsrf = sessionCookies["XSRF-TOKEN"] ? decodeURIComponent(sessionCookies["XSRF-TOKEN"]) : xsrf;

  if (login.status !== 200 && login.status !== 302) {
    throw new Error(`Login failed: HTTP ${login.status}`);
  }

  _session = { cookies: sessionCookies, xsrf: newXsrf };
  console.log("[pxirbid] Login OK");
  return _session;
}

// GET assets for an offer (type = from | subjects | creatives)
async function fetchAssets(offerId, type, session) {
  const proxy = parseProxy(PROXY_RAW);
  const hostname = new URL(BASE_URL).hostname;
  const path = `/admin/offers/${offerId}/assets?type=${type}&draw=1&columns[0][data]=&columns[0][name]=&columns[0][searchable]=false&columns[0][orderable]=false&columns[0][search][value]=&columns[0][search][regex]=false&columns[1][data]=id&columns[1][name]=&columns[1][searchable]=true&columns[1][orderable]=true&order[0][column]=1&order[0][dir]=desc&start=0&length=100`;

  const res = await proxyRequest({
    protocol: "https:", hostname, path,
    method: "GET",
    headers: {
      "User-Agent":   "Mozilla/5.0",
      "Accept":       "application/json",
      "X-XSRF-TOKEN": session.xsrf,
      "Cookie":       cookieHeader(session.cookies),
      "Referer":      `${BASE_URL}/admin/offers/${offerId}`,
    },
  }, proxy);

  if (res.status === 401 || res.status === 419) return null; // session expired
  try { return JSON.parse(res.body); } catch { return null; }
}

// Fetch all assets for one offer — returns { from_names, subjects, creative_urls }
async function fetchOfferAssets(pxirOfferId) {
  if (!_session) await login();

  const tryFetch = async (type) => {
    let result = await fetchAssets(pxirOfferId, type, _session);
    if (!result) {
      // Session expired — re-login
      await login();
      result = await fetchAssets(pxirOfferId, type, _session);
    }
    return result?.data || [];
  };

  const [froms, subjects, creatives] = await Promise.all([
    tryFetch("from"),
    tryFetch("subjects"),
    tryFetch("creatives"),
  ]);

  return {
    from_names:    froms.map(r => r.value).filter(Boolean),
    subjects:      subjects.map(r => r.value).filter(Boolean),
    creative_urls: creatives.map(r => r.value || r.url || r.image_url).filter(Boolean),
  };
}

// Main sync — match affplatform offers to pxirbidlink offers by external_id, fetch assets
async function syncAssetsFromPxirbid() {
  if (!USERNAME || !PASSWORD) {
    console.log("[pxirbid] No credentials configured — skipping");
    return;
  }

  console.log("[pxirbid] Starting asset sync...");

  // Get all offers that have external_id but no from_name
  const offers = await db.offers.find({ external_id: { $exists: true, $ne: "" } });
  const missing = offers.filter(o => !o.from_name && !o._pxir_synced);

  console.log(`[pxirbid] ${missing.length} offers need from/subject/creatives`);

  let synced = 0;
  for (const offer of missing) {
    try {
      const assets = await fetchOfferAssets(offer.external_id);
      const upd = {
        _pxir_synced: true,
        _pxir_synced_at: new Date().toISOString(),
      };
      if (assets.from_names.length)    upd.from_name  = assets.from_names[0];
      if (assets.subjects.length)      upd.subject    = assets.subjects[0];
      if (assets.creative_urls.length) upd.creatives  = assets.creative_urls.join("\n");

      // Store all values as arrays too
      if (assets.from_names.length > 1)  upd.from_names_all  = assets.from_names;
      if (assets.subjects.length > 1)    upd.subjects_all    = assets.subjects;

      await db.offers.update({ _id: offer._id }, { $set: upd });

      if (assets.from_names.length || assets.subjects.length) {
        console.log(`[pxirbid] ${offer.external_id}: from="${assets.from_names[0]||""}" subj="${assets.subjects[0]||""}"`);
        synced++;
      }
    } catch (e) {
      console.error(`[pxirbid] ${offer.external_id} error:`, e.message);
      // Reset session on error
      _session = null;
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`[pxirbid] Done — ${synced} offers synced with assets`);
  return synced;
}

module.exports = { syncAssetsFromPxirbid, fetchOfferAssets };
