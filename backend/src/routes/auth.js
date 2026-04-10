// src/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuid } = require("uuid");
const db = require("../db");
const { authMiddleware, requireAdmin, JWT_SECRET } = require("../middleware/auth");
const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const user = await db.users.findOne({ email });
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: "Invalid credentials" });
    await db.users.update({ id: user.id }, { $set: { last_login: new Date().toISOString() } });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/auth/me
router.get("/me", authMiddleware, (req, res) => res.json({ user: req.user }));

// POST /api/auth/users (admin only)
router.post("/users", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { email, password, name, role = "viewer" } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: "email, password, name required" });
    const exists = await db.users.findOne({ email });
    if (exists) return res.status(409).json({ error: "Email already registered" });
    const id = uuid();
    const user = { _id: id, id, email, password: bcrypt.hashSync(password, 10), name, role, created_at: new Date().toISOString() };
    await db.users.insert(user);
    res.status(201).json({ user: { id, email, name, role } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/auth/users (for contact list in chat)
router.get("/users", authMiddleware, async (req, res) => {
  try {
    const users = await db.users.find({});
    res.json({ users: users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, created_at: u.created_at, last_login: u.last_login })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/auth/users/:id (admin only)
router.delete("/users/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: "Cannot delete yourself" });
    await db.users.remove({ id: req.params.id });
    res.json({ message: "User deleted" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
