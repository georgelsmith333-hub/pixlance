import { useState, useCallback } from "react";
import { Download, Wand2, Loader2, Info, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAiEditImage } from "@workspace/api-client-react";
import ImageUpload from "@/components/ImageUpload";
import { toast } from "sonner";

const EXAMPLES = [
  "Change 30 tablets to 60 tablets on the label",
  "Update the expiry date to 2026",
  "Replace 500mg with 1000mg on the front",
  "Change the net weight from 250g to 500g",
  "Remove the sale sticker",
];

export default function AiEdit() {
  const [file, setFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [result, setResult] = useState<{ imageData: string; filename: string; processingTime: number } | null>(null);
  const [instruction, setInstruction] = useState("");
  const [region, setRegion] = useState("");
  const [showCompare, setShowCompare] = useState(false);

  const edit = useAiEditImage({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
        toast.success("AI edit applied successfully!");
      },
      onError: () => toast.error("AI edit failed. Please check your instruction and try again."),
    },
  });

  const handleFile = useCallback((f: File, url: string) => {
    setFile(f);
    setDataUrl(url);
    setResult(null);
  }, []);

  const handleEdit = () => {
    if (!dataUrl || !file || !instruction.trim()) {
      toast.error("Please upload an image and enter an edit instruction");
      return;
    }
    edit.mutate({
      data: {
        imageData: dataUrl,
        filename: file.name,
        editInstruction: instruction,
        region: region || undefined,
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

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">AI Text Editor</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Use natural language to edit text on product packaging — powered by Pollinations AI
        </p>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 mb-6 flex gap-3 text-sm text-muted-foreground">
        <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div>
          <strong className="text-foreground">Use case:</strong> You have a health supplement showing "30 Tablets" but need a variant showing "60 Tablets". Type your instruction and the AI will regenerate the image with your changes — preserving product photography quality.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: upload + instruction */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold mb-3">Product Image</h2>
            <ImageUpload
              onFile={handleFile}
              preview={dataUrl}
              onClear={() => { setDataUrl(null); setFile(null); setResult(null); }}
              className="h-56"
              label="Drop your product image here"
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground block mb-2">Edit Instruction</Label>
              <Textarea
                placeholder="e.g. Change 30 tablets to 60 tablets on the bottle label"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                className="min-h-[80px] text-sm resize-none"
                data-testid="textarea-instruction"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground block mb-2">Region Hint (optional)</Label>
              <Input
                placeholder="e.g. bottom label, front panel, top text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="text-sm h-8"
                data-testid="input-region"
              />
            </div>

            {/* Examples */}
            <div>
              <Label className="text-xs text-muted-foreground block mb-2">Example instructions</Label>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setInstruction(ex)}
                    className="px-2.5 py-1 text-xs rounded-full border border-border hover:border-primary/50 hover:text-primary text-muted-foreground transition-colors"
                    data-testid={`button-example-${ex.slice(0, 20).replace(/\s/g, "-")}`}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              disabled={!dataUrl || !instruction.trim() || edit.isPending}
              onClick={handleEdit}
              data-testid="button-ai-edit"
            >
              {edit.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> AI is editing...</>
              ) : (
                <><Wand2 className="w-4 h-4 mr-2" /> Apply AI Edit</>
              )}
            </Button>
          </div>
        </div>

        {/* Right: result */}
        <div className="space-y-4">
          {result ? (
            <div className="rounded-xl border border-primary/30 bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">AI Edited Result</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Processed in {result.processingTime.toFixed(1)}s</p>
                </div>
                <div className="flex gap-2">
                  {dataUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCompare(!showCompare)}
                      className="text-xs"
                      data-testid="button-compare"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 mr-1" />
                      Compare
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleDownload}
                    className="text-xs bg-primary text-primary-foreground"
                    data-testid="button-download-ai"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
              {showCompare && dataUrl ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 text-center">Before</p>
                    <img src={dataUrl} alt="Before" className="w-full rounded-lg border border-border object-contain bg-secondary/40 max-h-64" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 text-center">After</p>
                    <img src={result.imageData} alt="After" className="w-full rounded-lg border border-primary/30 object-contain bg-secondary/40 max-h-64" />
                  </div>
                </div>
              ) : (
                <img src={result.imageData} alt="AI Edited" className="w-full rounded-lg border border-border object-contain max-h-72" />
              )}
              <p className="mt-3 text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2">
                Instruction: "{instruction}"
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 flex flex-col items-center justify-center text-center h-full min-h-64">
              <Wand2 className="w-10 h-10 text-primary/40 mb-4" />
              <p className="text-sm text-muted-foreground font-medium">Your AI-edited image will appear here</p>
              <p className="text-xs text-muted-foreground mt-1">Upload an image and enter your instruction to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
