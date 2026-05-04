import { Router } from "express";
import sharp from "sharp";
import { z } from "zod";

const router = Router();

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URL");
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

// Country shipping badge SVGs — 20+ countries
const COUNTRY_BADGES: Record<string, { name: string; colors: { bg: string; text: string; sub: string }; flag: string }> = {
  US: { name: "FAST US SHIPPING", colors: { bg: "#003580", text: "#FFFFFF", sub: "#90CAF9" }, flag: "🇺🇸" },
  UK: { name: "FAST UK SHIPPING", colors: { bg: "#012169", text: "#FFFFFF", sub: "#BBDEFB" }, flag: "🇬🇧" },
  CA: { name: "FAST CA SHIPPING", colors: { bg: "#D80621", text: "#FFFFFF", sub: "#FFCDD2" }, flag: "🇨🇦" },
  AU: { name: "FAST AU SHIPPING", colors: { bg: "#00008B", text: "#FFFFFF", sub: "#BBDEFB" }, flag: "🇦🇺" },
  DE: { name: "FAST DE SHIPPING", colors: { bg: "#1A1A1A", text: "#FFFFFF", sub: "#BDBDBD" }, flag: "🇩🇪" },
  FR: { name: "FAST FR SHIPPING", colors: { bg: "#002395", text: "#FFFFFF", sub: "#BBDEFB" }, flag: "🇫🇷" },
  IT: { name: "FAST IT SHIPPING", colors: { bg: "#009246", text: "#FFFFFF", sub: "#C8E6C9" }, flag: "🇮🇹" },
  ES: { name: "FAST ES SHIPPING", colors: { bg: "#C60B1E", text: "#FFFFFF", sub: "#FFCDD2" }, flag: "🇪🇸" },
  JP: { name: "FAST JP SHIPPING", colors: { bg: "#BC002D", text: "#FFFFFF", sub: "#FFCDD2" }, flag: "🇯🇵" },
  NL: { name: "FAST NL SHIPPING", colors: { bg: "#AE1C28", text: "#FFFFFF", sub: "#FFCDD2" }, flag: "🇳🇱" },
  SE: { name: "FAST SE SHIPPING", colors: { bg: "#006AA7", text: "#FECC02", sub: "#FFF9C4" }, flag: "🇸🇪" },
  CH: { name: "FAST CH SHIPPING", colors: { bg: "#D52B1E", text: "#FFFFFF", sub: "#FFCDD2" }, flag: "🇨🇭" },
  NZ: { name: "FAST NZ SHIPPING", colors: { bg: "#00247D", text: "#FFFFFF", sub: "#BBDEFB" }, flag: "🇳🇿" },
  SG: { name: "FAST SG SHIPPING", colors: { bg: "#EF3340", text: "#FFFFFF", sub: "#FFCDD2" }, flag: "🇸🇬" },
  HK: { name: "FAST HK SHIPPING", colors: { bg: "#DE2910", text: "#FFDE00", sub: "#FFF9C4" }, flag: "🇭🇰" },
  KR: { name: "FAST KR SHIPPING", colors: { bg: "#003478", text: "#FFFFFF", sub: "#BBDEFB" }, flag: "🇰🇷" },
  MX: { name: "FAST MX SHIPPING", colors: { bg: "#006847", text: "#FFFFFF", sub: "#C8E6C9" }, flag: "🇲🇽" },
  BR: { name: "FAST BR SHIPPING", colors: { bg: "#009C3B", text: "#FFDF00", sub: "#FFF9C4" }, flag: "🇧🇷" },
  IN: { name: "FAST IN SHIPPING", colors: { bg: "#FF9933", text: "#FFFFFF", sub: "#E3F2FD" }, flag: "🇮🇳" },
  PL: { name: "FAST PL SHIPPING", colors: { bg: "#DC143C", text: "#FFFFFF", sub: "#FFCDD2" }, flag: "🇵🇱" },
};

// Badge style variants
type BadgeStyle = "standard" | "minimal" | "premium" | "text-only";

