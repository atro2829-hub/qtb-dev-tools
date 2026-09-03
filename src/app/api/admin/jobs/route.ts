import { getAdminUser, unauthorized } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function csvEscape(value: string | number | null | undefined): string {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * GET /api/admin/jobs?tool=<toolType|all>&status=<completed|failed|all>&limit=100
 * → { jobs: [{ id, toolType, fileName, sourceFormat, targetFormat, status, detail, createdAt, user: { email, name } }] }
 */
export async function GET(req: Request) {
  const admin = await getAdminUser()
  if (!admin) return unauthorized()

  try {
    const url = new URL(req.url)
    const tool = (url.searchParams.get('tool') || 'all').toLowerCase()
    const status = (url.searchParams.get('status') || 'all').toLowerCase()
    const limitRaw = parseInt(url.searchParams.get('limit') || '100', 10)
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 100, 1), 200)

    const where: { toolType?: string; status?: string } = {}
    if (tool !== 'all') where.toolType = tool
    if (status === 'completed' || status === 'failed') where.status = status

    const jobs = await db.toolJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { email: true, name: true } } },
    })

    // CSV export: /api/admin/jobs?format=csv[&tool=...][&status=...]
    if (url.searchParams.get('format') === 'csv') {
      const header = 'id,toolType,fileName,sourceFormat,targetFormat,status,detail,userEmail,userName,createdAt'
      const rows = jobs.map((j) =>
        [
          j.id,
          j.toolType,
          j.fileName,
          j.sourceFormat,
          j.targetFormat,
          j.status,
          j.detail,
          j.user?.email ?? '',
          j.user?.name ?? '',
          j.createdAt.toISOString(),
        ]
          .map(csvEscape)
          .join(',')
      )
      const stamp = new Date().toISOString().slice(0, 10)
      return new Response([header, ...rows].join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="qtb-jobs-${stamp}.csv"`,
        },
      })
    }

    return Response.json({ jobs })
  } catch (err) {
    console.error('[admin/jobs] failed:', err)
    return Response.json({ error: 'Failed to load jobs' }, { status: 500 })
  }
}
