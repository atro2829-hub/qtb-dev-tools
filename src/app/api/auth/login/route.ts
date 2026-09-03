import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db, ensureSeed } from '@/lib/db'
import { setSessionCookie, signToken, toSessionUser } from '@/lib/auth'
import { AUTH_LIMITS, clearRateLimit, enforceRateLimit, getClientIp, hitRateLimit, humanWait } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1).max(200),
  password: z.string().min(1).max(200),
})

export async function POST(request: Request) {
  try {
    await ensureSeed()

    const blocked = enforceRateLimit(request, 'auth:login:ip', AUTH_LIMITS.loginIp.limit, AUTH_LIMITS.loginIp.windowMs)
    if (blocked) return blocked

    const body: unknown = await request.json().catch(() => null)
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const { email, password } = parsed.data

    // Per-account brute-force guard: too many attempts for this email+IP.
    const ip = getClientIp(request)
    const failCheck = hitRateLimit(`auth:login:precheck:${ip}:${email}`, AUTH_LIMITS.loginFail.limit, AUTH_LIMITS.loginFail.windowMs)
    if (!failCheck.ok) {
      return Response.json(
        {
          error: `Too many failed attempts for this account. Try again in ${humanWait(failCheck.retryAfterSec)}.`,
          code: 'RATE_LIMITED',
          retryAfter: failCheck.retryAfterSec,
        },
        { status: 429, headers: { 'Retry-After': String(failCheck.retryAfterSec) } }
      )
    }

    const user = await db.user.findUnique({ where: { email } })
    if (!user) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Success — clear the failure counter so legit users are never locked out.
    clearRateLimit(`auth:login:precheck:${ip}:${email}`)

    if (user.banned) {
      return Response.json({ error: 'Account banned' }, { status: 403 })
    }

    const token = await signToken(user.id)
    await setSessionCookie(token)

    return Response.json({ user: toSessionUser(user) })
  } catch (err) {
    console.error('[auth/login]', err)
    return Response.json({ error: 'Login failed' }, { status: 500 })
  }
}
