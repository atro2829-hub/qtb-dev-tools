import { zaiImageEdit } from '@/lib/server/zai'
import { getSessionUser, unauthorized } from '@/lib/auth'
import { enforceQuota } from '@/lib/server/quota'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_BYTES = 12 * 1024 * 1024 // 12 MB
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const PROMPT =
  'Remove the background completely and cleanly, isolate the main subject with sharp clean edges, pure white background where background was removed'

export async function POST(request: Request) {
  const session = await getSessionUser().catch(() => null)
  if (!session) return unauthorized()

  const denied = await enforceQuota(session)
  if (denied) return denied

  let jobData: { fileName: string; detail: string } | null = null

  try {
    const form = await request.formData()
    const file = form.get('image')
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: 'An image file is required' }, { status: 400 })
    }
    if (!ALLOWED_MIMES.has(file.type)) {
      return Response.json(
        { error: 'Unsupported image format. Use JPEG, PNG or WebP.' },
        { status: 400 }
      )
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: 'Image exceeds the 12MB size limit' }, { status: 400 })
    }

    jobData = { fileName: file.name || 'image', detail: 'Background removal' }

    const buffer = Buffer.from(await file.arrayBuffer())
    const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`

    const result = await zaiImageEdit({
      prompt: PROMPT,
      images: [{ url: dataUrl }],
      size: '1024x1024',
    })

    const base64 = result?.data?.[0]?.base64
    if (!base64) {
      throw new Error('Empty response from background removal service')
    }

    await db.toolJob.create({
      data: {
        userId: session.id,
        toolType: 'bg-remove',
        fileName: jobData.fileName,
        status: 'completed',
        detail: jobData.detail,
      },
    })

    return Response.json({ image: `data:image/png;base64,${base64}` })
  } catch (err) {
    console.error('[tools/bg-remove]', err)
    if (session) {
      await db.toolJob
        .create({
          data: {
            userId: session.id,
            toolType: 'bg-remove',
            fileName: jobData?.fileName ?? 'image',
            status: 'failed',
            detail: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error',
          },
        })
        .catch((e: unknown) => console.error('[tools/bg-remove] job record failed', e))
    }
    return Response.json({ error: 'Background removal failed, please try again' }, { status: 502 })
  }
}
