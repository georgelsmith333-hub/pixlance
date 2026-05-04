import { useState, useRef } from "react";
import {
  Zap, Globe, Link2, Search, Download, Upload, ChevronRight,
  CheckCircle2, XCircle, AlertTriangle, Loader2, Copy, Check,
  TrendingUp, TrendingDown, Minus, Star, BarChart2, FileText,
  Image as ImageIcon, Package, RefreshCw, Eye, ArrowRight,
  ShoppingCart, Target, Crown, Sparkles, History
} from "lucide-react";
import { saveListing, buildSavedEntry } from "@/lib/listingStorage";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────
interface ListingResult {
  pipelineId: string;
  status: string;
  listing: {
    title: string;
    titleScore: number;
    titleAlternatives: string[];
    description: string;
    itemSpecifics: Record<string, string>;
    seoKeywords: string[];
    categoryId: string;
    conditionId: string;
    priceRecommendation: { min: number; max: number; suggested: number } | null;
    complianceWarnings: string[];
    ctxScore: number;
  };
  rankedImages: Array<{
    url: string;
    score: number;
    reasons: string[];
    isMainCandidate: boolean;
    width?: number;
    height?: number;
    format?: string;
  }>;
  competitors: {
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    totalListings: number;
    topTitles: string[];
    recommendedPrice: number;
    competitionLevel: "low" | "medium" | "high";
  } | null;
  draft: {
    id: string;
    title: string;
    price: number;
    categoryId: string;
    conditionId: string;
    itemSpecifics: Record<string, string>;
    pictureUrls: string[];
    quantity: number;
  };
  csvData: string;
  processingMs: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ScoreBadge({ score, label }: { score: number; label: string }) {
  const color = score >= 75 ? "text-green-400 bg-green-500/10 border-green-500/30"
    : score >= 50 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
    : "text-red-400 bg-red-500/10 border-red-500/30";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
      {score >= 75 ? <CheckCircle2 className="w-3 h-3" /> : score >= 50 ? <AlertTriangle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}: {score}/100
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Copied!");
  };
  return (
    <button onClick={copy} className="text-muted-foreground hover:text-primary transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

const COMPETITION_COLOR: Record<string, string> = {
  low: "text-green-400", medium: "text-yellow-400", high: "text-red-400",
};
const COMPETITION_ICON: Record<string, React.ReactNode> = {
  low: <TrendingUp className="w-4 h-4 text-green-400" />,
  medium: <Minus className="w-4 h-4 text-yellow-400" />,
  high: <TrendingDown className="w-4 h-4 text-red-400" />,
};

export default function ListingGenerator() {
  const [inputUrl, setInputUrl] = useState("");
  const [inputTitle, setInputTitle] = useState("");
  const [inputBrand, setInputBrand] = useState("");
  const [inputPrice, setInputPrice] = useState("");
  const [inputCondition, setInputCondition] = useState("New");
  const [useAiEnhance, setUseAiEnhance] = useState(true);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [result, setResult] = useState<ListingResult | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDesc, setEditedDesc] = useState("");
  const [reoptimizing, setReoptimizing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const descRef = useRef<HTMLIFrameElement>(null);

  const runPipeline = async (mode: "url" | "title") => {
    if (mode === "url" && !inputUrl.trim()) { toast.error("Enter a product URL"); return; }
    if (mode === "title" && !inputTitle.trim()) { toast.error("Enter a product title"); return; }
    setLoading(true);
    setResult(null);
    setStep("Importing product data...");

    try {
      const body: Record<string, unknown> = { useAiEnhance };
      if (mode === "url") body.url = inputUrl.trim();
      if (mode === "title") {
        body.title = inputTitle.trim();
        if (inputBrand) body.brand = inputBrand;
        if (inputPrice) body.price = parseFloat(inputPrice);
        body.condition = inputCondition;
      }

      setStep("Running eBay optimization engine...");
      const res = await fetch("/api/ebay/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      setStep("Ranking images & comparing competitors...");
      const data = await res.json() as ListingResult & { error?: string };
      if (!res.ok) { toast.error(data.error ?? "Pipeline failed"); return; }
      setResult(data);
      setEditedTitle(data.listing.title);
      setEditedDesc(data.listing.description);
      // Auto-save to localStorage for guest persistence
      try {
        const entry = buildSavedEntry(
          { ...data, exportFiles: { "title.txt": data.listing.title, "description.html": data.listing.description, "upload.csv": data.csvData, "ebay_payload.json": JSON.stringify(data.draft, null, 2) } },
          mode === "url" ? inputUrl : undefined,
          body.platform as string | undefined ?? (mode === "url" ? "generic" : undefined)
        );
        saveListing(entry);
      } catch { /* storage full or unavailable */ }
      toast.success(`Listing generated in ${(data.processingMs / 1000).toFixed(1)}s`);
      setActiveTab("overview");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
      setStep("");
    }
  };

  const reoptimizeTitle = async () => {
    if (!editedTitle) return;
    setReoptimizing(true);
    try {
      const res = await fetch("/api/ebay/title-optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: editedTitle, brand: inputBrand }),
      });
      const data = await res.json() as { aiOptimized: string; ruleBasedScore: number };
      setEditedTitle(data.aiOptimized || editedTitle);
      toast.success("Title re-optimized with AI!");
    } catch { toast.error("Re-optimization failed"); }
    finally { setReoptimizing(false); }
  };

  const downloadCsv = () => {
    if (!result) return;
    const blob = new Blob([result.csvData], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ebay-listing-${result.pipelineId}.csv`;
    a.click();
    toast.success("CSV downloaded — ready for eBay bulk upload!");
  };

  const downloadZip = async () => {
    if (!result) return;
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const folder = zip.folder("listing");
      const files: Record<string, string> = {
        "title.txt": editedTitle,
        "description.html": editedDesc,
        "item_specifics.json": JSON.stringify(result.listing.itemSpecifics, null, 2),
        "seo_keywords.json": JSON.stringify(result.listing.seoKeywords, null, 2),
        "ebay_payload.json": JSON.stringify(result.draft, null, 2),
        "upload.csv": result.csvData,
        "competitors.json": JSON.stringify(result.competitors, null, 2),
      };
      Object.entries(files).forEach(([name, content]) => folder?.file(name, content));
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `pixlance-listing-${result.pipelineId}.zip`;
      a.click();
      toast.success("ZIP package downloaded!");
    } catch { toast.error("ZIP creation failed"); }
  };

  const sendToBatch = () => {
    if (!result?.rankedImages.length) return;
    const payload = result.rankedImages.slice(0, 6).map((img, i) => ({
      dataUrl: img.url, filename: `product_${i + 1}.jpg`, sizeBytes: 0,
    }));
    sessionStorage.setItem("scraper_to_batch", JSON.stringify(payload));
    window.location.href = "/batch";
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              eBay Listing Generator
              <Badge className="text-xs bg-primary/15 text-primary border-primary/30">AI-Powered</Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              Import any URL or title → get a fully eBay-optimized listing with competitor intel, ranked images, and one-click CSV upload
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Input Panel ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* URL Import */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" /> Import from URL
            </h3>
            <div className="space-y-3">
              <Input
                placeholder="AliExpress / eBay / Amazon URL..."
                value={inputUrl}
                onChange={e => setInputUrl(e.target.value)}
                className="text-sm"
              />
              <div className="flex flex-wrap gap-1.5">
                {["aliexpress.com/item/", "ebay.com/itm/", "amazon.com/dp/"].map(ex => (
                  <button key={ex} onClick={() => setInputUrl(`https://www.${ex}...`)}
                    className="text-[10px] text-primary/70 hover:text-primary border border-primary/20 rounded px-1.5 py-0.5">
                    {ex.split("/")[0]}
                  </button>
                ))}
              </div>
              <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-sm"
                disabled={loading || !inputUrl.trim()}
                onClick={() => void runPipeline("url")}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                Import & Optimize
              </Button>
            </div>
          </div>

          {/* Manual Input */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Manual Entry
            </h3>
            <div className="space-y-3">
              <Input placeholder="Product title..." value={inputTitle} onChange={e => setInputTitle(e.target.value)} className="text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Brand" value={inputBrand} onChange={e => setInputBrand(e.target.value)} className="text-sm" />
                <Input placeholder="Price ($)" type="number" value={inputPrice} onChange={e => setInputPrice(e.target.value)} className="text-sm" />
              </div>
              <select
                value={inputCondition}
                onChange={e => setInputCondition(e.target.value)}
                className="w-full text-sm h-9 px-3 rounded-lg border border-border bg-background text-foreground"
              >
                {["New", "Like New", "Very Good", "Good", "Acceptable", "For Parts", "Refurbished"].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-primary" /> AI Enhancement
                </Label>
                <Switch checked={useAiEnhance} onCheckedChange={setUseAiEnhance} />
              </div>
              <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-sm"
                disabled={loading || !inputTitle.trim()}
                onClick={() => void runPipeline("title")}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                Generate Listing
              </Button>
            </div>
          </div>

          {/* Pipeline steps indicator */}
          {loading && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-xs text-primary font-medium">{step}</span>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                {["Import & scrape product", "Normalize data", "eBay optimize (title/desc/specs)", "Rank images by eBay quality", "Scrape live competitor prices", "Generate export package"].map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick actions when result is ready */}
          {result && (
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-2">
              <p className="text-xs font-semibold text-green-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Listing Ready
              </p>
              <Button size="sm" className="w-full text-xs bg-primary text-primary-foreground" onClick={downloadZip}>
                <Package className="w-3.5 h-3.5 mr-1.5" /> Download ZIP Package
              </Button>
              <Button size="sm" variant="outline" className="w-full text-xs" onClick={downloadCsv}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> eBay Upload CSV
              </Button>
              <Button size="sm" variant="outline" className="w-full text-xs" onClick={sendToBatch}>
                <ImageIcon className="w-3.5 h-3.5 mr-1.5" /> Send Images to Upscaler
              </Button>
            </div>
          )}
        </div>

        {/* ── Right: Results ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          {!result && !loading && (
            <div className="rounded-2xl border border-border bg-card/50 p-12 flex flex-col items-center justify-center text-center min-h-[500px]">
              <Sparkles className="w-12 h-12 text-primary/30 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">eBay Pipeline Ready</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Paste a product URL or enter a title. The AI engine will generate a fully optimized eBay listing in seconds.
              </p>
              <div className="grid grid-cols-3 gap-4 mt-8 text-xs text-muted-foreground">
                {[
                  { icon: Target, label: "80-char SEO title" },
                  { icon: BarChart2, label: "Competitor pricing" },
                  { icon: Star, label: "Image quality rank" },
                  { icon: FileText, label: "Mobile HTML desc" },
                  { icon: Package, label: "ZIP export" },
                  { icon: Upload, label: "eBay CSV upload" },
                ].map(item => (
                  <div key={item.label} className="flex flex-col items-center gap-1">
                    <item.icon className="w-5 h-5 text-primary/50" />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Score bar */}
              <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
                <ScoreBadge score={result.listing.titleScore} label="Title" />
                <ScoreBadge score={result.listing.ctxScore} label="CTR" />
                {result.competitors && (
                  <span className={`flex items-center gap-1 text-xs font-medium ${COMPETITION_COLOR[result.competitors.competitionLevel]}`}>
                    {COMPETITION_ICON[result.competitors.competitionLevel]}
                    {result.competitors.competitionLevel.charAt(0).toUpperCase() + result.competitors.competitionLevel.slice(1)} Competition
                  </span>
                )}
                {result.listing.complianceWarnings.length === 0
                  ? <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> eBay Compliant</span>
                  : <span className="text-xs text-yellow-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {result.listing.complianceWarnings.length} warning{result.listing.complianceWarnings.length > 1 ? "s" : ""}</span>
                }
                <span className="ml-auto text-xs text-muted-foreground">{(result.processingMs / 1000).toFixed(1)}s</span>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-5 w-full">
                  <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                  <TabsTrigger value="title" className="text-xs">Title</TabsTrigger>
                  <TabsTrigger value="description" className="text-xs">Description</TabsTrigger>
                  <TabsTrigger value="images" className="text-xs">Images</TabsTrigger>
                  <TabsTrigger value="competitors" className="text-xs">Market</TabsTrigger>
                </TabsList>

                {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
                <TabsContent value="overview" className="space-y-4 mt-4">
                  {/* Title preview */}
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">eBay Title</h4>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono ${editedTitle.length > 80 ? "text-red-400" : "text-primary"}`}>{editedTitle.length}/80</span>
                        <CopyButton text={editedTitle} />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-foreground">{editedTitle}</p>
                    {editedTitle.length > 80 && (
                      <p className="text-xs text-red-400 mt-1">⚠ Exceeds 80 chars — eBay will truncate</p>
                    )}
                  </div>

                  {/* Item specifics */}
                  <div className="rounded-xl border border-border bg-card p-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Item Specifics</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(result.listing.itemSpecifics).slice(0, 8).map(([k, v]) => (
                        <div key={k} className="text-xs rounded-lg bg-secondary/40 px-2.5 py-1.5">
                          <span className="font-medium text-foreground">{k}:</span>
                          <span className="text-muted-foreground ml-1 truncate">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SEO Keywords */}
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SEO Keywords</h4>
                      <CopyButton text={result.listing.seoKeywords.join(", ")} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {result.listing.seoKeywords.slice(0, 15).map(kw => (
                        <span key={kw} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{kw}</span>
                      ))}
                    </div>
                  </div>

                  {/* Price recommendation */}
                  {result.listing.priceRecommendation && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Price Intelligence</h4>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground">Market Min</p>
                          <p className="text-lg font-bold text-foreground">${result.listing.priceRecommendation.min}</p>
                        </div>
                        <div className="border-x border-border">
                          <p className="text-xs text-primary font-medium">Suggested</p>
                          <p className="text-lg font-bold text-primary">${result.listing.priceRecommendation.suggested}</p>
                          <p className="text-[10px] text-muted-foreground">3% below avg</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Market Max</p>
                          <p className="text-lg font-bold text-foreground">${result.listing.priceRecommendation.max}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Compliance warnings */}
                  {result.listing.complianceWarnings.length > 0 && (
                    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
                      <h4 className="text-xs font-semibold text-yellow-400 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> eBay Compliance Warnings
                      </h4>
                      <ul className="space-y-1">
                        {result.listing.complianceWarnings.map(w => (
                          <li key={w} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <span className="text-yellow-400 mt-0.5">•</span> {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </TabsContent>

                {/* ── TITLE TAB ─────────────────────────────────────────────── */}
                <TabsContent value="title" className="space-y-4 mt-4">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold">eBay Title Editor</h4>
                      <span className={`text-sm font-mono font-bold ${editedTitle.length > 80 ? "text-red-400" : editedTitle.length >= 60 ? "text-green-400" : "text-yellow-400"}`}>
                        {editedTitle.length}/80
                      </span>
                    </div>
                    <Textarea
                      value={editedTitle}
                      onChange={e => setEditedTitle(e.target.value.slice(0, 80))}
                      rows={2}
                      className="text-sm font-medium resize-none mb-3"
                      placeholder="eBay listing title..."
                    />
                    <Progress value={(editedTitle.length / 80) * 100} className="h-1.5 mb-3" />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => void reoptimizeTitle()} disabled={reoptimizing}>
                        {reoptimizing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                        AI Re-Optimize
                      </Button>
                      <CopyButton text={editedTitle} />
                    </div>
                  </div>

                  {/* Alternatives */}
                  {result.listing.titleAlternatives.length > 0 && (
                    <div className="rounded-xl border border-border bg-card p-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Alternative Titles</h4>
                      {result.listing.titleAlternatives.map((alt, i) => (
                        <div key={i} className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
                          <div className="flex-1">
                            <p className="text-sm">{alt}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{alt.length}/80 chars</p>
                          </div>
                          <Button size="sm" variant="ghost" className="text-xs h-7 shrink-0" onClick={() => setEditedTitle(alt.slice(0, 80))}>
                            Use this
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Title scoring breakdown */}
                  <div className="rounded-xl border border-border bg-card p-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Title Score Breakdown</h4>
                    {[
                      { label: "Length (40+ chars ideal)", value: editedTitle.length >= 60 ? 100 : editedTitle.length >= 40 ? 60 : 20 },
                      { label: "Under 80 chars", value: editedTitle.length <= 80 ? 100 : 0 },
                      { label: "Keyword density", value: result.listing.titleScore },
                      { label: "Brand presence", value: inputBrand && editedTitle.toLowerCase().includes(inputBrand.toLowerCase()) ? 100 : 40 },
                    ].map(item => (
                      <div key={item.label} className="mb-2.5">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className={item.value >= 75 ? "text-green-400" : item.value >= 50 ? "text-yellow-400" : "text-red-400"}>{item.value}%</span>
                        </div>
                        <Progress value={item.value} className="h-1" />
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* ── DESCRIPTION TAB ─────────────────────────────────────── */}
                <TabsContent value="description" className="space-y-4 mt-4">
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <h4 className="text-sm font-semibold">HTML Description</h4>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => {
                          const w = window.open("", "_blank");
                          if (w) { w.document.write(editedDesc); w.document.close(); }
                        }}>
                          <Eye className="w-3 h-3 mr-1" /> Preview
                        </Button>
                        <CopyButton text={editedDesc} />
                      </div>
                    </div>
                    <Textarea
                      value={editedDesc}
                      onChange={e => setEditedDesc(e.target.value)}
                      rows={16}
                      className="text-xs font-mono rounded-none border-0 resize-none"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground bg-secondary/30 rounded-lg p-3 space-y-1">
                    <p>✓ Mobile-first layout (max-width: 700px)</p>
                    <p>✓ No external links or off-eBay contact info</p>
                    <p>✓ Trust signals + shipping policy included</p>
                    <p>✓ Bullet-first structure for scanning</p>
                  </div>
                </TabsContent>

                {/* ── IMAGES TAB ────────────────────────────────────────────── */}
                <TabsContent value="images" className="space-y-4 mt-4">
                  {result.rankedImages.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-8 text-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No images found or analyzed</p>
                      <Button size="sm" className="mt-3 text-xs" onClick={sendToBatch}>Upload images via Batch</Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">{result.rankedImages.length} images analyzed — ranked by eBay quality score</p>
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={sendToBatch}>
                          <Zap className="w-3 h-3 mr-1" /> Upscale All
                        </Button>
                      </div>
                      {result.rankedImages.map((img, i) => (
                        <div key={img.url} className={`rounded-xl border bg-card overflow-hidden ${i === 0 ? "border-primary/40" : "border-border"}`}>
                          <div className="flex items-start gap-3 p-3">
                            <div className="relative shrink-0">
                              <img src={img.url} alt={`Image ${i + 1}`} className="w-16 h-16 rounded-lg object-cover bg-secondary/30" onError={e => { (e.target as HTMLImageElement).style.opacity = "0.2"; }} />
                              {i === 0 && <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center"><Star className="w-2.5 h-2.5 text-white fill-white" /></div>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs font-bold ${img.score >= 70 ? "text-green-400" : img.score >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                                    {img.score}/100
                                  </span>
                                  {i === 0 && <span className="text-[10px] text-primary font-medium">Best for main listing</span>}
                                  {img.isMainCandidate && i > 0 && <span className="text-[10px] text-primary">Main candidate</span>}
                                </div>
                                {img.width && <span className="text-[10px] text-muted-foreground">{img.width}×{img.height}</span>}
                              </div>
                              <Progress value={img.score} className="h-1 mb-2" />
                              <div className="flex flex-wrap gap-1">
                                {img.reasons.slice(0, 3).map(r => (
                                  <span key={r} className={`text-[10px] px-1.5 py-0.5 rounded ${r.includes("White") || r.includes("High") || r.includes("Square") || r.includes("Sharp") ? "bg-green-500/10 text-green-400" : "bg-secondary text-muted-foreground"}`}>
                                    {r}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ── COMPETITORS TAB ───────────────────────────────────────── */}
                <TabsContent value="competitors" className="space-y-4 mt-4">
                  {!result.competitors ? (
                    <div className="rounded-xl border border-border bg-card p-8 text-center">
                      <BarChart2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Competitor data unavailable</p>
                      <p className="text-xs text-muted-foreground mt-1">eBay may have blocked the request</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Market stats */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-border bg-card p-4">
                          <p className="text-xs text-muted-foreground mb-1">Active Listings</p>
                          <p className="text-2xl font-bold text-foreground">{result.competitors.totalListings.toLocaleString()}</p>
                          <p className={`text-xs font-medium mt-1 flex items-center gap-1 ${COMPETITION_COLOR[result.competitors.competitionLevel]}`}>
                            {COMPETITION_ICON[result.competitors.competitionLevel]}
                            {result.competitors.competitionLevel} competition
                          </p>
                        </div>
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                          <p className="text-xs text-primary mb-1 font-medium">Recommended Price</p>
                          <p className="text-2xl font-bold text-primary">${result.competitors.recommendedPrice}</p>
                          <p className="text-xs text-muted-foreground mt-1">3% below market avg</p>
                        </div>
                      </div>

                      {/* Price range */}
                      <div className="rounded-xl border border-border bg-card p-4">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Live Market Price Range</h4>
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Min</p>
                            <p className="text-lg font-bold">${result.competitors.minPrice}</p>
                          </div>
                          <div className="flex-1 h-2 bg-secondary rounded-full relative">
                            <div
                              className="absolute h-2 bg-primary/30 rounded-full"
                              style={{
                                left: "0%",
                                width: `${((result.competitors.recommendedPrice - result.competitors.minPrice) / (result.competitors.maxPrice - result.competitors.minPrice)) * 100}%`
                              }}
                            />
                            <div
                              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background"
                              style={{
                                left: `${((result.competitors.recommendedPrice - result.competitors.minPrice) / (result.competitors.maxPrice - result.competitors.minPrice)) * 100}%`,
                                transform: "translate(-50%, -50%)"
                              }}
                            />
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Max</p>
                            <p className="text-lg font-bold">${result.competitors.maxPrice}</p>
                          </div>
                        </div>
                        <p className="text-xs text-center text-primary mt-2">Avg: ${result.competitors.avgPrice}</p>
                      </div>

                      {/* Competitor titles */}
                      {result.competitors.topTitles.length > 0 && (
                        <div className="rounded-xl border border-border bg-card p-4">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Top Competitor Titles</h4>
                          <div className="space-y-2">
                            {result.competitors.topTitles.map((t, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <span className="text-muted-foreground shrink-0">#{i + 1}</span>
                                <p className="text-foreground line-clamp-2">{t}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Win strategy */}
                      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                        <h4 className="text-xs font-semibold text-green-400 mb-2 flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5" /> Winning Strategy
                        </h4>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          <li>• Price at <strong className="text-foreground">${result.competitors.recommendedPrice}</strong> (below market avg, wins Buy Box position)</li>
                          <li>• Use white background main image (eBay search CTR +23%)</li>
                          <li>• Add 12+ item specifics for eBay search filter visibility</li>
                          <li>• Enable GTC (Good Till Cancelled) listing for consistent rank</li>
                          {result.competitors.competitionLevel === "high" && <li>• High competition — focus on niche keywords &amp; fast shipping</li>}
                          {result.competitors.competitionLevel === "low" && <li>• Low competition — great opportunity, price at market max</li>}
                        </ul>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