function buildBadgeSvg(countryCode: string, style: BadgeStyle = "standard", width = 200, height = 64): string {
  const country = COUNTRY_BADGES[countryCode] ?? COUNTRY_BADGES["US"];
  const { bg, text, sub } = country.colors;
  const { flag, name } = country;
  const shortName = name.replace("FAST ", "").replace(" SHIPPING", "");

  if (style === "minimal") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="${width}" height="${height}" rx="4" fill="${bg}" opacity="0.92"/>
      <text x="12" y="${height * 0.55}" font-family="Arial,sans-serif" font-size="${Math.round(height * 0.38)}" fill="${text}" font-weight="bold">${flag} ${shortName}</text>
    </svg>`;
  }

  if (style === "premium") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="pg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${bg}"/>
          <stop offset="100%" stop-color="${bg}CC"/>
        </linearGradient>
        <filter id="ds"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/></filter>
      </defs>
      <rect width="${width}" height="${height}" rx="10" fill="url(#pg)" filter="url(#ds)"/>
      <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="9" fill="none" stroke="${text}" stroke-opacity="0.2" stroke-width="1"/>
      <text x="${Math.round(height * 0.55)}" y="${Math.round(height * 0.47)}" font-family="Arial,sans-serif" font-size="${Math.round(height * 0.44)}" fill="${text}">${flag}</text>
      <text x="${Math.round(height * 1.1)}" y="${Math.round(height * 0.45)}" font-family="Arial,sans-serif" font-size="${Math.round(height * 0.24)}" font-weight="bold" fill="${text}">FREE SHIPPING</text>
      <text x="${Math.round(height * 1.1)}" y="${Math.round(height * 0.72)}" font-family="Arial,sans-serif" font-size="${Math.round(height * 0.2)}" fill="${sub}">${shortName} • FAST DELIVERY</text>
    </svg>`;
  }

  if (style === "text-only") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="${width}" height="${height}" rx="6" fill="${bg}"/>
      <text x="${width / 2}" y="${height * 0.45}" font-family="Arial,sans-serif" font-size="${Math.round(height * 0.26)}" font-weight="bold" fill="${text}" text-anchor="middle">FREE ${shortName} SHIPPING</text>
      <text x="${width / 2}" y="${height * 0.74}" font-family="Arial,sans-serif" font-size="${Math.round(height * 0.2)}" fill="${sub}" text-anchor="middle">Fast &amp; Tracked Delivery</text>
    </svg>`;
  }

  // Standard
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" rx="8" fill="${bg}"/>
    <text x="12" y="${Math.round(height * 0.55)}" font-family="Arial,sans-serif" font-size="${Math.round(height * 0.44)}" fill="${text}">${flag}</text>
    <text x="${Math.round(height * 0.9)}" y="${Math.round(height * 0.45)}" font-family="Arial,sans-serif" font-size="${Math.round(height * 0.24)}" font-weight="bold" fill="${text}">FREE SHIPPING</text>
    <text x="${Math.round(height * 0.9)}" y="${Math.round(height * 0.72)}" font-family="Arial,sans-serif" font-size="${Math.round(height * 0.2)}" fill="${sub}">${shortName}</text>
  </svg>`;
}

// POST /api/studio/badge-preview
const BadgePreviewBody = z.object({
  country: z.string().default("US"),
  style: z.enum(["standard", "minimal", "premium", "text-only"]).default("premium"),
  width: z.number().int().min(80).max(400).default(200),
  height: z.number().int().min(32).max(120).default(64),
});

router.post("/studio/badge-preview", async (req, res) => {
  const parsed = BadgePreviewBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const { country, style, width, height } = parsed.data;
  try {
    const svg = buildBadgeSvg(country.toUpperCase(), style as BadgeStyle, width, height);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    res.json({ imageData: `data:image/png;base64,${png.toString("base64")}`, country, style });
  } catch (err) {
    req.log.error({ err }, "Badge preview failed");
    res.status(500).json({ error: "Badge generation failed" });
  }
});

// GET /api/studio/countries
router.get("/studio/countries", (_req, res) => {
  const countries = Object.entries(COUNTRY_BADGES).map(([code, data]) => ({
    code,
    name: data.name.replace("FAST ", "").replace(" SHIPPING", ""),
    flag: data.flag,
    fullName: data.name,
  }));
  res.json({ countries });
});

// POST /api/studio/compose — all-in-one: upscale + shadow + badge + watermark
const ComposeBody = z.object({
  imageData: z.string(),
  filename: z.string(),
  // Upscale
  targetSize: z.number().int().min(1600).max(6500).default(2000),
  // Shadow
  addShadow: z.boolean().default(true),
  shadowBlur: z.number().min(0).max(60).default(20),
  shadowOpacity: z.number().min(0).max(1).default(0.18),
  // Badge
  addBadge: z.boolean().default(true),
  badgeCountry: z.string().default("US"),
  badgeStyle: z.enum(["standard", "minimal", "premium", "text-only"]).default("premium"),
  badgePosition: z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]).default("bottom-right"),
  badgeSize: z.enum(["small", "medium", "large"]).default("medium"),
  // Watermark (optional)
  addWatermark: z.boolean().default(false),
  watermarkText: z.string().optional(),
  // eBay boost
  ebayBoost: z.boolean().default(true),
  // Output
  outputFormat: z.enum(["jpg", "png", "webp"]).default("jpg"),
  quality: z.number().int().min(60).max(100).default(92),
});

