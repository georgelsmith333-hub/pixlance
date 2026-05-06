# Pixlance — eBay AI Seller Suite

AI-powered eBay listing generator, image upscaler, bulk processor, SEO optimizer, market researcher, and competitor spy tool. Full commercial SaaS, dark theme only.

## Run & Operate

```bash
npm install          # Install all deps (includes sharp, cheerio, jszip, multer, pg)
npm run dev          # Start client (5000) + server (3001) together
npm run dev:client   # Frontend only
npm run dev:server   # Backend only
npm run build        # tsc + vite build → dist/server + dist/client
npm run start        # NODE_ENV=production node dist/server/src/index.js
```

Required env vars (shared):
- `NEON_URL` — Neon PostgreSQL connection string (already set)
- `SERVE_STATIC` — set to `"false"` on Render (API-only), omit on Replit (serves frontend too)

## Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + Framer Motion + Wouter
- **Backend**: Express + TypeScript + tsx
- **Database**: Neon PostgreSQL (pg driver) — `listing_history` table, auto-migrated on start
- **AI**: Pollinations.ai (7 models, auto-rotation, no API keys)
- **Image**: Sharp (server-side: upscale, background, watermark, banner, optimize)
- **Scraping**: Cheerio + node-fetch (AliExpress, Amazon, Alibaba, eBay sold/active)
- **Bulk**: JSZip (zip file processing), Multer (file uploads)
- **eBay SEO**: Custom Cassini algorithm scorer in `server/src/ebay/seo.ts`

## Where things live

- `client/src/pages/` — dashboard, generator, images, bulk, research, history, settings
- `client/src/components/` — Navbar, ListingCard, SEOScoreRing, ImageDropzone
- `client/src/components/ui/` — badge, button, input, label, select, tabs, textarea, tooltip, progress
- `client/src/lib/history.ts` — localStorage + Neon DB sync helpers
- `client/src/index.css` — Tailwind + custom: animate-fade-in, shimmer, gradient-text, glow, live-dot
- `client/public/_redirects` — CF Pages proxy: `/api/*` → Render, `/*` → index.html
- `server/src/db/index.ts` — Neon pool, runMigrations(), dbAvailable()
- `server/src/ai/models.ts` — 7-model auto-rotating AI router
- `server/src/ai/prompts.ts` — eBay-optimized prompt engineering
- `server/src/ebay/seo.ts` — Cassini SEO scorer + VERO brand checker
- `server/src/scraper/index.ts` — universal product scraper (AliExpress/Amazon/etc.)
- `server/src/routes/listings.ts` — generate, from-url, sold-prices, competitor-spy, research, bulk
- `server/src/routes/images.ts` — upscale, background, watermark, banner, optimize
- `server/src/routes/bulk.ts` — zip, urls, images, keywords batch endpoints
- `server/src/routes/history.ts` — GET/POST/DELETE /api/history
- `render.yaml` — Render IaC (build: npm ci + tsc, start: node dist/server/src/index.js)

## Architecture decisions

- **Pollinations.ai** — 7 free models, auto-picks best per task, rotates on failure
- **Task-to-model mapping** — listing→GPT4, research→DeepSeek, bulk→Llama, code→Qwen
- **Model health tracking** — fail counter resets every 10min, bad models skipped
- **Cassini scoring** — 8 weighted factors, title/specifics/description analyzed separately
- **VERO brand DB** — 60+ brands flagged, warns seller without blocking
- **Sharp server-side** — production-quality image processing (not canvas API)
- **parsePrice** — handles UK (1,234.56), EU (1.234,56), and plain formats correctly
- **History dual-write** — localStorage first (instant UX), then async POST to Neon DB; merge on fetch

## Product

- **Generator**: keyword / URL / manual / image → full eBay listing (title, description, item specifics, keywords, Cassini tips) — auto-saves to History
- **Image Studio**: 4x upscale, background replace, watermark, store banner (1200×200), eBay optimize
- **Bulk Processor**: ZIP file (folder-per-product), URL batch, keyword batch
- **Market Research**: 3-engine simultaneous — sold price scraper + competitor spy + AI analysis
  - Sold Data: real sold prices, distribution, trend direction, hot price zone
  - Competitor Spy: active listings, price segments, title keyword frequency, market gaps
  - AI Analysis: demand/competition scoring, buyer profile, seasonality, title formula
  - Keywords: primary, long-tail, trending, negative, title formula
- **SEO Analyzer**: Cassini score, title analysis, specifics completeness, VERO flag
- **Listing History**: auto-saved listings, localStorage + Neon DB sync, delete, clear-all

## Hosting (Production)

### Option A — Replit Autoscale (simplest, one-click)
- Click **Publish → Autoscale** in Replit
- Serves frontend + API together from `npm run start`
- `SERVE_STATIC` must NOT be `"false"` (omit it or set to `"true"`)

### Option B — Render (API) + Cloudflare Pages (Frontend)
- **Render API**: https://pixlance-api.onrender.com
  - Dashboard: https://dashboard.render.com/web/srv-d7tafdjbc2fs73blg9i0
  - Render account: itmedofficial6@gmail.com | key: rnd_j1LT6namqQ8szSw9hMxOzh0WlbZ8
  - Build: `npm ci && tsc -p tsconfig.server.json` | Start: `node dist/server/src/index.js`
  - Env vars set: `NODE_ENV=production`, `NEON_URL=<set>`, `SERVE_STATIC=false`, `NODE_VERSION=20.11.0`
- **CF Pages** (frontend): connect GitHub repo `georgelsmith333-hub/pixlance`
  - Framework: None | Build command: `npm ci && vite build`
  - Output directory: `dist/client` | Root: `/client` (or leave blank, set build cmd from root)
  - `_redirects` already proxies `/api/*` → `https://pixlance-api.onrender.com/api/:splat`
- **GitHub repo**: https://github.com/georgelsmith333-hub/pixlance (branch: main, auto-deploy on)

## User preferences

- Commercial SaaS — ready to deploy and monetize
- Dark theme only
- No API keys required — free forever via Pollinations.ai
- Render (API) + Cloudflare Pages (frontend) split deployment

## Gotchas

- Backend on port 3001 (dev), dynamic $PORT (production)
- Frontend proxies /api → 3001 (dev); serves from same process (Replit prod); CF Pages _redirects (CF prod)
- `NEON_URL` is used for DB (not `DATABASE_URL` which is reserved by Replit runtime)
- Sharp requires native binaries — `npm install` must complete before running; use `npm ci` on Render
- Pollinations AI may be slow (10-30s) — no streaming on listing gen (JSON required)
- Scraper works on public pages only — some sites block headless requests
- ZIP processor groups by top-level folder (each folder = 1 product)
- `animate-fade-in`, `shimmer`, `live-dot` CSS classes defined in `client/src/index.css`
- Sharp `.sharpen()` takes positional args: `sharpen(sigma, flat, jagged)` not object
- History localStorage key: `pixlance_history` (max 100 items locally)

## Pointers

- eBay Cassini algorithm: seller performance + title keyword density + item specifics completeness
- Pollinations.ai docs: https://pollinations.ai
- Render dashboard: https://dashboard.render.com/web/srv-d7tafdjbc2fs73blg9i0
- Neon DB dashboard: https://console.neon.tech
