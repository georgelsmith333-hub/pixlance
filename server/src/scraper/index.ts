/**
 * Universal Product Scraper — Advanced Multi-Strategy Engine v2
 * AliExpress, Amazon, Alibaba, Temu, eBay, DHgate, SHEIN, Wish + any page
 * Strategies: Direct fetch → Proxy fallback → JSON-LD → window vars → DOM → og: tags
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
  rating?: number;
  reviewCount?: number;
  sourceUrl: string;
  sourceDomain: string;
  scrapedAt: number;
}

// Proxy services (no API key needed — free tier)
const PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getBrowserHeaders(referer?: string): Record<string, string> {
  return {
    "User-Agent": randomUA(),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    ...(referer ? { "Referer": referer } : {}),
  };
}

function parsePrice(raw: string): number {
  const s = raw.replace(/[^0-9.,]/g, "").trim();
  if (!s) return 0;
  if (s.includes(",") && s.includes(".")) {
    return parseFloat(
      s.lastIndexOf(".") > s.lastIndexOf(",")
        ? s.replace(/,/g, "")
        : s.replace(/\./g, "").replace(",", ".")
    ) || 0;
  }
  if (s.includes(",") && !s.includes(".")) {
    const after = s.split(",")[1] ?? "";
    return parseFloat(after.length <= 2 ? s.replace(",", ".") : s.replace(/,/g, "")) || 0;
  }
  return parseFloat(s) || 0;
}

// ─── Fetch with multiple strategies ──────────────────────────────────────────
async function fetchWithFallback(url: string): Promise<{ html: string; via: string }> {
  const domain = new URL(url).hostname;

  // Strategy 1: Direct fetch (fast, works for most sites)
  try {
    const res = await fetch(url, {
      headers: getBrowserHeaders(),
      signal: AbortSignal.timeout(18000),
      redirect: "follow",
    });
    if (res.ok) {
      const html = await res.text();
      if (html.length > 500 && !html.includes("Access Denied") && !html.includes("captcha")) {
        return { html, via: "direct" };
      }
    }
  } catch { /* fall through to proxy */ }

  // Strategy 2: Simpler headers (some sites block sec-* headers)
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": randomUA(),
        "Accept": "text/html,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.5",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const html = await res.text();
      if (html.length > 500) return { html, via: "simple-headers" };
    }
  } catch { /* fall through */ }

  // Strategy 3: Proxy services (for blocked sites like AliExpress)
  for (const proxyFn of PROXIES) {
    try {
      const proxyUrl = proxyFn(url);
      const res = await fetch(proxyUrl, {
        headers: { "User-Agent": randomUA() },
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const html = await res.text();
        if (html.length > 500 && !html.toLowerCase().includes("error") && !html.includes("Too many request")) {
          return { html, via: `proxy:${new URL(proxyUrl).hostname}` };
        }
      }
    } catch { /* try next proxy */ }
  }

  throw new Error(`All fetch strategies failed for ${domain}`);
}

