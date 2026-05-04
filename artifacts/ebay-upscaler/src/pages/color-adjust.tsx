import { useState, useCallback } from "react";
import { Palette, Download, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import ImageUpload from "@/components/ImageUpload";
import { toast } from "sonner";

interface ColorResult {
  imageData: string;
  filename: string;
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
  processingTime: number;
}

const DEFAULT_SETTINGS = {
  brightness: 1,
  saturation: 1,
  hue: 0,
  sharpness: 0,
  contrast: 0,
  gamma: 1,
};

const EBAY_PRESETS = [
  { label: "None", values: DEFAULT_SETTINGS },
  { label: "eBay Boost", values: { brightness: 1.04, saturation: 1.12, hue: 0, sharpness: 1.2, contrast: 8, gamma: 1 } },
  { label: "Bright & Vivid", values: { brightness: 1.1, saturation: 1.3, hue: 0, sharpness: 0.8, contrast: 15, gamma: 1 } },
  { label: "Natural", values: { brightness: 1.02, saturation: 1.05, hue: 0, sharpness: 0.5, contrast: 5, gamma: 1 } },
  { label: "High Contrast", values: { brightness: 1.05, saturation: 1.1, hue: 0, sharpness: 1.5, contrast: 25, gamma: 1 } },
  { label: "Warm Tones", values: { brightness: 1.02, saturation: 1.15, hue: 15, sharpness: 0.8, contrast: 8, gamma: 1 } },
  { label: "Cool Tones", values: { brightness: 1, saturation: 0.95, hue: -15, sharpness: 0.5, contrast: 5, gamma: 1.05 } },
];

export default function ColorAdjustPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ColorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [outputFormat, setOutputFormat] = useState("jpg");
  const [quality, setQuality] = useState(92);

  const [brightness, setBrightness] = useState(1);
  const [saturation, setSaturation] = useState(1);
  const [hue, setHue] = useState(0);
  const [sharpness, setSharpness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [gamma, setGamma] = useState(1);

  const handleFile = useCallback((f: File, url: string) => {
    setFile(f);
    setDataUrl(url);
    setResult(null);
  }, []);

  const applyPreset = (preset: typeof EBAY_PRESETS[0]) => {
    setBrightness(preset.values.brightness);
    setSaturation(preset.values.saturation);
    setHue(preset.values.hue);
    setSharpness(preset.values.sharpness);
    setContrast(preset.values.contrast);
    setGamma(preset.values.gamma);
    setResult(null);
  };

  const reset = () => applyPreset(EBAY_PRESETS[0]);

  const process = async () => {
    if (!dataUrl || !file) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tools/color-adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: dataUrl,
          filename: file.name,
          brightness,
          saturation,
          hue,
          sharpness,
          contrast,
          gamma,
          outputFormat,
          quality,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" })) as { error: string };
        throw new Error(err.error);
      }
      const data = await res.json() as ColorResult;
      setResult(data);
      toast.success(`Adjustments applied in ${data.processingTime.toFixed(1)}s`);
    } catch (err) {
      toast.error(`Color adjustment failed: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.imageData;
    a.download = result.filename;
    a.click();
  };

  const fmt = (v: number, unit = "") => `${v > 0 ? "+" : ""}${v.toFixed(2)}${unit}`;
  const formatBytes = (b: number) => b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`;

  const SliderRow = ({ label, value, onChange, min, max, step, displayFn }: {
    label: string; value: number; onChange: (v: number) => void;
    min: number; max: number; step: number; displayFn: (v: number) => string;
  }) => (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs font-mono text-primary">{displayFn(value)}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => { onChange(v); setResult(null); }} min={min} max={max} step={step} className="w-full" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Palette className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">Color Adjuster</h1>
          <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-xs rounded-full font-medium">eBay CTR Boost</span>
        </div>
        <p className="text-muted-foreground text-sm">Fine-tune brightness, contrast, saturation, and sharpness to maximize click-through rates on eBay.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <Label className="text-sm font-medium mb-3 block">Upload Image</Label>
            <ImageUpload onFile={handleFile} accept="image/*" />
            {file && <p className="mt-2 text-xs text-muted-foreground">{file.name}</p>}
          </div>

          {/* Presets */}
          <div className="rounded-xl border border-border bg-card p-4">
            <Label className="text-xs text-muted-foreground mb-2 block">Quick Presets</Label>
            <div className="flex flex-wrap gap-2">
              {EBAY_PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  className="px-3 py-1 text-xs rounded-full border border-border bg-secondary hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Adjustments</Label>
              <Button onClick={reset} variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground hover:text-foreground">
                <RotateCcw className="w-3 h-3 mr-1" /> Reset
              </Button>
            </div>

            <SliderRow label="Brightness" value={brightness} onChange={setBrightness} min={0.5} max={2} step={0.01} displayFn={v => v.toFixed(2)} />
            <SliderRow label="Saturation" value={saturation} onChange={setSaturation} min={0} max={2.5} step={0.01} displayFn={v => v.toFixed(2)} />
            <SliderRow label="Contrast" value={contrast} onChange={setContrast} min={-80} max={80} step={1} displayFn={v => fmt(v)} />
            <SliderRow label="Hue Rotation" value={hue} onChange={setHue} min={-180} max={180} step={1} displayFn={v => fmt(v, "°")} />
            <SliderRow label="Sharpness" value={sharpness} onChange={setSharpness} min={0} max={5} step={0.1} displayFn={v => v.toFixed(1)} />
            <SliderRow label="Gamma" value={gamma} onChange={setGamma} min={1} max={2.5} step={0.05} displayFn={v => v.toFixed(2)} />

            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Output Format</Label>
                <Select value={outputFormat} onValueChange={setOutputFormat}>
                  <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["jpg", "png", "webp", "avif"].map(f => <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Quality: {quality}%</Label>
                <Slider value={[quality]} onValueChange={([v]) => setQuality(v)} min={70} max={100} step={2} className="w-full mt-2.5" />
              </div>
            </div>

            <Button onClick={process} disabled={loading || !dataUrl} className="w-full bg-primary hover:bg-primary/90">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Applying...</> : <><Palette className="w-4 h-4 mr-2" />Apply Adjustments</>}
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold text-sm mb-3">Before / After Preview</h2>

          {!dataUrl ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              <div className="text-center">
                <Palette className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Upload an image to begin</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Original</p>
                  <div className="rounded-lg overflow-hidden border border-border bg-secondary">
                    <img src={dataUrl} alt="Original" className="w-full h-44 object-contain" />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Adjusted</p>
                  <div className="rounded-lg overflow-hidden border border-border bg-secondary">
                    {result ? (
                      <img src={result.imageData} alt="Adjusted" className="w-full h-44 object-contain" />
                    ) : loading ? (
                      <div className="h-44 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                    ) : (
                      <div className="h-44 flex items-center justify-center text-muted-foreground text-xs">Click Apply to preview</div>
                    )}
                  </div>
                </div>
              </div>

              {result && (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-secondary/50 rounded-lg p-2 text-center">
                      <p className="text-muted-foreground">Dimensions</p>
                      <p className="font-semibold">{result.width}×{result.height}</p>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-2 text-center">
                      <p className="text-muted-foreground">Size</p>
                      <p className="font-semibold">{formatBytes(result.sizeBytes)}</p>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-2 text-center">
                      <p className="text-muted-foreground">Time</p>
                      <p className="font-semibold">{result.processingTime.toFixed(1)}s</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={download} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm">
                      <Download className="w-4 h-4 mr-2" /> Download
                    </Button>
                    <Button onClick={process} variant="outline" size="sm" disabled={loading}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
