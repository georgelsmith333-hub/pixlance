import { Link } from "wouter";
import { ArrowRight, Zap, Shield, Layers, TrendingUp, ImageIcon, Star, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetImageStats } from "@workspace/api-client-react";

const features = [
  {
    icon: Zap,
    title: "AI-Powered Upscaling",
    desc: "Lanczos3 + AI enhancement. Upscale to 6500x6500px with zero quality loss.",
  },
  {
    icon: Shield,
    title: "eBay Algorithm Ready",
    desc: "Enforces 1:1 ratio, 1600–6500px minimums, and CTR-boosting optimizations.",
  },
  {
    icon: Layers,
    title: "Batch Processing",
    desc: "Upload hundreds of images. Process them all at once with global settings.",
  },
  {
    icon: ImageIcon,
    title: "Banner Creator",
    desc: "Auto white (#FFFFFF) background + country shipping badges for any eBay market.",
  },
  {
    icon: TrendingUp,
    title: "eBay CTR Booster",
    desc: "Proprietary sharpening + saturation tuning proven to increase click-through rates.",
  },
  {
    icon: Star,
    title: "Zero Limitations",
    desc: "No file size limits, no daily caps. Free and unlimited for your entire team.",
  },
];

const steps = [
  { n: "01", title: "Upload", desc: "Drag & drop any image in any format" },
  { n: "02", title: "Configure", desc: "Set target size, format, and eBay optimizations" },
  { n: "03", title: "Process", desc: "AI upscaling in seconds via our server" },
  { n: "04", title: "Download", desc: "Get your eBay-ready image instantly" },
];

export default function Home() {
  const { data: stats } = useGetImageStats();

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative px-4 py-20 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-6">
            <Zap className="w-3 h-3 fill-primary" />
            Free · Unlimited · No API Key Required
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold text-foreground leading-tight tracking-tight">
            The Ultimate eBay
            <span className="block text-primary">Image Optimizer</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Upscale, convert, clean metadata, create banners — everything your eBay listings need to win the algorithm and dominate search results.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/upscaler">
              <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" data-testid="button-hero-upscale">
                Start Upscaling Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/batch">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-border" data-testid="button-hero-batch">
                Batch Processing
              </Button>
            </Link>
          </div>

          {/* Stats */}
          {stats && (
            <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
              {[
                { label: "Images Processed", value: stats.totalProcessed.toLocaleString() },
                { label: "Upscaled", value: stats.totalUpscaled.toLocaleString() },
                { label: "Converted", value: stats.totalConverted.toLocaleString() },
                { label: "Banners Created", value: stats.totalBannersCreated.toLocaleString() },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-card/60 px-4 py-3" data-testid={`stat-${s.label.toLowerCase().replace(/\s/g, "-")}`}>
                  <div className="text-2xl font-bold text-primary">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16 bg-card/30 border-y border-border">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Everything Your eBay Store Needs
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-card p-6 hover:border-primary/40 transition-colors"
              >
                <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 w-fit mb-4">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={s.n} className="text-center relative">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-px bg-border" />
                )}
                <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mx-auto mb-4">
                  <span className="text-primary font-bold text-lg">{s.n}</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* eBay CTR tips */}
      <section className="px-4 py-16 bg-card/30 border-y border-border">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">eBay CTR Booster: What We Do</h2>
          <p className="text-center text-muted-foreground mb-8 text-sm">Our proprietary pipeline applies these eBay-proven optimizations automatically</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
            {[
              "Enforces 1:1 aspect ratio (eBay requirement)",
              "Minimum 1600×1600px resolution",
              "Pure white (#FFFFFF) background for all images",
              "Lanczos3 high-quality upscaling algorithm",
              "Micro-sharpening to pop on search results",
              "Subtle saturation boost for color vibrancy",
              "mozjpeg compression for smaller file sizes",
              "EXIF/tracker metadata stripping option",
              "Country-specific shipping badges for trust signals",
              "Fast shipping badge placement (4 corner options)",
            ].map((tip) => (
              <div key={tip} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Dominate eBay Search?</h2>
          <p className="text-muted-foreground mb-8">Free, unlimited, no sign-up required. Start processing your images now.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/upscaler">
              <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                Upscale an Image
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/banner">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-border">
                Create a Banner
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
