import { getSessionUser, unauthorized } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/notifications/read-all
 * Marks every currently visible notification as read for the session user.
 * → { ok: true, marked: number }
 */
export async function POST() {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  try {
    const notifications = await db.notification.findMany({
      where: { audience: { in: audienceFilter(user.subscriptionStatus) } },
      select: { id: true },
    })
    if (notifications.length === 0) return Response.json({ ok: true, marked: 0 })

    const existing = await db.notificationRead.findMany({
      where: { userId: user.id, notificationId: { in: notifications.map((n) => n.id) } },
      select: { notificationId: true },
    })
    const alreadyRead = new Set(existing.map((r) => r.notificationId))
    const toInsert = notifications.filter((n) => !alreadyRead.has(n.id))

    if (toInsert.length > 0) {
      await db.notificationRead.createMany({
        data: toInsert.map((n) => ({ notificationId: n.id, userId: user.id })),
      })
    }
    return Response.json({ ok: true, marked: toInsert.length })
  } catch (err) {
    console.error('[read-all] failed:', err)
    return Response.json({ error: 'Failed to mark notifications' }, { status: 500 })
  }
}

function audienceFilter(subscriptionStatus: string): string[] {
  const base = ['all']
  if (subscriptionStatus === 'trial') base.push('trial')
  if (subscriptionStatus === 'expired') base.push('expired')
  if (subscriptionStatus === 'active') base.push('active')
  return base
}
