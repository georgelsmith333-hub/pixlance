import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import listingsRouter from "./routes/listings.js";
import imagesRouter from "./routes/images.js";
import bulkRouter from "./routes/bulk.js";
import historyRouter from "./routes/history.js";
import adminRouter from "./routes/admin.js";
import exportRouter from "./routes/export.js";
import { getModelStats } from "./ai/models.js";
import { runMigrations } from "./db/index.js";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";
const serveStatic = process.env.SERVE_STATIC !== "false";

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Request logger
app.use((req, _res, next) => {
  if (!req.path.includes("/health")) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Routes
app.use("/api", listingsRouter);
app.use("/api", imagesRouter);
app.use("/api", bulkRouter);
app.use("/api", historyRouter);
app.use("/api", adminRouter);
app.use("/api", exportRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get("/api/stats", (_req, res) => {
  res.json({
    models: getModelStats(),
    features: [
      "listing-gen", "url-scrape", "bulk-zip", "image-upscale",
      "banner", "watermark", "seo-analysis", "keyword-research",
      "sold-prices", "competitor-spy", "listing-history",
      "full-export-zip", "temu-scrape", "aliexpress-scrape",
      "admin-panel", "usage-tracking",
    ],
    version: "3.0.0",
  });
});

// Serve static frontend (Replit full-stack / self-hosted). Skip on Render (API-only).
if (isProd && serveStatic) {
  const staticPath = path.resolve(__dirname, "../../client");
  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });
    console.log(`📁 Serving static frontend from ${staticPath}`);
  }
}

// Run DB migrations on startup
runMigrations().catch(err => console.warn("[DB] Migration failed:", err.message));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Pixlance API v3.0 running on http://0.0.0.0:${PORT} [${isProd ? "production" : "development"}]`);
  console.log(`📦 Features: Listing Gen | Image Processing | Bulk | Scraper (AliExpress+Temu+Amazon) | SEO | History | Admin | ZIP Export`);
  console.log(`🗄️  Database: ${process.env.NEON_URL ? "Neon PostgreSQL connected" : "No DB — localStorage mode"}`);
  console.log(`🌐 Static serving: ${isProd && serveStatic ? "enabled" : "disabled (API-only mode)"}`);
});

export default app;
