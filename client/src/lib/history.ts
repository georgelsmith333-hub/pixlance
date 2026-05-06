import type { GeneratedListing, SEOReport } from "@/components/ListingCard";

export interface HistoryItem {
  id: string;
  keyword?: string;
  mode?: string;
  marketplace?: string;
  listing: GeneratedListing;
  seoReport?: SEOReport;
  createdAt: string;
  source: "db" | "localStorage";
}

const LS_KEY = "pixlance_history";
const MAX_LOCAL = 100;

/* ── localStorage helpers ─────────────────────────────────────────────────── */
function readLocal(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(items: HistoryItem[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(items.slice(0, MAX_LOCAL)));
}

/* ── Public API ─────────────────────────────────────────────────────────────── */

export function getLocalHistory(): HistoryItem[] {
  return readLocal();
}

export async function saveToHistory(
  listing: GeneratedListing,
  opts: { keyword?: string; mode?: string; marketplace?: string; seoReport?: SEOReport }
): Promise<string> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const item: HistoryItem = {
    id,
    keyword: opts.keyword,
    mode: opts.mode,
    marketplace: opts.marketplace,
    listing,
    seoReport: opts.seoReport,
    createdAt: new Date().toISOString(),
    source: "localStorage",
  };

  // Save locally immediately (instant UX)
  const existing = readLocal();
  writeLocal([item, ...existing]);

  // Persist to DB asynchronously (non-blocking)
  try {
    const res = await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: opts.keyword,
        mode: opts.mode,
        marketplace: opts.marketplace,
        listing,
        seoReport: opts.seoReport,
      }),
    });
    if (res.ok) {
      const data = await res.json() as { id: string; created_at: string };
      if (data.id) {
        // Update the local record with the DB id for future deletes
        const updated = readLocal().map(h => h.id === id ? { ...h, id: data.id, source: "db" as const } : h);
        writeLocal(updated);
        return data.id;
      }
    }
  } catch {
    // Silent: DB unavailable, localStorage fallback is already saved
  }
  return id;
}

export async function deleteFromHistory(id: string): Promise<void> {
  // Remove from localStorage
  writeLocal(readLocal().filter(h => h.id !== id));
  // Delete from DB
  try {
    await fetch(`/api/history/${id}`, { method: "DELETE" });
  } catch {
    // silent
  }
}

export async function clearAllHistory(): Promise<void> {
  localStorage.removeItem(LS_KEY);
  try {
    await fetch("/api/history", { method: "DELETE" });
  } catch {
    // silent
  }
}

export async function fetchHistory(): Promise<HistoryItem[]> {
  // Merge DB records with localStorage (DB takes precedence)
  const local = readLocal();
  try {
    const res = await fetch("/api/history");
    if (!res.ok) return local;
    const data = await res.json() as { listings: { id: string; keyword: string; mode: string; marketplace: string; listing: GeneratedListing; seo_report: SEOReport; created_at: string }[] };
    if (!data.listings?.length) return local;

    const dbItems: HistoryItem[] = data.listings.map(r => ({
      id: r.id,
      keyword: r.keyword,
      mode: r.mode,
      marketplace: r.marketplace,
      listing: r.listing,
      seoReport: r.seo_report,
      createdAt: r.created_at,
      source: "db" as const,
    }));

    // Merge: DB items + local-only items not in DB
    const dbIds = new Set(dbItems.map(i => i.id));
    const localOnly = local.filter(l => !dbIds.has(l.id));
    const merged = [...dbItems, ...localOnly].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, MAX_LOCAL);

    writeLocal(merged);
    return merged;
  } catch {
    return local;
  }
}
