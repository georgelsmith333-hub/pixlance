/**
 * eBay Pipeline Orchestrator
 * runEbayPipeline(input) → optimized listing + export package
 * Steps: import → normalize → optimize → rank images → generate export → (optional) upload
 */

import sharp from "sharp";
import { optimizeListing, aiEnhanceTitle, aiEnhanceDescription, detectCategory, type ProductInput } from "../ebay/optimizer.js";
import { generateDraftMode, publishViaEbayApi, createEbayDraft, draftToCsv, type EbayDraftPayload } from "../ebay/uploader.js";

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// ── Platform detection ────────────────────────────────────────────────────────
function detectPlatform(url: string): "aliexpress" | "ebay" | "amazon" | "generic" {
  if (url.includes("aliexpress.com")) return "aliexpress";
  if (url.includes("ebay.com") || url.includes("ebay.co.")) return "ebay";
  if (url.includes("amazon.com") || url.includes("amazon.co.")) return "amazon";
  return "generic";
}

// ── Product extraction from URL ────────────────────────────────────────────────
export async function extractProductFromUrl(url: string): Promise<ProductInput> {
  const platform = detectPlatform(url);
  const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Failed to fetch URL (HTTP ${res.status})`);
  const html = await res.text();

  return platform === "aliexpress" ? parseAliExpress(html, url)
    : platform === "ebay" ? parseEbay(html, url)
    : platform === "amazon" ? parseAmazon(html, url)
    : parseGeneric(html, url);
}

function parseAliExpress(html: string, _url: string): ProductInput {
  const title = (/<h1[^>]*>([^<]+)<\/h1>/i.exec(html)?.[1] ?? "").trim()
    || (/,"subject":"([^"]+)"/i.exec(html)?.[1] ?? "").trim();
  const price = (/,"minActivityAmount":\{"value":"([^"]+)"/i.exec(html)?.[1] ?? "").trim();
  const brand = (/,"storeName":"([^"]+)"/i.exec(html)?.[1] ?? "").trim();

  const specs: Record<string, string> = {};
  const specRe = /"attrName":"([^"]+)","attrValue":"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = specRe.exec(html)) !== null) specs[m[1]] = m[2];

  const images = extractImages(html);
  return { title, price: parseFloat(price) || undefined, brand, specs, images, platform: "aliexpress" };
}

function parseEbay(html: string, _url: string): ProductInput {
  const title = (/<h1[^>]*class="[^"]*x-item-title__mainTitle[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i.exec(html)?.[1] ?? "").trim()
    || (/<span[^>]*itemprop="name"[^>]*>([^<]+)<\/span>/i.exec(html)?.[1] ?? "").trim();
  const price = (/itemprop="price"[^>]+content="([^"]+)"/i.exec(html)?.[1] ?? "").trim();
  const brand = (/itemprop="brand"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i.exec(html)?.[1] ?? "").trim();
  const condition = (/<span[^>]*itemprop="itemCondition"[^>]*>([^<]+)<\/span>/i.exec(html)?.[1] ?? "New").trim();

  const specs: Record<string, string> = {};
  const specRe = /<dt[^>]*>([^<]+)<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/g;
  let m: RegExpExecArray | null;
  while ((m = specRe.exec(html)) !== null) {
    const k = m[1].trim(); const v = m[2].trim();
    if (k && v && k.length < 60) specs[k] = v;
  }

  const images = extractImages(html).filter(u => u.includes("ebayimg"));
  return { title, price: parseFloat(price) || undefined, brand, condition, specs, images, platform: "ebay" };
}

function parseAmazon(html: string, _url: string): ProductInput {
  const title = (/<span id="productTitle"[^>]*>([^<]+)<\/span>/i.exec(html)?.[1] ?? "").trim();
  const price = (/<span class="[^"]*a-price-whole[^"]*"[^>]*>([^<]+)<\/span>/i.exec(html)?.[1] ?? "").trim();
  const brand = (/<a id="bylineInfo"[^>]*>([^<]+)<\/a>/i.exec(html)?.[1] ?? "").replace("Visit the ", "").replace(" Store", "").trim();

  const specs: Record<string, string> = {};
  const techRe = /<td class="[^"]*label[^"]*"[^>]*>\s*([^<]+)\s*<\/td>\s*<td class="[^"]*value[^"]*"[^>]*>\s*([^<]+)\s*<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = techRe.exec(html)) !== null) {
    const k = m[1].trim(); const v = m[2].trim();
    if (k && v && k.length < 60) specs[k] = v;
  }

  const images = extractImages(html).filter(u => u.includes("media-amazon"));
  return { title, price: parseFloat(price.replace(/[^0-9.]/g, "")) || undefined, brand, specs, images, platform: "amazon" };
}

function parseGeneric(html: string, _url: string): ProductInput {
  const title = (/<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1] ?? "").trim()
    || (/<h1[^>]*>([^<]+)<\/h1>/i.exec(html)?.[1] ?? "").trim();
  const images = extractImages(html);
  return { title, images, platform: "generic" };
}

function extractImages(html: string): string[] {
  const imgs = new Set<string>();
  const patterns = [
    /<img[^>]+src=["']([^"']+)["']/gi,
    /<img[^>]+data-src=["']([^"']+)["']/gi,
    /data-zoom-image=["']([^"']+)["']/gi,
    /"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))[^"]*"/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const src = m[1];
      if (src && !src.startsWith("data:") && src.length < 500) imgs.add(src);
    }
  }
  return [...imgs].filter(u => /\.(jpe?g|png|webp|avif)/i.test(u));
}

// ── Normalize product data ────────────────────────────────────────────────────
export function normalizeProductData(raw: ProductInput): ProductInput {
  return {
    ...raw,
    title: (raw.title ?? "").replace(/\s+/g, " ").trim().slice(0, 500),
    brand: (raw.brand ?? "").trim().slice(0, 65),
    condition: raw.condition ?? "New",
    specs: Object.fromEntries(
      Object.entries(raw.specs ?? {})
        .filter(([k, v]) => k && v && String(v).length < 200)
        .map(([k, v]) => [k.trim(), String(v).trim()])
        .slice(0, 20)
    ),
    images: (raw.images ?? []).slice(0, 12),
  };
}

// ── Smart Image Ranking Engine ─────────────────────────────────────────────────
export interface RankedImage {
  url: string;
  score: number;           // 0-100
  reasons: string[];
  isMainCandidate: boolean;
  width?: number;
  height?: number;
  format?: string;
}

export async function rankImages(imageUrls: string[]): Promise<RankedImage[]> {
  const ranked: RankedImage[] = [];

  for (const url of imageUrls.slice(0, 10)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const img = sharp(buf, { failOnError: false });
      const meta = await img.metadata();
      const stats = await img.stats();

      let score = 0;
      const reasons: string[] = [];

      // Resolution score (eBay wants min 500px, ideal 1600+)
      const minDim = Math.min(meta.width ?? 0, meta.height ?? 0);
      if (minDim >= 1600) { score += 30; reasons.push("High resolution ≥1600px"); }
      else if (minDim >= 800) { score += 15; reasons.push("Good resolution ≥800px"); }
      else if (minDim >= 500) { score += 8; reasons.push("Minimum resolution"); }
      else { reasons.push("Low resolution — may be rejected by eBay"); }

      // Square ratio (eBay displays best)
      const ratio = (meta.width ?? 1) / (meta.height ?? 1);
      if (ratio >= 0.9 && ratio <= 1.1) { score += 15; reasons.push("Square ratio (eBay optimal)"); }
      else if (ratio >= 0.75 && ratio <= 1.33) { score += 8; reasons.push("Near-square ratio"); }

      // Brightness (not too dark, not blown out)
      const avgBrightness = stats.channels.reduce((s, c) => s + c.mean, 0) / stats.channels.length;
      if (avgBrightness >= 180 && avgBrightness <= 245) { score += 15; reasons.push("White/light background detected"); }
      else if (avgBrightness >= 120) { score += 8; reasons.push("Good brightness"); }
      else { reasons.push("Dark image — may reduce CTR"); }

      // Sharpness via entropy
      const entropy = stats.channels[0]?.entropy ?? 0;
      if (entropy >= 5) { score += 15; reasons.push("Sharp, detailed image"); }
      else if (entropy >= 3) { score += 8; reasons.push("Moderate sharpness"); }

      // Format preference
      if (meta.format === "jpeg" || meta.format === "jpg") { score += 10; reasons.push("JPEG format (eBay standard)"); }
      else if (meta.format === "png") { score += 8; reasons.push("PNG format"); }
      else if (meta.format === "webp") { score += 5; }

      // Whiteness check for main image
      const rMean = stats.channels[0]?.mean ?? 0;
      const gMean = stats.channels[1]?.mean ?? rMean;
      const bMean = stats.channels[2]?.mean ?? rMean;
      const isLikelyWhiteBg = rMean > 200 && gMean > 200 && bMean > 200;
      if (isLikelyWhiteBg) { score += 15; reasons.push("White background (eBay main image requirement)"); }

      ranked.push({
        url,
        score: Math.min(100, score),
        reasons,
        isMainCandidate: isLikelyWhiteBg && minDim >= 800,
        width: meta.width,
        height: meta.height,
        format: meta.format,
      });
    } catch {
      ranked.push({ url, score: 0, reasons: ["Could not analyze image"], isMainCandidate: false });
    }
  }

  return ranked.sort((a, b) => b.score - a.score);
}

// ── Competitor comparison via eBay search scrape ──────────────────────────────
export interface CompetitorData {
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  totalListings: number;
  topTitles: string[];
  recommendedPrice: number;
  competitionLevel: "low" | "medium" | "high";
}

export async function scrapeCompetitors(title: string): Promise<CompetitorData | null> {
  const searchQuery = title.split(" ").slice(0, 6).join("+");
  try {
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchQuery)}&_sop=12&LH_BIN=1&LH_ItemCondition=1000`;
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const html = await res.text();

    // Extract prices
    const priceRe = /data-testid="item-price"[^>]*>([^<]*\$[\d,.]+)/gi;
    const prices: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = priceRe.exec(html)) !== null) {
      const p = parseFloat(m[1].replace(/[^0-9.]/g, ""));
      if (p > 0 && p < 50000) prices.push(p);
    }

    // Extract titles
    const titleRe = /data-testid="item-title"[^>]*>([^<]+)</gi;
    const titles: string[] = [];
    while ((m = titleRe.exec(html)) !== null) {
      const t = m[1].trim();
      if (t.length > 10) titles.push(t);
    }

    // Listing count
    const countMatch = /([\d,]+)\s+results?\s+for/i.exec(html);
    const totalListings = countMatch ? parseInt(countMatch[1].replace(/,/g, "")) : prices.length;

    if (prices.length === 0) return null;

    prices.sort((a, b) => a - b);
    const avgPrice = prices.reduce((s, p) => s + p, 0) / prices.length;
    const minPrice = prices[0];
    const maxPrice = prices[prices.length - 1];
    const recommendedPrice = parseFloat((avgPrice * 0.97).toFixed(2));

    return {
      avgPrice: parseFloat(avgPrice.toFixed(2)),
      minPrice,
      maxPrice,
      totalListings,
      topTitles: titles.slice(0, 5),
      recommendedPrice,
      competitionLevel: totalListings > 1000 ? "high" : totalListings > 100 ? "medium" : "low",
    };
  } catch {
    return null;
  }
}

