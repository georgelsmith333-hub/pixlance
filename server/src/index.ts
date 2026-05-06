import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import listingsRouter from "./routes/listings.js";
import imagesRouter from "./routes/images.js";
import bulkRouter from "./routes/bulk.js";
import historyRouter from "./routes/history.js";
import { getModelStats } from "./ai/models.js";
import { runMigrations } from "./db/index.js";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";
const serveStatic = process.env.SERVE_STATIC !== "false";

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  if (!req.path.includes("/health")) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

app.use("/api", listingsRouter);
app.use("/api", imagesRouter);
app.use("/api", bulkRouter);
app.use("/api", historyRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get("/api/stats", (_req, res) => {
  res.json({
    models: getModelStats(),
    features: ["listing-gen", "url-scrape", "bulk-zip", "image-upscale", "banner", "watermark", "seo-analysis", "keyword-research", "sold-prices", "competitor-spy", "listing-history"],
    version: "2.0.0",
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

// Run DB migrations on startup (non-blocking — fails gracefully if no DB_URL)
runMigrations().catch(err => console.warn("[DB] Migration failed:", err.message));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Pixlance API running on http://0.0.0.0:${PORT} [${isProd ? "production" : "development"}]`);
  console.log(`📦 Features: Listing Gen | Image Processing | Bulk | Scraper | SEO | History`);
  console.log(`🗄️  Database: ${process.env.NEON_URL ? "Neon PostgreSQL connected" : "No DB — localStorage mode"}`);
  console.log(`🌐 Static serving: ${isProd && serveStatic ? "enabled" : "disabled (API-only mode)"}`);
});

export default app;
