import { Router } from "express";
import { z } from "zod";
import { runEbayPipeline, getJob } from "../pipeline/ebayPipeline.js";

const router = Router();

// ── POST /api/ebay/import — scrape product from URL or accept raw data ────────
const ImportBody = z.object({
  url: z.string().url().optional(),
  title: z.string().optional(),
  images: z.array(z.string()).optional(),
  price: z.number().optional(),
  specs: z.record(z.string()).optional(),
  brand: z.string().optional(),
  condition: z.string().optional(),
  platform: z.enum(["aliexpress", "ebay", "amazon", "generic"]).optional(),
  useAiEnhance: z.boolean().default(true),
});

router.post("/ebay/import", async (req, res) => {
  const parsed = ImportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }

  if (!parsed.data.url && !parsed.data.title) {
    res.status(400).json({ error: "Provide either a URL or a product title" });
    return;
  }

  try {
    // Run full pipeline
    const result = await runEbayPipeline(parsed.data);
    res.json({
      success: true,
      pipelineId: result.pipelineId,
      status: result.status,
      product: result.product,
      listing: result.listing,
      rankedImages: result.rankedImages,
      competitors: result.competitors,
      draft: result.draft,
      csvData: result.csvData,
      processingMs: result.processingMs,
    });
  } catch (err) {
    req.log.error({ err }, "eBay pipeline failed");
    res.status(500).json({ error: "Pipeline failed", message: String(err) });
  }
});

// ── POST /api/ebay/generate — generate listing from structured input ───────────
const GenerateBody = z.object({
  title: z.string().min(3),
  brand: z.string().optional(),
  condition: z.string().optional(),
  specs: z.record(z.string()).optional(),
  price: z.number().optional(),
  images: z.array(z.string()).optional(),
  useAiEnhance: z.boolean().default(true),
  ebayAuthToken: z.string().optional(),
});

router.post("/ebay/generate", async (req, res) => {
  const parsed = GenerateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }

  try {
    const result = await runEbayPipeline(parsed.data);
    res.json({
      success: true,
      pipelineId: result.pipelineId,
      listing: result.listing,
      rankedImages: result.rankedImages,
      competitors: result.competitors,
      draft: result.draft,
      csvData: result.csvData,
      processingMs: result.processingMs,
    });
  } catch (err) {
    req.log.error({ err }, "eBay generate failed");
    res.status(500).json({ error: "Generation failed", message: String(err) });
  }
});

// ── POST /api/ebay/upload — upload to eBay via API (requires eBay token) ──────
const UploadBody = z.object({
  pipelineId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  price: z.number(),
  categoryId: z.string(),
  conditionId: z.string().default("1000"),
  itemSpecifics: z.record(z.string()).optional(),
  pictureUrls: z.array(z.string()).optional(),
  quantity: z.number().default(1),
  ebayAuthToken: z.string(),
});

router.post("/ebay/upload", async (req, res) => {
  const parsed = UploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }

  try {
    let jobResult = parsed.data.pipelineId ? getJob(parsed.data.pipelineId) : null;

    if (!jobResult && !parsed.data.title) {
      res.status(400).json({ error: "Provide pipelineId or title" });
      return;
    }

    // If we have a pipeline job result, use it for upload
    if (jobResult) {
      const { publishViaEbayApi } = await import("../ebay/uploader.js");
      const draft = jobResult.draft;
      const result = await publishViaEbayApi(draft, parsed.data.ebayAuthToken);
      res.json(result);
      return;
    }

    // Otherwise build from scratch
    const { createEbayDraft } = await import("../ebay/uploader.js");
    const { optimizeListing } = await import("../ebay/optimizer.js");
    const { publishViaEbayApi } = await import("../ebay/uploader.js");

    const listing = optimizeListing({
      title: parsed.data.title,
      specs: parsed.data.itemSpecifics,
    });
    const draft = createEbayDraft(listing, {
      price: parsed.data.price,
      quantity: parsed.data.quantity,
      imageUrls: parsed.data.pictureUrls,
    });
    const result = await publishViaEbayApi(draft, parsed.data.ebayAuthToken);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "eBay upload failed");
    res.status(500).json({ error: "Upload failed", message: String(err) });
  }
});

// ── GET /api/ebay/status/:id — get pipeline job status ──────────────────────
router.get("/ebay/status/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Pipeline job not found" });
    return;
  }
  res.json({
    pipelineId: job.pipelineId,
    status: job.status,
    processingMs: job.processingMs,
    completedAt: (job as any).completedAt,
    titleScore: job.listing.titleScore,
    ctxScore: job.listing.ctxScore,
  });
});

// ── GET /api/ebay/export/:id — export listing ZIP files ──────────────────────
router.get("/ebay/export/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Pipeline job not found" });
    return;
  }

  const format = req.query.format as string;

  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="ebay-listing-${job.pipelineId}.csv"`);
    res.send(job.csvData);
    return;
  }

  if (format === "json") {
    res.json(job.exportFiles);
    return;
  }

  // Default: return all export data
  res.json({
    pipelineId: job.pipelineId,
    exportFiles: job.exportFiles,
    listing: job.listing,
    draft: job.draft,
    competitors: job.competitors,
    rankedImages: job.rankedImages,
  });
});

// ── POST /api/ebay/title-optimize — standalone title optimizer ─────────────────
router.post("/ebay/title-optimize", async (req, res) => {
  const { title, brand, specs } = req.body as { title: string; brand?: string; specs?: Record<string, string> };
  if (!title) { res.status(400).json({ error: "Title required" }); return; }

  const { generateEbayTitle, aiEnhanceTitle } = await import("../ebay/optimizer.js");
  const ruleBased = generateEbayTitle({ title, brand, specs });
  const aiTitle = await aiEnhanceTitle(title, brand ?? "", specs ?? {});

  res.json({
    ruleBased: ruleBased.title,
    ruleBasedScore: ruleBased.score,
    aiOptimized: aiTitle || ruleBased.title,
    alternatives: ruleBased.alternatives,
  });
});

// ── GET /api/ebay/competitors — live competitor search ──────────────────────
router.get("/ebay/competitors", async (req, res) => {
  const { title } = req.query as { title: string };
  if (!title) { res.status(400).json({ error: "title query param required" }); return; }

  const { scrapeCompetitors } = await import("../pipeline/ebayPipeline.js");
  try {
    const data = await scrapeCompetitors(title);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Chrome Extension endpoint — instant pipeline trigger ──────────────────────
router.post("/ebay/extension", async (req, res) => {
  const { title, images, price, url, platform, specs, brand } = req.body as {
    title?: string; images?: string[]; price?: number; url?: string;
    platform?: string; specs?: Record<string, string>; brand?: string;
  };

  if (!title && !url) {
    res.status(400).json({ error: "Provide title or url" });
    return;
  }

  try {
    const result = await runEbayPipeline({
      title, images, price, url,
      platform: platform as any,
      specs, brand,
      useAiEnhance: true,
    });

    res.json({
      success: true,
      pipelineId: result.pipelineId,
      listing: result.listing,
      competitors: result.competitors,
      rankedImages: result.rankedImages.slice(0, 4),
      draft: result.draft,
      processingMs: result.processingMs,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
