import { Router } from "express";
import sharp from "sharp";
import { db } from "@workspace/db";
import { imageStatsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  UpscaleImageBody,
  BatchUpscaleImagesBody,
  ConvertImageBody,
  ProcessMetadataBody,
  CreateBannerBody,
  AiEditImageBody,
} from "@workspace/api-zod";
import { generateWithFallback } from "../utils/ai-fallback";

const router = Router();

// Helper: base64 data URL → Buffer
function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URL");
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

// Helper: Buffer → base64 data URL
function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType}/${mimeType === "image/jpeg" ? "jpeg" : mimeType.split("/")[1]};base64,${buffer.toString("base64")}`;
}

function getMimeType(format: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    avif: "image/avif",
    tiff: "image/tiff",
    bmp: "image/bmp",
    gif: "image/gif",
  };
  return map[format] ?? "image/jpeg";
}

async function incrementStats(field: "totalUpscaled" | "totalConverted" | "totalBannersCreated" | "totalMetadataStripped", processingTime: number) {
  const [existing] = await db.select().from(imageStatsTable).limit(1);
  if (!existing) {
    await db.insert(imageStatsTable).values({
      totalProcessed: 1,
      [field]: 1,
      totalUpscaled: field === "totalUpscaled" ? 1 : 0,
      totalConverted: field === "totalConverted" ? 1 : 0,
      totalBannersCreated: field === "totalBannersCreated" ? 1 : 0,
      totalMetadataStripped: field === "totalMetadataStripped" ? 1 : 0,
      averageProcessingTime: processingTime,
    });
  } else {
    const newTotal = existing.totalProcessed + 1;
    const newAvg = (existing.averageProcessingTime * existing.totalProcessed + processingTime) / newTotal;
    await db
      .update(imageStatsTable)
      .set({
        totalProcessed: newTotal,
        [field]: (existing[field] as number) + 1,
        averageProcessingTime: newAvg,
        updatedAt: new Date(),
      })
      .where(eq(imageStatsTable.id, existing.id));
  }
}

// Upscale a single image
router.post("/images/upscale", async (req, res) => {
  const startTime = Date.now();
  const parsed = UpscaleImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }
  const data = parsed.data;
  try {
    const { buffer } = dataUrlToBuffer(data.imageData);
    const format = (data.outputFormat ?? "jpg") as keyof sharp.FormatEnum;
    const quality = data.quality ?? 90;

    // eBay requires 1:1 ratio and 1600–6500px
    const targetW = Math.min(Math.max(data.targetWidth ?? 2000, 1600), 6500);
    const targetH = Math.min(Math.max(data.targetHeight ?? 2000, 1600), 6500);

    let pipeline = sharp(buffer, { failOnError: false });

    if (data.stripMetadata) {
      pipeline = pipeline.withMetadata({});
    } else {
      pipeline = pipeline.withMetadata();
    }

    // Resize with Lanczos (high-quality)
    pipeline = pipeline.resize(targetW, targetH, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
      kernel: sharp.kernel.lanczos3,
    });

    // Apply eBay CTR optimizations: sharpen, slight contrast boost
    if (data.addEbayOptimization) {
      pipeline = pipeline.sharpen({ sigma: 1.2, m1: 0.5, m2: 0.4 }).modulate({ brightness: 1.02, saturation: 1.05 });
    }

    let outputBuffer: Buffer;
    const mimeType = getMimeType(format);
    if (format === "jpg" || format === "jpeg") {
      outputBuffer = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
    } else if (format === "png") {
      outputBuffer = await pipeline.png({ quality }).toBuffer();
    } else if (format === "webp") {
      outputBuffer = await pipeline.webp({ quality }).toBuffer();
    } else if (format === "avif") {
      outputBuffer = await pipeline.avif({ quality }).toBuffer();
    } else if (format === "tiff") {
      outputBuffer = await pipeline.tiff({ quality }).toBuffer();
    } else {
      outputBuffer = await pipeline.jpeg({ quality }).toBuffer();
    }

    const meta = await sharp(outputBuffer).metadata();
    const processingTime = (Date.now() - startTime) / 1000;
    await incrementStats("totalUpscaled", processingTime);

    res.json({
      imageData: `data:${mimeType};base64,${outputBuffer.toString("base64")}`,
      filename: data.filename.replace(/\.[^.]+$/, `.${format === "jpeg" ? "jpg" : format}`),
      width: meta.width ?? targetW,
      height: meta.height ?? targetH,
      format,
      sizeBytes: outputBuffer.length,
      processingTime,
    });
  } catch (err) {
    req.log.error({ err }, "Upscale failed");
    res.status(500).json({ error: "Upscale failed", message: String(err) });
  }
});

// Batch upscale
router.post("/images/batch-upscale", async (req, res) => {
  const startTime = Date.now();
  const parsed = BatchUpscaleImagesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }
  const { images, globalSettings } = parsed.data;
  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (const img of images) {
    const merged = { ...globalSettings, ...img } as typeof img;
    try {
      const { buffer } = dataUrlToBuffer(merged.imageData);
      const format = (merged.outputFormat ?? globalSettings?.outputFormat ?? "jpg") as keyof sharp.FormatEnum;
      const quality = merged.quality ?? globalSettings?.quality ?? 90;
      const targetW = Math.min(Math.max(merged.targetWidth ?? globalSettings?.targetWidth ?? 2000, 1600), 6500);
      const targetH = Math.min(Math.max(merged.targetHeight ?? globalSettings?.targetHeight ?? 2000, 1600), 6500);
      const stripMeta = merged.stripMetadata ?? globalSettings?.stripMetadata ?? false;
      const ebayOpt = merged.addEbayOptimization ?? globalSettings?.addEbayOptimization ?? false;

      let pipeline = sharp(buffer, { failOnError: false });
      if (stripMeta) {
        pipeline = pipeline.withMetadata({});
      } else {
        pipeline = pipeline.withMetadata();
      }
      pipeline = pipeline.resize(targetW, targetH, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
        kernel: sharp.kernel.lanczos3,
      });
      if (ebayOpt) {
        pipeline = pipeline.sharpen({ sigma: 1.2, m1: 0.5, m2: 0.4 }).modulate({ brightness: 1.02, saturation: 1.05 });
      }

      let outputBuffer: Buffer;
      const mimeType = getMimeType(format);
      if (format === "jpg" || format === "jpeg") {
        outputBuffer = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
      } else if (format === "png") {
        outputBuffer = await pipeline.png({ quality }).toBuffer();
      } else if (format === "webp") {
        outputBuffer = await pipeline.webp({ quality }).toBuffer();
      } else {
        outputBuffer = await pipeline.jpeg({ quality }).toBuffer();
      }

      const meta = await sharp(outputBuffer).metadata();
      results.push({
        imageData: `data:${mimeType};base64,${outputBuffer.toString("base64")}`,
        filename: merged.filename.replace(/\.[^.]+$/, `.${format === "jpeg" ? "jpg" : format}`),
        width: meta.width ?? targetW,
        height: meta.height ?? targetH,
        format,
        sizeBytes: outputBuffer.length,
        processingTime: 0,
      });
      successCount++;
    } catch {
      failureCount++;
    }
  }

  const totalTime = (Date.now() - startTime) / 1000;
  await incrementStats("totalUpscaled", totalTime / Math.max(successCount, 1));

  res.json({ results, successCount, failureCount, totalTime });
});

// Convert image format
router.post("/images/convert", async (req, res) => {
  const startTime = Date.now();
  const parsed = ConvertImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const data = parsed.data;
  try {
    const { buffer } = dataUrlToBuffer(data.imageData);
    const format = data.outputFormat as keyof sharp.FormatEnum;
    const quality = data.quality ?? 90;

    let pipeline = sharp(buffer, { failOnError: false });
    if (data.stripMetadata) {
      pipeline = pipeline.withMetadata({});
    } else {
      pipeline = pipeline.withMetadata();
    }

    let outputBuffer: Buffer;
    const mimeType = getMimeType(format);
    if (format === "jpg" || format === "jpeg") {
      outputBuffer = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
    } else if (format === "png") {
      outputBuffer = await pipeline.png({ quality }).toBuffer();
    } else if (format === "webp") {
      outputBuffer = await pipeline.webp({ quality }).toBuffer();
    } else if (format === "avif") {
      outputBuffer = await pipeline.avif({ quality }).toBuffer();
    } else if (format === "tiff") {
      outputBuffer = await pipeline.tiff({ quality }).toBuffer();
    } else if (format === "gif") {
      outputBuffer = await pipeline.gif().toBuffer();
    } else {
      outputBuffer = await pipeline.jpeg({ quality }).toBuffer();
    }

    const meta = await sharp(outputBuffer).metadata();
    const processingTime = (Date.now() - startTime) / 1000;
    await incrementStats("totalConverted", processingTime);

    res.json({
      imageData: `data:${mimeType};base64,${outputBuffer.toString("base64")}`,
      filename: data.filename.replace(/\.[^.]+$/, `.${format === "jpeg" ? "jpg" : format}`),
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      format,
      sizeBytes: outputBuffer.length,
      processingTime,
    });
  } catch (err) {
    req.log.error({ err }, "Convert failed");
    res.status(500).json({ error: "Convert failed", message: String(err) });
  }
});

// Metadata read/strip/edit
router.post("/images/metadata", async (req, res) => {
  const startTime = Date.now();
  const parsed = ProcessMetadataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const data = parsed.data;
  try {
    const { buffer, mimeType } = dataUrlToBuffer(data.imageData);
    const img = sharp(buffer, { failOnError: false });
    const rawMeta = await img.metadata();

    if (data.action === "read") {
      res.json({
        metadata: {
          format: rawMeta.format,
          width: rawMeta.width,
          height: rawMeta.height,
          space: rawMeta.space,
          channels: rawMeta.channels,
          depth: rawMeta.depth,
          density: rawMeta.density,
          hasAlpha: rawMeta.hasAlpha,
          orientation: rawMeta.orientation,
          exif: rawMeta.exif ? "EXIF data present" : "No EXIF data",
          icc: rawMeta.icc ? "ICC profile present" : "No ICC profile",
          xmp: rawMeta.xmp ? "XMP data present" : "No XMP data",
          size: `${buffer.length} bytes`,
        },
        filename: data.filename,
      });
      return;
    }

    if (data.action === "strip") {
      const stripped = await img.withMetadata({}).toBuffer();
      await incrementStats("totalMetadataStripped", (Date.now() - startTime) / 1000);
      res.json({
        metadata: { message: "All metadata stripped" },
        imageData: `data:${mimeType};base64,${stripped.toString("base64")}`,
        filename: data.filename,
      });
      return;
    }

    if (data.action === "edit") {
      // Write custom metadata (EXIF via withMetadata)
      const edited = await img.withMetadata({
        exif: {
          IFD0: Object.fromEntries(
            Object.entries(data.metadata ?? {}).map(([k, v]) => [k, v])
          ),
        },
      }).toBuffer();
      res.json({
        metadata: data.metadata ?? {},
        imageData: `data:${mimeType};base64,${edited.toString("base64")}`,
        filename: data.filename,
      });
      return;
    }

    res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    req.log.error({ err }, "Metadata processing failed");
    res.status(500).json({ error: "Metadata processing failed", message: String(err) });
  }
});

// eBay Banner creator
router.post("/images/banner", async (req, res) => {
  const startTime = Date.now();
  const parsed = CreateBannerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const data = parsed.data;
  try {
    const { buffer } = dataUrlToBuffer(data.imageData);
    const bannerW = Math.min(Math.max(data.bannerWidth ?? 1600, 1600), 6500);
    const bannerH = Math.min(Math.max(data.bannerHeight ?? 1600, 1600), 6500);
    const format = (data.outputFormat ?? "jpg") as keyof sharp.FormatEnum;
    const quality = 95;

    // Step 1: Create white background canvas
    const whiteBg = sharp({
      create: {
        width: bannerW,
        height: bannerH,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    });

    // Step 2: Resize product image to fit 85% of canvas, maintaining aspect ratio
    const productSize = Math.round(Math.min(bannerW, bannerH) * 0.85);
    const productResized = await sharp(buffer, { failOnError: false })
      .resize(productSize, productSize, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
        kernel: sharp.kernel.lanczos3,
      })
      .sharpen({ sigma: 1.0, m1: 0.4, m2: 0.3 })
      .modulate({ brightness: 1.02, saturation: 1.04 })
      .png()
      .toBuffer();

    // Step 3: Position product centered
    const prodLeft = Math.round((bannerW - productSize) / 2);
    const prodTop = Math.round((bannerH - productSize) / 2);

    // Step 4: Create country badge SVG
    const countryBadges: Record<string, string> = {
      US: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="60"><rect width="180" height="60" rx="8" fill="#003580"/><text x="14" y="38" font-family="Arial" font-size="28" fill="white">🇺🇸</text><text x="52" y="37" font-family="Arial" font-size="14" font-weight="bold" fill="white">FAST US</text><text x="52" y="52" font-family="Arial" font-size="11" fill="#90CAF9">FREE SHIPPING</text></svg>`,
      UK: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="60"><rect width="180" height="60" rx="8" fill="#012169"/><text x="14" y="38" font-family="Arial" font-size="28" fill="white">🇬🇧</text><text x="52" y="37" font-family="Arial" font-size="14" font-weight="bold" fill="white">FAST UK</text><text x="52" y="52" font-family="Arial" font-size="11" fill="#90CAF9">FREE SHIPPING</text></svg>`,
      CA: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="60"><rect width="180" height="60" rx="8" fill="#D80621"/><text x="14" y="38" font-family="Arial" font-size="28" fill="white">🇨🇦</text><text x="52" y="37" font-family="Arial" font-size="14" font-weight="bold" fill="white">FAST CA</text><text x="52" y="52" font-family="Arial" font-size="11" fill="#FFCDD2">FREE SHIPPING</text></svg>`,
      AU: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="60"><rect width="180" height="60" rx="8" fill="#00008B"/><text x="14" y="38" font-family="Arial" font-size="28" fill="white">🇦🇺</text><text x="52" y="37" font-family="Arial" font-size="14" font-weight="bold" fill="white">FAST AU</text><text x="52" y="52" font-family="Arial" font-size="11" fill="#90CAF9">FREE SHIPPING</text></svg>`,
      DE: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="60"><rect width="180" height="60" rx="8" fill="#333"/><text x="14" y="38" font-family="Arial" font-size="28" fill="white">🇩🇪</text><text x="52" y="37" font-family="Arial" font-size="14" font-weight="bold" fill="white">FAST DE</text><text x="52" y="52" font-family="Arial" font-size="11" fill="#bbb">FREE SHIPPING</text></svg>`,
      FR: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="60"><rect width="180" height="60" rx="8" fill="#002395"/><text x="14" y="38" font-family="Arial" font-size="28" fill="white">🇫🇷</text><text x="52" y="37" font-family="Arial" font-size="14" font-weight="bold" fill="white">FAST FR</text><text x="52" y="52" font-family="Arial" font-size="11" fill="#90CAF9">FREE SHIPPING</text></svg>`,
      IT: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="60"><rect width="180" height="60" rx="8" fill="#009246"/><text x="14" y="38" font-family="Arial" font-size="28" fill="white">🇮🇹</text><text x="52" y="37" font-family="Arial" font-size="14" font-weight="bold" fill="white">FAST IT</text><text x="52" y="52" font-family="Arial" font-size="11" fill="#C8E6C9">FREE SHIPPING</text></svg>`,
      ES: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="60"><rect width="180" height="60" rx="8" fill="#C60B1E"/><text x="14" y="38" font-family="Arial" font-size="28" fill="white">🇪🇸</text><text x="52" y="37" font-family="Arial" font-size="14" font-weight="bold" fill="white">FAST ES</text><text x="52" y="52" font-family="Arial" font-size="11" fill="#FFCDD2">FREE SHIPPING</text></svg>`,
      JP: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="60"><rect width="180" height="60" rx="8" fill="#BC002D"/><text x="14" y="38" font-family="Arial" font-size="28" fill="white">🇯🇵</text><text x="52" y="37" font-family="Arial" font-size="14" font-weight="bold" fill="white">FAST JP</text><text x="52" y="52" font-family="Arial" font-size="11" fill="#FFCDD2">FREE SHIPPING</text></svg>`,
    };

    const country = data.country ?? "US";
    const badgeSvg = countryBadges[country] ?? countryBadges["US"];
    const badgeBuffer = await sharp(Buffer.from(badgeSvg)).png().toBuffer();

    // Determine badge position
    const badgeW = 180;
    const badgeH = 60;
    const margin = Math.round(bannerW * 0.02);
    const pos = data.logoPosition ?? "bottom-right";
    const badgeLeft =
      pos.includes("right") ? bannerW - badgeW - margin : margin;
    const badgeTop =
      pos.includes("bottom") ? bannerH - badgeH - margin : margin;

    // Composite: white bg + product + badge
    const finalBuffer = await whiteBg
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    const composed = await sharp(finalBuffer)
      .composite([
        { input: productResized, left: prodLeft, top: prodTop },
        { input: badgeBuffer, left: badgeLeft, top: badgeTop },
      ])
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    const processingTime = (Date.now() - startTime) / 1000;
    await incrementStats("totalBannersCreated", processingTime);

    res.json({
      imageData: `data:image/jpeg;base64,${composed.toString("base64")}`,
      filename: data.filename.replace(/\.[^.]+$/, `_banner.jpg`),
      width: bannerW,
      height: bannerH,
      format: "jpg",
      sizeBytes: composed.length,
      processingTime,
    });
  } catch (err) {
    req.log.error({ err }, "Banner creation failed");
    res.status(500).json({ error: "Banner creation failed", message: String(err) });
  }
});

