/**
 * eBay Optimization Engine
 * Generates eBay-compliant titles, descriptions, item specifics, and SEO keywords.
 * Everything here is eBay-first, no generic marketplace logic.
 */

export interface ProductInput {
  title?: string;
  description?: string;
  price?: number | string;
  specs?: Record<string, string>;
  category?: string;
  brand?: string;
  condition?: string;
  images?: string[];
  platform?: "aliexpress" | "ebay" | "amazon" | "generic";
}

export interface EbayOptimizedListing {
  title: string;
  titleScore: number;        // 0-100 quality score
  titleAlternatives: string[];
  description: string;       // Mobile-friendly HTML
  itemSpecifics: Record<string, string>;
  seoKeywords: string[];
  categoryId: string;
  conditionId: string;
  priceRecommendation: { min: number; max: number; suggested: number } | null;
  complianceWarnings: string[];
  ctxScore: number;          // CTR/conversion prediction 0-100
}

// ── eBay banned keyword patterns ─────────────────────────────────────────────
const BANNED_PATTERNS = [
  /see desc/i, /as seen on tv/i, /brand new in box.*cheap/i,
  /!!!+/, /\$\$\$/, /best ever/, /guaranteed sale/i,
  /free gift/i, /click here/i, /visit my store/i,
  /buy it now.*only/i, /limited time/i,
];

// ── eBay high-value stop words to exclude from title ─────────────────────────
const TITLE_STOP_WORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "are", "was",
  "very", "great", "best", "good", "nice", "beautiful", "amazing",
  "awesome", "perfect", "excellent", "high", "quality", "new",
]);

// ── eBay category map (common) ────────────────────────────────────────────────
const CATEGORY_MAP: Array<{ keywords: string[]; id: string; name: string }> = [
  { keywords: ["phone", "iphone", "samsung", "mobile", "smartphone"], id: "9355", name: "Cell Phones & Smartphones" },
  { keywords: ["laptop", "notebook", "macbook", "chromebook"], id: "177", name: "Laptops & Netbooks" },
  { keywords: ["tablet", "ipad", "kindle", "ereader"], id: "171485", name: "Tablets & eBook Readers" },
  { keywords: ["watch", "smartwatch", "fitbit", "garmin"], id: "14324", name: "Smart Watches" },
  { keywords: ["headphone", "earphone", "earbud", "airpod"], id: "112529", name: "Headphones" },
  { keywords: ["camera", "dslr", "mirrorless", "lens", "gopro"], id: "625", name: "Digital Cameras" },
  { keywords: ["shoe", "sneaker", "boot", "sandal", "trainer"], id: "3034", name: "Athletic Shoes" },
  { keywords: ["shirt", "tshirt", "hoodie", "jacket", "dress", "clothing"], id: "1059", name: "Men's Clothing" },
  { keywords: ["toy", "lego", "action figure", "doll", "game", "puzzle"], id: "220", name: "Toys & Hobbies" },
  { keywords: ["necklace", "bracelet", "ring", "earring", "jewelry"], id: "10968", name: "Fine Jewelry" },
  { keywords: ["bag", "backpack", "purse", "handbag", "wallet"], id: "169291", name: "Bags & Accessories" },
  { keywords: ["supplement", "vitamin", "protein", "health", "fitness"], id: "180959", name: "Vitamins & Supplements" },
  { keywords: ["tool", "drill", "saw", "wrench", "screwdriver", "power tool"], id: "631", name: "Power Tools" },
  { keywords: ["light", "led", "bulb", "lamp", "lighting"], id: "1063", name: "Lamps, Lighting & Ceiling Fans" },
  { keywords: ["kitchen", "cookware", "pan", "pot", "blender", "coffee"], id: "20625", name: "Kitchen & Dining" },
  { keywords: ["car", "auto", "vehicle", "motor", "exhaust", "brake"], id: "6000", name: "Auto Parts & Accessories" },
  { keywords: ["game", "playstation", "xbox", "nintendo", "controller"], id: "1249", name: "Video Games & Consoles" },
  { keywords: ["book", "novel", "textbook", "manga"], id: "267", name: "Books" },
];

