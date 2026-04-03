// src/services/liveSync.js
// Auto-sync every N minutes + push live events via WebSocket
const { fetchAndSync } = require("./apiProxy");
const db = require("../db");

let wss = null;
let syncInterval = null;

function broadcast(data) {
  if (!wss) return;
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

// Called when a real lead/click comes in — push instantly to all clients
async function pushLiveEvent(event) {
  broadcast({ type: "new_event", event });
}

// Full sync all sponsors with API keys
async function syncAllSponsors() {
  const sponsors = await db.sponsors.find({ api_key: { $exists: true, $ne: null } });
  const results = [];

  for (const sp of sponsors) {
    if (!sp.api_key || sp.platform === "adsurf") continue;
    try {
      const prev = { clicks: sp.clicks || 0, leads: sp.leads || 0, revenue: sp.revenue || 0 };
      const result = await fetchAndSync(sp.id);

      if (result.success && result.data) {
        const d = result.data;
        // Detect new leads since last sync
        const newLeads   = Math.max(0, (d.leads   || 0) - prev.leads);
        const newClicks  = Math.max(0, (d.clicks  || 0) - prev.clicks);
        const newRevenue = Math.max(0, (d.revenue || 0) - prev.revenue);

        // Push update to dashboard
        broadcast({
          type: "sponsor_updated",
          sponsorId: sp.id,
          name: sp.name,
          data: { clicks: d.clicks, leads: d.leads, revenue: d.revenue },
          delta: { newLeads, newClicks, newRevenue },
        });

        // Push notification for each new lead
        if (newLeads > 0) {
          broadcast({
            type: "new_lead",
            sponsorId: sp.id,
            sponsorName: sp.name,
            sponsorColor: sp.color,
            count: newLeads,
            revenue: newRevenue,
            timestamp: new Date().toISOString(),
          });
        }

        results.push({ id: sp.id, name: sp.name, ok: true, newLeads, newClicks });
      }
    } catch (e) {
      results.push({ id: sp.id, name: sp.name, ok: false, error: e.message });
    }
  }

  // Push dashboard refresh signal
  broadcast({ type: "dashboard_refresh", timestamp: new Date().toISOString() });
  return results;
}

// Start auto-sync loop
function startLiveSync(wssInstance, intervalMinutes = 2) {
  wss = wssInstance;
  console.log(`⚡ Live sync started — every ${intervalMinutes} min`);

  // Initial sync after 5 seconds
  setTimeout(syncAllSponsors, 5000);

  // Then every N minutes
  syncInterval = setInterval(syncAllSponsors, intervalMinutes * 60 * 1000);
}

function stopLiveSync() {
  if (syncInterval) clearInterval(syncInterval);
}

module.exports = { startLiveSync, stopLiveSync, syncAllSponsors, pushLiveEvent, broadcast };
