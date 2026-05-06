import { useState } from "react";
import { motion } from "framer-motion";
import { Image, Loader2, Download, ZoomIn, Shield, Layers, Type, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import ImageDropzone from "@/components/ImageDropzone";
import { toast } from "sonner";
import { downloadBase64, formatBytes } from "@/lib/utils";

interface ImgResult { name?: string; data: string; mimeType: string; originalSize?: { w: number; h: number }; newSize?: { w: number; h: number }; size?: number; }

async function postFormData(endpoint: string, fd: FormData): Promise<Record<string, unknown>> {
  const res = await fetch(endpoint, { method: "POST", body: fd });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) ?? "Request failed");
  return data;
}

export default function ImageStudio() {
  const [tab, setTab] = useState("upscale");

  // Upscale state
  const [upFiles, setUpFiles] = useState<File[]>([]);
  const [scale, setScale] = useState("2");
  const [upQuality, setUpQuality] = useState("90");
  const [upFormat, setUpFormat] = useState("jpeg");
  const [upResults, setUpResults] = useState<ImgResult[]>([]);
  const [upLoading, setUpLoading] = useState(false);

  // Background state
  const [bgFile, setBgFile] = useState<File[]>([]);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [bgResult, setBgResult] = useState<ImgResult | null>(null);
  const [bgLoading, setBgLoading] = useState(false);

  // Watermark state
  const [wmFile, setWmFile] = useState<File[]>([]);
  const [wmText, setWmText] = useState("© My eBay Store");
  const [wmOpacity, setWmOpacity] = useState("40");
  const [wmResult, setWmResult] = useState<ImgResult | null>(null);
  const [wmLoading, setWmLoading] = useState(false);

  // Banner state
  const [storeName, setStoreName] = useState("My eBay Store");
  const [tagline, setTagline] = useState("Quality Products, Fast Shipping");
  const [colorScheme, setColorScheme] = useState("blue");
  const [bannerResult, setBannerResult] = useState<ImgResult | null>(null);
  const [bannerLoading, setBannerLoading] = useState(false);

  // Optimize state
  const [optFiles, setOptFiles] = useState<File[]>([]);
  const [optSize, setOptSize] = useState("1600");
  const [optResults, setOptResults] = useState<ImgResult[]>([]);
  const [optLoading, setOptLoading] = useState(false);

  const handleUpscale = async () => {
    if (!upFiles.length) return;
    setUpLoading(true);
    try {
      const fd = new FormData();
      upFiles.forEach(f => fd.append("images", f));
      fd.append("scale", scale); fd.append("quality", upQuality); fd.append("format", upFormat);
      const data = await postFormData("/api/images/upscale", fd);
      setUpResults((data.results as ImgResult[]) ?? []);
      toast.success(`${(data.results as ImgResult[]).length} image(s) upscaled!`);
    } catch (err) { toast.error(String(err)); } finally { setUpLoading(false); }
  };

  const handleBackground = async () => {
    if (!bgFile[0]) return;
    setBgLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", bgFile[0]); fd.append("bgColor", bgColor);
      const data = await postFormData("/api/images/background", fd);
      setBgResult(data as unknown as ImgResult);
      toast.success("Background replaced!");
    } catch (err) { toast.error(String(err)); } finally { setBgLoading(false); }
  };

  const handleWatermark = async () => {
    if (!wmFile[0]) return;
    setWmLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", wmFile[0]); fd.append("text", wmText); fd.append("opacity", wmOpacity);
      const data = await postFormData("/api/images/watermark", fd);
      setWmResult(data as unknown as ImgResult);
      toast.success("Watermark applied!");
    } catch (err) { toast.error(String(err)); } finally { setWmLoading(false); }
  };

  const handleBanner = async () => {
    setBannerLoading(true);
    try {
      const fd = new FormData();
      fd.append("storeName", storeName); fd.append("tagline", tagline);
      fd.append("colorScheme", colorScheme); fd.append("width", "1200"); fd.append("height", "200");
      const data = await postFormData("/api/images/banner", fd);
      setBannerResult(data as unknown as ImgResult);
      toast.success("Banner created!");
    } catch (err) { toast.error(String(err)); } finally { setBannerLoading(false); }
  };

  const handleOptimize = async () => {
    if (!optFiles.length) return;
    setOptLoading(true);
    try {
      const fd = new FormData();
      optFiles.forEach(f => fd.append("images", f));
      fd.append("size", optSize); fd.append("quality", "92");
      const data = await postFormData("/api/images/optimize", fd);
      setOptResults((data.results as ImgResult[]) ?? []);
      toast.success(`${(data.results as ImgResult[]).length} image(s) optimized for eBay!`);
    } catch (err) { toast.error(String(err)); } finally { setOptLoading(false); }
  };

  function ResultImage({ r, filename }: { r: ImgResult; filename: string }) {
    return (
      <div className="space-y-2">
        <img src={`data:${r.mimeType};base64,${r.data}`} alt="Result" className="w-full max-h-64 object-contain rounded-xl border border-border bg-secondary/20" />
        {r.originalSize && r.newSize && (
          <p className="text-xs text-muted-foreground text-center">{r.originalSize.w}×{r.originalSize.h} → {r.newSize.w}×{r.newSize.h}</p>
        )}
        <Button className="w-full gap-2 text-sm" onClick={() => downloadBase64(r.data, filename, r.mimeType)}>
          <Download className="w-4 h-4" /> Download
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Image className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold">Image Studio</h1>
          <Badge variant="default">5 Tools</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Upscale, background removal, watermark, banners, eBay optimization — all server-side with Sharp</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="upscale" className="gap-1.5 text-xs"><ZoomIn className="w-3.5 h-3.5" />Upscale</TabsTrigger>
          <TabsTrigger value="background" className="gap-1.5 text-xs"><Layers className="w-3.5 h-3.5" />Background</TabsTrigger>
          <TabsTrigger value="watermark" className="gap-1.5 text-xs"><Type className="w-3.5 h-3.5" />Watermark</TabsTrigger>
          <TabsTrigger value="banner" className="gap-1.5 text-xs"><Palette className="w-3.5 h-3.5" />Banner</TabsTrigger>
          <TabsTrigger value="optimize" className="gap-1.5 text-xs"><Shield className="w-3.5 h-3.5" />eBay Optimize</TabsTrigger>
        </TabsList>

        {/* UPSCALE */}
        <TabsContent value="upscale">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <ImageDropzone files={upFiles} onFiles={setUpFiles} label="Drop product images to upscale" hint="Supports JPG, PNG, WebP — up to 20 files" />
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label>Scale</Label>
                  <Select value={scale} onValueChange={setScale}><SelectTrigger className="text-xs"><SelectValue /></SelectTrigger><SelectContent>{["1.5","2","3","4"].map(s=><SelectItem key={s} value={s} className="text-xs">{s}× ({s==="4"?"eBay Max":""})</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-1.5"><Label>Quality</Label>
                  <Select value={upQuality} onValueChange={setUpQuality}><SelectTrigger className="text-xs"><SelectValue /></SelectTrigger><SelectContent>{["70","80","90","95","100"].map(q=><SelectItem key={q} value={q} className="text-xs">{q}%</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-1.5"><Label>Format</Label>
                  <Select value={upFormat} onValueChange={setUpFormat}><SelectTrigger className="text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="jpeg" className="text-xs">JPEG</SelectItem><SelectItem value="png" className="text-xs">PNG</SelectItem></SelectContent></Select>
                </div>
              </div>
              <Button onClick={() => void handleUpscale()} disabled={!upFiles.length || upLoading} className="w-full gap-2">
                {upLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ZoomIn className="w-4 h-4" />}
                {upLoading ? `Upscaling ${upFiles.length} image(s)...` : `Upscale ${upFiles.length || ""} Image(s)`}
              </Button>
            </div>
            <div className="space-y-3">
              {upResults.length > 0 ? upResults.map((r, i) => <ResultImage key={i} r={r} filename={`upscaled_${r.name ?? i}.${upFormat}`} />) : (
                <div className="rounded-2xl border border-border bg-card/50 flex items-center justify-center min-h-60 text-center p-8">
                  <div><ZoomIn className="w-10 h-10 text-primary/20 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Upscaled images appear here</p></div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* BACKGROUND */}
        <TabsContent value="background">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <ImageDropzone files={bgFile} onFiles={setBgFile} multiple={false} label="Drop product image" hint="Replace background with any solid color" />
              <div className="space-y-2"><Label>Background Color</Label>
                <div className="flex items-center gap-3">
                  {["#ffffff","#f8f8f8","#000000","#1a1a2e","#f0f0f0"].map(c=>(
                    <button key={c} onClick={() => setBgColor(c)} className={`w-8 h-8 rounded-full border-2 transition-all ${bgColor===c?"border-primary scale-110":"border-border"}`} style={{background:c}} />
                  ))}
                  <input type="color" value={bgColor} onChange={e=>setBgColor(e.target.value)} className="w-9 h-8 rounded cursor-pointer border border-border" />
                  <span className="text-xs text-muted-foreground font-mono">{bgColor}</span>
                </div>
              </div>
              <Button onClick={() => void handleBackground()} disabled={!bgFile[0] || bgLoading} className="w-full gap-2">
                {bgLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                {bgLoading ? "Replacing..." : "Replace Background"}
              </Button>
            </div>
            <div>{bgResult ? <ResultImage r={bgResult} filename={`bg_removed_${Date.now()}.jpg`} /> : (
              <div className="rounded-2xl border border-border bg-card/50 flex items-center justify-center min-h-60 text-center p-8">
                <div><Layers className="w-10 h-10 text-primary/20 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Result appears here</p></div>
              </div>
            )}</div>
          </div>
        </TabsContent>

        {/* WATERMARK */}
        <TabsContent value="watermark">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <ImageDropzone files={wmFile} onFiles={setWmFile} multiple={false} label="Drop image to watermark" />
              <div className="space-y-1.5"><Label>Watermark Text</Label><Input value={wmText} onChange={e=>setWmText(e.target.value)} placeholder="© Your Store Name" /></div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between"><Label>Opacity</Label><span className="text-xs text-muted-foreground">{wmOpacity}%</span></div>
                <input type="range" min={10} max={80} value={wmOpacity} onChange={e=>setWmOpacity(e.target.value)} className="w-full accent-primary" />
              </div>
              <Button onClick={() => void handleWatermark()} disabled={!wmFile[0] || wmLoading} className="w-full gap-2">
                {wmLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Type className="w-4 h-4" />}
                {wmLoading ? "Applying..." : "Add Watermark"}
              </Button>
            </div>
            <div>{wmResult ? <ResultImage r={wmResult} filename={`watermarked_${Date.now()}.jpg`} /> : (
              <div className="rounded-2xl border border-border bg-card/50 flex items-center justify-center min-h-60 text-center p-8">
                <div><Type className="w-10 h-10 text-primary/20 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Watermarked image appears here</p></div>
              </div>
            )}</div>
          </div>
        </TabsContent>

        {/* BANNER */}
        <TabsContent value="banner">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Store Name</Label><Input value={storeName} onChange={e=>setStoreName(e.target.value)} placeholder="My eBay Store" /></div>
              <div className="space-y-1.5"><Label>Tagline</Label><Input value={tagline} onChange={e=>setTagline(e.target.value)} placeholder="Quality Products, Fast Shipping" /></div>
              <div className="space-y-1.5"><Label>Color Scheme</Label>
                <div className="flex gap-2">
                  {[
                    {id:"blue",bg:"#0f172a",accent:"#3b82f6"},
                    {id:"green",bg:"#0f2018",accent:"#22c55e"},
                    {id:"purple",bg:"#150f2a",accent:"#a855f7"},
                    {id:"red",bg:"#2a0f0f",accent:"#ef4444"},
                    {id:"gold",bg:"#1a1200",accent:"#f59e0b"},
                  ].map(s=>(
                    <button key={s.id} onClick={()=>setColorScheme(s.id)}
                      className={`w-10 h-10 rounded-xl border-2 transition-all ${colorScheme===s.id?"border-primary scale-105":"border-border"}`}
                      style={{background:`linear-gradient(135deg,${s.bg},${s.accent}44)`}} />
                  ))}
                </div>
              </div>
              <Button onClick={() => void handleBanner()} disabled={bannerLoading} className="w-full gap-2">
                {bannerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palette className="w-4 h-4" />}
                {bannerLoading ? "Creating..." : "Create Store Banner"}
              </Button>
            </div>
            <div>{bannerResult ? (
              <div className="space-y-3">
                <img src={`data:${bannerResult.mimeType};base64,${bannerResult.data}`} alt="Banner" className="w-full rounded-xl border border-border" />
                <Button className="w-full gap-2" onClick={() => downloadBase64(bannerResult.data, `banner_${Date.now()}.jpg`, bannerResult.mimeType)}><Download className="w-4 h-4" />Download Banner</Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card/50 flex items-center justify-center min-h-40 text-center p-8">
                <div><Palette className="w-10 h-10 text-primary/20 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Store banner appears here<br /><span className="text-xs">1200×200px — eBay standard size</span></p></div>
              </div>
            )}</div>
          </div>
        </TabsContent>

        {/* OPTIMIZE */}
        <TabsContent value="optimize">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <ImageDropzone files={optFiles} onFiles={setOptFiles} label="Drop images to optimize for eBay" hint="Auto-resizes to eBay-recommended dimensions with white background" />
              <div className="space-y-1.5"><Label>Target Size</Label>
                <Select value={optSize} onValueChange={setOptSize}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="800" className="text-xs">800×800 (eBay minimum)</SelectItem>
                    <SelectItem value="1200" className="text-xs">1200×1200 (recommended)</SelectItem>
                    <SelectItem value="1600" className="text-xs">1600×1600 (eBay max quality)</SelectItem>
                    <SelectItem value="2000" className="text-xs">2000×2000 (ultra)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => void handleOptimize()} disabled={!optFiles.length || optLoading} className="w-full gap-2">
                {optLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {optLoading ? "Optimizing..." : `Optimize ${optFiles.length || ""} for eBay`}
              </Button>
            </div>
            <div className="space-y-3">
              {optResults.length > 0 ? optResults.map((r,i)=><ResultImage key={i} r={r} filename={`ebay_${r.name??i}.jpg`} />) : (
                <div className="rounded-2xl border border-border bg-card/50 flex items-center justify-center min-h-60 text-center p-8">
                  <div><Shield className="w-10 h-10 text-primary/20 mx-auto mb-3" /><p className="text-sm text-muted-foreground">eBay-optimized images appear here</p></div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
