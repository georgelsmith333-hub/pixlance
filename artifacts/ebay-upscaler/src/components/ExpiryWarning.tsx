import { useState, useEffect } from "react";
import { AlertTriangle, X, Clock, ShieldCheck } from "lucide-react";
import { getExpiryWarning, wipeAllListings } from "@/lib/listingStorage";
import { toast } from "sonner";
import { Link } from "wouter";

export default function ExpiryWarning() {
  const [warning, setWarning] = useState<{ count: number; oldestMs: number } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = () => {
      const w = getExpiryWarning();
      setWarning(w);
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, []);

  if (!warning || dismissed) return null;

  const hoursLeft = Math.floor((3 * 24 * 60 * 60 * 1000 - warning.oldestMs) / (60 * 60 * 1000));

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <div className="flex-1 text-sm">
          <span className="text-amber-400 font-medium">
            {warning.count} saved listing{warning.count > 1 ? "s" : ""} will expire in ~{hoursLeft}h.
          </span>
          <span className="text-muted-foreground ml-2">
            Guest data is stored locally and auto-wiped after 3 days.{" "}
            <Link href="/register" className="text-primary hover:underline">Create a free account</Link> to keep your listings permanently.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/history">
            <button className="text-xs text-primary hover:underline flex items-center gap-1">
              <Clock className="w-3 h-3" /> View listings
            </button>
          </Link>
          <button
            onClick={() => {
              if (confirm("Wipe all saved listings? This cannot be undone.")) {
                wipeAllListings();
                toast.success("All listings wiped");
                setWarning(null);
              }
            }}
            className="text-xs text-muted-foreground hover:text-red-400 transition-colors"
          >
            Wipe
          </button>
          <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
