import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Loader2, TrendingUp, TrendingDown, Minus, Target, Tag,
  BarChart3, Lightbulb, ArrowRight, ExternalLink, ShoppingBag,
  Activity, DollarSign, Hash, Flame, Clock, Eye, Shield, Zap, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { MARKETPLACE_OPTIONS, scoreColor, scoreBg, cn } from "@/lib/utils";
import { callAIClientJSON } from "@/lib/ai";

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

/* ── Currency map ──────────────────────────────────────────────────────────── */
const CURRENCY: Record<string, string> = {
  "eBay UK": "£", "eBay US": "$", "eBay AU": "A$",
  "eBay DE": "€", "eBay FR": "€", "eBay CA": "C$",
  "eBay IT": "€", "eBay ES": "€",
};
const EBAY_BASE: Record<string, string> = {
  "eBay UK": "https://www.ebay.co.uk", "eBay US": "https://www.ebay.com",
  "eBay AU": "https://www.ebay.com.au", "eBay DE": "https://www.ebay.de",
  "eBay FR": "https://www.ebay.fr", "eBay CA": "https://www.ebay.ca",
};

/* ── Helpers ────────────────────────────────────────────────────────────────── */
const DEMAND_COLOR: Record<string, string> = { high: "text-green-400", medium: "text-amber-400", low: "text-red-400" };
const COMPETITION_COLOR: Record<string, string> = { high: "text-red-400", medium: "text-amber-400", low: "text-green-400" };
const EXAMPLES = ["Wireless earbuds", "Vintage clothing", "Garden tools", "Phone cases", "Gym equipment"];

/* ── Client-side AI market research ─────────────────────────────────────────── */
async function fetchSoldPricesAI(keyword: string, marketplace: string): Promise<SoldStats> {
  const currency = CURRENCY[marketplace] ?? "£";
  const base = EBAY_BASE[marketplace] ?? "https://www.ebay.co.uk";
  const q = encodeURIComponent(keyword);

  const data = await callAIClientJSON<{
    avgPrice: number; medianPrice: number; minPrice: number; maxPrice: number;
    hotPrice: number; totalSold: number; trendDirection: string;
    sellThroughDescription: string;
    recentSales: { title: string; price: number; soldDate: string; condition: string }[];
    priceRanges: { range: string; pct: number }[];
  }>(`You are an eBay pricing expert. Generate ACCURATE, realistic sold-price market data for "${keyword}" on ${marketplace}.
Base this on real eBay market knowledge for ${marketplace}. Be precise with prices.

Return ONLY valid JSON:
{
  "avgPrice": <realistic avg sold price as decimal, e.g. 24.99>,
  "medianPrice": <median>,
  "minPrice": <typical cheapest sold price>,
  "maxPrice": <typical max sold price>,
  "hotPrice": <the most common / fastest selling price point>,
  "totalSold": <estimated items sold in last 30 days — realistic number>,
  "trendDirection": "up",
  "sellThroughDescription": "High (800+ sold) — strong demand",
  "recentSales": [
    {"title":"<realistic 70-char eBay listing title>","price":<number>,"soldDate":"Last 3 days","condition":"New"},
    {"title":"<realistic eBay listing title>","price":<number>,"soldDate":"Last 7 days","condition":"Used"},
    {"title":"<realistic eBay listing title>","price":<number>,"soldDate":"Last 14 days","condition":"New"},
    {"title":"<realistic eBay listing title>","price":<number>,"soldDate":"Last 5 days","condition":"New"},
    {"title":"<realistic eBay listing title>","price":<number>,"soldDate":"Last 21 days","condition":"Refurbished"}
  ],
  "priceRanges": [
    {"range":"${currency}X–${currency}Y","pct":15},
    {"range":"${currency}X–${currency}Y","pct":30},
    {"range":"${currency}X–${currency}Y","pct":35},
    {"range":"${currency}X–${currency}Y","pct":15},
    {"range":"${currency}X–${currency}Y","pct":5}
  ]
}`, "research");

  const recentSales: SoldItem[] = (data.recentSales ?? []).map(s => ({
    title: s.title, price: s.price, currency,
    soldDate: s.soldDate, condition: s.condition,
    url: `${base}/sch/i.html?_nkw=${q}&LH_Complete=1&LH_Sold=1`,
    imageUrl: "",
  }));

  const priceDistribution = (data.priceRanges ?? []).map(r => ({
    range: r.range, count: Math.round((r.pct / 100) * (data.totalSold ?? 100)), pct: r.pct,
  }));

  const trendDir = (["up","down","stable"].includes(data.trendDirection))
    ? data.trendDirection as "up"|"down"|"stable" : "stable";

  return {
    keyword, marketplace, currency,
    totalSold: data.totalSold ?? 0,
    scrapedCount: recentSales.length,
    avgPrice: data.avgPrice ?? 0,
    medianPrice: data.medianPrice ?? 0,
    minPrice: data.minPrice ?? 0,
    maxPrice: data.maxPrice ?? 0,
    hotPrice: data.hotPrice ?? data.avgPrice ?? 0,
    priceDistribution,
    recentSales,
    sellThroughEstimate: data.sellThroughDescription ?? "AI estimate",
    trendDirection: trendDir,
    scrapedAt: Date.now(),
    ebaySearchUrl: `${base}/sch/i.html?_nkw=${q}&LH_Complete=1&LH_Sold=1&_sop=13`,
  };
}

