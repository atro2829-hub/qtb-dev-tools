import { z } from 'zod'
import { forbidden, getAdminUser } from '@/lib/auth'
import { db, ensureSeed } from '@/lib/db'
import { clampString, toFullConfig } from '@/lib/server/api-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_STR = 5000

const configUpdateSchema = z.object({
  organization: z.string().max(MAX_STR).optional(),
  devName: z.string().max(MAX_STR).optional(),
  devEmail: z.string().max(MAX_STR).optional(),
  supportEmail: z.string().max(MAX_STR).optional(),
  logoUrl: z.string().max(MAX_STR).optional(),
  geminiApiKey: z.string().max(MAX_STR).optional(),
  agentApiKey: z.string().max(MAX_STR).optional(),
  admobAppId: z.string().max(MAX_STR).optional(),
  admobBannerId: z.string().max(MAX_STR).optional(),
  adsenseClientId: z.string().max(MAX_STR).optional(),
  adsenseSlotId: z.string().max(MAX_STR).optional(),
  announcement: z.string().max(MAX_STR).optional(),
  freeTrialEnabled: z.boolean().optional(),
  freeTrialDays: z.number().int().min(1).max(3650).optional(),
  freeDailyLimit: z.number().int().min(1).max(1000).optional(),
})

async function loadFullConfig() {
  const cfg = await db.siteConfig.findUnique({ where: { id: 'main' } })
  return toFullConfig(cfg)
}

export async function GET() {
  try {
    await ensureSeed()
    const admin = await getAdminUser()
    if (!admin) return forbidden('Admin access required')

    return Response.json({ config: await loadFullConfig() })
  } catch (err) {
    console.error('[admin/config/GET]', err)
    return Response.json({ error: 'Failed to load config' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    await ensureSeed()
    const admin = await getAdminUser()
    if (!admin) return forbidden('Admin access required')

    const body: unknown = await request.json().catch(() => null)
    const parsed = configUpdateSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input'
      return Response.json({ error: message }, { status: 400 })
    }

    const raw = parsed.data
    const data: Record<string, string | boolean | number> = {}
    const stringKeys = [
      'organization',
      'devName',
      'devEmail',
      'supportEmail',
      'logoUrl',
      'geminiApiKey',
      'agentApiKey',
      'admobAppId',
      'admobBannerId',
      'adsenseClientId',
      'adsenseSlotId',
      'announcement',
    ] as const

    for (const key of stringKeys) {
      const value = raw[key]
      if (typeof value === 'string') data[key] = clampString(value, MAX_STR)
    }
    if (typeof raw.freeTrialEnabled === 'boolean') data.freeTrialEnabled = raw.freeTrialEnabled
    if (typeof raw.freeTrialDays === 'number') data.freeTrialDays = raw.freeTrialDays
    if (typeof raw.freeDailyLimit === 'number') data.freeDailyLimit = raw.freeDailyLimit

    if (Object.keys(data).length === 0) {
      return Response.json({ error: 'Nothing to update' }, { status: 400 })
    }

    await db.siteConfig.upsert({
      where: { id: 'main' },
      update: data,
      create: { id: 'main', ...data },
    })

    return Response.json({ config: await loadFullConfig() })
  } catch (err) {
    console.error('[admin/config/PUT]', err)
    return Response.json({ error: 'Failed to update config' }, { status: 500 })
  }
}
