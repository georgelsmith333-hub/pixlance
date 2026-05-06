import { Switch, Route } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navbar from "@/components/Navbar";
import Dashboard from "@/pages/dashboard";
import Generator from "@/pages/generator";
import ImageStudio from "@/pages/images";
import Bulk from "@/pages/bulk";
import Research from "@/pages/research";
import HistoryPage from "@/pages/history";
import SettingsPage from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-6xl mb-4">⚡</div>
      <h1 className="text-2xl font-bold mb-2">Page not found</h1>
      <a href="/" className="text-primary hover:underline text-sm mt-2">Back to Dashboard →</a>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background text-foreground flex flex-col">
          <Navbar />
          <main className="flex-1 pb-12">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/generator" component={Generator} />
              <Route path="/images" component={ImageStudio} />
              <Route path="/bulk" component={Bulk} />
              <Route path="/research" component={Research} />
              <Route path="/history" component={HistoryPage} />
              <Route path="/settings" component={SettingsPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
        <Toaster richColors position="top-right" closeButton />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
