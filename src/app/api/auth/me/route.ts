import { getSessionUser } from '@/lib/auth'
import { ensureSeed } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await ensureSeed()
    const user = await getSessionUser()
    return Response.json({ user })
  } catch (err) {
    console.error('[auth/me]', err)
    return Response.json({ user: null })
  }
}
