import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Zap, Mail, Lock, User, Eye, EyeOff, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const PERKS = [
  "500 free operations per month",
  "All 9 image tools included",
  "AI Product Finder & bullet points",
  "Studio all-in-one editor",
  "Real-time batch processing",
];

export default function Register() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json() as { error?: string; name?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Registration failed");
        return;
      }
      toast.success(`Welcome to eBay Image Pro, ${data.name ?? name}!`);
      setLocation("/studio");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left — perks */}
        <div className="hidden lg:flex flex-col justify-center space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-7 h-7 fill-primary text-primary" />
              <span className="text-2xl font-bold text-primary">eBay Image Pro</span>
            </div>
            <h2 className="text-3xl font-bold text-foreground leading-tight">
              Grow your eBay sales with professional product images
            </h2>
            <p className="text-muted-foreground mt-3">
              Join thousands of eBay sellers who use AI-powered image tools to increase CTR and conversions.
            </p>
          </div>
          <div className="space-y-3">
            {PERKS.map((perk) => (
              <div key={perk} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">{perk}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">100% Free to start.</span>{" "}
            No credit card required. Upgrade to Pro anytime for unlimited access.
          </div>
        </div>

        {/* Right — form */}
        <div>
          <div className="text-center mb-6 lg:text-left">
            <h1 className="text-2xl font-bold text-foreground">Create your free account</h1>
            <p className="text-muted-foreground text-sm mt-1">Start optimizing your eBay images today</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 shadow-xl">
            <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Full name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="John Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                    required
                    autoComplete="name"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-1.5 block">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-1.5 block">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showPass ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPass(!showPass)}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11 mt-2"
                disabled={loading}
              >
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</> : "Create Free Account"}
              </Button>
            </form>

            <div className="mt-5 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
