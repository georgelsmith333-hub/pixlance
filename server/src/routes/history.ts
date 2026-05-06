import { Router } from "express";
import { getPool, dbAvailable } from "../db/index.js";

const router = Router();

// GET /api/history — list most recent 50 listings
router.get("/history", async (_req, res) => {
  if (!dbAvailable()) {
    res.json({ listings: [], source: "localStorage" });
    return;
  }
  try {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT id, keyword, mode, marketplace, listing, seo_report, created_at
       FROM listing_history ORDER BY created_at DESC LIMIT 50`
    );
    res.json({ listings: rows, source: "db" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/history — save a new listing
router.post("/history", async (req, res) => {
  if (!dbAvailable()) { res.json({ id: null, source: "localStorage" }); return; }
  const { keyword, mode, marketplace, listing, seoReport } = req.body as {
    keyword?: string;
    mode?: string;
    marketplace?: string;
    listing: object;
    seoReport?: object;
  };
  if (!listing) { res.status(400).json({ error: "listing required" }); return; }
  try {
    const db = getPool();
    const { rows } = await db.query(
      `INSERT INTO listing_history (keyword, mode, marketplace, listing, seo_report)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [keyword ?? null, mode ?? null, marketplace ?? "eBay UK", JSON.stringify(listing), seoReport ? JSON.stringify(seoReport) : null]
    );
    res.json({ id: rows[0].id, created_at: rows[0].created_at, source: "db" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/history/:id — delete one
router.delete("/history/:id", async (req, res) => {
  if (!dbAvailable()) { res.json({ deleted: false }); return; }
  try {
    const db = getPool();
    await db.query("DELETE FROM listing_history WHERE id = $1", [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/history — clear all
router.delete("/history", async (_req, res) => {
  if (!dbAvailable()) { res.json({ deleted: 0 }); return; }
  try {
    const db = getPool();
    const { rowCount } = await db.query("DELETE FROM listing_history");
    res.json({ deleted: rowCount ?? 0 });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
