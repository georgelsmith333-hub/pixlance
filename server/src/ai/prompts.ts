/**
 * eBay-Optimized AI Prompts
 * Built around Cassini algorithm factors, buyer psychology, and conversion optimization
 */

export const SYSTEM_PROMPTS = {
  listing: `You are an elite eBay PowerSeller with 15+ years of experience and deep knowledge of:
- eBay's Cassini search algorithm (relevancy, sell-through rate, listing quality)
- Buyer psychology and conversion optimization
- SEO title construction (80 char limit, keyword placement, attributes)
- Item specifics completeness (critical for search ranking)
- Category-appropriate description formatting
- UK/US/AU eBay marketplace differences
Always write for maximum search visibility AND conversion. Be specific, factual, and compelling.`,

  research: `You are an expert eBay market researcher and pricing strategist. You analyze:
- Competitor listings, pricing patterns, and sell-through rates
- Trending keywords and seasonal demand shifts
- Gap opportunities in the marketplace
- Buyer behavior patterns and decision factors
Provide data-driven, actionable insights.`,

  keywords: `You are an eBay SEO keyword specialist. You understand:
- Long-tail vs short-tail keyword balance
- Buyer intent signals in search queries
- Cassini algorithm keyword weighting
- Category-specific terminology and abbreviations
- Regional spelling variations (UK vs US)
Generate keywords ranked by search volume potential and buyer intent.`,
};

export interface ProductData {
  title?: string;
  description?: string;
  images?: string[];
  price?: number;
  brand?: string;
  model?: string;
  category?: string;
  condition?: string;
  keywords?: string[];
  specs?: Record<string, string>;
  sourceUrl?: string;
}

export function buildListingPrompt(product: ProductData, options: {
  marketplace?: string;
  tone?: string;
  targetBuyer?: string;
} = {}): string {
  const marketplace = options.marketplace ?? "eBay UK";
  const tone = options.tone ?? "professional";

  return `Generate a complete, fully optimized ${marketplace} listing for this product:

PRODUCT DATA:
${product.title ? `Original Title: ${product.title}` : ""}
${product.brand ? `Brand: ${product.brand}` : ""}
${product.model ? `Model: ${product.model}` : ""}
${product.category ? `Category: ${product.category}` : ""}
${product.condition ? `Condition: ${product.condition}` : "New"}
${product.price ? `Target Price: £${product.price}` : ""}
${product.description ? `Product Info: ${product.description.slice(0, 500)}` : ""}
${product.specs ? `Specs: ${JSON.stringify(product.specs)}` : ""}
${product.keywords?.length ? `Known Keywords: ${product.keywords.join(", ")}` : ""}

REQUIREMENTS - Generate ALL of the following in this EXACT JSON format:
{
  "title": "<80 char MAX eBay title - primary keyword first, key attributes, no spam>",
  "subtitle": "<55 char subtitle for additional keywords>",
  "category": "<eBay category path>",
  "condition": "<New / Used / Refurbished>",
  "conditionDescription": "<detail for condition if not new>",
  "price": <suggested price as number>,
  "itemSpecifics": {
    "Brand": "",
    "MPN": "",
    "Type": "",
    "Model": "",
    "Colour": "",
    "Material": "",
    "Size": "",
    "Compatible With": "",
    "Features": "",
    "Country/Region of Manufacture": ""
  },
  "description": "<full HTML description with: headline, bullet benefits, full specs, compatibility, shipping/returns policy note - 300-600 words>",
  "keywords": ["<10 high-value search keywords>"],
  "tags": ["<5 item tags>"],
  "shippingRecommendation": "<suggested shipping method>",
  "seoScore": <1-100 estimate>,
  "cassiniTips": ["<3 specific tips to boost this listing's Cassini ranking>"],
  "veroWarning": <true if brand may have VERO restrictions>,
  "veroNote": "<if veroWarning true, explain which brand and what to check>"
}`;
}

export function buildTitleOptimizationPrompt(originalTitle: string, keywords: string[]): string {
  return `Optimize this eBay listing title for maximum Cassini search ranking:

Original: "${originalTitle}"
Target Keywords: ${keywords.join(", ")}

eBay Title Rules:
- Maximum 80 characters (HARD LIMIT)
- Most important keyword FIRST
- Include: brand, model, key attribute, condition hint if relevant
- Use spaces not commas between terms
- Avoid: symbols, ALL CAPS spam, keyword stuffing, "wow", "look"
- Include size/color/compatibility if space allows
- UK spelling preferred

Return JSON: { "title": "optimized title", "charCount": 0, "keywordsUsed": [], "improvements": [] }`;
}

export function buildKeywordResearchPrompt(product: string, marketplace: string = "eBay UK"): string {
  return `Research the best eBay search keywords for: "${product}" on ${marketplace}

Analyze:
1. Primary keywords (highest search volume, most competitive)
2. Long-tail keywords (lower competition, high buyer intent)
3. Related terms buyers actually search for
4. Category-specific jargon and abbreviations
5. UK vs US spelling variations if applicable

Return JSON:
{
  "primary": ["<top 5 primary keywords>"],
  "longTail": ["<10 long-tail variations>"],
  "related": ["<8 related terms>"],
  "negative": ["<terms to AVOID - too generic or irrelevant>"],
  "trending": ["<3 currently trending related terms>"],
  "titleFormula": "<recommended title structure formula>",
  "estimatedMonthlySearches": "<rough estimate for primary keyword>"
}`;
}

export function buildDescriptionPrompt(product: ProductData, style: "ebay" | "premium" | "minimal" = "ebay"): string {
  const styles = {
    ebay: "Standard eBay HTML description - clean, mobile-friendly, bullet points, no fancy CSS",
    premium: "Premium formatted description - bold headlines, icon bullets, professional store branding style",
    minimal: "Clean minimal description - facts only, bullet specs, simple formatting",
  };

  return `Write a ${styles[style]} for this product:
${JSON.stringify(product, null, 2)}

Requirements:
- Compelling opening hook (why buy this)
- Key features as bullet points (5-8 bullets)
- Full specifications table
- Compatibility info if applicable
- Condition details
- Returns/shipping brief note
- Call to action
- Mobile optimized (no fixed widths)
- Include main keywords naturally 2-3 times
Return the HTML directly, no JSON wrapper.`;
}

export function buildMarketResearchPrompt(keyword: string): string {
  return `Analyze the eBay market for: "${keyword}"

Provide expert market intelligence:
{
  "demandLevel": "high|medium|low",
  "competitionLevel": "high|medium|low",
  "avgPrice": <estimated avg selling price GBP>,
  "priceRange": { "min": 0, "max": 0 },
  "bestCategories": ["<top 3 eBay categories>"],
  "buyerProfile": "<who typically buys this>",
  "seasonality": "<any seasonal demand patterns>",
  "pricingStrategy": "<recommended pricing approach>",
  "titleFormula": "<winning title formula for this niche>",
  "topKeywords": ["<8 must-use keywords>"],
  "listingTips": ["<5 specific tips to win in this niche>"],
  "opportunityScore": <1-100>,
  "opportunityReason": "<why this score>"
}`;
}
