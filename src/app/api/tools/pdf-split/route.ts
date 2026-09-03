import { getSessionUser, unauthorized } from '@/lib/auth'
import { enforceQuota } from '@/lib/server/quota'
import { db } from '@/lib/db'
import { PDFDocument } from 'pdf-lib'
import { badRequest, serverError } from '@/lib/server/api-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Parse a page-selection string like "1-3,5,8-9" into zero-based indices.
 * Validates against the page count, de-duplicates nothing (keeps user order).
 */
function parsePageRanges(input: string, pageCount: number): number[] {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('Enter the pages to extract, e.g. 1-3, 5')
  const indices: number[] = []
  for (const part of trimmed.split(',')) {
    const chunk = part.trim()
    if (!chunk) continue
    const range = chunk.match(/^(\d+)\s*-\s*(\d+)$/)
    if (range) {
      const from = parseInt(range[1], 10)
      const to = parseInt(range[2], 10)
      if (from < 1 || to < 1 || from > pageCount || to > pageCount) {
        throw new Error(`Pages ${from}-${to} are out of range (1-${pageCount}).`)
      }
      const step = from <= to ? 1 : -1
      for (let p = from; ; p += step) {
        indices.push(p - 1)
        if (p === to) break
      }
    } else if (/^\d+$/.test(chunk)) {
      const p = parseInt(chunk, 10)
      if (p < 1 || p > pageCount) {
        throw new Error(`Page ${p} is out of range (1-${pageCount}).`)
      }
      indices.push(p - 1)
    } else {
      throw new Error(`"${chunk}" is not a valid page or range.`)
    }
  }
  if (indices.length === 0) throw new Error('No pages selected.')
  return indices
}

/**
 * POST /api/tools/pdf-split
 * multipart: file (PDF), pages (e.g. "1-3,5")
 * → { fileName, mimeType, dataBase64, pageCount }
 */
export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const denied = await enforceQuota(user)
  if (denied) return denied

  try {
    const form = await req.formData()
    const file = form.get('file')
    const pages = String(form.get('pages') || '')
    if (!(file instanceof File)) return badRequest('Please upload a PDF file.')
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return badRequest('Only .pdf files are supported.')
    }
    if (file.size > 20 * 1024 * 1024) return badRequest('File exceeds the 20MB limit.')

    const bytes = new Uint8Array(await file.arrayBuffer())
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
    const total = src.getPageCount()
    if (total < 2) return badRequest('This PDF has a single page — nothing to split.')

    const indices = parsePageRanges(pages, total)

    const out = await PDFDocument.create()
    out.setTitle('Split with QTB DEV TOOLS')
    out.setProducer('QTB DEV TOOLS')
    const copied = await out.copyPages(src, indices)
    copied.forEach((p) => out.addPage(p))

    const data = Buffer.from(await out.save())
    const baseName = file.name.replace(/\.pdf$/i, '')
    const fileName = `${baseName}-pages-${indices.length}.pdf`

    await db.toolJob.create({
      data: {
        userId: user.id,
        toolType: 'pdf-split',
        fileName: file.name,
        sourceFormat: 'pdf',
        targetFormat: 'pdf',
        status: 'completed',
        detail: `pages [${pages}] → ${indices.length}/${total} pages`,
      },
    })

    return Response.json({
      fileName,
      mimeType: 'application/pdf',
      dataBase64: data.toString('base64'),
      pageCount: indices.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Split failed.'
    const isUserError = /out of range|valid page|No pages|not a PDF|exceeds|nothing to split/.test(message)
    if (!isUserError) {
      console.error('[pdf-split] failed:', err)
      await db.toolJob
        .create({
          data: {
            userId: user.id,
            toolType: 'pdf-split',
            status: 'failed',
            detail: message.slice(0, 300),
          },
        })
        .catch(() => {})
      return serverError('Split failed. The file may be corrupted or password-protected.')
    }
    return badRequest(message)
  }
}
