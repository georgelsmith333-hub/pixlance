import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const aiModelCacheTable = pgTable("ai_model_cache", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("pollinations"),
  modelId: text("model_id").notNull(),
  displayName: text("display_name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isFree: boolean("is_free").notNull().default(true),
  capabilities: jsonb("capabilities").$type<string[]>().default([]),
  lastCheckedAt: timestamp("last_checked_at").defaultNow(),
  addedAt: timestamp("added_at").defaultNow(),
});

export type AiModelCache = typeof aiModelCacheTable.$inferSelect;
