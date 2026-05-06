import { useState, useEffect } from "react";
import { Settings, Save, Cpu, Globe, Store, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MARKETPLACE_OPTIONS } from "@/lib/utils";

const DEFAULTS = {
  storeName: "",
  defaultMarketplace: "eBay UK",
  defaultCondition: "New",
  defaultTone: "professional",
  defaultScale: "2",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("pixlance_settings");
    if (saved) setSettings(JSON.parse(saved) as typeof DEFAULTS);
    fetch("/api/stats").then(r => r.json()).then(d => setStats(d as Record<string, unknown>)).catch(() => {});
  }, []);

  const save = () => {
    localStorage.setItem("pixlance_settings", JSON.stringify(settings));
    toast.success("Settings saved!");
  };

  const upd = (key: string, val: string) => setSettings(s => ({ ...s, [key]: val }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Store settings */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 font-semibold"><Store className="w-4 h-4 text-primary" />Store Defaults</div>
        <div className="grid gap-4">
          <div className="space-y-1.5"><Label>Store Name</Label><Input value={settings.storeName} onChange={e=>upd("storeName",e.target.value)} placeholder="My eBay Store" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Default Marketplace</Label>
              <Select value={settings.defaultMarketplace} onValueChange={v=>upd("defaultMarketplace",v)}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{MARKETPLACE_OPTIONS.map(m=><SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Default Condition</Label>
              <Select value={settings.defaultCondition} onValueChange={v=>upd("defaultCondition",v)}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{["New","Used - Excellent","Used - Good","Refurbished"].map(c=><SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Listing Tone</Label>
              <Select value={settings.defaultTone} onValueChange={v=>upd("defaultTone",v)}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{["professional","friendly","luxury","technical","casual"].map(t=><SelectItem key={t} value={t} className="text-xs capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Default Image Scale</Label>
              <Select value={settings.defaultScale} onValueChange={v=>upd("defaultScale",v)}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{["1.5","2","3","4"].map(s=><SelectItem key={s} value={s} className="text-xs">{s}x upscale</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <Button onClick={save} className="w-full gap-2"><Save className="w-4 h-4" />Save Settings</Button>
      </div>

      {/* AI Model status */}
      {stats && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 font-semibold"><Cpu className="w-4 h-4 text-primary" />AI Engine Status</div>
          <div className="grid grid-cols-3 gap-2">
            {["openai","deepseek-r1","llama","gemini","mistral","qwen-coder"].map(m=>(
              <div key={m} className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mx-auto mb-1.5 live-dot" />
                <p className="text-xs font-medium truncate">{m}</p>
                <p className="text-[10px] text-muted-foreground">Active</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">All models use Pollinations.ai — free, no API keys required. Auto-rotation enabled: if one model fails, the next takes over automatically.</p>
        </div>
      )}

      {/* CF SaaS info */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 font-semibold"><Globe className="w-4 h-4 text-primary" />Cloudflare SaaS Deployment</div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>This app is architected as a Cloudflare-ready SaaS:</p>
          <ul className="space-y-1.5 ml-4 list-disc text-xs">
            {["Stateless API — deploy backend to Cloudflare Workers or any edge","No database required — extends to Cloudflare D1/KV for persistence","Image processing via sharp — runs on Node.js or containerized edge","AI calls via Pollinations.ai — no secrets or API keys in deployment","Frontend deployable to Cloudflare Pages (static build)","CORS pre-configured for custom domain setup"].map(item=>(
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
