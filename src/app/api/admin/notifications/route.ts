import { z } from 'zod'
import { forbidden, getAdminUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { clampString, notFound, toNotificationJson } from '@/lib/server/api-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  message: z.string().trim().min(1, 'Message is required').max(2000),
  type: z.enum(['info', 'offer', 'warning', 'success']).default('info'),
  audience: z.enum(['all', 'trial', 'expired', 'active']).default('all'),
})

export async function POST(request: Request) {
  try {
    const admin = await getAdminUser()
    if (!admin) return forbidden('Admin access required')

    const body: unknown = await request.json().catch(() => null)
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input'
      return Response.json({ error: message }, { status: 400 })
    }

    const notification = await db.notification.create({
      data: {
        title: clampString(parsed.data.title, 120),
        message: clampString(parsed.data.message, 2000),
        type: parsed.data.type,
        audience: parsed.data.audience,
      },
    })

    return Response.json({ notification: toNotificationJson(notification) }, { status: 201 })
  } catch (err) {
    console.error('[admin/notifications/POST]', err)
    return Response.json({ error: 'Failed to create notification' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await getAdminUser()
    if (!admin) return forbidden('Admin access required')

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return Response.json({ error: 'id query parameter is required' }, { status: 400 })

    const existing = await db.notification.findUnique({ where: { id } })
    if (!existing) return notFound('Notification not found')

    await db.notification.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[admin/notifications/DELETE]', err)
    return Response.json({ error: 'Failed to delete notification' }, { status: 500 })
  }
}