export async function scrapeUrl(url: string): Promise<ScrapedProduct> {
  const domain = new URL(url).hostname.replace("www.", "");

  const { html } = await fetchWithFallback(url);
  const $ = cheerio.load(html);

  // Strategy 1: JSON-LD structured data (most reliable when present)
  const jsonLd = extractJsonLd($);
  if (jsonLd?.title && jsonLd.title.length > 3) {
    const base = { ...jsonLd, sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
    if (domain.includes("aliexpress")) return mergeWithAliExpress($, html, url, domain, base);
    if (domain.includes("amazon")) return mergeWithAmazon($, url, domain, base);
    return base as ScrapedProduct;
  }

  // Strategy 2: Domain-specific extractors
  if (domain.includes("aliexpress")) return extractAliExpress($, html, url, domain);
  if (domain.includes("alibaba")) return extractAlibaba($, url, domain);
  if (domain.includes("amazon")) return extractAmazon($, url, domain);
  if (domain.includes("ebay")) return extractEbayListing($, url, domain);
  if (domain.includes("temu")) return extractTemu($, html, url, domain);
  if (domain.includes("dhgate")) return extractDHGate($, url, domain);
  if (domain.includes("wish.com")) return extractWish($, html, url, domain);
  if (domain.includes("shein")) return extractShein($, html, url, domain);

  // Strategy 3: Generic extraction
  return extractGeneric($, html, url, domain);
}

// ─── JSON-LD Extractor ────────────────────────────────────────────────────────
function extractJsonLd($: ReturnType<typeof cheerio.load>): Partial<ScrapedProduct> | null {
  try {
    const scripts = $('script[type="application/ld+json"]').toArray();
    for (const el of scripts) {
      const text = $(el).html() ?? "";
      try {
        const data = JSON.parse(text) as Record<string, unknown>;
        const items = data["@graph"]
          ? (data["@graph"] as Record<string, unknown>[])
          : [data];
        for (const item of items) {
          if (item["@type"] === "Product" ||
            (Array.isArray(item["@type"]) && (item["@type"] as string[]).includes("Product"))) {
            const offers = (item["offers"] as Record<string, unknown>) ?? {};
            const offerArr = Array.isArray(offers)
              ? (offers as Record<string, unknown>[])[0]
              : offers;
            const images: string[] = [];
            if (Array.isArray(item["image"])) {
              (item["image"] as (string | Record<string, string>)[]).forEach(img => {
                const src = typeof img === "string" ? img : img?.url ?? img?.contentUrl ?? "";
                if (src) images.push(src);
              });
            } else if (typeof item["image"] === "string") {
              images.push(item["image"]);
            } else if ((item["image"] as Record<string, string>)?.url) {
              images.push((item["image"] as Record<string, string>).url);
            }
            return {
              title: (item["name"] as string) ?? undefined,
              description: (item["description"] as string) ?? undefined,
              brand: ((item["brand"] as Record<string, string>)?.["name"]) ?? (item["brand"] as string) ?? undefined,
              price: parseFloat(String((offerArr as Record<string, unknown>)?.["price"] ?? "0")) || undefined,
              currency: ((offerArr as Record<string, unknown>)?.["priceCurrency"] as string) ?? "USD",
              images: images.filter(Boolean),
              sku: (item["sku"] as string) ?? (item["mpn"] as string) ?? undefined,
              availability: ((offerArr as Record<string, unknown>)?.["availability"] as string) ?? undefined,
              rating: parseFloat(String((item["aggregateRating"] as Record<string, unknown>)?.["ratingValue"] ?? "0")) || undefined,
              reviewCount: parseInt(String((item["aggregateRating"] as Record<string, unknown>)?.["reviewCount"] ?? "0")) || undefined,
            };
          }
        }
      } catch { /* try next */ }
    }
  } catch { /* ignore */ }
  return null;
}

// ─── AliExpress ───────────────────────────────────────────────────────────────
function extractAliExpress($: ReturnType<typeof cheerio.load>, html: string, url: string, domain: string): ScrapedProduct {
  // Strategy 1: window.runParams
  const runParamsMatch = html.match(/window\.runParams\s*=\s*(\{[\s\S]*?\});\s*(?:window\.|var |<\/script>)/);
  if (runParamsMatch) {
    try {
      const data = JSON.parse(runParamsMatch[1]) as Record<string, unknown>;
      const detail = (data.data as Record<string, unknown>) ?? data;
      const priceModule = detail.priceModule as Record<string, unknown>;
      const titleModule = detail.titleModule as Record<string, unknown>;
      const imageModule = detail.imageModule as Record<string, unknown>;
      const specsModule = detail.specsModule as Record<string, unknown>;
      const storeModule = detail.storeModule as Record<string, unknown>;

      const images: string[] = [];
      if (imageModule?.imagePathList) {
        (imageModule.imagePathList as string[]).forEach(img => {
          images.push(img.startsWith("//") ? `https:${img}` : img);
        });
      }

      const specs: Record<string, string> = {};
      if (specsModule?.props) {
        (specsModule.props as { attrName: string; attrValue: string }[]).forEach(p => {
          specs[p.attrName] = p.attrValue;
        });
      }

      const title = (titleModule?.subject as string) ?? "";
      const pm = priceModule as Record<string, unknown> | undefined;
      const price = parseFloat(String(
        (pm?.minActivityAmount as Record<string, unknown>)?.value ??
        pm?.formatedActivityPrice ??
        (pm?.minAmount as Record<string, unknown>)?.value ?? "0"
      )) || undefined;
      const brand = (storeModule?.storeName as string) ?? undefined;

      if (title) {
        return { title, price, brand, images, specs, currency: "USD", sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
      }
    } catch { /* fall through */ }
  }

  // Strategy 2: Extract from embedded JSON in page scripts
  const jsonPatterns = [
    /window\._dida_config_\s*=\s*(\{[\s\S]*?\});/,
    /"goodsId"\s*:\s*"?(\d+)"?/,
    /"productTitle"\s*:\s*"([^"]+)"/,
  ];

  // Strategy 3: Extract imagePathList
  const imgScriptMatch = html.match(/"imagePathList"\s*:\s*(\[[\s\S]*?\])/);
  const extractedImages: string[] = [];
  if (imgScriptMatch) {
    try {
      const imgArr = JSON.parse(imgScriptMatch[1]) as string[];
      imgArr.forEach(src => {
        const clean = src.startsWith("//") ? `https:${src}` : src;
        if (!extractedImages.includes(clean)) extractedImages.push(clean);
      });
    } catch { /* ignore */ }
  }

  // Strategy 4: DOM selectors
  const title =
    $("h1.product-title-text, .pdp-mod-product-badge-title, h1[data-pl='product-title'], .product-title").first().text().trim() ||
    $("[class*='title--'] h1, [class*='Title'] h1, h1").first().text().trim();

  const priceText =
    $(".product-price-value, .uniform-banner-box-price, .pdp-price").first().text().trim() ||
    $("[class*='price--originalText'], [class*='Price--originalText'], .price-current").first().text().trim();
  const price = priceText ? parsePrice(priceText) : undefined;

  // DOM images
  const domImages: string[] = [];
  $(".images-view-item img, .slider-item img, .image-view-item img, [class*='imageViewer'] img, .magnifier-image, .image-wrapper img").each((_, el) => {
    const src = $(el).attr("src") ?? $(el).attr("data-src") ?? $(el).attr("data-zoom-src") ?? "";
    if (src && src.length > 10) {
      const cleaned = src.replace(/^\/\//, "https://").replace(/_\d+x\d+\./, "_800x800.");
      if (!domImages.includes(cleaned)) domImages.push(cleaned);
    }
  });

  const allImages = [...extractedImages, ...domImages];

  const specs: Record<string, string> = {};
  $(".product-prop-list li, .specification-keys .key-title, [class*='specList'] li").each((_, el) => {
    const text = $(el).text().trim();
    const colonIdx = text.indexOf(":");
    if (colonIdx > 0) {
      specs[text.slice(0, colonIdx).trim()] = text.slice(colonIdx + 1).trim();
    }
  });

  // og: tags fallback
  const ogTitle = $('meta[property="og:title"]').attr("content") ?? "";
  const ogImage = $('meta[property="og:image"]').attr("content");
  const ogDesc = $('meta[property="og:description"]').attr("content") ?? "";
  const ogPrice = $('meta[property="product:price:amount"]').attr("content");

  if (ogImage && !allImages.includes(ogImage)) allImages.push(ogImage);

  const description =
    $(".product-description, .detail-desc-decorate-richtext, [class*='descriptionModule']").first().text().trim().slice(0, 1000) ||
    ogDesc.slice(0, 500);

  const brand = $("[class*='store-header'] span, .store-info span").first().text().trim() || undefined;

  return {
    title: title || ogTitle || "AliExpress Product",
    price: price ?? (ogPrice ? parsePrice(ogPrice) : undefined),
    brand,
    description,
    images: allImages,
    specs,
    currency: "USD",
    sourceUrl: url,
    sourceDomain: domain,
    scrapedAt: Date.now(),
  };
}

function mergeWithAliExpress($: ReturnType<typeof cheerio.load>, html: string, url: string, domain: string, base: Partial<ScrapedProduct>): ScrapedProduct {
  if (!base.images?.length) {
    const result = extractAliExpress($, html, url, domain);
    base.images = result.images;
    if (!base.description && result.description) base.description = result.description;
    if (!base.specs && result.specs) base.specs = result.specs;
  }
  return { ...base, sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() } as ScrapedProduct;
}

// ─── Amazon ───────────────────────────────────────────────────────────────────
function extractAmazon($: ReturnType<typeof cheerio.load>, url: string, domain: string): ScrapedProduct {
  const title = $("#productTitle").text().trim() || $('meta[name="title"]').attr("content") || "";
  const priceText =
    $(".a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice").first().text().trim() ||
    $(".reinventPricePriceToPayMargin span").first().text().trim() ||
    ($('meta[property="product:price:amount"]').attr("content") ?? "");
  const price = priceText ? parsePrice(priceText) : undefined;
  const brand =
    $("#bylineInfo, #brand, .po-brand .po-break-word").first().text().replace(/Visit|Store|Brand:|\s+/gi, " ").trim() || undefined;

  const images: string[] = [];
  const landingImageMatch = $('script:not([src])').toArray().find(s => $(s).html()?.includes("ImageBlockATF"));
  if (landingImageMatch) {
    const matches = $(landingImageMatch).html()?.matchAll(/"hiRes"\s*:\s*"([^"]+)"/g) ?? [];
    for (const m of matches) {
      if (m[1] && !images.includes(m[1])) images.push(m[1]);
    }
  }
  if (!images.length) {
    $(".a-dynamic-image, #imgBlkFront, .image-block img, #landingImage").each((_, el) => {
      const src = $(el).attr("src") ?? "";
      if (src && src.includes("images/I") && !images.includes(src)) images.push(src);
    });
  }
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage && !images.length) images.push(ogImage);

  const specs: Record<string, string> = {};
  $("#productOverview_feature_div tr, #detailBullets_feature_div li, .a-expander-content tr").each((_, el) => {
    const cells = $(el).find("td, th, span").toArray();
    if (cells.length >= 2) {
      const key = $(cells[0]).text().trim().replace(/[:\n]/g, "");
      const val = $(cells[1]).text().trim().replace(/\n/g, " ");
      if (key && val && key.length < 50) specs[key] = val;
    }
  });

  const description = $("#feature-bullets ul, #productDescription").text().trim().slice(0, 800);
  const category = $("#wayfinding-breadcrumbs_feature_div .a-breadcrumb a").last().text().trim() || undefined;
  const rating = parseFloat($(".a-icon-alt").first().text()) || undefined;

  return { title: title || "Amazon Product", price, brand, images, specs, description, category, rating, sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
}

