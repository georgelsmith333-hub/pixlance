import { useState } from "react";
import { Settings, Megaphone, BarChart3, MonitorPlay, Lock, Eye, EyeOff, Loader2, Plus, Trash2, Check, ToggleLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useGetAdminSettings, useUpdateAdminSettings,
  useGetAds, useCreateAd, useDeleteAd,
  useGetAnnouncements, useCreateAnnouncement, useDeleteAnnouncement,
  useGetImageStats,
  getGetAdminSettingsQueryKey, getGetAdsQueryKey, getGetAnnouncementsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const ADMIN_PASS = "admin123";

export default function Admin() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("admin_authed") === "1");
  const [passInput, setPassInput] = useState("");
  const [showPass, setShowPass] = useState(false);

  const qc = useQueryClient();

  const { data: settings, isLoading: loadingSettings } = useGetAdminSettings({ query: { enabled: authed, queryKey: getGetAdminSettingsQueryKey() } });
  const { data: ads } = useGetAds({ query: { enabled: authed, queryKey: getGetAdsQueryKey() } });
  const { data: announcements } = useGetAnnouncements({ query: { enabled: authed, queryKey: getGetAnnouncementsQueryKey() } });
  const { data: stats } = useGetImageStats({ query: { enabled: authed } });

  // Settings form
  const [siteName, setSiteName] = useState("");
  const [tagline, setTagline] = useState("");
  const [maintenance, setMaintenance] = useState(false);
  const [maxUpload, setMaxUpload] = useState(50);
  const [maxBatch, setMaxBatch] = useState(100);
  const [adsEnabled, setAdsEnabled] = useState(false);
  const [annBar, setAnnBar] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Feature flags
  const [bgRemoveEnabled, setBgRemoveEnabled] = useState(true);
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [metadataEditEnabled, setMetadataEditEnabled] = useState(true);
  const [colorAdjustEnabled, setColorAdjustEnabled] = useState(true);
  const [aiEditEnabled, setAiEditEnabled] = useState(true);
  const [batchEnabled, setBatchEnabled] = useState(true);
  const [bannerEnabled, setBannerEnabled] = useState(true);
  const [r2StorageEnabled, setR2StorageEnabled] = useState(false);
  const [proFeaturesEnabled, setProFeaturesEnabled] = useState(false);
  const [requireLoginForPro, setRequireLoginForPro] = useState(false);
  const [freeMonthlyLimit, setFreeMonthlyLimit] = useState(500);
  const [freeBatchLimit, setFreeBatchLimit] = useState(10);
  const [freeMaxUpscalePx, setFreeMaxUpscalePx] = useState(2000);
  const [proMaxUpscalePx, setProMaxUpscalePx] = useState(6500);

  if (settings && !settingsLoaded) {
    setSiteName(settings.siteName ?? "eBay Image Pro");
    setTagline(settings.siteTagline ?? "");
    setMaintenance(settings.maintenanceMode ?? false);
    setMaxUpload(settings.maxUploadSizeMb ?? 50);
    setMaxBatch(settings.maxBatchSize ?? 100);
    setAdsEnabled(settings.adsEnabled ?? false);
    setAnnBar(settings.announcementBarEnabled ?? false);
    // Feature flags
    setBgRemoveEnabled((settings as Record<string, unknown>).bgRemoveEnabled as boolean ?? true);
    setWatermarkEnabled((settings as Record<string, unknown>).watermarkEnabled as boolean ?? true);
    setMetadataEditEnabled((settings as Record<string, unknown>).metadataEditEnabled as boolean ?? true);
    setColorAdjustEnabled((settings as Record<string, unknown>).colorAdjustEnabled as boolean ?? true);
    setAiEditEnabled((settings as Record<string, unknown>).aiEditEnabled as boolean ?? true);
    setBatchEnabled((settings as Record<string, unknown>).batchEnabled as boolean ?? true);
    setBannerEnabled((settings as Record<string, unknown>).bannerEnabled as boolean ?? true);
    setR2StorageEnabled((settings as Record<string, unknown>).r2StorageEnabled as boolean ?? false);
    setProFeaturesEnabled((settings as Record<string, unknown>).proFeaturesEnabled as boolean ?? false);
    setRequireLoginForPro((settings as Record<string, unknown>).requireLoginForPro as boolean ?? false);
    setFreeMonthlyLimit((settings as Record<string, unknown>).freeMonthlyLimit as number ?? 500);
    setFreeBatchLimit((settings as Record<string, unknown>).freeBatchLimit as number ?? 10);
    setFreeMaxUpscalePx((settings as Record<string, unknown>).freeMaxUpscalePx as number ?? 2000);
    setProMaxUpscalePx((settings as Record<string, unknown>).proMaxUpscalePx as number ?? 6500);
    setSettingsLoaded(true);
  }

  // Ad form
  const [adName, setAdName] = useState("");
  const [adPlacement, setAdPlacement] = useState("sidebar");
  const [adType, setAdType] = useState("banner");
  const [adCode, setAdCode] = useState("");
  const [adActive, setAdActive] = useState(true);

  // Announcement form
  const [annMsg, setAnnMsg] = useState("");
  const [annType, setAnnType] = useState("info");
  const [annActive, setAnnActive] = useState(true);

  const updateSettings = useUpdateAdminSettings({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() }); toast.success("Settings updated!"); },
      onError: () => toast.error("Failed to update settings"),
    },
  });

  const createAd = useCreateAd({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetAdsQueryKey() }); setAdName(""); setAdCode(""); toast.success("Ad created!"); },
      onError: () => toast.error("Failed to create ad"),
    },
  });

  const deleteAd = useDeleteAd({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetAdsQueryKey() }); toast.success("Ad deleted"); } } });

  const createAnn = useCreateAnnouncement({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetAnnouncementsQueryKey() }); setAnnMsg(""); toast.success("Announcement created!"); },
      onError: () => toast.error("Failed to create announcement"),
    },
  });

  const deleteAnn = useDeleteAnnouncement({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetAnnouncementsQueryKey() }); toast.success("Announcement deleted"); } } });

  const handleLogin = () => {
    if (passInput === ADMIN_PASS) { sessionStorage.setItem("admin_authed", "1"); setAuthed(true); }
    else toast.error("Incorrect password");
  };

  const saveAllSettings = () => {
    updateSettings.mutate({
      data: {
        siteName, siteTagline: tagline, maintenanceMode: maintenance,
        maxUploadSizeMb: maxUpload, maxBatchSize: maxBatch, adsEnabled, announcementBarEnabled: annBar,
      } as Parameters<typeof updateSettings.mutate>[0]["data"],
    });
  };

  const saveFeatureFlags = () => {
    updateSettings.mutate({
      data: {
        bgRemoveEnabled, watermarkEnabled, metadataEditEnabled, colorAdjustEnabled,
        aiEditEnabled, batchEnabled, bannerEnabled, r2StorageEnabled,
        proFeaturesEnabled, requireLoginForPro, freeMonthlyLimit, freeBatchLimit,
        freeMaxUpscalePx, proMaxUpscalePx,
      } as Parameters<typeof updateSettings.mutate>[0]["data"],
    });
  };

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto px-4 py-24">
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <div className="p-3 rounded-full bg-primary/10 border border-primary/20 w-fit mx-auto mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold mb-1">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mb-6">Enter your admin password to continue</p>
          <div className="relative mb-4">
            <Input
              type={showPass ? "text" : "password"}
              placeholder="Password"
              value={passInput}
              onChange={e => setPassInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              data-testid="input-admin-password"
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPass(!showPass)}>
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Button onClick={handleLogin} className="w-full bg-primary text-primary-foreground" data-testid="button-admin-login">
            Login to Admin
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage site settings, feature flags, ads, and announcements in real-time</p>
        </div>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => { sessionStorage.removeItem("admin_authed"); setAuthed(false); }}>
          Logout
        </Button>
      </div>

      <Tabs defaultValue="stats">
        <TabsList className="mb-6 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="stats"><BarChart3 className="w-4 h-4 mr-1.5" />Stats</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1.5" />Settings</TabsTrigger>
          <TabsTrigger value="features"><ToggleLeft className="w-4 h-4 mr-1.5" />Features</TabsTrigger>
          <TabsTrigger value="subscriptions"><Shield className="w-4 h-4 mr-1.5" />Subscriptions</TabsTrigger>
          <TabsTrigger value="ads"><MonitorPlay className="w-4 h-4 mr-1.5" />Ads</TabsTrigger>
          <TabsTrigger value="announcements"><Megaphone className="w-4 h-4 mr-1.5" />Announcements</TabsTrigger>
        </TabsList>

        {/* Stats */}
        <TabsContent value="stats">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {stats && [
              { label: "Total Processed", value: stats.totalProcessed },
              { label: "Upscaled", value: stats.totalUpscaled },
              { label: "Converted", value: stats.totalConverted },
              { label: "Banners Created", value: stats.totalBannersCreated },
              { label: "Metadata Stripped", value: stats.totalMetadataStripped },
              { label: "Avg Processing Time", value: `${stats.averageProcessingTime.toFixed(2)}s` },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                <div className="text-3xl font-bold text-primary">{String(s.value).includes("s") ? s.value : Number(s.value).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings">
          {loadingSettings ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-6 space-y-5 max-w-lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Site Name</Label>
                  <Input value={siteName} onChange={e => setSiteName(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Tagline</Label>
                  <Input value={tagline} onChange={e => setTagline(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Max Upload (MB)</Label>
                  <Input type="number" value={maxUpload} onChange={e => setMaxUpload(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Max Batch Size</Label>
                  <Input type="number" value={maxBatch} onChange={e => setMaxBatch(Number(e.target.value))} />
                </div>
              </div>
              <div className="space-y-3 border-t border-border pt-4">
                {[
                  { label: "Maintenance Mode", val: maintenance, set: setMaintenance },
                  { label: "Ads Enabled", val: adsEnabled, set: setAdsEnabled },
                  { label: "Announcement Bar", val: annBar, set: setAnnBar },
                ].map(t => (
                  <div key={t.label} className="flex items-center justify-between">
                    <Label className="text-sm text-foreground">{t.label}</Label>
                    <Switch checked={t.val} onCheckedChange={t.set} />
                  </div>
                ))}
              </div>
              <Button className="w-full bg-primary text-primary-foreground" disabled={updateSettings.isPending} onClick={saveAllSettings}>
                {updateSettings.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Check className="w-4 h-4 mr-2" /> Save Settings</>}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Feature Flags */}
        <TabsContent value="features">
          <div className="rounded-xl border border-border bg-card p-6 max-w-lg">
            <h2 className="font-semibold mb-1">Tool Feature Flags</h2>
            <p className="text-xs text-muted-foreground mb-5">Enable or disable individual tools site-wide. Changes take effect immediately.</p>
            <div className="space-y-3">
              {[
                { label: "Upscaler", desc: "Single image upscaling", val: true, fixed: true },
                { label: "Batch Processing", desc: "Multi-image batch tool", val: batchEnabled, set: setBatchEnabled },
                { label: "Format Converter", desc: "Convert between image formats", val: true, fixed: true },
                { label: "Banner Creator", desc: "eBay product banner generator", val: bannerEnabled, set: setBannerEnabled },
                { label: "Background Remover", desc: "CF Workers AI background removal", val: bgRemoveEnabled, set: setBgRemoveEnabled },
                { label: "Watermark Tool", desc: "Add text watermarks to images", val: watermarkEnabled, set: setWatermarkEnabled },
                { label: "Metadata Editor", desc: "EXIF viewer and metadata stripper", val: metadataEditEnabled, set: setMetadataEditEnabled },
                { label: "Color Adjuster", desc: "Brightness, contrast, saturation", val: colorAdjustEnabled, set: setColorAdjustEnabled },
                { label: "AI Edit", desc: "Pollinations + CF Workers AI editing", val: aiEditEnabled, set: setAiEditEnabled },
                { label: "Cloudflare R2 Storage", desc: "Store processed images in CF R2", val: r2StorageEnabled, set: setR2StorageEnabled },
              ].map(f => (
                <div key={f.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <div className="text-sm font-medium">{f.label}</div>
                    <div className="text-xs text-muted-foreground">{f.desc}</div>
                  </div>
                  {f.fixed ? (
                    <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">Always On</span>
                  ) : (
                    <Switch checked={f.val as boolean} onCheckedChange={f.set as (v: boolean) => void} />
                  )}
                </div>
              ))}
            </div>
            <Button className="w-full bg-primary text-primary-foreground mt-5" disabled={updateSettings.isPending} onClick={saveFeatureFlags}>
              {updateSettings.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Check className="w-4 h-4 mr-2" /> Save Feature Flags</>}
            </Button>
          </div>
        </TabsContent>

        {/* Subscriptions */}
        <TabsContent value="subscriptions">
          <div className="rounded-xl border border-border bg-card p-6 max-w-lg space-y-5">
            <div>
              <h2 className="font-semibold mb-1">Subscription Tiers</h2>
              <p className="text-xs text-muted-foreground mb-4">Configure free and pro tier limits. Pro features gate advanced tools.</p>
            </div>

            <div className="space-y-3 border-b border-border pb-5">
              {[
                { label: "Pro Features Enabled", desc: "Gate advanced tools behind pro plan", val: proFeaturesEnabled, set: setProFeaturesEnabled },
                { label: "Require Login for Pro", desc: "Force sign-in before pro features", val: requireLoginForPro, set: setRequireLoginForPro },
              ].map(f => (
                <div key={f.label} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{f.label}</div>
                    <div className="text-xs text-muted-foreground">{f.desc}</div>
                  </div>
                  <Switch checked={f.val} onCheckedChange={f.set} />
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Free Tier Limits</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Monthly Image Limit</Label>
                  <Input type="number" value={freeMonthlyLimit} onChange={e => setFreeMonthlyLimit(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Batch Limit (per job)</Label>
                  <Input type="number" value={freeBatchLimit} onChange={e => setFreeBatchLimit(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Max Upscale (px)</Label>
                  <Input type="number" value={freeMaxUpscalePx} onChange={e => setFreeMaxUpscalePx(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Pro Max Upscale (px)</Label>
                  <Input type="number" value={proMaxUpscalePx} onChange={e => setProMaxUpscalePx(Number(e.target.value))} />
                </div>
              </div>
            </div>

            <Button className="w-full bg-primary text-primary-foreground" disabled={updateSettings.isPending} onClick={saveFeatureFlags}>
              {updateSettings.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Check className="w-4 h-4 mr-2" /> Save Subscription Settings</>}
            </Button>
          </div>
        </TabsContent>

        {/* Ads */}
        <TabsContent value="ads">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h2 className="font-semibold text-sm">New Ad Placement</h2>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Ad Name</Label>
                  <Input placeholder="e.g. Header Banner" value={adName} onChange={e => setAdName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Placement</Label>
                    <Select value={adPlacement} onValueChange={setAdPlacement}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["header", "sidebar", "footer", "popup", "inline", "interstitial"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
                    <Select value={adType} onValueChange={setAdType}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["banner", "video", "native", "popup"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Ad Code (HTML/JS)</Label>
                  <Textarea placeholder="Paste your Google AdSense, AdMob, or custom ad code here..." value={adCode} onChange={e => setAdCode(e.target.value)} className="font-mono text-xs min-h-[80px] resize-none" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Active</Label>
                  <Switch checked={adActive} onCheckedChange={setAdActive} />
                </div>
                <Button
                  className="w-full bg-primary text-primary-foreground text-xs"
                  disabled={!adName || !adCode || createAd.isPending}
                  onClick={() => createAd.mutate({ data: { name: adName, placement: adPlacement as "header", adType: adType as "banner", adCode, isActive: adActive } })}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Create Ad
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-semibold text-sm mb-3">Active Ads ({ads?.length ?? 0})</h2>
              {!ads?.length ? (
                <p className="text-xs text-muted-foreground">No ads yet. Create one to start monetizing.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {ads.map(ad => (
                    <div key={ad.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-secondary/30">
                      <div>
                        <div className="text-xs font-medium">{ad.name}</div>
                        <div className="text-xs text-muted-foreground">{ad.placement} · {ad.adType} · {ad.isActive ? "Active" : "Inactive"}</div>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteAd.mutate({ id: ad.id })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Announcements */}
        <TabsContent value="announcements">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h2 className="font-semibold text-sm">New Announcement</h2>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Message</Label>
                  <Textarea placeholder="e.g. We've just launched batch ZIP downloads!" value={annMsg} onChange={e => setAnnMsg(e.target.value)} className="min-h-[60px] resize-none text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
                    <Select value={annType} onValueChange={setAnnType}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["info", "success", "warning", "error"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <Switch checked={annActive} onCheckedChange={setAnnActive} />
                    <Label className="text-xs text-muted-foreground">Active</Label>
                  </div>
                </div>
                <Button
                  className="w-full bg-primary text-primary-foreground text-xs"
                  disabled={!annMsg || createAnn.isPending}
                  onClick={() => createAnn.mutate({ data: { message: annMsg, type: annType as "info", isActive: annActive } })}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Post Announcement
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-semibold text-sm mb-3">Announcements ({announcements?.length ?? 0})</h2>
              {!announcements?.length ? (
                <p className="text-xs text-muted-foreground">No announcements yet.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {announcements.map(a => (
                    <div key={a.id} className="flex items-start justify-between px-3 py-2 rounded-lg border border-border bg-secondary/30">
                      <div>
                        <div className="text-xs font-medium">{a.message}</div>
                        <div className="text-xs text-muted-foreground">{a.type} · {a.isActive ? "Active" : "Hidden"}</div>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => deleteAnn.mutate({ id: a.id })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
