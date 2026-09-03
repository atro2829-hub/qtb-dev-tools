import { getSessionUser, unauthorized } from '@/lib/auth'
import { getQuotaInfo } from '@/lib/server/quota'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/tools/quota
 * → { quota: { unlimited, used, limit, resetsAt } }
 */
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const quota = await getQuotaInfo(user)
  return Response.json({ quota })
}