// ── Export ZIP builder ────────────────────────────────────────────────────────
export interface ExportPackage {
  pipelineId: string;
  listing: ReturnType<typeof optimizeListing>;
  draft: EbayDraftPayload;
  competitors: CompetitorData | null;
  rankedImages: RankedImage[];
  csvData: string;
  files: {
    "title.txt": string;
    "description.html": string;
    "item_specifics.json": string;
    "seo_keywords.json": string;
    "ebay_payload.json": string;
    "upload.csv": string;
    "competitors.json": string;
    "pipeline_report.json": string;
  };
}

// ── Master pipeline function ──────────────────────────────────────────────────
export interface PipelineInput {
  url?: string;
  title?: string;
  images?: string[];
  price?: number;
  specs?: Record<string, string>;
  brand?: string;
  condition?: string;
  platform?: "aliexpress" | "ebay" | "amazon" | "generic";
  useAiEnhance?: boolean;
  ebayAuthToken?: string;
}

export interface PipelineResult {
  pipelineId: string;
  status: "complete" | "partial" | "error";
  product: ProductInput;
  listing: ReturnType<typeof optimizeListing>;
  rankedImages: RankedImage[];
  competitors: CompetitorData | null;
  draft: EbayDraftPayload;
  csvData: string;
  exportFiles: ExportPackage["files"];
  uploadResult?: Awaited<ReturnType<typeof publishViaEbayApi>>;
  processingMs: number;
}

