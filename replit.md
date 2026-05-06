# Pixlance — eBay AI Seller Suite

AI-powered eBay listing generator, image upscaler, bulk processor, SEO optimizer, market researcher, and competitor spy tool. Full commercial SaaS, dark theme only.

## Run & Operate

```bash
npm install          # Install all deps (includes sharp, cheerio, jszip, multer)
npm run dev          # Start client (5000) + server (3001) together
npm run dev:client   # Frontend only
npm run dev:server   # Backend only
npm run build        # tsc + vite build → dist/server + dist/client
npm run start        # NODE_ENV=production node dist/server/src/index.js
```

## Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + Framer Motion + Wouter
- **Backend**: Express + TypeScript + tsx
- **AI**: Pollinations.ai (7 models, auto-rotation, no API keys)
- **Image**: Sharp (server-side: upscale, background, watermark, banner, optimize)
- **Scraping**: Cheerio + node-fetch (AliExpress, Amazon, Alibaba, eBay sold/active)
- **Bulk**: JSZip (zip file processing), Multer (file uploads)
- **eBay SEO**: Custom Cassini algorithm scorer in `server/src/ebay/seo.ts`

## Where things live

- `client/src/pages/` — dashboard, generator, images, bulk, research, settings
- `client/src/components/` — Navbar, ListingCard, SEOScoreRing, ImageDropzone
- `client/src/components/ui/` — badge, button, input, label, select, tabs, textarea, tooltip, progress
- `client/src/index.css` — Tailwind + custom: animate-fade-in, shimmer, gradient-text, glow, live-dot
- `server/src/ai/models.ts` — 7-model auto-rotating AI router
- `server/src/ai/prompts.ts` — eBay-optimized prompt engineering
- `server/src/ebay/seo.ts` — Cassini SEO scorer + VERO brand checker
- `server/src/scraper/index.ts` — universal product scraper (AliExpress/Amazon/etc.)
- `server/src/routes/listings.ts` — generate, from-url, sold-prices, competitor-spy, research, bulk
- `server/src/routes/images.ts` — upscale, background, watermark, banner, optimize
- `server/src/routes/bulk.ts` — zip, urls, images, keywords batch endpoints

## Architecture decisions

- **Pollinations.ai** — 7 free models, auto-picks best per task, rotates on failure
- **Task-to-model mapping** — listing→GPT4, research→DeepSeek, bulk→Llama, code→Qwen
- **Model health tracking** — fail counter resets every 10min, bad models skipped
- **Cassini scoring** — 8 weighted factors, title/specifics/description analyzed separately
- **VERO brand DB** — 60+ brands flagged, warns seller without blocking
- **Sharp server-side** — production-quality image processing (not canvas API)
- **parsePrice** — handles UK (1,234.56), EU (1.234,56), and plain formats correctly

## Product

- **Generator**: keyword / URL / manual / image → full eBay listing (title, description, item specifics, keywords, Cassini tips)
- **Image Studio**: 4x upscale, background replace, watermark, store banner (1200×200), eBay optimize
- **Bulk Processor**: ZIP file (folder-per-product), URL batch, keyword batch
- **Market Research**: 3-engine simultaneous — sold price scraper + competitor spy + AI analysis
  - Sold Data: real sold prices, distribution, trend direction, hot price zone
  - Competitor Spy: active listings, price segments, title keyword frequency, market gaps
  - AI Analysis: demand/competition scoring, buyer profile, seasonality, title formula
  - Keywords: primary, long-tail, trending, negative, title formula
- **SEO Analyzer**: Cassini score, title analysis, specifics completeness, VERO flag

## Hosting

- **Replit Autoscale** = full SaaS deployment (frontend + backend, single Node.js process, auto-scales)
  - Run: `npm run start` (serves static client + API from port from $PORT env var)
  - Click "Publish" → Autoscale in Replit for production URL
- **Cloudflare Pages** = frontend only (static Vite build — Sharp requires Node.js, cannot run on CF Workers)
  - GitHub repo: https://github.com/georgelsmith333-hub/pixlance
  - CF Pages builds from `client/` output, API calls need to proxy to the Replit backend URL

## User preferences

- Commercial SaaS — ready to deploy and monetize
- Dark theme only
- No API keys required — free forever via Pollinations.ai
- Cloudflare Pages + Workers compatible for frontend; Replit Autoscale for full-stack

## Gotchas

- Backend on port 3001 (dev), dynamic $PORT (production)
- Frontend proxies /api → 3001 (dev); serves from same process (production)
- Sharp requires native binaries — `npm install` must complete before running
- Pollinations AI may be slow (10-30s) — no streaming on listing gen (JSON required)
- Scraper works on public pages only — some sites block headless requests
- ZIP processor groups by top-level folder (each folder = 1 product)
- `animate-fade-in`, `shimmer`, `live-dot` CSS classes defined in `client/src/index.css`
- Sharp `.sharpen()` takes positional args: `sharpen(sigma, flat, jagged)` not object

## Pointers

- eBay Cassini algorithm: seller performance + title keyword density + item specifics completeness
- Pollinations.ai docs: https://pollinations.ai
