# QTB DEV TOOLS

> Professional online tools hub — AI background removal, file conversion, document translation & PDF tools. Fast, private, bilingual (EN/AR) and installable as a PWA.

**Live UI preview (static):** [atro2829-hub.github.io/qtb-dev-tools](https://atro2829-hub.github.io/qtb-dev-tools/)

## ✦ Features

- **AI Background Removal** — upload a photo, get a transparent PNG cutout
- **File Converter** — PDF ⇄ Word ⇄ TXT and PNG ⇄ JPG ⇄ WebP
- **AI Translator** — translate whole documents across 12+ languages, outputs formatted .docx
- **PDF Tools** — merge 2–10 PDFs, extract page ranges
- **Accounts & RBAC** — user / staff / admin / super_admin roles, JWT httpOnly auth
- **Daily usage quotas** — server-enforced free tier, admin-configurable
- **Subscriptions** — bank-transfer plans, free-trial activation, payment-proof review flow
- **Admin panel** — settings, staff management, broadcast notifications, bank accounts, request approvals, tool activity log, analytics charts (area/bar/donut)
- **Bilingual EN/AR** — full RTL layout, Arabic font, localized dates
- **PWA** — manifest, offline shell service worker, one-tap install prompt
- **Per-tool help drawers** — step-by-step bilingual guides

## ✦ Tech stack

Next.js 16 (App Router, single-route SPA) · TypeScript · Tailwind CSS 4 · shadcn/ui · framer-motion · zustand · Prisma + SQLite · jose (JWT) · bcryptjs · pdf-lib / mammoth / docx / sharp · recharts · z-ai-web-dev-sdk (server-side AI)

## ✦ Run locally

```bash
bun install
cp .env.example .env          # then edit values
bun run db:push               # create SQLite schema
bun run dev                   # http://localhost:3000
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | SQLite file URL (`file:./db/custom.db`) |
| `AUTH_SECRET` | ✅ | JWT signing secret |
| `SEED_ADMIN_PASSWORD` | ✅ (fresh deploys) | Super-admin password (min 8 chars). Without it the admin account is **not** created. |
| `ALLOWED_ORIGINS` | optional | CORS allow-list for the API |

The first boot seeds the SiteConfig and the Super Admin (`admin@qutaibiv.com`) using `SEED_ADMIN_PASSWORD`.

## ✦ Deployment

This is a **full-stack** app — the API routes, database and AI features need a Node.js host (Vercel, Railway, Render, VPS…). See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full guide (DNS for qutaibiv.com, TLS, env, security checklist).

The `main` branch also auto-builds a **static UI preview** to **GitHub Pages** via [.github/workflows/pages.yml](.github/workflows/pages.yml) (`scripts/build-pages.sh`). The preview renders the landing/design only — no backend.

## ✦ Project structure

```
src/app/api/          # REST API (auth, tools, admin, subscription, …)
src/components/qtb/   # all UI: navbar, footer, views, admin panel
src/lib/              # auth, db, i18n (EN/AR), server helpers
src/store/            # zustand: SPA view router + app state
prisma/schema.prisma  # User, SiteConfig, BankAccount, SubscriptionRequest,
                      # Notification, NotificationRead, ToolJob
```

---

© QTB DEV — Mohammed AL-QUTAIBI
