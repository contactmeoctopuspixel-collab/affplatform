// src/services/aiEngine.js
// AI Offer Selector — analyzes performance and recommends best offers
const db = require("../db");

// Score an offer based on multiple factors
function scoreOffer(offer, allOffers) {
  let score = 0;
  const reasons = [];

  // 1. Conversion Rate (CVR) — most important
  const cr = offer.clicks > 0 ? (offer.leads / offer.clicks) : 0;
  if (cr > 0.05)       { score += 40; reasons.push(`High CVR ${(cr*100).toFixed(1)}%`); }
  else if (cr > 0.02)  { score += 25; reasons.push(`Good CVR ${(cr*100).toFixed(1)}%`); }
  else if (cr > 0.01)  { score += 10; reasons.push(`Avg CVR ${(cr*100).toFixed(1)}%`); }

  // 2. Revenue generated
  const rev = offer.payout * offer.leads;
  if (rev > 500)       { score += 30; reasons.push(`Strong revenue $${rev.toFixed(0)}`); }
  else if (rev > 100)  { score += 20; reasons.push(`Good revenue $${rev.toFixed(0)}`); }
  else if (rev > 10)   { score += 10; reasons.push(`Some revenue $${rev.toFixed(0)}`); }

  // 3. Payout value
  if (offer.payout > 100)     { score += 20; reasons.push(`Premium payout $${offer.payout}`); }
  else if (offer.payout > 50) { score += 15; reasons.push(`High payout $${offer.payout}`); }
  else if (offer.payout > 20) { score += 10; reasons.push(`Decent payout $${offer.payout}`); }
  else if (offer.payout > 5)  { score +=  5; reasons.push(`Low payout $${offer.payout}`); }

  // 4. Volume (clicks = traffic potential)
  if (offer.clicks > 1000)    { score += 10; reasons.push("High traffic volume"); }
  else if (offer.clicks > 100){ score +=  5; reasons.push("Medium traffic"); }

  // 5. Active status bonus
  if (offer.status === "active") score += 5;

  // 6. Trending — compare to avg CVR of all offers
  const avgCVR = allOffers.reduce((a, o) => a + (o.clicks > 0 ? o.leads/o.clicks : 0), 0) / (allOffers.length || 1);
  if (cr > avgCVR * 1.5) { score += 10; reasons.push("Above avg performance"); }

  return { score: Math.min(score, 99), reasons };
}

// Get AI recommendations
async function getRecommendations(limit = 8) {
  const offers   = await db.offers.find({ status: "active" });
  const sponsors = await db.sponsors.find({});
  const spMap    = Object.fromEntries(sponsors.map(s => [s.id, s]));

  if (!offers.length) return { recommendations: [], message: "No offers found. Sync your sponsors first." };

  // Score all offers
  const scored = offers.map(offer => {
    const { score, reasons } = scoreOffer(offer, offers);
    const sp = spMap[offer.sponsor_id] || {};
    const cr = offer.clicks > 0 ? ((offer.leads / offer.clicks) * 100).toFixed(2) : "0.00";
    return {
      id:            offer.id,
      name:          offer.name,
      external_id:   offer.external_id || offer.id,
      sponsor_id:    offer.sponsor_id,
      sponsor_name:  sp.name  || offer.sponsor_id,
      sponsor_color: sp.color || "#00ff9d",
      payout:        offer.payout,
      clicks:        offer.clicks,
      leads:         offer.leads,
      cr:            cr + "%",
      est_revenue:   +(offer.payout * offer.leads).toFixed(2),
      category:      offer.category,
      score,
      reasons,
      recommendation: score >= 60 ? "STRONG BUY" : score >= 40 ? "BUY" : score >= 20 ? "WATCH" : "LOW PRIORITY",
    };
  });

  // Sort by score desc
  scored.sort((a, b) => b.score - a.score);

  // Category analysis
  const byCategory = {};
  for (const o of scored) {
    if (!byCategory[o.category]) byCategory[o.category] = { count: 0, avgScore: 0, totalRev: 0 };
    byCategory[o.category].count++;
    byCategory[o.category].avgScore += o.score;
    byCategory[o.category].totalRev += o.est_revenue;
  }
  for (const cat of Object.values(byCategory)) {
    cat.avgScore = +(cat.avgScore / cat.count).toFixed(1);
  }

  // Best vertical
  const bestVertical = Object.entries(byCategory)
    .sort((a, b) => b[1].avgScore - a[1].avgScore)[0];

  // Stats
  const totalOffers    = scored.length;
  const strongBuys     = scored.filter(o => o.recommendation === "STRONG BUY").length;
  const avgPayout      = +(scored.reduce((a, o) => a + o.payout, 0) / totalOffers).toFixed(2);
  const topOffer       = scored[0];

  return {
    recommendations: scored.slice(0, limit),
    insights: {
      totalOffers,
      strongBuys,
      avgPayout,
      bestVertical:   bestVertical ? { name: bestVertical[0], ...bestVertical[1] } : null,
      topOffer:       topOffer ? { name: topOffer.name, score: topOffer.score, payout: topOffer.payout } : null,
      byCategory,
    },
    generated_at: new Date().toISOString(),
  };
}

// Auto-scaling: suggest budget allocation
async function getScalingPlan(targetRevenue = 1000) {
  const { recommendations } = await getRecommendations(5);
  if (!recommendations.length) return { plan: [] };

  const plan = recommendations.map((o, i) => {
    const weight = (recommendations.length - i) / recommendations.length;
    const budget = +(targetRevenue * weight / recommendations.length * 2).toFixed(2);
    const expectedLeads = o.payout > 0 ? Math.floor(budget / o.payout) : 0;
    return {
      offer: o.name,
      sponsor: o.sponsor_name,
      payout: o.payout,
      score: o.score,
      suggested_budget: budget,
      expected_leads: expectedLeads,
      expected_revenue: +(expectedLeads * o.payout).toFixed(2),
    };
  });

  return { plan, total_budget: plan.reduce((a, p) => a + p.suggested_budget, 0).toFixed(2) };
}

module.exports = { getRecommendations, getScalingPlan, scoreOffer };
