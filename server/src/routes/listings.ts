import { Router } from "express";
import * as cheerio from "cheerio";
import { callAI, callAIJSON, callAIParallel } from "../ai/models.js";
import {
  buildListingPrompt, buildTitleOptimizationPrompt, buildKeywordResearchPrompt,
  buildDescriptionPrompt, buildMarketResearchPrompt, SYSTEM_PROMPTS, type ProductData,
} from "../ai/prompts.js";
import { generateSEOReport, checkVeroRisk, analyzeTitle } from "../ebay/seo.js";
import { scrapeUrl, extractKeywordsFromText } from "../scraper/index.js";

const router = Router();

// ─── Sold Price Tracker ───────────────────────────────────────────────────────
// Scrapes eBay public completed/sold listing pages — zero API keys needed, unlimited

const EBAY_DOMAINS: Record<string, string> = {
  "eBay UK":      "https://www.ebay.co.uk",
  "eBay US":      "https://www.ebay.com",
  "eBay AU":      "https://www.ebay.com.au",
  "eBay DE":      "https://www.ebay.de",
  "eBay FR":      "https://www.ebay.fr",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  "eBay UK": "£", "eBay US": "$", "eBay AU": "A$", "eBay DE": "€", "eBay FR": "€",
};

const SCRAPE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

interface SoldItem {
  title: string;
  price: number;
  currency: string;
  soldDate: string;
  condition: string;
  url: string;
  imageUrl: string;
}

interface SoldPriceStats {
  keyword: string;
  marketplace: string;
  currency: string;
  totalSold: number;
  scrapedCount: number;
  avgPrice: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  priceDistribution: { range: string; count: number; pct: number }[];
  recentSales: SoldItem[];
  sellThroughEstimate: string;
  trendDirection: "up" | "down" | "stable";
  hotPrice: number;
  scrapedAt: number;
  ebaySearchUrl: string;
}