function mergeWithAmazon($: ReturnType<typeof cheerio.load>, url: string, domain: string, base: Partial<ScrapedProduct>): ScrapedProduct {
  const amz = extractAmazon($, url, domain);
  return {
    ...base,
    images: base.images?.length ? base.images : amz.images,
    specs: { ...amz.specs, ...(base.specs ?? {}) },
    description: base.description || amz.description,
    brand: base.brand || amz.brand,
    sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now(),
  } as ScrapedProduct;
}

// ─── Temu ─────────────────────────────────────────────────────────────────────
function extractTemu($: ReturnType<typeof cheerio.load>, html: string, url: string, domain: string): ScrapedProduct {
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]) as Record<string, unknown>;
      const props = (nextData.props as Record<string, unknown>)?.pageProps as Record<string, unknown>;
      const goodsDetail = (props?.initialData as Record<string, unknown>)?.goodsDetail as Record<string, unknown>;
      if (goodsDetail) {
        const title = (goodsDetail.goodsName as string) ?? "";
        const price = parseFloat(String(goodsDetail.originalPrice ?? goodsDetail.salePrice ?? "0")) / 100 || undefined;
        const images: string[] = [];
        if (Array.isArray(goodsDetail.carouselGallery)) {
          (goodsDetail.carouselGallery as { url: string }[]).forEach(img => { if (img.url) images.push(img.url); });
        }
        const specs: Record<string, string> = {};
        if (Array.isArray(goodsDetail.attributeList)) {
          (goodsDetail.attributeList as { key: string; value: string }[]).forEach(attr => { specs[attr.key] = attr.value; });
        }
        const description = (goodsDetail.goodsDesc as string) ?? "";
        if (title) return { title, price, images, specs, description, currency: "USD", sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
      }
    } catch { /* fall through */ }
  }

  const ogTitle = $('meta[property="og:title"]').attr("content") ?? "";
  const ogImage = $('meta[property="og:image"]').attr("content");
  const ogDesc = $('meta[property="og:description"]').attr("content") ?? "";
  const title = $("h1[data-testid='product-title'], .product-title, .goods-name, h1").first().text().trim() || ogTitle;
  const priceText = $("[data-testid='product-price'], .price-content, .current-price").first().text().trim();
  const price = priceText ? parsePrice(priceText) : undefined;
  const images: string[] = ogImage ? [ogImage] : [];

  return { title: title || "Temu Product", price, description: ogDesc, images, currency: "USD", sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
}

