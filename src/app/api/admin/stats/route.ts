import { forbidden, getAdminUser } from '@/lib/auth'
import { db, ensureSeed } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await ensureSeed()
    const admin = await getAdminUser()
    if (!admin) return forbidden('Admin access required')

    const [totalUsers, active, trials, expired, pendingRequests, totalJobs, bgRemove, convert, translate, failedJobs, notificationCount] =
      await Promise.all([
        db.user.count(),
        db.user.count({ where: { subscriptionStatus: 'active' } }),
        db.user.count({ where: { subscriptionStatus: 'trial' } }),
        db.user.count({ where: { subscriptionStatus: 'expired' } }),
        db.subscriptionRequest.count({ where: { status: 'pending' } }),
        db.toolJob.count(),
        db.toolJob.count({ where: { toolType: 'bg-remove' } }),
        db.toolJob.count({ where: { toolType: 'convert' } }),
        db.toolJob.count({ where: { toolType: 'translate' } }),
        db.toolJob.count({ where: { status: 'failed' } }),
        db.notification.count(),
      ])

    return Response.json({
      stats: {
        users: {
          total: totalUsers,
          active,
          trials,
          expired,
          pendingRequests,
        },
        toolJobs: {
          total: totalJobs,
          bgRemove,
          convert,
          translate,
          failed: failedJobs,
        },
        notifications: notificationCount,
      },
    })
  } catch (err) {
    console.error('[admin/stats/GET]', err)
    return Response.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}
