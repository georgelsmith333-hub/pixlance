import { useState, useCallback } from "react";
import {
  Search, Globe, Download, Package, Wand2, Loader2, ExternalLink,
  Image as ImageIcon, ShoppingCart, Star, CheckCircle2, XCircle,
  AlertCircle, Zap, Copy, Check, FolderOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface ScrapeResult {
  success: boolean;
  platform: "aliexpress" | "ebay" | "amazon" | "generic";
  url: string;
  title: string;
  price: string;
  rating: string;
  images: string[];
  count: number;
}

interface ScrapedImage {
  url: string;
  selected: boolean;
  status: "idle" | "fetching" | "done" | "error";
  dataUrl?: string;
  sizeBytes?: number;
}

const PLATFORM_COLORS: Record<string, string> = {
  aliexpress: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  ebay: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  amazon: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  generic: "bg-secondary text-muted-foreground border-border",
};

const PLATFORM_LABELS: Record<string, string> = {
  aliexpress: "🛍 AliExpress",
  ebay: "🏪 eBay",
  amazon: "📦 Amazon",
  generic: "🌐 Website",
};

const EXAMPLE_URLS = [
  { label: "AliExpress Product", url: "https://www.aliexpress.com/item/1005006142621694.html" },
  { label: "eBay Listing", url: "https://www.ebay.com/itm/123456789012" },
  { label: "Amazon Product", url: "https://www.amazon.com/dp/B08N5WRWNW" },
];

export default function Scraper() {
  const [url, setUrl] = useState("");
  const [maxImages, setMaxImages] = useState(50);
  const [autoDownload, setAutoDownload] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [images, setImages] = useState<ScrapedImage[]>([]);
  const [fetchingAll, setFetchingAll] = useState(false);
  const [fetchProgress, setFetchProgress] = useState(0);
  const [copiedTitle, setCopiedTitle] = useState(false);

  const handleScrape = async () => {
    const trimmed = url.trim();
    if (!trimmed) { toast.error("Enter a product URL"); return; }
    setLoading(true);
    setResult(null);
    setImages([]);
    try {
      const res = await fetch(`/api/tools/scrape?url=${encodeURIComponent(trimmed)}&maxImages=${maxImages}`, {
        credentials: "include",
      });
      const data = await res.json() as ScrapeResult & { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Scraping failed");
        return;
      }
      setResult(data);
      setImages(data.images.map(imgUrl => ({
        url: imgUrl,
        selected: true,
        status: "idle",
      })));
      toast.success(`Found ${data.count} images on ${data.platform}`);

      if (autoDownload && data.images.length > 0) {
        void fetchSelectedImages(data.images.map(imgUrl => ({ url: imgUrl, selected: true, status: "idle" as const })));
      }
    } catch (err) {
      toast.error(`Failed: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchSelectedImages = useCallback(async (imgs: ScrapedImage[]) => {
    const selected = imgs.filter(i => i.selected);
    if (!selected.length) { toast.error("Select at least one image"); return; }
    setFetchingAll(true);
    setFetchProgress(0);

    let done = 0;
    await Promise.all(
      selected.map(async (img, idx) => {
        setImages(prev => prev.map(i => i.url === img.url ? { ...i, status: "fetching" } : i));
        try {
          const res = await fetch("/api/tools/scrape/fetch-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ imageUrl: img.url }),
          });
          const data = await res.json() as { imageData?: string; sizeBytes?: number; error?: string };
          if (!res.ok || !data.imageData) {
            setImages(prev => prev.map(i => i.url === img.url ? { ...i, status: "error" } : i));
          } else {
            setImages(prev => prev.map(i => i.url === img.url ? {
              ...i, status: "done", dataUrl: data.imageData, sizeBytes: data.sizeBytes,
            } : i));
          }
        } catch {
          setImages(prev => prev.map(i => i.url === img.url ? { ...i, status: "error" } : i));
        }
        done++;
        setFetchProgress(Math.round((done / selected.length) * 100));
      })
    );
    setFetchingAll(false);
    const doneCount = selected.length - selected.filter(i => i.status === "error").length;
    toast.success(`Fetched ${done} images — ready to send to Batch or download`);
  }, []);

  const toggleSelect = (imgUrl: string) => {
    setImages(prev => prev.map(i => i.url === imgUrl ? { ...i, selected: !i.selected } : i));
  };

  const selectAll = () => setImages(prev => prev.map(i => ({ ...i, selected: true })));
  const selectNone = () => setImages(prev => prev.map(i => ({ ...i, selected: false })));

  const handleDownloadSelected = async () => {
    const ready = images.filter(i => i.selected && i.status === "done" && i.dataUrl);
    if (!ready.length) {
      toast.error("Fetch images first, then download");
      return;
    }
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    ready.forEach((img, idx) => {
      const ext = img.url.split(".").pop()?.split("?")[0] ?? "jpg";
      const base64 = img.dataUrl!.split(",")[1];
      zip.file(`product_${String(idx + 1).padStart(3, "0")}.${ext}`, base64, { base64: true });
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `scraped-images-${Date.now()}.zip`;
    a.click();
    toast.success(`Downloaded ${ready.length} images as ZIP`);
  };

  const handleSendToBatch = () => {
    const ready = images.filter(i => i.selected && i.status === "done" && i.dataUrl);
    if (!ready.length) { toast.error("Fetch images first"); return; }
    // Store in sessionStorage for batch page to pick up
    const payload = ready.map((img, idx) => ({
      dataUrl: img.dataUrl!,
      filename: `scraped_${String(idx + 1).padStart(3, "0")}.jpg`,
      sizeBytes: img.sizeBytes ?? 0,
    }));
    sessionStorage.setItem("scraper_to_batch", JSON.stringify(payload));
    toast.success(`${ready.length} images ready — go to Batch Processing to upscale them`);
    window.location.href = "/batch";
  };

  const doneCount = images.filter(i => i.status === "done").length;
  const selectedCount = images.filter(i => i.selected).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Globe className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Product Image Scraper</h1>
          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">Free · No API Key</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Paste any AliExpress, eBay, Amazon or product page URL — we extract all product images instantly. Then send them to Batch Processing for auto-upscaling.
        </p>
      </div>

      {/* URL Input */}
      <div className="rounded-2xl border border-border bg-card p-6 mb-6">
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="https://www.aliexpress.com/item/... or any product URL"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && void handleScrape()}
              className="pl-10 text-sm h-11"
            />
          </div>
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11 px-6"
            disabled={loading || !url.trim()}
            onClick={() => void handleScrape()}
          >
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scraping...</> : <><Search className="w-4 h-4 mr-2" />Scrape</>}
          </Button>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Example URLs */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">Try:</span>
            {EXAMPLE_URLS.map(ex => (
              <button
                key={ex.url}
                onClick={() => setUrl(ex.url)}
                className="text-xs text-primary hover:underline"
              >
                {ex.label}
              </button>
            ))}
          </div>

          {/* Options */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Max images:</Label>
              <select
                value={maxImages}
                onChange={e => setMaxImages(Number(e.target.value))}
                className="text-xs h-7 px-2 rounded-lg border border-border bg-background text-foreground"
              >
                {[10, 20, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={autoDownload} onCheckedChange={setAutoDownload} />
              <Label className="text-xs text-muted-foreground">Auto-fetch after scrape</Label>
            </div>
          </div>
        </div>
      </div>

      {/* Product Info */}
      {result && (
        <div className="rounded-2xl border border-border bg-card p-5 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${PLATFORM_COLORS[result.platform]}`}>
                  {PLATFORM_LABELS[result.platform]}
                </span>
                {result.rating && (
                  <span className="flex items-center gap-1 text-xs text-yellow-400">
                    <Star className="w-3 h-3 fill-yellow-400" /> {result.rating}
                  </span>
                )}
                {result.price && (
                  <span className="text-xs font-semibold text-green-400">{result.price}</span>
                )}
              </div>
              {result.title && (
                <div className="flex items-start gap-2">
                  <h2 className="text-sm font-medium text-foreground line-clamp-2 flex-1">{result.title}</h2>
                  <button
                    onClick={() => { void navigator.clipboard.writeText(result.title); setCopiedTitle(true); setTimeout(() => setCopiedTitle(false), 1500); }}
                    className="text-muted-foreground hover:text-primary transition-colors shrink-0 mt-0.5"
                  >
                    {copiedTitle ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-1">
                <ExternalLink className="w-3 h-3" /> {result.url.slice(0, 70)}...
              </a>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-primary">{result.count}</p>
              <p className="text-xs text-muted-foreground">images found</p>
            </div>
          </div>
        </div>
      )}

      {/* Fetch progress */}
      {fetchingAll && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Fetching images... {fetchProgress}%
            </span>
            <span className="text-xs text-muted-foreground">{doneCount}/{selectedCount}</span>
          </div>
          <Progress value={fetchProgress} className="h-2" />
        </div>
      )}

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">{images.length} images · {selectedCount} selected</span>
              <button onClick={selectAll} className="text-xs text-primary hover:underline">All</button>
              <button onClick={selectNone} className="text-xs text-muted-foreground hover:underline">None</button>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8"
                disabled={fetchingAll || !selectedCount}
                onClick={() => void fetchSelectedImages(images)}
              >
                {fetchingAll ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                Fetch Selected ({selectedCount})
              </Button>
              {doneCount > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8"
                    onClick={() => void handleDownloadSelected()}
                  >
                    <Package className="w-3.5 h-3.5 mr-1.5" /> Download ZIP ({doneCount})
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={handleSendToBatch}
                  >
                    <Zap className="w-3.5 h-3.5 mr-1.5" /> Send to Batch Upscaler ({doneCount})
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-4 max-h-[600px] overflow-y-auto">
            {images.map((img, idx) => (
              <div
                key={img.url}
                className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer group ${
                  img.selected ? "border-primary shadow-lg shadow-primary/10" : "border-border opacity-60"
                }`}
                onClick={() => toggleSelect(img.url)}
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-secondary/30 flex items-center justify-center overflow-hidden">
                  {img.dataUrl ? (
                    <img src={img.dataUrl} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <img
                      src={img.url}
                      alt={`Product ${idx + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="flex flex-col items-center justify-center w-full h-full gap-1 text-muted-foreground"><svg class="w-5 h-5 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg><span class="text-[10px]">No preview</span></div>`;
                      }}
                    />
                  )}
                </div>

                {/* Status overlay */}
                <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                  img.status === "fetching" ? "bg-black/40" : "opacity-0 group-hover:opacity-100 bg-black/20"
                }`}>
                  {img.status === "fetching" && <Loader2 className="w-5 h-5 text-white animate-spin" />}
                  {img.status === "done" && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                  {img.status === "error" && <XCircle className="w-5 h-5 text-red-400" />}
                </div>

                {/* Selection indicator */}
                <div className={`absolute top-1.5 left-1.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  img.selected ? "bg-primary border-primary" : "bg-black/40 border-white/60"
                }`}>
                  {img.selected && <Check className="w-2.5 h-2.5 text-white" />}
                </div>

                {/* Size badge */}
                {img.sizeBytes && (
                  <div className="absolute bottom-1 right-1 text-[9px] bg-black/60 text-white px-1 py-0.5 rounded">
                    {(img.sizeBytes / 1024).toFixed(0)}KB
                  </div>
                )}

                {/* Image number */}
                <div className="absolute bottom-1 left-1 text-[9px] bg-black/60 text-white/80 px-1 py-0.5 rounded">
                  #{idx + 1}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          {doneCount > 0 && (
            <div className="px-4 py-3 border-t border-border bg-secondary/20 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                {doneCount} images fetched and ready
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => void handleDownloadSelected()}>
                  <Package className="w-3 h-3 mr-1" /> ZIP Download
                </Button>
                <Button size="sm" className="text-xs h-7 bg-primary text-primary-foreground" onClick={handleSendToBatch}>
                  <Zap className="w-3 h-3 mr-1" /> Auto-Upscale in Batch
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          {[
            { icon: ShoppingCart, title: "AliExpress", desc: "Extract all product photos from any AliExpress listing", color: "text-orange-400" },
            { icon: Globe, title: "eBay / Amazon", desc: "Grab listing images directly from eBay and Amazon product pages", color: "text-blue-400" },
            { icon: Zap, title: "Auto Upscale", desc: "Send scraped images to Batch Processor for instant eBay-ready upscaling", color: "text-primary" },
          ].map(item => (
            <div key={item.title} className="rounded-xl border border-border bg-card p-4 text-center">
              <item.icon className={`w-6 h-6 mx-auto mb-2 ${item.color}`} />
              <p className="text-sm font-semibold text-foreground mb-1">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Warning */}
      <div className="mt-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-yellow-500">Note:</span> Some sites (like AliExpress) may block scraping. If images don't load, try copying the product page source manually, or use the site's official export options. We never store or redistribute scraped content — all processing is in your browser session only.
        </p>
      </div>
    </div>
  );
}
