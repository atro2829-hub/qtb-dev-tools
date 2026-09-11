import { getSessionUser, unauthorized } from '@/lib/auth'
import { db } from '@/lib/db'
import { badRequest, getFormFile, getFormString } from '@/lib/server/api-utils'
import { sbUploadResult, RESULTS_BUCKET } from '@/lib/server/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BYTES = 48 * 1024 * 1024 // 48MB cloud archive cap

/**
 * Archives a generated tool result to Supabase Storage and returns the
 * public permalink. Also stamps resultUrl back onto the originating ToolJob
 * when a run key is provided. Best-effort: a cloud failure is reported, never
 * thrown as a 5xx (the client keeps its local result either way).
 *
 * POST multipart: file, tool?, run?, name?
 */
export async function POST(request: Request) {
  const session = await getSessionUser().catch(() => null)
  if (!session) return unauthorized()

  try {
    const form = await request.formData()
    const file = getFormFile(form, 'file')
    if (!file) return badRequest('A result file is required')
    if (file.size > MAX_BYTES) return badRequest('Result exceeds the 48MB archive limit')

    const tool = getFormString(form, 'tool').slice(0, 40) || 'tool'
    const run = getFormString(form, 'run').slice(0, 80)
    const name = getFormString(form, 'name').slice(0, 120) || file.name || 'result.bin'

    const url = await sbUploadResult(
      session.id,
      `${tool}-${name}`,
      Buffer.from(await file.arrayBuffer()),
      file.type || 'application/octet-stream',
      run
    )

    if (!url) {
      return Response.json(
        {
          error: `Cloud archive unavailable (configure Supabase in Admin → Settings, bucket "${RESULTS_BUCKET}")`,
        },
        { status: 503 }
      )
    }

    if (run) {
      await db.toolJob
        .updateMany({
          where: { userId: session.id, runKey: run, status: 'completed' },
          data: { resultUrl: url.slice(0, 500) },
        })
        .catch((e: unknown) => console.error('[tools/archive] job stamp failed', e))
    }

    return Response.json({ url, bucket: RESULTS_BUCKET })
  } catch (err) {
    console.error('[tools/archive/POST]', err)
    return Response.json({ error: 'Cloud archive failed' }, { status: 502 })
  }
}
