import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Loader2, TrendingUp, TrendingDown, Minus, Target, Tag,
  BarChart3, Lightbulb, ArrowRight, ExternalLink, ShoppingBag,
  Activity, DollarSign, Hash, Flame, Clock, Eye, Shield, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { MARKETPLACE_OPTIONS, scoreColor, scoreBg, cn } from "@/lib/utils";

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface MarketData {
  demandLevel: string; competitionLevel: string; avgPrice: number;
  priceRange: { min: number; max: number }; bestCategories: string[];
  buyerProfile: string; seasonality: string; pricingStrategy: string;
  titleFormula: string; topKeywords: string[]; listingTips: string[];
  opportunityScore: number; opportunityReason: string;
}
interface KeywordData {
  primary: string[]; longTail: string[]; related: string[]; negative: string[];
  trending: string[]; titleFormula: string; estimatedMonthlySearches: string;
}
interface ResearchResult { keyword: string; market: MarketData; keywords: KeywordData; marketplace: string; }

interface SoldItem {
  title: string; price: number; currency: string; soldDate: string;
  condition: string; url: string; imageUrl: string;
}
interface SoldStats {
  keyword: string; marketplace: string; currency: string; totalSold: number;
  scrapedCount: number; avgPrice: number; medianPrice: number; minPrice: number;
  maxPrice: number; priceDistribution: { range: string; count: number; pct: number }[];
  recentSales: SoldItem[]; sellThroughEstimate: string;
  trendDirection: "up" | "down" | "stable"; hotPrice: number;
  scrapedAt: number; ebaySearchUrl: string;
}

interface CompetitorListing {
  title: string; price: number; currency: string; condition: string;
  bids: number; watchers: string; sellerName: string; sellerFeedback: string;
  timeLeft: string; url: string; imageUrl: string; shipping: string; isBuyItNow: boolean;
}
interface CompetitorSpy {
  keyword: string; marketplace: string; currency: string; totalActive: number;
  scrapedCount: number; avgPrice: number; minPrice: number; maxPrice: number;
  medianPrice: number; listings: CompetitorListing[];
  titleKeywordFreq: { word: string; count: number; pct: number }[];
  priceSegments: { label: string; count: number; range: string }[];
  gaps: string[]; insights: string[]; ebaySearchUrl: string; scrapedAt: number;
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */
const DEMAND_COLOR: Record<string, string> = { high: "text-green-400", medium: "text-amber-400", low: "text-red-400" };
const COMPETITION_COLOR: Record<string, string> = { high: "text-red-400", medium: "text-amber-400", low: "text-green-400" };
const EXAMPLES = ["Wireless earbuds", "Vintage clothing", "Garden tools", "Phone cases", "Gym equipment"];

/* ── Component ──────────────────────────────────────────────────────────────── */
export default function Research() {
  const [query, setQuery]         = useState("");
  const [marketplace, setMarket]  = useState("eBay UK");
  const [aiLoading, setAiLoading] = useState(false);
  const [soldLoading, setSoldL]   = useState(false);
  const [spyLoading, setSpyL]     = useState(false);
  const [result, setResult]       = useState<ResearchResult | null>(null);
  const [soldStats, setSoldStats] = useState<SoldStats | null>(null);
  const [spyData, setSpyData]     = useState<CompetitorSpy | null>(null);
  const [history, setHistory]     = useState<string[]>([]);
  const [tab, setTab]             = useState("sold");

  const post = async <T,>(url: string, body: object): Promise<T> => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json() as T;
    if (!r.ok) throw new Error((d as { error?: string }).error ?? "Request failed");
    return d;
  };

  const runAll = async () => {
    if (!query.trim()) return;
    const kw = query.trim();
    setResult(null); setSoldStats(null); setSpyData(null);
    setHistory(h => [kw, ...h.filter(q => q !== kw)].slice(0, 6));

    // Fire all three in parallel
    setAiLoading(true); setSoldL(true); setSpyL(true);

    void post<ResearchResult>("/api/listings/research", { keyword: kw, marketplace })
      .then(d => setResult(d))
      .catch(e => toast.error(`AI: ${String(e)}`))
      .finally(() => setAiLoading(false));

    void post<SoldStats>("/api/listings/sold-prices", { keyword: kw, marketplace })
      .then(d => { setSoldStats(d); toast.success(`Live sold data: ${d.scrapedCount} listings`); })
      .catch(e => toast.error(`Sold data: ${String(e)}`))
      .finally(() => setSoldL(false));

    void post<CompetitorSpy>("/api/listings/competitor-spy", { keyword: kw, marketplace })
      .then(d => { setSpyData(d); toast.success(`Competitor spy: ${d.scrapedCount} active listings`); })
      .catch(e => toast.error(`Spy: ${String(e)}`))
      .finally(() => setSpyL(false));
  };

