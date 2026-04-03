// src/db/index.js — NeDB pure-JS database (no compilation needed!)
const Datastore = require("nedb-promises");
const path = require("path");
const fs = require("fs");

const DB_DIR = process.env.DB_PATH || "./data";
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const opts = (file) => ({
  filename:          path.join(DB_DIR, file),
  autoload:          true,
  corruptAlertThreshold: 0,
});

const db = {
  users:       Datastore.create(opts("users.db")),
  sponsors:    Datastore.create(opts("sponsors.db")),
  offers:      Datastore.create(opts("offers.db")),
  events:      Datastore.create(opts("events.db")),
  daily_stats: Datastore.create(opts("daily_stats.db")),
};

// Stop auto-compaction to prevent EBUSY lock errors when multiple processes start
Object.values(db).forEach(store => store.stopAutocompaction?.());

db.users.ensureIndex({ fieldName: "email", unique: true });

module.exports = db;
