import { pgTable, serial, integer, real, timestamp } from "drizzle-orm/pg-core";

export const imageStatsTable = pgTable("image_stats", {
  id: serial("id").primaryKey(),
  totalProcessed: integer("total_processed").notNull().default(0),
  totalUpscaled: integer("total_upscaled").notNull().default(0),
  totalConverted: integer("total_converted").notNull().default(0),
  totalBannersCreated: integer("total_banners_created").notNull().default(0),
  totalMetadataStripped: integer("total_metadata_stripped").notNull().default(0),
  averageProcessingTime: real("average_processing_time").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type ImageStats = typeof imageStatsTable.$inferSelect;
