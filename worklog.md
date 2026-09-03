# QTB DEV TOOLS — Worklog

Project: QTB DEV TOOLS (qutaibiv.com) — Next.js 16 App Router SPA at `/` + API routes under `/api`.
Stack: TypeScript, Tailwind 4, shadcn/ui (New York), framer-motion, zustand, Prisma+SQLite, jose JWT auth (httpOnly cookie `qtb_token`), bcryptjs, docx/mammoth/pdf-lib/pdf-parse, z-ai-web-dev-sdk (backend only) for AI translation + bg removal.

## API CONTRACT (authoritative — all agents must follow this)

Auth cookie: `qtb_token` (httpOnly, JWT HS256, secret env AUTH_SECRET fallback dev-secret).
Roles: user < staff < admin < super_admin. Admin APIs require role admin|super_admin.

### Public
- `POST /api/auth/register` `{name,email,password}` → `{user}` (user shape below)
- `POST /api/auth/login` `{email,password}` → `{user}` sets cookie; 401 `{error}`
- `POST /api/auth/logout` → `{ok}`
- `GET  /api/auth/me` → `{user|null}`
- `PUT  /api/profile` `{name,country,address}` → `{user}` (marks profileComplete)
- `GET  /api/config` → `{config}` PUBLIC fields only: organization,devName,devEmail,supportEmail,logoUrl,freeTrialEnabled,announcement
- `GET  /api/notifications` → `{notifications:[{id,title,message,type,audience,createdAt,read}]}`
- `POST /api/notifications/read` `{notificationId}` → `{ok}`
- `GET  /api/banks` → `{banks:[{id,bankName,accountName,accountNumber,iban,swiftCode,currency,instructions,iconSvg}]}`

### User (auth required)
- `POST /api/tools/bg-remove` multipart `image` → `{image}` (base64 png data URL)
- `POST /api/tools/convert` multipart `file`,`targetFormat`(docx|pdf|txt|png|jpg|webp) → `{fileName,mimeType,dataBase64}`
- `POST /api/tools/translate` multipart `file`(pdf|docx|txt),`sourceLang`,`targetLang` → `{fileName,mimeType,dataBase64,preview}`
- `GET  /api/tools/jobs` → `{jobs:[...]}` recent 20
- `POST /api/subscription/request` multipart `plan,bankAccountId,paymentReference,note,proof(optional file)` → `{ok}`
- `GET  /api/subscription/status` → `{requests:[{id,plan,status,createdAt,reviewNote,bankName,amount}]}`

### Admin (role admin|super_admin)
- `GET  /api/admin/config` → `{config}` all fields incl. keys
- `PUT  /api/admin/config` partial body → `{config}`
- `GET  /api/admin/users?query=` → `{users:[{id,email,name,role,subscriptionStatus,profileComplete,country,createdAt,banned}]}`
- `PUT  /api/admin/users` `{userId,role?,banned?}` → `{user}`; guard: cannot touch super_admin unless caller is super_admin
- `POST /api/admin/notifications` `{title,message,type,audience}` → `{notification}`
- `DELETE /api/admin/notifications?id=` → `{ok}`
- `GET  /api/admin/banks` → `{banks}` (incl. inactive)
- `POST /api/admin/banks` `{bankName,accountName,accountNumber,iban,swiftCode,currency,instructions,iconSvg}` → `{bank}`
- `PUT  /api/admin/banks` `{id,...fields,active?}` → `{bank}`
- `DELETE /api/admin/banks?id=` → `{ok}`
- `GET  /api/admin/subscription-requests` → `{requests:[...incl user email/name, proofData]}`
- `PUT  /api/admin/subscription-requests` `{id,action:"approve"|"deny",reviewNote?}` → `{request}` (approve sets user.subscriptionStatus=active)
- `GET  /api/admin/stats` → `{stats:{users,total,active,trials,expired,pendingRequests,toolJobs,bgRemove,convert,translate,notifications}}`

### user shape (JSON)
`{id,email,name,country,address,role,subscriptionStatus,trialEndsAt,profileComplete,createdAt}` (never password)

### Seed (src/lib/seed.ts, run at boot via ensureSeed in db layer)
- Super admin: admin@qutaibiv.com / (password — see SEED_ADMIN_PASSWORD in .env) (role super_admin, subscriptionStatus active, profileComplete true)
- SiteConfig row main with defaults.

### View routing (SPA — single route `/` per sandbox rule)
zustand store `src/store/app-store.ts`: `view` one of: landing|auth|profile|dashboard|tool-bg|tool-convert|tool-translate|subscription|notifications|profile-me|admin-settings|admin-staff|admin-monetization|admin-notifications|admin-banks|admin-requests

