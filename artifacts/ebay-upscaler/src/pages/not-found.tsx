import { Link } from "wouter";
import { Home, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="p-4 rounded-full bg-primary/10 border border-primary/20 w-fit mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-5xl font-extrabold text-primary mb-2">404</h1>
        <h2 className="text-xl font-bold text-foreground mb-3">Page Not Found</h2>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link href="/">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" data-testid="button-go-home">
            <Home className="w-4 h-4 mr-2" />
            Go to Homepage
          </Button>
        </Link>
      </div>
    </div>
  );
}
