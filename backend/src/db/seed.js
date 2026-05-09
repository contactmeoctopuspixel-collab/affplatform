// src/db/seed.js — Clean seed: users + sponsors only (no fake data)
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const bcrypt = require("bcryptjs");
const { v4: uuid } = require("uuid");
const db = require("./index");

async function seed() {
  console.log("🌱 Clean seed — removing all demo data...");

  // Clear everything
  await db.users.remove({}, { multi: true });
  await db.sponsors.remove({}, { multi: true });
  await db.offers.remove({}, { multi: true });
  await db.events.remove({}, { multi: true });
  await db.daily_stats.remove({}, { multi: true });

  // ── Users only ─────────────────────────────────────────────────────────────
  const adminId = uuid();
  await db.users.insert({
    _id: adminId, id: adminId,
    email: "admin@affplatform.com",
    password: bcrypt.hashSync("admin123", 10),
    name: "Admin", role: "admin",
    created_at: new Date().toISOString()
  });
  await db.users.insert({
    _id: uuid(), id: uuid(),
    email: "team@affplatform.com",
    password: bcrypt.hashSync("team123", 10),
    name: "Team Member", role: "viewer",
    created_at: new Date().toISOString()
  });
  console.log("  ✓ Users created");

  // ── Sponsors (real ones — no fake revenue/clicks) ──────────────────────────
  const sponsors = [
    { id:"SP001", name:"Everflow (M-M)",      base_url:"https://m-m.everflowclient.io/",               platform:"everflow",  color:"#00ff9d" },
    { id:"SP002", name:"Commission Shepherd", base_url:"https://commissionshepherd.everflowclient.io/", platform:"everflow",  color:"#00cfff" },
    { id:"SP003", name:"BizAglo",             base_url:"https://platform.bizaglo.com/",                platform:"bizaglo",   color:"#ff9f0a" },
    { id:"SP004", name:"SphinxAds",           base_url:"https://panel.sphinxads.com/",                 platform:"sphinxads", color:"#bf5af2" },
    { id:"SP005", name:"AdSurf Network",      base_url:"https://partner.adsurfnetwork.com/",            platform:"adsurf",    color:"#ff453a" },
  ];

  for (const s of sponsors) {
    await db.sponsors.insert({
      _id: s.id, ...s,
      api_key: null,
      status: "pending",
      revenue: 0, clicks: 0, leads: 0,
      last_sync: null,
      created_by: adminId,
      created_at: new Date().toISOString()
    });
    console.log(`  ✓ Sponsor: ${s.name}`);
  }

  console.log("\n✅ Clean seed done!");
  console.log("   Next steps:");
  console.log("   1. npm run dev");
  console.log("   2. Go to Settings → add API keys");
  console.log("   3. Click Sync on each sponsor");
  console.log("   4. AI Finder → Import Offers from Sponsors");
  process.exit(0);
}

seed().catch(e => { console.error("❌ Seed error:", e); process.exit(1); });
