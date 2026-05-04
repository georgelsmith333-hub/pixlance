import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adPlacementsTable = pgTable("ad_placements", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  placement: text("placement").notNull(),
  adType: text("ad_type").notNull(),
  adCode: text("ad_code").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  width: integer("width"),
  height: integer("height"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAdPlacementSchema = createInsertSchema(adPlacementsTable).omit({ id: true, createdAt: true });
export type InsertAdPlacement = z.infer<typeof insertAdPlacementSchema>;
export type AdPlacement = typeof adPlacementsTable.$inferSelect;