const CONDITION_MAP: Record<string, string> = {
  "new": "1000",
  "like new": "2000",
  "very good": "3000",
  "good": "4000",
  "acceptable": "5000",
  "for parts": "7000",
  "refurbished": "2500",
};

// ── Detect eBay category from title/specs ─────────────────────────────────────
export function detectCategory(text: string): { id: string; name: string } {
  const lower = text.toLowerCase();
  for (const cat of CATEGORY_MAP) {
    if (cat.keywords.some(kw => lower.includes(kw))) {
      return { id: cat.id, name: cat.name };
    }
  }
  return { id: "99", name: "Everything Else" };
}

// ── eBay Title Generator (80-char max, keyword-first) ────────────────────────
export function generateEbayTitle(input: ProductInput): { title: string; score: number; alternatives: string[] } {
  const rawTitle = input.title ?? "";
  const brand = input.brand ?? "";
  const condition = input.condition ?? "New";

  // Extract meaningful keywords, remove stop words
  const words = rawTitle
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !TITLE_STOP_WORDS.has(w.toLowerCase()))
    .map(w => w.charAt(0).toUpperCase() + w.slice(1));

  // eBay title structure: Brand + Core Keywords + Condition/Model + Key Spec
  const parts: string[] = [];

  // Add brand if not already in title
  if (brand && !rawTitle.toLowerCase().includes(brand.toLowerCase())) {
    parts.push(brand);
  }

  // Add top keywords (most relevant first)
  for (const w of words) {
    const candidate = [...parts, w].join(" ");
    if (candidate.length <= 74) parts.push(w);
    else break;
  }

  // Add condition if it fits and isn't already there
  const conditionWord = condition.charAt(0).toUpperCase() + condition.slice(1);
  if (![...parts].join(" ").toLowerCase().includes(conditionWord.toLowerCase())) {
    const withCond = [...parts, conditionWord].join(" ");
    if (withCond.length <= 80) parts.push(conditionWord);
  }

  let title = parts.join(" ").slice(0, 80).trim();

  // Score the title (0-100)
  let score = 0;
  if (title.length >= 40) score += 25;
  if (title.length >= 60) score += 15;
  if (title.length <= 80) score += 10;
  if (brand && title.toLowerCase().includes(brand.toLowerCase())) score += 15;
  if (words.length >= 5) score += 15;
  if (!BANNED_PATTERNS.some(p => p.test(title))) score += 20;
  score = Math.min(100, score);

  // Generate 2 alternative titles
  const alt1 = rawTitle.replace(/[^\w\s,()-]/g, "").slice(0, 80).trim();
  const specStr = Object.entries(input.specs ?? {}).slice(0, 2).map(([k, v]) => `${v} ${k}`).join(" ");
  const alt2 = `${brand} ${words.slice(0, 5).join(" ")} ${specStr}`.slice(0, 80).trim();

  return { title, score, alternatives: [alt1, alt2].filter(a => a.length > 10) };
}

