import { getSessionUser, unauthorized } from '@/lib/auth'
import { db } from '@/lib/db'
import { toRequestJson } from '@/lib/server/api-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Alias of GET /api/subscription/request — returns the current user's requests. */
export async function GET() {
  try {
    const session = await getSessionUser()
    if (!session) return unauthorized()

    const requests = await db.subscriptionRequest.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return Response.json({ requests: requests.map(toRequestJson) })
  } catch (err) {
    console.error('[subscription/status/GET]', err)
    return Response.json({ error: 'Failed to load subscription requests' }, { status: 500 })
  }
}