  const isLoading = aiLoading || soldLoading || spyLoading;
  const m = result?.market;
  const kw = result?.keywords;
  const TrendIcon = soldStats?.trendDirection === "up" ? TrendingUp : soldStats?.trendDirection === "down" ? TrendingDown : Minus;
  const trendColor = soldStats?.trendDirection === "up" ? "text-green-400" : soldStats?.trendDirection === "down" ? "text-red-400" : "text-amber-400";

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold">Market Research</h1>
          <Badge variant="default">AI + Live eBay Data</Badge>
          <Badge variant="secondary" className="text-xs">3 Engines</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Real sold prices + active competitor listings scraped live from eBay, plus AI market analysis — zero API keys, unlimited
        </p>
      </div>

      {/* Search */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="e.g. Wireless earbuds, vintage watch, yoga mat..."
              className="pl-9" onKeyDown={e => { if (e.key === "Enter") void runAll(); }} />
          </div>
          <Select value={marketplace} onValueChange={setMarket}>
            <SelectTrigger className="w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{MARKETPLACE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => void runAll()} disabled={!query.trim() || isLoading} className="gap-2 shrink-0">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            {isLoading ? "Fetching..." : "Analyse"}
          </Button>
        </div>
        {history.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground">Recent:</span>
            {history.map(h => <button key={h} onClick={() => setQuery(h)} className="text-xs px-2 py-0.5 bg-secondary hover:bg-primary/10 hover:text-primary rounded-full transition-colors">{h}</button>)}
          </div>
        )}
      </div>

