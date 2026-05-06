import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Image as ImgIcon } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";

interface Props {
  files: File[];
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  accept?: Record<string, string[]>;
  maxFiles?: number;
  label?: string;
  hint?: string;
}

export default function ImageDropzone({ files, onFiles, multiple = true, accept, maxFiles = 20, label = "Drop images here", hint }: Props) {
  const onDrop = useCallback((accepted: File[]) => {
    onFiles(multiple ? [...files, ...accepted].slice(0, maxFiles) : accepted);
  }, [files, onFiles, multiple, maxFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept ?? { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    multiple,
    maxFiles,
  });

  const remove = (idx: number) => onFiles(files.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <div {...getRootProps()} className={cn(
        "rounded-2xl border-2 border-dashed p-8 flex flex-col items-center justify-center cursor-pointer transition-all gap-2",
        isDragActive ? "border-primary bg-primary/10 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-secondary/30"
      )}>
        <input {...getInputProps()} />
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Upload className="w-5 h-5 text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground">{isDragActive ? "Drop files here" : label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {multiple && <p className="text-xs text-muted-foreground">Up to {maxFiles} files</p>}
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="relative group rounded-xl border border-border overflow-hidden bg-secondary/30">
              <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-24 object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button onClick={() => remove(i)} className="p-1.5 rounded-full bg-red-500 text-white hover:bg-red-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="px-2 py-1.5">
                <p className="text-xs text-foreground/70 truncate">{f.name}</p>
                <p className="text-[10px] text-muted-foreground">{formatBytes(f.size)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
