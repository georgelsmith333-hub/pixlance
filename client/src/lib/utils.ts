import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function downloadBase64(base64: string, filename: string, mime = "image/jpeg") {
  const blob = base64ToBlob(base64, mime);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function scoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

export function scoreBg(score: number): string {
  if (score >= 80) return "bg-green-500/10 border-green-500/30 text-green-400";
  if (score >= 60) return "bg-amber-500/10 border-amber-500/30 text-amber-400";
  return "bg-red-500/10 border-red-500/30 text-red-400";
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + "..." : str;
}

export function countChars(str: string): { count: number; limit: number; pct: number; ok: boolean } {
  const count = str.length;
  const limit = 80;
  return { count, limit, pct: Math.min(100, Math.round((count / limit) * 100)), ok: count <= limit };
}

export const MARKETPLACE_OPTIONS = [
  { value: "eBay UK", label: "🇬🇧 eBay UK" },
  { value: "eBay US", label: "🇺🇸 eBay US" },
  { value: "eBay AU", label: "🇦🇺 eBay AU" },
  { value: "eBay DE", label: "🇩🇪 eBay Germany" },
  { value: "eBay FR", label: "🇫🇷 eBay France" },
];

export const CONDITION_OPTIONS = [
  "New", "New without tags", "New with defects", "Refurbished",
  "Used - Excellent", "Used - Good", "Used - Acceptable", "For parts",
];
