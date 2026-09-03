import { getSessionUser, unauthorized } from '@/lib/auth'
import { db } from '@/lib/db'
import { toToolJobJson } from '@/lib/server/api-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getSessionUser()
    if (!session) return unauthorized()

    const jobs = await db.toolJob.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return Response.json({ jobs: jobs.map(toToolJobJson) })
  } catch (err) {
    console.error('[tools/jobs/GET]', err)
    return Response.json({ error: 'Failed to load tool jobs' }, { status: 500 })
  }
}
