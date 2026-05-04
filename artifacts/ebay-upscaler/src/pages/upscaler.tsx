import { useState, useCallback } from "react";
import { Download, Wand2, Settings2, ArrowLeftRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useUpscaleImage } from "@workspace/api-client-react";
import ImageUpload from "@/components/ImageUpload";
import { toast } from "sonner";

const FORMATS = ["jpg", "jpeg", "png", "webp", "avif", "tiff", "bmp"];

export default function Upscaler() {
  const [file, setFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [result, setResult] = useState<{ imageData: string; filename: string; width: number; height: number; sizeBytes: number; processingTime: number } | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const [targetWidth, setTargetWidth] = useState(2000);
  const [targetHeight, setTargetHeight] = useState(2000);
  const [format, setFormat] = useState("jpg");
  const [quality, setQuality] = useState(90);
  const [stripMeta, setStripMeta] = useState(true);
  const [ebayBoost, setEbayBoost] = useState(true);
  const [aiEnhance, setAiEnhance] = useState(false);
  const [keepSquare, setKeepSquare] = useState(true);

  const upscale = useUpscaleImage({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
        toast.success("Image upscaled successfully!");
      },
      onError: () => toast.error("Upscaling failed. Please try again."),
    },
  });

  const handleFile = useCallback((f: File, url: string) => {
    setFile(f);
    setDataUrl(url);
    setResult(null);
  }, []);

  const handleWidthChange = (v: number) => {
    setTargetWidth(v);
    if (keepSquare) setTargetHeight(v);
  };
  const handleHeightChange = (v: number) => {
    setTargetHeight(v);
    if (keepSquare) setTargetWidth(v);
  };

  const handleProcess = () => {
    if (!dataUrl || !file) return;
    upscale.mutate({
      data: {
        imageData: dataUrl,
        filename: file.name,
        targetWidth,
        targetHeight,
        outputFormat: format as "jpg" | "jpeg" | "png" | "webp" | "avif" | "tiff" | "bmp",
        quality,
        stripMetadata: stripMeta,
        addEbayOptimization: ebayBoost,
        useAiEnhancement: aiEnhance,
      },
    });
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.imageData;
    a.download = result.filename;
    a.click();
    toast.success("Download started!");
  };

  const formatBytes = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(2)} MB` : `${(b / 1024).toFixed(1)} KB`;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Image Upscaler</h1>
        <p className="text-muted-foreground mt-1 text-sm">AI-powered upscaling with eBay optimizations — 1600×1600 to 6500×6500px</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Upload + Preview */}
        <div className="lg:col-span-2 space-y-4">
          {/* Upload */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold mb-3 text-foreground">Source Image</h2>
            <ImageUpload
              onFile={handleFile}
              preview={dataUrl}
              onClear={() => { setDataUrl(null); setFile(null); setResult(null); }}
              className="h-64"
            />
            {file && (
              <div className="mt-2 text-xs text-muted-foreground">
                {file.name} — {formatBytes(file.size)}
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="rounded-xl border border-primary/30 bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">Result</h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCompare(!showCompare)}
                    className="text-xs"
                    data-testid="button-toggle-compare"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 mr-1" />
                    Compare
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleDownload}
                    className="text-xs bg-primary text-primary-foreground"
                    data-testid="button-download"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
              {showCompare ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 text-center">Before</p>
                    <img src={dataUrl!} alt="Before" className="w-full rounded-lg border border-border object-contain bg-secondary/40 max-h-64" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 text-center">After</p>
                    <img src={result.imageData} alt="After" className="w-full rounded-lg border border-primary/30 object-contain bg-secondary/40 max-h-64" />
                  </div>
                </div>
              ) : (
                <img src={result.imageData} alt="Result" className="w-full rounded-lg border border-primary/30 object-contain bg-secondary/40 max-h-72" />
              )}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                <div className="bg-secondary/40 rounded-lg px-3 py-2">
                  <div className="font-semibold text-foreground">{result.width}×{result.height}</div>
                  <div>Resolution</div>
                </div>
                <div className="bg-secondary/40 rounded-lg px-3 py-2">
                  <div className="font-semibold text-foreground">{formatBytes(result.sizeBytes)}</div>
                  <div>File size</div>
                </div>
                <div className="bg-secondary/40 rounded-lg px-3 py-2">
                  <div className="font-semibold text-foreground">{result.format?.toUpperCase()}</div>
                  <div>Format</div>
                </div>
                <div className="bg-secondary/40 rounded-lg px-3 py-2">
                  <div className="font-semibold text-foreground">{result.processingTime.toFixed(2)}s</div>
                  <div>Time</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Settings */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <Settings2 className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Settings</h2>
            </div>

            <div className="space-y-5">
              {/* Square lock */}
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Lock 1:1 (eBay required)</Label>
                <Switch checked={keepSquare} onCheckedChange={setKeepSquare} data-testid="switch-keep-square" />
              </div>

              {/* Width */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <Label className="text-xs text-muted-foreground">Width</Label>
                  <span className="text-xs font-mono text-primary">{targetWidth}px</span>
                </div>
                <Slider
                  min={1600}
                  max={6500}
                  step={100}
                  value={[targetWidth]}
                  onValueChange={([v]) => handleWidthChange(v)}
                  data-testid="slider-width"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>1600</span><span>6500</span>
                </div>
              </div>

              {/* Height */}
              {!keepSquare && (
                <div>
                  <div className="flex justify-between mb-1.5">
                    <Label className="text-xs text-muted-foreground">Height</Label>
                    <span className="text-xs font-mono text-primary">{targetHeight}px</span>
                  </div>
                  <Slider
                    min={1600}
                    max={6500}
                    step={100}
                    value={[targetHeight]}
                    onValueChange={([v]) => handleHeightChange(v)}
                    data-testid="slider-height"
                  />
                </div>
              )}

              {/* Format */}
              <div>
                <Label className="text-xs text-muted-foreground block mb-1.5">Output Format</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quality */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <Label className="text-xs text-muted-foreground">Quality</Label>
                  <span className="text-xs font-mono text-primary">{quality}%</span>
                </div>
                <Slider
                  min={1}
                  max={100}
                  step={1}
                  value={[quality]}
                  onValueChange={([v]) => setQuality(v)}
                  data-testid="slider-quality"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-1 border-t border-border">
                {[
                  { label: "Strip EXIF/Metadata", value: stripMeta, set: setStripMeta, id: "switch-strip-meta" },
                  { label: "eBay CTR Boost", value: ebayBoost, set: setEbayBoost, id: "switch-ebay-boost" },
                  { label: "AI Enhancement (Pollinations)", value: aiEnhance, set: setAiEnhance, id: "switch-ai-enhance" },
                ].map((t) => (
                  <div key={t.label} className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground cursor-pointer">{t.label}</Label>
                    <Switch checked={t.value} onCheckedChange={t.set} data-testid={t.id} />
                  </div>
                ))}
              </div>

              <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                disabled={!dataUrl || upscale.isPending}
                onClick={handleProcess}
                data-testid="button-process-upscale"
              >
                {upscale.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                ) : (
                  <><Wand2 className="w-4 h-4 mr-2" /> Upscale Image</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
