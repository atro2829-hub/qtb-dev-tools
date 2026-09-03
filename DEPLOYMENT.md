# QTB DEV TOOLS — Domain Deployment Guide (qutaibiv.com)

## 1. DNS Records (registrar / DNS provider)

Point the domain at your hosting server. Two supported setups:

### Option A — A record (server hosts the site directly)
| Type  | Name/Host | Value            | TTL  |
|-------|-----------|------------------|------|
| A     | @         | <YOUR_SERVER_IP> | 3600 |
| A     | www       | <YOUR_SERVER_IP> | 3600 |

### Option B — CNAME (platform/CDN such as Vercel or a reverse proxy)
| Type  | Name/Host | Value                  | TTL  |
|-------|-----------|------------------------|------|
| CNAME | @         | cname.yourhost.com.    | 3600 |
| CNAME | www       | cname.yourhost.com.    | 3600 |

> Note: Some registrars do not allow CNAME on the apex (@). In that case use
> ALIAS/ANAME if offered, or Option A with an A record.

Verification:
```bash
dig qutaibiv.com +short          # should print your server IP / CDN target
dig www.qutaibiv.com +short
```

## 2. TLS Certificate
- Behind Caddy (this project ships a `Caddyfile`): Caddy auto-provisions
  Let's Encrypt certificates for `qutaibiv.com` and `www.qutaibiv.com`.
- On Vercel/platform: enable HTTPS in the dashboard after adding the domain.
- Force HTTPS redirect at the edge (Caddy does this automatically).

## 3. Environment Variables
Copy `.env.example` → `.env` and set:
- `DATABASE_URL` — absolute path to the SQLite file (persist it on a volume!)
- `AUTH_SECRET` — `openssl rand -base64 48`
- `ALLOWED_ORIGINS=https://qutaibiv.com,https://www.qutaibiv.com`

## 4. Build & Run
```bash
bun install
bun run db:push        # sync schema (run once per deploy)
bun run build
bun run start          # NODE_ENV=production, standalone server
```
The Super Admin account (admin@qutaibiv.com) and default SiteConfig are
seeded automatically on first request — log in and change the password-protected
admin settings immediately.

## 5. Security Checklist
- [x] Security headers configured in `next.config.ts` (HSTS, nosniff, frame options)
- [x] CORS restricted to `qutaibiv.com` origins via `ALLOWED_ORIGINS`
- [x] httpOnly + SameSite=Lax session cookies, `secure` in production
- [x] bcrypt password hashing, JWT HS256 signed sessions
- [x] Role-based guards on all admin APIs (server-side)
- [ ] Rotate the default Super Admin password after first login
- [ ] Set a strong `AUTH_SECRET`
- [ ] Schedule off-site backups of the SQLite file (or migrate to Postgres later)

## 6. Post-Deploy Verification
1. `https://qutaibiv.com` loads the landing page.
2. Log in as Super Admin → Admin Panel visible.
3. Run each tool once (background removal, conversion, translation).
4. Register a test user → complete profile → activate trial.
5. `curl -I https://qutaibiv.com` → verify HSTS + X-Frame-Options headers.
