import { z } from 'zod'
import { getSessionUser, unauthorized } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from '@/lib/server/api-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const readSchema = z.object({
  notificationId: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const session = await getSessionUser()
    if (!session) return unauthorized()

    const body: unknown = await request.json().catch(() => null)
    const parsed = readSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'notificationId is required' }, { status: 400 })
    }

    const notification = await db.notification.findUnique({
      where: { id: parsed.data.notificationId },
    })
    if (!notification) return notFound('Notification not found')

    await db.notificationRead.upsert({
      where: {
        notificationId_userId: {
          notificationId: notification.id,
          userId: session.id,
        },
      },
      update: {},
      create: { notificationId: notification.id, userId: session.id },
    })

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[notifications/read]', err)
    return Response.json({ error: 'Failed to mark notification as read' }, { status: 500 })
  }
}
