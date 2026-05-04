import { Router } from "express";
import { z } from "zod";

const router = Router();

// ── Helpers ─────────────────────────────────────────────────────────────────

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xhtml+xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
};

function extractImages(html: string, baseUrl: string): string[] {
  const images = new Set<string>();
  const base = new URL(baseUrl);
  const origin = base.origin;

  // img src tags
  const imgSrcRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgSrcRe.exec(html)) !== null) {
    const src = m[1];
    if (src && !src.startsWith("data:")) images.add(resolveUrl(src, origin, base.href));
  }

  // img data-src (lazy loading)
  const dataSrcRe = /<img[^>]+data-src=["']([^"']+)["'][^>]*>/gi;
  while ((m = dataSrcRe.exec(html)) !== null) {
    const src = m[1];
    if (src && !src.startsWith("data:")) images.add(resolveUrl(src, origin, base.href));
  }

  // data-zoom-image (AliExpress)
  const zoomRe = /data-zoom-image=["']([^"']+)["']/gi;
  while ((m = zoomRe.exec(html)) !== null) {
    const src = m[1];
    if (src) images.add(resolveUrl(src, origin, base.href));
  }

  // srcset
  const srcsetRe = /srcset=["']([^"']+)["']/gi;
  while ((m = srcsetRe.exec(html)) !== null) {
    const parts = m[1].split(",").map(s => s.trim().split(/\s+/)[0]).filter(Boolean);
    parts.forEach(src => {
      if (src && !src.startsWith("data:")) images.add(resolveUrl(src, origin, base.href));
    });
  }

  // JSON image URLs in script tags (AliExpress / shopify)
  const jsonImgRe = /"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp|avif)[^"]*)"/gi;
  while ((m = jsonImgRe.exec(html)) !== null) {
    const src = m[1];
    if (src && src.length < 500) images.add(src);
  }

  // og:image
  const ogRe = /property=["']og:image["'][^>]+content=["']([^"']+)["']/gi;
  while ((m = ogRe.exec(html)) !== null) {
    images.add(m[1]);
  }

  return [...images].filter(url => isImageUrl(url));
}

function isImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return /\.(jpe?g|png|webp|avif|gif|bmp)(\?|$)/i.test(u.pathname) ||
      u.hostname.includes("aliexpress") ||
      u.hostname.includes("ae01.alicdn") ||
      u.hostname.includes("ae02.alicdn") ||
      u.hostname.includes("ae03.alicdn") ||
      u.hostname.includes("ae04.alicdn") ||
      u.hostname.includes("amazon") ||
      u.hostname.includes("ebayimg") ||
      u.hostname.includes("media-amazon") ||
      u.hostname.includes("shopify");
  } catch {
    return false;
  }
}

function resolveUrl(src: string, origin: string, base: string): string {
  try {
    if (src.startsWith("http")) return src;
    if (src.startsWith("//")) return `https:${src}`;
    if (src.startsWith("/")) return `${origin}${src}`;
    return new URL(src, base).href;
  } catch {
    return src;
  }
}

// ── AliExpress specific ──────────────────────────────────────────────────────