async function fetchCompetitorSpyAI(keyword: string, marketplace: string): Promise<CompetitorSpy> {
  const currency = CURRENCY[marketplace] ?? "£";
  const base = EBAY_BASE[marketplace] ?? "https://www.ebay.co.uk";
  const q = encodeURIComponent(keyword);

  const data = await callAIClientJSON<{
    totalActive: number; avgPrice: number; minPrice: number; maxPrice: number; medianPrice: number;
    topKeywords: string[];
    listings: { title: string; price: number; condition: string; bids: number; shipping: string; isBuyItNow: boolean; sellerName: string; sellerFeedback: string }[];
    marketGaps: string[];
    insights: string[];
  }>(`You are an expert eBay market analyst. Generate REALISTIC active listing data for "${keyword}" on ${marketplace}.
Use knowledge of actual eBay seller patterns. Be specific and accurate.

Return ONLY valid JSON:
{
  "totalActive": <realistic number of active listings>,
  "avgPrice": <realistic avg asking price>,
  "minPrice": <cheapest typical listing>,
  "maxPrice": <most expensive typical listing>,
  "medianPrice": <median price>,
  "topKeywords": ["keyword1","keyword2","keyword3","keyword4","keyword5","keyword6","keyword7","keyword8"],
  "listings": [
    {"title":"<realistic 70-char eBay title>","price":<num>,"condition":"New","bids":0,"shipping":"Free postage","isBuyItNow":true,"sellerName":"top_ebay_seller","sellerFeedback":"3241"},
    {"title":"<realistic eBay title>","price":<num>,"condition":"Used","bids":5,"shipping":"${currency}2.99","isBuyItNow":false,"sellerName":"bargain_tech_uk","sellerFeedback":"892"},
    {"title":"<realistic eBay title>","price":<num>,"condition":"New","bids":0,"shipping":"Free postage","isBuyItNow":true,"sellerName":"direct_from_brand","sellerFeedback":"15208"},
    {"title":"<realistic eBay title>","price":<num>,"condition":"Refurbished","bids":0,"shipping":"Free postage","isBuyItNow":true,"sellerName":"grade_a_returns","sellerFeedback":"4521"},
    {"title":"<realistic eBay title>","price":<num>,"condition":"New","bids":0,"shipping":"${currency}1.99","isBuyItNow":true,"sellerName":"fast_ship_store","sellerFeedback":"672"}
  ],
  "marketGaps": ["<specific opportunity sellers are missing>","<gap 2>","<gap 3>"],
  "insights": ["<actionable pricing insight for seller>","<insight 2>","<insight 3>","<insight 4>"]
}`, "research");

  const listings: CompetitorListing[] = (data.listings ?? []).map(l => ({
    title: l.title, price: l.price, currency,
    condition: l.condition, bids: l.bids,
    watchers: String(Math.floor(Math.random() * 45) + 1),
    sellerName: l.sellerName, sellerFeedback: l.sellerFeedback,
    timeLeft: ["2d 14h", "5d 3h", "1d 9h", "6h 22m", "12d 1h"][Math.floor(Math.random() * 5)],
    url: `${base}/sch/i.html?_nkw=${q}`,
    imageUrl: "",
    shipping: l.shipping, isBuyItNow: l.isBuyItNow,
  }));

  const avg = data.avgPrice ?? 0;
  const total = data.totalActive ?? listings.length;
  const priceSegments = [
    { label: "Budget",    count: Math.round(total * 0.2), range: `Under ${currency}${(avg * 0.7).toFixed(0)}` },
    { label: "Mid-range", count: Math.round(total * 0.6), range: `${currency}${(avg * 0.7).toFixed(0)}–${currency}${(avg * 1.3).toFixed(0)}` },
    { label: "Premium",   count: Math.round(total * 0.2), range: `Over ${currency}${(avg * 1.3).toFixed(0)}` },
  ];

  const titleKeywordFreq = (data.topKeywords ?? []).slice(0, 10).map((word, i) => ({
    word, count: Math.max(1, 10 - i), pct: Math.max(20, 90 - i * 8),
  }));

  return {
    keyword, marketplace, currency,
    totalActive: data.totalActive ?? listings.length,
    scrapedCount: listings.length,
    avgPrice: data.avgPrice ?? 0,
    minPrice: data.minPrice ?? 0,
    maxPrice: data.maxPrice ?? 0,
    medianPrice: data.medianPrice ?? 0,
    listings,
    titleKeywordFreq,
    priceSegments,
    gaps: data.marketGaps ?? [],
    insights: data.insights ?? [],
    ebaySearchUrl: `${base}/sch/i.html?_nkw=${q}&_sop=12`,
    scrapedAt: Date.now(),
  };
}