// AI edit (text editing on product images using Pollinations API)
router.post("/images/ai-edit", async (req, res) => {
  const startTime = Date.now();
  const parsed = AiEditImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const data = parsed.data;
  try {
    // Use Pollinations img2img API for AI editing
    // Pollinations free API: https://image.pollinations.ai/prompt/{prompt}
    // For image editing, we use the enhance endpoint with the instruction
    const prompt = encodeURIComponent(
      `Professionally edit this product image: ${data.editInstruction}. Keep all other parts of the image identical. High quality product photography, white background, sharp details.`
    );

    // Get original image dimensions for reference
    const { buffer } = dataUrlToBuffer(data.imageData);
    const meta = await sharp(buffer).metadata();
    const w = Math.min(meta.width ?? 1600, 1600);
    const h = Math.min(meta.height ?? 1600, 1600);

    // Use multi-model AI fallback chain (Pollinations flux → turbo → flux-realism → CF Workers AI)
    const outputBuffer = await generateWithFallback(
      `Professionally edit this product image: ${data.editInstruction}. Keep all other parts of the image identical. High quality product photography, white background, sharp details.`,
      w,
      h,
    );

    const processingTime = (Date.now() - startTime) / 1000;

    res.json({
      imageData: `data:image/jpeg;base64,${outputBuffer.toString("base64")}`,
      filename: data.filename.replace(/\.[^.]+$/, "_ai_edited.jpg"),
      width: w,
      height: h,
      format: "jpg",
      sizeBytes: outputBuffer.length,
      processingTime,
    });
  } catch (err) {
    req.log.error({ err }, "AI edit failed");
    res.status(500).json({ error: "AI edit failed", message: String(err) });
  }
});

// Image stats
router.get("/images/stats", async (req, res) => {
  try {
    const [stats] = await db.select().from(imageStatsTable).limit(1);
    if (!stats) {
      res.json({
        totalProcessed: 0,
        totalUpscaled: 0,
        totalConverted: 0,
        totalBannersCreated: 0,
        totalMetadataStripped: 0,
        averageProcessingTime: 0,
      });
      return;
    }
    res.json({
      totalProcessed: stats.totalProcessed,
      totalUpscaled: stats.totalUpscaled,
      totalConverted: stats.totalConverted,
      totalBannersCreated: stats.totalBannersCreated,
      totalMetadataStripped: stats.totalMetadataStripped,
      averageProcessingTime: stats.averageProcessingTime,
    });
  } catch (err) {
    req.log.error({ err }, "Stats fetch failed");
    res.status(500).json({ error: "Stats fetch failed" });
  }
});

export default router;
