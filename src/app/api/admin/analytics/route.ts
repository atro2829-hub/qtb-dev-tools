import { getAdminUser, unauthorized } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/analytics?days=14
 * → {
 *     days: [{ date: 'Sep 01', jobs, failed, signups }],
 *     byTool: [{ toolType, count }],
 *     totals: { users, jobs, pendingRequests },
 *     byPlan: { free, pro },
 *     topUsers: [{ name, email, jobs, plan }]   // last 24h, max 5
 *   }
 */
export async function GET(req: Request) {
  const admin = await getAdminUser()
  if (!admin) return unauthorized()

  try {
    const url = new URL(req.url)
    const daysRaw = parseInt(url.searchParams.get('days') || '14', 10)
    const days = Math.min(Math.max(Number.isFinite(daysRaw) ? daysRaw : 14, 7), 60)

    const since = new Date()
    since.setUTCHours(0, 0, 0, 0)
    since.setUTCDate(since.getUTCDate() - (days - 1))
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [jobs, users] = await Promise.all([
      db.toolJob.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, status: true, toolType: true, userId: true },
      }),
      db.user.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
    ])

    // Plan split + top consumers need owner info for jobs in the window.
    const ownerIds = Array.from(
      new Set(jobs.map((j) => j.userId).filter((id): id is string => Boolean(id)))
    )
    const owners = ownerIds.length
      ? await db.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, name: true, email: true, role: true, subscriptionStatus: true },
        })
      : []
    const ownerById = new Map(owners.map((o) => [o.id, o]))
    const isProOwner = (o: { role: string; subscriptionStatus: string } | undefined) =>
      !!o &&
      (o.role === 'staff' || o.role === 'admin' || o.role === 'super_admin' ||
        o.subscriptionStatus === 'trial' || o.subscriptionStatus === 'active')

    const buckets = new Map<string, { date: string; jobs: number; failed: number; signups: number }>()
    const byTool = new Map<string, number>()
    const byPlan = { free: 0, pro: 0 }
    const usage = new Map<string, { name: string; email: string; jobs: number; plan: 'free' | 'pro' }>()

    for (let i = 0; i < days; i++) {
      const d = new Date(since)
      d.setUTCDate(d.getUTCDate() + i)
      const key = d.toISOString().slice(0, 10)
      buckets.set(key, {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        jobs: 0,
        failed: 0,
        signups: 0,
      })
    }

    for (const job of jobs) {
      const key = job.createdAt.toISOString().slice(0, 10)
      const bucket = buckets.get(key)
      if (!bucket) continue
      bucket.jobs += 1
      if (job.status === 'failed') bucket.failed += 1
      byTool.set(job.toolType, (byTool.get(job.toolType) ?? 0) + 1)

      const owner = job.userId ? ownerById.get(job.userId) : undefined
      const pro = isProOwner(owner)
      byPlan[pro ? 'pro' : 'free'] += 1

      if (job.createdAt >= dayAgo && owner) {
        const entry = usage.get(owner.id) ?? {
          name: owner.name || owner.email,
          email: owner.email,
          jobs: 0,
          plan: pro ? ('pro' as const) : ('free' as const),
        }
        entry.jobs += 1
        usage.set(owner.id, entry)
      }
    }

    for (const u of users) {
      const key = u.createdAt.toISOString().slice(0, 10)
      const bucket = buckets.get(key)
      if (bucket) bucket.signups += 1
    }

    const [totalUsers, totalJobs, pendingRequests] = await Promise.all([
      db.user.count(),
      db.toolJob.count(),
      db.subscriptionRequest.count({ where: { status: 'pending' } }),
    ])

    return Response.json({
      days: Array.from(buckets.values()),
      byTool: Array.from(byTool.entries())
        .map(([toolType, count]) => ({ toolType, count }))
        .sort((a, b) => b.count - a.count),
      totals: { users: totalUsers, jobs: totalJobs, pendingRequests },
      byPlan,
      topUsers: Array.from(usage.values())
        .sort((a, b) => b.jobs - a.jobs)
        .slice(0, 5),
    })
  } catch (err) {
    console.error('[admin/analytics] failed:', err)
    return Response.json({ error: 'Failed to load analytics' }, { status: 500 })
  }
}
