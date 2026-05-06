import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Wand2, Image, Package, Search, TrendingUp, Zap, ArrowRight, ChevronRight, Globe, BarChart3, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    href: "/generator",
    icon: Wand2,
    title: "AI Listing Generator",
    desc: "Turn any product — keyword, URL, or image — into a fully optimized eBay listing with Cassini-tuned titles, descriptions & item specifics.",
    badge: "Core Feature",
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  {
    href: "/images",
    icon: Image,
    title: "Image Studio",
    desc: "Upscale to 4x resolution, remove/replace backgrounds, add watermarks, create store banners, and strip EXIF metadata in bulk.",
    badge: "Image AI",
    color: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  },
  {
    href: "/bulk",
    icon: Package,
    title: "Bulk Processor",
    desc: "Upload ZIP files of product folders, multiple URLs, or batches of images. Auto-generates listings for every product simultaneously.",
    badge: "Bulk",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  {
    href: "/research",
    icon: Search,
    title: "Market Research",
    desc: "Instant keyword research, competitor analysis, pricing intelligence, and demand scoring for any product niche.",
    badge: "Research",
    color: "text-green-400 bg-green-500/10 border-green-500/20",
  },
];

const MODELS = [
  { name: "GPT-4o Mini", task: "Listing Copy", active: true },
  { name: "DeepSeek R1", task: "Research & Analysis", active: true },
  { name: "Llama 3.3 70B", task: "Bulk Processing", active: true },
  { name: "Gemini 2.0 Flash", task: "Categorization", active: true },
  { name: "Mistral 7B", task: "Fast Titles", active: true },
  { name: "Qwen 2.5", task: "JSON/Data", active: true },
  { name: "Claude", task: "Writing Polish", active: true },
];

const EBAY_FACTORS = [
  { label: "Title Optimization", desc: "Primary keyword first, 80-char limit, attribute stacking", weight: 25 },
  { label: "Item Specifics", desc: "Category fields completeness drives search placement", weight: 20 },
  { label: "Sell-Through Rate", desc: "Higher conversions = better Cassini ranking", weight: 15 },
  { label: "Description Quality", desc: "Keyword density, structure, mobile-optimized HTML", weight: 12 },
  { label: "Price Competitiveness", desc: "Aligned with market median for category", weight: 10 },
  { label: "Seller Reputation", desc: "Feedback score, defect rate, on-time shipping", weight: 8 },
  { label: "Shipping Speed", desc: "Fast handling & free shipping boost ranking", weight: 6 },
  { label: "Returns Policy", desc: "30-day returns improves buyer trust & ranking", weight: 4 },
];

export default function Dashboard() {
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "error">("checking");

  useEffect(() => {
    fetch("/api/health")
      .then(r => r.ok ? setApiStatus("ok") : setApiStatus("error"))
      .catch(() => setApiStatus("error"));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Badge variant="default" className="text-xs gap-1.5">
            <span className={cn("w-1.5 h-1.5 rounded-full live-dot", apiStatus === "ok" ? "bg-green-400" : apiStatus === "error" ? "bg-red-400" : "bg-amber-400")} />
            {apiStatus === "ok" ? "All Systems Live" : apiStatus === "error" ? "API Offline" : "Connecting..."}
          </Badge>
          <Badge variant="secondary" className="text-xs">7 AI Models</Badge>
          <Badge variant="secondary" className="text-xs">Auto-Rotation</Badge>
          <Badge variant="secondary" className="text-xs">No API Keys</Badge>
          <Badge variant="secondary" className="text-xs">Cloudflare-Ready SaaS</Badge>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          <span className="gradient-text">eBay AI Seller Suite</span>
        </h1>
        <p className="text-muted-foreground text-base max-w-2xl mx-auto">
          Generate Cassini-optimized listings, upscale product images, and process entire catalogues in bulk — powered by 7 rotating AI models, completely free.
        </p>

        <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
          <Link href="/generator">
            <Button size="lg" className="glow gap-2 text-base px-8">
              <Wand2 className="w-5 h-5" /> Generate a Listing
            </Button>
          </Link>
          <Link href="/bulk">
            <Button variant="outline" size="lg" className="gap-2 text-base">
              <Package className="w-5 h-5" /> Bulk Upload
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {FEATURES.map((f, i) => (
          <motion.div key={f.href} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Link href={f.href}>
              <div className="rounded-2xl border border-border bg-card p-6 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group h-full">
                <div className="flex items-start gap-4">
                  <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center border shrink-0", f.color)}>
                    <f.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{f.title}</h3>
                      <Badge variant="secondary" className="text-[10px] py-0 h-4">{f.badge}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1 shrink-0 mt-1" />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* AI Models status */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <Cpu className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold">AI Model Roster</h2>
          <Badge variant="success" className="text-xs">All Active</Badge>
          <p className="text-xs text-muted-foreground ml-auto">Auto-selects best model per task, rotates on failure</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 divide-x divide-border">
          {MODELS.map(m => (
            <div key={m.name} className="p-4 text-center space-y-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 mx-auto live-dot" />
              <p className="text-xs font-semibold text-foreground">{m.name}</p>
              <p className="text-[10px] text-muted-foreground">{m.task}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cassini Algorithm breakdown */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold">eBay Cassini Algorithm — How We Optimize</h2>
          <Badge variant="default" className="text-xs">8 Factors</Badge>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {EBAY_FACTORS.map(f => (
            <div key={f.label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{f.label}</span>
                <span className="text-xs font-bold text-primary">{f.weight}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-1.5">
                <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${f.weight * 4}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