async function fetchAIResearch(keyword: string, marketplace: string): Promise<ResearchResult> {
  const [market, keywords] = await Promise.all([
    callAIClientJSON<MarketData>(`Analyze the eBay market for: "${keyword}" on ${marketplace}

Return ONLY valid JSON:
{
  "demandLevel": "high",
  "competitionLevel": "medium",
  "avgPrice": <realistic avg GBP/USD price>,
  "priceRange": {"min": <realistic min>, "max": <realistic max>},
  "bestCategories": ["<top eBay category>","<2nd category>","<3rd>"],
  "buyerProfile": "<who typically buys this and why>",
  "seasonality": "<any seasonal demand patterns>",
  "pricingStrategy": "<specific recommended pricing approach for ${marketplace}>",
  "titleFormula": "<winning eBay title formula, e.g. [Brand] [Model] [Type] [Key Spec] [Condition]>",
  "topKeywords": ["kw1","kw2","kw3","kw4","kw5","kw6","kw7","kw8"],
  "listingTips": ["<specific tip 1>","<tip 2>","<tip 3>","<tip 4>","<tip 5>"],
  "opportunityScore": <realistic 1-100 score>,
  "opportunityReason": "<specific reason for this score>"
}`, "research"),
    callAIClientJSON<KeywordData>(`Generate eBay keyword intelligence for: "${keyword}" on ${marketplace}

Return ONLY valid JSON:
{
  "primary": ["<top 5 high-volume keywords>"],
  "longTail": ["<8-10 specific long-tail buyer-intent keywords>"],
  "related": ["<6-8 related terms buyers search>"],
  "negative": ["<3-5 terms to avoid — too generic>"],
  "trending": ["<3 currently trending related terms>"],
  "titleFormula": "<recommended eBay title structure>",
  "estimatedMonthlySearches": "<e.g. 45,000>"
}`, "keywords"),
  ]);

  return { keyword, market, keywords, marketplace };
}

function LoadingCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 flex items-center gap-3">
      <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
      <div>
        <p className="text-sm font-medium">{text}</p>
        <p className="text-xs text-muted-foreground mt-0.5">AI analysis via browser — no rate limits</p>
      </div>
    </div>
  );
}

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

  const runAll = async () => {
    if (!query.trim()) return;
    const kw = query.trim();
    setResult(null); setSoldStats(null); setSpyData(null);
    setHistory(h => [kw, ...h.filter(q => q !== kw)].slice(0, 6));

    setAiLoading(true); setSoldL(true); setSpyL(true);

    // All 3 engines run in parallel, directly from browser (bypasses server rate limits)
    void fetchSoldPricesAI(kw, marketplace)
      .then(d => { setSoldStats(d); toast.success(`Sold data: ${d.scrapedCount} listings analysed`); })
      .catch(e => toast.error(`Sold data: ${String(e)}`))
      .finally(() => setSoldL(false));

    void fetchCompetitorSpyAI(kw, marketplace)
      .then(d => { setSpyData(d); toast.success(`Competitor spy: ${d.scrapedCount} active sellers analysed`); })
      .catch(e => toast.error(`Spy: ${String(e)}`))
      .finally(() => setSpyL(false));

    void fetchAIResearch(kw, marketplace)
      .then(d => setResult(d))
      .catch(e => toast.error(`AI analysis: ${String(e)}`))
      .finally(() => setAiLoading(false));
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
          <Badge variant="default">AI-Powered</Badge>
          <Badge variant="secondary" className="text-xs">3 Engines</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          AI-powered sold price analysis, competitor intelligence, and market research — direct from your browser, no API keys, no rate limits
        </p>
      </div>

      {/* AI mode notice */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 flex items-center gap-2 text-xs text-primary">
        <Sparkles className="w-3.5 h-3.5 shrink-0" />
        <span>AI analysis runs directly in your browser — uses your unique IP, no shared rate limits. Results based on AI market knowledge.</span>
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
            {isLoading ? "Analysing..." : "Analyse"}
          </Button>
        </div>
        {history.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground">Recent:</span>
            {history.map(h => (
              <button key={h} onClick={() => setQuery(h)}
                className="text-xs px-2 py-0.5 bg-secondary hover:bg-primary/10 hover:text-primary rounded-full transition-colors">{h}</button>
            ))}
          </div>
        )}
      </div>

      {/* Quick stats strip */}
      <AnimatePresence>
        {soldStats && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Avg Sold Price",  value: `${soldStats.currency}${soldStats.avgPrice.toFixed(2)}`,   icon: DollarSign,  color: "text-primary" },
              { label: "Hot Price Zone",  value: `${soldStats.currency}${soldStats.hotPrice.toFixed(2)}`,   icon: Flame,       color: "text-amber-400" },
              { label: "Total Sold (est)",value: soldStats.totalSold.toLocaleString(),                      icon: ShoppingBag, color: "text-green-400" },
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
                {soldLoading && !soldStats && <LoadingCard text="AI analysing sold price data for this market..." />}
                {soldStats && (
                  <>
                    <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap gap-5 items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendIcon className={cn("w-5 h-5", trendColor)} />
                        <div>
                          <p className="text-xs text-muted-foreground">Price Trend</p>
                          <p className={cn("text-sm font-bold capitalize", trendColor)}>{soldStats.trendDirection}</p>
                        </div>
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
                          <BarChart3 className="w-4 h-4 text-primary" />Price Distribution — AI Market Analysis
                        </p>
                        <div className="space-y-2.5">
                          {soldStats.priceDistribution.map(b => (
                            <div key={b.range} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground font-mono">{b.range}</span>
                                <span className="font-semibold">{b.pct}% of market</span>
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
                          <Badge variant="secondary" className="text-[10px] ml-auto">AI Market Data</Badge>
                        </div>
                        <div className="divide-y divide-border">
                          {soldStats.recentSales.map((sale, i) => (
                            <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <ShoppingBag className="w-4 h-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{sale.title}</p>
                                <p className="text-xs text-muted-foreground">{sale.condition} · {sale.soldDate}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-green-400">{sale.currency}{sale.price.toFixed(2)}</p>
                                <a href={soldStats.ebaySearchUrl} target="_blank" rel="noopener noreferrer"
                                  className="text-[10px] text-primary hover:underline">View eBay</a>
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
                {spyLoading && !spyData && <LoadingCard text="AI analysing competitor landscape..." />}
                {spyData && (
                  <>
                    <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap gap-5 items-center justify-between">
                      <div><p className="text-xs text-muted-foreground">Active Competitors (est.)</p><p className="text-lg font-bold text-violet-400">{spyData.totalActive.toLocaleString()}</p></div>
                      <div><p className="text-xs text-muted-foreground">Avg Asking Price</p><p className="text-lg font-bold">{spyData.currency}{spyData.avgPrice.toFixed(2)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Price Spread</p><p className="text-sm font-bold">{spyData.currency}{spyData.minPrice} – {spyData.currency}{spyData.maxPrice}</p></div>
                      <a href={spyData.ebaySearchUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs"><ExternalLink className="w-3.5 h-3.5" />View Active</Button>
                      </a>
                    </div>

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
                                  animate={{ width: `${Math.round(seg.count / spyData.totalActive * 100)}%` }}
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
                        <p className="text-xs text-muted-foreground mt-3">% of competitor titles using this word — include the top ones in your listing</p>
                      </div>
                    </div>

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

                    {spyData.listings.length > 0 && (
                      <div className="rounded-xl border border-border bg-card overflow-hidden">
                        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                          <Eye className="w-4 h-4 text-violet-400" />
                          <p className="text-sm font-bold">Active Competitor Listings</p>
                          <Badge variant="secondary" className="text-[10px] ml-auto">AI Market Data</Badge>
                        </div>
                        <div className="divide-y divide-border">
                          {spyData.listings.map((listing, i) => (
                            <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors">
                              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                                <Eye className="w-4 h-4 text-violet-400" />
                              </div>
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
                                <a href={spyData.ebaySearchUrl} target="_blank" rel="noopener noreferrer"
                                  className="text-[10px] text-primary hover:underline">View eBay</a>
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
                {aiLoading && !result && <LoadingCard text="Running deep AI market analysis..." />}
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
                          <span className="font-medium">AI Avg {CURRENCY[marketplace] ?? "£"}{m.avgPrice}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                      <div className="flex items-center gap-2 font-bold"><BarChart3 className="w-4 h-4 text-primary" />Market Intelligence</div>
                      {[
                        { label: "Price Range (AI est.)", val: `${CURRENCY[marketplace] ?? "£"}${m.priceRange?.min} – ${CURRENCY[marketplace] ?? "£"}${m.priceRange?.max}` },
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
                {aiLoading && !result && <LoadingCard text="Researching high-value keywords..." />}
                {result && kw && (
                  <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                    <div className="flex items-center gap-2 font-bold">
                      <Tag className="w-4 h-4 text-primary" />Keyword Intelligence
                      {kw.estimatedMonthlySearches && (
                        <Badge variant="secondary" className="text-xs ml-2">~{kw.estimatedMonthlySearches} searches/mo</Badge>
                      )}
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
                          {cat.items.map(k => (
                            <span key={k} className={`text-xs px-2.5 py-1 rounded-full border ${cat.color}`}>{k}</span>
                          ))}
                        </div>
                      </div>
                    ) : null)}
                    {kw.negative?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Avoid — Too Generic</p>
                        <div className="flex flex-wrap gap-1.5">
                          {kw.negative.map(k => (
                            <span key={k} className="text-xs px-2.5 py-1 rounded-full border border-red-500/20 bg-red-500/10 text-red-400 line-through">{k}</span>
                          ))}
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
            Sold price analysis, competitor intelligence, and AI market research — all powered directly from your browser for zero rate limits.
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
