import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, Trash2, Search, Download, RefreshCw, Database, HardDrive, Filter, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ListingCard from "@/components/ListingCard";
import { toast } from "sonner";
import { cn, MARKETPLACE_OPTIONS } from "@/lib/utils";
import { fetchHistory, deleteFromHistory, clearAllHistory, type HistoryItem } from "@/lib/history";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function HistoryPage() {
  const [items, setItems]         = useState<HistoryItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [modeFilter, setMode]     = useState("all");
  const [mpFilter, setMp]         = useState("all");
  const [expanded, setExpanded]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchHistory();
      setItems(data);
    } catch {
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const remove = async (id: string) => {
    await deleteFromHistory(id);
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success("Listing removed");
    if (expanded === id) setExpanded(null);
  };

  const clearAll = async () => {
    if (!confirm("Delete all listing history? This cannot be undone.")) return;
    await clearAllHistory();
    setItems([]);
    toast.success("History cleared");
  };

  const exportItem = (item: HistoryItem) => {
    const { listing } = item;
    const text = [
      `TITLE: ${listing.title}`,
      listing.subtitle ? `SUBTITLE: ${listing.subtitle}` : "",
      `CATEGORY: ${listing.category ?? ""}`,
      `CONDITION: ${listing.condition ?? "New"}`,
      `PRICE: £${listing.price ?? ""}`,
      `\nITEM SPECIFICS:`,
      ...Object.entries(listing.itemSpecifics ?? {}).map(([k, v]) => `  ${k}: ${v}`),
      `\nDESCRIPTION:\n${listing.description ?? ""}`,
      `\nKEYWORDS: ${listing.keywords?.join(", ") ?? ""}`,
      `\nSEO SCORE: ${item.seoReport?.overallScore ?? listing.seoScore ?? 0}/100`,
      `\nGenerated: ${new Date(item.createdAt).toLocaleString()}`,
      `Marketplace: ${item.marketplace ?? "eBay UK"}`,
    ].filter(Boolean).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = `pixlance_${listing.title?.slice(0, 30).replace(/\s+/g, "_") ?? "listing"}.txt`;
    a.click();
    toast.success("Exported!");
  };

  const filtered = items.filter(item => {
    if (search && !item.listing.title?.toLowerCase().includes(search.toLowerCase()) &&
        !item.keyword?.toLowerCase().includes(search.toLowerCase())) return false;
    if (modeFilter !== "all" && item.mode !== modeFilter) return false;
    if (mpFilter !== "all" && item.marketplace !== mpFilter) return false;
    return true;
  });

  const dbCount  = items.filter(i => i.source === "db").length;
  const locCount = items.filter(i => i.source === "localStorage").length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold">Listing History</h1>
            <Badge variant="default">{items.length} Saved</Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {dbCount > 0 && (
              <span className="flex items-center gap-1"><Database className="w-3 h-3 text-green-400" />{dbCount} in Neon DB</span>
            )}
            {locCount > 0 && (
              <span className="flex items-center gap-1"><HardDrive className="w-3 h-3 text-violet-400" />{locCount} local</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />Refresh
          </Button>
          {items.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => void clearAll()} className="gap-1.5 text-xs">
              <Trash2 className="w-3.5 h-3.5" />Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by title or keyword..." className="pl-8 text-sm h-9" />
            {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
          </div>
          <Select value={modeFilter} onValueChange={setMode}>
            <SelectTrigger className="w-36 text-xs h-9"><Filter className="w-3 h-3 mr-1" /><SelectValue placeholder="All modes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Modes</SelectItem>
              {["keyword","url","manual","image"].map(m => <SelectItem key={m} value={m} className="text-xs capitalize">{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={mpFilter} onValueChange={setMp}>
            <SelectTrigger className="w-36 text-xs h-9"><SelectValue placeholder="All markets" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Markets</SelectItem>
              {MARKETPLACE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading history from Neon DB + local storage...</p>
        </div>
      )}

      {/* Empty */}
      {!loading && items.length === 0 && (
        <div className="rounded-2xl border border-border bg-card/50 p-14 text-center space-y-3">
          <History className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          <h3 className="text-lg font-semibold">No listings yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Generate a listing from the Generator page — it'll automatically appear here, saved to both your browser and Neon DB.
          </p>
          <a href="/generator">
            <Button className="mt-2 gap-2">Go to Generator</Button>
          </a>
        </div>
      )}

      {/* No results for filter */}
      {!loading && items.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-border bg-card/50 p-10 text-center">
          <p className="text-sm text-muted-foreground">No listings match your filters.</p>
          <button onClick={() => { setSearch(""); setMode("all"); setMp("all"); }} className="text-xs text-primary hover:underline mt-2 block mx-auto">Clear filters</button>
        </div>
      )}

      {/* History list */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{filtered.length} listing{filtered.length !== 1 ? "s" : ""}{search || modeFilter !== "all" || mpFilter !== "all" ? " (filtered)" : ""}</p>
          <AnimatePresence initial={false}>
            {filtered.map((item, idx) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }} transition={{ delay: idx * 0.03 }}>
                {/* Row header */}
                <div className="rounded-t-xl border border-border bg-card px-5 py-2.5 flex items-center gap-3 flex-wrap">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">{timeAgo(item.createdAt)} · {new Date(item.createdAt).toLocaleDateString()}</span>
                  {item.mode && <Badge variant="secondary" className="text-[10px] h-4 capitalize">{item.mode}</Badge>}
                  {item.marketplace && <Badge variant="outline" className="text-[10px] h-4">{item.marketplace}</Badge>}
                  {item.source === "db"
                    ? <Badge variant="success" className="text-[10px] h-4"><Database className="w-2.5 h-2.5 mr-0.5" />DB</Badge>
                    : <Badge variant="secondary" className="text-[10px] h-4"><HardDrive className="w-2.5 h-2.5 mr-0.5" />Local</Badge>}
                  <div className="ml-auto flex items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => exportItem(item)}
                      className="text-[10px] h-6 px-2 gap-1"><Download className="w-2.5 h-2.5" />Export</Button>
                    <button onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                      className={cn("text-xs px-2.5 py-1 rounded-lg border transition-colors",
                        expanded === item.id ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary")}>
                      {expanded === item.id ? "Collapse" : "Expand"}
                    </button>
                    <button onClick={() => void remove(item.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Collapsed preview */}
                {expanded !== item.id && (
                  <div className="rounded-b-xl border-x border-b border-border bg-card/50 px-5 py-3">
                    <p className="text-sm font-medium truncate">{item.listing.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {item.listing.price && <span className="text-primary font-semibold">£{item.listing.price}</span>}
                      {item.listing.category && <span>{item.listing.category}</span>}
                      {item.seoReport?.overallScore && <span className={cn("font-semibold", item.seoReport.overallScore >= 80 ? "text-green-400" : item.seoReport.overallScore >= 60 ? "text-amber-400" : "text-red-400")}>SEO {item.seoReport.overallScore}/100</span>}
                    </div>
                  </div>
                )}

                {/* Expanded full listing card */}
                {expanded === item.id && (
                  <div className="border-x border-b border-border rounded-b-xl overflow-hidden">
                    <ListingCard listing={item.listing} seoReport={item.seoReport} onExport={() => exportItem(item)} />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
