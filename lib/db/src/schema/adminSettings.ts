import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adminSettingsTable = pgTable("admin_settings", {
  id: serial("id").primaryKey(),
  siteName: text("site_name").notNull().default("eBay Image Pro"),
  siteTagline: text("site_tagline").default("The Ultimate eBay Image Optimizer"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  maxUploadSizeMb: integer("max_upload_size_mb").notNull().default(50),
  maxBatchSize: integer("max_batch_size").notNull().default(100),
  defaultOutputFormat: text("default_output_format").notNull().default("jpg"),
  defaultQuality: integer("default_quality").notNull().default(90),
  adsEnabled: boolean("ads_enabled").notNull().default(false),
  announcementBarEnabled: boolean("announcement_bar_enabled").notNull().default(false),
  announcementBarText: text("announcement_bar_text").default(""),
  announcementBarColor: text("announcement_bar_color").default("#0EA5E9"),
  primaryColor: text("primary_color").default("#0EA5E9"),
  accentColor: text("accent_color").default("#8B5CF6"),
  // Feature flags
  bgRemoveEnabled: boolean("bg_remove_enabled").notNull().default(true),
  watermarkEnabled: boolean("watermark_enabled").notNull().default(true),
  metadataEditEnabled: boolean("metadata_edit_enabled").notNull().default(true),
  colorAdjustEnabled: boolean("color_adjust_enabled").notNull().default(true),
  aiEditEnabled: boolean("ai_edit_enabled").notNull().default(true),
  batchEnabled: boolean("batch_enabled").notNull().default(true),
  bannerEnabled: boolean("banner_enabled").notNull().default(true),
  r2StorageEnabled: boolean("r2_storage_enabled").notNull().default(false),
  // Subscription / usage limits
  freeMonthlyLimit: integer("free_monthly_limit").notNull().default(500),
  freeBatchLimit: integer("free_batch_limit").notNull().default(10),
  freeMaxUpscalePx: integer("free_max_upscale_px").notNull().default(2000),
  proMaxUpscalePx: integer("pro_max_upscale_px").notNull().default(6500),
  requireLoginForPro: boolean("require_login_for_pro").notNull().default(false),
  proFeaturesEnabled: boolean("pro_features_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAdminSettingsSchema = createInsertSchema(adminSettingsTable).omit({ id: true });
export type InsertAdminSettings = z.infer<typeof insertAdminSettingsSchema>;
export type AdminSettings = typeof adminSettingsTable.$inferSelect;
