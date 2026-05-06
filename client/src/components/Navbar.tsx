import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Zap, Menu, X, LayoutDashboard, Wand2, Image, Package, Search, Settings, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/",          label: "Dashboard",    icon: LayoutDashboard },
  { href: "/generator", label: "Generator",    icon: Wand2 },
  { href: "/images",    label: "Image Studio", icon: Image },
  { href: "/bulk",      label: "Bulk",         icon: Package },
  { href: "/research",  label: "Research",     icon: Search },
  { href: "/history",   label: "History",      icon: History },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">Pix<span className="text-primary">lance</span></span>
          <Badge variant="default" className="text-[9px] py-0 h-4 hidden sm:flex gap-1">
            <span className="w-1 h-1 rounded-full bg-green-400 live-dot" />AI LIVE
          </Badge>
        </Link>

        <nav className="hidden md:flex items-center gap-0.5">
          {NAV.map(item => (
            <Link key={item.href} href={item.href}>
              <button className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                location === item.href
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}>
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 live-dot" />
            7 Models Auto-Rotating
          </div>
          <Link href="/settings">
            <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
              <Settings className="w-4 h-4" />
            </button>
          </Link>
        </div>

        <button className="md:hidden p-2 rounded-lg hover:bg-secondary" onClick={() => setOpen(!open)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-card/95 backdrop-blur-xl px-4 py-3 space-y-1 animate-fade-in">
          {NAV.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
              <button className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                location === item.href ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}>
                <item.icon className="w-4 h-4" />{item.label}
              </button>
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
