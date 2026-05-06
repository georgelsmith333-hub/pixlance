/**
 * Universal Product Scraper
 * Extracts product data from supplier URLs (AliExpress, Amazon, Alibaba, etc.)
 * Only scrapes publicly accessible data
 */

import * as cheerio from "cheerio";

export interface ScrapedProduct {
  title?: string;
  description?: string;
  price?: number;
  currency?: string;
  brand?: string;
  images?: string[];
  specs?: Record<string, string>;
  category?: string;
  sku?: string;
  availability?: string;
  sourceUrl: string;
  sourceDomain: string;
  scrapedAt: number;
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
};

export async function scrapeUrl(url: string): Promise<ScrapedProduct> {
  const domain = new URL(url).hostname.replace("www.", "");

  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    // Try structured data first (JSON-LD)
    const jsonLdProduct = extractJsonLd($);
    if (jsonLdProduct) {
      return { ...jsonLdProduct, sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
    }

    // Domain-specific extractors
    if (domain.includes("aliexpress")) return extractAliExpress($, url, domain);
    if (domain.includes("alibaba")) return extractAlibaba($, url, domain);
    if (domain.includes("amazon")) return extractAmazon($, url, domain);
    if (domain.includes("ebay")) return extractEbayListing($, url, domain);

    // Generic extraction
    return extractGeneric($, url, domain);
  } catch (err) {
    throw new Error(`Scrape failed for ${url}: ${(err as Error).message}`);
  }
}

function extractJsonLd($: ReturnType<typeof cheerio.load>): Partial<ScrapedProduct> | null {
  try {
    const scripts = $('script[type="application/ld+json"]').toArray();
    for (const el of scripts) {
      const text = $(el).html() ?? "";
      const data = JSON.parse(text) as Record<string, unknown>;
      if (data["@type"] === "Product") {
        const offers = (data["offers"] as Record<string, unknown>) ?? {};
        return {
          title: (data["name"] as string) ?? undefined,
          description: (data["description"] as string) ?? undefined,
          brand: ((data["brand"] as Record<string, string>)?.["name"]) ?? undefined,
          price: parseFloat(String(offers["price"] ?? "0")) || undefined,
          currency: (offers["priceCurrency"] as string) ?? "GBP",
          images: Array.isArray(data["image"]) ? data["image"] as string[] : [(data["image"] as string)].filter(Boolean),
          sku: (data["sku"] as string) ?? (data["mpn"] as string) ?? undefined,
        };
      }
    }
  } catch { /* ignore */ }
  return null;
}

function extractAliExpress($: ReturnType<typeof cheerio.load>, url: string, domain: string): ScrapedProduct {
  const title = $("h1.product-title-text, .pdp-mod-product-badge-title, h1").first().text().trim();
  const price = parseFloat($(".product-price-value, .uniform-banner-box-price").first().text().replace(/[^0-9.]/g, "")) || undefined;
  const images: string[] = [];
  $(".images-view-item img, .slider-item img").each((_, el) => {
    const src = $(el).attr("src") ?? $(el).attr("data-src") ?? "";
    if (src && !images.includes(src)) images.push(src.replace(/^\/\//, "https://"));
  });

  const specs: Record<string, string> = {};
  $(".product-prop-list li, .specification-keys .key-title").each((_, el) => {
    const text = $(el).text().trim();
    const [key, ...vals] = text.split(":");
    if (key && vals.length) specs[key.trim()] = vals.join(":").trim();
  });

  return { title, price, images, specs, sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
}

function extractAlibaba($: ReturnType<typeof cheerio.load>, url: string, domain: string): ScrapedProduct {
  const title = $(".product-name, h1.title-text, h1").first().text().trim();
  const images: string[] = [];
  $(".img-list img, .gallery-thumbnail img").each((_, el) => {
    const src = $(el).attr("src") ?? $(el).attr("data-src") ?? "";
    if (src) images.push(src.replace(/^\/\//, "https://"));
  });
  const description = $(".detail-desc-decorate-richtext, .product-desc").first().text().trim().slice(0, 1000);
  return { title, description, images, sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
}

function extractAmazon($: ReturnType<typeof cheerio.load>, url: string, domain: string): ScrapedProduct {
  const title = $("#productTitle").text().trim();
  const price = parseFloat($("#priceblock_ourprice, .a-price .a-offscreen").first().text().replace(/[^0-9.]/g, "")) || undefined;
  const brand = $("#bylineInfo").text().replace(/Visit|Store|Brand:/gi, "").trim();
  const images: string[] = [];
  $(".a-dynamic-image, #imgBlkFront, .image-block img").each((_, el) => {
    const src = $(el).attr("src") ?? "";
    if (src && src.includes("amazon") && !images.includes(src)) images.push(src);
  });
  const specs: Record<string, string> = {};
  $(".product-facts-title, #productOverview_feature_div tr").each((_, el) => {
    const cells = $(el).find("td, th").toArray();
    if (cells.length >= 2) {
      specs[$(cells[0]).text().trim()] = $(cells[1]).text().trim();
    }
  });
  const description = $("#feature-bullets ul").text().trim().slice(0, 800);
  return { title, price, brand, images, specs, description, sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
}

function extractEbayListing($: ReturnType<typeof cheerio.load>, url: string, domain: string): ScrapedProduct {
  const title = $("h1.x-item-title__mainTitle span, #itemTitle").text().replace("Details about", "").trim();
  const price = parseFloat($("#prcIsum, .x-price-primary span").first().text().replace(/[^0-9.]/g, "")) || undefined;
  const images: string[] = [];
  $(".ux-image-filmstrip-carousel-item img, #icImg").each((_, el) => {
    const src = $(el).attr("src") ?? $(el).attr("data-zoom-src") ?? "";
    if (src) images.push(src);
  });
  const specs: Record<string, string> = {};
  $(".ux-labels-values__labels, .itemAttr").each((_, el) => {
    const label = $(el).find(".ux-labels-values__labels-content, .attrLabels").text().trim();
    const value = $(el).find(".ux-labels-values__values-content, .attrValues").text().trim();
    if (label && value) specs[label] = value;
  });
  return { title, price, images, specs, sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
}

function extractGeneric($: ReturnType<typeof cheerio.load>, url: string, domain: string): ScrapedProduct {
  const title = $('meta[property="og:title"]').attr("content") ??
    $("h1").first().text().trim() ??
    $("title").text().trim();

  const description = $('meta[property="og:description"]').attr("content") ??
    $('meta[name="description"]').attr("content") ??
    $("p").first().text().trim().slice(0, 500);

  const ogImage = $('meta[property="og:image"]').attr("content");
  const images = ogImage ? [ogImage] : [];
  $("img").each((_, el) => {
    const src = $(el).attr("src") ?? "";
    if (src.startsWith("http") && (src.includes("product") || src.includes("item")) && images.length < 5) {
      images.push(src);
    }
  });

  const priceText = $('[class*="price"], [id*="price"]').first().text();
  const price = parseFloat(priceText.replace(/[^0-9.]/g, "")) || undefined;

  return { title, description, images, price, sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
}

// Extract keywords from product text using frequency analysis
export function extractKeywordsFromText(text: string): string[] {
  const stopWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "this", "that", "is", "are", "was", "were", "be", "been", "have", "has", "do", "does", "will", "would", "can", "could", "from", "it", "its"]);

  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  const freq: Record<string, number> = {};
  words.forEach(w => { freq[w] = (freq[w] ?? 0) + 1; });

  return Object.entries(freq)
    .filter(([, count]) => count >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}
