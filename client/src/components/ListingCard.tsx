import { useState } from "react";
import { Copy, Check, Download, ChevronDown, ChevronUp, AlertTriangle, Sparkles, Package, Loader2, Zap, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import SEOScoreRing from "@/components/SEOScoreRing";
import { cn, scoreColor, countChars } from "@/lib/utils";
import { toast } from "sonner";
import { callAIClient } from "@/lib/ai";

export interface GeneratedListing {
  title: string;
  subtitle?: string;
  category?: string;
  condition?: string;
  price?: number;
  itemSpecifics?: Record<string, string>;
  description?: string;
  keywords?: string[];
  tags?: string[];
  shippingRecommendation?: string;
  seoScore?: number;
  cassiniTips?: string[];
  veroWarning?: boolean;
  veroNote?: string;
}

export interface SEOReport {
  overallScore: number;
  titleScore: number;
  descriptionScore: number;
  specificsScore: number;
  issues?: { severity: string; message: string; fix: string }[];
  improvements?: string[];
  cassiniFactors?: Record<string, { score: number; weight: number; note: string }>;
}

interface Props {
  listing: GeneratedListing;
  seoReport?: SEOReport;
  onExport?: () => void;
  onUpdate?: (newListing: GeneratedListing, newReport: SEOReport) => void;
  storeName?: string;
  colorScheme?: string;
  marketplace?: string;
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        toast.success(label ? `${label} copied!` : "Copied!");
      }}
      className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function ListingCard({
  listing, seoReport, onExport, onUpdate,
  storeName = "My eBay Store", colorScheme = "blue", marketplace = "eBay UK",
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedListing, setOptimizedListing] = useState<GeneratedListing | null>(null);
  const [optimizedReport, setOptimizedReport] = useState<SEOReport | null>(null);
  const [showOptimized, setShowOptimized] = useState(false);
  const [improvements, setImprovements] = useState<string[]>([]);

  const activeListing = showOptimized && optimizedListing ? optimizedListing : listing;
  const activeReport = showOptimized && optimizedReport ? optimizedReport : seoReport;

  const titleInfo = countChars(activeListing.title ?? "");
  const score = activeReport?.overallScore ?? activeListing.seoScore ?? 0;

  // ─── 1-Click Full AI Optimizer (client-side AI — no server rate limit) ───────
  const optimizeListing = async () => {
    setOptimizing(true);
    try {
      // Step 1: Get the optimization prompt from server (fast, no AI call)
      const promptRes = await fetch("/api/listings/optimize-get-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing, marketplace }),
      });
      if (!promptRes.ok) throw new Error("Failed to build optimization prompt");
      const { prompt, systemPrompt } = await promptRes.json() as { prompt: string; systemPrompt: string };

      // Step 2: Call Pollinations directly from browser (user's unique IP — no rate limits)
      const rawAI = await callAIClient(
        `${prompt}\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown, no explanation, no code blocks. Pure JSON only.`,
        "listing",
        systemPrompt,
        65000
      );

      // Step 3: Parse + SEO score on server
      const parseRes = await fetch("/api/listings/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawAI }),
      });
      if (!parseRes.ok) throw new Error("Failed to parse optimized listing");
      const parsed = await parseRes.json() as { listing: GeneratedListing; seoReport: SEOReport };

      // Extract improvements from AI response
      let improvements: string[] = [];
      try {
        const match = rawAI.match(/\{[\s\S]*\}/);
        if (match) {
          const obj = JSON.parse(match[0]) as { improvements?: string[] };
          improvements = obj.improvements ?? [];
        }
      } catch { /* ignore */ }

      setOptimizedListing(parsed.listing);
      setOptimizedReport(parsed.seoReport);
      setImprovements(improvements);
      setShowOptimized(true);
      onUpdate?.(parsed.listing, parsed.seoReport);
      toast.success(`Listing optimized! Score: ${parsed.seoReport.overallScore}/100 ↑`);
    } catch (err) {
      toast.error(`Optimize failed: ${String(err)}`);
    } finally {
      setOptimizing(false);
    }
  };

  const exportTxt = () => {
    const text = [
      `TITLE: ${activeListing.title}`,
      activeListing.subtitle ? `SUBTITLE: ${activeListing.subtitle}` : "",
      `CATEGORY: ${activeListing.category ?? ""}`,
      `CONDITION: ${activeListing.condition ?? "New"}`,
      `PRICE: £${activeListing.price ?? ""}`,
      `\nITEM SPECIFICS:`,
      ...Object.entries(activeListing.itemSpecifics ?? {}).map(([k, v]) => `  ${k}: ${v}`),
      `\nDESCRIPTION:\n${activeListing.description ?? ""}`,
      `\nKEYWORDS: ${activeListing.keywords?.join(", ") ?? ""}`,
      `\nSEO SCORE: ${score}/100`,
    ].filter(Boolean).join("\n");

    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pixlance_listing_${Date.now()}.txt`;
    a.click();
    onExport?.();
    toast.success("Listing exported as text!");
  };

  const exportZip = async () => {
    setZipLoading(true);
    try {
      const res = await fetch("/api/export/from-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing: {
            title: activeListing.title,
            subtitle: activeListing.subtitle,
            category: activeListing.category,
            condition: activeListing.condition ?? "New",
            price: activeListing.price ?? 0,
            description: activeListing.description ?? "",
            itemSpecifics: activeListing.itemSpecifics ?? {},
            keywords: activeListing.keywords ?? [],
            tags: activeListing.tags ?? [],
            shippingRecommendation: activeListing.shippingRecommendation,
            seoScore: score,
            cassiniTips: activeListing.cassiniTips ?? [],
          },
          storeName, colorScheme,
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? "Export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pixlance_${activeListing.title?.slice(0, 30).replace(/[^a-z0-9]/gi, "_").toLowerCase() ?? "listing"}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Full listing package downloaded!");
      onExport?.();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setZipLoading(false);
    }
  };

  const scoreDiff = optimizedReport && seoReport
    ? optimizedReport.overallScore - seoReport.overallScore
    : 0;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden animate-fade-in">

      {/* Optimization toggle bar */}
      {optimizedListing && (
        <div className="flex items-center justify-between px-5 py-2.5 bg-green-500/10 border-b border-green-500/20">
          <div className="flex items-center gap-2 text-xs text-green-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="font-semibold">AI Optimized</span>
            {scoreDiff > 0 && (
              <Badge variant="success" className="text-[10px] h-4">+{scoreDiff} score</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOptimized(!showOptimized)}
              className="text-xs px-3 py-1 rounded-full border border-green-500/30 hover:bg-green-500/10 transition-colors text-green-400"
            >
              {showOptimized ? "View Original" : "View Optimized"}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-start gap-4">
          <SEOScoreRing score={score} size={72} />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {activeListing.veroWarning && (
                    <Badge variant="warning" className="gap-1"><AlertTriangle className="w-3 h-3" />VERO Check</Badge>
                  )}
                  {activeListing.category && <Badge variant="secondary" className="text-xs">{activeListing.category}</Badge>}
                  {activeListing.condition && <Badge variant="outline" className="text-xs">{activeListing.condition}</Badge>}
                  {showOptimized && <Badge variant="success" className="text-xs">Optimized</Badge>}
                </div>
                <div className="flex items-start gap-2">
                  <p className="text-sm font-semibold text-foreground leading-relaxed flex-1">{activeListing.title}</p>
                  <CopyBtn text={activeListing.title ?? ""} label="Title" />
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 bg-secondary rounded-full h-1.5">
                    <div
                      className={cn("h-1.5 rounded-full transition-all", titleInfo.ok ? "bg-green-500" : "bg-red-500")}
                      style={{ width: `${titleInfo.pct}%` }}
                    />
                  </div>
                  <span className={cn("text-xs font-mono", titleInfo.ok ? "text-green-400" : "text-red-400")}>
                    {titleInfo.count}/80
                  </span>
                </div>
                {activeListing.subtitle && (
                  <p className="text-xs text-muted-foreground mt-1 italic">{activeListing.subtitle}</p>
                )}
              </div>
              {activeListing.price && (
                <div className="text-right shrink-0">
                  <p className="text-xl font-bold text-primary">£{activeListing.price}</p>
                  <p className="text-xs text-muted-foreground">suggested</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* VERO warning */}
        {activeListing.veroWarning && activeListing.veroNote && (
          <div className="mt-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {activeListing.veroNote}
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
        {[
          { label: "Title", score: activeReport?.titleScore ?? 0 },
          { label: "Description", score: activeReport?.descriptionScore ?? 0 },
          { label: "Specifics", score: activeReport?.specificsScore ?? 0 },
        ].map(s => (
          <div key={s.label} className="px-4 py-2.5 text-center">
            <div className={cn("text-sm font-bold", scoreColor(s.score))}>{s.score}</div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Improvements list (after optimization) */}
      {showOptimized && improvements.length > 0 && (
        <div className="px-5 py-3 border-b border-border bg-green-500/5">
          <p className="text-xs font-semibold text-green-400 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />What AI improved
          </p>
          <div className="space-y-1">
            {improvements.slice(0, 4).map((imp, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <span className="text-green-400 shrink-0">✓</span>
                <span>{imp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keywords */}
      {activeListing.keywords && activeListing.keywords.length > 0 && (
        <div className="px-5 py-3 border-b border-border flex flex-wrap gap-1.5">
          {activeListing.keywords.map(kw => (
            <span key={kw} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20">{kw}</span>
          ))}
        </div>
      )}

      {/* Cassini Tips */}
      {activeListing.cassiniTips && activeListing.cassiniTips.length > 0 && (
        <div className="px-5 py-3 border-b border-border space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-2">
            <Sparkles className="w-3.5 h-3.5" />Cassini Ranking Tips
          </div>
          {activeListing.cassiniTips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="text-primary font-bold shrink-0">{i + 1}.</span>{tip}
            </div>
          ))}
        </div>
      )}

      {/* SEO Issues */}
      {activeReport?.issues && activeReport.issues.length > 0 && (
        <div className="px-5 py-3 border-b border-border space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SEO Issues</p>
          {activeReport.issues.slice(0, 3).map((issue, i) => (
            <div key={i} className={cn(
              "p-2.5 rounded-lg text-xs border flex items-start gap-2",
              issue.severity === "critical"
                ? "border-red-500/20 bg-red-500/5 text-red-400"
                : "border-amber-500/20 bg-amber-500/5 text-amber-400"
            )}>
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{issue.message}</p>
                <p className="text-xs opacity-80 mt-0.5">{issue.fix}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expandable: Full description + item specifics */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 flex items-center justify-between text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors"
      >
        <span>{expanded ? "Hide" : "Show"} full description & item specifics</span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="border-t border-border space-y-4 p-5 animate-fade-in">
          {/* Item Specifics */}
          {activeListing.itemSpecifics && Object.keys(activeListing.itemSpecifics).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Item Specifics</p>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(activeListing.itemSpecifics).filter(([, v]) => v && v !== "N/A").map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-xs bg-secondary/40 rounded-lg px-3 py-1.5">
                    <span className="text-muted-foreground shrink-0">{k}:</span>
                    <span className="text-foreground font-medium truncate">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {activeListing.description && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</p>
                <CopyBtn text={activeListing.description} label="Description" />
              </div>
              <div
                className="prose-sm text-sm text-foreground/80 leading-relaxed rounded-xl border border-border bg-secondary/20 p-4 max-h-64 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: activeListing.description }}
              />
            </div>
          )}

          {/* Shipping */}
          {activeListing.shippingRecommendation && (
            <div className="text-xs text-muted-foreground p-3 rounded-lg bg-secondary/30 border border-border">
              <span className="font-semibold text-foreground">Shipping: </span>
              {activeListing.shippingRecommendation}
            </div>
          )}

          {/* Cassini factors detail */}
          {activeReport?.cassiniFactors && Object.keys(activeReport.cassiniFactors).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Cassini Factors</p>
              <div className="space-y-2">
                {Object.entries(activeReport.cassiniFactors).map(([factor, data]) => (
                  <div key={factor} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground capitalize">{factor.replace(/([A-Z])/g, " $1").trim()}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-[10px]">{data.note}</span>
                        <span className={cn("font-bold", scoreColor(data.score))}>{data.score}</span>
                      </div>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div className={cn("h-1.5 rounded-full", data.score >= 70 ? "bg-green-500" : data.score >= 40 ? "bg-amber-500" : "bg-red-500")}
                        style={{ width: `${data.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="px-5 py-3 border-t border-border flex items-center gap-2 flex-wrap bg-secondary/10">
        {/* 1-click AI Optimizer */}
        <Button
          size="sm"
          className="gap-1.5 text-xs bg-gradient-to-r from-violet-600 to-primary hover:from-violet-700 hover:to-primary/90 glow"
          onClick={() => void optimizeListing()}
          disabled={optimizing}
        >
          {optimizing
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Optimizing...</>
            : <><Zap className="w-3.5 h-3.5" />1-Click Optimize</>
          }
        </Button>

        <Button size="sm" className="gap-1.5 text-xs" onClick={() => void exportZip()} disabled={zipLoading}>
          {zipLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
          {zipLoading ? "Packaging..." : "Export ZIP"}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exportTxt}>
          <Download className="w-3.5 h-3.5" /> Export TXT
        </Button>
        <Button
          variant="outline" size="sm" className="text-xs gap-1.5"
          onClick={() => { void navigator.clipboard.writeText(activeListing.title ?? ""); toast.success("Title copied!"); }}
        >
          <Copy className="w-3.5 h-3.5" /> Copy Title
        </Button>
        {activeListing.subtitle && (
          <Button
            variant="ghost" size="sm" className="text-xs gap-1.5"
            onClick={() => { void navigator.clipboard.writeText(activeListing.subtitle ?? ""); toast.success("Subtitle copied!"); }}
          >
            Copy Subtitle
          </Button>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          Cassini score: <span className={scoreColor(score)}>{score}/100</span>
        </div>
      </div>
    </div>
  );
}
