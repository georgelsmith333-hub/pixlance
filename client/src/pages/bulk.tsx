import { useState } from "react";
import { motion } from "framer-motion";
import { Package, Upload, Link2, Type, Loader2, ChevronDown, ChevronUp, CheckCircle2, XCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import ListingCard, { type GeneratedListing, type SEOReport } from "@/components/ListingCard";
import { toast } from "sonner";
import { MARKETPLACE_OPTIONS } from "@/lib/utils";
import { useDropzone } from "react-dropzone";

interface BulkResult {
  folder?: string;
  url?: string;
  keyword?: string;
  listing: GeneratedListing;
  seoReport?: SEOReport;
  images?: string[];
}

interface BulkResponse {
  total: number;
  processed: number;
  failed: number;
  results: BulkResult[];
  errors: { url?: string; folder?: string; keyword?: string; error: string }[];
}

export default function Bulk() {
  const [tab, setTab] = useState("zip");
  const [marketplace, setMarketplace] = useState("eBay UK");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<BulkResponse | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // ZIP state
  const [zipFile, setZipFile] = useState<File | null>(null);
  const { getRootProps: getZipProps, getInputProps: getZipInputs, isDragActive: zipDrag } = useDropzone({
    onDrop: (files) => setZipFile(files[0] ?? null),
    accept: { "application/zip": [".zip"], "application/x-zip-compressed": [".zip"] },
    maxFiles: 1,
  });

  // URL state
  const [urls, setUrls] = useState("");

  // Keywords state
  const [keywords, setKeywords] = useState("");

  const processZip = async () => {
    if (!zipFile) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", zipFile);
      fd.append("marketplace", marketplace);
      const res = await fetch("/api/bulk/zip", { method: "POST", body: fd });
      const data = await res.json() as BulkResponse;
      if (!res.ok) throw new Error((data as unknown as { error: string }).error);
      setResponse(data);
      toast.success(`Processed ${data.processed}/${data.total} products from ZIP!`);
    } catch (err) { toast.error(String(err)); } finally { setLoading(false); }
  };

  const processUrls = async () => {
    const urlList = urls.split("\n").map(u => u.trim()).filter(Boolean);
    if (!urlList.length) return;
    setLoading(true);
    try {
      const res = await fetch("/api/bulk/urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: urlList, marketplace }),
      });
      const data = await res.json() as BulkResponse;
      if (!res.ok) throw new Error((data as unknown as { error: string }).error);
      setResponse(data);
      toast.success(`Generated ${data.processed} listings!`);
    } catch (err) { toast.error(String(err)); } finally { setLoading(false); }
  };

  const processKeywords = async () => {
    const kwList = keywords.split("\n").map(k => k.trim()).filter(Boolean);
    if (!kwList.length) return;
    setLoading(true);
    try {
      const res = await fetch("/api/bulk/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: kwList, marketplace }),
      });
      const data = await res.json() as BulkResponse;
      if (!res.ok) throw new Error((data as unknown as { error: string }).error);
      setResponse(data);
      toast.success(`Generated ${data.processed} listings!`);
    } catch (err) { toast.error(String(err)); } finally { setLoading(false); }
  };

  const exportAll = () => {
    if (!response) return;
    const lines = response.results.map((r, i) =>
      `=== PRODUCT ${i + 1} ===\nTITLE: ${r.listing.title}\nCATEGORY: ${r.listing.category}\nPRICE: £${r.listing.price}\nKEYWORDS: ${r.listing.keywords?.join(", ")}\n\nDESCRIPTION:\n${r.listing.description}\n\n`
    );
    const blob = new Blob(lines, { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `bulk_listings_${Date.now()}.txt`; a.click();
    toast.success("All listings exported!");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold">Bulk Processor</h1>
          <Badge variant="default">Auto Batch</Badge>
        </div>
        <p className="text-sm text-muted-foreground">ZIP files of product folders, multiple supplier URLs, or keyword lists — process entire catalogues at once</p>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={marketplace} onValueChange={setMarketplace}>
              <SelectTrigger className="w-36 text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>{MARKETPLACE_OPTIONS.map(m=><SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">Marketplace applied to all items</span>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="p-5">
          <TabsList>
            <TabsTrigger value="zip" className="gap-1.5 text-xs"><Upload className="w-3.5 h-3.5" />ZIP File</TabsTrigger>
            <TabsTrigger value="urls" className="gap-1.5 text-xs"><Link2 className="w-3.5 h-3.5" />URLs</TabsTrigger>
            <TabsTrigger value="keywords" className="gap-1.5 text-xs"><Type className="w-3.5 h-3.5" />Keywords</TabsTrigger>
          </TabsList>

          {/* ZIP */}
          <TabsContent value="zip" className="space-y-4">
            <div {...getZipProps()} className={`rounded-2xl border-2 border-dashed p-12 flex flex-col items-center cursor-pointer transition-all gap-3 ${zipDrag ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
              <input {...getZipInputs()} />
              <Upload className="w-8 h-8 text-muted-foreground" />
              {zipFile ? (
                <div className="text-center"><p className="font-medium text-foreground">{zipFile.name}</p><p className="text-xs text-muted-foreground">{(zipFile.size / 1024 / 1024).toFixed(1)} MB — Click to change</p></div>
              ) : (
                <div className="text-center"><p className="font-medium">Drop your product ZIP file here</p><p className="text-xs text-muted-foreground mt-1">Structure: one folder per product, images inside each folder</p></div>
              )}
            </div>
            <div className="rounded-xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Expected ZIP structure:</p>
              <pre className="text-xs font-mono opacity-80">{`products.zip\n├── Product 1/\n│   ├── image1.jpg\n│   └── specs.txt\n├── Product 2/\n│   └── image.png\n└── Product 3/\n    └── ...`}</pre>
            </div>
            <Button onClick={() => void processZip()} disabled={!zipFile || loading} className="w-full gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
              {loading ? "Processing ZIP..." : "Process ZIP File"}
            </Button>
          </TabsContent>

          {/* URLs */}
          <TabsContent value="urls" className="space-y-4">
            <div className="space-y-1.5">
              <Label>Supplier URLs (one per line)</Label>
              <Textarea value={urls} onChange={e => setUrls(e.target.value)} rows={8}
                placeholder={`https://aliexpress.com/item/123.html\nhttps://amazon.co.uk/dp/ABC123\nhttps://alibaba.com/product/456.html`}
                className="text-sm font-mono" />
              <p className="text-xs text-muted-foreground">{urls.split("\n").filter(l=>l.trim()).length} URLs • Max 10 per batch</p>
            </div>
            <Button onClick={() => void processUrls()} disabled={!urls.trim() || loading} className="w-full gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {loading ? "Scraping & Generating..." : "Scrape URLs & Generate Listings"}
            </Button>
          </TabsContent>

          {/* Keywords */}
          <TabsContent value="keywords" className="space-y-4">
            <div className="space-y-1.5">
              <Label>Product keywords (one per line)</Label>
              <Textarea value={keywords} onChange={e => setKeywords(e.target.value)} rows={8}
                placeholder={`Wireless Bluetooth Earbuds\nLaptop Stand Adjustable\nGarden Hose 50ft\nPhone Case iPhone 15\nYoga Mat Non-slip`}
                className="text-sm" />
              <p className="text-xs text-muted-foreground">{keywords.split("\n").filter(l=>l.trim()).length} keywords • Max 15 per batch</p>
            </div>
            <Button onClick={() => void processKeywords()} disabled={!keywords.trim() || loading} className="w-full gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Type className="w-4 h-4" />}
              {loading ? "Generating Listings..." : "Generate Listings from Keywords"}
            </Button>
          </TabsContent>
        </Tabs>
      </div>

      {/* Results */}
      {response && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Summary bar */}
          <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-sm font-semibold">{response.processed} Generated</span>
            </div>
            {response.failed > 0 && (
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400">{response.failed} Failed</span>
              </div>
            )}
            <Progress value={(response.processed / response.total) * 100} className="flex-1 min-w-24" />
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={exportAll}>
              <Download className="w-3.5 h-3.5" />Export All
            </Button>
          </div>

          {/* Individual listings */}
          <div className="space-y-4">
            {response.results.map((r, i) => (
              <div key={i}>
                <button onClick={() => setExpanded(p => ({ ...p, [i]: !p[i] }))}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">#{i + 1}</Badge>
                    <span className="text-sm font-medium text-left">{r.listing.title?.slice(0, 60)}...</span>
                    <Badge variant="outline" className="text-xs">SEO {r.listing.seoScore ?? "—"}</Badge>
                  </div>
                  {expanded[i] ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {expanded[i] && (
                  <div className="mt-2 animate-fade-in">
                    <ListingCard listing={r.listing} seoReport={r.seoReport} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Errors */}
          {response.errors.length > 0 && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
              <p className="text-xs font-semibold text-red-400">Failed items:</p>
              {response.errors.map((e, i) => (
                <div key={i} className="text-xs text-red-400/80">{e.url ?? e.folder ?? e.keyword}: {e.error}</div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