function parsePrice(raw: string): number {
  const s = raw.replace(/[^0-9.,]/g, "").trim();
  if (!s) return 0;
  // Both separators present — determine which is decimal
  if (s.includes(",") && s.includes(".")) {
    return parseFloat(s.lastIndexOf(".") > s.lastIndexOf(",")
      ? s.replace(/,/g, "")           // 1,234.56  (US/UK)
      : s.replace(/\./g, "").replace(",", ".") // 1.234,56 (EU)
    ) || 0;
  }
  // Only comma — decimal if ≤2 digits follow, otherwise thousands
  if (s.includes(",") && !s.includes(".")) {
    const after = s.split(",")[1] ?? "";
    return parseFloat(after.length <= 2 ? s.replace(",", ".") : s.replace(/,/g, "")) || 0;
  }
  return parseFloat(s) || 0;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function buildDistribution(prices: number[], currency: string): { range: string; count: number; pct: number }[] {
  if (!prices.length) return [];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const buckets = 5;
  const step = Math.max(1, Math.ceil((max - min) / buckets));
  const dist: { range: string; count: number; pct: number }[] = [];
  for (let i = 0; i < buckets; i++) {
    const lo = min + i * step;
    const hi = lo + step;
    const count = prices.filter(p => p >= lo && (i === buckets - 1 ? p <= hi : p < hi)).length;
    dist.push({ range: `${currency}${lo.toFixed(0)}–${currency}${hi.toFixed(0)}`, count, pct: Math.round((count / prices.length) * 100) });
  }
  return dist;
}

async function scrapeEbaySoldListings(keyword: string, marketplace: string): Promise<SoldPriceStats> {
  const base = EBAY_DOMAINS[marketplace] ?? EBAY_DOMAINS["eBay UK"];
  const currency = CURRENCY_SYMBOLS[marketplace] ?? "£";
  const q = encodeURIComponent(keyword);

  // Scrape page 1 and page 2 in parallel for more data
  const urls = [
    `${base}/sch/i.html?_nkw=${q}&LH_Complete=1&LH_Sold=1&_sop=13&_ipg=60`,
    `${base}/sch/i.html?_nkw=${q}&LH_Complete=1&LH_Sold=1&_sop=13&_ipg=60&_pgn=2`,
  ];

  const pages = await Promise.allSettled(
    urls.map(url =>
      fetch(url, { headers: SCRAPE_HEADERS, signal: AbortSignal.timeout(15000) })
        .then(r => r.ok ? r.text() : Promise.reject(`HTTP ${r.status}`))
    )
  );

  const items: SoldItem[] = [];
  let totalResultsText = "";

  for (const page of pages) {
    if (page.status !== "fulfilled") continue;
    const $ = cheerio.load(page.value);

    if (!totalResultsText) {
      totalResultsText = $(".srp-controls__count-heading, .results-count").first().text().trim();
    }

    $(".s-item, .srp-results .s-item__wrapper").each((_, el) => {
      const titleEl = $(el).find(".s-item__title, .s-item__title--has-tags").first();
      const title = titleEl.text().replace(/^Shop on eBay$/i, "").trim();
      if (!title || title.toLowerCase() === "shop on ebay") return;

      const priceText = $(el).find(".s-item__price .notranslate, .s-item__price").first().text().trim();
      const price = parsePrice(priceText);
      if (!price || price <= 0) return;

      const dateText = $(el).find(".s-item__ended-date, .s-item__sold-date, .POSITIVE").first().text().trim();
      const condition = $(el).find(".SECONDARY_INFO, .s-item__subtitle").first().text().trim();
      const link = $(el).find("a.s-item__link, a[href*='/itm/']").first().attr("href") ?? "";
      const img = $(el).find(".s-item__image-wrapper img, .s-item__image img").first().attr("src") ?? "";

      items.push({
        title: title.slice(0, 80),
        price,
        currency,
        soldDate: dateText || "Recently",
        condition: condition || "Not specified",
        url: link.split("?")[0],
        imageUrl: img,
      });
    });
  }

  if (!items.length) {
    throw new Error(`No sold listings found for "${keyword}" on ${marketplace}. Try a broader search term.`);
  }

  const prices = items.map(i => i.price).filter(p => p > 0);

  // Remove extreme outliers (beyond 3 std devs)
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const std = Math.sqrt(prices.map(p => Math.pow(p - avg, 2)).reduce((a, b) => a + b, 0) / prices.length);
  const filtered = prices.filter(p => Math.abs(p - avg) <= 3 * std);

  const finalAvg = filtered.reduce((a, b) => a + b, 0) / filtered.length;
  const finalMedian = median(filtered);
  const finalMin = Math.min(...filtered);
  const finalMax = Math.max(...filtered);

  // Trend: compare first half vs second half avg
  const half = Math.floor(filtered.length / 2);
  const firstHalfAvg = filtered.slice(0, half).reduce((a, b) => a + b, 0) / (half || 1);
  const secondHalfAvg = filtered.slice(half).reduce((a, b) => a + b, 0) / (filtered.length - half || 1);
  const trendDirection: "up" | "down" | "stable" =
    secondHalfAvg > firstHalfAvg * 1.05 ? "up" :
    secondHalfAvg < firstHalfAvg * 0.95 ? "down" : "stable";

  // "Hot price" = most common price bucket centroid
  const dist = buildDistribution(filtered, currency);
  const hotBucket = [...dist].sort((a, b) => b.count - a.count)[0];
  const hotPrice = hotBucket
    ? parseFloat(hotBucket.range.replace(currency, "").split("–")[0]) + (parsePrice(hotBucket.range.split("–")[1]) - parseFloat(hotBucket.range.replace(currency, "").split("–")[0])) / 2
    : finalMedian;

  // Parse total results
  const totalMatch = totalResultsText.match(/[\d,]+/);
  const totalSold = totalMatch ? parseInt(totalMatch[0].replace(/,/g, "")) : items.length;

  // Sell-through estimate
  const sellThroughEstimate =
    totalSold > 5000 ? "Very High (5000+ sold) — hot market" :
    totalSold > 1000 ? "High (1000+ sold) — strong demand" :
    totalSold > 300  ? "Medium (300+ sold) — steady market" :
    totalSold > 50   ? "Low-Medium (50+ sold) — niche demand" :
                       "Low (<50 sold) — limited market";

  return {
    keyword,
    marketplace,
    currency,
    totalSold,
    scrapedCount: items.length,
    avgPrice: parseFloat(finalAvg.toFixed(2)),
    medianPrice: parseFloat(finalMedian.toFixed(2)),
    minPrice: parseFloat(finalMin.toFixed(2)),
    maxPrice: parseFloat(finalMax.toFixed(2)),
    priceDistribution: dist,
    recentSales: items.slice(0, 12),
    sellThroughEstimate,
    trendDirection,
    hotPrice: parseFloat(hotPrice.toFixed(2)),
    scrapedAt: Date.now(),
    ebaySearchUrl: `${base}/sch/i.html?_nkw=${q}&LH_Complete=1&LH_Sold=1&_sop=13`,
  };
}

router.post("/listings/sold-prices", async (req, res) => {
  const { keyword, marketplace = "eBay UK" } = req.body as { keyword: string; marketplace?: string };
  if (!keyword?.trim()) { res.status(400).json({ error: "Keyword required" }); return; }
  try {
    const data = await scrapeEbaySoldListings(keyword.trim(), marketplace);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Competitor Spy ───────────────────────────────────────────────────────────
// Scrapes active (live, unsold) eBay listings — no API key, unlimited

interface CompetitorListing {
  title: string;
  price: number;
  currency: string;
  condition: string;
  bids: number;
  watchers: string;
  sellerName: string;
  sellerFeedback: string;
  timeLeft: string;
  url: string;
  imageUrl: string;
  shipping: string;
  isBuyItNow: boolean;
}

interface CompetitorSpy {
  keyword: string;
  marketplace: string;
  currency: string;
  totalActive: number;
  scrapedCount: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  medianPrice: number;
  listings: CompetitorListing[];
  titleKeywordFreq: { word: string; count: number; pct: number }[];
  priceSegments: { label: string; count: number; range: string }[];
  gaps: string[];
  insights: string[];
  ebaySearchUrl: string;
  scrapedAt: number;
}

async function scrapeEbayActiveListings(keyword: string, marketplace: string): Promise<CompetitorSpy> {
  const base = EBAY_DOMAINS[marketplace] ?? EBAY_DOMAINS["eBay UK"];
  const currency = CURRENCY_SYMBOLS[marketplace] ?? "£";
  const q = encodeURIComponent(keyword);

  // Scrape 2 pages in parallel (active listings, sorted by most relevant)
  const urls = [
    `${base}/sch/i.html?_nkw=${q}&_sop=12&_ipg=60`,
    `${base}/sch/i.html?_nkw=${q}&_sop=12&_ipg=60&_pgn=2`,
  ];

  const pages = await Promise.allSettled(
    urls.map(url =>
      fetch(url, { headers: SCRAPE_HEADERS, signal: AbortSignal.timeout(15000) })
        .then(r => r.ok ? r.text() : Promise.reject(`HTTP ${r.status}`))
    )
  );

  const items: CompetitorListing[] = [];
  let totalText = "";

  for (const page of pages) {
    if (page.status !== "fulfilled") continue;
    const $ = cheerio.load(page.value);

    if (!totalText) {
      totalText = $(".srp-controls__count-heading, .results-count").first().text().trim();
    }

    $(".s-item, .srp-results .s-item__wrapper").each((_, el) => {
      const titleEl = $(el).find(".s-item__title").first();
      const title = titleEl.text().replace(/^Shop on eBay$/i, "").trim();
      if (!title || title.toLowerCase() === "shop on ebay") return;

      const priceText = $(el).find(".s-item__price .notranslate, .s-item__price").first().text().trim();
      const price = parsePrice(priceText);
      if (!price || price <= 0) return;

      const condition = $(el).find(".SECONDARY_INFO, .s-item__subtitle").first().text().trim();
      const bidsText = $(el).find(".s-item__bids, .s-item__bidCount").first().text().trim();
      const bids = parseInt(bidsText.match(/(\d+)/)?.[1] ?? "0") || 0;
      const watchers = $(el).find(".s-item__watchCountWithSuffix, .s-item__hotness-signal").first().text().trim();
      const seller = $(el).find(".s-item__seller-info, .s-item__seller-info-text").first().text().trim().slice(0, 40);
      const timeLeft = $(el).find(".s-item__time-left, .s-item__time-end").first().text().trim();
      const shipping = $(el).find(".s-item__shipping, .s-item__logisticsCost").first().text().trim();
      const link = $(el).find("a.s-item__link, a[href*='/itm/']").first().attr("href") ?? "";
      const img = $(el).find(".s-item__image-wrapper img").first().attr("src") ?? "";
      const isBIN = !bids && !$(el).find(".s-item__bids").length;

      // Extract seller feedback score
      const feedbackText = $(el).find(".s-item__seller-info").text();
      const feedbackMatch = feedbackText.match(/\((\d[\d,]*)\)/);
      const sellerFeedback = feedbackMatch ? feedbackMatch[1] : "";

      items.push({
        title: title.slice(0, 90),
        price,
        currency,
        condition: condition || "Not specified",
        bids,
        watchers: watchers || "",
        sellerName: seller.split("(")[0].trim() || "eBay Seller",
        sellerFeedback,
        timeLeft: timeLeft || "",
        url: link.split("?")[0],
        imageUrl: img,
        shipping: shipping || "See listing",
        isBuyItNow: isBIN,
      });
    });
  }

  if (!items.length) {
    throw new Error(`No active listings found for "${keyword}" on ${marketplace}. Try a different search term.`);
  }

  const prices = items.map(i => i.price).filter(p => p > 0);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const std = Math.sqrt(prices.map(p => Math.pow(p - avg, 2)).reduce((a, b) => a + b, 0) / prices.length);
  const filtered = prices.filter(p => Math.abs(p - avg) <= 3 * std);
  const finalAvg = filtered.reduce((a, b) => a + b, 0) / (filtered.length || 1);
  const finalMin = Math.min(...filtered);
  const finalMax = Math.max(...filtered);
  const finalMedian = median(filtered);

  // Price segments
  const budget = filtered.filter(p => p < finalAvg * 0.7).length;
  const mid = filtered.filter(p => p >= finalAvg * 0.7 && p <= finalAvg * 1.3).length;
  const premium = filtered.filter(p => p > finalAvg * 1.3).length;
  const priceSegments = [
    { label: "Budget", count: budget, range: `Under ${currency}${(finalAvg * 0.7).toFixed(0)}` },
    { label: "Mid-range", count: mid, range: `${currency}${(finalAvg * 0.7).toFixed(0)}–${currency}${(finalAvg * 1.3).toFixed(0)}` },
    { label: "Premium", count: premium, range: `Over ${currency}${(finalAvg * 1.3).toFixed(0)}` },
  ];

  // Keyword frequency analysis across competitor titles
  const stopWords = new Set(["the","a","an","and","or","for","of","with","in","to","new","used","free","buy","sale","uk","us","ebay","lot"]);
  const wordFreq: Record<string, number> = {};
  items.forEach(item => {
    item.title.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
      .forEach(w => { wordFreq[w] = (wordFreq[w] ?? 0) + 1; });
  });
  const titleKeywordFreq = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count, pct: Math.round((count / items.length) * 100) }));

  // Gap analysis
  const gaps: string[] = [];
  if (budget < items.length * 0.2) gaps.push(`Low budget competition — only ${budget} listings under ${currency}${(finalAvg * 0.7).toFixed(0)}`);
  if (premium < items.length * 0.15) gaps.push(`Premium gap — few sellers pricing above ${currency}${(finalAvg * 1.3).toFixed(0)}`);
  const withBids = items.filter(i => i.bids > 0).length;
  if (withBids < items.length * 0.1) gaps.push("Very few auction-style listings — BIN (Buy It Now) dominates this market");
  const freeShipping = items.filter(i => i.shipping.toLowerCase().includes("free")).length;
  if (freeShipping < items.length * 0.5) gaps.push(`Only ${Math.round(freeShipping/items.length*100)}% offer free shipping — opportunity to stand out`);
  if (items.length < 50) gaps.push("Low competition niche — fewer than 50 active sellers found");

  // Insights
  const insights: string[] = [
    `Market average price: ${currency}${finalAvg.toFixed(2)} — price below ${currency}${(finalAvg * 0.92).toFixed(2)} for fast sale`,
    `Most-used title words: ${titleKeywordFreq.slice(0,3).map(k=>k.word).join(", ")} — include these in your title`,
    mid > budget + premium ? "Mid-range pricing dominates — differentiate with extras or premium positioning" : "Price spread is wide — test multiple price points",
    withBids > 0 ? `${withBids} auction-style listings — consider BIN with Best Offer for maximum visibility` : "BIN-only market — set competitive fixed price",
  ];

  // Total active count
  const totalMatch = totalText.match(/[\d,]+/);
  const totalActive = totalMatch ? parseInt(totalMatch[0].replace(/,/g, "")) : items.length;

  return {
    keyword,
    marketplace,
    currency,
    totalActive,
    scrapedCount: items.length,
    avgPrice: parseFloat(finalAvg.toFixed(2)),
    minPrice: parseFloat(finalMin.toFixed(2)),
    maxPrice: parseFloat(finalMax.toFixed(2)),
    medianPrice: parseFloat(finalMedian.toFixed(2)),
    listings: items.slice(0, 20),
    titleKeywordFreq,
    priceSegments,
    gaps,
    insights,
    ebaySearchUrl: `${base}/sch/i.html?_nkw=${q}&_sop=12`,
    scrapedAt: Date.now(),
  };
}

router.post("/listings/competitor-spy", async (req, res) => {
  const { keyword, marketplace = "eBay UK" } = req.body as { keyword: string; marketplace?: string };
  if (!keyword?.trim()) { res.status(400).json({ error: "Keyword required" }); return; }
  try {
    const data = await scrapeEbayActiveListings(keyword.trim(), marketplace);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Generate full eBay listing from any input
router.post("/listings/generate", async (req, res) => {
  const { product, marketplace = "eBay UK", tone = "professional", mode = "full" } = req.body as {
    product: ProductData;
    marketplace?: string;
    tone?: string;
    mode?: "full" | "title" | "description" | "keywords" | "get-prompt";
  };

  if (!product || (!product.title && !product.description && !product.keywords?.length)) {
    res.status(400).json({ error: "Product data required" });
    return;
  }

  try {
    if (mode === "title") {
      const prompt = buildTitleOptimizationPrompt(product.title ?? "", product.keywords ?? []);
      const result = await callAIJSON<{ title: string; charCount: number; keywordsUsed: string[]; improvements: string[] }>(prompt, "title", SYSTEM_PROMPTS.listing);
      res.json({ title: result, veroCheck: checkVeroRisk(result.title ?? "") });
      return;
    }

    if (mode === "keywords") {
      const prompt = buildKeywordResearchPrompt(product.title ?? product.keywords?.[0] ?? "", marketplace);
      const result = await callAIJSON(prompt, "keywords", SYSTEM_PROMPTS.keywords);
      res.json(result);
      return;
    }

    if (mode === "description") {
      const prompt = buildDescriptionPrompt(product, "ebay");
      const result = await callAI(prompt, "description", SYSTEM_PROMPTS.listing);
      res.json({ description: result });
      return;
    }

    // "get-prompt" mode: client calls AI itself (avoids server IP rate limits)
    if (mode === "get-prompt") {
      const prompt = buildListingPrompt(product, { marketplace, tone });
      res.json({ prompt, systemPrompt: SYSTEM_PROMPTS.listing, task: "listing" });
      return;
    }

    // Full listing generation
    const prompt = buildListingPrompt(product, { marketplace, tone });
    const listing = await callAIJSON<{
      title: string;
      subtitle: string;
      category: string;
      condition: string;
      conditionDescription: string;
      price: number;
      itemSpecifics: Record<string, string>;
      description: string;
      keywords: string[];
      tags: string[];
      shippingRecommendation: string;
      seoScore: number;
      cassiniTips: string[];
      veroWarning: boolean;
      veroNote: string;
    }>(prompt, "listing", SYSTEM_PROMPTS.listing);

    // Run SEO analysis on generated listing
    const seoReport = generateSEOReport({
      title: listing.title ?? "",
      description: listing.description ?? "",
      itemSpecifics: listing.itemSpecifics ?? {},
      price: listing.price,
      category: listing.category,
    });

    res.json({ listing, seoReport, generatedAt: Date.now() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Parse raw AI text into formatted listing (used when client calls AI directly)
router.post("/listings/parse", async (req, res) => {
  const { rawAI } = req.body as { rawAI: string };
  if (!rawAI?.trim()) { res.status(400).json({ error: "rawAI text required" }); return; }
  try {
    const match = rawAI.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found in AI response");
    let listing: Record<string, unknown>;
    try {
      listing = JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      const fixed = match[0].replace(/,(\s*[}\]])/g, "$1");
      listing = JSON.parse(fixed) as Record<string, unknown>;
    }
    const seoReport = generateSEOReport({
      title: (listing.title as string) ?? "",
      description: (listing.description as string) ?? "",
      itemSpecifics: (listing.itemSpecifics as Record<string, string>) ?? {},
      price: listing.price as number | undefined,
      category: listing.category as string | undefined,
    });
    res.json({ listing, seoReport, generatedAt: Date.now() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Scrape supplier URL and generate listing
router.post("/listings/from-url", async (req, res) => {
  const { url, marketplace = "eBay UK" } = req.body as { url: string; marketplace?: string };

  if (!url) { res.status(400).json({ error: "URL is required" }); return; }

  try {
    // Scrape product data
    const scraped = await scrapeUrl(url);
    
    // Extract keywords from scraped text
    const rawText = [scraped.title, scraped.description, ...Object.values(scraped.specs ?? {})].join(" ");
    const extractedKeywords = extractKeywordsFromText(rawText);

    const product: ProductData = {
      title: scraped.title,
      description: scraped.description,
      brand: scraped.brand,
      price: scraped.price,
      specs: scraped.specs,
      images: scraped.images,
      keywords: extractedKeywords.slice(0, 10),
      sourceUrl: url,
    };

    // Generate listing from scraped data
    const prompt = buildListingPrompt(product, { marketplace });
    const listing = await callAIJSON(prompt, "listing", SYSTEM_PROMPTS.listing);
    const seoReport = generateSEOReport({
      title: (listing as { title?: string }).title ?? "",
      description: (listing as { description?: string }).description ?? "",
      itemSpecifics: (listing as { itemSpecifics?: Record<string, string> }).itemSpecifics ?? {},
    });

    res.json({ scraped, listing, seoReport, keywords: extractedKeywords });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Optimize an existing eBay title
router.post("/listings/optimize-title", async (req, res) => {
  const { title, keywords = [] } = req.body as { title: string; keywords?: string[] };
  if (!title) { res.status(400).json({ error: "Title required" }); return; }

  try {
    // Run auto keyword research if no keywords provided
    let kws = keywords;
    if (!kws.length) {
      const kwPrompt = buildKeywordResearchPrompt(title);
      const kwData = await callAIJSON<{ primary: string[] }>(kwPrompt, "keywords", SYSTEM_PROMPTS.keywords);
      kws = kwData.primary ?? [];
    }

    const prompt = buildTitleOptimizationPrompt(title, kws);
    const result = await callAIJSON<{ title: string; charCount: number; keywordsUsed: string[]; improvements: string[] }>(prompt, "title", SYSTEM_PROMPTS.listing);

    const analysis = analyzeTitle(result.title ?? title);
    const veroCheck = checkVeroRisk(result.title ?? title);

    res.json({ original: title, optimized: result, analysis, veroCheck, keywords: kws });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Research market for a keyword
router.post("/listings/research", async (req, res) => {
  const { keyword, marketplace = "eBay UK" } = req.body as { keyword: string; marketplace?: string };
  if (!keyword) { res.status(400).json({ error: "Keyword required" }); return; }

  try {
    const [marketData, keywordsData] = await callAIParallel([
      { prompt: buildMarketResearchPrompt(keyword), task: "research", system: SYSTEM_PROMPTS.research },
      { prompt: buildKeywordResearchPrompt(keyword, marketplace), task: "keywords", system: SYSTEM_PROMPTS.keywords },
    ]);

    const market = JSON.parse(marketData.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as Record<string, unknown>;
    const kwData = JSON.parse(keywordsData.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as Record<string, unknown>;

    res.json({ keyword, market, keywords: kwData, marketplace });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Analyze existing listing for SEO
router.post("/listings/analyze", async (req, res) => {
  const { title, description, itemSpecifics, price, category } = req.body as {
    title: string;
    description: string;
    itemSpecifics?: Record<string, string>;
    price?: number;
    category?: string;
  };

  if (!title) { res.status(400).json({ error: "Title required" }); return; }

  try {
    const seoReport = generateSEOReport({
      title,
      description: description ?? "",
      itemSpecifics: itemSpecifics ?? {},
      price,
      category,
    });
    const veroCheck = checkVeroRisk(title + " " + (description ?? ""));
    res.json({ seoReport, veroCheck });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Bulk generate listings from array of products
router.post("/listings/bulk", async (req, res) => {
  const { products, marketplace = "eBay UK" } = req.body as { products: ProductData[]; marketplace?: string };

  if (!Array.isArray(products) || !products.length) {
    res.status(400).json({ error: "Products array required" });
    return;
  }

  // Process in batches of 3 to avoid overwhelming free API
  const BATCH = 3;
  const results: unknown[] = [];
  const errors: { index: number; error: string }[] = [];

  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH);
    const batchResults = await Promise.allSettled(
      batch.map(async (p) => {
        const prompt = buildListingPrompt(p, { marketplace });
        return callAIJSON(prompt, "bulk", SYSTEM_PROMPTS.listing);
      })
    );
    batchResults.forEach((r, j) => {
      if (r.status === "fulfilled") results.push(r.value);
      else errors.push({ index: i + j, error: String(r.reason) });
    });
  }

  res.json({ total: products.length, successful: results.length, failed: errors.length, results, errors });
});

export default router;
