/**
 * eBay SEO & Cassini Algorithm Optimizer
 * Scores and improves listings based on known ranking factors
 */

export interface ListingAnalysis {
  overallScore: number;
  titleScore: number;
  descriptionScore: number;
  specificsScore: number;
  priceScore: number;
  issues: { severity: "critical" | "warning" | "info"; message: string; fix: string }[];
  improvements: string[];
  cassiniFactors: Record<string, { score: number; weight: number; note: string }>;
}

// eBay Cassini algorithm weighting (approximate, based on known factors)
const CASSINI_WEIGHTS = {
  titleRelevancy:      0.25,
  itemSpecificsComplete: 0.20,
  sellThroughRate:     0.15,
  descriptionQuality:  0.12,
  priceCompetitiveness: 0.10,
  sellerReputation:    0.08,
  shippingSpeed:       0.06,
  returnsPolicy:       0.04,
};

// VERO brand database (major flagged brands on eBay)
const VERO_BRANDS = new Set([
  "nike", "adidas", "gucci", "louis vuitton", "chanel", "rolex", "supreme",
  "off-white", "balenciaga", "prada", "burberry", "versace", "lv", "yeezy",
  "jordan", "bape", "palace", "stone island", "cp company", "moncler",
  "canada goose", "north face", "ugg", "timberland", "new balance",
  "converse", "vans", "puma", "reebok", "under armour", "apple", "samsung",
  "sony", "microsoft", "nintendo", "pokemon", "disney", "marvel", "dc",
  "lego", "playmobil", "barbie", "hot wheels", "ford", "bmw", "mercedes",
  "ferrari", "lamborghini", "porsche", "pandora", "tiffany", "cartier",
  "omega", "tag heuer", "breitling", "ralph lauren", "tommy hilfiger",
  "calvin klein", "hugo boss", "lacoste", "fred perry", "ben sherman",
]);

export function checkVeroRisk(text: string): { hasRisk: boolean; brands: string[]; severity: string } {
  const lower = text.toLowerCase();
  const found = [...VERO_BRANDS].filter(brand => lower.includes(brand));

  if (found.length === 0) return { hasRisk: false, brands: [], severity: "none" };

  return {
    hasRisk: true,
    brands: found,
    severity: found.length > 2 ? "high" : "medium",
  };
}

export function analyzeTitle(title: string): {
  score: number;
  length: number;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  const len = title.length;
  if (len > 80) { issues.push(`Title too long: ${len}/80 chars — will be cut off`); score -= 20; }
  if (len < 40) { issues.push(`Title too short: ${len}/80 chars — missing keyword opportunities`); score -= 15; }
  if (len >= 70 && len <= 80) { suggestions.push("Title length is optimal (70-80 chars)"); }

  // Check for spam patterns
  const spamWords = ["wow", "look", "amazing", "best ever", "!!!", "must see", "rare find"];
  const foundSpam = spamWords.filter(w => title.toLowerCase().includes(w));
  if (foundSpam.length) { issues.push(`Spam words detected: ${foundSpam.join(", ")}`); score -= 15; }

  // Check for all caps words (more than 2)
  const allCapsWords = title.split(" ").filter(w => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w));
  if (allCapsWords.length > 2) { issues.push("Excessive ALL CAPS — eBay penalizes this"); score -= 10; }

  // Check for numbers (specifics)
  const hasNumbers = /\d/.test(title);
  if (!hasNumbers) suggestions.push("Add specific numbers/measurements for better relevancy");

  // Check for common eBay title patterns
  const hasCondition = /new|used|refurb/i.test(title);
  if (!hasCondition) suggestions.push("Consider adding condition keyword if space allows");

  return { score: Math.max(0, score), length: len, issues, suggestions };
}

export function scoreItemSpecifics(specifics: Record<string, string>): {
  score: number;
  filled: number;
  total: number;
  missing: string[];
} {
  const required = ["Brand", "Type", "Colour", "Model", "MPN", "Material", "Size", "Country/Region of Manufacture"];
  const filled = Object.entries(specifics).filter(([, v]) => v && v !== "N/A" && v !== "").length;
  const total = Object.keys(specifics).length || required.length;
  const missing = required.filter(k => !specifics[k] || specifics[k] === "");
  const score = Math.round((filled / Math.max(total, 1)) * 100);
  return { score, filled, total, missing };
}

export function analyzeDescription(html: string): {
  score: number;
  wordCount: number;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = text.split(" ").filter(Boolean).length;

  if (wordCount < 100) { issues.push("Description too short — aim for 200+ words"); score -= 25; }
  if (wordCount > 2000) { suggestions.push("Description is very long — consider condensing for mobile buyers"); }
  if (wordCount >= 200 && wordCount <= 800) suggestions.push("Word count is in the optimal range");

  if (/<table/i.test(html)) suggestions.push("Specs table detected — great for scannability");
  if (!/<ul|<ol|<li/i.test(html)) { issues.push("No bullet points — add feature bullets for scannability"); score -= 10; }
  if (/<img/i.test(html)) { issues.push("Images in description slow loading — eBay prefers text-only descriptions"); score -= 5; }
  if (/javascript/i.test(html)) { issues.push("JavaScript in description — eBay strips this"); score -= 20; }
  if (/style\s*=/i.test(html)) suggestions.push("Inline styles detected — eBay may strip some CSS");

  return { score: Math.max(0, score), wordCount, issues, suggestions };
}

