// src/middleware/auth.js
const jwt = require("jsonwebtoken");
const db = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_in_production_min32chars!!";

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return res.status(401).json({ error: "Missing Authorization header" });

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    db.users.findOne({ id: payload.id }).then(user => {
      if (!user) return res.status(401).json({ error: "User not found" });
      req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
      next();
    }).catch(() => res.status(500).json({ error: "DB error" }));
  } catch {
    return res.status(401).json({ error: "Token expired or invalid" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}
function requireEditor(req, res, next) {
  if (!["admin","editor"].includes(req.user?.role)) return res.status(403).json({ error: "Editor access required" });
  next();
}

module.exports = { authMiddleware, requireAdmin, requireEditor, JWT_SECRET };
