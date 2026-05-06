import { Router } from "express";
import multer from "multer";
import JSZip from "jszip";
import sharp from "sharp";
import { callAI, callAIJSON } from "../ai/models.js";
import { buildListingPrompt, SYSTEM_PROMPTS, type ProductData } from "../ai/prompts.js";
import { scrapeUrl } from "../scraper/index.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 5 },
});

// Process zip file of product images/folders
router.post("/bulk/zip", upload.single("file"), async (req, res) => {
  const file = req.file;
  const { marketplace = "eBay UK", groupBy = "folder" } = req.body as { marketplace?: string; groupBy?: string };

  if (!file) { res.status(400).json({ error: "ZIP file required" }); return; }

  try {
    const zip = await JSZip.loadAsync(file.buffer);
    
    // Group files by folder (each folder = one product)
    const products: Record<string, { images: string[]; textFiles: string[] }> = {};

    for (const [path, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;
      const parts = path.split("/");
      const folder = parts.length > 1 ? parts[0] : "Product 1";
      const filename = parts[parts.length - 1];

      if (!products[folder]) products[folder] = { images: [], textFiles: [] };

      const ext = filename.split(".").pop()?.toLowerCase() ?? "";
      if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
        const imgBuffer = await zipEntry.async("base64");
        products[folder].images.push(`data:image/${ext};base64,${imgBuffer}`);
      } else if (["txt", "csv", "json"].includes(ext)) {
        const text = await zipEntry.async("string");
        products[folder].textFiles.push(text.slice(0, 500));
      }
    }

    const productList = Object.entries(products);
    const listings: unknown[] = [];
    const errors: { folder: string; error: string }[] = [];

    // Process each product group
    for (const [folder, data] of productList.slice(0, 20)) { // Limit 20 products
      try {
        const context = data.textFiles.join("\n").slice(0, 300);
        const product: ProductData = {
          title: folder.replace(/[-_]/g, " "),
          description: context || undefined,
          keywords: folder.toLowerCase().split(/[-_\s]+/).filter(Boolean),
        };
        const prompt = buildListingPrompt(product, { marketplace });
        const listing = await callAIJSON(prompt, "bulk", SYSTEM_PROMPTS.listing);
        listings.push({ folder, images: data.images.slice(0, 6), listing });
      } catch (err) {
        errors.push({ folder, error: String(err) });
      }
    }

    res.json({
      total: productList.length,
      processed: listings.length,
      failed: errors.length,
      listings,
      errors,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Process multiple URLs at once
router.post("/bulk/urls", async (req, res) => {
  const { urls, marketplace = "eBay UK" } = req.body as { urls: string[]; marketplace?: string };

  if (!Array.isArray(urls) || !urls.length) {
    res.status(400).json({ error: "URLs array required" });
    return;
  }

  const results: unknown[] = [];
  const errors: { url: string; error: string }[] = [];

  await Promise.allSettled(
    urls.slice(0, 10).map(async (url) => {
      try {
        const scraped = await scrapeUrl(url);
        const product: ProductData = {
          title: scraped.title,
          description: scraped.description,
          brand: scraped.brand,
          price: scraped.price,
          specs: scraped.specs,
          sourceUrl: url,
        };
        const prompt = buildListingPrompt(product, { marketplace });
        const listing = await callAIJSON(prompt, "bulk", SYSTEM_PROMPTS.listing);
        results.push({ url, scraped, listing });
      } catch (err) {
        errors.push({ url, error: String(err) });
      }
    })
  );

  res.json({ total: urls.length, processed: results.length, failed: errors.length, results, errors });
});

// Process multiple images and identify products
router.post("/bulk/images", upload.array("images", 20), async (req, res) => {
  const files = req.files as Express.Multer.File[];
  const { marketplace = "eBay UK" } = req.body as { marketplace?: string };

  if (!files?.length) { res.status(400).json({ error: "Images required" }); return; }

  const results: unknown[] = [];
  const errors: { name: string; error: string }[] = [];

  for (const file of files) {
    try {
      // Resize for AI analysis
      const resized = await sharp(file.buffer)
        .resize(400, 400, { fit: "contain" })
        .jpeg({ quality: 80 })
        .toBuffer();

      const base64 = resized.toString("base64");
      
      // Use AI to identify and generate listing from image description
      const identifyPrompt = `An image of a product has been uploaded (${file.originalname}).
Based on the filename and context, identify what this product likely is and generate a complete eBay listing.
Filename: ${file.originalname}
Generate a full listing as JSON with: title, category, itemSpecifics, description, keywords, price (suggested), cassiniTips`;

      const listing = await callAIJSON(identifyPrompt, "listing", SYSTEM_PROMPTS.listing);
      results.push({
        filename: file.originalname,
        imageData: base64,
        listing,
      });
    } catch (err) {
      errors.push({ name: file.originalname, error: String(err) });
    }
  }

  res.json({ total: files.length, processed: results.length, failed: errors.length, results, errors });
});

// Keyword-only listing generation (batch)
router.post("/bulk/keywords", async (req, res) => {
  const { keywords, marketplace = "eBay UK" } = req.body as { keywords: string[]; marketplace?: string };

  if (!Array.isArray(keywords) || !keywords.length) {
    res.status(400).json({ error: "Keywords array required" });
    return;
  }

  const results: unknown[] = [];
  const errors: { keyword: string; error: string }[] = [];

  for (const kw of keywords.slice(0, 15)) {
    try {
      const product: ProductData = { title: kw, keywords: [kw] };
      const prompt = buildListingPrompt(product, { marketplace });
      const listing = await callAIJSON(prompt, "bulk", SYSTEM_PROMPTS.listing);
      results.push({ keyword: kw, listing });
    } catch (err) {
      errors.push({ keyword: kw, error: String(err) });
    }
  }

  res.json({ total: keywords.length, processed: results.length, failed: errors.length, results, errors });
});

export default router;
