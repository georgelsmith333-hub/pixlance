import { useState, useEffect, useMemo } from "react";
import {
  Search, Download, Trash2, Package, ExternalLink, Clock, Star,
  BarChart2, TrendingUp, TrendingDown, Minus, CheckCircle2,
  AlertTriangle, XCircle, RefreshCw, ShoppingCart, FileText,
  Filter, SortAsc, SortDesc, Eye, Copy, Check, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  getAllListings, deleteListing, wipeAllListings, formatExpiry, type SavedListing
} from "@/lib/listingStorage";

// ── Helpers ───────────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? "text-green-400 bg-green-500/10 border-green-500/30"
    : score >= 50 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
    : "text-red-400 bg-red-500/10 border-red-500/30";
  const icon = score >= 75 ? <CheckCircle2 className="w-3 h-3" />
    : score >= 50 ? <AlertTriangle className="w-3 h-3" />
    : <XCircle className="w-3 h-3" />;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${color}`}>
      {icon}{score}
    </span>
  );
}

const COMP_ICON: Record<string, React.ReactNode> = {
  low: <TrendingUp className="w-3 h-3 text-green-400" />,
  medium: <Minus className="w-3 h-3 text-yellow-400" />,
  high: <TrendingDown className="w-3 h-3 text-red-400" />,
};
const COMP_COLOR: Record<string, string> = {
  low: "text-green-400", medium: "text-yellow-400", high: "text-red-400",
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); toast.success("Copied!"); }}
      className="text-muted-foreground hover:text-primary transition-colors p-1">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

type SortKey = "savedAt" | "titleScore" | "ctxScore";
type SortDir = "asc" | "desc";

// ── Detail modal ──────────────────────────────────────────────────────────────
function ListingDetail({ item, onClose }: { item: SavedListing; onClose: () => void }) {
  const [tab, setTab] = useState("overview");
  const title = (item.listing as { title?: string }).title ?? item.title;
  const desc = (item.exportFiles["description.html"] ?? "");
  const specs = (item.listing as { itemSpecifics?: Record<string, string> }).itemSpecifics ?? {};
  const keywords = (item.listing as { seoKeywords?: string[] }).seoKeywords ?? [];
  const priceRec = (item.listing as { priceRecommendation?: { min: number; max: number; suggested: number } | null }).priceRecommendation;

  const downloadCsv = () => {
    const blob = new Blob([item.csvData], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ebay-listing-${item.id}.csv`;
    a.click();
    toast.success("CSV downloaded!");
  };

  const downloadZip = async () => {
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const folder = zip.folder("listing");
      Object.entries(item.exportFiles).forEach(([name, content]) => folder?.file(name, content));
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `pixlance-listing-${item.id}.zip`;
      a.click();
      toast.success("ZIP downloaded!");
    } catch { toast.error("ZIP failed"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 px-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-3xl bg-background border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-foreground line-clamp-2 mb-1">{title}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <ScoreBadge score={item.titleScore} />
              <span className="text-[10px] text-muted-foreground">Title</span>
              <ScoreBadge score={item.ctxScore} />
              <span className="text-[10px] text-muted-foreground">CTR</span>
              {item.competitionLevel && (
                <span className={`flex items-center gap-0.5 text-[10px] font-medium ${COMP_COLOR[item.competitionLevel]}`}>
                  {COMP_ICON[item.competitionLevel]} {item.competitionLevel} comp.
                </span>
              )}
              {item.suggestedPrice && (
                <span className="text-[10px] text-primary font-bold">${item.suggestedPrice}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 ml-3 shrink-0">
            <Button size="sm" className="h-8 text-xs bg-primary text-primary-foreground" onClick={() => void downloadZip()}>
              <Package className="w-3 h-3 mr-1" />ZIP
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={downloadCsv}>
              <Download className="w-3 h-3 mr-1" />CSV
            </Button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-y-auto p-5">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-4 w-full mb-4">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="title" className="text-xs">Title</TabsTrigger>
              <TabsTrigger value="description" className="text-xs">Description</TabsTrigger>
              <TabsTrigger value="images" className="text-xs">Images</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {priceRec && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 grid grid-cols-3 gap-3 text-center">
                  <div><p className="text-xs text-muted-foreground">Min</p><p className="text-lg font-bold">${priceRec.min}</p></div>
                  <div className="border-x border-border"><p className="text-xs text-primary font-medium">Suggested</p><p className="text-lg font-bold text-primary">${priceRec.suggested}</p></div>
                  <div><p className="text-xs text-muted-foreground">Max</p><p className="text-lg font-bold">${priceRec.max}</p></div>
                </div>
              )}
              <div className="rounded-xl border border-border bg-card p-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Item Specifics</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(specs).slice(0, 10).map(([k, v]) => (
                    <div key={k} className="text-xs rounded-lg bg-secondary/40 px-2.5 py-1.5">
                      <span className="font-medium">{k}:</span> <span className="text-muted-foreground">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              {keywords.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SEO Keywords</h4>
                    <CopyBtn text={keywords.join(", ")} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {keywords.slice(0, 15).map((kw: string) => (
                      <span key={kw} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="title">
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">eBay Title</h4>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono ${title.length > 80 ? "text-red-400" : "text-green-400"}`}>{title.length}/80</span>
                    <CopyBtn text={title} />
                  </div>
                </div>
                <p className="text-sm font-medium text-foreground bg-secondary/30 rounded-lg p-3">{title}</p>
                <Progress value={(title.length / 80) * 100} className="h-1.5" />
                <Link href={`/listing`}>
                  <Button size="sm" variant="outline" className="text-xs w-full">
                    <Zap className="w-3 h-3 mr-1" /> Re-optimize in Listing Generator
                  </Button>
                </Link>
              </div>
            </TabsContent>

            <TabsContent value="description">
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <h4 className="text-sm font-semibold">HTML Description</h4>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => {
                      const w = window.open("", "_blank");
                      if (w) { w.document.write(desc); w.document.close(); }
                    }}>
                      <Eye className="w-3 h-3 mr-1" /> Preview
                    </Button>
                    <CopyBtn text={desc} />
                  </div>
                </div>
                <pre className="text-[11px] font-mono p-4 overflow-auto max-h-64 whitespace-pre-wrap text-muted-foreground">{desc.slice(0, 2000)}{desc.length > 2000 ? "\n... (truncated)" : ""}</pre>
              </div>
            </TabsContent>

            <TabsContent value="images">
              {item.rankedImages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No images saved with this listing</p>
              ) : (
                <div className="space-y-3">
                  {item.rankedImages.map((img, i) => {
                    const imgTyped = img as { url: string; score: number; reasons: string[]; isMainCandidate: boolean; width?: number; height?: number };
                    return (
                      <div key={imgTyped.url} className={`rounded-xl border bg-card p-3 flex items-start gap-3 ${i === 0 ? "border-primary/40" : "border-border"}`}>
                        <div className="relative shrink-0">
                          <img src={imgTyped.url} alt="" className="w-14 h-14 rounded-lg object-cover bg-secondary/30" onError={e => { (e.target as HTMLImageElement).style.opacity = "0.2"; }} />
                          {i === 0 && <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center"><Star className="w-2.5 h-2.5 text-white fill-white" /></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-bold ${imgTyped.score >= 70 ? "text-green-400" : imgTyped.score >= 40 ? "text-yellow-400" : "text-red-400"}`}>{imgTyped.score}/100</span>
                            {imgTyped.width && <span className="text-[10px] text-muted-foreground">{imgTyped.width}×{imgTyped.height}</span>}
                          </div>
                          <Progress value={imgTyped.score} className="h-1 mb-1.5" />
                          <div className="flex flex-wrap gap-1">
                            {imgTyped.reasons.slice(0, 2).map((r: string) => (
                              <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{r}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ── Main History Page ─────────────────────────────────────────────────────────
export default function History() {
  const [listings, setListings] = useState<SavedListing[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("savedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<SavedListing | null>(null);

  const refresh = () => setListings(getAllListings());

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    let list = listings;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l => l.title.toLowerCase().includes(q) || l.platform?.includes(q));
    }
    if (filter === "high-score") list = list.filter(l => l.titleScore >= 70);
    if (filter === "low-comp") list = list.filter(l => l.competitionLevel === "low");
    if (filter === "with-images") list = list.filter(l => l.imageCount > 0);
    list = [...list].sort((a, b) => {
      const diff = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === "desc" ? -diff : diff;
    });
    return list;
  }, [listings, search, sortKey, sortDir, filter]);

  const downloadCsv = (item: SavedListing, e: React.MouseEvent) => {
    e.stopPropagation();
    const blob = new Blob([item.csvData], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ebay-${item.id}.csv`;
    a.click();
    toast.success("CSV downloaded!");
  };

  const remove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this listing?")) return;
    deleteListing(id);
    refresh();
    toast.success("Deleted");
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = sortDir === "desc" ? SortDesc : SortAsc;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {selected && <ListingDetail item={selected} onClose={() => setSelected(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" /> Saved Listings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {listings.length} listing{listings.length !== 1 ? "s" : ""} saved locally · auto-wiped after 3 days ·{" "}
            <Link href="/register" className="text-primary hover:underline">Sign up to keep forever</Link>
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="text-xs" onClick={refresh}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
          {listings.length > 0 && (
            <Button size="sm" variant="outline" className="text-xs text-red-400 hover:text-red-300 border-red-500/30"
              onClick={() => { if (confirm("Wipe all saved listings? Cannot be undone.")) { wipeAllListings(); refresh(); toast.success("All listings wiped"); } }}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Wipe All
            </Button>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search listings..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 text-sm" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { id: "all", label: "All" },
            { id: "high-score", label: "High Score" },
            { id: "low-comp", label: "Low Competition" },
            { id: "with-images", label: "Has Images" },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {([["savedAt", "Date"], ["titleScore", "Score"], ["ctxScore", "CTR"]] as [SortKey, string][]).map(([key, label]) => (
            <button key={key} onClick={() => toggleSort(key)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${sortKey === key ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              {label} {sortKey === key && <SortIcon className="w-3 h-3" />}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="rounded-2xl border border-border bg-card/50 p-16 text-center">
          <BarChart2 className="w-12 h-12 text-primary/20 mx-auto mb-4" />
          {listings.length === 0 ? (
            <>
              <h3 className="text-lg font-semibold mb-2">No saved listings yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Generate an eBay listing and it will appear here automatically.</p>
              <Link href="/listing">
                <Button className="bg-primary text-primary-foreground">
                  <Zap className="w-4 h-4 mr-2" /> Generate First Listing
                </Button>
              </Link>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold mb-2">No listings match your filter</h3>
              <Button variant="outline" onClick={() => { setSearch(""); setFilter("all"); }}>Clear filters</Button>
            </>
          )}
        </div>
      )}

      {/* Listings grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(item => {
            const expiry = formatExpiry(item.savedAt);
            const expiryWarning = Date.now() - item.savedAt > 2 * 24 * 60 * 60 * 1000;
            const savedDate = new Date(item.savedAt);
            const relativeTime = (() => {
              const diff = Date.now() - item.savedAt;
              const mins = Math.floor(diff / 60000);
              const hours = Math.floor(diff / 3600000);
              const days = Math.floor(diff / 86400000);
              if (mins < 60) return `${mins}m ago`;
              if (hours < 24) return `${hours}h ago`;
              return `${days}d ago`;
            })();

            return (
              <div key={item.id} onClick={() => setSelected(item)}
                className="rounded-xl border border-border bg-card hover:border-primary/40 transition-all cursor-pointer group overflow-hidden">
                {/* Top image */}
                {item.topImageUrl ? (
                  <div className="h-36 bg-secondary/30 overflow-hidden">
                    <img src={item.topImageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
                  </div>
                ) : (
                  <div className="h-20 bg-secondary/20 flex items-center justify-center">
                    <ShoppingCart className="w-8 h-8 text-muted-foreground/20" />
                  </div>
                )}

                <div className="p-4">
                  {/* Scores row */}
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    <ScoreBadge score={item.titleScore} />
                    <span className="text-[9px] text-muted-foreground">Title</span>
                    <ScoreBadge score={item.ctxScore} />
                    <span className="text-[9px] text-muted-foreground">CTR</span>
                    {item.competitionLevel && (
                      <span className={`flex items-center gap-0.5 text-[10px] font-medium ${COMP_COLOR[item.competitionLevel]}`}>
                        {COMP_ICON[item.competitionLevel]} {item.competitionLevel}
                      </span>
                    )}
                    {item.platform && (
                      <Badge variant="outline" className="text-[9px] py-0 h-4">{item.platform}</Badge>
                    )}
                  </div>

                  {/* Title */}
                  <p className="text-xs font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">{item.title}</p>

                  {/* Meta row */}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {relativeTime}
                    </span>
                    <span className={`flex items-center gap-1 ${expiryWarning ? "text-amber-400" : ""}`}>
                      {expiryWarning && <AlertTriangle className="w-3 h-3" />}{expiry}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                    {item.suggestedPrice && (
                      <div className="bg-primary/5 rounded-lg py-1.5">
                        <p className="text-[9px] text-muted-foreground">Price</p>
                        <p className="text-xs font-bold text-primary">${item.suggestedPrice}</p>
                      </div>
                    )}
                    {item.totalListings != null && (
                      <div className="bg-secondary/40 rounded-lg py-1.5">
                        <p className="text-[9px] text-muted-foreground">Market</p>
                        <p className="text-xs font-bold">{item.totalListings.toLocaleString()}</p>
                      </div>
                    )}
                    {item.imageCount > 0 && (
                      <div className="bg-secondary/40 rounded-lg py-1.5">
                        <p className="text-[9px] text-muted-foreground">Images</p>
                        <p className="text-xs font-bold">{item.imageCount}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5">
                    <Button size="sm" className="flex-1 h-7 text-[11px] bg-primary text-primary-foreground" onClick={e => downloadCsv(item, e)}>
                      <Download className="w-3 h-3 mr-1" /> CSV
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); setSelected(item); }} title="View details">
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    {item.sourceUrl && (
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); window.open(item.sourceUrl, "_blank"); }} title="View source">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-red-400 hover:text-red-300 border-red-500/20" onClick={e => remove(item.id, e)} title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sign-up CTA banner */}
      {listings.length > 0 && (
        <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6 flex items-center gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground mb-1">Your listings are stored locally in your browser</h3>
            <p className="text-xs text-muted-foreground">
              Create a free account to sync listings across devices, keep them permanently, and unlock Pro features.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/register">
              <Button size="sm" className="bg-primary text-primary-foreground text-xs">Create Free Account</Button>
            </Link>
            <Link href="/login">
              <Button size="sm" variant="outline" className="text-xs">Sign In</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
