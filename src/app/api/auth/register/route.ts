import { hashPassword } from '@/lib/server/password'
import { z } from 'zod'
import { db, ensureSeed } from '@/lib/db'
import { setSessionCookie, signToken, toSessionUser } from '@/lib/auth'
import { AUTH_LIMITS, enforceRateLimit } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('Invalid email address').max(200),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
})

export async function POST(request: Request) {
  try {
    await ensureSeed()

    const blocked = enforceRateLimit(request, 'auth:register', AUTH_LIMITS.register.limit, AUTH_LIMITS.register.windowMs)
    if (blocked) return blocked

    const body: unknown = await request.json().catch(() => null)
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input'
      return Response.json({ error: message }, { status: 400 })
    }

    const { name, email, password } = parsed.data

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return Response.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    const hashed = await hashPassword(password)
    const user = await db.user.create({
      data: { name, email, password: hashed, role: 'user' },
    })

    const token = await signToken(user.id)
    await setSessionCookie(token)

    return Response.json({ user: toSessionUser(user) }, { status: 201 })
  } catch (err) {
    console.error('[auth/register]', err)
    return Response.json({ error: 'Registration failed' }, { status: 500 })
  }
}
