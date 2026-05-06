/**
 * Admin Panel API Routes
 * Protected by admin token (set in platform_settings)
 * Access: /api/admin/* with header X-Admin-Token or query ?token=
 */

import { Router, Request, Response, NextFunction } from "express";
import { getPool, dbAvailable, getSetting, setSetting, getAllSettings, getUsageStats, trackUsage } from "../db/index.js";

const router = Router();

// ─── Auth middleware ──────────────────────────────────────────────────────────
async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token =
    (req.headers["x-admin-token"] as string) ??
    (req.query["token"] as string) ??
    (req.body as Record<string, string>)?.adminToken;

  if (!token) {
    res.status(401).json({ error: "Admin token required" });
    return;
  }

  // Check against DB setting (or fallback env var)
  const storedToken = await getSetting("admin_token") ?? process.env.ADMIN_TOKEN ?? "pixlance_admin_2024";
  if (token !== storedToken) {
    res.status(403).json({ error: "Invalid admin token" });
    return;
  }
  next();
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────
router.get("/admin/dashboard", requireAdmin, async (_req, res) => {
  try {
    const [settings, usageStats] = await Promise.all([
      getAllSettings(),
      getUsageStats(),
    ]);

    let userCount = 0;
    let listingCount = 0;
    let recentListings: unknown[] = [];
    let recentActivity: unknown[] = [];

    if (dbAvailable()) {
      const db = getPool();
      const [users, listings, recent, activity] = await Promise.all([
        db.query("SELECT COUNT(*) as count FROM users"),
        db.query("SELECT COUNT(*) as count FROM listing_history"),
        db.query("SELECT id, keyword, mode, marketplace, created_at FROM listing_history ORDER BY created_at DESC LIMIT 10"),
        db.query("SELECT event_type, COUNT(*) as count, DATE(created_at) as date FROM usage_stats WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY event_type, DATE(created_at) ORDER BY date DESC, count DESC LIMIT 50"),
      ]);
      userCount = parseInt(users.rows[0]?.count ?? "0");
      listingCount = parseInt(listings.rows[0]?.count ?? "0");
      recentListings = recent.rows;
      recentActivity = activity.rows;
    }

    res.json({
      settings,
      usage: usageStats,
      counts: { users: userCount, listings: listingCount },
      recentListings,
      recentActivity,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Get all settings ─────────────────────────────────────────────────────────
router.get("/admin/settings", requireAdmin, async (_req, res) => {
  try {
    const settings = await getAllSettings();
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Update setting ───────────────────────────────────────────────────────────
router.post("/admin/settings", requireAdmin, async (req, res) => {
  const { key, value } = req.body as { key: string; value: string };
  if (!key || value === undefined) { res.status(400).json({ error: "key and value required" }); return; }

  // Security: don't allow changing admin_token via this endpoint unless explicitly intended
  const allowedKeys = [
    "plan_mode", "free_daily_limit", "paid_monthly_price",
    "maintenance_mode", "announcement", "admin_token",
    "max_bulk_items", "allow_image_processing", "allow_bulk",
    "stripe_price_id", "welcome_message",
  ];

  if (!allowedKeys.includes(key)) {
    res.status(400).json({ error: `Setting '${key}' not allowed` });
    return;
  }

  try {
    await setSetting(key, value);
    res.json({ success: true, key, value });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Bulk update settings ─────────────────────────────────────────────────────
router.post("/admin/settings/bulk", requireAdmin, async (req, res) => {
  const { settings } = req.body as { settings: Record<string, string> };
  if (!settings || typeof settings !== "object") { res.status(400).json({ error: "settings object required" }); return; }
  try {
    const updates = Object.entries(settings).map(([key, value]) => setSetting(key, value));
    await Promise.all(updates);
    res.json({ success: true, updated: Object.keys(settings).length });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Users list ───────────────────────────────────────────────────────────────
router.get("/admin/users", requireAdmin, async (req, res) => {
  if (!dbAvailable()) { res.json({ users: [] }); return; }
  try {
    const page = parseInt(String(req.query.page ?? "1"));
    const limit = 50;
    const offset = (page - 1) * limit;
    const db = getPool();
    const { rows, rowCount } = await db.query(
      "SELECT id, email, plan, usage_count, last_seen, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset]
    );
    const { rows: total } = await db.query("SELECT COUNT(*) as count FROM users");
    res.json({ users: rows, total: parseInt(total[0]?.count ?? "0"), page, pages: Math.ceil(parseInt(total[0]?.count ?? "0") / limit) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Update user plan ─────────────────────────────────────────────────────────
router.post("/admin/users/:id/plan", requireAdmin, async (req, res) => {
  if (!dbAvailable()) { res.status(503).json({ error: "DB unavailable" }); return; }
  const { plan } = req.body as { plan: string };
  const validPlans = ["free", "pro", "unlimited", "banned"];
  if (!validPlans.includes(plan)) { res.status(400).json({ error: "Invalid plan" }); return; }
  try {
    const db = getPool();
    await db.query("UPDATE users SET plan=$1 WHERE id=$2", [plan, req.params.id]);
    res.json({ success: true, id: req.params.id, plan });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Delete user ──────────────────────────────────────────────────────────────
router.delete("/admin/users/:id", requireAdmin, async (req, res) => {
  if (!dbAvailable()) { res.status(503).json({ error: "DB unavailable" }); return; }
  try {
    const db = getPool();
    await db.query("DELETE FROM users WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Listing history (admin view) ─────────────────────────────────────────────
router.get("/admin/listings", requireAdmin, async (req, res) => {
  if (!dbAvailable()) { res.json({ listings: [] }); return; }
  try {
    const page = parseInt(String(req.query.page ?? "1"));
    const limit = 20;
    const offset = (page - 1) * limit;
    const db = getPool();
    const { rows } = await db.query(
      "SELECT id, keyword, mode, marketplace, user_id, created_at FROM listing_history ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset]
    );
    const { rows: total } = await db.query("SELECT COUNT(*) as count FROM listing_history");
    res.json({ listings: rows, total: parseInt(total[0]?.count ?? "0"), page });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Clear old listing history ────────────────────────────────────────────────
router.delete("/admin/listings/old", requireAdmin, async (req, res) => {
  if (!dbAvailable()) { res.status(503).json({ error: "DB unavailable" }); return; }
  const { days = 30 } = req.body as { days?: number };
  try {
    const db = getPool();
    const { rowCount } = await db.query(
      "DELETE FROM listing_history WHERE created_at < NOW() - INTERVAL '1 day' * $1",
      [days]
    );
    res.json({ deleted: rowCount ?? 0 });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Usage analytics ─────────────────────────────────────────────────────────
router.get("/admin/analytics", requireAdmin, async (req, res) => {
  if (!dbAvailable()) { res.json({ data: [] }); return; }
  try {
    const days = parseInt(String(req.query.days ?? "30"));
    const db = getPool();
    const { rows } = await db.query(`
      SELECT 
        DATE(created_at) as date,
        event_type,
        COUNT(*) as count
      FROM usage_stats 
      WHERE created_at > NOW() - INTERVAL '1 day' * $1
      GROUP BY DATE(created_at), event_type
      ORDER BY date DESC, count DESC
    `, [days]);
    res.json({ data: rows, days });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Verify admin token ───────────────────────────────────────────────────────
router.post("/admin/verify", async (req, res) => {
  const { token } = req.body as { token: string };
  if (!token) { res.status(400).json({ valid: false }); return; }
  const storedToken = await getSetting("admin_token") ?? process.env.ADMIN_TOKEN ?? "pixlance_admin_2024";
  res.json({ valid: token === storedToken });
});

// ─── Reset all usage stats ────────────────────────────────────────────────────
router.delete("/admin/analytics", requireAdmin, async (_req, res) => {
  if (!dbAvailable()) { res.status(503).json({ error: "DB unavailable" }); return; }
  try {
    const db = getPool();
    await db.query("TRUNCATE usage_stats");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
