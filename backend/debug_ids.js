// Debug: show ALL keys in a raw conversion record to find offer_id field name
require('dotenv').config({path:'./.env'});
const db = require('./src/db');
const fetch = require('node-fetch');

async function run() {
  // 1. Show full raw conversion record from DB
  const conv = await db.conversions.findOne({});
  console.log('--- FULL DB CONVERSION RECORD ---');
  console.log(JSON.stringify(conv, null, 2));

  // 2. Fetch a live sample from Everflow to see raw field names
  const sponsors = await db.sponsors.find({ api_key: { $exists: true, $ne: '' } });
  const sp = sponsors[0];
  if (!sp) { console.log('No sponsor with API key'); process.exit(0); }

  const today = new Date().toISOString().slice(0,10);
  const from  = new Date(Date.now() - 7*86400000).toISOString().slice(0,10);
  const res = await fetch(
    'https://api.eflow.team/v1/affiliates/reporting/conversions?page=1&page_size=2&order_field=conversion_unix_timestamp&order_direction=desc',
    {
      method: 'POST',
      headers: { 'X-Eflow-API-Key': sp.api_key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: today, timezone_id: 55, show_conversions: true, show_events: false, query: { filters: [], search_terms: [] } })
    }
  );
  const data = await res.json();
  const rows = data.conversions || data.data || data.rows || [];
  console.log('--- RAW EVERFLOW ROW KEYS ---');
  if (rows[0]) console.log(JSON.stringify(Object.keys(rows[0])));
  console.log('--- FIRST RAW ROW ---');
  if (rows[0]) console.log(JSON.stringify(rows[0], null, 2));
  process.exit(0);
}
run().catch(function(e){ console.error(e.message); process.exit(1); });
