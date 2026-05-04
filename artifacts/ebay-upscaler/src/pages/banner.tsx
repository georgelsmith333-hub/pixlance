import { useState, useCallback } from "react";
import { Download, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCreateBanner } from "@workspace/api-client-react";
import ImageUpload from "@/components/ImageUpload";
import { toast } from "sonner";

const COUNTRIES = [
  { code: "US", label: "🇺🇸 United States" },
  { code: "UK", label: "🇬🇧 United Kingdom" },
  { code: "CA", label: "🇨🇦 Canada" },
  { code: "AU", label: "🇦🇺 Australia" },
  { code: "DE", label: "🇩🇪 Germany" },
  { code: "FR", label: "🇫🇷 France" },
  { code: "IT", label: "🇮🇹 Italy" },
  { code: "ES", label: "🇪🇸 Spain" },
  { code: "JP", label: "🇯🇵 Japan" },
];

const POSITIONS = [
  { value: "bottom-right", label: "Bottom Right (Default)" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "top-right", label: "Top Right" },
  { value: "top-left", label: "Top Left" },
];

const SIZES = [
  { label: "1600×1600 (Minimum eBay)", w: 1600, h: 1600 },
  { label: "2000×2000 (Recommended)", w: 2000, h: 2000 },
  { label: "2500×2500 (High Quality)", w: 2500, h: 2500 },
  { label: "3000×3000 (Premium)", w: 3000, h: 3000 },
  { label: "4000×4000 (Ultra)", w: 4000, h: 4000 },
];

export default function Banner() {
  const [file, setFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [result, setResult] = useState<{ imageData: string; filename: string; width: number; height: number; sizeBytes: number } | null>(null);

  const [country, setCountry] = useState("US");
  const [position, setPosition] = useState("bottom-right");
  const [sizePreset, setSizePreset] = useState("2000x2000");
  const [outputFormat, setOutputFormat] = useState("jpg");

  const selectedSize = SIZES.find((s) => `${s.w}x${s.h}` === sizePreset) ?? SIZES[1];

  const create = useCreateBanner({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
        toast.success("Banner created successfully!");
      },
      onError: () => toast.error("Banner creation failed. Please try again."),
    },
  });

  const handleFile = useCallback((f: File, url: string) => {
    setFile(f);
    setDataUrl(url);
    setResult(null);
  }, []);

  const handleCreate = () => {
    if (!dataUrl || !file) return;
    create.mutate({
      data: {
        imageData: dataUrl,
        filename: file.name,
        country,
        logoPosition: position as "top-left" | "top-right" | "bottom-left" | "bottom-right",
        bannerWidth: selectedSize.w,
        bannerHeight: selectedSize.h,
        outputFormat: outputFormat as "jpg" | "jpeg" | "png" | "webp",
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
        <h1 className="text-3xl font-bold text-foreground">eBay Banner Creator</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Automatically applies pure white (#FFFFFF) background + country shipping badge for maximum eBay CTR
        </p>
      </div>

      {/* What we do info */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 mb-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>Pure white <code className="font-mono text-primary">#FFFFFF</code> background</span>
        <span>•</span>
        <span>Product centered at 85% canvas fill</span>
        <span>•</span>
        <span>Lanczos3 upscaling</span>
        <span>•</span>
        <span>Country shipping badge at your chosen corner</span>
        <span>•</span>
        <span>eBay-optimized sharpness + saturation</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload + Preview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold mb-3">Product Image</h2>
            <ImageUpload
              onFile={handleFile}
              preview={dataUrl}
              onClear={() => { setDataUrl(null); setFile(null); setResult(null); }}
              className="h-64"
              label="Drop your product image here"
            />
            {file && <div className="mt-2 text-xs text-muted-foreground">{file.name}</div>}
          </div>

          {/* Result banner */}
          {result && (
            <div className="rounded-xl border border-primary/30 bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Your eBay Banner</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">White #FFFFFF background · {result.width}×{result.height}px · {formatBytes(result.sizeBytes)}</p>
                </div>
                <Button
                  onClick={handleDownload}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                  size="sm"
                  data-testid="button-download-banner"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Download
                </Button>
              </div>
              <img
                src={result.imageData}
                alt="Banner"
                className="w-full rounded-lg border border-border object-contain"
                style={{ background: "#fff" }}
              />
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="rounded-xl border border-border bg-card p-4 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Banner Settings</h2>
          </div>
          <div className="space-y-5">
            {/* Country */}
            <div>
              <Label className="text-xs text-muted-foreground block mb-1.5">Shipping Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="h-9 text-sm" data-testid="select-country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Logo position */}
            <div>
              <Label className="text-xs text-muted-foreground block mb-1.5">Badge Position</Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger className="h-9 text-sm" data-testid="select-position">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Size preset */}
            <div>
              <Label className="text-xs text-muted-foreground block mb-1.5">Banner Size</Label>
              <Select value={sizePreset} onValueChange={setSizePreset}>
                <SelectTrigger className="h-9 text-sm" data-testid="select-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIZES.map((s) => (
                    <SelectItem key={`${s.w}x${s.h}`} value={`${s.w}x${s.h}`}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Format */}
            <div>
              <Label className="text-xs text-muted-foreground block mb-1.5">Output Format</Label>
              <Select value={outputFormat} onValueChange={setOutputFormat}>
                <SelectTrigger className="h-9 text-sm" data-testid="select-banner-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["jpg", "png", "webp"].map((f) => (
                    <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              disabled={!dataUrl || create.isPending}
              onClick={handleCreate}
              data-testid="button-create-banner"
            >
              {create.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Banner...</>
              ) : (
                <>Create eBay Banner</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
