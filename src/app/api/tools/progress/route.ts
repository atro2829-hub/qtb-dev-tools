import { getSessionUser, unauthorized } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Live run progress for the polling client.
 * GET /api/tools/progress?run=<runKey>
 */
export async function GET(request: Request) {
  try {
    const session = await getSessionUser()
    if (!session) return unauthorized()

    const run = new URL(request.url).searchParams.get('run')?.slice(0, 80) ?? ''
    if (!run) return Response.json({ error: 'Missing run key' }, { status: 400 })

    const job = await db.toolJob.findFirst({
      where: { userId: session.id, runKey: run },
      orderBy: { createdAt: 'desc' },
      select: { status: true, progress: true, stage: true, resultUrl: true },
    })

    if (!job) return Response.json({ status: 'unknown', progress: 0, stage: '' })

    return Response.json({
      status: job.status,
      progress: job.progress,
      stage: job.stage,
      resultUrl: job.resultUrl,
    })
  } catch (err) {
    console.error('[tools/progress/GET]', err)
    return Response.json({ status: 'unknown', progress: 0, stage: '' })
  }
}