// In-memory job store
const jobStore = new Map<string, PipelineResult & { completedAt: Date }>();

export function getJob(id: string) {
  return jobStore.get(id);
}

export async function runEbayPipeline(input: PipelineInput): Promise<PipelineResult> {
  const t0 = Date.now();
  const pipelineId = `pipe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Step 1: Import
  let product: ProductInput;
  if (input.url) {
    try {
      product = await extractProductFromUrl(input.url);
    } catch {
      product = { title: input.title, images: input.images, price: input.price, specs: input.specs, brand: input.brand, condition: input.condition, platform: input.platform };
    }
  } else {
    product = { title: input.title, images: input.images, price: input.price, specs: input.specs, brand: input.brand, condition: input.condition, platform: input.platform };
  }

  // Merge manual overrides
  if (input.title && !product.title) product.title = input.title;
  if (input.brand) product.brand = input.brand;
  if (input.specs) product.specs = { ...product.specs, ...input.specs };

  // Step 2: Normalize
  product = normalizeProductData(product);

  // Step 3: Optimize (rule-based fast)
  let listing = optimizeListing(product);

  // Step 4: AI Enhancement (parallel)
  if (input.useAiEnhance !== false && product.title) {
    const [aiTitle, aiDesc] = await Promise.allSettled([
      aiEnhanceTitle(product.title, product.brand ?? "", product.specs ?? {}),
      aiEnhanceDescription(product),
    ]);

    if (aiTitle.status === "fulfilled" && aiTitle.value.length > 10) {
      listing = { ...listing, title: aiTitle.value };
    }
    if (aiDesc.status === "fulfilled" && aiDesc.value.length > 200) {
      listing = { ...listing, description: aiDesc.value };
    }
  }

  // Step 5: Rank images + scrape competitors (parallel)
  const [rankedImgs, competitors] = await Promise.allSettled([
    rankImages(product.images ?? []),
    scrapeCompetitors(listing.title),
  ]);

  const rankedImages = rankedImgs.status === "fulfilled" ? rankedImgs.value : [];
  const competitorData = competitors.status === "fulfilled" ? competitors.value : null;

  // Update price recommendation from competitor data
  if (competitorData) {
    listing = {
      ...listing,
      priceRecommendation: {
        min: competitorData.minPrice,
        max: competitorData.maxPrice,
        suggested: competitorData.recommendedPrice,
      },
    };
  }

  // Step 6: Create draft
  const topImages = rankedImages.slice(0, 4).map(r => r.url);
  const draft = createEbayDraft(listing, {
    price: competitorData?.recommendedPrice ?? (typeof input.price === "number" ? input.price : 9.99),
    imageUrls: topImages,
    useGTC: true,
  });

  const csvData = draftToCsv(draft);

  // Step 7: Build export files
  const exportFiles: ExportPackage["files"] = {
    "title.txt": listing.title,
    "description.html": listing.description,
    "item_specifics.json": JSON.stringify(listing.itemSpecifics, null, 2),
    "seo_keywords.json": JSON.stringify(listing.seoKeywords, null, 2),
    "ebay_payload.json": JSON.stringify(draft, null, 2),
    "upload.csv": csvData,
    "competitors.json": JSON.stringify(competitorData, null, 2),
    "pipeline_report.json": JSON.stringify({
      pipelineId,
      titleScore: listing.titleScore,
      ctxScore: listing.ctxScore,
      complianceWarnings: listing.complianceWarnings,
      topImageScore: rankedImages[0]?.score ?? 0,
      generatedAt: new Date().toISOString(),
    }, null, 2),
  };

  // Step 8: Optional eBay API upload
  let uploadResult: Awaited<ReturnType<typeof publishViaEbayApi>> | undefined;
  if (input.ebayAuthToken) {
    uploadResult = await publishViaEbayApi(draft, input.ebayAuthToken);
  }

  const result: PipelineResult = {
    pipelineId,
    status: "complete",
    product,
    listing,
    rankedImages,
    competitors: competitorData,
    draft,
    csvData,
    exportFiles,
    uploadResult,
    processingMs: Date.now() - t0,
  };

  jobStore.set(pipelineId, { ...result, completedAt: new Date() });
  // Clean up old jobs (keep last 50)
  if (jobStore.size > 50) {
    const oldest = [...jobStore.keys()][0];
    jobStore.delete(oldest);
  }

  return result;
}
