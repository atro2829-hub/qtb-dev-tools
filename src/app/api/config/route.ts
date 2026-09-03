import { db, ensureSeed } from '@/lib/db'
import { toPublicConfig } from '@/lib/server/api-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await ensureSeed()
    const cfg = await db.siteConfig.findUnique({ where: { id: 'main' } })
    return Response.json({ config: toPublicConfig(cfg) })
  } catch (err) {
    console.error('[config/GET]', err)
    return Response.json({ error: 'Failed to load config' }, { status: 500 })
  }
}
