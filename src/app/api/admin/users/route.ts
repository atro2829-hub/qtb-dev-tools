import { z } from 'zod'
import { forbidden, getAdminUser, toSessionUser } from '@/lib/auth'
import { db, ensureSeed } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROLES = ['user', 'staff', 'admin', 'super_admin'] as const

const listSchema = z.object({
  query: z.string().trim().max(200).optional().default(''),
})

const updateSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(ROLES).optional(),
  banned: z.boolean().optional(),
})

function toAdminUserJson(u: {
  id: string
  email: string
  name: string | null
  role: string
  subscriptionStatus: string
  profileComplete: boolean
  country: string | null
  createdAt: Date
  banned: boolean
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    subscriptionStatus: u.subscriptionStatus,
    profileComplete: u.profileComplete,
    country: u.country,
    createdAt: u.createdAt.toISOString(),
    banned: u.banned,
  }
}

function csvEscape(value: unknown): string {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(request: Request) {
  try {
    await ensureSeed()
    const admin = await getAdminUser()
    if (!admin) return forbidden('Admin access required')

    const url = new URL(request.url)
    const parsed = listSchema.safeParse({ query: url.searchParams.get('query') ?? '' })
    const query = parsed.success ? parsed.data.query : ''

    const users = await db.user.findMany({
      where: query
        ? {
            OR: [{ email: { contains: query } }, { name: { contains: query } }],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    // CSV export: /api/admin/users?format=csv[&query=...]
    if (url.searchParams.get('format') === 'csv') {
      const header = 'id,email,name,role,subscriptionStatus,profileComplete,country,banned,createdAt'
      const rows = users.map((u) =>
        [
          u.id,
          u.email,
          u.name,
          u.role,
          u.subscriptionStatus,
          u.profileComplete,
          u.country,
          u.banned,
          u.createdAt.toISOString(),
        ]
          .map(csvEscape)
          .join(',')
      )
      const stamp = new Date().toISOString().slice(0, 10)
      return new Response([header, ...rows].join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="qtb-users-${stamp}.csv"`,
        },
      })
    }

    return Response.json({ users: users.map(toAdminUserJson) })
  } catch (err) {
    console.error('[admin/users/GET]', err)
    return Response.json({ error: 'Failed to load users' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    await ensureSeed()
    const admin = await getAdminUser()
    if (!admin) return forbidden('Admin access required')

    const body: unknown = await request.json().catch(() => null)
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input'
      return Response.json({ error: message }, { status: 400 })
    }

    const { userId, role, banned } = parsed.data
    if (role === undefined && banned === undefined) {
      return Response.json({ error: 'Nothing to update' }, { status: 400 })
    }

    if (userId === admin.id) {
      return Response.json({ error: 'You cannot modify your own account here' }, { status: 400 })
    }

    const target = await db.user.findUnique({ where: { id: userId } })
    if (!target) return Response.json({ error: 'User not found' }, { status: 404 })

    const callerIsSuper = admin.role === 'super_admin'
    const targetIsSuper = target.role === 'super_admin'

    if (targetIsSuper && !callerIsSuper) {
      return Response.json({ error: 'Only a super admin can modify a super admin' }, { status: 403 })
    }

    if (role !== undefined) {
      if (role === 'super_admin' && !callerIsSuper) {
        return Response.json({ error: 'Only a super admin can assign the super admin role' }, { status: 403 })
      }
      if (target.role === 'super_admin' && role !== 'super_admin' && !callerIsSuper) {
        return Response.json({ error: 'Only a super admin can remove the super admin role' }, { status: 403 })
      }
    }

    if (banned === true && targetIsSuper) {
      return Response.json({ error: 'Cannot ban a super admin' }, { status: 403 })
    }

    const data: { role?: string; banned?: boolean } = {}
    if (role !== undefined) data.role = role
    if (banned !== undefined) data.banned = banned

    const updated = await db.user.update({ where: { id: userId }, data })
    return Response.json({ user: toSessionUser(updated) })
  } catch (err) {
    console.error('[admin/users/PUT]', err)
    return Response.json({ error: 'Failed to update user' }, { status: 500 })
  }
}