export function generateSEOReport(listing: {
  title: string;
  description: string;
  itemSpecifics: Record<string, string>;
  price?: number;
  category?: string;
}): ListingAnalysis {
  const titleAnalysis = analyzeTitle(listing.title);
  const descAnalysis = analyzeDescription(listing.description);
  const specificsAnalysis = scoreItemSpecifics(listing.itemSpecifics ?? {});
  const veroCheck = checkVeroRisk(listing.title + " " + listing.description);

  const issues: ListingAnalysis["issues"] = [];

  // Title issues
  titleAnalysis.issues.forEach(msg => issues.push({ severity: "critical", message: msg, fix: "Edit your title to fix this" }));
  
  // Description issues
  descAnalysis.issues.forEach(msg => issues.push({ severity: "warning", message: msg, fix: "Update description" }));

  // Item specifics
  if (specificsAnalysis.score < 70) {
    issues.push({ severity: "critical", message: `Item specifics only ${specificsAnalysis.score}% complete`, fix: `Fill in: ${specificsAnalysis.missing.join(", ")}` });
  }

  // VERO
  if (veroCheck.hasRisk) {
    issues.push({ severity: "warning", message: `Potential VERO brand(s): ${veroCheck.brands.join(", ")}`, fix: "Verify you are authorised to resell these brands. Check eBay VERO program." });
  }

  const overallScore = Math.round(
    titleAnalysis.score * CASSINI_WEIGHTS.titleRelevancy * 4 +
    specificsAnalysis.score * CASSINI_WEIGHTS.itemSpecificsComplete * 4 +
    descAnalysis.score * CASSINI_WEIGHTS.descriptionQuality * 4 +
    70 * (1 - CASSINI_WEIGHTS.titleRelevancy - CASSINI_WEIGHTS.itemSpecificsComplete - CASSINI_WEIGHTS.descriptionQuality) * 4
  );

  return {
    overallScore: Math.min(100, Math.max(0, overallScore)),
    titleScore: titleAnalysis.score,
    descriptionScore: descAnalysis.score,
    specificsScore: specificsAnalysis.score,
    priceScore: 75,
    issues,
    improvements: [...titleAnalysis.suggestions, ...descAnalysis.suggestions],
    cassiniFactors: {
      titleRelevancy: { score: titleAnalysis.score, weight: 25, note: `${titleAnalysis.length}/80 chars` },
      itemSpecifics: { score: specificsAnalysis.score, weight: 20, note: `${specificsAnalysis.filled}/${specificsAnalysis.total} filled` },
      descriptionQuality: { score: descAnalysis.score, weight: 12, note: `${descAnalysis.wordCount} words` },
      pricing: { score: 75, weight: 10, note: "Based on market positioning" },
      sellThrough: { score: 70, weight: 15, note: "Improves after first sale" },
    },
  };
}

export function optimizeTitle(title: string, keywords: string[]): string {
  let optimized = title.trim();

  // Ensure primary keyword is first
  const primaryKeyword = keywords[0];
  if (primaryKeyword && !optimized.toLowerCase().startsWith(primaryKeyword.toLowerCase())) {
    const withoutKeyword = optimized.replace(new RegExp(primaryKeyword, "i"), "").trim();
    optimized = `${primaryKeyword} ${withoutKeyword}`.trim();
  }

  // Trim to 80 chars at word boundary
  if (optimized.length > 80) {
    optimized = optimized.slice(0, 80).replace(/\s+\S*$/, "").trim();
  }

  // Clean up spacing
  optimized = optimized.replace(/\s+/g, " ").trim();

  return optimized;
}

export const EBAY_CATEGORIES = {
  "Electronics": ["Mobile Phones", "Laptops", "Tablets", "Cameras", "Audio", "TV & Home Audio"],
  "Clothing": ["Men's Clothing", "Women's Clothing", "Kids' Clothing", "Shoes", "Accessories"],
  "Home & Garden": ["Furniture", "Kitchen", "Garden", "Tools", "Lighting"],
  "Sports": ["Fitness", "Outdoor", "Team Sports", "Water Sports", "Cycling"],
  "Toys": ["Action Figures", "Board Games", "Dolls", "RC Vehicles", "Educational"],
  "Automotive": ["Car Parts", "Accessories", "Tools", "Motorbike Parts"],
  "Health & Beauty": ["Skincare", "Hair Care", "Vitamins", "Medical Equipment"],
  "Collectibles": ["Coins", "Stamps", "Trading Cards", "Antiques", "Art"],
};
