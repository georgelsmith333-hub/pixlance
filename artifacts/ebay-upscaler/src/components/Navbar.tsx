import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Zap, ChevronDown, User, LogOut, Crown, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, useUsage } from "@/hooks/useAuth";
import { Progress } from "@/components/ui/progress";

const toolLinks = [
  { href: "/upscaler", label: "Upscaler" },
  { href: "/batch", label: "Batch Process" },
  { href: "/converter", label: "Format Converter" },
  { href: "/banner", label: "Banner Creator" },
  { href: "/background", label: "BG Remover" },
  { href: "/watermark", label: "Watermark" },
  { href: "/metadata", label: "Metadata Editor" },
  { href: "/color-adjust", label: "Color Adjust" },
  { href: "/ai-edit", label: "AI Edit" },
  { href: "/studio", label: "🎨 Studio (All-in-One)" },
  { href: "/scraper", label: "🔍 Image Scraper" },
  { href: "/listing", label: "⚡ Listing Generator" },
  { href: "/history", label: "📋 Saved Listings" },
];

const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [location] = useLocation();
  const { user, isLoggedIn, isLoading, logout } = useAuth();
  const { data: usageData } = useUsage();

  const isToolActive = toolLinks.some(l => location === l.href);
  const usagePct = usageData ? Math.min(100, Math.round((usageData.usage / usageData.limit) * 100)) : 0;

  return (
    <nav className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2 font-bold text-primary text-lg shrink-0">
            <Zap className="w-5 h-5 fill-primary" />
            <span>eBay Image Pro</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {primaryLinks.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  location === l.href ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {l.label}
              </Link>
            ))}

            <div
              className="relative"
              onMouseEnter={() => setToolsOpen(true)}
              onMouseLeave={() => setToolsOpen(false)}
            >
              <button
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isToolActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                Tools <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {toolsOpen && (
                <div className="absolute top-full left-0 mt-1 w-56 rounded-xl border border-border bg-card shadow-xl py-1 z-50">
                  {toolLinks.map(l => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={`block px-4 py-2 text-sm transition-colors ${
                        location === l.href ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                      onClick={() => setToolsOpen(false)}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Desktop right */}
          <div className="hidden md:flex items-center gap-2">
            <Link href="/admin">
              <Button variant="outline" size="sm" className="text-xs border-border">Admin</Button>
            </Link>

            {!isLoading && !isLoggedIn && (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-xs">Sign In</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground">Start Free</Button>
                </Link>
              </>
            )}

            {!isLoading && isLoggedIn && user && (
              <div
                className="relative"
                onMouseEnter={() => setUserOpen(true)}
                onMouseLeave={() => setUserOpen(false)}
              >
                <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary transition-colors text-sm">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="font-medium text-foreground max-w-[90px] truncate">{user.name}</span>
                  {user.plan === "pro" && (
                    <Crown className="w-3.5 h-3.5 text-yellow-400" />
                  )}
                </button>

                {userOpen && (
                  <div className="absolute top-full right-0 mt-1 w-64 rounded-xl border border-border bg-card shadow-xl py-2 z-50">
                    <div className="px-4 py-2 border-b border-border">
                      <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
                          user.plan === "pro" ? "bg-yellow-400/20 text-yellow-400" : "bg-primary/15 text-primary"
                        }`}>
                          {user.plan}
                        </span>
                      </div>
                    </div>

                    {usageData && user.plan === "free" && (
                      <div className="px-4 py-3 border-b border-border">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <BarChart2 className="w-3 h-3" /> Monthly usage
                          </span>
                          <span className="text-xs font-medium text-foreground">{usageData.usage}/{usageData.limit}</span>
                        </div>
                        <Progress value={usagePct} className="h-1.5" />
                        {usagePct >= 80 && (
                          <p className="text-[10px] text-yellow-500 mt-1">
                            {usagePct >= 100 ? "Limit reached — upgrade to Pro" : "Running low — consider upgrading"}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="px-2 py-1">
                      <Link href="/studio" onClick={() => setUserOpen(false)}>
                        <button className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground flex items-center gap-2">
                          <Zap className="w-3.5 h-3.5" /> Studio
                        </button>
                      </Link>
                      {user.plan === "free" && (
                        <Link href="/pricing" onClick={() => setUserOpen(false)}>
                          <button className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors text-yellow-500 hover:text-yellow-400 flex items-center gap-2">
                            <Crown className="w-3.5 h-3.5" /> Upgrade to Pro
                          </button>
                        </Link>
                      )}
                      <button
                        onClick={() => { logout(); setUserOpen(false); }}
                        className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground flex items-center gap-2"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile */}
      {open && (
        <div className="md:hidden border-t border-border bg-card px-4 py-3 space-y-1 max-h-[80vh] overflow-y-auto">
          {[...primaryLinks, ...toolLinks].map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                location === l.href ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <div className="pt-2 space-y-2 border-t border-border">
            {isLoggedIn && user ? (
              <>
                <div className="px-3 py-2 rounded-lg bg-secondary/50">
                  <p className="text-sm font-medium text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.plan} plan</p>
                  {usageData && user.plan === "free" && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Usage</span>
                        <span>{usageData.usage}/{usageData.limit}</span>
                      </div>
                      <Progress value={usagePct} className="h-1.5" />
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => { logout(); setOpen(false); }}
                >
                  <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign Out
                </Button>
              </>
            ) : (
              <div className="flex gap-2">
                <Link href="/login" onClick={() => setOpen(false)} className="flex-1">
                  <Button variant="outline" size="sm" className="text-xs w-full">Sign In</Button>
                </Link>
                <Link href="/register" onClick={() => setOpen(false)} className="flex-1">
                  <Button size="sm" className="text-xs w-full bg-primary text-primary-foreground">Start Free</Button>
                </Link>
              </div>
            )}
            <Link href="/admin" onClick={() => setOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full text-xs">Admin Panel</Button>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