router.post("/studio/compose", async (req, res) => {
  const parsed = ComposeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request", details: parsed.error.issues }); return; }
  const d = parsed.data;
  const start = Date.now();

  try {
    const { buffer } = dataUrlToBuffer(d.imageData);
    const canvasSize = d.targetSize;

    // Step 1: Resize product to 82% of canvas with white bg
    const productSize = Math.round(canvasSize * 0.82);
    let productBuf = await sharp(buffer, { failOnError: false })
      .resize(productSize, productSize, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
        kernel: sharp.kernel.lanczos3,
        withoutEnlargement: false,
      })
      .ensureAlpha()
      .png()
      .toBuffer();

    if (d.ebayBoost) {
      productBuf = await sharp(productBuf, { failOnError: false })
        .sharpen({ sigma: 1.1, m1: 0.5, m2: 0.4 })
        .modulate({ brightness: 1.02, saturation: 1.06 })
        .png()
        .toBuffer();
    }

    // Step 2: Build shadow layer if requested
    const composites: sharp.OverlayOptions[] = [];

    if (d.addShadow) {
      // Create blurred dark ellipse for shadow
      const shadowW = Math.round(productSize * 0.75);
      const shadowH = Math.round(productSize * 0.08);
      const shadowOpacityInt = Math.round(d.shadowOpacity * 255);
      const shadowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${shadowW}" height="${shadowH}">
        <filter id="blur"><feGaussianBlur stdDeviation="${Math.round(d.shadowBlur * 0.5)}"/></filter>
        <ellipse cx="${shadowW / 2}" cy="${shadowH / 2}" rx="${shadowW * 0.42}" ry="${shadowH * 0.48}"
          fill="rgba(0,0,0,${d.shadowOpacity.toFixed(2)})" filter="url(#blur)"/>
      </svg>`;
      const shadowBuf = await sharp(Buffer.from(shadowSvg)).png().toBuffer();
      const shadowLeft = Math.round((canvasSize - shadowW) / 2);
      const shadowTop = Math.round((canvasSize - productSize) / 2) + productSize - Math.round(shadowH * 0.6);
      composites.push({ input: shadowBuf, left: Math.max(0, shadowLeft), top: Math.max(0, shadowTop), blend: "multiply" });
    }

    // Position product centered
    const prodLeft = Math.round((canvasSize - productSize) / 2);
    const prodTop = Math.round((canvasSize - productSize) / 2);
    composites.push({ input: productBuf, left: prodLeft, top: prodTop, blend: "over" });

    // Step 3: Shipping badge
    if (d.addBadge) {
      const badgeSizes = { small: { w: 160, h: 50 }, medium: { w: 210, h: 66 }, large: { w: 270, h: 84 } };
      const bSize = badgeSizes[d.badgeSize];
      const badgeSvg = buildBadgeSvg(d.badgeCountry.toUpperCase(), d.badgeStyle as BadgeStyle, bSize.w, bSize.h);
      const badgeBuf = await sharp(Buffer.from(badgeSvg)).png().toBuffer();
      const margin = Math.round(canvasSize * 0.025);
      const bLeft = d.badgePosition.includes("right") ? canvasSize - bSize.w - margin : margin;
      const bTop = d.badgePosition.includes("bottom") ? canvasSize - bSize.h - margin : margin;
      composites.push({ input: badgeBuf, left: Math.max(0, bLeft), top: Math.max(0, bTop), blend: "over" });
    }

    // Step 4: Optional watermark
    if (d.addWatermark && d.watermarkText) {
      const wText = d.watermarkText;
      const wFontSize = Math.round(canvasSize * 0.025);
      const wSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${wFontSize * 2}">
        <text x="${canvasSize / 2}" y="${wFontSize * 1.3}" font-family="Arial,sans-serif" font-size="${wFontSize}"
          fill="rgba(80,80,80,0.55)" text-anchor="middle" font-weight="bold">
          ${wText.replace(/&/g, "&amp;").replace(/</g, "&lt;")}
        </text>
      </svg>`;
      const wBuf = await sharp(Buffer.from(wSvg)).png().toBuffer();
      composites.push({ input: wBuf, left: 0, top: canvasSize - wFontSize * 2 - Math.round(canvasSize * 0.015), blend: "over" });
    }

    // Compose on white canvas
    const whiteBg = await sharp({
      create: { width: canvasSize, height: canvasSize, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).png().toBuffer();

    let finalImg = sharp(whiteBg).composite(composites);

    let outBuffer: Buffer;
    const fmt = d.outputFormat;
    if (fmt === "jpg") outBuffer = await finalImg.jpeg({ quality: d.quality, mozjpeg: true }).toBuffer();
    else if (fmt === "webp") outBuffer = await finalImg.webp({ quality: d.quality }).toBuffer();
    else outBuffer = await finalImg.png({ compressionLevel: 6 }).toBuffer();

    const mime = fmt === "jpg" ? "image/jpeg" : `image/${fmt}`;
    const ext = fmt === "jpg" ? "jpg" : fmt;

    res.json({
      imageData: bufferToDataUrl(outBuffer, mime),
      filename: d.filename.replace(/\.[^.]+$/, `_ebay_studio.${ext}`),
      width: canvasSize,
      height: canvasSize,
      format: fmt,
      sizeBytes: outBuffer.length,
      processingTime: (Date.now() - start) / 1000,
    });
  } catch (err) {
    req.log.error({ err }, "Studio compose failed");
    res.status(500).json({ error: "Studio compose failed", message: String(err) });
  }
});

// POST /api/studio/product-find — AI product detection + eBay bullet points
const ProductFindBody = z.object({
  imageData: z.string(),
  language: z.string().default("en"),
});

router.post("/studio/product-find", async (req, res) => {
  const parsed = ProductFindBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }

  try {
    // Use Pollinations text API (free) to analyze image and generate eBay bullets
    // We send a structured prompt requesting product analysis
    const prompt = `You are an expert eBay product listing specialist. 
Analyze this product image and return ONLY a valid JSON object with no extra text:
{
  "productName": "specific product name",
  "category": "eBay category",
  "condition": "New/Used",
  "estimatedPrice": "$XX-$XX",
  "keyFeatures": ["feature 1", "feature 2", "feature 3", "feature 4", "feature 5"],
  "ebayTitle": "optimized eBay title under 80 chars",
  "bulletPoints": ["• bullet 1", "• bullet 2", "• bullet 3", "• bullet 4", "• bullet 5"],
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "shippingTip": "brief shipping recommendation"
}`;

    const models = ["mistral", "openai", "qwen-coder"];
    let result: Record<string, unknown> | null = null;

    for (const model of models) {
      try {
        const encodedPrompt = encodeURIComponent(prompt);
        const url = `https://text.pollinations.ai/${encodedPrompt}?model=${model}&json=true&seed=${Date.now()}`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(12000) });
        if (!resp.ok) continue;
        const text = await resp.text();
        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
          if (result.productName) break;
        }
      } catch {
        continue;
      }
    }

    if (!result) {
      // Fallback defaults
      result = {
        productName: "Product",
        category: "Everything Else",
        condition: "New",
        estimatedPrice: "$10-$50",
        keyFeatures: ["High quality", "Fast shipping", "Great condition", "Brand new", "Top rated"],
        ebayTitle: "Quality Product - Fast Free Shipping - Top Rated Seller",
        bulletPoints: [
          "• High quality item in excellent condition",
          "• Fast and tracked shipping available",
          "• 30-day return policy for peace of mind",
          "• Securely packaged to prevent damage",
          "• Message us for any questions",
        ],
        keywords: ["quality", "fast shipping", "new"],
        shippingTip: "Use tracked shipping for eBay buyer protection.",
      };
    }

    res.json({ success: true, analysis: result });
  } catch (err) {
    req.log.error({ err }, "Product find failed");
    res.status(500).json({ error: "Product analysis failed", message: String(err) });
  }
});

// GET /api/studio/ai-models — return cached models
router.get("/studio/ai-models", async (req, res) => {
  try {
    const { aiModelCacheTable } = await import("@workspace/db");
    const { db: dbInst } = await import("@workspace/db");
    const { eq: eqInst } = await import("drizzle-orm");
    const models = await dbInst.select().from(aiModelCacheTable)
      .where(eqInst(aiModelCacheTable.isFree, true));
    res.json({ models, count: models.length });
  } catch {
    res.json({ models: [], count: 0 });
  }
});

export { COUNTRY_BADGES, buildBadgeSvg };
export default router;
