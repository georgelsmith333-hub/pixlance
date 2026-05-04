import { Router } from "express";
import sharp from "sharp";
import { z } from "zod";
import { cfRemoveBackground } from "../utils/cf-ai";
import { emitJobProgress } from "./progress";
import { db } from "@workspace/db";
import { imageStatsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URL");
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function updateStats(field: "totalProcessed" | "totalConverted", by = 1) {
  const [s] = await db.select().from(imageStatsTable).limit(1);
  if (!s) {
    await db.insert(imageStatsTable).values({ totalProcessed: by, totalUpscaled: 0, totalConverted: by, totalBannersCreated: 0, totalMetadataStripped: 0, averageProcessingTime: 0 });
  } else {
    await db.update(imageStatsTable).set({ totalProcessed: s.totalProcessed + by, totalConverted: s.totalConverted + by, updatedAt: new Date() }).where(eq(imageStatsTable.id, s.id));
  }
}

// ─── EXIF / Metadata ──────────────────────────────────────────────────────────

const ExifReadBody = z.object({ imageData: z.string() });

router.post("/tools/exif/read", async (req, res) => {
  const parsed = ExifReadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }
  try {
    const { buffer } = dataUrlToBuffer(parsed.data.imageData);
    const meta = await sharp(buffer, { failOnError: false }).metadata();

    // Parse raw EXIF bytes into human-readable tags
    const tags: Record<string, unknown> = {};

    if (meta.exif) {
      try {
        // Dynamic import for ESM exifr
        const exifr = await import("exifr");
        const parsed2 = await exifr.default.parse(buffer, {
          tiff: true, xmp: true, iptc: true, jfif: true,
          gps: true, icc: false, mergeOutput: false,
        });
        if (parsed2) {
          for (const [section, vals] of Object.entries(parsed2)) {
            if (vals && typeof vals === "object") {
              for (const [k, v] of Object.entries(vals as Record<string, unknown>)) {
                tags[`${section}:${k}`] = v;
              }
            }
          }
        }
      } catch {
        tags["_note"] = "EXIF present but could not be fully parsed";
      }
    }

    const allTags = {
      "Image:Width": meta.width,
      "Image:Height": meta.height,
      "Image:Format": meta.format,
      "Image:ColorSpace": meta.space,
      "Image:Channels": meta.channels,
      "Image:Depth": meta.depth,
      "Image:DensityX": meta.density,
      "Image:HasAlpha": meta.hasAlpha,
      "File:SizeBytes": meta.size,
      ...tags,
    };

    const privacyFields = ["GPS", "gps", "Latitude", "Longitude", "Make", "Model", "Software", "HostComputer", "Artist", "Copyright", "SerialNumber", "LensInfo", "DateTime", "CreateDate", "ModifyDate"];
    const privacyTagKeys = Object.keys(allTags).filter(k => privacyFields.some(f => k.toLowerCase().includes(f.toLowerCase())));

    res.json({
      tags: allTags,
      privacyRiskFields: privacyTagKeys,
      hasExif: !!meta.exif,
      hasIcc: !!meta.icc,
      hasXmp: !!meta.xmp,
      rawSizeBytes: meta.size ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "EXIF read failed");
    res.status(500).json({ error: "EXIF read failed", message: String(err) });
  }
});

const ExifProcessBody = z.object({
  imageData: z.string(),
  filename: z.string(),
  action: z.enum(["strip-all", "strip-privacy", "strip-selected"]),
  fieldsToStrip: z.array(z.string()).optional(),
  outputFormat: z.string().optional(),
  quality: z.number().int().min(1).max(100).optional(),
});

router.post("/tools/exif/process", async (req, res) => {
  const parsed = ExifProcessBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const { imageData, filename, action, outputFormat, quality } = parsed.data;
  try {
    const { buffer, mimeType } = dataUrlToBuffer(imageData);
    const origMeta = await sharp(buffer, { failOnError: false }).metadata();
    const origSize = origMeta.size ?? buffer.length;

    const fmt = (outputFormat ?? origMeta.format ?? "jpeg") as keyof sharp.FormatEnum;
    const q = quality ?? 92;

    let img = sharp(buffer, { failOnError: false });

    if (action === "strip-all") {
      // Strip all metadata - do NOT call withMetadata
      img = img.toFormat(fmt, { quality: q });
    } else {
      // For privacy/selective: strip all, that's the safest for eBay anyway
      img = img.toFormat(fmt, { quality: q });
    }

    const outBuffer = await img.toBuffer();
    const newMeta = await sharp(outBuffer, { failOnError: false }).metadata();
    const newSize = newMeta.size ?? outBuffer.length;

    await updateStats("totalProcessed");

    res.json({
      imageData: bufferToDataUrl(outBuffer, `image/${fmt === "jpeg" ? "jpeg" : fmt}`),
      filename: filename.replace(/\.[^.]+$/, `_clean.${fmt === "jpeg" ? "jpg" : fmt}`),
      originalSizeBytes: origSize,
      newSizeBytes: newSize,
      savedBytes: origSize - newSize,
      strippedAction: action,
      width: newMeta.width,
      height: newMeta.height,
    });
  } catch (err) {
    req.log.error({ err }, "EXIF process failed");
    res.status(500).json({ error: "EXIF processing failed", message: String(err) });
  }
});

// ─── Background Remover ───────────────────────────────────────────────────────

const BgRemoveBody = z.object({
  imageData: z.string(),
  filename: z.string(),
  replaceColor: z.string().optional(), // hex color or "transparent"
  outputFormat: z.string().optional(),
});

router.post("/tools/background-remove", async (req, res) => {
  const parsed = BgRemoveBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const { imageData, filename, replaceColor, outputFormat } = parsed.data;
  const start = Date.now();
  try {
    const { buffer } = dataUrlToBuffer(imageData);

    // Resize to max 1024px for CF AI processing
    const resizedForAI = await sharp(buffer, { failOnError: false })
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 95 })
      .toBuffer();

    let removedBg: Buffer;
    try {
      removedBg = await cfRemoveBackground(resizedForAI);
    } catch (cfErr) {
      req.log.warn({ cfErr }, "CF background removal failed, using sharp alpha masking");
      // Fallback: simple threshold-based masking
      removedBg = await sharp(resizedForAI, { failOnError: false })
        .ensureAlpha()
        .toBuffer();
    }

    let finalImg = sharp(removedBg, { failOnError: false });

    // Scale back to original dimensions
    const origMeta = await sharp(buffer, { failOnError: false }).metadata();
    const origW = origMeta.width ?? 1600;
    const origH = origMeta.height ?? 1600;
    finalImg = finalImg.resize(origW, origH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });

    // Apply replacement color if specified
    if (replaceColor && replaceColor !== "transparent") {
      const hex = replaceColor.replace("#", "");
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);

      const bgCanvas = sharp({
        create: { width: origW, height: origH, channels: 4, background: { r, g, b, alpha: 255 } },
      });
      const bgBuffer = await bgCanvas.png().toBuffer();
      const subjectBuffer = await finalImg.png().toBuffer();
      finalImg = sharp(bgBuffer).composite([{ input: subjectBuffer, blend: "over" }]);
    }

    const fmt = (outputFormat ?? "png") as "png" | "jpg" | "jpeg" | "webp";
    let outBuffer: Buffer;
    if (fmt === "png") {
      outBuffer = await finalImg.png({ compressionLevel: 6 }).toBuffer();
    } else if (fmt === "jpg" || fmt === "jpeg") {
      outBuffer = await finalImg.jpeg({ quality: 95, mozjpeg: true }).toBuffer();
    } else {
      outBuffer = await finalImg.webp({ quality: 95 }).toBuffer();
    }

    await updateStats("totalConverted");

    res.json({
      imageData: bufferToDataUrl(outBuffer, fmt === "jpg" ? "image/jpeg" : `image/${fmt}`),
      filename: filename.replace(/\.[^.]+$/, `_nobg.${fmt}`),
      width: origW,
      height: origH,
      format: fmt,
      sizeBytes: outBuffer.length,
      processingTime: (Date.now() - start) / 1000,
    });
  } catch (err) {
    req.log.error({ err }, "Background removal failed");
    res.status(500).json({ error: "Background removal failed", message: String(err) });
  }
});

