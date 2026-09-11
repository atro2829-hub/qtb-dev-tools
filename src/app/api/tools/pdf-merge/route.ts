import { getSessionUser, unauthorized } from '@/lib/auth'
import { enforceQuota } from '@/lib/server/quota'
import { db } from '@/lib/db'
import { PDFDocument } from 'pdf-lib'
import { badRequest, serverError } from '@/lib/server/api-utils'
import { startRun, type RunHandle } from '@/lib/server/progress'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_FILES = 10
const MAX_TOTAL_BYTES = 30 * 1024 * 1024 // 30 MB combined

/**
 * POST /api/tools/pdf-merge
 * multipart: files (2..10 PDFs, merged in the order provided)
 * → { fileName, mimeType, dataBase64, pageCount }
 */
export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const denied = await enforceQuota(user)
  if (denied) return denied

  let rh: RunHandle | null = null

  try {
    const form = await req.formData()
    const files = form.getAll('files').filter((f): f is File => f instanceof File)
    const runKey = typeof form.get('run') === 'string' ? (form.get('run') as string).trim().slice(0, 80) : ''
    if (files.length < 2) return badRequest('Please select at least 2 PDF files to merge.')
    if (files.length > MAX_FILES) return badRequest(`You can merge up to ${MAX_FILES} files at once.`)

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
    if (totalBytes > MAX_TOTAL_BYTES) return badRequest('Combined size exceeds the 30MB limit.')

    for (const f of files) {
      if (!f.name.toLowerCase().endsWith('.pdf')) {
        return badRequest(`"${f.name}" is not a PDF. Only .pdf files can be merged.`)
      }
    }

    rh = await startRun({
      userId: user.id,
      runKey,
      toolType: 'pdf-merge',
      fileName: files[0].name,
      sourceFormat: 'pdf',
      targetFormat: 'pdf',
    })
    rh?.step(25, 'processing')

    const merged = await PDFDocument.create()
    merged.setTitle('Merged with QTB DEV TOOLS')
    merged.setProducer('QTB DEV TOOLS')

    let pageCount = 0
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
      const pages = await merged.copyPages(src, src.getPageIndices())
      pages.forEach((p) => merged.addPage(p))
      pageCount += pages.length
    }

    const out = Buffer.from(await merged.save())
    const baseName = files.length === 2 ? files[0].name.replace(/\.pdf$/i, '') : 'merged'
    const fileName = `${baseName}-merged-${files.length}files.pdf`

    if (rh) {
      await rh.finish(`${files.length} files → ${pageCount} pages`)
    } else {
      await db.toolJob.create({
        data: {
          userId: user.id,
          toolType: 'pdf-merge',
          fileName: fileName,
          sourceFormat: 'pdf',
          targetFormat: 'pdf',
          status: 'completed',
          detail: `${files.length} files → ${pageCount} pages`,
        },
      })
    }

    return Response.json({
      fileName,
      mimeType: 'application/pdf',
      dataBase64: out.toString('base64'),
      pageCount,
    })
  } catch (err) {
    console.error('[pdf-merge] failed:', err)
    if (rh) {
      await rh.fail(err instanceof Error ? err.message.slice(0, 300) : 'merge failed').catch(() => {})
    } else {
      await db.toolJob
        .create({
          data: {
            userId: user.id,
            toolType: 'pdf-merge',
            status: 'failed',
            detail: err instanceof Error ? err.message.slice(0, 300) : 'merge failed',
          },
        })
        .catch(() => {})
    }
    return serverError('Merge failed. One of the files may be corrupted or password-protected.')
  }
}
