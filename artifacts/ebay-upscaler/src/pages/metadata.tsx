import { useState, useCallback } from "react";
import { FileSearch, Trash2, ShieldOff, Download, Loader2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import ImageUpload from "@/components/ImageUpload";
import { toast } from "sonner";

interface ExifResult {
  tags: Record<string, unknown>;
  privacyRiskFields: string[];
  hasExif: boolean;
  hasIcc: boolean;
  hasXmp: boolean;
  rawSizeBytes: number;
}

interface ProcessResult {
  imageData: string;
  filename: string;
  originalSizeBytes: number;
  newSizeBytes: number;
  savedBytes: number;
  width: number;
  height: number;
}

export default function MetadataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [exifData, setExifData] = useState<ExifResult | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [action, setAction] = useState<"strip-all" | "strip-privacy" | "strip-selected">("strip-all");
  const [outputFormat, setOutputFormat] = useState("jpg");
  const [quality, setQuality] = useState(92);
  const [showAll, setShowAll] = useState(false);

  const handleFile = useCallback((f: File, url: string) => {
    setFile(f);
    setDataUrl(url);
    setExifData(null);
    setResult(null);
  }, []);

  const readExif = async () => {
    if (!dataUrl) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tools/exif/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: dataUrl }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as ExifResult;
      setExifData(data);
      toast.success(`Found ${Object.keys(data.tags).length} metadata fields`);
    } catch (err) {
      toast.error(`Failed to read EXIF: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const processExif = async () => {
    if (!dataUrl || !file) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/tools/exif/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: dataUrl,
          filename: file.name,
          action,
          outputFormat,
          quality,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as ProcessResult;
      setResult(data);
      toast.success(`Metadata cleaned! Saved ${formatBytes(data.savedBytes)}`);
    } catch (err) {
      toast.error(`Processing failed: ${err}`);
    } finally {
      setProcessing(false);
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.imageData;
    a.download = result.filename;
    a.click();
  };

  const formatBytes = (b: number) => {
    if (b < 0) return `-${formatBytes(-b)}`;
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1048576).toFixed(2)} MB`;
  };

  const allTags = exifData ? Object.entries(exifData.tags) : [];
  const privacySet = new Set(exifData?.privacyRiskFields ?? []);
  const displayTags = showAll ? allTags : allTags.filter(([k]) => privacySet.has(k));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FileSearch className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">Metadata Editor</h1>
          <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">EXIF / XMP / IPTC</span>
        </div>
        <p className="text-muted-foreground text-sm">Read, view, and strip sensitive metadata from your product images before listing on eBay.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload + Controls */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <Label className="text-sm font-medium mb-3 block">Upload Image</Label>
            <ImageUpload onFile={handleFile} accept="image/*" />
            {file && (
              <p className="mt-2 text-xs text-muted-foreground">{file.name} — {formatBytes(file.size)}</p>
            )}
          </div>

          {dataUrl && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div className="flex gap-2">
                <Button onClick={readExif} disabled={loading} variant="outline" className="flex-1 text-sm">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                  {loading ? "Reading..." : "Read Metadata"}
                </Button>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <Label className="text-sm font-medium">Strip Action</Label>
                <Select value={action} onValueChange={(v) => setAction(v as typeof action)}>
                  <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strip-all">Strip All Metadata (recommended for eBay)</SelectItem>
                    <SelectItem value="strip-privacy">Strip Privacy Fields (GPS, Device, Software)</SelectItem>
                    <SelectItem value="strip-selected">Strip Selected Fields</SelectItem>
                  </SelectContent>
                </Select>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Output Format</Label>
                    <Select value={outputFormat} onValueChange={setOutputFormat}>
                      <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["jpg", "png", "webp", "avif"].map(f => (
                          <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Quality: {quality}%</Label>
                    <input
                      type="range" min={60} max={100} value={quality}
                      onChange={(e) => setQuality(Number(e.target.value))}
                      className="w-full accent-primary h-2 mt-2.5"
                    />
                  </div>
                </div>

                <Button onClick={processExif} disabled={processing} className="w-full bg-primary hover:bg-primary/90 text-sm">
                  {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldOff className="w-4 h-4 mr-2" />}
                  {processing ? "Processing..." : "Clean Metadata"}
                </Button>
              </div>
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 space-y-3">
              <h3 className="font-semibold text-green-400 text-sm flex items-center gap-2">
                <ShieldOff className="w-4 h-4" /> Metadata Cleaned
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-card rounded-lg p-2">
                  <p className="text-muted-foreground">Original</p>
                  <p className="font-semibold">{formatBytes(result.originalSizeBytes)}</p>
                </div>
                <div className="bg-card rounded-lg p-2">
                  <p className="text-muted-foreground">Cleaned</p>
                  <p className="font-semibold text-green-400">{formatBytes(result.newSizeBytes)}</p>
                </div>
                <div className="bg-card rounded-lg p-2 col-span-2">
                  <p className="text-muted-foreground">Space Saved</p>
                  <p className="font-semibold text-primary">{formatBytes(result.savedBytes)} ({result.width}×{result.height}px)</p>
                </div>
              </div>
              <Button onClick={download} className="w-full bg-green-600 hover:bg-green-700 text-white text-sm">
                <Download className="w-4 h-4 mr-2" /> Download Clean Image
              </Button>
            </div>
          )}
        </div>

        {/* EXIF Data Display */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Metadata Fields</h2>
            {exifData && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{showAll ? "All fields" : "Privacy fields"}</span>
                <Switch checked={showAll} onCheckedChange={setShowAll} />
                {showAll ? <Eye className="w-3.5 h-3.5 text-muted-foreground" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
            )}
          </div>

          {!exifData ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              <div className="text-center">
                <FileSearch className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Upload an image and click "Read Metadata"</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2 flex-wrap mb-3">
                {exifData.hasExif && <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full">EXIF</span>}
                {exifData.hasXmp && <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-xs rounded-full">XMP</span>}
                {exifData.hasIcc && <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-xs rounded-full">ICC</span>}
                {exifData.privacyRiskFields.length > 0 && (
                  <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-xs rounded-full flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {exifData.privacyRiskFields.length} privacy risks
                  </span>
                )}
              </div>

              <div className="overflow-y-auto max-h-96 space-y-1 pr-1">
                {displayTags.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No fields to show. Toggle "All fields" to see everything.</p>
                ) : displayTags.map(([key, val]) => {
                  const isPrivacy = privacySet.has(key);
                  return (
                    <div key={key} className={`flex items-start gap-2 p-2 rounded-lg text-xs ${isPrivacy ? "bg-red-500/8 border border-red-500/20" : "bg-secondary/40"}`}>
                      {isPrivacy && <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <span className={`font-medium ${isPrivacy ? "text-red-300" : "text-foreground"}`}>{key}</span>
                        <span className="text-muted-foreground ml-2 truncate block">
                          {typeof val === "object" ? JSON.stringify(val).slice(0, 80) : String(val ?? "").slice(0, 80)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground pt-1">
                {allTags.length} total fields · {exifData.privacyRiskFields.length} privacy risks · {formatBytes(exifData.rawSizeBytes)} file
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
