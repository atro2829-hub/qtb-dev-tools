import { clearSessionCookie } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    await clearSessionCookie()
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[auth/logout]', err)
    return Response.json({ error: 'Logout failed' }, { status: 500 })
  }
}
