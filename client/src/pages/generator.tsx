import { useState } from "react";
import { motion } from "framer-motion";
import { Wand2, Link2, Type, Loader2, Globe, Package, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import ListingCard, { type GeneratedListing, type SEOReport } from "@/components/ListingCard";
import ImageDropzone from "@/components/ImageDropzone";
import { toast } from "sonner";
import { cn, MARKETPLACE_OPTIONS, CONDITION_OPTIONS } from "@/lib/utils";
import { saveToHistory } from "@/lib/history";

type InputMode = "keyword" | "url" | "manual" | "image";

interface GenerateResult {
  listing: GeneratedListing;
  seoReport: SEOReport;
  scraped?: Record<string, unknown>;
  keywords?: string[];
}

export default function Generator() {
  const [mode, setMode] = useState<InputMode>("keyword");
  const [keyword, setKeyword] = useState("");
  const [url, setUrl] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [marketplace, setMarketplace] = useState("eBay UK");
  const [condition, setCondition] = useState("New");
  const [brand, setBrand] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualDesc, setManualDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const generate = async () => {
    setLoading(true);
    setResult(null);
    try {
      let data: GenerateResult;

      if (mode === "url") {
        if (!url.trim()) { toast.error("Enter a supplier URL"); return; }
        const res = await fetch("/api/listings/from-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim(), marketplace }),
        });
        data = await res.json() as GenerateResult;
        if (!res.ok) throw new Error((data as unknown as { error: string }).error);
        toast.success("Scraped & generated listing!");
      } else {
        const product: Record<string, unknown> = { condition, marketplace };
        if (mode === "keyword") { product.title = keyword; product.keywords = [keyword]; }
        if (mode === "manual") { product.title = manualTitle; product.description = manualDesc; product.brand = brand; }
        if (mode === "image" && images.length) {
          // Submit image with description
          product.title = images[0].name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
          product.keywords = [product.title as string];
        }
        const res = await fetch("/api/listings/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product, marketplace }),
        });
        data = await res.json() as GenerateResult;
        if (!res.ok) throw new Error((data as unknown as { error: string }).error);
        toast.success("Listing generated!");
      }
      setResult(data);
      // Auto-save to history (localStorage + Neon DB)
      void saveToHistory(data.listing, {
        keyword: mode === "keyword" ? keyword : mode === "url" ? url : mode === "manual" ? manualTitle : images[0]?.name,
        mode,
        marketplace,
        seoReport: data.seoReport,
      }).then(() => {
        toast.success("Saved to history");
      });
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = () => {
    if (mode === "keyword") return keyword.trim().length >= 2;
    if (mode === "url") return url.trim().length > 5;
    if (mode === "manual") return manualTitle.trim().length >= 2;
    if (mode === "image") return images.length > 0;
    return false;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold">AI Listing Generator</h1>
          <Badge variant="default">Cassini Optimized</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Keyword, supplier URL, manual entry, or product image — AI generates the complete listing</p>
      </div>

      {/* Input card */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {/* Mode tabs */}
        <div className="flex border-b border-border">
          {([
            { id: "keyword", label: "Keyword / Title", icon: Type },
            { id: "url",     label: "Supplier URL",    icon: Globe },
            { id: "manual",  label: "Manual Input",    icon: Package },
            { id: "image",   label: "Product Image",   icon: Wand2 },
          ] as const).map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors border-b-2",
                mode === m.id ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
              <m.icon className="w-3.5 h-3.5 hidden sm:block" />
              <span className="hidden sm:block">{m.label}</span>
              <span className="sm:hidden">{m.id.charAt(0).toUpperCase() + m.id.slice(1)}</span>
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {/* Keyword */}
          {mode === "keyword" && (
            <div className="space-y-2">
              <Label>Product keyword or title</Label>
              <Input value={keyword} onChange={e => setKeyword(e.target.value)}
                placeholder="e.g. Wireless Bluetooth Earbuds, iPhone 15 Case, Garden Hose..."
                onKeyDown={e => { if (e.key === "Enter") void generate(); }} className="text-sm" />
              <p className="text-xs text-muted-foreground">AI will research keywords, detect category, and generate the full optimized listing</p>
            </div>
          )}

          {/* URL */}
          {mode === "url" && (
            <div className="space-y-2">
              <Label>Supplier / product URL</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={url} onChange={e => setUrl(e.target.value)}
                    placeholder="https://aliexpress.com/item/... or amazon.co.uk/dp/..."
                    className="pl-9 text-sm" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {["AliExpress", "Amazon", "Alibaba", "eBay"].map(s => (
                  <span key={s} className="text-xs px-2 py-0.5 bg-secondary rounded-full text-muted-foreground">{s}</span>
                ))}
                <span className="text-xs text-muted-foreground">and any product page</span>
              </div>
            </div>
          )}

          {/* Manual */}
          {mode === "manual" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Product Title</Label>
                  <Input value={manualTitle} onChange={e => setManualTitle(e.target.value)} placeholder="Product name or description" className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label>Brand (optional)</Label>
                  <Input value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Sony, Apple, Generic" className="text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Product Description / Specs (optional)</Label>
                <Textarea value={manualDesc} onChange={e => setManualDesc(e.target.value)}
                  placeholder="Paste product description, specifications, or any details..." rows={4} className="text-sm" />
              </div>
            </div>
          )}

          {/* Image */}
          {mode === "image" && (
            <ImageDropzone files={images} onFiles={setImages} multiple={false} maxFiles={1}
              label="Drop product image here" hint="AI identifies the product and generates a full listing" />
          )}

          {/* Advanced options */}
          <div>
            <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showAdvanced ? "Less options" : "Marketplace & condition"}
            </button>
            {showAdvanced && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
                <div className="space-y-1.5">
                  <Label>Marketplace</Label>
                  <Select value={marketplace} onValueChange={setMarketplace}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MARKETPLACE_OPTIONS.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Condition</Label>
                  <Select value={condition} onValueChange={setCondition}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPTIONS.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <Button onClick={() => void generate()} disabled={!canSubmit() || loading} className="w-full gap-2 glow" size="lg">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating Optimized Listing...</> : <><Wand2 className="w-4 h-4" /> Generate eBay Listing</>}
          </Button>

          {loading && (
            <div className="space-y-2">
              {["Analyzing product...", "Researching keywords...", "Building listing...", "Running SEO analysis..."].map((step, i) => (
                <div key={step} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                  {step}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Result */}
      {result?.listing && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          {result.scraped && (
            <div className="mb-4 p-3 rounded-xl border border-border bg-secondary/30 text-xs text-muted-foreground">
              Scraped from: <span className="text-foreground">{(result.scraped as { sourceDomain?: string }).sourceDomain}</span> —
              Images found: <span className="text-foreground">{((result.scraped as { images?: unknown[] }).images ?? []).length}</span> —
              Specs extracted: <span className="text-foreground">{Object.keys((result.scraped as { specs?: Record<string, unknown> }).specs ?? {}).length}</span>
            </div>
          )}
          {result.keywords && result.keywords.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">Extracted keywords:</span>
              {result.keywords.slice(0, 8).map(kw => (
                <span key={kw} className="text-xs px-2 py-0.5 bg-secondary rounded-full">{kw}</span>
              ))}
            </div>
          )}
          <ListingCard listing={result.listing} seoReport={result.seoReport} />
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => void generate()}>
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
