/**
 * Universal Product Scraper — Advanced Multi-Strategy Engine
 * AliExpress, Amazon, Alibaba, Temu, eBay, and any product page
 * Strategies: JSON-LD → window vars → API endpoints → DOM selectors → meta tags
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

// Rotate user-agents to avoid blocks
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getHeaders(referer?: string): Record<string, string> {
  return {
    "User-Agent": randomUA(),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    ...(referer ? { "Referer": referer } : {}),
  };
}

export async function scrapeUrl(url: string): Promise<ScrapedProduct> {
  const domain = new URL(url).hostname.replace("www.", "");

  try {
    const res = await fetch(url, {
      headers: getHeaders(),
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} from ${domain}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    // Strategy 1: JSON-LD structured data (most reliable)
    const jsonLd = extractJsonLd($);
    if (jsonLd?.title) {
      const base = { ...jsonLd, sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
      // Supplement with domain-specific extras
      if (domain.includes("aliexpress")) return mergeWithAliExpress($, url, domain, base);
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

    // Strategy 3: Generic extraction with all fallbacks
    return extractGeneric($, html, url, domain);
  } catch (err) {
    const msg = (err as Error).message;
    // Some sites block; try without sec-fetch headers
    try {
      const res2 = await fetch(url, {
        headers: {
          "User-Agent": randomUA(),
          "Accept": "text/html,*/*;q=0.8",
          "Accept-Language": "en-GB,en;q=0.5",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
      const html = await res2.text();
      const $ = cheerio.load(html);
      if (domain.includes("aliexpress")) return extractAliExpress($, html, url, domain);
      if (domain.includes("temu")) return extractTemu($, html, url, domain);
      return extractGeneric($, html, url, domain);
    } catch {
      throw new Error(`Scrape failed for ${domain}: ${msg}`);
    }
  }
}

function extractJsonLd($: ReturnType<typeof cheerio.load>): Partial<ScrapedProduct> | null {
  try {
    const scripts = $('script[type="application/ld+json"]').toArray();
    for (const el of scripts) {
      const text = $(el).html() ?? "";
      try {
        const data = JSON.parse(text) as Record<string, unknown>;
        // Handle @graph arrays
        const items = data["@graph"] ? (data["@graph"] as Record<string, unknown>[]) : [data];
        for (const item of items) {
          if (item["@type"] === "Product" || (Array.isArray(item["@type"]) && (item["@type"] as string[]).includes("Product"))) {
            const offers = (item["offers"] as Record<string, unknown>) ?? {};
            const offerArr = Array.isArray(offers) ? (offers as Record<string, unknown>[])[0] : offers;
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
              currency: ((offerArr as Record<string, unknown>)?.["priceCurrency"] as string) ?? "GBP",
              images: images.filter(Boolean),
              sku: (item["sku"] as string) ?? (item["mpn"] as string) ?? undefined,
              availability: ((offerArr as Record<string, unknown>)?.["availability"] as string) ?? undefined,
              rating: parseFloat(String((item["aggregateRating"] as Record<string, unknown>)?.["ratingValue"] ?? "0")) || undefined,
              reviewCount: parseInt(String((item["aggregateRating"] as Record<string, unknown>)?.["reviewCount"] ?? "0")) || undefined,
            };
          }
        }
      } catch { /* try next script */ }
    }
  } catch { /* ignore */ }
  return null;
}