// ── eBay Description Generator (HTML, mobile-first) ──────────────────────────
export function generateEbayDescription(input: ProductInput): string {
  const title = input.title ?? "Product";
  const specs = input.specs ?? {};
  const price = input.price;
  const brand = input.brand ?? "Unknown Brand";
  const condition = input.condition ?? "New";

  const specRows = Object.entries(specs)
    .slice(0, 12)
    .map(([k, v]) => `<tr><td style="padding:8px 12px;font-weight:600;white-space:nowrap;width:40%">${k}</td><td style="padding:8px 12px">${v}</td></tr>`)
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:16px;color:#333;font-size:15px;line-height:1.6}
  h2{font-size:20px;color:#1a1a1a;border-bottom:2px solid #e53238;padding-bottom:8px}
  h3{font-size:16px;color:#555;margin-top:20px}
  ul{padding-left:20px}
  li{margin:6px 0}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  tr:nth-child(even){background:#f9f9f9}
  td{border:1px solid #e0e0e0;font-size:14px}
  .badge{display:inline-block;padding:4px 10px;border-radius:4px;font-size:13px;font-weight:600;margin:4px}
  .badge-green{background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7}
  .badge-blue{background:#e3f2fd;color:#1565c0;border:1px solid #90caf9}
  .trust{background:#fff8e1;border:1px solid #ffe082;padding:12px 16px;border-radius:6px;margin:16px 0}
  .ship{background:#e8f5e9;border:1px solid #a5d6a7;padding:12px 16px;border-radius:6px;margin:16px 0}
  @media(max-width:500px){body{padding:10px}h2{font-size:17px}}
</style>
</head>
<body>

<h2>${title}</h2>

<p>
  <span class="badge badge-blue">Condition: ${condition}</span>
  <span class="badge badge-green">Brand: ${brand}</span>
  ${price ? `<span class="badge badge-green">Price: $${price}</span>` : ""}
</p>

<h3>Key Features</h3>
<ul>
  ${Object.entries(specs).slice(0, 6).map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`).join("\n  ")}
  <li>Ready to use — no setup required</li>
  <li>Fully tested and quality checked before dispatch</li>
</ul>

${specRows ? `<h3>Full Specifications</h3>
<table>
${specRows}
</table>` : ""}

<div class="trust">
  <strong>Why Buy From Us?</strong><br>
  Trusted seller &bull; 100% authentic products &bull; Secure payment &bull; Professional packaging
</div>

<div class="ship">
  <strong>Shipping &amp; Returns</strong><br>
  Fast dispatch &bull; Tracked delivery &bull; 30-day return policy &bull; Full buyer protection
</div>

<h3>Compatibility &amp; Notes</h3>
<p>
  Please check specifications carefully before purchasing.
  If you have any questions, please contact us before ordering — we respond within 24 hours.
</p>

<p style="font-size:12px;color:#888;margin-top:24px">
  All images are of actual product. Minor color differences may occur due to monitor settings.
  Stock photos may be used for variation listings.
</p>

</body>
</html>`;
}

// ── Item Specifics Generator ──────────────────────────────────────────────────
export function generateItemSpecifics(input: ProductInput): Record<string, string> {
  const specs: Record<string, string> = {};

  if (input.brand) specs["Brand"] = input.brand;
  specs["Condition"] = input.condition ?? "New";

  // Detect Type from category
  const cat = detectCategory(input.title ?? "");
  if (cat.name !== "Everything Else") specs["Type"] = cat.name.split("&")[0].trim();

  // Add from provided specs
  const specAliases: Record<string, string> = {
    color: "Color", colour: "Color", size: "Size", weight: "Item Weight",
    material: "Material", model: "Model", mpn: "MPN", ean: "EAN",
    upc: "UPC", isbn: "ISBN", compatibility: "Compatible With",
    style: "Style", pattern: "Pattern", department: "Department",
    gender: "For", age: "Age Group", country: "Country/Region of Manufacture",
  };
  for (const [key, val] of Object.entries(input.specs ?? {})) {
    const ebayKey = specAliases[key.toLowerCase()] ?? key.charAt(0).toUpperCase() + key.slice(1);
    if (val && val.length < 65) specs[ebayKey] = val;
  }

  specs["Seller Notes"] = "Item in excellent condition. See description for full details.";

  return specs;
}

// ── SEO Keyword Generator ─────────────────────────────────────────────────────
export function generateSeoKeywords(input: ProductInput): string[] {
  const baseText = `${input.title ?? ""} ${input.brand ?? ""} ${Object.values(input.specs ?? {}).join(" ")}`;
  const words = baseText
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !TITLE_STOP_WORDS.has(w));

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);

  const keywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);

  // Add category-relevant power keywords
  const cat = detectCategory(input.title ?? "");
  const catKeywords = CATEGORY_MAP.find(c => c.id === cat.id)?.keywords ?? [];
  const merged = [...new Set([...catKeywords, ...keywords])].slice(0, 20);

  return merged;
}

// ── Compliance Checker ────────────────────────────────────────────────────────
export function checkCompliance(listing: { title: string; description: string }): string[] {
  const warnings: string[] = [];
  if (listing.title.length > 80) warnings.push("Title exceeds 80 characters — eBay will truncate");
  BANNED_PATTERNS.forEach(p => {
    if (p.test(listing.title) || p.test(listing.description)) {
      warnings.push(`Potential banned pattern detected: "${p.source}"`);
    }
  });
  if (/off.*ebay|website|www\.|http/i.test(listing.description)) {
    warnings.push("External links detected — prohibited on eBay descriptions");
  }
  if (/contact.*outside.*ebay/i.test(listing.description)) {
    warnings.push("Off-platform contact request — violates eBay policy");
  }
  return warnings;
}

// ── CTR/Conversion Score ──────────────────────────────────────────────────────
export function scoreCtr(listing: EbayOptimizedListing): number {
  let score = 0;
  if (listing.title.length >= 60) score += 20;
  if (listing.titleScore >= 70) score += 20;
  if (Object.keys(listing.itemSpecifics).length >= 5) score += 15;
  if (listing.seoKeywords.length >= 10) score += 10;
  if (listing.complianceWarnings.length === 0) score += 20;
  if (listing.description.includes("<ul>")) score += 5;
  if (listing.description.includes("trust") || listing.description.includes("ship")) score += 10;
  return Math.min(100, score);
}

// ── Master Optimize Function ──────────────────────────────────────────────────
export function optimizeListing(input: ProductInput): EbayOptimizedListing {
  const { title, score, alternatives } = generateEbayTitle(input);
  const description = generateEbayDescription(input);
  const itemSpecifics = generateItemSpecifics(input);
  const seoKeywords = generateSeoKeywords(input);
  const cat = detectCategory(input.title ?? "");
  const conditionId = CONDITION_MAP[input.condition?.toLowerCase() ?? "new"] ?? "1000";
  const complianceWarnings = checkCompliance({ title, description });

  const partial: EbayOptimizedListing = {
    title,
    titleScore: score,
    titleAlternatives: alternatives,
    description,
    itemSpecifics,
    seoKeywords,
    categoryId: cat.id,
    conditionId,
    priceRecommendation: null,
    complianceWarnings,
    ctxScore: 0,
  };

  partial.ctxScore = scoreCtr(partial);
  return partial;
}

// ── AI-powered title via Pollinations text API ───────────────────────────────
export async function aiEnhanceTitle(rawTitle: string, brand: string, specs: Record<string, string>): Promise<string> {
  const specStr = Object.entries(specs).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join(", ");
  const prompt = `You are an eBay SEO expert. Generate ONE optimized eBay listing title.
STRICT RULES:
- Maximum 80 characters (count carefully)
- No emojis, no special characters except hyphens and commas
- Keyword-first structure (most important search terms first)
- Include brand name if available
- High search density, no filler words
- Avoid banned words: free, cheap, guaranteed, click, visit

Product: ${rawTitle}
Brand: ${brand || "Unknown"}
Specs: ${specStr}

Reply with ONLY the title text, nothing else.`;

  try {
    const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const text = (await res.text()).trim().replace(/["'\n]/g, "").slice(0, 80);
      if (text.length >= 20) return text;
    }
  } catch { /* fallback to rule-based */ }
  return "";
}

// ── AI-powered description via Pollinations ───────────────────────────────────
export async function aiEnhanceDescription(input: ProductInput): Promise<string> {
  const prompt = `You are an eBay listing copywriter. Write a mobile-friendly HTML description.
RULES:
- Return valid HTML only (no markdown)
- Start with bullet points of key features
- Include trust signals (seller reputation, returns, shipping)  
- No external links, no off-eBay contact info
- No banned keywords or spam formatting
- Mobile-first layout, max-width 700px
- eBay-compliant, conversion-optimized

Product: ${input.title}
Brand: ${input.brand || "Unknown"}
Condition: ${input.condition || "New"}
Specs: ${JSON.stringify(input.specs || {})}

Return ONLY the HTML, no explanation.`;

  try {
    const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, {
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) {
      const text = (await res.text()).trim();
      if (text.includes("<") && text.length > 200) return text;
    }
  } catch { /* fallback */ }
  return "";
}
