import { useState, useCallback } from "react";
import { Stamp, Download, Loader2, RefreshCw, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import ImageUpload from "@/components/ImageUpload";
import { toast } from "sonner";

interface WatermarkResult {
  imageData: string;
  filename: string;
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
  processingTime: number;
}

const POSITIONS = [
  { value: "top-left", label: "Top Left" },
  { value: "top-center", label: "Top Center" },
  { value: "top-right", label: "Top Right" },
  { value: "center", label: "Center" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "bottom-center", label: "Bottom Center" },
  { value: "bottom-right", label: "Bottom Right (default)" },
];

export default function WatermarkPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [result, setResult] = useState<WatermarkResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [text, setText] = useState("© YourStore");
  const [fontSize, setFontSize] = useState(48);
  const [opacity, setOpacity] = useState(0.7);
  const [position, setPosition] = useState("bottom-right");
  const [color, setColor] = useState("#FFFFFF");
  const [outputFormat, setOutputFormat] = useState("jpg");
  const [quality, setQuality] = useState(92);
  const [tile, setTile] = useState(false);

  const handleFile = useCallback((f: File, url: string) => {
    setFile(f);
    setDataUrl(url);
    setResult(null);
  }, []);

  const process = async () => {
    if (!dataUrl || !file || !text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tools/watermark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: dataUrl,
          filename: file.name,
          text: text.trim(),
          fontSize,
          opacity,
          position,
          color,
          outputFormat,
          quality,
          tile,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" })) as { error: string };
        throw new Error(err.error);
      }
      const data = await res.json() as WatermarkResult;
      setResult(data);
      toast.success(`Watermark added in ${data.processingTime.toFixed(1)}s`);
    } catch (err) {
      toast.error(`Watermark failed: ${String(err)}`);
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

  const formatBytes = (b: number) => b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Stamp className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">Watermark Tool</h1>
        </div>
        <p className="text-muted-foreground text-sm">Add custom text watermarks to protect your product images and brand your eBay listings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <Label className="text-sm font-medium mb-3 block">Upload Image</Label>
            <ImageUpload onFile={handleFile} accept="image/*" />
            {file && <p className="mt-2 text-xs text-muted-foreground">{file.name}</p>}
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                <Type className="w-3.5 h-3.5" /> Watermark Text
              </Label>
              <Input
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="© Your Store Name"
                className="text-sm h-9"
                maxLength={200}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Position</Label>
                <Select value={position} onValueChange={setPosition}>
                  <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-9 h-9 rounded cursor-pointer border border-border bg-transparent" />
                  <Input value={color} onChange={e => setColor(e.target.value)} className="text-sm h-9 font-mono" />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Font Size: {fontSize}px</Label>
              <Slider value={[fontSize]} onValueChange={([v]) => setFontSize(v)} min={16} max={200} step={4} className="w-full" />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Opacity: {Math.round(opacity * 100)}%</Label>
              <Slider value={[Math.round(opacity * 100)]} onValueChange={([v]) => setOpacity(v / 100)} min={10} max={100} step={5} className="w-full" />
            </div>

            <div className="grid grid-cols-2 gap-3">
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

            <div className="flex items-center justify-between py-2 border-t border-border">
              <div>
                <Label className="text-sm font-medium">Tile Watermark</Label>
                <p className="text-xs text-muted-foreground">Repeat across entire image</p>
              </div>
              <Switch checked={tile} onCheckedChange={setTile} />
            </div>

            <Button onClick={process} disabled={loading || !text.trim()} className="w-full bg-primary hover:bg-primary/90">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Adding Watermark...</> : <><Stamp className="w-4 h-4 mr-2" />Add Watermark</>}
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold text-sm mb-3">Preview</h2>

          {!dataUrl ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              <div className="text-center">
                <Stamp className="w-10 h-10 mx-auto mb-2 opacity-30" />
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
                  <p className="text-xs text-muted-foreground mb-1">Watermarked</p>
                  <div className="rounded-lg overflow-hidden border border-border bg-secondary relative">
                    {result ? (
                      <img src={result.imageData} alt="Result" className="w-full h-44 object-contain" />
                    ) : loading ? (
                      <div className="h-44 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                    ) : (
                      <div className="h-44 flex items-center justify-center text-muted-foreground text-xs">Result appears here</div>
                    )}
                  </div>
                </div>
              </div>

              {result && (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-secondary/50 rounded-lg p-2 text-center">
                      <p className="text-muted-foreground">Size</p>
                      <p className="font-semibold">{formatBytes(result.sizeBytes)}</p>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-2 text-center">
                      <p className="text-muted-foreground">Format</p>
                      <p className="font-semibold">{result.format.toUpperCase()}</p>
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
