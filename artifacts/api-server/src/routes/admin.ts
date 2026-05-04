import { Router } from "express";
import { db } from "@workspace/db";
import { adminSettingsTable, adPlacementsTable, announcementsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  UpdateAdminSettingsBody,
  CreateAdBody,
  UpdateAdBody,
  UpdateAdParams,
  DeleteAdParams,
  CreateAnnouncementBody,
  DeleteAnnouncementParams,
} from "@workspace/api-zod";

const router = Router();

// ─── Admin Settings ────────────────────────────────────────────

router.get("/admin/settings", async (req, res) => {
  try {
    let [settings] = await db.select().from(adminSettingsTable).limit(1);
    if (!settings) {
      const [created] = await db
        .insert(adminSettingsTable)
        .values({})
        .returning();
      settings = created;
    }
    res.json(settings);
  } catch (err) {
    req.log.error({ err }, "Failed to get admin settings");
    res.status(500).json({ error: "Failed to get settings" });
  }
});

router.put("/admin/settings", async (req, res) => {
  const parsed = UpdateAdminSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }
  try {
    let [settings] = await db.select().from(adminSettingsTable).limit(1);
    if (!settings) {
      const [created] = await db.insert(adminSettingsTable).values({}).returning();
      settings = created;
    }
    const [updated] = await db
      .update(adminSettingsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(adminSettingsTable.id, settings.id))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update admin settings");
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// ─── Ad Placements ─────────────────────────────────────────────

router.get("/admin/ads", async (req, res) => {
  try {
    const ads = await db.select().from(adPlacementsTable).orderBy(adPlacementsTable.id);
    res.json(ads);
  } catch (err) {
    req.log.error({ err }, "Failed to get ads");
    res.status(500).json({ error: "Failed to get ads" });
  }
});

router.post("/admin/ads", async (req, res) => {
  const parsed = CreateAdBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }
  try {
    const [ad] = await db
      .insert(adPlacementsTable)
      .values({
        name: parsed.data.name,
        placement: parsed.data.placement,
        adType: parsed.data.adType,
        adCode: parsed.data.adCode,
        isActive: parsed.data.isActive ?? true,
        width: parsed.data.width,
        height: parsed.data.height,
      })
      .returning();
    res.status(201).json(ad);
  } catch (err) {
    req.log.error({ err }, "Failed to create ad");
    res.status(500).json({ error: "Failed to create ad" });
  }
});

router.put("/admin/ads/:id", async (req, res) => {
  const paramsParsed = UpdateAdParams.safeParse(req.params);
  const bodyParsed = UpdateAdBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  try {
    const [updated] = await db
      .update(adPlacementsTable)
      .set({
        name: bodyParsed.data.name,
        placement: bodyParsed.data.placement,
        adType: bodyParsed.data.adType,
        adCode: bodyParsed.data.adCode,
        isActive: bodyParsed.data.isActive ?? true,
        width: bodyParsed.data.width,
        height: bodyParsed.data.height,
      })
      .where(eq(adPlacementsTable.id, paramsParsed.data.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Ad not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update ad");
    res.status(500).json({ error: "Failed to update ad" });
  }
});

router.delete("/admin/ads/:id", async (req, res) => {
  const parsed = DeleteAdParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    await db.delete(adPlacementsTable).where(eq(adPlacementsTable.id, parsed.data.id));
    res.json({ success: true, id: parsed.data.id });
  } catch (err) {
    req.log.error({ err }, "Failed to delete ad");
    res.status(500).json({ error: "Failed to delete ad" });
  }
});

// ─── Announcements ─────────────────────────────────────────────

router.get("/admin/announcements", async (req, res) => {
  try {
    const items = await db
      .select()
      .from(announcementsTable)
      .orderBy(announcementsTable.id);
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to get announcements");
    res.status(500).json({ error: "Failed to get announcements" });
  }
});

router.post("/admin/announcements", async (req, res) => {
  const parsed = CreateAnnouncementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }
  try {
    const [item] = await db
      .insert(announcementsTable)
      .values({
        message: parsed.data.message,
        type: parsed.data.type,
        isActive: parsed.data.isActive ?? true,
      })
      .returning();
    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to create announcement");
    res.status(500).json({ error: "Failed to create announcement" });
  }
});

router.delete("/admin/announcements/:id", async (req, res) => {
  const parsed = DeleteAnnouncementParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    await db.delete(announcementsTable).where(eq(announcementsTable.id, parsed.data.id));
    res.json({ success: true, id: parsed.data.id });
  } catch (err) {
    req.log.error({ err }, "Failed to delete announcement");
    res.status(500).json({ error: "Failed to delete announcement" });
  }
});

export default router;
