import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { toNotificationJson } from '@/lib/server/api-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sessionUser = await getSessionUser()
    const notifications = await db.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    if (!sessionUser) {
      // Anonymous visitors: only audience 'all', always read.
      return Response.json({
        notifications: notifications
          .filter((n) => n.audience === 'all')
          .map((n) => ({ ...toNotificationJson(n), read: true })),
      })
    }

    const readRows = await db.notificationRead.findMany({
      where: { userId: sessionUser.id },
      select: { notificationId: true },
    })
    const readSet = new Set(readRows.map((r) => r.notificationId))

    const visible = notifications.filter((n) => {
      switch (n.audience) {
        case 'all':
          return true
        case 'trial':
          return sessionUser.subscriptionStatus === 'trial'
        case 'expired':
          return sessionUser.subscriptionStatus === 'expired'
        case 'active':
          return sessionUser.subscriptionStatus === 'active'
        default:
          return false
      }
    })

    return Response.json({
      notifications: visible.map((n) => ({
        ...toNotificationJson(n),
        read: readSet.has(n.id),
      })),
    })
  } catch (err) {
    console.error('[notifications/GET]', err)
    return Response.json({ error: 'Failed to load notifications' }, { status: 500 })
  }
}
