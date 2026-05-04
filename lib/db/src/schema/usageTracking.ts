import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const actionEnum = pgEnum("action_type", [
  "upscale", "batch", "convert", "banner", "background_remove",
  "watermark", "metadata", "color_adjust", "ai_edit", "product_find", "studio",
]);

export const usageTrackingTable = pgTable("usage_tracking", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  sessionId: text("session_id"),
  action: actionEnum("action"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  processingTime: integer("processing_time_ms"),
  sizeBytes: integer("size_bytes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUsageSchema = createInsertSchema(usageTrackingTable).omit({ id: true, createdAt: true });
export type InsertUsage = z.infer<typeof insertUsageSchema>;
export type UsageTracking = typeof usageTrackingTable.$inferSelect;
