import { getSessionUser, unauthorized } from '@/lib/auth'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { badRequest, serverError } from '@/lib/server/api-utils'
import { hitRateLimit, humanWait } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/change-password
 * body: { currentPassword, newPassword }
 * → { ok: true }
 */
export async function POST(req: Request) {
  const session = await getSessionUser()
  if (!session) return unauthorized()

  // Guard against rapid-fire password guessing on a hijacked session.
  const rl = hitRateLimit(`auth:changepw:${session.id}`, 5, 15 * 60 * 1000)
  if (!rl.ok) {
    return Response.json(
      {
        error: `Too many password changes. Try again in ${humanWait(rl.retryAfterSec)}.`,
        code: 'RATE_LIMITED',
        retryAfter: rl.retryAfterSec,
      },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  try {
    const body = await req.json().catch(() => null)
    const currentPassword = String(body?.currentPassword ?? '')
    const newPassword = String(body?.newPassword ?? '')

    if (!currentPassword || !newPassword) {
      return badRequest('Current and new passwords are required.')
    }
    if (newPassword.length < 6) {
      return badRequest('New password must be at least 6 characters.')
    }
    if (newPassword.length > 128) {
      return badRequest('New password is too long (max 128 characters).')
    }
    if (currentPassword === newPassword) {
      return badRequest('New password must be different from the current one.')
    }

    const user = await db.user.findUnique({ where: { id: session.id } })
    if (!user) return badRequest('Account not found.')

    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return badRequest('Current password is incorrect.')

    const hashed = await bcrypt.hash(newPassword, 10)
    await db.user.update({ where: { id: user.id }, data: { password: hashed } })

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[change-password] failed:', err)
    return serverError('Could not change the password. Please try again.')
  }
}
