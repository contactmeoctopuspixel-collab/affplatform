// src/routes/expenses.js
const express = require("express");
const db = require("../db");
const router = express.Router();
const { authMiddleware, requireAdmin } = require("../middleware/auth");
router.use(authMiddleware);

// GET /api/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/", async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = {};
    if (from || to) {
      filter.created_at = {};
      if (from) filter.created_at.$gte = new Date(from).toISOString();
      if (to) filter.created_at.$lte = new Date(to).toISOString();
    }
    const list = await db.expenses.find(filter).sort({ created_at: -1 });
    res.json({ expenses: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/expenses
// Body: { amount: number, category: string, description: string }
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { amount, category, description } = req.body;
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    const expense = {
      amount,
      category: category || "unclassified",
      description: description || "",
      created_at: new Date().toISOString(),
      created_by: req.user.id,
    };
    await db.expenses.insert(expense);
    res.status(201).json({ id: expense._id || expense.id, ...expense });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;