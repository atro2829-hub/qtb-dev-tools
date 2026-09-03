import { z } from 'zod'
import { getSessionUser, toSessionUser, unauthorized } from '@/lib/auth'
import { db } from '@/lib/db'
import { clampString } from '@/lib/server/api-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const profileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  country: z.string().trim().max(80).optional(),
  address: z.string().trim().max(300).optional(),
})

export async function PUT(request: Request) {
  try {
    const session = await getSessionUser()
    if (!session) return unauthorized()

    const body: unknown = await request.json().catch(() => null)
    const parsed = profileSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input'
      return Response.json({ error: message }, { status: 400 })
    }

    const data: { name?: string; country?: string; address?: string } = {}
    if (parsed.data.name !== undefined) data.name = clampString(parsed.data.name, 80)
    if (parsed.data.country !== undefined) data.country = clampString(parsed.data.country, 80)
    if (parsed.data.address !== undefined) data.address = clampString(parsed.data.address, 300)

    if (Object.keys(data).length === 0) {
      return Response.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const updated = await db.user.update({ where: { id: session.id }, data })

    // Mark profile complete when all three fields are filled.
    const name = updated.name?.trim() ?? ''
    const country = updated.country?.trim() ?? ''
    const address = updated.address?.trim() ?? ''
    const complete = name.length > 0 && country.length > 0 && address.length > 0
    const finalUser = complete && !updated.profileComplete
      ? await db.user.update({ where: { id: updated.id }, data: { profileComplete: true } })
      : updated

    return Response.json({ user: toSessionUser(finalUser) })
  } catch (err) {
    console.error('[profile/PUT]', err)
    return Response.json({ error: 'Profile update failed' }, { status: 500 })
  }
}