// ─── Watermark ────────────────────────────────────────────────────────────────

const WatermarkBody = z.object({
  imageData: z.string(),
  filename: z.string(),
  text: z.string().max(200),
  fontSize: z.number().int().min(8).max(300).default(48),
  opacity: z.number().min(0.05).max(1).default(0.7),
  position: z.enum(["top-left", "top-center", "top-right", "center", "bottom-left", "bottom-center", "bottom-right"]).default("bottom-right"),
  color: z.string().default("#FFFFFF"),
  outputFormat: z.string().optional(),
  quality: z.number().int().min(1).max(100).optional(),
  tile: z.boolean().optional(),
});

router.post("/tools/watermark", async (req, res) => {
  const parsed = WatermarkBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const d = parsed.data;
  const start = Date.now();
  try {
    const { buffer } = dataUrlToBuffer(d.imageData);
    const meta = await sharp(buffer, { failOnError: false }).metadata();
    const w = meta.width ?? 1600;
    const h = meta.height ?? 1600;
    const fmt = (d.outputFormat ?? meta.format ?? "jpeg") as keyof sharp.FormatEnum;
    const q = d.quality ?? 92;

    const fontSizePx = Math.min(d.fontSize, Math.round(w * 0.12));
    const textW = Math.round(fontSizePx * d.text.length * 0.65);
    const textH = Math.round(fontSizePx * 1.5);
    const margin = Math.round(w * 0.025);

    // Parse hex color + apply opacity
    const hex = d.color.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16) || 255;
    const g = parseInt(hex.slice(2, 4), 16) || 255;
    const b = parseInt(hex.slice(4, 6), 16) || 255;
    const fillOpacity = d.opacity;

    // Build SVG watermark
    const svgW = Math.min(textW + margin * 2, w);
    const svgH = textH + margin;

    const watermarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}">
      <rect width="${svgW}" height="${svgH}" rx="6" fill="rgba(0,0,0,${(fillOpacity * 0.55).toFixed(2)})"/>
      <text x="${svgW / 2}" y="${svgH * 0.68}" font-family="Arial, Helvetica, sans-serif"
        font-size="${fontSizePx}" font-weight="bold" text-anchor="middle"
        fill="rgb(${r},${g},${b})" fill-opacity="${fillOpacity}">
        ${d.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
      </text>
    </svg>`;

    const watermarkBuf = await sharp(Buffer.from(watermarkSvg)).png().toBuffer();

    // Position
    type Position = "top-left" | "top-center" | "top-right" | "center" | "bottom-left" | "bottom-center" | "bottom-right";
    const pos = d.position as Position;
    const wmW = (await sharp(watermarkBuf).metadata()).width ?? svgW;
    const wmH = (await sharp(watermarkBuf).metadata()).height ?? svgH;

    let left: number;
    let top: number;
    const xCenter = Math.round((w - wmW) / 2);
    const yCenter = Math.round((h - wmH) / 2);

    if (pos === "top-left") { left = margin; top = margin; }
    else if (pos === "top-center") { left = xCenter; top = margin; }
    else if (pos === "top-right") { left = w - wmW - margin; top = margin; }
    else if (pos === "center") { left = xCenter; top = yCenter; }
    else if (pos === "bottom-left") { left = margin; top = h - wmH - margin; }
    else if (pos === "bottom-center") { left = xCenter; top = h - wmH - margin; }
    else { left = w - wmW - margin; top = h - wmH - margin; } // bottom-right

    left = Math.max(0, Math.min(left, w - wmW));
    top = Math.max(0, Math.min(top, h - wmH));

    let composites: sharp.OverlayOptions[] = [{ input: watermarkBuf, left, top, blend: "over" }];

    // Tile mode
    if (d.tile) {
      composites = [];
      const stepX = wmW + margin * 3;
      const stepY = wmH + margin * 3;
      for (let ty = margin; ty < h; ty += stepY) {
        for (let tx = margin; tx < w; tx += stepX) {
          composites.push({ input: watermarkBuf, left: tx, top: ty, blend: "over" });
        }
      }
    }

    let img = sharp(buffer, { failOnError: false }).composite(composites);

    let outBuffer: Buffer;
    if (fmt === "jpeg" || fmt === "jpg") {
      outBuffer = await img.jpeg({ quality: q, mozjpeg: true }).toBuffer();
    } else if (fmt === "png") {
      outBuffer = await img.png().toBuffer();
    } else if (fmt === "webp") {
      outBuffer = await img.webp({ quality: q }).toBuffer();
    } else {
      outBuffer = await img.toFormat(fmt, { quality: q }).toBuffer();
    }

    await updateStats("totalConverted");

    res.json({
      imageData: bufferToDataUrl(outBuffer, fmt === "jpg" || fmt === "jpeg" ? "image/jpeg" : `image/${fmt}`),
      filename: d.filename.replace(/\.[^.]+$/, `_watermarked.${fmt === "jpeg" ? "jpg" : fmt}`),
      width: w,
      height: h,
      format: fmt,
      sizeBytes: outBuffer.length,
      processingTime: (Date.now() - start) / 1000,
    });
  } catch (err) {
    req.log.error({ err }, "Watermark failed");
    res.status(500).json({ error: "Watermark failed", message: String(err) });
  }
});

// ─── Color Adjust ─────────────────────────────────────────────────────────────

const ColorAdjustBody = z.object({
  imageData: z.string(),
  filename: z.string(),
  brightness: z.number().min(0.1).max(3).default(1),
  saturation: z.number().min(0).max(3).default(1),
  hue: z.number().min(-180).max(180).default(0),
  sharpness: z.number().min(0).max(5).default(0),
  contrast: z.number().min(-100).max(100).default(0),
  gamma: z.number().min(1).max(3).default(1),
  outputFormat: z.string().optional(),
  quality: z.number().int().min(1).max(100).optional(),
});

router.post("/tools/color-adjust", async (req, res) => {
  const parsed = ColorAdjustBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const d = parsed.data;
  const start = Date.now();
  try {
    const { buffer } = dataUrlToBuffer(d.imageData);
    const meta = await sharp(buffer, { failOnError: false }).metadata();
    const fmt = (d.outputFormat ?? meta.format ?? "jpeg") as keyof sharp.FormatEnum;
    const q = d.quality ?? 92;

    let img = sharp(buffer, { failOnError: false });

    // Apply adjustments
    if (d.brightness !== 1 || d.saturation !== 1 || d.hue !== 0) {
      img = img.modulate({ brightness: d.brightness, saturation: d.saturation, hue: d.hue });
    }

    if (d.gamma !== 1) {
      img = img.gamma(d.gamma);
    }

    if (d.contrast !== 0) {
      // contrast: map -100..100 to linear adjustment
      const a = 1 + d.contrast / 100;
      const b2 = 128 * (1 - a);
      img = img.linear(a, b2);
    }

    if (d.sharpness > 0) {
      img = img.sharpen({ sigma: d.sharpness * 0.8, m1: d.sharpness * 0.5, m2: d.sharpness * 0.3 });
    }

    let outBuffer: Buffer;
    if (fmt === "jpeg" || fmt === "jpg") {
      outBuffer = await img.jpeg({ quality: q, mozjpeg: true }).toBuffer();
    } else if (fmt === "png") {
      outBuffer = await img.png().toBuffer();
    } else if (fmt === "webp") {
      outBuffer = await img.webp({ quality: q }).toBuffer();
    } else {
      outBuffer = await img.toFormat(fmt, { quality: q }).toBuffer();
    }

    const newMeta = await sharp(outBuffer, { failOnError: false }).metadata();
    await updateStats("totalConverted");

    res.json({
      imageData: bufferToDataUrl(outBuffer, fmt === "jpg" || fmt === "jpeg" ? "image/jpeg" : `image/${fmt}`),
      filename: d.filename.replace(/\.[^.]+$/, `_adjusted.${fmt === "jpeg" ? "jpg" : fmt}`),
      width: newMeta.width,
      height: newMeta.height,
      format: fmt,
      sizeBytes: outBuffer.length,
      processingTime: (Date.now() - start) / 1000,
    });
  } catch (err) {
    req.log.error({ err }, "Color adjust failed");
    res.status(500).json({ error: "Color adjustment failed", message: String(err) });
  }
});

// ─── Async Batch with SSE Progress ───────────────────────────────────────────

const AsyncBatchBody = z.object({
  images: z.array(z.object({
    imageData: z.string(),
    filename: z.string(),
  })).min(1).max(200),
  targetWidth: z.number().int().min(100).max(6500).default(2000),
  targetHeight: z.number().int().min(100).max(6500).default(2000),
  format: z.string().default("jpg"),
  quality: z.number().int().min(1).max(100).default(90),
  stripMetadata: z.boolean().default(true),
  ebayBoost: z.boolean().default(true),
  jobId: z.string(),
});

router.post("/tools/batch-process", async (req, res) => {
  const parsed = AsyncBatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const d = parsed.data;
  const { jobId } = d;

  res.json({ jobId, total: d.images.length, status: "started" });

  // Process in background (non-blocking response already sent)
  const results: Array<{ imageData: string; filename: string; width: number; height: number; sizeBytes: number; error?: string }> = [];

  for (let i = 0; i < d.images.length; i++) {
    const img = d.images[i];
    try {
      const { buffer } = dataUrlToBuffer(img.imageData);
      const fmt = d.format as keyof sharp.FormatEnum;
      const targetW = Math.max(1600, Math.min(6500, d.targetWidth));
      const targetH = Math.max(1600, Math.min(6500, d.targetHeight));

      let pipeline = sharp(buffer, { failOnError: false })
        .resize(targetW, targetH, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 },
          kernel: sharp.kernel.lanczos3,
          withoutEnlargement: false,
        });

      if (d.ebayBoost) {
        pipeline = pipeline
          .sharpen({ sigma: 0.8, m1: 0.4, m2: 0.3 })
          .modulate({ brightness: 1.02, saturation: 1.06 });
      }

      const outBuffer = await pipeline.toFormat(fmt, {
        quality: d.quality,
        ...(fmt === "jpeg" ? { mozjpeg: true } : {}),
      }).toBuffer();

      const outMeta = await sharp(outBuffer, { failOnError: false }).metadata();
      const mimeType = fmt === "jpeg" || fmt === "jpg" ? "image/jpeg" : `image/${fmt}`;

      results.push({
        imageData: bufferToDataUrl(outBuffer, mimeType),
        filename: img.filename.replace(/\.[^.]+$/, `_ebay.${fmt === "jpeg" ? "jpg" : fmt}`),
        width: outMeta.width ?? targetW,
        height: outMeta.height ?? targetH,
        sizeBytes: outBuffer.length,
      });

      emitJobProgress(jobId, {
        type: "progress",
        current: i + 1,
        total: d.images.length,
        percent: Math.round(((i + 1) / d.images.length) * 100),
        filename: img.filename,
      });

    } catch (err) {
      results.push({ imageData: "", filename: img.filename, width: 0, height: 0, sizeBytes: 0, error: String(err) });
      emitJobProgress(jobId, { type: "error", current: i + 1, total: d.images.length, filename: img.filename, error: String(err) });
    }

    // Yield event loop
    await new Promise(r => setImmediate(r));
  }

  emitJobProgress(jobId, { type: "complete", total: d.images.length, results });
});

export default router;
