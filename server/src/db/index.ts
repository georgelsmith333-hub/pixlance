import { Pool } from "pg";

const DATABASE_URL = process.env.NEON_URL || process.env.DATABASE_URL;

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    if (!DATABASE_URL) throw new Error("DATABASE_URL not set");
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    pool.on("error", (err) => {
      console.error("[DB] Pool error:", err.message);
    });
  }
  return pool;
}

export async function runMigrations(): Promise<void> {
  if (!DATABASE_URL) {
    console.log("[DB] No DATABASE_URL — skipping migrations (localStorage only mode)");
    return;
  }
  const db = getPool();

  // Core listing history — create if not exists, then add missing columns
  await db.query(`
    CREATE TABLE IF NOT EXISTS listing_history (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      keyword     TEXT,
      mode        TEXT,
      marketplace TEXT        NOT NULL DEFAULT 'eBay UK',
      listing     JSONB       NOT NULL,
      seo_report  JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_listing_history_created_at ON listing_history (created_at DESC);
  `);
  // Add user_id column if it doesn't exist (for existing tables)
  await db.query(`
    ALTER TABLE listing_history ADD COLUMN IF NOT EXISTS user_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_listing_history_user ON listing_history (user_id);
  `);

  // Admin settings / platform config
  await db.query(`
    CREATE TABLE IF NOT EXISTS platform_settings (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO platform_settings (key, value) VALUES
      ('plan_mode', 'free'),
      ('free_daily_limit', '999999'),
      ('paid_monthly_price', '29'),
      ('maintenance_mode', 'false'),
      ('admin_token', 'pixlance_admin_2024'),
      ('announcement', '')
    ON CONFLICT (key) DO NOTHING;
  `);

  // Usage tracking
  await db.query(`
    CREATE TABLE IF NOT EXISTS usage_stats (
      id          SERIAL PRIMARY KEY,
      event_type  TEXT NOT NULL,
      user_id     TEXT,
      ip_address  TEXT,
      metadata    JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_stats (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_usage_event ON usage_stats (event_type);
  `);

  // User sessions / API keys
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      email       TEXT UNIQUE,
      plan        TEXT        NOT NULL DEFAULT 'free',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key     TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen   TIMESTAMPTZ;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_api_key ON users (api_key) WHERE api_key IS NOT NULL;
  `);

  console.log("[DB] Migrations complete — all tables ready");
}

export const dbAvailable = (): boolean => !!DATABASE_URL;

// ─── Platform settings helpers ────────────────────────────────────────────────
export async function getSetting(key: string): Promise<string | null> {
  if (!dbAvailable()) return null;
  try {
    const { rows } = await getPool().query("SELECT value FROM platform_settings WHERE key=$1", [key]);
    return rows[0]?.value ?? null;
  } catch { return null; }
}

export async function setSetting(key: string, value: string): Promise<void> {
  if (!dbAvailable()) return;
  await getPool().query(
    "INSERT INTO platform_settings(key,value,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(key) DO UPDATE SET value=$2, updated_at=NOW()",
    [key, value]
  );
}

export async function getAllSettings(): Promise<Record<string, string>> {
  if (!dbAvailable()) return {};
  try {
    const { rows } = await getPool().query("SELECT key, value FROM platform_settings");
    return Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
  } catch { return {}; }
}

// ─── Usage tracking ────────────────────────────────────────────────────────
export async function trackUsage(event: string, userId?: string, ip?: string, meta?: Record<string, unknown>): Promise<void> {
  if (!dbAvailable()) return;
  try {
    await getPool().query(
      "INSERT INTO usage_stats (event_type, user_id, ip_address, metadata) VALUES ($1,$2,$3,$4)",
      [event, userId ?? null, ip ?? null, meta ? JSON.stringify(meta) : null]
    );
  } catch { /* non-blocking */ }
}

export async function getUsageStats(): Promise<{
  totalListings: number;
  totalImages: number;
  totalBulk: number;
  totalResearch: number;
  todayListings: number;
  weekListings: number;
  topEvents: { event_type: string; count: number }[];
}> {
  if (!dbAvailable()) return { totalListings: 0, totalImages: 0, totalBulk: 0, totalResearch: 0, todayListings: 0, weekListings: 0, topEvents: [] };
  try {
    const db = getPool();
    const [total, today, week, top] = await Promise.all([
      db.query("SELECT event_type, COUNT(*) as count FROM usage_stats GROUP BY event_type"),
      db.query("SELECT COUNT(*) as count FROM usage_stats WHERE event_type='listing_generated' AND created_at > NOW() - INTERVAL '1 day'"),
      db.query("SELECT COUNT(*) as count FROM usage_stats WHERE event_type='listing_generated' AND created_at > NOW() - INTERVAL '7 days'"),
      db.query("SELECT event_type, COUNT(*) as count FROM usage_stats GROUP BY event_type ORDER BY count DESC LIMIT 10"),
    ]);

    const byType = Object.fromEntries(total.rows.map((r: { event_type: string; count: string }) => [r.event_type, parseInt(r.count)]));
    return {
      totalListings: byType["listing_generated"] ?? 0,
      totalImages: byType["image_processed"] ?? 0,
      totalBulk: byType["bulk_processed"] ?? 0,
      totalResearch: byType["research_run"] ?? 0,
      todayListings: parseInt(today.rows[0]?.count ?? "0"),
      weekListings: parseInt(week.rows[0]?.count ?? "0"),
      topEvents: top.rows.map((r: { event_type: string; count: string }) => ({ event_type: r.event_type, count: parseInt(r.count) })),
    };
  } catch { return { totalListings: 0, totalImages: 0, totalBulk: 0, totalResearch: 0, todayListings: 0, weekListings: 0, topEvents: [] }; }
}
