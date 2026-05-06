import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, BarChart3, Users, Settings, Trash2, RefreshCw, Loader2,
  TrendingUp, Package, Image, Search, Zap, AlertTriangle, CheckCircle2,
  ToggleLeft, ToggleRight, Eye, EyeOff, Save, ChevronRight,
  Activity, Clock, Database, Crown, Ban, Star, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ADMIN_TOKEN_KEY = "pixlance_admin_token";

interface DashboardData {
  settings: Record<string, string>;
  usage: {
    totalListings: number;
    totalImages: number;
    totalBulk: number;
    totalResearch: number;
    todayListings: number;
    weekListings: number;
    topEvents: { event_type: string; count: number }[];
  };
  counts: { users: number; listings: number };
  recentListings: { id: string; keyword: string; mode: string; marketplace: string; created_at: string }[];
  recentActivity: { event_type: string; count: string; date: string }[];
}

interface User {
  id: string;
  email: string;
  plan: string;
  usage_count: number;
  last_seen: string;
  created_at: string;
}

export default function AdminPanel() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState<DashboardData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  // Load saved token
  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (saved) setToken(saved);
  }, []);

  const adminFetch = useCallback(async (path: string, options: RequestInit = {}): Promise<Response> => {
    return fetch(`/api${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": token,
        ...(options.headers ?? {}),
      },
    });
  }, [token]);

  const login = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput }),
      });
      const data = await res.json() as { valid: boolean };
      if (data.valid) {
        setToken(tokenInput);
        localStorage.setItem(ADMIN_TOKEN_KEY, tokenInput);
        toast.success("Admin access granted");
      } else {
        toast.error("Invalid admin token");
      }
    } catch {
      toast.error("Connection failed");
    } finally {
      setIsLoading(false);
    }
  };

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await adminFetch("/admin/dashboard");
      if (!res.ok) { setToken(""); localStorage.removeItem(ADMIN_TOKEN_KEY); return; }
      const d = await res.json() as DashboardData;
      setData(d);
      setSettings(d.settings ?? {});
    } catch {
      toast.error("Failed to load dashboard");
    } finally {
      setIsLoading(false);
    }
  }, [token, adminFetch]);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await adminFetch("/admin/users");
      if (res.ok) {
        const d = await res.json() as { users: User[] };
        setUsers(d.users ?? []);
      }
    } catch { /* ignore */ }
  }, [token, adminFetch]);

  useEffect(() => {
    if (token) {
      void loadDashboard();
    }
  }, [token, loadDashboard]);

  useEffect(() => {
    if (tab === "users" && token) void loadUsers();
  }, [tab, token, loadUsers]);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await adminFetch("/admin/settings/bulk", {
        method: "POST",
        body: JSON.stringify({ settings }),
      });
      if (res.ok) {
        toast.success("Settings saved successfully");
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setSavingSettings(false);
    }
  };

  const updateUserPlan = async (userId: string, plan: string) => {
    try {
      const res = await adminFetch(`/admin/users/${userId}/plan`, {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      if (res.ok) {
        toast.success(`User plan updated to ${plan}`);
        setUsers(u => u.map(user => user.id === userId ? { ...user, plan } : user));
      }
    } catch { toast.error("Failed to update user"); }
  };

  const clearOldListings = async (days: number) => {
    try {
      const res = await adminFetch("/admin/listings/old", {
        method: "DELETE",
        body: JSON.stringify({ days }),
      });
      if (res.ok) {
        const d = await res.json() as { deleted: number };
        toast.success(`Deleted ${d.deleted} old listings`);
        void loadDashboard();
      }
    } catch { toast.error("Failed to clear listings"); }
  };

  const resetAnalytics = async () => {
    if (!confirm("Reset all usage analytics? This cannot be undone.")) return;
    try {
      const res = await adminFetch("/admin/analytics", { method: "DELETE" });
      if (res.ok) { toast.success("Analytics reset"); void loadDashboard(); }
    } catch { toast.error("Failed"); }
  };

  const logout = () => {
    setToken("");
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setData(null);
    toast.success("Logged out");
  };

  const planMode = settings["plan_mode"] ?? "free";
  const isFree = planMode === "free";

  // ─── Login screen ──────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="rounded-2xl border border-border bg-card p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Admin Panel</h1>
              <p className="text-sm text-muted-foreground">Enter your admin token to access the control panel</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Admin Token</Label>
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") void login(); }}
                    placeholder="Enter admin token..."
                    className="pr-10"
                  />
                  <button onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button onClick={() => void login()} disabled={!tokenInput || isLoading} className="w-full gap-2">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Access Admin Panel
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Default token: <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">pixlance_admin_2024</code>
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">Pixlance SaaS Control Center</p>
          </div>
          <Badge variant={isFree ? "success" : "default"} className="gap-1.5 ml-2">
            {isFree ? <><ToggleLeft className="w-3.5 h-3.5" />Free Mode</> : <><Crown className="w-3.5 h-3.5" />Paid Mode</>}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadDashboard()} className="gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5 text-xs text-muted-foreground">
            Logout
          </Button>
        </div>
      </div>

      {isLoading && !data && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {data && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="gap-1.5 text-xs"><BarChart3 className="w-3.5 h-3.5" />Overview</TabsTrigger>
            <TabsTrigger value="plans" className="gap-1.5 text-xs"><Crown className="w-3.5 h-3.5" />Plans & Billing</TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5 text-xs"><Users className="w-3.5 h-3.5" />Users</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 text-xs"><Settings className="w-3.5 h-3.5" />Settings</TabsTrigger>
            <TabsTrigger value="data" className="gap-1.5 text-xs"><Database className="w-3.5 h-3.5" />Data</TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW TAB ── */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Listings", value: data.usage.totalListings.toLocaleString(), icon: Zap, color: "text-primary", bg: "bg-primary/10" },
                { label: "Images Processed", value: data.usage.totalImages.toLocaleString(), icon: Image, color: "text-violet-400", bg: "bg-violet-500/10" },
                { label: "Bulk Jobs", value: data.usage.totalBulk.toLocaleString(), icon: Package, color: "text-amber-400", bg: "bg-amber-500/10" },
                { label: "Research Runs", value: data.usage.totalResearch.toLocaleString(), icon: Search, color: "text-green-400", bg: "bg-green-500/10" },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", s.bg)}>
                    <s.icon className={cn("w-5 h-5", s.color)} />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Today / Week metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Today's Activity</p>
                </div>
                <p className="text-3xl font-bold text-primary">{data.usage.todayListings}</p>
                <p className="text-xs text-muted-foreground mt-1">listings generated today</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <p className="text-sm font-semibold">This Week</p>
                </div>
                <p className="text-3xl font-bold text-green-400">{data.usage.weekListings}</p>
                <p className="text-xs text-muted-foreground mt-1">listings this week</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-violet-400" />
                  <p className="text-sm font-semibold">Registered Users</p>
                </div>
                <p className="text-3xl font-bold text-violet-400">{data.counts.users.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">total users in DB</p>
              </div>
            </div>

            {/* Top events */}
            {data.usage.topEvents.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />Usage Breakdown
                </p>
                <div className="space-y-3">
                  {data.usage.topEvents.map(e => (
                    <div key={e.event_type} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-mono w-40 truncate">{e.event_type}</span>
                      <div className="flex-1 bg-secondary rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min(100, (e.count / Math.max(...data.usage.topEvents.map(x => x.count))) * 100)}%` }} />
                      </div>
                      <span className="text-xs font-bold w-12 text-right">{e.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent listings */}
            {data.recentListings.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Recent Listings</p>
                </div>
                <div className="divide-y divide-border">
                  {data.recentListings.map(l => (
                    <div key={l.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                      <Badge variant="outline" className="text-[10px]">{l.mode}</Badge>
                      <span className="flex-1 truncate text-muted-foreground">{l.keyword ?? "—"}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{l.marketplace}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleDateString("en-GB")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── PLANS & BILLING TAB ── */}
          <TabsContent value="plans" className="space-y-6 mt-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-6">
              <div className="flex items-center gap-3">
                <Crown className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold">Plan Mode</h2>
              </div>

              {/* Plan toggle */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setSettings(s => ({ ...s, plan_mode: "free" }))}
                  className={cn(
                    "rounded-xl border-2 p-5 text-left transition-all",
                    settings["plan_mode"] === "free"
                      ? "border-green-500 bg-green-500/5"
                      : "border-border hover:border-primary/30"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ToggleLeft className="w-5 h-5 text-green-400" />
                      <span className="font-bold text-green-400">Free Mode</span>
                    </div>
                    {settings["plan_mode"] === "free" && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                  </div>
                  <p className="text-sm text-muted-foreground">All features free for all users. No limits enforced. Perfect for launch / testing.</p>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-400" />Unlimited listings</div>
                    <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-400" />All image processing</div>
                    <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-400" />Bulk processing</div>
                    <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-400" />Market research</div>
                  </div>
                </button>

                <button
                  onClick={() => setSettings(s => ({ ...s, plan_mode: "paid" }))}
                  className={cn(
                    "rounded-xl border-2 p-5 text-left transition-all",
                    settings["plan_mode"] === "paid"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Crown className="w-5 h-5 text-amber-400" />
                      <span className="font-bold text-amber-400">Paid Mode</span>
                    </div>
                    {settings["plan_mode"] === "paid" && <CheckCircle2 className="w-5 h-5 text-primary" />}
                  </div>
                  <p className="text-sm text-muted-foreground">Free users get limited access. Pro users get full access. Monetization enabled.</p>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-amber-400" />Free: limited daily listings</div>
                    <div className="flex items-center gap-1.5"><Crown className="w-3 h-3 text-amber-400" />Pro: full unlimited access</div>
                    <div className="flex items-center gap-1.5"><Star className="w-3 h-3 text-amber-400" />Revenue tracking enabled</div>
                  </div>
                </button>
              </div>

              {/* Plan settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Free Daily Limit (listings)</Label>
                  <Input
                    type="number"
                    value={settings["free_daily_limit"] ?? "999999"}
                    onChange={e => setSettings(s => ({ ...s, free_daily_limit: e.target.value }))}
                    placeholder="999999"
                  />
                  <p className="text-xs text-muted-foreground">Set to 999999 for effectively unlimited</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Pro Plan Monthly Price (£)</Label>
                  <Input
                    type="number"
                    value={settings["paid_monthly_price"] ?? "29"}
                    onChange={e => setSettings(s => ({ ...s, paid_monthly_price: e.target.value }))}
                    placeholder="29"
                  />
                </div>
              </div>

              {/* Announcement banner */}
              <div className="space-y-1.5">
                <Label>Announcement Banner (shown to all users)</Label>
                <Input
                  value={settings["announcement"] ?? ""}
                  onChange={e => setSettings(s => ({ ...s, announcement: e.target.value }))}
                  placeholder="Leave blank to hide. e.g. 🚀 We're launching paid plans soon!"
                />
              </div>

              <Button onClick={() => void saveSettings()} disabled={savingSettings} className="gap-2">
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Plan Settings
              </Button>
            </div>
          </TabsContent>

          {/* ── USERS TAB ── */}
          <TabsContent value="users" className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{users.length} users loaded</p>
              <Button variant="outline" size="sm" onClick={() => void loadUsers()} className="gap-1.5 text-xs">
                <RefreshCw className="w-3.5 h-3.5" />Refresh
              </Button>
            </div>

            {users.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No registered users yet</p>
                <p className="text-xs mt-1">Users appear here when they authenticate</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="divide-y divide-border">
                  {users.map(u => (
                    <div key={u.id} className="px-5 py-4 flex items-center gap-4">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                        u.plan === "unlimited" ? "bg-amber-500/20 text-amber-400" :
                        u.plan === "pro" ? "bg-primary/20 text-primary" :
                        u.plan === "banned" ? "bg-red-500/20 text-red-400" :
                        "bg-secondary text-muted-foreground"
                      )}>
                        {u.email?.charAt(0).toUpperCase() ?? "U"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.email ?? u.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">{u.usage_count} uses · joined {new Date(u.created_at).toLocaleDateString("en-GB")}</p>
                      </div>
                      <Select value={u.plan} onValueChange={val => void updateUserPlan(u.id, val)}>
                        <SelectTrigger className="w-28 text-xs h-7">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free" className="text-xs">Free</SelectItem>
                          <SelectItem value="pro" className="text-xs">Pro</SelectItem>
                          <SelectItem value="unlimited" className="text-xs">Unlimited</SelectItem>
                          <SelectItem value="banned" className="text-xs text-red-400">Banned</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── SETTINGS TAB ── */}
          <TabsContent value="settings" className="space-y-6 mt-6">
            <div className="rounded-xl border border-border bg-card p-5 space-y-5">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                <h2 className="font-semibold">Platform Settings</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Admin Token</Label>
                  <Input
                    type="password"
                    value={settings["admin_token"] ?? ""}
                    onChange={e => setSettings(s => ({ ...s, admin_token: e.target.value }))}
                    placeholder="Change admin password..."
                  />
                  <p className="text-xs text-muted-foreground">Change this to secure your admin panel</p>
                </div>

                <div className="space-y-1.5">
                  <Label>Maintenance Mode</Label>
                  <Select
                    value={settings["maintenance_mode"] ?? "false"}
                    onValueChange={v => setSettings(s => ({ ...s, maintenance_mode: v }))}
                  >
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false" className="text-xs">Disabled (Normal Operation)</SelectItem>
                      <SelectItem value="true" className="text-xs">Enabled (Site Under Maintenance)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Max Bulk Items Per Job</Label>
                  <Input
                    type="number"
                    value={settings["max_bulk_items"] ?? "20"}
                    onChange={e => setSettings(s => ({ ...s, max_bulk_items: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Welcome Message</Label>
                  <Input
                    value={settings["welcome_message"] ?? ""}
                    onChange={e => setSettings(s => ({ ...s, welcome_message: e.target.value }))}
                    placeholder="Shown on dashboard..."
                  />
                </div>
              </div>

              <Button onClick={() => void saveSettings()} disabled={savingSettings} className="gap-2">
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save All Settings
              </Button>
            </div>

            {/* All settings dump */}
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-semibold mb-3">All Platform Settings</p>
              <div className="space-y-2">
                {Object.entries(settings).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-3 text-xs font-mono">
                    <span className="text-muted-foreground w-40 shrink-0">{k}</span>
                    <span className="text-foreground">{k === "admin_token" ? "••••••••" : v || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ── DATA TAB ── */}
          <TabsContent value="data" className="space-y-4 mt-6">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                <h2 className="font-semibold">Data Management</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-amber-400" />
                    <p className="font-medium text-sm">Clear Old Listings</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Remove listing history older than X days to keep DB lean.</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => void clearOldListings(30)}>
                      <Trash2 className="w-3 h-3" />Clear 30+ days
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => void clearOldListings(90)}>
                      <Trash2 className="w-3 h-3" />Clear 90+ days
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-red-400" />
                    <p className="font-medium text-sm">Reset Analytics</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Clear all usage tracking data. Listing history is preserved.</p>
                  <Button variant="outline" size="sm" className="text-xs gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => void resetAnalytics()}>
                    <Trash2 className="w-3 h-3" />Reset All Analytics
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <p className="text-sm font-semibold mb-2">Database Stats</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-muted-foreground">Total Listings:</span> <span className="font-bold">{data.counts.listings.toLocaleString()}</span></div>
                  <div><span className="text-muted-foreground">Total Users:</span> <span className="font-bold">{data.counts.users.toLocaleString()}</span></div>
                  <div><span className="text-muted-foreground">Plan Mode:</span> <span className="font-bold capitalize">{settings["plan_mode"] ?? "free"}</span></div>
                  <div><span className="text-muted-foreground">Maintenance:</span> <span className="font-bold">{settings["maintenance_mode"] === "true" ? "ON" : "OFF"}</span></div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
