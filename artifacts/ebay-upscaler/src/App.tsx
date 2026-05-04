import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Upscaler from "@/pages/upscaler";
import Batch from "@/pages/batch";
import Converter from "@/pages/converter";
import Banner from "@/pages/banner";
import AiEdit from "@/pages/ai-edit";
import Pricing from "@/pages/pricing";
import Admin from "@/pages/admin";
import MetadataPage from "@/pages/metadata";
import BackgroundPage from "@/pages/background";
import WatermarkPage from "@/pages/watermark";
import ColorAdjustPage from "@/pages/color-adjust";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Studio from "@/pages/studio";
import Scraper from "@/pages/scraper";
import ListingGenerator from "@/pages/listing";
import History from "@/pages/history";
import Navbar from "@/components/Navbar";
import AnnouncementBar from "@/components/AnnouncementBar";
import AdSlot from "@/components/AdSlot";
import ExpiryWarning from "@/components/ExpiryWarning";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/upscaler" component={Upscaler} />
      <Route path="/batch" component={Batch} />
      <Route path="/converter" component={Converter} />
      <Route path="/banner" component={Banner} />
      <Route path="/ai-edit" component={AiEdit} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/admin" component={Admin} />
      <Route path="/metadata" component={MetadataPage} />
      <Route path="/background" component={BackgroundPage} />
      <Route path="/watermark" component={WatermarkPage} />
      <Route path="/color-adjust" component={ColorAdjustPage} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/studio" component={Studio} />
      <Route path="/scraper" component={Scraper} />
      <Route path="/listing" component={ListingGenerator} />
      <Route path="/history" component={History} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <div className="min-h-screen bg-background text-foreground flex flex-col">
            <AnnouncementBar />
            <ExpiryWarning />
            <Navbar />
            <AdSlot placement="header" />
            <main className="flex-1">
              <Router />
            </main>
            <AdSlot placement="footer" />
          </div>
        </WouterRouter>
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
