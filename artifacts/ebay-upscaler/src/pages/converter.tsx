import { useState, useCallback } from "react";
import { Download, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useConvertImage } from "@workspace/api-client-react";
import ImageUpload from "@/components/ImageUpload";
import { toast } from "sonner";

const FORMATS = ["jpg", "jpeg", "png", "webp", "avif", "tiff", "bmp", "gif"];

export default function Converter() {
  const [file, setFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [result, setResult] = useState<{ imageData: string; filename: string; width: number; height: number; sizeBytes: number; format: string } | null>(null);
  const [format, setFormat] = useState("webp");
  const [quality, setQuality] = useState(90);
  const [stripMeta, setStripMeta] = useState(false);

  const convert = useConvertImage({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
        toast.success(`Converted to ${data.format?.toUpperCase()} successfully!`);
      },
      onError: () => toast.error("Conversion failed. Please try again."),
    },
  });

  const handleFile = useCallback((f: File, url: string) => {
    setFile(f);
    setDataUrl(url);
    setResult(null);
  }, []);

  const handleConvert = () => {
    if (!dataUrl || !file) return;
    convert.mutate({
      data: {
        imageData: dataUrl,
        filename: file.name,
        outputFormat: format as "jpg" | "jpeg" | "png" | "webp" | "avif" | "tiff" | "bmp" | "gif",
        quality,
        stripMetadata: stripMeta,
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
  const detectedFormat = file?.name.split(".").pop()?.toUpperCase() ?? "?";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Format Converter</h1>
        <p className="text-muted-foreground mt-1 text-sm">Convert any image to any format — JPG, PNG, WEBP, AVIF, TIFF, BMP, GIF and more</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold mb-3">Source Image</h2>
            <ImageUpload
              onFile={handleFile}
              preview={dataUrl}
              onClear={() => { setDataUrl(null); setFile(null); setResult(null); }}
              className="h-56"
            />
            {file && (
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">{file.name}</span>
                <span>{formatBytes(file.size)}</span>
              </div>
            )}
          </div>

          {/* Format flow */}
          {file && (
            <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-foreground">{detectedFormat}</div>
                <div className="text-xs text-muted-foreground">Input</div>
              </div>
              <ArrowRight className="w-5 h-5 text-primary" />
              <div className="text-center">
                <div className="text-lg font-bold text-primary">{format.toUpperCase()}</div>
                <div className="text-xs text-muted-foreground">Output</div>
              </div>
            </div>
          )}
        </div>

        {/* Settings + result */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold mb-4">Conversion Settings</h2>
            <div className="space-y-5">
              <div>
                <Label className="text-xs text-muted-foreground block mb-1.5">Target Format</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger className="h-9" data-testid="select-convert-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <Label className="text-xs text-muted-foreground">Quality</Label>
                  <span className="text-xs font-mono text-primary">{quality}%</span>
                </div>
                <Slider min={1} max={100} step={1} value={[quality]} onValueChange={([v]) => setQuality(v)} data-testid="slider-convert-quality" />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Strip EXIF/Metadata</Label>
                <Switch checked={stripMeta} onCheckedChange={setStripMeta} data-testid="switch-convert-strip" />
              </div>
              <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                disabled={!dataUrl || convert.isPending}
                onClick={handleConvert}
                data-testid="button-convert"
              >
                {convert.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Converting...</>
                ) : (
                  <><RefreshCw className="w-4 h-4 mr-2" /> Convert to {format.toUpperCase()}</>
                )}
              </Button>
            </div>
          </div>

          {result && (
            <div className="rounded-xl border border-primary/30 bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">Converted</h2>
                <Button
                  size="sm"
                  onClick={handleDownload}
                  className="text-xs bg-primary text-primary-foreground"
                  data-testid="button-download-converted"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Download
                </Button>
              </div>
              <img
                src={result.imageData}
                alt="Converted"
                className="w-full rounded-lg border border-border object-contain bg-secondary/40 max-h-48 mb-3"
              />
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div className="bg-secondary/40 rounded-lg px-2 py-1.5 text-center">
                  <div className="font-semibold text-foreground">{result.format?.toUpperCase()}</div>
                  <div>Format</div>
                </div>
                <div className="bg-secondary/40 rounded-lg px-2 py-1.5 text-center">
                  <div className="font-semibold text-foreground">{result.width}×{result.height}</div>
                  <div>Size</div>
                </div>
                <div className="bg-secondary/40 rounded-lg px-2 py-1.5 text-center">
                  <div className="font-semibold text-foreground">{formatBytes(result.sizeBytes)}</div>
                  <div>File</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
