import { useCallback, useRef, useState } from "react";
import { Upload, ImageIcon, X } from "lucide-react";

interface Props {
  onFile: (file: File, dataUrl: string) => void;
  accept?: string;
  label?: string;
  preview?: string | null;
  onClear?: () => void;
  className?: string;
}

export default function ImageUpload({
  onFile,
  accept = "image/*",
  label = "Drop image here or click to browse",
  preview,
  onClear,
  className = "",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        onFile(file, dataUrl);
      };
      reader.readAsDataURL(file);
    },
    [onFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) handleFile(file);
    },
    [handleFile]
  );

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  if (preview) {
    return (
      <div className={`relative rounded-xl overflow-hidden border border-border ${className}`}>
        <img src={preview} alt="Preview" className="w-full h-full object-contain bg-secondary/40" />
        {onClear && (
          <button
            onClick={onClear}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 border border-border hover:bg-destructive/20 transition-colors"
            data-testid="button-clear-image"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
        dragging
          ? "border-primary bg-primary/10"
          : "border-border hover:border-primary/50 hover:bg-secondary/40"
      } ${className}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      data-testid="dropzone-upload"
    >
      <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
        {dragging ? (
          <ImageIcon className="w-8 h-8 text-primary" />
        ) : (
          <Upload className="w-8 h-8 text-primary" />
        )}
      </div>
      <div className="text-center px-4">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-1">
          JPG, JPEG, PNG, WEBP, AVIF, TIFF, BMP, GIF supported
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onChange}
        className="hidden"
        data-testid="input-file-upload"
      />
    </div>
  );
}