// ─── AliExpress ───────────────────────────────────────────────────────────────
// AliExpress is heavily JS-rendered; extract from embedded window data objects
function extractAliExpress($: ReturnType<typeof cheerio.load>, html: string, url: string, domain: string): ScrapedProduct {
  // Strategy 1: Extract from window.runParams (AliExpress embeds product data here)
  const runParamsMatch = html.match(/window\.runParams\s*=\s*(\{[\s\S]*?\});?\s*(?:window\.|var |<\/script>)/);
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
        (pm?.minActivityAmount as Record<string,unknown>)?.value ??
        pm?.formatedActivityPrice ??
        (pm?.minAmount as Record<string,unknown>)?.value ??
        "0"
      )) || undefined;
      const brand = (storeModule?.storeName as string) ?? undefined;

      if (title) {
        return { title, price, brand, images, specs, currency: "USD", sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
      }
    } catch { /* fall through */ }
  }

  // Strategy 2: window._dida_config_ or window.PageConfig
  const dataPatterns = [
    /window\._dida_config_\s*=\s*(\{[\s\S]*?\});/,
    /window\.PageConfig\s*=\s*(\{[\s\S]*?\});/,
    /"productId"\s*:\s*"?(\d+)"?/,
  ];

  // Strategy 3: DOM selectors (for SSR portions)
  const title = $(
    "h1.product-title-text, .pdp-mod-product-badge-title, h1[data-pl='product-title'], .product-title, [class*='title--'] h1, h1"
  ).first().text().trim();

  const priceText = $(
    ".product-price-value, .uniform-banner-box-price, .pdp-price, [class*='price--originalText'], [class*='Price--originalText'], .price-current"
  ).first().text().trim();
  const price = priceText ? parsePrice(priceText) : undefined;

  const images: string[] = [];
  $(".images-view-item img, .slider-item img, .image-view-item img, [class*='imageViewer'] img, .magnifier-image, .image-wrapper img").each((_, el) => {
    const src = $(el).attr("src") ?? $(el).attr("data-src") ?? $(el).attr("data-zoom-src") ?? "";
    if (src && src.length > 10) {
      const cleaned = src.replace(/^\/\//, "https://").replace(/_\d+x\d+\./, "_800x800.");
      if (!images.includes(cleaned)) images.push(cleaned);
    }
  });

  // Also extract from image list JSON in scripts
  const imgScriptMatch = html.match(/"imagePathList"\s*:\s*(\[[\s\S]*?\])/);
  if (imgScriptMatch) {
    try {
      const imgArr = JSON.parse(imgScriptMatch[1]) as string[];
      imgArr.forEach(src => {
        const clean = src.startsWith("//") ? `https:${src}` : src;
        if (!images.includes(clean)) images.push(clean);
      });
    } catch { /* ignore */ }
  }

  const specs: Record<string, string> = {};
  $(".product-prop-list li, .specification-keys .key-title, [class*='specList'] li, .detail-desc .spec-item").each((_, el) => {
    const text = $(el).text().trim();
    const colonIdx = text.indexOf(":");
    if (colonIdx > 0) {
      specs[text.slice(0, colonIdx).trim()] = text.slice(colonIdx + 1).trim();
    }
  });

  const description = $(".product-description, .detail-desc-decorate-richtext, [class*='descriptionModule']").first().text().trim().slice(0, 1000);
  const brand = $("[class*='store-header'] span, .store-info span").first().text().trim() || undefined;

  return { title: title || "AliExpress Product", price, brand, description, images, specs, currency: "USD", sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
}

function mergeWithAliExpress($: ReturnType<typeof cheerio.load>, url: string, domain: string, base: Partial<ScrapedProduct>): ScrapedProduct {
  // Fill in missing images from DOM if JSON-LD didn't get them
  if (!base.images?.length) {
    const images: string[] = [];
    $(".images-view-item img, .slider-item img").each((_, el) => {
      const src = $(el).attr("src") ?? $(el).attr("data-src") ?? "";
      if (src) images.push(src.replace(/^\/\//, "https://"));
    });
    base.images = images;
  }
  return { ...base, sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() } as ScrapedProduct;
}

// ─── Temu ─────────────────────────────────────────────────────────────────────
function extractTemu($: ReturnType<typeof cheerio.load>, html: string, url: string, domain: string): ScrapedProduct {
  // Temu embeds data in window.__NEXT_DATA__ or similar
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
          (goodsDetail.carouselGallery as { url: string }[]).forEach(img => {
            if (img.url) images.push(img.url);
          });
        }
        const specs: Record<string, string> = {};
        if (Array.isArray(goodsDetail.attributeList)) {
          (goodsDetail.attributeList as { key: string; value: string }[]).forEach(attr => {
            specs[attr.key] = attr.value;
          });
        }
        const description = (goodsDetail.goodsDesc as string) ?? "";
        return { title, price, images, specs, description, currency: "USD", sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
      }
    } catch { /* fall through */ }
  }

  // DOM fallback for Temu
  const title = $("h1[data-testid='product-title'], .product-title, .goods-name, h1").first().text().trim();
  const priceText = $("[data-testid='product-price'], .price-content, .current-price").first().text().trim();
  const price = priceText ? parsePrice(priceText) : undefined;
  const images: string[] = [];
  $(".goods-image img, .product-image img, [data-testid*='image'] img, .carousel img").each((_, el) => {
    const src = $(el).attr("src") ?? $(el).attr("data-src") ?? "";
    if (src && src.startsWith("http")) images.push(src);
  });
  const description = $(".goods-description, .product-desc").first().text().trim().slice(0, 1000);
  const brand = $("[data-testid='brand-name'], .brand-name").first().text().trim() || undefined;

  // Also try og: tags
  const ogTitle = $('meta[property="og:title"]').attr("content") ?? "";
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage && !images.length) images.push(ogImage);

  return {
    title: title || ogTitle || "Temu Product",
    price, brand, description, images, currency: "USD",
    sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now(),
  };
}

