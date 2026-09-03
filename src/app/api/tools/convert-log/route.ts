import { getSessionUser, unauthorized } from '@/lib/auth'
import { enforceQuota } from '@/lib/server/quota'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const IMAGE_TARGETS = new Set(['png', 'jpg', 'webp'])
const IMAGE_SOURCES = new Set(['png', 'jpg', 'jpeg', 'webp'])

/**
 * Records an image→image conversion that was executed CLIENT-SIDE (canvas) by
 * the web app. This keeps quota enforcement and ToolJob analytics intact while
 * offloading the heavy pixel work off the server (Workers free plan has a
 * ~10ms CPU budget — native/WASM image codecs cannot run there).
 */
export async function POST(request: Request) {
  const session = await getSessionUser().catch(() => null)
  if (!session) return unauthorized()

  // Consume one daily use for free-tier users, exactly like the server tools.
  const denied = await enforceQuota(session)
  if (denied) return denied

  try {
    const body = (await request.json().catch(() => null)) as {
      fileName?: string
      sourceFormat?: string
      targetFormat?: string
    } | null

    const fileName = (body?.fileName ?? 'image').slice(0, 200)
    const sourceFormat = (body?.sourceFormat ?? '').toLowerCase()
    const targetFormat = (body?.targetFormat ?? '').toLowerCase()

    if (!IMAGE_SOURCES.has(sourceFormat) || !IMAGE_TARGETS.has(targetFormat)) {
      return Response.json({ error: 'Invalid image conversion formats' }, { status: 400 })
    }

    await db.toolJob.create({
      data: {
        userId: session.id,
        toolType: 'convert',
        fileName,
        sourceFormat: sourceFormat === 'jpeg' ? 'jpg' : sourceFormat,
        targetFormat,
        status: 'completed',
        detail: `Converted ${sourceFormat} → ${targetFormat} (in-browser)`,
      },
    })

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[tools/convert-log]', err)
    return Response.json({ error: 'Failed to record conversion' }, { status: 500 })
  }
}
