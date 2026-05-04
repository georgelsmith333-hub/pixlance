# Pixlance / eBay Image Pro — Deployment Guide

## Architecture Overview

```
GitHub (georgelsmith333-hub/pixlance)
  └─ Push to main
       └─ GitHub Actions (.github/workflows/deploy.yml)
            ├─ Build frontend (Vite → dist/public)
            └─ Deploy to Cloudflare Pages (pixlance project)

Cloudflare Pages  ←  Frontend (React SPA)
  └─ _redirects: all routes → /index.html (SPA routing)

Backend (Express API)  ←  Separate hosted service
  Options: Render.com (free tier) | Railway | Fly.io
  Database: Neon.tech (free PostgreSQL) or Replit DB
```

---

## 1. GitHub Repository Setup

Repo: https://github.com/georgelsmith333-hub/pixlance

### Add GitHub Secrets (repo → Settings → Secrets → Actions)

| Secret | Value |
|--------|-------|
| `CF_API_TOKEN` | Your Cloudflare API Token |
| `CF_ACCOUNT_ID` | Your Cloudflare Account ID |
| `VITE_API_BASE` | Your backend API URL (e.g. `https://pixlance-api.onrender.com`) |

---

## 2. Cloudflare Pages — Frontend

### Create Project (one-time, already done via API)

```bash
# Verify Pages project exists
curl "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/pages/projects" \
  -H "Authorization: Bearer $CF_API_TOKEN"
```

### Manual Deploy (without GitHub Actions)

```bash
pnpm install
cd artifacts/ebay-upscaler && pnpm run build
npx wrangler pages deploy dist/public --project-name=pixlance
```

### Custom Domain
Cloudflare Pages → pixlance project → Custom domains → Add domain

---

## 3. Backend API — Render.com (Free Tier)

1. Go to https://render.com → New → Web Service
2. Connect GitHub repo → `georgelsmith333-hub/pixlance`
3. Settings:
   - **Build Command**: `pnpm install && pnpm --filter @workspace/api-server run build`
   - **Start Command**: `node --enable-source-maps artifacts/api-server/dist/index.mjs`
   - **Environment**: Node 20+
4. Add Environment Variables:
   ```
   DATABASE_URL=<your-neon-url>
   SESSION_SECRET=<random-32-char-string>
   CF_ACCOUNT_ID=<your-cloudflare-account-id>
   CF_API_TOKEN=<your-cloudflare-api-token>
   NODE_ENV=production
   PORT=10000
   ```

---

## 4. Database — Neon.tech (Free PostgreSQL)

1. Go to https://neon.tech → Create project
2. Copy connection string → use as `DATABASE_URL`
3. Run migrations:
   ```bash
   DATABASE_URL=<your-url> pnpm --filter @workspace/db run push
   ```

---

## 5. Cloudflare Workers AI (Already Configured)

Used for:
- Background removal (`@cf/bria-ai/rmbg-1.4`)
- AI image generation fallback (`@cf/black-forest-labs/flux-1-schnell`)

No extra setup needed — credentials already in environment.

---

## 6. Daily AI Model Auto-Updater

The API server runs a cron job at **03:00 UTC daily** that:
1. Fetches latest models from Pollinations API
2. Syncs new models to `ai_model_cache` DB table
3. Updates the AI fallback chain automatically

No manual intervention needed.

---

## 7. Environment Variables Summary

### API Server (Production)
```env
DATABASE_URL=postgresql://...
SESSION_SECRET=<random-secure-string>
CF_ACCOUNT_ID=<your-cloudflare-account-id>
CF_API_TOKEN=<your-cloudflare-api-token>
NODE_ENV=production
PORT=10000
```

### Frontend (Vite Build)
```env
NODE_ENV=production
BASE_PATH=/
PORT=3000
VITE_API_BASE=https://your-api.onrender.com
```

---

## 8. API Endpoints Reference

### Auth
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Sign in
- `POST /api/auth/logout` — Sign out
- `GET /api/auth/me` — Current user
- `GET /api/auth/usage` — Monthly usage stats

### Images
- `POST /api/images/upscale` — Single image upscale (Lanczos3)
- `POST /api/images/batch-upscale` — Batch upscale
- `POST /api/images/convert` — Format conversion
- `POST /api/images/banner` — eBay banner creator
- `POST /api/images/ai-edit` — AI image editing (multi-model fallback)
- `GET /api/images/stats` — Processing statistics

### Studio
- `POST /api/studio/compose` — All-in-one: upscale + shadow + badge + watermark
- `POST /api/studio/badge-preview` — Preview shipping badge PNG
- `GET /api/studio/countries` — List all supported countries
- `POST /api/studio/product-find` — AI product analysis + eBay bullets
- `GET /api/studio/ai-models` — Cached free AI models

### Tools
- `POST /api/tools/background-remove` — CF Workers AI BG removal
- `POST /api/tools/watermark` — Add text watermark
- `POST /api/tools/color-adjust` — Brightness/contrast/saturation/hue
- `POST /api/tools/exif/read` — Read EXIF/XMP/IPTC metadata
- `POST /api/tools/exif/process` — Strip metadata
- `POST /api/tools/batch-process` — Async batch with SSE progress
- `GET /api/progress/:jobId` — SSE event stream for batch jobs
- `GET /api/tools/scrape` — Scrape product images from URL
- `POST /api/tools/scrape/fetch-image` — Proxy-fetch an image through the server

### Admin
- `GET/PUT /api/admin/settings` — Site settings
- `GET/POST/DELETE /api/admin/ads` — Ad placement management
- `GET/POST/DELETE /api/admin/announcements` — Announcements

### Health
- `GET /api/healthz` — Health check
