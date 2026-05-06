import { Router } from "express";
import multer from "multer";
import sharp from "sharp";

const router = Router();

// Multer: memory storage, 20MB limit per file, 20 files max
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images allowed"));
  },
});

// Upscale image(s)
router.post("/images/upscale", upload.array("images", 20), async (req, res) => {
  const files = req.files as Express.Multer.File[];
  const { scale = "2", quality = "90", format = "jpeg" } = req.body as { scale?: string; quality?: string; format?: string };

  if (!files?.length) { res.status(400).json({ error: "No images uploaded" }); return; }

  const scaleNum = Math.min(4, Math.max(1, parseFloat(scale)));
  const qualityNum = Math.min(100, Math.max(10, parseInt(quality)));

  try {
    const results = await Promise.all(
      files.map(async (file) => {
        const img = sharp(file.buffer);
        const meta = await img.metadata();
        const w = Math.round((meta.width ?? 800) * scaleNum);
        const h = Math.round((meta.height ?? 800) * scaleNum);

        let processed = img.resize(w, h, { kernel: sharp.kernel.lanczos3, fit: "fill" });

        // Apply sharpening after upscale for crisp result
        processed = processed.sharpen(1.2, 1, 0.5);

        let buffer: Buffer;
        const outputFormat = format === "png" ? "png" : "jpeg";
        if (outputFormat === "png") {
          buffer = await processed.png({ quality: qualityNum }).toBuffer();
        } else {
          buffer = await processed.jpeg({ quality: qualityNum, chromaSubsampling: "4:4:4" }).toBuffer();
        }

        return {
          name: file.originalname,
          originalSize: { w: meta.width, h: meta.height },
          newSize: { w, h },
          data: buffer.toString("base64"),
          format: outputFormat,
          mimeType: `image/${outputFormat}`,
        };
      })
    );

    res.json({ results, scale: scaleNum, processed: results.length });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Remove/replace background
router.post("/images/background", upload.single("image"), async (req, res) => {
  const file = req.file;
  const { bgColor = "#ffffff", mode = "white" } = req.body as { bgColor?: string; mode?: string };

  if (!file) { res.status(400).json({ error: "Image required" }); return; }

  try {
    const img = sharp(file.buffer);
    const meta = await img.metadata();
    const w = meta.width ?? 800;
    const h = meta.height ?? 800;

    // Parse background color
    const r = parseInt(bgColor.slice(1, 3), 16);
    const g = parseInt(bgColor.slice(3, 5), 16);
    const b = parseInt(bgColor.slice(5, 7), 16);

    // Create background layer and composite
    const bg = sharp({
      create: { width: w, height: h, channels: 3, background: { r, g, b } }
    }).jpeg();

    const bgBuffer = await bg.toBuffer();

    // Composite: place original on background
    const result = await sharp(bgBuffer)
      .composite([{ input: file.buffer, blend: "over" }])
      .jpeg({ quality: 95 })
      .toBuffer();

    res.json({
      data: result.toString("base64"),
      mimeType: "image/jpeg",
      size: { w, h },
      bgColor,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Add watermark text
router.post("/images/watermark", upload.single("image"), async (req, res) => {
  const file = req.file;
  const { text = "© My eBay Store", opacity = "40", position = "center" } = req.body as {
    text?: string;
    opacity?: string;
    position?: string;
  };

  if (!file) { res.status(400).json({ error: "Image required" }); return; }

  try {
    const img = sharp(file.buffer);
    const meta = await img.metadata();
    const w = meta.width ?? 800;
    const h = meta.height ?? 800;
    const opacityNum = Math.min(255, Math.max(0, Math.round((parseInt(opacity) / 100) * 255)));

    const fontSize = Math.max(16, Math.round(w * 0.04));
    const svgText = `<svg width="${w}" height="${h}">
      <style>text { font-family: Arial, sans-serif; font-size: ${fontSize}px; font-weight: bold; fill: white; fill-opacity: ${(opacityNum / 255).toFixed(2)}; }</style>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" transform="rotate(-30, ${w / 2}, ${h / 2})">${text.replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] ?? c))}</text>
    </svg>`;

    const result = await sharp(file.buffer)
      .composite([{ input: Buffer.from(svgText), blend: "over" }])
      .jpeg({ quality: 92 })
      .toBuffer();

    res.json({ data: result.toString("base64"), mimeType: "image/jpeg" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Resize/optimize for eBay (800x800, 1600x1600, etc.)
router.post("/images/optimize", upload.array("images", 20), async (req, res) => {
  const files = req.files as Express.Multer.File[];
  const { size = "1600", format = "jpeg", quality = "92" } = req.body as { size?: string; format?: string; quality?: string };

  if (!files?.length) { res.status(400).json({ error: "No images" }); return; }

  const sizeNum = Math.min(2000, Math.max(400, parseInt(size)));
  const qualityNum = parseInt(quality);

  try {
    const results = await Promise.all(
      files.map(async (file) => {
        const img = sharp(file.buffer)
          .resize(sizeNum, sizeNum, { fit: "contain", background: { r: 255, g: 255, b: 255 } });

        const buffer = format === "png"
          ? await img.png().toBuffer()
          : await img.jpeg({ quality: qualityNum }).toBuffer();

        return {
          name: file.originalname,
          data: buffer.toString("base64"),
          mimeType: `image/${format}`,
          size: sizeNum,
        };
      })
    );
    res.json({ results, processed: results.length });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Create eBay store banner
router.post("/images/banner", upload.single("logo"), async (req, res) => {
  const { storeName = "My eBay Store", tagline = "Quality Products, Fast Shipping", width = "1200", height = "200", colorScheme = "blue" } = req.body as {
    storeName?: string;
    tagline?: string;
    width?: string;
    height?: string;
    colorScheme?: string;
  };

  const w = parseInt(width);
  const h = parseInt(height);

  const schemes: Record<string, { bg: string; accent: string; text: string }> = {
    blue:   { bg: "#0f172a", accent: "#3b82f6", text: "#ffffff" },
    green:  { bg: "#0f2018", accent: "#22c55e", text: "#ffffff" },
    purple: { bg: "#150f2a", accent: "#a855f7", text: "#ffffff" },
    red:    { bg: "#2a0f0f", accent: "#ef4444", text: "#ffffff" },
    gold:   { bg: "#1a1200", accent: "#f59e0b", text: "#ffffff" },
  };
  const scheme = schemes[colorScheme] ?? schemes.blue;

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${scheme.bg}"/>
        <stop offset="100%" style="stop-color:${scheme.accent}33"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect x="0" y="${h - 4}" width="${w}" height="4" fill="${scheme.accent}"/>
    <text x="${w / 2}" y="${h * 0.42}" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.28)}px" font-weight="bold" fill="${scheme.text}" text-anchor="middle" dominant-baseline="middle">${storeName.replace(/[<>&]/g, "")}</text>
    <text x="${w / 2}" y="${h * 0.72}" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.14)}px" fill="${scheme.accent}" text-anchor="middle" dominant-baseline="middle">${tagline.replace(/[<>&]/g, "")}</text>
  </svg>`;

  try {
    const buffer = await sharp(Buffer.from(svg))
      .resize(w, h)
      .jpeg({ quality: 95 })
      .toBuffer();

    res.json({ data: buffer.toString("base64"), mimeType: "image/jpeg", width: w, height: h });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Strip EXIF metadata
router.post("/images/strip-metadata", upload.array("images", 20), async (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files?.length) { res.status(400).json({ error: "No images" }); return; }

  try {
    const results = await Promise.all(
      files.map(async (file) => {
        const buffer = await sharp(file.buffer)
          .withMetadata({}) // Remove all EXIF
          .jpeg({ quality: 95 })
          .toBuffer();
        return { name: file.originalname, data: buffer.toString("base64"), mimeType: "image/jpeg" };
      })
    );
    res.json({ results, processed: results.length });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