// ─── Alibaba ──────────────────────────────────────────────────────────────────
function extractAlibaba($: ReturnType<typeof cheerio.load>, url: string, domain: string): ScrapedProduct {
  const title = $(".product-name, h1.title-text, .ma-title h1, h1").first().text().trim();
  const priceText = $(".price-range, .ma-ref-price, [class*='price']").first().text().trim();
  const price = priceText ? parsePrice(priceText) : undefined;
  const images: string[] = [];
  $(".img-list img, .gallery-thumbnail img, .image-view-item img, [class*='gallery'] img").each((_, el) => {
    const src = $(el).attr("src") ?? $(el).attr("data-src") ?? $(el).attr("data-lazy") ?? "";
    if (src && src.startsWith("http")) images.push(src);
  });
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage && !images.length) images.push(ogImage);
  const description = $(".detail-desc-decorate-richtext, .product-desc, .ma-description").first().text().trim().slice(0, 1000);
  const brand = $(".company-name, .seller-name a").first().text().trim() || undefined;
  const specs: Record<string, string> = {};
  $(".attribute-list .attribute-item, .spec-item").each((_, el) => {
    const label = $(el).find(".attribute-name, .spec-label").text().trim();
    const value = $(el).find(".attribute-value, .spec-value").text().trim();
    if (label && value) specs[label] = value;
  });
  return { title: title || "Alibaba Product", price, brand, description, images, specs, sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
}

