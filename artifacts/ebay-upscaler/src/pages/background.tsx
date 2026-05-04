import { useState, useCallback } from "react";
import { Eraser, Download, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ImageUpload from "@/components/ImageUpload";
import { toast } from "sonner";

interface BgResult {
  imageData: string;
  filename: string;
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
  processingTime: number;
}

const REPLACE_COLORS = [
  { label: "Transparent (PNG)", value: "transparent" },
  { label: "White #FFFFFF (eBay)", value: "#FFFFFF" },
  { label: "Pure Black", value: "#000000" },
  { label: "Light Gray", value: "#F5F5F5" },
  { label: "Sky Blue", value: "#E3F2FD" },
  { label: "Soft Yellow", value: "#FFFDE7" },
  { label: "Custom...", value: "custom" },
];

export default function BackgroundPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [result, setResult] = useState<BgResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [replaceColor, setReplaceColor] = useState("transparent");
  const [customColor, setCustomColor] = useState("#FFFFFF");
  const [outputFormat, setOutputFormat] = useState("png");

  const handleFile = useCallback((f: File, url: string) => {
    setFile(f);
    setDataUrl(url);
    setResult(null);
  }, []);

  const process = async () => {
    if (!dataUrl || !file) return;
    setLoading(true);
    try {
      const color = replaceColor === "custom" ? customColor : replaceColor;
      const res = await fetch("/api/tools/background-remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: dataUrl,
          filename: file.name,
          replaceColor: color,
          outputFormat,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" })) as { error: string };
        throw new Error(err.error);
      }
      const data = await res.json() as BgResult;
      setResult(data);
      toast.success(`Background removed in ${data.processingTime.toFixed(1)}s`);
    } catch (err) {
      toast.error(`Background removal failed: ${String(err)}`);
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
          <Eraser className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">Background Remover</h1>
          <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-xs rounded-full font-medium">AI Powered</span>
        </div>
        <p className="text-muted-foreground text-sm">Remove product backgrounds with Cloudflare AI. Perfect for eBay white-background requirements.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <Label className="text-sm font-medium mb-3 block">Upload Product Image</Label>
            <ImageUpload onFile={handleFile} accept="image/*" />
            {file && <p className="mt-2 text-xs text-muted-foreground">{file.name}</p>}
          </div>

          {dataUrl && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Replace Background With</Label>
                <Select value={replaceColor} onValueChange={setReplaceColor}>
                  <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REPLACE_COLORS.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label !== "Custom..." && (
                          <span className="inline-block w-3 h-3 rounded-full border border-border mr-2" style={{ backgroundColor: c.value === "transparent" ? "transparent" : c.value }} />
                        )}
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {replaceColor === "custom" && (
                  <div className="flex items-center gap-2 mt-2">
                    <input type="color" value={customColor} onChange={e => setCustomColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-border" />
                    <input
                      type="text" value={customColor} onChange={e => setCustomColor(e.target.value)}
                      className="flex-1 h-9 px-3 rounded-lg bg-secondary border border-border text-sm"
                    />
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Output Format</Label>
                <Select value={outputFormat} onValueChange={setOutputFormat}>
                  <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="png">PNG (transparent support)</SelectItem>
                    <SelectItem value="jpg">JPEG (solid background)</SelectItem>
                    <SelectItem value="webp">WebP (transparent + small)</SelectItem>
                  </SelectContent>
                </Select>
                {outputFormat !== "png" && replaceColor === "transparent" && (
                  <p className="text-xs text-yellow-400 mt-1">⚠ Transparent bg only works with PNG/WebP</p>
                )}
              </div>

              <Button onClick={process} disabled={loading} className="w-full bg-primary hover:bg-primary/90">
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Removing background (AI processing...)</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />Remove Background</>
                )}
              </Button>
              {loading && (
                <p className="text-xs text-muted-foreground text-center">Using Cloudflare Workers AI — may take 15-30 seconds</p>
              )}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold text-sm mb-3">Preview</h2>

          {!dataUrl ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              <div className="text-center">
                <Eraser className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Upload an image to begin</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Original</p>
                  <div className="rounded-lg overflow-hidden border border-border bg-[#1a1a2e] checkerboard">
                    <img src={dataUrl} alt="Original" className="w-full h-40 object-contain" />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Result</p>
                  <div className="rounded-lg overflow-hidden border border-border bg-[#1a1a2e] checkerboard relative">
                    {result ? (
                      <img src={result.imageData} alt="Result" className="w-full h-40 object-contain" />
                    ) : loading ? (
                      <div className="h-40 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      </div>
                    ) : (
                      <div className="h-40 flex items-center justify-center text-muted-foreground text-xs">Result appears here</div>
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
                      <p className="text-muted-foreground">Dimensions</p>
                      <p className="font-semibold">{result.width}×{result.height}</p>
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

      <div className="mt-6 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <h3 className="font-semibold text-sm text-blue-300 mb-2">eBay Background Requirements</h3>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Main product image should have a pure white (#FFFFFF) or light neutral background</li>
          <li>• No watermarks, borders, or decorative elements on main image</li>
          <li>• Product should fill 85%+ of the image frame</li>
          <li>• PNG format preserves transparency for compositing into other designs</li>
        </ul>
      </div>

      <style>{`.checkerboard { background-image: linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%); background-size: 16px 16px; background-position: 0 0, 0 8px, 8px -8px, -8px 0px; }`}</style>
    </div>
  );
}
