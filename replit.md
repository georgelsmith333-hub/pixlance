# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (Replit-provisioned)
- **Validation**: Zod 3 (`zod` — use plain `zod` in api-server, `zod/v4` only in lib/db)
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle → dist/index.mjs)

## Application: eBay Image Pro (Pixlance)

A full-stack SaaS web app for eBay sellers. Dark-mode, electric-blue (#0EA5E9) design.

### 11 Tools (all fully functional)
- **Upscaler** (`/upscaler`) — Lanczos3, 1600–6500px, 1:1 ratio, eBay CTR boost, metadata strip, before/after
- **Batch Processor** (`/batch`) — Multi-file drag-drop, real-time SSE progress, ZIP download via JSZip
- **Format Converter** (`/converter`) — JPG/PNG/WEBP/AVIF/TIFF/BMP/GIF, quality control
- **Banner Creator** (`/banner`) — Auto white #FFFFFF bg, 20+ country shipping badges, 4 corner positions
- **Background Remover** (`/background`) — Cloudflare Workers AI (`@cf/bria-ai/rmbg-1.4`), transparent/color fill output
- **Watermark Tool** (`/watermark`) — Text watermark, 7 positions, opacity, font size, color, tile mode
- **Metadata Editor** (`/metadata`) — EXIF/XMP/IPTC read with `exifr`, privacy risk detection, strip all/selective
- **Color Adjuster** (`/color-adjust`) — Brightness, saturation, contrast, hue, sharpness, gamma, presets
- **AI Edit** (`/ai-edit`) — Multi-model fallback: Pollinations flux→turbo→flux-realism→flux-cablyai→CF Workers AI
- **eBay Studio** (`/studio`) — All-in-one: upscale + white bg + drop shadow + country shipping badge + AI product finder
- **AI Product Finder** — Inside Studio; analyzes image with Pollinations text AI → eBay title, 5 bullets, category, price, keywords

### User Authentication + Quota System
- Register/Login/Logout pages at `/register`, `/login`
- Session stored in PostgreSQL (`user_sessions` table via connect-pg-simple)
- Monthly usage tracked per user (500 ops free, unlimited Pro)
- Navbar shows user name, plan badge, usage progress bar when signed in
- Quota resets automatically each new month

### Navbar
- Shows Sign In / Start Free when logged out
- Shows user dropdown with name, plan badge, usage progress bar, Studio shortcut, Sign Out when logged in
- Tools dropdown includes Studio (All-in-One)

### Admin Panel (`/admin`, password: `admin123`)
- **Stats** tab: real-time processing counters
- **Settings** tab: site name, tagline, upload limits, maintenance mode, ads, announcement bar
- **Features** tab: enable/disable individual tools, CF R2 storage
- **Subscriptions** tab: free/pro tier limits (monthly limit, batch limit, max upscale px), pro feature gates
- **Ads** tab: inject ad code into 6 placement slots
- **Announcements** tab: post site-wide announcement bars

### Backend Architecture
- Express body limit: 100MB (for large base64 images)
- Base64 data URLs in/out (client converts File→base64 via FileReader)
- SSE progress stream: `GET /api/progress/:jobId` (EventSource-based live batch progress)
- AI fallback chain: 5 Pollinations models → Cloudflare Workers AI flux-1-schnell
- CF Workers AI: background removal (`@cf/bria-ai/rmbg-1.4`) + image generation

### Daily AI Model Auto-Updater
- Runs at 03:00 UTC daily via `node-cron`
- Fetches latest models from Pollinations API
- Syncs new/updated models to `ai_model_cache` DB table
- Auto-updates AI fallback chain as new free models become available

### Cloudflare Integration
- `CF_ACCOUNT_ID`: stored as env var
- `CF_API_TOKEN`: stored as env var (shared)
- Used for: Workers AI background removal, AI image generation fallback
- **Cloudflare Pages project created**: `pixlance.pages.dev` (frontend)

### GitHub CI/CD
- Repo: `https://github.com/georgelsmith333-hub/pixlance`
- Workflow: `.github/workflows/deploy.yml` → auto-deploys frontend to CF Pages on push to `main`
- Wrangler config: `wrangler.toml`
- SPA routing: `artifacts/ebay-upscaler/public/_redirects`

### Database Schema
- `users` — auth, plan, monthly usage tracking
- `user_sessions` — express-session PostgreSQL store (auto-created)
- `admin_settings` — site config + feature flags + subscription tier limits
- `ad_placements` — ad code slots (header/sidebar/footer/popup/inline/interstitial)
- `announcements` — site-wide banner messages
- `image_stats` — processing counters
- `usage_tracking` — per-action usage log (userId, action, IP, processingTime)
- `ai_model_cache` — free AI models discovered by daily updater

### Key Routes
- `POST /api/auth/register` — create account (bcrypt, session)
- `POST /api/auth/login` — sign in
- `POST /api/auth/logout` — sign out
- `GET /api/auth/me` — current user
- `GET /api/auth/usage` — monthly usage stats
- `POST /api/images/upscale` — single image upscale
- `POST /api/images/batch-upscale` — batch upscale
- `POST /api/images/convert` — format conversion
- `POST /api/images/banner` — eBay banner creation
- `POST /api/images/ai-edit` — AI editing (fallback chain)
- `POST /api/studio/compose` — all-in-one: upscale + shadow + badge + watermark
- `POST /api/studio/badge-preview` — preview shipping badge PNG
- `GET /api/studio/countries` — list all 20+ supported countries
- `POST /api/studio/product-find` — AI product analysis + eBay bullets
- `GET /api/studio/ai-models` — cached free AI models
- `POST /api/tools/exif/read` — read all EXIF/XMP/IPTC tags
- `POST /api/tools/exif/process` — strip metadata
- `POST /api/tools/background-remove` — CF Workers AI background removal
- `POST /api/tools/watermark` — add text watermark
- `POST /api/tools/color-adjust` — brightness/contrast/saturation/hue/sharpness/gamma
- `POST /api/tools/batch-process` — async batch with SSE jobId
- `GET /api/progress/:jobId` — SSE event stream for batch progress
- `GET/PUT /api/admin/settings` — admin settings CRUD
- `GET/POST/DELETE /api/admin/ads` — ad placement CRUD
- `GET/POST/DELETE /api/admin/announcements` — announcement CRUD

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks/Zod from OpenAPI
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Important Notes

- Use `import { z } from "zod"` (not `zod/v4`) in api-server routes — esbuild can't resolve zod/v4 subpath
- `exifr` is an ESM-only package — works fine since api-server outputs ESM (dist/index.mjs)
- Batch async progress uses in-memory EventEmitter (jobEmitter) — jobs are short-lived
- CF R2 storage is configurable via admin panel Feature Flags but needs R2 API keys (separate from CF API token)
- Session cookie name: `ebay_sid`; HttpOnly, 30-day max age

## Deployment

See `DEPLOYMENT.md` for full guide.

- **Frontend**: Cloudflare Pages (`pixlance.pages.dev`) — auto-deployed via GitHub Actions
- **Backend**: Render.com (free tier) or any Node.js host
- **Database**: Neon.tech (free PostgreSQL) or Replit-provisioned DB

To push to GitHub: add remote and push with GitHub Personal Access Token:
```bash
git remote add github https://github.com/georgelsmith333-hub/pixlance.git
git push github main
```