---
---
Task ID: 2-a
Agent: backend-api
Task: Implement all backend API routes (auth, profile, config, notifications, banks, admin suite, tools, subscription) per the API contract above.

Work Log:
- Created shared server helpers in src/lib/server/: api-utils.ts (config/user/notification/bank/toolJob/request JSON serializers, multipart field/file helpers, clamp, status-code helpers), text-extraction.ts (PDFParse v2 + mammoth + txt extraction, format detection, markdown-artifact stripping), pdf-generation.ts (pdf-lib A4 writer, WinAnsi sanitize, 95-char line wrap, auto new pages), docx-generation.ts (one paragraph per line, Calibri 11pt).
- Auth: src/app/api/auth/register|login|logout|me/route.ts — zod validation, bcryptjs (10 rounds), duplicate email 409, banned login 403, httpOnly cookie via setSessionCookie, ensureSeed() called.
- PUT /api/profile (auth): partial {name,country,address}, auto-sets profileComplete when all three non-empty.
- GET /api/config: public fields only. GET/PUT /api/admin/config: full config incl. keys, zod-coerced subset update, string clamp ≤5000, freeTrialDays int 1-3650.
- GET /api/notifications: latest 50, audience filter (all/trial/expired/active by user subscriptionStatus), joined NotificationRead → read flag; anonymous sees audience 'all' with read=true. POST /api/notifications/read: upsert with 404 for unknown notification id.
- GET /api/banks: active banks asc. Admin banks CRUD (/api/admin/banks GET/POST/PUT/DELETE) incl. active toggle; public route hides inactive.
- Admin users (/api/admin/users): GET ?query= (SQLite contains, newest first, limit 200), PUT {userId,role?,banned?} with guards — cannot modify self, only super_admin can grant/revoke super_admin, cannot ban super_admin; 404 unknown user.
- Admin notifications POST/DELETE, admin subscription-requests GET (incl. user email/name + proofData, newest first, limit 200) and PUT approve/deny (approve → user.subscriptionStatus='active'; deny leaves status untouched; both set reviewedAt/reviewNote).
- GET /api/admin/stats with all counters (users total/active/trials/expired/pendingRequests, toolJobs total/bgRemove/convert/translate/failed, notifications).
- Tools: GET /api/tools/jobs (latest 20); POST /api/tools/bg-remove (12MB jpeg/png/webp → z-ai-web-dev-sdk images.generations.edit, 1024x1024, returns png data URL, ToolJob recorded, 502 on SDK failure); POST /api/tools/convert (15MB; real conversions pdf→txt/docx via PDFParse, docx→txt/pdf via mammoth, txt→pdf/docx, image png|jpg|jpeg|webp→png/jpg/webp via sharp q90 with white flatten for jpg/webp; unsupported combos → 400; ToolJob records source/target/status); POST /api/tools/translate (pdf/docx/txt ≤15MB, truncates 12k chars, Gemini REST if siteConfig.geminiApiKey set else z-ai chat fallback with thinking disabled, rebuilds docx, returns {fileName,mimeType,dataBase64,preview≤500}, ToolJob detail 'src→tgt').
- POST /api/subscription/request: multipart plan/bankAccountId/paymentReference/note/proof (png/jpg/pdf ≤8MB → base64 proofData); if user.subscriptionStatus==='none' && freeTrialEnabled → grants trial (trialEndsAt = now + freeTrialDays) and returns {ok,trialGranted:true} without creating a request; otherwise creates pending SubscriptionRequest with bankName lookup. GET on same route + GET /api/subscription/status alias return current user's requests.
- GET /api/health → {ok,name:'QTB DEV TOOLS API'}.
- All routes: `export const runtime='nodejs'`, `dynamic='force-dynamic'`, try/catch, JSON errors, console.error, ISO-string dates.
- next.config.ts: added serverExternalPackages ["pdf-parse","pdfjs-dist","sharp","docx","mammoth"] — REQUIRED fix; without it pdfjs-dist fake-worker fails to load in the Next dev bundle ("Cannot find module pdf.worker.mjs").
- bun run lint: 0 errors/warnings in my files (2 pre-existing warnings live in frontend agent's src/components/qtb/). tsc --noEmit clean for src/app/api + src/lib/server.
- Smoke tests (curl against running dev server): health/config/banks OK; register→409 dup→login(401 wrong / 200 ok)→me→profile(profileComplete:true)→logout OK; admin login (seeded super admin) → admin config GET/PUT OK; users search + role/ban guards (self 400, banned login 403, staff blocked from admin APIs 403); notifications create/delete/read/audience filters verified for anon/trial/active users; banks CRUD + inactive hidden from public; stats counters correct (4 users, 2 active, 1 trial, jobs tallied); convert verified pdf→txt, pdf→docx, txt→pdf (valid PDF out), txt→docx, docx→txt (markdown stripped in docx→pdf output), docx→pdf, png→jpg, png→webp, jpg→png, unsupported pdf→png → 400; bg-remove returned 68KB png data URL in ~16s; translate EN→AR and EN→FR returned docx + preview via z-ai fallback (~1-2s), Gemini path verified erroring 502 with fake key then fallback after clearing; subscription flow: empty request for fresh user → trialGranted:true + trialEndsAt set; full request with proof → pending; admin approve → status approved + user 'active'.

Stage Summary:
- All 21+ contract endpoints implemented exactly as specified (plus GET /api/subscription/status alias so both the task text and the worklog contract are satisfied).
- Deviations: (1) notifications/read returns 404 when notificationId doesn't exist (upsert alone would throw FK error); (2) deny review does not touch user status (per spec); (3) added serverExternalPackages in next.config.ts to fix pdfjs-dist under Next bundling; (4) doc→pdf sanitizes non-WinAnsi chars and strips light markdown; translate always outputs .docx (per contract).
- Test data left in DB: users testuser@example.com (active, password testpass123), staff@example.com (staff, staffpass123), trialguy@example.com (trial, trialpass123); super admin seeded admin@qutaibiv.com / (password — see SEED_ADMIN_PASSWORD in .env). Config restored to defaults (announcement '', freeTrialDays 365, geminiApiKey '').
---
Task ID: 2-b (continuation)
Agent: frontend-spa
Task: Build all 6 admin views + AdminShell, add the missing ProfileMeView, wire the SPA root (page.tsx → AppShell), update layout metadata, and get lint to 0 problems.

Work Log:
- Created src/components/qtb/views/admin/AdminShell.tsx — layout wrapper consumed by AppShell's AdminGate; desktop sticky sidebar (w-56) with Settings / Monetization / Staff / Broadcast / Bank Accounts / Requests, active view highlighted from store; mobile horizontal scrollable pill tab bar (qtb-scroll); "Admin Panel" header + role badge (fuchsia super_admin / amber admin).
- Created AdminSettingsView.tsx — GET /api/admin/config on mount (all fields); four Cards each with its own Save → PUT /api/admin/config: Developer Info (organization, devName, devEmail, supportEmail, logoUrl with live QTBLogo preview / placeholder tile), AI & Agent API Keys (geminiApiKey, agentApiKey password inputs with eye/eye-off toggle), Ad Networks (admobAppId, admobBannerId, adsenseClientId, adsenseSlotId), Announcement textarea.
- Created AdminMonetizationView.tsx — stats grid from GET /api/admin/stats (users total/active/trials/expired/pendingRequests, toolJobs total/bgRemove/convert/translate+failed, notifications) as colorful stat cards (amber/rose/emerald/fuchsia/violet, no blue); No-Card Free Trial card (Switch → config.freeTrialEnabled, number input → freeTrialDays 1-3650 validation) via PUT /api/admin/config; quick announcement editor.
- Created AdminStaffView.tsx — debounced (350ms) search → GET /api/admin/users?query=; shadcn Table on md+ and stacked cards on mobile; per-row role Select (user/staff/admin, super_admin option only for super_admin callers; super_admin rows locked for non-super callers; own row disabled) → PUT {userId, role}; ban/unban Switch with AlertDialog confirm → PUT {userId, banned}; banned/role/status badges.
- Created AdminNotificationsView.tsx (Broadcast) — compose card (title ≤120, message ≤2000 with counters, type Select info/offer/warning/success, audience Select all/trial/expired/active) → POST /api/admin/notifications; "Sent" list state seeded from POST responses (per spec), each with delete → DELETE /api/admin/notifications?id= under AlertDialog confirm; refreshes global inbox via store.refreshNotifications().
- Created AdminBanksView.tsx — GET /api/admin/banks (incl. inactive); responsive card grid with currency badge, active Switch → PUT {id, active}, Edit + Delete; Add/Edit Dialog with bankName/accountName/accountNumber/iban/swiftCode, currency Select USD/YER/SAR/EUR/AED/GBP + "Other…" custom input, instructions Textarea, iconSvg Textarea with live SVG preview rendered inside a viewBox="0 0 24 24" stroke frame; Delete → DELETE ?id= with confirm.
- Created AdminRequestsView.tsx — GET /api/admin/subscription-requests; filter Tabs (Pending/Approved/Denied/All with live counts); request cards with member name/email, plan badge, bankName, amount+currency, paymentReference (mono), member note, submitted date; proof handling — data:image → qtb-checker thumbnail opening full-size Dialog, data:application/pdf → download chip via downloadDataUrl; Approve (emerald outline) / Deny (rose outline) with optional reviewNote dialog → PUT {id, action, reviewNote} then list refresh.
- Created src/components/qtb/views/ProfileMeView.tsx — was missing but imported by AppShell (would not compile): identity card (initials, role label, StatusPill, joined date) + edit form (name/country/address via PUT /api/profile, setUser on success); reuses COUNTRIES (now exported from CompleteProfileView).
- Wired root: src/app/page.tsx replaced scaffold with `import AppShell from "@/components/qtb/AppShell"; export default function Page() { return <AppShell /> }`; layout.tsx metadata updated to "QTB DEV TOOLS — Professional Online Tools" + description (fonts/Toaster untouched).
- Verified globals.css already contains .qtb-glow, .qtb-scroll, .qtb-checker, aurora keyframes, qtb-spinner/shimmer/marquee — no changes needed.
- Removed all unused eslint-disable directives (AppShell.tsx, QTBLogo.tsx, ToolBgRemoveView.tsx ×2, ToolConvertView.tsx) — rules are off in eslint.config.mjs so the directives only produced warnings; also avoided adding new disable comments in the new admin views.
- bun run lint → 0 problems; tsc --noEmit clean for src/components + src/app; fixed one missing framer-motion import flagged by lint (AdminRequestsView).
- Runtime verified against the running dev server: GET / → 200 (24KB HTML, new title present), compile clean, and all admin endpoints the new views consume return 200 (admin/config, admin/stats, admin/users, admin/banks, admin/subscription-requests, notifications).

Stage Summary:
- All 16 views in the store's View union are now reachable from AppShell: landing, auth, profile, dashboard, tool-bg, tool-convert, tool-translate, subscription, notifications, profile-me + 6 admin views. Guards intact: UserGate (unauth → AuthView), AdminGate (non-admin → DashboardView + toast, unauth → AuthView), and AdminShell wraps every admin-* view. SPA contract with backend (Task 2-a) unchanged — no API or server files touched.
---
Task ID: 6
Agent: main-orchestrator
Task: End-to-end integration QA with agent-browser + fixes + deployment prep

Work Log:
- Browser QA (agent-browser, desktop 1280x800 + iPhone 14 emulation):
  - Landing page renders (hero, gradient accents, tools grid, footer w/ dynamic dev info).
  - Super Admin login (admin@qutaibiv.com) → smart-routed to Admin Panel, SUPER ADMIN badge, sidebar w/ 6 sections.
  - Admin Settings/Monetization (live stats: 4 users, 2 active, 1 trial, 14 jobs)/Staff (role guards, own row locked, super admin protected)/Requests (filter tabs + counts) all verified with real data.
  - User journey: register (Sara) → Complete Profile gate → dashboard ("Welcome back, Sara", Free Plan badge) → free trial activation (365 days banner) → notifications inbox (unread badge, OFFER chip).
  - Tools E2E: File Converter txt→pdf in-browser → downloaded /home/z/Downloads/test-doc-converted.pdf verified as valid "PDF document, version 1.7"; AI Translator txt EN→AR in-browser → Arabic preview rendered + .docx download.
  - Mobile: hamburger Sheet menu, stacked tool cards, footer with dev info + safe area, Recent Activity panel.
- Fixes: SheetContent missing aria-describedby (a11y radix warning) in Navbar.tsx.
- Investigated 2 console items → both are Next.js 16 DEV-OVERLAY artifacts (RedirectErrorBoundary hydration attribs + its own radix Dialog warning); 0 dialogs mounted at boot, SSR HTML matches client DOM; not present in production builds. No app-code action needed.
- Deployment prep: next.config.ts security headers (HSTS, nosniff, frame-options, CORS via ALLOWED_ORIGINS), .env.example, DEPLOYMENT.md (DNS A/CNAME records for qutaibiv.com, TLS, env, build, security checklist, post-deploy verification).
- Final: bun run lint → 0 problems; page reload → 0 errors; all API calls 200.

Stage Summary:
- ALL 6 phases complete and browser-verified. App is production-ready pending domain linking (docs in DEPLOYMENT.md).
- Super Admin credentials: admin@qutaibiv.com / (password — see SEED_ADMIN_PASSWORD in .env) (seeded, must rotate in prod).
- Known benign dev-only console noise from Next.js dev overlay; zero app errors.
---
Task ID: 7
Agent: webDevReview (cron round 1)
Task: Status assessment, QA sweep, bug fix + new features (PDF Tools, change-password, admin Tool Activity, UX polish)

Work Log:
- STATUS ASSESSMENT: All 6 original phases stable — lint 0 problems, dev server healthy, all APIs 200. Browser QA sweep (landing, dashboard, session persistence, admin) found NO regressions.
- BUG FIXED (critical): src/components/qtb/views/ProfileMeView.tsx had a corrupted line `const ydrated, setHydrated] = useState(false);` (syntax error from a truncated write in an earlier session) — would have broken the My Profile view on first compile. Restored to `const [hydrated, setHydrated]`.
- NEW FEATURE — PDF Tools (4th tool):
  - POST /api/tools/pdf-merge (multipart files 2..10, ≤30MB combined, pdf-lib copyPages in order) → {fileName,mimeType,dataBase64,pageCount}; ToolJob 'pdf-merge' recorded; rejects non-PDF/single file.
  - POST /api/tools/pdf-split (multipart file + pages string "1-3,5" → zero-based index parsing, range validation) → same shape; single-page PDF rejected; user-input errors → 400, real failures → 500 + failed job.
  - ToolPdfView.tsx: Merge/Split tabs, multi-file queue with numbered badges + up/down reorder + remove, dropzones (violet theme), page-range input with helper text, shared ResultPanel with animated progress + emerald success card.
  - Store: added View 'tool-pdf' + 'admin-jobs'; AppShell cases; QTBIcon new glyphs: pdf, activity, copy-check; Dashboard + Landing card arrays extended (violet tone, 'Four tools. Zero friction.', grids → md:2 xl:4); jobIcon maps pdf-*.
- NEW FEATURE — change password:
  - POST /api/auth/change-password {currentPassword,newPassword} → bcrypt verify + rehash; guards: min 6, max 128, must differ.
  - ProfileMeView Security card (current/new/confirm, mismatch hint, reusable PasswordStrength meter) — full cycle verified in browser: change → old pw rejected 401 → new pw login 200 → restored.
- NEW FEATURE — Admin Tool Activity:
  - GET /api/admin/jobs?tool=&status=&limit= → jobs + user email/name.
  - AdminJobsView: tool filter pills (All/Background/Converter/Translator/PDF Merge/PDF Split), desktop table + mobile cards, status badges, relative times, skeletons, empty state; AdminShell nav + 'admin-jobs' view.
- UX/POLISH:
  - POST /api/notifications/read-all (bulk mark-read honoring audience filter); store markAllRead now calls it with per-item fallback (N+1 eliminated).
  - PasswordStrength meter (rose→amber→emerald, 5 segments) on register form (AuthView) and profile Security card; passwordScore exported.
  - Fixed two no-unused-expressions lint warnings in ToolPdfView resetAll.
- VERIFICATION (browser + curl): merge 2 PDFs → valid 5-page PDF downloaded (file: PDF document, version 1.7); split pages "1,3" → 2-page PDF; error paths (single file, out-of-range, non-PDF) → clean 400 messages; read-all {ok,marked:1}; change-password full cycle; register strength meter renders "Strength: Strong"; Tool Activity table shows live jobs incl. the browser-run ones.
- bun run lint → 0 problems; tsc --noEmit → 0 errors in src/ (remaining are pre-existing examples/skills folders).

Stage Summary:
- App now has FOUR tools (bg removal, converter, translator, PDF merge/split), user password management, and an admin activity log. All browser-verified; contract extended in-place (new endpoints only, no breaking changes).
- Unresolved: none known. Dev-only overlay console noise persists (framework artifact, not app code).
- Suggested next round: (1) per-plan daily usage quotas enforced server-side + UI counters; (2) recharts usage trend chart in Admin Monetization; (3) i18n (next-intl) EN/AR with RTL; (4) admin CSV export of users/jobs; (5) favicon/OG image asset generation.
---
Task ID: 8
Agent: webDevReview (cron round 2)
Task: Usage quota system (server-enforced), admin analytics charts, CSV exports, brand favicon/OG assets

Work Log:
- STATUS ASSESSMENT: Round-1 features all stable; lint 0 problems; server healthy. No regressions found in QA sweep.

- NEW FEATURE — Daily usage quotas (server-enforced):
  - Schema: SiteConfig.freeDailyLimit Int @default(5) (+ db push).
  - src/lib/server/quota.ts: isProUser (staff/admin/super_admin + trial/active = unlimited), getQuotaInfo (counts today's ToolJobs, UTC day boundary), enforceQuota → 429 {error, code:'QUOTA_EXCEEDED', used, limit, resetsAt}.
  - Enforcement patched into ALL 5 tool routes (bg-remove, convert, translate, pdf-merge, pdf-split) right after auth.
  - GET /api/tools/quota → {quota:{unlimited,used,limit,resetsAt}}.
  - Admin: "Free tier daily uses" Input in Monetization trial card, saved with trial settings (PUT /api/admin/config accepts freeDailyLimit 1..1000; zod updated).
  - UI: Dashboard free-plan banner rebuilt — animated QuotaRing (SVG circular progress, emerald→amber→rose by usage), status pill ("N of 5 free uses left today" / "Daily limit reached"), reset-time hint; trial banner now shows "⚡ Unlimited uses" chip; REMOVED the old duplicate free-plan banner.
  - 429 UX: tool views already toast the server error message → "You've used all 5 free uses for today. Upgrade to Pro…" verified in the converter UI.
- NEW FEATURE — Admin analytics:
  - GET /api/admin/analytics?days=14 → {days:[{date,jobs,failed,signups}], byTool:[{toolType,count}], totals}.
  - AdminMonetizationView "Usage Trends" card: recharts AreaChart (jobs fuchsia + signups emerald, gradient fills, brand-styled tooltip) + horizontal BarChart jobs-by-tool (per-tool brand colors) + totals trio (Members / All jobs / Pending). Skeleton while loading.
- NEW FEATURE — CSV exports:
  - GET /api/admin/users?format=csv[&query=] and GET /api/admin/jobs?format=csv[&tool=][&status=] → text/csv attachment (proper escaping, filename qtb-users/jobs-YYYY-MM-DD.csv).
  - "Export CSV" buttons in AdminStaffView (respects search query) + AdminJobsView (respects tool filter).
- BRAND ASSETS + SEO:
  - src/app/icon.svg (QTB logo mark, black tile + white Q + gradient spark) → auto-served as favicon (200 image/svg+xml verified).
  - scripts/generate-og.ts → public/og-image.png (1200×630, sharp-rendered brand design); layout metadata: metadataBase qutaibiv.com, full openGraph + twitter summary_large_image cards.
- VERIFICATION (curl + browser):
  - Free user: converts #1..#5 → 200, #6 → 429; quota endpoint tracks used/limit; after trial grant → unlimited:true. Admin → unlimited:true.
  - Browser: fresh free registration (Finn) → dashboard shows ring 0/5 "5 of 5 free uses left today"; after API exhaustion → reload shows "Daily limit reached" + reset hint; converter attempt → 429 toast with upgrade message; charts render with live spike data (30 jobs); Export CSV click downloads qtb-jobs-2026-09-03.csv with correct headers/rows; icon.svg + og-image.png serve 200.
  - Fixed: duplicate free-plan banner on dashboard; csvEscape type widened to unknown; missing recharts Cell import.
  - bun run lint → 0 problems; tsc --noEmit → 0 errors in src/.

Stage Summary:
- The product now monetizes properly: free tier (N uses/day, admin-configurable), trial/active unlimited, upgrade prompts at the moment of friction. Admins get visual analytics + data export. Brand assets ready for domain launch.
- Suggested next round: (1) i18n EN/AR with next-intl + RTL; (2) email notifications stub + admin "verify Gemini key" button; (3) per-tool documentation/help drawers; (4) PWA manifest + service worker for installability; (5) rate-limit brute-force protection on auth endpoints.
---
Task ID: 9
Agent: webDevReview (cron round 3)
Task: Security hardening (auth rate limits), PWA installability, Gemini key verification, full EN/AR bilingual i18n with RTL

Work Log:
- STATUS ASSESSMENT: Rounds 1-2 all stable (lint 0, page 200, APIs 200). Browser QA sweep (desktop 1280 + mobile 390) found NO regressions before starting new work.
- SECURITY — server-side rate limiting (src/lib/server/rate-limit.ts, in-memory sliding window):
  - login: 10/5min per IP + 8/15min per IP+email (failure counter auto-CLEARED on success so legit users are never locked out) → 429 {error, code:'RATE_LIMITED', retryAfter} + Retry-After header.
  - register: 5/hour per IP. change-password: 5/15min per user. verify-gemini: 6/min per IP.
  - Verified by curl: 8 bad logins → 9th returns 429 "Too many failed attempts… try again in 15 minutes"; 6th register → 429; valid login of a different account unaffected; test users cleaned from DB afterwards.
- PWA (installable app):
  - public/manifest.webmanifest (standalone, theme #0a0a0a, bg white, 4 app shortcuts → /?tool=bg|convert|translate|pdf).
  - scripts/generate-pwa-icons.ts (sharp) → public/icons/{icon-192,icon-512,maskable-512,apple-touch-icon}.png rendered from the brand mark; maskable uses 72% scale on black; apple-touch on black.
  - layout.tsx: metadata manifest + icons + appleWebApp; new viewport export (themeColor, viewportFit cover). Store bootstrap deep-links ?tool= → the matching tool view (only when authed + profileComplete).
  - Verified: manifest/icons serve 200 with correct content-type; theme-color + manifest link present in HTML.
- ADMIN — Gemini key verification: POST /api/admin/verify-gemini {key?} (admin+super_admin only, rate-limited). Tests provided key or stored config key with a real 1-token call to gemini-2.0-flash (15s timeout); returns {ok,message,model,latencyMs}; never echoes the key. Button + live status pill (emerald/rose) in AdminSettingsView AI card; unsaved input wins over stored key. Verified: no key → helpful message; fake key → "Key rejected — API key not valid"; non-admin → 403.
- I18N — full EN/AR bilingual with RTL (the big one):
  - src/lib/i18n.ts: typed dictionary (~260 keys × 2 locales), translate() with {var} interpolation + English fallback, formatDate() locale-aware, LANGS metadata.
  - Store: lang state + setLang (persists qtb_lang in localStorage, sets document.documentElement.lang/dir) + t() selector; bootstrap restores language pre-render.
  - layout.tsx adds Noto Kufi Arabic font; globals.css RTL section: [dir=rtl] font swap, .qtb-ltr / .qtb-ltr-force (emails, brand marks), .qtb-flip (directional icons).
  - LanguageToggle component (Languages icon + native label) in navbar (desktop + always visible) — switches instantly, shows the OTHER language's name.
  - Migrated ALL user-facing surfaces (13 files): Navbar, Footer, Landing, Auth, CompleteProfile, Dashboard, all 4 tool views, Subscription, Notifications, ProfileMe + AdminShell chrome (sidebar/header). Admin card BODIES stay English (owner-only surface, deliberate scope).
  - Arabic date-fns locale (relative times "منذ x", joined dates) via date-fns/locale named export.
  - Fixed subagent leftover: date-fns/locale/ar default-import → named { ar } import (TS1192).
- VERIFICATION (browser): AR dashboard/landing/auth/admin fully translated + mirrored RTL (screenshots verified); toggle round-trip EN↔AR with persistence; emails stay LTR inside RTL; converter ran a real txt→PDF through the translated UI (downloaded PDF verified "PDF document, version 1.7"); Gemini verify pill renders live result; mobile 390px AR layout clean (hamburger, stacked cards, Kufi font).
- bun run lint → 0 problems; tsc --noEmit → 0 errors in src/ (pre-existing skills/ example error untouched); dev log clean.

Stage Summary:
- Product is now bilingual (Arabic-first market ready: RTL, Kufi font, translated toasts/dates), installable as a PWA with app shortcuts, brute-force resistant, and admins can self-test the Gemini key before relying on translations.
- Super Admin unchanged: admin@qutaibiv.com / (password — see SEED_ADMIN_PASSWORD in .env).
- Unresolved: (1) hydration attribute warning on <html> lang/dir is expected pre-hydration (suppressHydrationWarning set; purely cosmetic in dev overlay); (2) Arabic bidi rendering of mixed "Label: Latin-brand" lines (e.g. footer "المطور: Mohammed") is acceptable but could use unicode-bidi tuning; (3) admin view bodies not translated (intentional).
- Suggested next round: (1) service worker with offline shell + install prompt UI (manifest done, SW intentionally deferred to avoid dev-cache pain); (2) per-tool help drawers (also needs i18n keys); (3) email notifications stub + admin "send test email"; (4) user-facing tool sharing (copy result link); (5) admin dashboard chart for quota usage distribution.
---
Task ID: 10
Agent: webDevReview (cron round 4) + GitHub migration request
Task: Round-4 features (PWA install flow, help drawers, plan-split analytics, nav polish) + push full project to GitHub with Pages preview

Work Log:
- ROUND-4 FEATURES (all browser-verified):
  - PWA completion: public/sw.js (v1) — network-first SPA navigations with cached-shell offline fallback, cache-first for /_next/static + woff2, stale-while-revalidate for /icons + manifest + og-image, /api/* NEVER cached, HMR bypassed; activate purges old versions. src/store/pwa-store.ts (captured beforeinstallprompt + standalone flag), PwaRegister.tsx mounts in AppShell (registers SW after load), InstallAppButton.tsx (emerald chip, pinging dot, smartphone icon) in navbar (lg+) and mobile Sheet; auto-hides when installed/standalone. Verified: SW active (scope /), qtb-v1-shell cache holds exactly /, manifest, icon-192/512; no /api cached.
  - Per-tool help drawers: ToolHelpSheet.tsx (Sheet from right, flips to left in RTL) — intro, 3 numbered steps (tone-colored badges), 2 pro tips, emerald privacy card; "?" chip ("How it works") added to the header of all 4 tool views (bg/cv/tr/pdf); ~45 new i18n keys per locale (help.*, pwa.*). QTBIcon: new glyphs help + smartphone. Verified in browser (EN drawer screenshot; keys fall back to EN if missing).
  - Admin analytics v2: GET /api/admin/analytics now returns byPlan {free, pro} (pro = staff/admin/super_admin/trial/active via owner join) + topUsers (last-24h top 5 with plan). AdminMonetizationView: donut PieChart "Free vs Pro usage" (amber/fuchsia, center total + % insight line) beside the by-tool bars + new "Top Consumers — Last 24h" card (ranked list, plan badge, bolt job count). Verified live: 31 jobs — free 5 / pro 26 → "84% of the last 14 days' jobs came from paying or trialling members".
  - Styling polish: navbar active pill is now a framer-motion shared-layout pill (layoutId qtb-nav-pill, spring 420/34) that slides between links incl. violet variant on admin views; dashboard tool cards get icon rotate/scale + ring-brighten on hover plus an animated arrow affordance; gradient top border brightens on hover.
- VERIFICATION: bun run lint → 0 problems; tsc clean in src/; all new endpoints 200; local page 200.
- GITHUB MIGRATION (user request, token provided in chat):
  - Token validated → account atro2829-hub (full repo+workflow scopes). Repo created: github.com/atro2829-hub/qtb-dev-tools (public, homepage → Pages URL).
  - SECURITY before push: hardcoded super-admin password removed from src/lib/db.ts — seed now requires SEED_ADMIN_PASSWORD env (min 8 chars) and refuses to create the admin without it (sandbox DB already seeded, no behavior change); password scrubbed from worklog.md; .env.example documents SEED_ADMIN_PASSWORD + AUTH_SECRET; .gitignore extended (/db/, /tool-results/, /agent-ctx/, /out/, *.db). Found pre-existing sandbox git history + tracked .env / db/custom.db / tool-results (contained the password) → built an ORPHAN single-commit history; staged tree grep-verified clean (no password, no ghp_ token, no .env/db/log tracked). 172 files → main.
  - GitHub Pages: Pages serves static only (full app needs Node — documented in README/DEPLOYMENT), so shipped a static UI preview: isolated copy build (/home/z/my-project-pages, node_modules hardlinked, api routes stripped, output:export + basePath/assetPrefix /qtb-dev-tools, images unoptimized) → out/ (2.6MB) + .nojekyll → gh-pages branch; then switched Pages build_type to "workflow" and added .github/workflows/pages.yml + scripts/build-pages.sh (auto-rebuild static preview on every push to main).
  - VERIFIED LIVE: https://atro2829-hub.github.io/qtb-dev-tools/ → 200, landing renders with correct /qtb-dev-tools/ asset paths; Arabic toggle → full RTL Kufi layout verified on the live site; GitHub Action "Deploy static UI preview to GitHub Pages" → completed/success.
  - Local dev: .env edit triggered a Next full env reload which killed the background dev server → restarted with nohup bun run dev; health OK.

Stage Summary:
- Repo: github.com/atro2829-hub/qtb-dev-tools (main = sanitized full source, single clean commit + CI commit). Pages preview: https://atro2829-hub.github.io/qtb-dev-tools/ (auto-updates from main). README.md added (features, stack, env table, deploy note).
- The FULL functional app still requires a Node host (Vercel/Railway/VPS) — Pages preview is UI-only by design; DEPLOYMENT.md remains the launch path for qutaibiv.com.
- RISKS/ACTIONS FOR USER: (1) ROTATE the GitHub token now — it was shared in chat and grant scope is very broad (admin:org, delete_repo…); (2) first real deployment must set SEED_ADMIN_PASSWORD + AUTH_SECRET; (3) consider private repo if source visibility matters.
- Suggested next round: (1) wire Actions secret-free deploy check badge into README; (2) custom domain on Pages (qutaibiv-demo?) or 404.html polish for preview; (3) static preview "demo mode" banner explaining backend is offline; (4) repo topics/tags + social preview image; (5) continue feature roadmap (email stub, command palette, offline queue).
