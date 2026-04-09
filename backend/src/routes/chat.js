// src/routes/chat.js — Team chat
const express = require("express");
const { v4: uuid } = require("uuid");
const db = require("../db");
const { authMiddleware } = require("../middleware/auth");
const router = express.Router();

// GET /api/chat/messages?limit=50&targetId=userId
router.get("/messages", authMiddleware, async (req, res) => {
  try {
    const { targetId } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 100, 300);
    
    let query = {};
    if (targetId && targetId !== "global") {
      // Private chat between current user and targetId
      query = {
        $or: [
          { userId: req.user.id, to: targetId },
          { userId: targetId, to: req.user.id }
        ]
      };
    } else {
      // Global chat (no "to" field or to: null)
      query = { $or: [{ to: { $exists: false } }, { to: null }] };
    }

    const msgs = await db.chat.find(query).sort({ created_at: -1 }).limit(limit);
    res.json({ messages: msgs.reverse() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/chat/messages — save + broadcast via WS
router.post("/messages", authMiddleware, async (req, res) => {
  try {
    const { text, to } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "text required" });
    
    const msg = {
      _id: uuid(),
      id: uuid(),
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      text: text.trim().slice(0, 1500),
      created_at: new Date().toISOString(),
      ...(to && to !== "global" ? { to } : {}),
    };
    await db.chat.insert(msg);

    // Broadcast to all WS clients
    const wss = req.app.get("wss");
    if (wss) {
      const payload = JSON.stringify({ type: "chat_message", msg });
      wss.clients.forEach(c => { 
        if (c.readyState === 1) {
          // Optimization: could filter here to only send to 'to' or 'userId', 
          // but for simplicity we broadcast and clients filter locally.
          c.send(payload); 
        }
      });
    }

    res.status(201).json({ msg });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