// ─── eBay Listing ─────────────────────────────────────────────────────────────
function extractEbayListing($: ReturnType<typeof cheerio.load>, url: string, domain: string): ScrapedProduct {
  const title =
    $("h1.x-item-title__mainTitle span, .x-item-title span").text().replace(/^Details about\s*/i, "").trim() ||
    $("#itemTitle").text().replace(/^Details about\s*/i, "").trim();
  const priceText = $(".x-price-primary span, #prcIsum, .x-bin-price__content").first().text().trim();
  const price = priceText ? parsePrice(priceText) : undefined;
  const images: string[] = [];
  $(".ux-image-filmstrip-carousel-item img, #icImg, .image-treatment img").each((_, el) => {
    const src = $(el).attr("src") ?? $(el).attr("data-zoom-src") ?? $(el).attr("data-src") ?? "";
    if (src && src.startsWith("http") && !images.includes(src)) images.push(src);
  });
  const specs: Record<string, string> = {};
  $(".ux-labels-values, .itemAttr tr").each((_, el) => {
    const label = $(el).find(".ux-labels-values__labels-content, .attrLabels").text().trim();
    const value = $(el).find(".ux-labels-values__values-content, .attrValues").text().trim();
    if (label && value) specs[label] = value;
  });
  const description = $(".ux-seller-section__item--seller, #vi-desc-maincntr").text().trim().slice(0, 500) || undefined;
  return { title: title || "eBay Product", price, images, specs, description, sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
}

// ─── DHgate ───────────────────────────────────────────────────────────────────
function extractDHGate($: ReturnType<typeof cheerio.load>, url: string, domain: string): ScrapedProduct {
  const title = $("h1.product-name, .pd-head h1, h1").first().text().trim();
  const priceText = $(".price-num, .now-price, [class*='price']").first().text().trim();
  const price = priceText ? parsePrice(priceText) : undefined;
  const images: string[] = [];
  $(".pd-images img, .gallery-img img, .product-img img").each((_, el) => {
    const src = $(el).attr("src") ?? $(el).attr("data-original") ?? "";
    if (src && src.startsWith("http")) images.push(src);
  });
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage && !images.length) images.push(ogImage);
  const description = $('meta[property="og:description"]').attr("content") ?? "";
  return { title: title || "DHgate Product", price, description, images, sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
}

// ─── Wish ─────────────────────────────────────────────────────────────────────
function extractWish($: ReturnType<typeof cheerio.load>, html: string, url: string, domain: string): ScrapedProduct {
  const wishData = html.match(/"ProductDetails":\s*(\{[\s\S]*?\}),\s*"ProductTitle"/);
  if (wishData) {
    try {
      const d = JSON.parse(wishData[1]) as Record<string, unknown>;
      return {
        title: String(d.name ?? "Wish Product"),
        price: parseFloat(String(d.price ?? "0")) / 100 || undefined,
        images: [(d.main_image as { url: string })?.url].filter(Boolean) as string[],
        sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now(),
      };
    } catch { /* fall through */ }
  }
  const ogTitle = $('meta[property="og:title"]').attr("content") ?? "";
  const ogImage = $('meta[property="og:image"]').attr("content");
  const ogDesc = $('meta[property="og:description"]').attr("content") ?? "";
  const title = $("h1, .product-name").first().text().trim() || ogTitle;
  return { title: title || "Wish Product", description: ogDesc, images: ogImage ? [ogImage] : [], sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
}

// ─── SHEIN ────────────────────────────────────────────────────────────────────
function extractShein($: ReturnType<typeof cheerio.load>, html: string, url: string, domain: string): ScrapedProduct {
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const nd = JSON.parse(nextDataMatch[1]) as Record<string, unknown>;
      const props = (nd.props as Record<string, unknown>)?.pageProps as Record<string, unknown>;
      const detail = (props?.productInfo as Record<string, unknown>) ?? (props?.goods as Record<string, unknown>);
      if (detail) {
        const title = String(detail.goods_name ?? detail.productName ?? "");
        const price = parseFloat(String(detail.retailPrice ?? detail.salePrice ?? "0")) || undefined;
        const images: string[] = [];
        if (Array.isArray(detail.goods_imgs)) {
          (detail.goods_imgs as { original_image: string }[]).forEach(img => { if (img.original_image) images.push(img.original_image); });
        }
        if (title) return { title, price, images, currency: "USD", sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
      }
    } catch { /* fall through */ }
  }
  const ogTitle = $('meta[property="og:title"]').attr("content") ?? "";
  const ogImage = $('meta[property="og:image"]').attr("content");
  const title = $("h1.product-intro__head-name, .goods-name, h1").first().text().trim() || ogTitle;
  const priceText = $(".product-intro__head-price, .she-price-des").first().text().trim();
  return {
    title: title || "SHEIN Product",
    price: priceText ? parsePrice(priceText) : undefined,
    images: ogImage ? [ogImage] : [],
    currency: "USD",
    sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now(),
  };
}

// ─── Generic extractor (fallback for any site) ────────────────────────────────
function extractGeneric($: ReturnType<typeof cheerio.load>, html: string, url: string, domain: string): ScrapedProduct {
  // Try og: tags first (most reliable cross-site)
  const ogTitle   = $('meta[property="og:title"]').attr("content") ?? "";
  const ogDesc    = $('meta[property="og:description"]').attr("content") ?? "";
  const ogImage   = $('meta[property="og:image"]').attr("content");
  const ogPrice   = $('meta[property="product:price:amount"]').attr("content");
  const ogBrand   = $('meta[property="product:brand"]').attr("content") ??
                    $('meta[name="brand"]').attr("content");

  // Schema.org itemprop
  const itempropTitle = $('[itemprop="name"]').first().text().trim();
  const itempropPrice = $('[itemprop="price"]').first().attr("content") ?? $('[itemprop="price"]').first().text().trim();
  const itempropBrand = $('[itemprop="brand"]').first().text().trim();
  const itempropDesc  = $('[itemprop="description"]').first().text().trim();

  // DOM fallbacks
  const h1 = $("h1").first().text().trim();
  const domTitle = h1 || $("title").first().text().trim().split("|")[0].trim().split(" - ")[0].trim();

  // Price from common selectors
  const priceSelectors = [
    ".price", "[class*='price']", "[id*='price']", ".product-price",
    ".sale-price", ".current-price", "[data-price]",
  ];
  let domPrice = 0;
  for (const sel of priceSelectors) {
    const text = $(sel).first().text().trim();
    const p = parsePrice(text);
    if (p > 0) { domPrice = p; break; }
  }

  // Images
  const images: string[] = [];
  if (ogImage) images.push(ogImage);
  $(".product-image img, .gallery img, [class*='product'] img, [class*='gallery'] img, .main-image img").each((_, el) => {
    const src = $(el).attr("src") ?? $(el).attr("data-src") ?? $(el).attr("data-lazy") ?? "";
    if (src && src.startsWith("http") && !images.includes(src)) images.push(src);
  });

  // Specs from tables
  const specs: Record<string, string> = {};
  $("table tr, .spec-list li, [class*='spec'] li, dl dt").each((_, el) => {
    const cells = $(el).find("td, dd");
    if (cells.length >= 2) {
      const key = cells.first().text().trim();
      const val = cells.last().text().trim();
      if (key && val && key.length < 60 && key !== val) specs[key] = val;
    }
  });

  return {
    title: itempropTitle || ogTitle || domTitle || `Product from ${domain}`,
    description: itempropDesc || ogDesc || undefined,
    price: parseFloat(itempropPrice) || (ogPrice ? parsePrice(ogPrice) : undefined) || domPrice || undefined,
    brand: ogBrand || itempropBrand || undefined,
    images: images.slice(0, 10),
    specs,
    sourceUrl: url,
    sourceDomain: domain,
    scrapedAt: Date.now(),
  };
}

// ─── Keyword extractor ────────────────────────────────────────────────────────
export function extractKeywordsFromText(text: string): string[] {
  if (!text) return [];
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "for", "of", "with", "in", "to", "is", "are",
    "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "will", "would", "could", "should", "may", "might", "this", "that", "these",
    "those", "it", "its", "our", "your", "their", "we", "you", "they", "he", "she",
    "from", "by", "at", "on", "up", "out", "can", "not", "but", "all", "any",
    "also", "so", "if", "as", "into", "than", "then", "when", "where", "how",
    "product", "item", "buy", "sale", "new", "used", "free", "more", "size",
  ]);

  const wordFreq: Record<string, number> = {};
  text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .forEach(w => { wordFreq[w] = (wordFreq[w] ?? 0) + 1; });

  // Also extract bigrams
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (bigram.length > 5) wordFreq[bigram] = (wordFreq[bigram] ?? 0) + 0.5;
  }

  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
}
