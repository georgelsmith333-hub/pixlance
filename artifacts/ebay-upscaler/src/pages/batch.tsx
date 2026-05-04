import { useState, useCallback, useRef, useEffect } from "react";
import {
  Upload, Download, Trash2, Loader2, CheckCircle2, XCircle,
  Settings2, Package, Zap, FolderArchive, FileArchive, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const FORMATS = ["jpg", "jpeg", "png", "webp", "avif", "tiff", "bmp"];

interface ImageItem {
  id: string;
  file: File;
  dataUrl: string;
  status: "pending" | "processing" | "done" | "error";
  result?: { imageData: string; filename: string; width: number; height: number; sizeBytes: number };
  error?: string;
  fromZip?: string;
}

interface SSEProgress {
  type: "connected" | "progress" | "error" | "complete";
  current?: number;
  total?: number;
  percent?: number;
  filename?: string;
  error?: string;
  results?: Array<{ imageData: string; filename: string; width: number; height: number; sizeBytes: number; error?: string }>;
}

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif",
  "image/tiff", "image/bmp", "image/gif", "image/svg+xml",
]);

function isImageFilename(name: string) {
  return /\.(jpe?g|png|webp|avif|tiff?|bmp|gif|svg)$/i.test(name);
}

export default function Batch() {
  const inputRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ImageItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [extractingZip, setExtractingZip] = useState(false);
  const [previewItem, setPreviewItem] = useState<ImageItem | null>(null);

  const [targetSize, setTargetSize] = useState(2000);
  const [format, setFormat] = useState("jpg");
  const [quality, setQuality] = useState(90);
  const [stripMeta, setStripMeta] = useState(true);
  const [ebayBoost, setEbayBoost] = useState(true);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");

  const esRef = useRef<EventSource | null>(null);
  useEffect(() => () => { esRef.current?.close(); }, []);

  // ─── Pick up images sent from Scraper page ───────────────────────────────
  useEffect(() => {
    const raw = sessionStorage.getItem("scraper_to_batch");
    if (!raw) return;
    sessionStorage.removeItem("scraper_to_batch");
    try {
      const payload = JSON.parse(raw) as Array<{ dataUrl: string; filename: string; sizeBytes: number }>;
      if (!payload.length) return;
      payload.forEach(({ dataUrl, filename, sizeBytes }) => {
        const mime = dataUrl.split(";")[0].replace("data:", "") || "image/jpeg";
        const file = new File([new Uint8Array(sizeBytes || 1)], filename, { type: mime });
        setItems(prev => [
          ...prev,
          {
            id: `scraped-${Date.now()}-${Math.random()}-${filename}`,
            file,
            dataUrl,
            status: "pending",
            fromZip: "Scraped images",
          },
        ]);
      });
      toast.success(`Loaded ${payload.length} scraped images — ready to process!`);
    } catch { /* ignore */ }
  }, []);

  // ─── Add plain image files ───────────────────────────────────────────────────
  const readFiles = useCallback((files: File[], zipName?: string) => {
    const imgFiles = files.filter(f => IMAGE_MIME_TYPES.has(f.type) || isImageFilename(f.name));
    if (!imgFiles.length) return;
    imgFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setItems((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}-${file.name}`,
            file,
            dataUrl: e.target?.result as string,
            status: "pending",
            fromZip: zipName,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // ─── Extract ZIP ─────────────────────────────────────────────────────────────
  const extractZip = useCallback(async (zipFile: File) => {
    setExtractingZip(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(zipFile);
      const entries = Object.entries(zip.files).filter(([name, f]) => !f.dir && isImageFilename(name));

      if (!entries.length) {
        toast.warning("No images found in ZIP file");
        return;
      }

      let added = 0;
      const promises = entries.map(async ([name, entry]) => {
        const blob = await entry.async("blob");
        const ext = name.split(".").pop()?.toLowerCase() ?? "jpg";
        const mimeMap: Record<string, string> = {
          jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
          webp: "image/webp", avif: "image/avif", tiff: "image/tiff",
          tif: "image/tiff", bmp: "image/bmp", gif: "image/gif",
        };
        const mime = mimeMap[ext] ?? "image/jpeg";
        const file = new File([blob], name.split("/").pop() ?? name, { type: mime });
        return { file, name };
      });

      const resolved = await Promise.all(promises);
      resolved.forEach(({ file, name }) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setItems((prev) => [
            ...prev,
            {
              id: `zip-${Date.now()}-${Math.random()}-${name}`,
              file,
              dataUrl: e.target?.result as string,
              status: "pending",
              fromZip: zipFile.name,
            },
          ]);
          added++;
        };
        reader.readAsDataURL(file);
      });

      toast.success(`Extracted ${entries.length} images from ${zipFile.name}`);
    } catch (err) {
      toast.error(`Failed to extract ZIP: ${String(err)}`);
    } finally {
      setExtractingZip(false);
    }
  }, []);

  // ─── Drop handler (supports images + ZIP files) ───────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const zips = files.filter(f => f.name.endsWith(".zip") || f.type === "application/zip");
    const imgs = files.filter(f => !f.name.endsWith(".zip") && f.type !== "application/zip");
    zips.forEach(z => void extractZip(z));
    if (imgs.length) readFiles(imgs);
  }, [extractZip, readFiles]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) readFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const onZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(f => void extractZip(f));
    e.target.value = "";
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  // ─── Process batch ────────────────────────────────────────────────────────
  const handleProcess = async () => {
    if (!items.length || processing) return;
    setProcessing(true);
    setProgress(2);
    setProgressText("Starting...");
    setItems((prev) => prev.map((i) => ({ ...i, status: "processing" as const, result: undefined, error: undefined })));

    const jobId = `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const es = new EventSource(`/api/progress/${jobId}`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as SSEProgress;
        if (data.type === "progress") {
          setProgress(data.percent ?? 0);
          setProgressText(`Processing ${data.filename ?? ""} (${data.current}/${data.total})`);
        }
        if (data.type === "error" && data.current !== undefined) {
          setItems((prev) => prev.map((item, idx) =>
            idx === (data.current! - 1) ? { ...item, status: "error" as const, error: data.error } : item
          ));
        }
        if (data.type === "complete" && data.results) {
          setItems((prev) => prev.map((item, idx) => {
            const r = data.results![idx];
            if (!r) return { ...item, status: "error" as const };
            if (r.error) return { ...item, status: "error" as const, error: r.error };
            return { ...item, status: "done" as const, result: r };
          }));
          setProgress(100);
          const successCount = data.results.filter(r => !r.error).length;
          const failCount = data.results.filter(r => r.error).length;
          setProgressText(`Complete! ${successCount} succeeded${failCount ? `, ${failCount} failed` : ""}`);
          toast.success(`Done! ${successCount} images processed.`);
          es.close();
          setProcessing(false);
        }
      } catch { /* ignore */ }
    };
    es.onerror = () => { es.close(); };

    try {
      const res = await fetch("/api/tools/batch-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          jobId,
          images: items.map(i => ({ imageData: i.dataUrl, filename: i.file.name })),
          targetWidth: targetSize,
          targetHeight: targetSize,
          format,
          quality,
          stripMetadata: stripMeta,
          ebayBoost,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        if (res.status === 429) toast.error("Monthly limit reached. Upgrade to Pro for unlimited access.");
        else toast.error(err.error ?? "Batch failed");
        es.close();
        setProcessing(false);
        setItems((prev) => prev.map(i => ({ ...i, status: "error" as const })));
      }
    } catch (err) {
      toast.error(`Batch failed: ${String(err)}`);
      es.close();
      setProcessing(false);
      setItems((prev) => prev.map(i => ({ ...i, status: "error" as const })));
    }
  };

  // ─── Download helpers ──────────────────────────────────────────────────────
  const handleDownloadAll = async () => {
    const done = items.filter((i) => i.status === "done" && i.result);
    if (!done.length) return;
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      done.forEach((i) => {
        if (!i.result) return;
        const base64 = i.result.imageData.split(",")[1];
        zip.file(i.result.filename, base64, { base64: true });
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ebay-images-processed.zip";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("ZIP download started!");
    } catch {
      toast.error("Failed to create ZIP");
    }
  };

  const handleDownloadOne = (item: ImageItem) => {
    if (!item.result) return;
    const a = document.createElement("a");
    a.href = item.result.imageData;
    a.download = item.result.filename;
    a.click();
  };

  const handleDownloadOriginalZip = async () => {
    const all = items;
    if (!all.length) return;
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      all.forEach((i) => {
        const base64 = i.dataUrl.split(",")[1];
        zip.file(i.file.name, base64, { base64: true });
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "originals.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to create ZIP");
    }
  };

  const formatBytes = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;
  const doneCount = items.filter((i) => i.status === "done").length;
  const pendingCount = items.filter((i) => i.status === "pending" || i.status === "processing").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  // ─── ZIP source groups ─────────────────────────────────────────────────────
  const zipGroups = [...new Set(items.filter(i => i.fromZip).map(i => i.fromZip!))];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Package className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">Batch Processing</h1>
          <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full font-medium flex items-center gap-1">
            <Zap className="w-3 h-3" /> Real-Time Progress
          </span>
          <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium flex items-center gap-1">
            <FolderArchive className="w-3 h-3" /> ZIP Support
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          Upload images or drop a <strong className="text-foreground">ZIP folder</strong> — images are auto-extracted, processed, and downloadable one-by-one or as a new ZIP
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload + file list */}
        <div className="lg:col-span-2 space-y-4">

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all ${
              dragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-secondary/30"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            {extractingZip ? (
              <><Loader2 className="w-10 h-10 text-primary animate-spin" /><p className="text-sm font-medium">Extracting ZIP...</p></>
            ) : (
              <>
                <Upload className="w-10 h-10 text-primary" />
                <p className="text-sm font-medium">Drop images <span className="text-primary">or a ZIP folder</span> here</p>
                <p className="text-xs text-muted-foreground">All image formats + ZIP archives — auto-extracts all images inside</p>
                <div className="flex gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-full bg-secondary text-xs text-muted-foreground">JPG PNG WEBP BMP GIF</span>
                  <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-medium">.ZIP folder</span>
                </div>
              </>
            )}
            <input ref={inputRef} type="file" accept="image/*" multiple onChange={onInputChange} className="hidden" />
          </div>

          {/* ZIP upload button */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs flex items-center gap-1.5"
              onClick={() => zipRef.current?.click()}
              disabled={extractingZip}
            >
              <FileArchive className="w-3.5 h-3.5" />
              {extractingZip ? "Extracting..." : "Upload ZIP Archive"}
            </Button>
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground flex items-center gap-1.5"
                onClick={() => void handleDownloadOriginalZip()}
              >
                <Download className="w-3.5 h-3.5" /> Download Originals ZIP
              </Button>
            )}
            <input ref={zipRef} type="file" accept=".zip,application/zip" multiple onChange={onZipChange} className="hidden" />
          </div>

          {/* ZIP source tags */}
          {zipGroups.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {zipGroups.map(zipName => (
                <span key={zipName} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs border border-primary/20">
                  <FileArchive className="w-3 h-3" />
                  {zipName} ({items.filter(i => i.fromZip === zipName).length} images)
                </span>
              ))}
            </div>
          )}

          {/* Live progress */}
          {processing && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  {progressText || `Processing ${items.length} images...`}
                </span>
                <span className="text-xs font-mono text-primary">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1.5">Live progress via server-sent events</p>
            </div>
          )}

          {!processing && progress === 100 && doneCount > 0 && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-3 flex items-center justify-between">
              <p className="text-sm text-green-400 font-medium">{progressText}</p>
              {errorCount > 0 && <span className="text-xs text-red-400">{errorCount} failed</span>}
            </div>
          )}

          {/* File list */}
          {items.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-semibold">
                  {items.length} images
                  {pendingCount > 0 && <span className="text-muted-foreground ml-1">· {pendingCount} pending</span>}
                  {doneCount > 0 && <span className="text-green-400 ml-1">· {doneCount} done</span>}
                  {errorCount > 0 && <span className="text-red-400 ml-1">· {errorCount} error</span>}
                </span>
                <div className="flex gap-2">
                  {doneCount > 0 && (
                    <Button size="sm" className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => void handleDownloadAll()}>
                      <Package className="w-3.5 h-3.5 mr-1" /> Download ZIP ({doneCount})
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setItems([])} className="text-xs text-muted-foreground">
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear All
                  </Button>
                </div>
              </div>
              <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/20 transition-colors">
                    {/* Thumbnail */}
                    <div className="relative shrink-0">
                      <img
                        src={item.result?.imageData ?? item.dataUrl}
                        alt={item.file.name}
                        className="w-10 h-10 rounded-lg object-cover bg-secondary/40 border border-border"
                      />
                      {item.fromZip && (
                        <FileArchive className="absolute -bottom-1 -right-1 w-3 h-3 text-primary bg-card rounded-full" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{item.file.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.result
                          ? `${item.result.width}×${item.result.height} · ${formatBytes(item.result.sizeBytes)} · ✓ eBay ready`
                          : formatBytes(item.file.size)
                        }
                        {item.error && <span className="text-red-400 ml-1">· {item.error.slice(0, 50)}</span>}
                        {item.fromZip && <span className="text-primary/60 ml-1">· from ZIP</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.status === "pending" && (
                        <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-secondary">Pending</span>
                      )}
                      {item.status === "processing" && (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      )}
                      {item.status === "done" && (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <Button
                            size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            title="Preview"
                            onClick={() => setPreviewItem(item)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            title="Download"
                            onClick={() => handleDownloadOne(item)}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {item.status === "error" && <XCircle className="w-4 h-4 text-destructive" />}
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Batch download footer */}
              {doneCount > 0 && (
                <div className="px-4 py-3 border-t border-border bg-secondary/20 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{doneCount} images ready to download</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => void handleDownloadAll()}>
                      <Package className="w-3 h-3 mr-1" /> All as ZIP
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Settings panel */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <Settings2 className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">Global Settings</h2>
            </div>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between mb-1.5">
                  <Label className="text-xs text-muted-foreground">Target Size (1:1)</Label>
                  <span className="text-xs font-mono text-primary">{targetSize}px</span>
                </div>
                <Slider min={1600} max={6500} step={100} value={[targetSize]} onValueChange={([v]) => setTargetSize(v)} />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>1600 min</span><span>6500 max (eBay)</span>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground block mb-1.5">Output Format</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMATS.map(f => <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <Label className="text-xs text-muted-foreground">Quality</Label>
                  <span className="text-xs font-mono text-primary">{quality}%</span>
                </div>
                <Slider min={1} max={100} step={1} value={[quality]} onValueChange={([v]) => setQuality(v)} />
              </div>
              <div className="space-y-3 pt-1 border-t border-border">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Strip Metadata</Label>
                  <Switch checked={stripMeta} onCheckedChange={setStripMeta} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">eBay CTR Boost</Label>
                  <Switch checked={ebayBoost} onCheckedChange={setEbayBoost} />
                </div>
              </div>
              <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                disabled={!items.length || processing || extractingZip}
                onClick={() => void handleProcess()}
              >
                {processing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                ) : (
                  <>Process {items.length} Image{items.length !== 1 ? "s" : ""}</>
                )}
              </Button>
            </div>
          </div>

          {/* ZIP tip card */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs space-y-2">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <FileArchive className="w-3.5 h-3.5 text-primary" /> ZIP Workflow
            </p>
            <p className="text-muted-foreground">1. Drop a <code className="text-primary">.zip</code> file or click "Upload ZIP Archive"</p>
            <p className="text-muted-foreground">2. All images inside are auto-extracted (including subfolders)</p>
            <p className="text-muted-foreground">3. Process all at once, download each individually or all as a new ZIP</p>
          </div>
        </div>
      </div>

      {/* Preview modal */}
      {previewItem?.result && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div className="relative max-w-3xl w-full rounded-2xl overflow-hidden bg-card border border-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-medium">{previewItem.result.filename}</span>
              <div className="flex gap-2">
                <Button size="sm" className="text-xs bg-primary text-primary-foreground" onClick={() => handleDownloadOne(previewItem)}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Download
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPreviewItem(null)}>✕</Button>
              </div>
            </div>
            <img src={previewItem.result.imageData} alt={previewItem.result.filename} className="w-full max-h-[70vh] object-contain" />
            <div className="px-4 py-2 border-t border-border flex gap-4 text-xs text-muted-foreground">
              <span>{previewItem.result.width}×{previewItem.result.height}px</span>
              <span>{formatBytes(previewItem.result.sizeBytes)}</span>
              <span className="text-green-400">eBay ready ✓</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
