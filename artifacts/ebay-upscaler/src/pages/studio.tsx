import { useState, useCallback, useRef } from "react";
import {
  Upload, Wand2, Download, Globe, Zap, Star, Package,
  ChevronDown, Copy, Check, Loader2, RefreshCw, Settings2,
  Image as ImageIcon, Tag, Shield, Truck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const COUNTRIES = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "UK", name: "United Kingdom", flag: "🇬🇧" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "PL", name: "Poland", flag: "🇵🇱" },
];

const BADGE_STYLES = [
  { value: "premium", label: "Premium" },
  { value: "standard", label: "Standard" },
  { value: "minimal", label: "Minimal" },
  { value: "text-only", label: "Text Only" },
];

const BADGE_POSITIONS = [
  { value: "bottom-right", label: "Bottom Right" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "top-right", label: "Top Right" },
  { value: "top-left", label: "Top Left" },
];

type Analysis = {
  productName?: string;
  ebayTitle?: string;
  category?: string;
  condition?: string;
  estimatedPrice?: string;
  bulletPoints?: string[];
  keywords?: string[];
  shippingTip?: string;
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button onClick={copy} className="ml-1.5 text-muted-foreground hover:text-primary transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function Studio() {
  const [file, setFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState<string>("");
  const [badgePreview, setBadgePreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [processing, setProcessing] = useState(false);
  const [analyzingProduct, setAnalyzingProduct] = useState(false);
  const [loadingBadge, setLoadingBadge] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Settings
  const [targetSize, setTargetSize] = useState(2000);
  const [addShadow, setAddShadow] = useState(true);
  const [shadowBlur, setShadowBlur] = useState(20);
  const [shadowOpacity, setShadowOpacity] = useState(0.18);
  const [addBadge, setAddBadge] = useState(true);
  const [badgeCountry, setBadgeCountry] = useState("US");
  const [badgeStyle, setBadgeStyle] = useState("premium");
  const [badgePosition, setBadgePosition] = useState("bottom-right");
  const [badgeSize, setBadgeSize] = useState<"small" | "medium" | "large">("medium");
  const [addWatermark, setAddWatermark] = useState(false);
  const [watermarkText, setWatermarkText] = useState("");
  const [ebayBoost, setEbayBoost] = useState(true);
  const [outputFormat, setOutputFormat] = useState<"jpg" | "png" | "webp">("jpg");
  const [quality, setQuality] = useState(92);

  const loadFile = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setDataUrl(e.target?.result as string);
      setResult(null);
      setAnalysis(null);
      setBadgePreview(null);
    };
    reader.readAsDataURL(f);
    setFile(f);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) loadFile(f);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) loadFile(f);
  };

  const fetchBadgePreview = useCallback(async (country: string, style: string) => {
    setLoadingBadge(true);
    try {
      const res = await fetch("/api/studio/badge-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ country, style, width: 220, height: 68 }),
      });
      if (res.ok) {
        const data = await res.json() as { imageData: string };
        setBadgePreview(data.imageData);
      }
    } catch { /* ignore */ }
    finally { setLoadingBadge(false); }
  }, []);

  const handleCountryChange = (c: string) => {
    setBadgeCountry(c);
    void fetchBadgePreview(c, badgeStyle);
  };

  const handleStyleChange = (s: string) => {
    setBadgeStyle(s);
    void fetchBadgePreview(badgeCountry, s);
  };

  const handleCompose = async () => {
    if (!dataUrl || !file) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/studio/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          imageData: dataUrl,
          filename: file.name,
          targetSize,
          addShadow,
          shadowBlur,
          shadowOpacity,
          addBadge,
          badgeCountry,
          badgeStyle,
          badgePosition,
          badgeSize,
          addWatermark,
          watermarkText: watermarkText || undefined,
          ebayBoost,
          outputFormat,
          quality,
        }),
      });
      const data = await res.json() as { imageData?: string; filename?: string; error?: string; message?: string };
      if (!res.ok) {
        if (res.status === 429) {
          toast.error("Monthly limit reached. Upgrade to Pro for unlimited access.");
        } else {
          toast.error(data.error ?? "Processing failed");
        }
        return;
      }
      setResult(data.imageData ?? null);
      setResultFilename(data.filename ?? "result.jpg");
      toast.success("Image composed successfully!");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleAnalyzeProduct = async () => {
    if (!dataUrl) return;
    setAnalyzingProduct(true);
    try {
      const res = await fetch("/api/studio/product-find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageData: dataUrl }),
      });
      const data = await res.json() as { success?: boolean; analysis?: Analysis; error?: string };
      if (!res.ok || !data.success) {
        toast.error(data.error ?? "Analysis failed");
        return;
      }
      setAnalysis(data.analysis ?? null);
      toast.success("Product analyzed!");
    } catch {
      toast.error("Analysis failed. Please try again.");
    } finally {
      setAnalyzingProduct(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = resultFilename;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Zap className="w-4.5 h-4.5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">eBay Studio</h1>
          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">All-in-One</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Upload once → upscale + perfect white background + drop shadow + country shipping badge + AI product analysis. One click, eBay-ready.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Upload + Settings */}
        <div className="xl:col-span-1 space-y-4">
          {/* Upload */}
          <div
            className={`relative rounded-2xl border-2 border-dashed transition-colors cursor-pointer ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            } ${dataUrl ? "aspect-square" : "aspect-square"} overflow-hidden bg-card`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            {dataUrl ? (
              <img src={dataUrl} alt="Original" className="w-full h-full object-contain p-2" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Drop image here</p>
                  <p className="text-xs mt-0.5">JPG, PNG, WEBP, BMP, TIFF, GIF</p>
                </div>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
          </div>

          {file && (
            <p className="text-xs text-muted-foreground text-center truncate">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>
          )}

          {/* Settings Tabs */}
          <Tabs defaultValue="image" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-8">
              <TabsTrigger value="image" className="text-xs">
                <ImageIcon className="w-3 h-3 mr-1" />Image
              </TabsTrigger>
              <TabsTrigger value="badge" className="text-xs">
                <Truck className="w-3 h-3 mr-1" />Badge
              </TabsTrigger>
              <TabsTrigger value="more" className="text-xs">
                <Settings2 className="w-3 h-3 mr-1" />More
              </TabsTrigger>
            </TabsList>

            <TabsContent value="image" className="space-y-4 mt-3">
              <div>
                <Label className="text-xs font-medium mb-2 block">Target Size: {targetSize}×{targetSize}px</Label>
                <Slider
                  min={1600} max={6500} step={100}
                  value={[targetSize]}
                  onValueChange={([v]) => setTargetSize(v)}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>1600px</span><span>eBay minimum</span><span>6500px</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">eBay CTR Boost</Label>
                  <Switch checked={ebayBoost} onCheckedChange={setEbayBoost} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Drop Shadow</Label>
                  <Switch checked={addShadow} onCheckedChange={setAddShadow} />
                </div>
                {addShadow && (
                  <>
                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-1 block">Shadow Blur: {shadowBlur}</Label>
                      <Slider min={0} max={60} step={2} value={[shadowBlur]} onValueChange={([v]) => setShadowBlur(v)} />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-1 block">Shadow Opacity: {Math.round(shadowOpacity * 100)}%</Label>
                      <Slider min={0} max={1} step={0.01} value={[shadowOpacity]} onValueChange={([v]) => setShadowOpacity(v)} />
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs mb-1 block">Format</Label>
                  <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as "jpg" | "png" | "webp")}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jpg">JPG</SelectItem>
                      <SelectItem value="png">PNG</SelectItem>
                      <SelectItem value="webp">WebP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Quality: {quality}%</Label>
                  <Slider min={60} max={100} step={1} value={[quality]} onValueChange={([v]) => setQuality(v)} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="badge" className="space-y-4 mt-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Shipping Badge</Label>
                <Switch checked={addBadge} onCheckedChange={setAddBadge} />
              </div>

              {addBadge && (
                <>
                  <div>
                    <Label className="text-xs mb-1 block">Country</Label>
                    <Select value={badgeCountry} onValueChange={handleCountryChange}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-64">
                        {COUNTRIES.map(c => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.flag} {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs mb-1 block">Badge Style</Label>
                    <Select value={badgeStyle} onValueChange={handleStyleChange}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BADGE_STYLES.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {badgePreview && (
                    <div className="rounded-xl border border-border bg-secondary/30 p-3 flex flex-col items-center gap-2">
                      <p className="text-[10px] text-muted-foreground">Badge Preview</p>
                      {loadingBadge ? (
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      ) : (
                        <img src={badgePreview} alt="Badge preview" className="max-w-full rounded" />
                      )}
                    </div>
                  )}

                  {!badgePreview && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-8"
                      onClick={() => void fetchBadgePreview(badgeCountry, badgeStyle)}
                    >
                      <RefreshCw className="w-3 h-3 mr-1.5" /> Preview Badge
                    </Button>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs mb-1 block">Position</Label>
                      <Select value={badgePosition} onValueChange={setBadgePosition}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BADGE_POSITIONS.map(p => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Size</Label>
                      <Select value={badgeSize} onValueChange={(v) => setBadgeSize(v as "small" | "medium" | "large")}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">Small</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="large">Large</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="more" className="space-y-4 mt-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Watermark</Label>
                <Switch checked={addWatermark} onCheckedChange={setAddWatermark} />
              </div>
              {addWatermark && (
                <input
                  type="text"
                  placeholder="Your store name..."
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  className="w-full h-8 px-3 text-xs rounded-lg border border-border bg-background text-foreground"
                />
              )}

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground text-[11px] uppercase tracking-wide">What Studio does</p>
                <p>✓ White background canvas (eBay compliant)</p>
                <p>✓ Lanczos3 upscaling to your target size</p>
                <p>✓ Perfect elliptical drop shadow</p>
                <p>✓ Country shipping badge overlay</p>
                <p>✓ eBay CTR color/sharpness boost</p>
                <p>✓ Optional store watermark</p>
              </div>
            </TabsContent>
          </Tabs>

          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11"
            disabled={!dataUrl || processing}
            onClick={() => void handleCompose()}
          >
            {processing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Composing...</>
            ) : (
              <><Wand2 className="w-4 h-4 mr-2" />Compose eBay Image</>
            )}
          </Button>
        </div>

        {/* Right: Result + AI Analysis */}
        <div className="xl:col-span-2 space-y-6">
          {/* Result Image */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-foreground">Result Preview</span>
              {result && (
                <Button size="sm" onClick={handleDownload} className="text-xs h-7 bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                </Button>
              )}
            </div>
            <div className="aspect-square max-h-[520px] flex items-center justify-center" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Crect width='10' height='10' fill='%23f0f0f0'/%3E%3Crect x='10' y='10' width='10' height='10' fill='%23f0f0f0'/%3E%3C/svg%3E\")" }}>
              {result ? (
                <img src={result} alt="Composed result" className="w-full h-full object-contain" />
              ) : dataUrl ? (
                <div className="flex flex-col items-center gap-3 text-muted-foreground p-8">
                  <Star className="w-8 h-8 text-primary/40" />
                  <p className="text-sm text-center">Configure settings and click <span className="text-primary font-medium">Compose eBay Image</span></p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted-foreground p-8">
                  <ImageIcon className="w-8 h-8 opacity-30" />
                  <p className="text-sm">Upload an image to get started</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Product Finder */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">AI Product Finder</span>
                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">Free AI</Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!dataUrl || analyzingProduct}
                onClick={() => void handleAnalyzeProduct()}
                className="text-xs h-7"
              >
                {analyzingProduct ? (
                  <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Analyzing...</>
                ) : (
                  <><Wand2 className="w-3 h-3 mr-1.5" />Analyze Product</>
                )}
              </Button>
            </div>

            <div className="p-4">
              {!analysis && !analyzingProduct && (
                <div className="text-center py-6 text-muted-foreground">
                  <Tag className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Upload an image and click <span className="text-primary">Analyze Product</span></p>
                  <p className="text-xs mt-1">AI will generate eBay title, bullet points, category & keywords</p>
                </div>
              )}

              {analyzingProduct && (
                <div className="text-center py-6 text-muted-foreground">
                  <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-primary" />
                  <p className="text-sm">Analyzing your product image with AI...</p>
                </div>
              )}

              {analysis && (
                <div className="space-y-4">
                  {/* Product Info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-lg border border-border bg-secondary/30 p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground">Product</p>
                      <p className="text-xs font-semibold text-foreground mt-0.5 truncate">{analysis.productName}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/30 p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground">Category</p>
                      <p className="text-xs font-semibold text-foreground mt-0.5 truncate">{analysis.category}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/30 p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground">Condition</p>
                      <p className="text-xs font-semibold text-foreground mt-0.5">{analysis.condition}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/30 p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground">Price Range</p>
                      <p className="text-xs font-semibold text-primary mt-0.5">{analysis.estimatedPrice}</p>
                    </div>
                  </div>

                  {/* eBay Title */}
                  {analysis.ebayTitle && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <p className="text-[10px] font-semibold text-primary uppercase tracking-wide">eBay Title</p>
                        <CopyBtn text={analysis.ebayTitle} />
                      </div>
                      <p className="text-sm font-medium text-foreground">{analysis.ebayTitle}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{analysis.ebayTitle.length}/80 characters</p>
                    </div>
                  )}

                  {/* Bullet Points */}
                  {analysis.bulletPoints && analysis.bulletPoints.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <p className="text-xs font-semibold text-foreground">Listing Bullet Points</p>
                        <CopyBtn text={analysis.bulletPoints.join("\n")} />
                      </div>
                      <div className="space-y-1.5">
                        {analysis.bulletPoints.map((bp, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="text-primary font-bold mt-0.5">•</span>
                            <span className="flex-1">{bp.replace(/^[•\-]\s*/, "")}</span>
                            <CopyBtn text={bp.replace(/^[•\-]\s*/, "")} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Keywords */}
                  {analysis.keywords && analysis.keywords.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-2">SEO Keywords</p>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.keywords.map((kw, i) => (
                          <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={() => { void navigator.clipboard.writeText(kw); toast.success("Copied!"); }}>
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Shipping Tip */}
                  {analysis.shippingTip && (
                    <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 p-3">
                      <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">{analysis.shippingTip}</p>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 w-full"
                    onClick={() => void handleAnalyzeProduct()}
                    disabled={analyzingProduct}
                  >
                    <RefreshCw className="w-3 h-3 mr-1.5" /> Re-analyze
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
