/**
 * Listing Storage — localStorage persistence for guest + logged-in users
 * Auto-expires entries older than 3 days, warns at 2 days.
 */

const STORAGE_KEY = "pixlance_listings_v2";
const EXPIRY_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const WARN_MS   = 2 * 24 * 60 * 60 * 1000; // warn after 2 days
const MAX_ENTRIES = 50;

export interface SavedListing {
  id: string;           // pipelineId
  savedAt: number;      // Unix ms
  title: string;
  titleScore: number;
  ctxScore: number;
  competitionLevel?: string;
  suggestedPrice?: number;
  totalListings?: number;
  imageCount: number;
  topImageUrl?: string;
  categoryId: string;
  conditionId: string;
  csvData: string;
  exportFiles: Record<string, string>;
  draft: Record<string, unknown>;
  listing: Record<string, unknown>;
  competitors: Record<string, unknown> | null;
  rankedImages: Array<Record<string, unknown>>;
  sourceUrl?: string;
  platform?: string;
}

function load(): SavedListing[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as SavedListing[];
  } catch {
    return [];
  }
}

function save(entries: SavedListing[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded — trim oldest half
    const trimmed = entries.slice(Math.floor(entries.length / 2));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }
}

/** Remove entries older than 3 days, return cleaned list */
export function purgeExpired(): SavedListing[] {
  const now = Date.now();
  const all = load();
  const fresh = all.filter(e => now - e.savedAt < EXPIRY_MS);
  if (fresh.length !== all.length) save(fresh);
  return fresh;
}

/** Get all valid listings (purges expired first) */
export function getAllListings(): SavedListing[] {
  return purgeExpired().sort((a, b) => b.savedAt - a.savedAt);
}

/** Save a new listing (deduplicated by id) */
export function saveListing(entry: SavedListing): void {
  const all = purgeExpired().filter(e => e.id !== entry.id);
  all.unshift(entry);
  save(all.slice(0, MAX_ENTRIES));
}

/** Delete a single listing by id */
export function deleteListing(id: string): void {
  save(load().filter(e => e.id !== id));
}

/** Wipe all listings */
export function wipeAllListings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Check if any entries are approaching expiry (older than 2 days) */
export function getExpiryWarning(): { count: number; oldestMs: number } | null {
  const now = Date.now();
  const old = load().filter(e => now - e.savedAt >= WARN_MS && now - e.savedAt < EXPIRY_MS);
  if (old.length === 0) return null;
  const oldest = Math.max(...old.map(e => now - e.savedAt));
  return { count: old.length, oldestMs: oldest };
}

/** Format time remaining before expiry */
export function formatExpiry(savedAt: number): string {
  const remaining = EXPIRY_MS - (Date.now() - savedAt);
  if (remaining <= 0) return "Expired";
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h left`;
}

/** Build a SavedListing from a pipeline API result */
export function buildSavedEntry(
  result: {
    pipelineId: string;
    listing: Record<string, unknown>;
    draft: Record<string, unknown>;
    csvData: string;
    competitors: Record<string, unknown> | null;
    rankedImages: Array<Record<string, unknown>>;
    exportFiles?: Record<string, string>;
  },
  sourceUrl?: string,
  platform?: string
): SavedListing {
  const listing = result.listing as {
    title: string; titleScore: number; ctxScore: number;
    categoryId: string; conditionId: string;
    priceRecommendation?: { suggested: number } | null;
  };
  const competitors = result.competitors as { competitionLevel?: string; totalListings?: number } | null;
  const topImg = result.rankedImages[0] as { url?: string } | undefined;

  return {
    id: result.pipelineId,
    savedAt: Date.now(),
    title: listing.title ?? "",
    titleScore: listing.titleScore ?? 0,
    ctxScore: listing.ctxScore ?? 0,
    competitionLevel: competitors?.competitionLevel,
    suggestedPrice: (result.draft as { price?: number }).price,
    totalListings: competitors?.totalListings,
    imageCount: result.rankedImages.length,
    topImageUrl: topImg?.url,
    categoryId: listing.categoryId ?? "",
    conditionId: listing.conditionId ?? "",
    csvData: result.csvData ?? "",
    exportFiles: result.exportFiles ?? {
      "title.txt": listing.title,
      "ebay_payload.json": JSON.stringify(result.draft, null, 2),
      "upload.csv": result.csvData ?? "",
    },
    draft: result.draft as Record<string, unknown>,
    listing: result.listing as Record<string, unknown>,
    competitors: result.competitors as Record<string, unknown> | null,
    rankedImages: result.rankedImages,
    sourceUrl,
    platform,
  };
}
