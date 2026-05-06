import { Pool } from "pg";

const DATABASE_URL = process.env.NEON_URL || process.env.DATABASE_URL;

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    if (!DATABASE_URL) throw new Error("DATABASE_URL not set");
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
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
  console.log("[DB] Migrations complete — listing_history table ready");
}

export const dbAvailable = (): boolean => !!DATABASE_URL;