function parseAliExpress(html: string): { title: string; images: string[]; price: string; rating: string } {
  const title = (/<h1[^>]*>([^<]+)<\/h1>/i.exec(html)?.[1] ?? "").trim()
    || (/,"subject":"([^"]+)"/i.exec(html)?.[1] ?? "").trim();

  const price = (/,"minActivityAmount":\{"value":"([^"]+)"/i.exec(html)?.[1] ?? "")
    || (/class="[^"]*price[^"]*"[^>]*>([^<]+)</i.exec(html)?.[1] ?? "").trim();

  const rating = (/,"averageStar":"([^"]+)"/i.exec(html)?.[1] ?? "").trim();

  // Extract image list from window.runParams / _dlt_data
  const imgListRe = /"imagePathList":\["([^"]+)"((?:,"[^"]+")*)]/i;
  const imgMatch = imgListRe.exec(html);
  const images: string[] = [];

  if (imgMatch) {
    images.push(imgMatch[1].replace(/\\/g, ""));
    const rest = imgMatch[2];
    const moreRe = /"([^"]+)"/g;
    let mm: RegExpExecArray | null;
    while ((mm = moreRe.exec(rest)) !== null) {
      images.push(mm[1].replace(/\\/g, ""));
    }
  }

  // Also extract from HTML img tags for alicdn
  const aliRe = /https?:\/\/ae\d+\.alicdn\.com\/kf\/[^"'\s]+/gi;
  let am: RegExpExecArray | null;
  while ((am = aliRe.exec(html)) !== null) {
    const clean = am[0].replace(/\\u002F/g, "/").split(/['"]/)[0];
    if (clean.length < 300) images.push(clean);
  }

  return { title, images: [...new Set(images)], price, rating };
}

function parseEbay(html: string): { title: string; images: string[]; price: string } {
  const title = (/<h1[^>]*class="[^"]*x-item-title__mainTitle[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i.exec(html)?.[1] ?? "").trim()
    || (/<h1[^>]*itemprop="name"[^>]*>([^<]+)<\/h1>/i.exec(html)?.[1] ?? "").trim();

  const price = (/class="[^"]*notranslate[^"]*"[^>]*>([^<]+)<\/span>/i.exec(html)?.[1] ?? "").trim();

  const images: string[] = [];
  const ebayImgRe = /https?:\/\/i\.ebayimg\.com\/[^\s"'<>]+/gi;
  let em: RegExpExecArray | null;
  while ((em = ebayImgRe.exec(html)) !== null) {
    images.push(em[0].split(/['"]/)[0]);
  }

  return { title, images: [...new Set(images)], price };
}

function parseAmazon(html: string): { title: string; images: string[]; price: string } {
  const title = (/<span id="productTitle"[^>]*>([^<]+)<\/span>/i.exec(html)?.[1] ?? "").trim();
  const price = (/<span class="[^"]*a-price-whole[^"]*"[^>]*>([^<]+)<\/span>/i.exec(html)?.[1] ?? "").trim();

  const images: string[] = [];
  const amzRe = /https?:\/\/m\.media-amazon\.com\/images\/[^\s"'<>]+/gi;
  let am2: RegExpExecArray | null;
  while ((am2 = amzRe.exec(html)) !== null) {
    images.push(am2[0].split(/['"]/)[0]);
  }

  return { title, images: [...new Set(images)], price };
}

// ── Detect platform ───────────────────────────────────────────────────────────

function detectPlatform(url: string): "aliexpress" | "ebay" | "amazon" | "generic" {
  if (url.includes("aliexpress.com")) return "aliexpress";
  if (url.includes("ebay.com") || url.includes("ebay.co.")) return "ebay";
  if (url.includes("amazon.com") || url.includes("amazon.co.")) return "amazon";
  return "generic";
}

// ── Route: GET /api/tools/scrape ─────────────────────────────────────────────

const ScrapeQuery = z.object({
  url: z.string().url(),
  maxImages: z.coerce.number().int().min(1).max(200).default(50),
});

router.get("/tools/scrape", async (req, res) => {
  const parsed = ScrapeQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid URL", details: parsed.error.issues });
    return;
  }
  const { url, maxImages } = parsed.data;

  try {
    const platform = detectPlatform(url);

    // Fetch the page
    const pageRes = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    });

    if (!pageRes.ok) {
      res.status(502).json({ error: `Failed to fetch page (HTTP ${pageRes.status}). Some sites block scrapers.` });
      return;
    }

    const html = await pageRes.text();
    let title = "";
    let price = "";
    let rating = "";
    let images: string[] = [];

    if (platform === "aliexpress") {
      const parsed2 = parseAliExpress(html);
      title = parsed2.title;
      price = parsed2.price;
      rating = parsed2.rating;
      images = parsed2.images;
      if (!images.length) images = extractImages(html, url);
    } else if (platform === "ebay") {
      const parsed2 = parseEbay(html);
      title = parsed2.title;
      price = parsed2.price;
      images = parsed2.images;
      if (!images.length) images = extractImages(html, url);
    } else if (platform === "amazon") {
      const parsed2 = parseAmazon(html);
      title = parsed2.title;
      price = parsed2.price;
      images = parsed2.images;
      if (!images.length) images = extractImages(html, url);
    } else {
      images = extractImages(html, url);
      // Try to get title from <title> tag
      title = (/<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1] ?? "").trim();
    }

    // Filter to only high-res/product images and deduplicate
    images = [...new Set(images)]
      .filter(img => {
        // Exclude small icons, logos, tracking pixels
        if (img.includes("icon") || img.includes("logo") || img.includes("pixel") || img.includes("badge")) return false;
        if (img.includes("1x1") || img.includes("blank")) return false;
        return true;
      })
      .slice(0, maxImages);

    res.json({
      success: true,
      platform,
      url,
      title: title.slice(0, 200),
      price,
      rating,
      images,
      count: images.length,
    });
  } catch (err) {
    req.log.error({ err, url }, "Scrape failed");
    const msg = String(err);
    if (msg.includes("timeout") || msg.includes("TimeoutError")) {
      res.status(504).json({ error: "Page took too long to load. Try again or use a different URL." });
    } else {
      res.status(500).json({ error: "Scraping failed. The site may block automated access.", message: msg });
    }
  }
});

// ── Route: POST /api/tools/scrape/fetch-image ─────────────────────────────────
// Proxies an image through our server (bypasses CORS for client-side fetch)

const FetchImageBody = z.object({ imageUrl: z.string().url() });

router.post("/tools/scrape/fetch-image", async (req, res) => {
  const parsed = FetchImageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid URL" }); return; }

  try {
    const imgRes = await fetch(parsed.data.imageUrl, {
      headers: { ...BROWSER_HEADERS, Accept: "image/*,*/*" },
      signal: AbortSignal.timeout(15000),
    });
    if (!imgRes.ok) {
      res.status(502).json({ error: `Image fetch failed: HTTP ${imgRes.status}` });
      return;
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const b64 = buf.toString("base64");
    res.json({ imageData: `data:${contentType};base64,${b64}`, sizeBytes: buf.length });
  } catch (err) {
    res.status(500).json({ error: "Image fetch failed", message: String(err) });
  }
});

export default router;
