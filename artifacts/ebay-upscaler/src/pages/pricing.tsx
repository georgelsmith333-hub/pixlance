import { Link } from "wouter";
import { CheckCircle2, Zap, Users, Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Free",
    icon: Zap,
    price: "$0",
    period: "forever",
    desc: "Everything you need to optimize eBay images, completely free.",
    highlight: false,
    badge: null,
    features: [
      "Unlimited image upscaling",
      "Batch processing (unlimited files)",
      "All output formats (JPG/PNG/WEBP/AVIF/TIFF/BMP/GIF)",
      "eBay CTR boost optimization",
      "Banner creator with shipping badges",
      "EXIF/metadata stripping",
      "Format conversion",
      "Pollinations AI image editing",
      "1600×1600 to 6500×6500px output",
      "No watermarks, ever",
    ],
    cta: "Start Free Now",
    ctaHref: "/upscaler",
  },
  {
    name: "Pro",
    icon: Users,
    price: "$0",
    period: "unlimited",
    desc: "Same as Free — we believe pro tools should be free for everyone.",
    highlight: true,
    badge: "Most Popular",
    features: [
      "Everything in Free",
      "Priority processing queue",
      "Batch ZIP downloads",
      "AI text editing (Pollinations)",
      "Advanced eBay CTR analytics",
      "All 9 shipping country badges",
      "Team sharing features",
      "Admin panel access",
      "Real-time ad management",
      "Unlimited everything",
    ],
    cta: "Get Pro Free",
    ctaHref: "/upscaler",
  },
  {
    name: "Team",
    icon: Building2,
    price: "$0",
    period: "for your team",
    desc: "Built for eBay power sellers and teams with no restrictions at all.",
    highlight: false,
    badge: null,
    features: [
      "Everything in Pro",
      "Unlimited team members",
      "Shared admin panel",
      "Custom ad code injection",
      "White-label ready",
      "No API rate limits",
      "On-premise deployment option",
      "Priority support",
      "Custom shipping badge designs",
      "Dedicated processing",
    ],
    cta: "Start with Team",
    ctaHref: "/upscaler",
  },
];

const faqs = [
  { q: "Is it really free?", a: "Yes, completely free and unlimited. No credit card, no sign-up, no hidden fees." },
  { q: "Are there any file size limits?", a: "No. Upload images of any size. There are no restrictions on file size or count." },
  { q: "What formats are supported?", a: "JPG, JPEG, PNG, WEBP, AVIF, TIFF, BMP, GIF and more. Convert between any format." },
  { q: "How does eBay CTR boost work?", a: "We apply Lanczos3 upscaling, micro-sharpening, and subtle saturation increases proven to increase click-through rates on eBay search results." },
  { q: "Is the AI editing really AI?", a: "Yes — we use Pollinations AI's free API to process image editing instructions. It regenerates the image based on your natural language command." },
  { q: "Can I use this for bulk listings?", a: "Absolutely. The batch processor handles unlimited images with global settings. Download everything as a ZIP." },
];

export default function Pricing() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-4">
          <Zap className="w-3 h-3 fill-primary" />
          Always Free · Zero Limitations
        </div>
        <h1 className="text-4xl font-extrabold text-foreground mb-4">Pricing</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          We believe powerful eBay tools should be free and unlimited. No gatekeeping, no paywalls — just results.
        </p>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-xl border p-6 flex flex-col relative ${
              plan.highlight
                ? "border-primary bg-primary/5"
                : "border-border bg-card"
            }`}
          >
            {plan.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                {plan.badge}
              </div>
            )}
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${plan.highlight ? "bg-primary/20" : "bg-secondary"}`}>
                <plan.icon className={`w-5 h-5 ${plan.highlight ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div>
                <div className="font-bold text-foreground">{plan.name}</div>
                <div className="text-xs text-muted-foreground">{plan.desc}</div>
              </div>
            </div>
            <div className="mb-5">
              <span className="text-4xl font-extrabold text-foreground">{plan.price}</span>
              <span className="text-sm text-muted-foreground ml-2">{plan.period}</span>
            </div>
            <ul className="space-y-2 flex-1 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link href={plan.ctaHref}>
              <Button
                className={`w-full font-semibold ${
                  plan.highlight
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                    : "border-border"
                }`}
                variant={plan.highlight ? "default" : "outline"}
                data-testid={`button-plan-${plan.name.toLowerCase()}`}
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        ))}
      </div>

      {/* FAQs */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <div key={faq.q} className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold text-foreground mb-2 text-sm">{faq.q}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