      {/* Quick stats strip — shows as soon as sold data arrives */}
      <AnimatePresence>
        {soldStats && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Avg Sold Price",  value: `${soldStats.currency}${soldStats.avgPrice.toFixed(2)}`,   icon: DollarSign,  color: "text-primary" },
              { label: "Hot Price Zone",  value: `${soldStats.currency}${soldStats.hotPrice.toFixed(2)}`,   icon: Flame,       color: "text-amber-400" },
              { label: "Total Sold",      value: soldStats.totalSold.toLocaleString(),                       icon: ShoppingBag, color: "text-green-400" },
              { label: "Active Listings", value: spyData ? spyData.totalActive.toLocaleString() : (spyLoading ? "..." : "—"), icon: Eye, color: "text-violet-400" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
                <s.icon className={cn("w-5 h-5 shrink-0", s.color)} />
                <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-lg font-bold">{s.value}</p></div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <AnimatePresence>
        {(soldStats || spyData || result || isLoading) && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full">
                <TabsTrigger value="sold" className="flex-1 gap-1.5 text-xs sm:text-sm">
                  <ShoppingBag className="w-3.5 h-3.5" />Sold Data
                  {soldLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  {soldStats && !soldLoading && <Badge variant="success" className="text-[9px] h-4 px-1">{soldStats.scrapedCount}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="spy" className="flex-1 gap-1.5 text-xs sm:text-sm">
                  <Eye className="w-3.5 h-3.5" />Competitor Spy
                  {spyLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  {spyData && !spyLoading && <Badge variant="warning" className="text-[9px] h-4 px-1">{spyData.scrapedCount}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="ai" className="flex-1 gap-1.5 text-xs sm:text-sm">
                  <BarChart3 className="w-3.5 h-3.5" />AI Analysis
                  {aiLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                </TabsTrigger>
                <TabsTrigger value="keywords" className="flex-1 gap-1.5 text-xs sm:text-sm">
                  <Hash className="w-3.5 h-3.5" />Keywords
                  {aiLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                </TabsTrigger>
              </TabsList>

              {/* ── SOLD TAB ── */}
              <TabsContent value="sold" className="space-y-4 mt-4">
                {soldLoading && !soldStats && <LoadingCard text="Scraping eBay completed listings..." />}
                {soldStats && (
                  <>
                    <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap gap-5 items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendIcon className={cn("w-5 h-5", trendColor)} />
                        <div><p className="text-xs text-muted-foreground">Price Trend</p><p className={cn("text-sm font-bold capitalize", trendColor)}>{soldStats.trendDirection}</p></div>
                      </div>
                      <div><p className="text-xs text-muted-foreground">Price Range</p><p className="text-sm font-bold">{soldStats.currency}{soldStats.minPrice} – {soldStats.currency}{soldStats.maxPrice}</p></div>
                      <div><p className="text-xs text-muted-foreground">Sell-through</p><p className="text-sm font-semibold">{soldStats.sellThroughEstimate}</p></div>
                      <a href={soldStats.ebaySearchUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs"><ExternalLink className="w-3.5 h-3.5" />View on eBay</Button>
                      </a>
                    </div>

                    {soldStats.priceDistribution.length > 0 && (
                      <div className="rounded-xl border border-border bg-card p-5">
                        <p className="text-sm font-bold mb-4 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-primary" />Price Distribution — {soldStats.scrapedCount} sold listings
                        </p>
                        <div className="space-y-2.5">
                          {soldStats.priceDistribution.map(b => (
                            <div key={b.range} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground font-mono">{b.range}</span>
                                <span className="font-semibold">{b.count} sold ({b.pct}%)</span>
                              </div>
                              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${b.pct}%` }} transition={{ duration: 0.5 }}
                                  className="h-2 rounded-full bg-primary" />
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">
                          Hot zone: <span className="text-amber-400 font-semibold">{soldStats.currency}{soldStats.hotPrice.toFixed(2)}</span>
                          {" "}· Median: <span className="text-primary font-semibold">{soldStats.currency}{soldStats.medianPrice.toFixed(2)}</span>
                        </p>
                      </div>
                    )}

                    {soldStats.recentSales.length > 0 && (
                      <div className="rounded-xl border border-border bg-card overflow-hidden">
                        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                          <Clock className="w-4 h-4 text-primary" />
                          <p className="text-sm font-bold">Recent Sold Listings</p>
                          <span className="text-xs text-muted-foreground ml-auto">Live from eBay · {new Date(soldStats.scrapedAt).toLocaleTimeString()}</span>
                        </div>
                        <div className="divide-y divide-border">
                          {soldStats.recentSales.map((sale, i) => (
                            <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors">
                              {sale.imageUrl && <img src={sale.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-secondary shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{sale.title}</p>
                                <p className="text-xs text-muted-foreground">{sale.condition} · {sale.soldDate}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-green-400">{sale.currency}{sale.price.toFixed(2)}</p>
                                {sale.url && <a href={sale.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">View</a>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* ── COMPETITOR SPY TAB ── */}
              <TabsContent value="spy" className="space-y-4 mt-4">
                {spyLoading && !spyData && <LoadingCard text="Scraping active eBay competitor listings..." />}
                {spyData && (
                  <>
                    {/* Header metrics */}
                    <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap gap-5 items-center justify-between">
                      <div><p className="text-xs text-muted-foreground">Active Competitors</p><p className="text-lg font-bold text-violet-400">{spyData.totalActive.toLocaleString()}</p></div>
                      <div><p className="text-xs text-muted-foreground">Avg Asking Price</p><p className="text-lg font-bold">{spyData.currency}{spyData.avgPrice.toFixed(2)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Price Spread</p><p className="text-sm font-bold">{spyData.currency}{spyData.minPrice} – {spyData.currency}{spyData.maxPrice}</p></div>
                      <a href={spyData.ebaySearchUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs"><ExternalLink className="w-3.5 h-3.5" />View Active</Button>
                      </a>
                    </div>

                    {/* Price segments + keyword freq */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-border bg-card p-5">
                        <p className="text-sm font-bold mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" />Market Price Segments</p>
                        <div className="space-y-3">
                          {spyData.priceSegments.map(seg => (
                            <div key={seg.label}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium">{seg.label} <span className="text-muted-foreground">({seg.range})</span></span>
                                <span className="font-bold">{seg.count} sellers</span>
                              </div>
                              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                                <motion.div initial={{ width: 0 }}
                                  animate={{ width: `${spyData.scrapedCount ? Math.round(seg.count / spyData.scrapedCount * 100) : 0}%` }}
                                  transition={{ duration: 0.5 }} className="h-2 rounded-full bg-violet-500" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-border bg-card p-5">
                        <p className="text-sm font-bold mb-3 flex items-center gap-2"><Tag className="w-4 h-4 text-primary" />Competitor Title Keywords</p>
                        <div className="flex flex-wrap gap-1.5">
                          {spyData.titleKeywordFreq.slice(0, 12).map(kw => (
                            <span key={kw.word} className="text-xs px-2.5 py-1 rounded-full border border-violet-500/20 bg-violet-500/10 text-violet-400">
                              {kw.word} <span className="opacity-60">{kw.pct}%</span>
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">% of competitor titles containing this word — include the top ones in your listing</p>
                      </div>
                    </div>

                    {/* Gaps */}
                    {spyData.gaps.length > 0 && (
                      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5">
                        <p className="text-sm font-bold mb-3 flex items-center gap-2 text-green-400"><Zap className="w-4 h-4" />Market Gaps — Your Opportunities</p>
                        <div className="space-y-2">
                          {spyData.gaps.map((gap, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <span className="text-green-400 font-bold shrink-0 mt-0.5">→</span>
                              <p className="text-foreground/80">{gap}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Insights */}
                    {spyData.insights.length > 0 && (
                      <div className="rounded-xl border border-border bg-card p-5">
                        <p className="text-sm font-bold mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-amber-400" />Strategic Insights</p>
                        <div className="space-y-2">
                          {spyData.insights.map((ins, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center shrink-0 font-bold mt-0.5">{i + 1}</span>
                              <p className="text-foreground/80">{ins}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Active listings table */}
                    {spyData.listings.length > 0 && (
                      <div className="rounded-xl border border-border bg-card overflow-hidden">
                        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                          <Eye className="w-4 h-4 text-violet-400" />
                          <p className="text-sm font-bold">Active Competitor Listings</p>
                          <span className="text-xs text-muted-foreground ml-auto">Scraped live · {new Date(spyData.scrapedAt).toLocaleTimeString()}</span>
                        </div>
                        <div className="divide-y divide-border">
                          {spyData.listings.map((listing, i) => (
                            <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors">
                              {listing.imageUrl && <img src={listing.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-secondary shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{listing.title}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-xs text-muted-foreground">{listing.condition}</span>
                                  {listing.bids > 0 && <Badge variant="secondary" className="text-[10px] h-4">{listing.bids} bids</Badge>}
                                  {listing.isBuyItNow && <Badge variant="outline" className="text-[10px] h-4">BIN</Badge>}
                                  {listing.shipping.toLowerCase().includes("free") && <Badge variant="success" className="text-[10px] h-4">Free ship</Badge>}
                                  {listing.sellerFeedback && <span className="text-[10px] text-muted-foreground">({listing.sellerFeedback} feedback)</span>}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-violet-400">{listing.currency}{listing.price.toFixed(2)}</p>
                                {listing.url && <a href={listing.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">View</a>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* ── AI ANALYSIS TAB ── */}
              <TabsContent value="ai" className="space-y-4 mt-4">
                {aiLoading && !result && <LoadingCard text="Running AI market analysis..." />}
                {result && m && (
                  <>
                    <div className={cn("rounded-2xl border p-6 flex items-center gap-6", scoreBg(m.opportunityScore ?? 50))}>
                      <div className="text-center">
                        <div className={cn("text-4xl font-black", scoreColor(m.opportunityScore ?? 50))}>{m.opportunityScore}</div>
                        <div className="text-xs text-muted-foreground">Opportunity</div>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg">{result.keyword}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{m.opportunityReason}</p>
                        <div className="flex items-center gap-4 mt-3 flex-wrap text-sm">
                          <span>Demand: <span className={DEMAND_COLOR[m.demandLevel]}>{m.demandLevel}</span></span>
                          <span>Competition: <span className={COMPETITION_COLOR[m.competitionLevel]}>{m.competitionLevel}</span></span>
                          <span className="font-medium">AI Avg £{m.avgPrice}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                      <div className="flex items-center gap-2 font-bold"><BarChart3 className="w-4 h-4 text-primary" />Market Intelligence</div>
                      {[
                        { label: "Price Range (AI est.)", val: `£${m.priceRange?.min} – £${m.priceRange?.max}` },
                        { label: "Best Categories", val: m.bestCategories?.join(", ") },
                        { label: "Buyer Profile", val: m.buyerProfile },
                        { label: "Seasonality", val: m.seasonality },
                      ].map(row => (
                        <div key={row.label} className="flex justify-between gap-4 py-2 border-b border-border last:border-0 text-sm">
                          <span className="text-muted-foreground shrink-0">{row.label}</span>
                          <span className="text-xs text-right">{row.val}</span>
                        </div>
                      ))}
                      <div className="pt-1">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Pricing Strategy</p>
                        <p className="text-xs text-foreground/80">{m.pricingStrategy}</p>
                      </div>
                    </div>

                    {m.titleFormula && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                        <div className="flex items-center gap-2 font-semibold text-sm mb-2 text-primary"><Target className="w-4 h-4" />Winning Title Formula</div>
                        <p className="text-sm font-mono bg-secondary/50 rounded-lg px-3 py-2">{m.titleFormula}</p>
                      </div>
                    )}

                    {m.listingTips?.length > 0 && (
                      <div className="rounded-2xl border border-border bg-card p-5">
                        <div className="flex items-center gap-2 font-bold mb-4"><Lightbulb className="w-4 h-4 text-amber-400" />Niche Strategy Tips</div>
                        <div className="space-y-2.5">
                          {m.listingTips.map((tip, i) => (
                            <div key={i} className="flex items-start gap-3 text-sm">
                              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center shrink-0 font-bold mt-0.5">{i + 1}</span>
                              <p className="text-foreground/80">{tip}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* ── KEYWORDS TAB ── */}
              <TabsContent value="keywords" className="space-y-4 mt-4">
                {aiLoading && !result && <LoadingCard text="Researching keywords..." />}
                {result && kw && (
                  <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                    <div className="flex items-center gap-2 font-bold">
                      <Tag className="w-4 h-4 text-primary" />Keyword Intelligence
                      {kw.estimatedMonthlySearches && <Badge variant="secondary" className="text-xs ml-2">~{kw.estimatedMonthlySearches} searches/mo</Badge>}
                    </div>
                    {[
                      { label: "Primary Keywords", items: kw.primary, color: "bg-primary/10 text-primary border-primary/20" },
                      { label: "Long-tail (High Intent)", items: kw.longTail, color: "bg-green-500/10 text-green-400 border-green-500/20" },
                      { label: "Related Terms", items: kw.related, color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
                      { label: "Trending Now", items: kw.trending, color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
                    ].map(cat => cat.items?.length ? (
                      <div key={cat.label}>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">{cat.label}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {cat.items.map(k => <span key={k} className={`text-xs px-2.5 py-1 rounded-full border ${cat.color}`}>{k}</span>)}
                        </div>
                      </div>
                    ) : null)}
                    {kw.negative?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Avoid — Too Generic</p>
                        <div className="flex flex-wrap gap-1.5">
                          {kw.negative.map(k => <span key={k} className="text-xs px-2.5 py-1 rounded-full border border-red-500/20 bg-red-500/10 text-red-400 line-through">{k}</span>)}
                        </div>
                      </div>
                    )}
                    {kw.titleFormula && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                        <p className="text-xs font-semibold text-primary mb-1">Recommended Title Formula</p>
                        <p className="text-sm font-mono text-foreground/80">{kw.titleFormula}</p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!soldStats && !spyData && !result && !isLoading && (
        <div className="rounded-2xl border border-border bg-card/50 p-14 text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <ShoppingBag className="w-9 h-9 text-primary/20" />
            <Eye className="w-9 h-9 text-primary/20" />
            <Activity className="w-9 h-9 text-primary/20" />
          </div>
          <h3 className="text-lg font-semibold">3-Engine Market Research</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Simultaneously scrapes real sold prices, active competitor listings, and runs AI market analysis — all from one search, no API keys needed.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {EXAMPLES.map(ex => (
              <button key={ex} onClick={() => setQuery(ex)}
                className="text-xs px-3 py-1.5 bg-secondary hover:bg-primary/10 hover:text-primary rounded-full transition-colors border border-border">
                {ex} <ArrowRight className="inline w-3 h-3 ml-1" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
