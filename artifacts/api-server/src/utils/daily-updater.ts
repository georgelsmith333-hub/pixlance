import cron from "node-cron";
import { db } from "@workspace/db";
import { aiModelCacheTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

// Fetch available models from Pollinations
async function fetchPollinationsModels(): Promise<Array<{ name: string; type: string }>> {
  try {
    const res = await fetch("https://image.pollinations.ai/models", { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as Array<{ name: string }> | Record<string, unknown>;
    if (Array.isArray(data)) return data.map((m) => ({ name: m.name ?? String(m), type: "image" }));
    return [];
  } catch (err) {
    logger.warn({ err }, "Failed to fetch Pollinations models");
    return [];
  }
}

// Upsert model to cache
async function syncModels(models: Array<{ name: string; type: string }>) {
  const now = new Date();
  for (const model of models) {
    const [existing] = await db.select().from(aiModelCacheTable)
      .where(eq(aiModelCacheTable.modelId, model.name)).limit(1);
    if (!existing) {
      await db.insert(aiModelCacheTable).values({
        provider: "pollinations",
        modelId: model.name,
        displayName: model.name,
        isActive: true,
        isFree: true,
        capabilities: ["text-to-image"],
        lastCheckedAt: now,
      });
      logger.info({ model: model.name }, "New AI model discovered and added");
    } else {
      await db.update(aiModelCacheTable)
        .set({ lastCheckedAt: now })
        .where(eq(aiModelCacheTable.modelId, model.name));
    }
  }
}

// Run an immediate check on startup, then daily at 3am
export function startDailyUpdater() {
  // Immediate check
  void (async () => {
    try {
      const models = await fetchPollinationsModels();
      if (models.length > 0) {
        await syncModels(models);
        logger.info({ count: models.length }, "AI model cache initialized on startup");
      }
    } catch (err) {
      logger.warn({ err }, "Startup AI model sync failed");
    }
  })();

  // Daily at 03:00 AM
  cron.schedule("0 3 * * *", async () => {
    logger.info("Running daily AI model update check");
    try {
      const models = await fetchPollinationsModels();
      if (models.length > 0) {
        await syncModels(models);
        logger.info({ count: models.length }, "Daily AI model sync complete");
      }
    } catch (err) {
      logger.error({ err }, "Daily AI model update failed");
    }
  });

  logger.info("Daily AI model updater started (runs at 03:00 daily)");
}
