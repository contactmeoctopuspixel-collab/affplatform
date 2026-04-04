// api.js — Frontend API client
const BASE = import.meta?.env?.VITE_API_URL || "/api";

function getToken() {
  return localStorage.getItem("affplatform_token");
}

async function req(method, path, body) {
  const token = getToken();
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  const res = await fetch(BASE + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Auth
  login:      (email, password) => req("POST", "/auth/login", { email, password }),
  me:         ()                => req("GET",  "/auth/me"),
  inviteUser: (body)            => req("POST", "/auth/users", body),
  getUsers:   ()                => req("GET",  "/auth/users"),
  deleteUser: (id)              => req("DELETE", `/auth/users/${id}`),

  // Sponsors
  getSponsors:    ()      => req("GET",    "/sponsors"),
  createSponsor:  (body)  => req("POST",   "/sponsors", body),
  updateSponsor:  (id, b) => req("PATCH",  `/sponsors/${id}`, b),
  deleteSponsor:  (id)    => req("DELETE", `/sponsors/${id}`),
  syncSponsor:    (id)    => req("POST",   `/sponsors/${id}/sync`),
  testSponsor:    (id)    => req("POST",   `/sponsors/${id}/test`),
  manualUpdate:   (id, b) => req("POST",   `/sponsors/${id}/manual`, b),
  sponsorStats:   (id, d) => req("GET",    `/sponsors/${id}/stats?days=${d||7}`),

  // Offers
  getOffers:   (params = {}) => req("GET", "/offers?" + new URLSearchParams(params)),
  createOffer: (body)        => req("POST",   "/offers", body),
  updateOffer: (id, b)       => req("PATCH",  `/offers/${id}`, b),
  deleteOffer: (id)          => req("DELETE", `/offers/${id}`),

  // Stats
  dashboard:      (from, to) => req("GET", `/stats/dashboard?from=${from||''}&to=${to||''}`),
  events:         (limit = 30) => req("GET", `/stats/events?limit=${limit}`),
  hourly:         () => req("GET", "/stats/hourly"),
  subAffiliates:      (from, to) => req("GET",  `/stats/sub-affiliates?from=${from||''}&to=${to||''}`),
  convSyncStatus:     ()         => req("GET",  "/stats/conv-sync-status"),
  convSyncNow:        ()         => req("POST", "/stats/conv-sync-now"),

  // AI
  aiRecommendations: (limit = 8) => req("GET", `/ai/recommendations?limit=${limit}`),
  aiScaling:         (target)    => req("GET", `/ai/scaling?target=${target}`),
  syncOffers:        ()          => req("POST", "/ai/sync-offers"),
  bulkImport:        (sponsor_id, offers) => req("POST", "/ai/bulk-import", { sponsor_id, offers }),

  // Health
  health: () => req("GET", "/health"),
};

// WebSocket client
export function createWS(onMessage) {
  const proto = window.location.protocol === "https:" ? "wss://" : "ws://";
  const WS_URL = (import.meta?.env?.VITE_WS_URL || (proto + window.location.host)) + "/ws";
  let ws, retryTimeout;

  function connect() {
    ws = new WebSocket(WS_URL);
    ws.onopen    = () => console.log("🔌 WS connected");
    ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch {} };
    ws.onclose   = () => { retryTimeout = setTimeout(connect, 3000); };
    ws.onerror   = () => ws.close();
  }

  connect();
  return { close: () => { clearTimeout(retryTimeout); ws?.close(); } };
}