// ─── Alibaba ─────────────────────────────────────────────────────────────────
function extractAlibaba($: ReturnType<typeof cheerio.load>, url: string, domain: string): ScrapedProduct {
  const title = $(".product-name, h1.title-text, .ma-title h1, h1").first().text().trim();
  const priceText = $(".price-range, .ma-ref-price, [class*='price']").first().text().trim();
  const price = priceText ? parsePrice(priceText) : undefined;
  const images: string[] = [];
  $(".img-list img, .gallery-thumbnail img, .image-view-item img, [class*='gallery'] img").each((_, el) => {
    const src = $(el).attr("src") ?? $(el).attr("data-src") ?? $(el).attr("data-lazy") ?? "";
    if (src && src.startsWith("http")) images.push(src);
  });
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

// ─── Amazon ──────────────────────────────────────────────────────────────────
function extractAmazon($: ReturnType<typeof cheerio.load>, url: string, domain: string): ScrapedProduct {
  const title = $("#productTitle").text().trim() || $('meta[name="title"]').attr("content") || "";
  const priceText = $(".a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice, .reinventPricePriceToPayMargin span").first().text().trim();
  const price = priceText ? parsePrice(priceText) : undefined;
  const brand = $("#bylineInfo, #brand, .po-brand .po-break-word").first().text().replace(/Visit|Store|Brand:|\s+/gi, " ").trim() || undefined;

  const images: string[] = [];
  // Amazon puts high-res images in a JS variable
  const landingImageMatch = $('script:not([src])').toArray().find(s => $(s).html()?.includes("ImageBlockATF"));
  if (landingImageMatch) {
    const matches = $(landingImageMatch).html()?.matchAll(/"hiRes"\s*:\s*"([^"]+)"/g) ?? [];
    for (const m of matches) {
      if (m[1] && !images.includes(m[1])) images.push(m[1]);
    }
  }
  // Fallback DOM images
  if (!images.length) {
    $(".a-dynamic-image, #imgBlkFront, .image-block img, #landingImage").each((_, el) => {
      const src = $(el).attr("src") ?? "";
      if (src && src.includes("images/I") && !images.includes(src)) images.push(src);
    });
  }

  const specs: Record<string, string> = {};
  $("#productOverview_feature_div tr, #detailBullets_feature_div li, .a-expander-content tr").each((_, el) => {
    const cells = $(el).find("td, th, span").toArray();
    if (cells.length >= 2) {
      const key = $(cells[0]).text().trim().replace(/[:\n]/g, "");
      const val = $(cells[1]).text().trim().replace(/\n/g, " ");
      if (key && val && key.length < 50) specs[key] = val;
    }
  });
  $(".a-list-item span.a-text-bold").each((_, el) => {
    const key = $(el).text().trim().replace(":", "");
    const val = $(el).next().text().trim();
    if (key && val) specs[key] = val;
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

// ─── eBay ────────────────────────────────────────────────────────────────────
function extractEbayListing($: ReturnType<typeof cheerio.load>, url: string, domain: string): ScrapedProduct {
  const title = $("h1.x-item-title__mainTitle span, #itemTitle, .x-item-title span").text().replace(/^Details about\s*/i, "").trim();
  const priceText = $(".x-price-primary span, #prcIsum, .x-bin-price__content").first().text().trim();
  const price = priceText ? parsePrice(priceText) : undefined;
  const images: string[] = [];
  $(".ux-image-filmstrip-carousel-item img, #icImg, .image-treatment img").each((_, el) => {
    const src = $(el).attr("src") ?? $(el).attr("data-zoom-src") ?? $(el).attr("data-src") ?? "";
    if (src && src.startsWith("http") && !images.includes(src)) images.push(src);
  });
  const specs: Record<string, string> = {};
  $(".ux-labels-values__labels, .itemAttr tr").each((_, el) => {
    const label = $(el).find(".ux-labels-values__labels-content, .attrLabels").text().trim();
    const value = $(el).find(".ux-labels-values__values-content, .attrValues").text().trim();
    if (label && value) specs[label] = value;
  });
  const description = $(".ux-seller-section__item--seller, #vi-desc-maincntr").text().trim().slice(0, 500) || undefined;
  return { title: title || "eBay Product", price, images, specs, description, sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
}

// ─── DHgate ──────────────────────────────────────────────────────────────────
function extractDHGate($: ReturnType<typeof cheerio.load>, url: string, domain: string): ScrapedProduct {
  const title = $("h1.product-name, .pd-head h1, h1").first().text().trim();
  const priceText = $(".price-num, .now-price, [class*='price']").first().text().trim();
  const price = priceText ? parsePrice(priceText) : undefined;
  const images: string[] = [];
  $(".pd-images img, .gallery-img img, .product-img img").each((_, el) => {
    const src = $(el).attr("src") ?? $(el).attr("data-original") ?? "";
    if (src && src.startsWith("http")) images.push(src);
  });
  return { title: title || "DHgate Product", price, images, sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
}

// ─── Wish ────────────────────────────────────────────────────────────────────
function extractWish($: ReturnType<typeof cheerio.load>, html: string, url: string, domain: string): ScrapedProduct {
  // Wish uses React; try extracting from window data
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
  const title = $("h1, .product-name").first().text().trim();
  const ogImage = $('meta[property="og:image"]').attr("content");
  return { title: title || "Wish Product", images: ogImage ? [ogImage] : [], sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
}

// ─── SHEIN ───────────────────────────────────────────────────────────────────
function extractShein($: ReturnType<typeof cheerio.load>, html: string, url: string, domain: string): ScrapedProduct {
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]) as Record<string, unknown>;
      const detail = ((data.props as Record<string, unknown>)?.pageProps as Record<string, unknown>)?.detail as Record<string, unknown>;
      if (detail) {
        const title = (detail.goods_name as string) ?? "";
        const price = parseFloat(String(detail.retailPrice ?? detail.salePrice ?? "0")) || undefined;
        const images: string[] = ((detail.goods_imgs as { origin_image: string }[]) ?? []).map(i => i.origin_image).filter(Boolean);
        return { title, price, images, currency: "GBP", sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
      }
    } catch { /* fall through */ }
  }
  const title = $(".product-intro__head-name, h1").first().text().trim();
  const ogImage = $('meta[property="og:image"]').attr("content");
  return { title: title || "SHEIN Product", images: ogImage ? [ogImage] : [], sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now() };
}

// ─── Generic fallback ────────────────────────────────────────────────────────
function extractGeneric($: ReturnType<typeof cheerio.load>, html: string, url: string, domain: string): ScrapedProduct {
  const title =
    $('meta[property="og:title"]').attr("content") ??
    $("h1.product-title, h1.title, h1[itemprop='name'], h1").first().text().trim() ??
    $("title").text().split("|")[0].trim();

  const description =
    $('meta[property="og:description"]').attr("content") ??
    $('meta[name="description"]').attr("content") ??
    $("[itemprop='description'], .product-description, .description").first().text().trim().slice(0, 600);

  // Collect images — og:image first, then product/item-related
  const images: string[] = [];
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage) images.push(ogImage);

  $("img[itemprop='image'], [class*='product'] img, [class*='gallery'] img, [class*='image'] img, [class*='photo'] img").each((_, el) => {
    const src = $(el).attr("src") ?? $(el).attr("data-src") ?? $(el).attr("data-lazy-src") ?? "";
    if (src.startsWith("http") && !images.includes(src) && images.length < 10) {
      // Filter out tiny icons/logos
      const w = parseInt($(el).attr("width") ?? "0");
      const h = parseInt($(el).attr("height") ?? "0");
      if ((w === 0 || w > 100) && (h === 0 || h > 100)) images.push(src);
    }
  });

  // Try window.__NEXT_DATA__ or similar embedded JSON
  const nextMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (nextMatch && images.length < 2) {
    try {
      const data = JSON.parse(nextMatch[1]) as Record<string, unknown>;
      const dataStr = JSON.stringify(data);
      const imgMatches = dataStr.matchAll(/"(?:image|photo|thumbnail|src)"\s*:\s*"(https?:\/\/[^"]+\.(jpg|jpeg|png|webp)[^"]*)"/gi);
      for (const m of imgMatches) {
        if (m[1] && !images.includes(m[1]) && images.length < 8) images.push(m[1]);
      }
    } catch { /* ignore */ }
  }

  const priceText = $(
    "[itemprop='price'], [class*='price'], [id*='price'], .cost, .rate"
  ).first().text().trim();
  const price = priceText ? parsePrice(priceText) : undefined;

  const brand =
    $("[itemprop='brand'], [class*='brand'], [id*='brand']").first().text().trim() ||
    $('meta[name="brand"]').attr("content") || undefined;

  const specs: Record<string, string> = {};
  $("table.specifications tr, .spec-table tr, [class*='spec'] tr").each((_, el) => {
    const cells = $(el).find("td, th").toArray();
    if (cells.length >= 2) {
      const k = $(cells[0]).text().trim().replace(":", "");
      const v = $(cells[1]).text().trim();
      if (k && v && k.length < 60) specs[k] = v;
    }
  });

  return {
    title: (typeof title === "string" ? title : "") || "Product",
    description: typeof description === "string" ? description : undefined,
    price, brand, images, specs,
    sourceUrl: url, sourceDomain: domain, scrapedAt: Date.now(),
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function parsePrice(raw: string): number {
  const s = raw.replace(/[^0-9.,]/g, "").trim();
  if (!s) return 0;
  if (s.includes(",") && s.includes(".")) {
    return parseFloat(s.lastIndexOf(".") > s.lastIndexOf(",")
      ? s.replace(/,/g, "")
      : s.replace(/\./g, "").replace(",", ".")) || 0;
  }
  if (s.includes(",") && !s.includes(".")) {
    const after = s.split(",")[1] ?? "";
    return parseFloat(after.length <= 2 ? s.replace(",", ".") : s.replace(/,/g, "")) || 0;
  }
  return parseFloat(s) || 0;
}

export function extractKeywordsFromText(text: string): string[] {
  const stopWords = new Set(["the","a","an","and","or","but","in","on","at","to","for","of","with","by","this","that","is","are","was","were","be","been","have","has","do","does","will","would","can","could","from","it","its","you","your","we","our","they","their","he","she","has","not","no","so","if","than","then","when","where","how"]);
  const words = text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  const freq: Record<string, number> = {};
  words.forEach(w => { freq[w] = (freq[w] ?? 0) + 1; });
  return Object.entries(freq).filter(([, c]) => c >= 1).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([w]) => w);
}
