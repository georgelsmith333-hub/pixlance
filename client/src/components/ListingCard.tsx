import { useState } from "react";
import { Copy, Check, Download, ChevronDown, ChevronUp, AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import SEOScoreRing from "@/components/SEOScoreRing";
import { cn, scoreColor, scoreBg, countChars } from "@/lib/utils";
import { toast } from "sonner";

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
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); toast.success(label ? `${label} copied!` : "Copied!"); }}
      className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function ListingCard({ listing, seoReport, onExport }: Props) {
  const [expanded, setExpanded] = useState(false);
  const titleInfo = countChars(listing.title ?? "");
  const score = seoReport?.overallScore ?? listing.seoScore ?? 0;

  const exportListing = () => {
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
      `\nSEO SCORE: ${score}/100`,
    ].filter(Boolean).join("\n");

    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pixlance_listing_${Date.now()}.txt`;
    a.click();
    onExport?.();
    toast.success("Listing exported!");
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-start gap-4">
          <SEOScoreRing score={score} size={72} />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {listing.veroWarning && (
                    <Badge variant="warning" className="gap-1"><AlertTriangle className="w-3 h-3" />VERO Check</Badge>
                  )}
                  {listing.category && <Badge variant="secondary" className="text-xs">{listing.category}</Badge>}
                  {listing.condition && <Badge variant="outline" className="text-xs">{listing.condition}</Badge>}
                </div>
                <div className="flex items-start gap-2">
                  <p className="text-sm font-semibold text-foreground leading-relaxed flex-1">{listing.title}</p>
                  <CopyBtn text={listing.title ?? ""} label="Title" />
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 bg-secondary rounded-full h-1.5">
                    <div className={cn("h-1.5 rounded-full transition-all", titleInfo.ok ? "bg-green-500" : "bg-red-500")}
                      style={{ width: `${titleInfo.pct}%` }} />
                  </div>
                  <span className={cn("text-xs font-mono", titleInfo.ok ? "text-green-400" : "text-red-400")}>
                    {titleInfo.count}/80
                  </span>
                </div>
              </div>
              {listing.price && (
                <div className="text-right shrink-0">
                  <p className="text-xl font-bold text-primary">£{listing.price}</p>
                  <p className="text-xs text-muted-foreground">suggested</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* VERO warning */}
        {listing.veroWarning && listing.veroNote && (
          <div className="mt-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {listing.veroNote}
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
        {[
          { label: "Title", score: seoReport?.titleScore ?? 0 },
          { label: "Description", score: seoReport?.descriptionScore ?? 0 },
          { label: "Specifics", score: seoReport?.specificsScore ?? 0 },
        ].map(s => (
          <div key={s.label} className="px-4 py-2.5 text-center">
            <div className={cn("text-sm font-bold", scoreColor(s.score))}>{s.score}</div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Keywords */}
      {listing.keywords && listing.keywords.length > 0 && (
        <div className="px-5 py-3 border-b border-border flex flex-wrap gap-1.5">
          {listing.keywords.map(kw => (
            <span key={kw} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20">{kw}</span>
          ))}
        </div>
      )}

      {/* Cassini Tips */}
      {listing.cassiniTips && listing.cassiniTips.length > 0 && (
        <div className="px-5 py-3 border-b border-border space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-2">
            <Sparkles className="w-3.5 h-3.5" />Cassini Ranking Tips
          </div>
          {listing.cassiniTips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="text-primary font-bold shrink-0">{i + 1}.</span>{tip}
            </div>
          ))}
        </div>
      )}

      {/* SEO Issues */}
      {seoReport?.issues && seoReport.issues.length > 0 && (
        <div className="px-5 py-3 border-b border-border space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SEO Issues</p>
          {seoReport.issues.slice(0, 3).map((issue, i) => (
            <div key={i} className={cn("p-2.5 rounded-lg text-xs border flex items-start gap-2",
              issue.severity === "critical" ? "border-red-500/20 bg-red-500/5 text-red-400" : "border-amber-500/20 bg-amber-500/5 text-amber-400"
            )}>
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div><p className="font-medium">{issue.message}</p><p className="text-xs opacity-80 mt-0.5">{issue.fix}</p></div>
            </div>
          ))}
        </div>
      )}

      {/* Expandable: Full description + item specifics */}
      <button onClick={() => setExpanded(!expanded)} className="w-full px-5 py-3 flex items-center justify-between text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors">
        <span>{expanded ? "Hide" : "Show"} full description & item specifics</span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="border-t border-border space-y-4 p-5 animate-fade-in">
          {/* Item Specifics */}
          {listing.itemSpecifics && Object.keys(listing.itemSpecifics).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Item Specifics</p>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(listing.itemSpecifics).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-xs bg-secondary/40 rounded-lg px-3 py-1.5">
                    <span className="text-muted-foreground shrink-0">{k}:</span>
                    <span className="text-foreground font-medium truncate">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {listing.description && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</p>
                <CopyBtn text={listing.description} label="Description" />
              </div>
              <div className="prose-sm text-sm text-foreground/80 leading-relaxed rounded-xl border border-border bg-secondary/20 p-4 max-h-64 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: listing.description }} />
            </div>
          )}

          {/* Shipping */}
          {listing.shippingRecommendation && (
            <div className="text-xs text-muted-foreground p-3 rounded-lg bg-secondary/30 border border-border">
              <span className="font-semibold text-foreground">Shipping: </span>{listing.shippingRecommendation}
            </div>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="px-5 py-3 border-t border-border flex items-center gap-2 bg-secondary/10">
        <Button size="sm" className="gap-1.5 text-xs" onClick={exportListing}>
          <Download className="w-3.5 h-3.5" /> Export
        </Button>
        <Button variant="outline" size="sm" className="text-xs gap-1.5"
          onClick={() => { void navigator.clipboard.writeText(listing.title ?? ""); toast.success("Title copied!"); }}>
          <Copy className="w-3.5 h-3.5" /> Copy Title
        </Button>
        {listing.subtitle && (
          <Button variant="ghost" size="sm" className="text-xs gap-1.5"
            onClick={() => { void navigator.clipboard.writeText(listing.subtitle ?? ""); toast.success("Subtitle copied!"); }}>
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
