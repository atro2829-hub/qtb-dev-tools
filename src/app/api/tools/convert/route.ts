import { getSessionUser, unauthorized } from '@/lib/auth'
import { enforceQuota } from '@/lib/server/quota'
import { db } from '@/lib/db'
import { badRequest } from '@/lib/server/api-utils'
import { detectFormat, extractText, stripMarkdownArtifacts, type SourceFormat } from '@/lib/server/text-extraction'
import { textToPdfBuffer } from '@/lib/server/pdf-generation'
import { textToDocxBuffer } from '@/lib/server/docx-generation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_BYTES = 15 * 1024 * 1024 // 15 MB

const TARGET_FORMATS = new Set(['docx', 'pdf', 'txt', 'png', 'jpg', 'webp'])

const DOC_MIMES: Record<'docx' | 'pdf' | 'txt', string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  txt: 'text/plain',
}

const IMAGE_MIMES: Record<'png' | 'jpg' | 'webp', string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp'])

type ImageFormat = 'png' | 'jpg' | 'webp'

function normalizeImageFormat(ext: string): ImageFormat {
  return ext === 'jpeg' ? 'jpg' : (ext as ImageFormat)
}

/** Error thrown when image codecs are unavailable (Cloudflare Workers runtime). */
class ImageRuntimeUnsupportedError extends Error {}

async function convertImage(buffer: Buffer, target: ImageFormat): Promise<Buffer> {
  // sharp ships native binaries — it can only run on the Node.js runtime.
  // On Workers the web app performs image conversions client-side via canvas.
  if (typeof process === 'undefined' || process.env.NEXT_RUNTIME === 'edge') {
    throw new ImageRuntimeUnsupportedError('native image codecs unavailable')
  }
  let sharp: typeof import('sharp')
  try {
    sharp = (await import('sharp')).default
  } catch {
    throw new ImageRuntimeUnsupportedError('native image codecs unavailable')
  }
  let pipeline = sharp(buffer).rotate() // respect EXIF orientation
  switch (target) {
    case 'png':
      pipeline = pipeline.png()
      break
    case 'jpg':
      // JPEG has no alpha channel: flatten onto white
      pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: 90 })
      break
    case 'webp':
      pipeline = pipeline.flatten({ background: '#ffffff' }).webp({ quality: 90 })
      break
  }
  return pipeline.toBuffer()
}

async function convertDocument(
  buffer: Buffer,
  source: SourceFormat,
  target: 'docx' | 'pdf' | 'txt'
): Promise<{ data: Buffer; mimeType: string }> {
  if (target === 'txt') {
    const text = await extractText(buffer, source)
    return { data: Buffer.from(text, 'utf8'), mimeType: DOC_MIMES.txt }
  }
  if (target === 'pdf') {
    let text = await extractText(buffer, source)
    if (source === 'docx') text = stripMarkdownArtifacts(text)
    const data = await textToPdfBuffer(text)
    return { data, mimeType: DOC_MIMES.pdf }
  }
  // target === 'docx'
  const text = await extractText(buffer, source)
  const data = await textToDocxBuffer(text)
  return { data, mimeType: DOC_MIMES.docx }
}

export async function POST(request: Request) {
  const session = await getSessionUser().catch(() => null)
  if (!session) return unauthorized()

  const denied = await enforceQuota(session)
  if (denied) return denied

  let jobFileName = ''
  let sourceFormat = ''
  let targetFormat = ''

  try {
    const form = await request.formData()
    const file = form.get('file')
    const rawTarget = form.get('targetFormat')
    const target = typeof rawTarget === 'string' ? rawTarget.trim().toLowerCase() : ''

    if (!(file instanceof File) || file.size === 0) {
      return badRequest('A file is required')
    }
    if (!TARGET_FORMATS.has(target)) {
      return badRequest('Invalid target format. Use docx, pdf, txt, png, jpg or webp.')
    }
    if (file.size > MAX_BYTES) {
      return badRequest('File exceeds the 15MB size limit')
    }

    const fileName = file.name || 'file'
    jobFileName = fileName
    const ext = (fileName.split('.').pop() ?? '').toLowerCase()
    if (!ext) return badRequest('Cannot detect the source file format')

    const buffer = Buffer.from(await file.arrayBuffer())
    const isSourceImage = IMAGE_EXTENSIONS.has(ext)

    let result: { data: Buffer; mimeType: string }

    if (isSourceImage) {
      sourceFormat = normalizeImageFormat(ext)
      if (!(target in IMAGE_MIMES)) {
        return badRequest(`Conversion from ${ext} to ${target} is not supported`)
      }
      targetFormat = target
      try {
        const data = await convertImage(buffer, target as ImageFormat)
        result = { data, mimeType: IMAGE_MIMES[target as ImageFormat] }
      } catch (convErr) {
        if (convErr instanceof ImageRuntimeUnsupportedError) {
          return Response.json(
            {
              error:
                'Image-to-image conversion runs in your browser on this deployment. Please use the web app.',
              code: 'USE_CLIENT_IMAGE',
            },
            { status: 501 }
          )
        }
        throw convErr
      }
    } else if (['pdf', 'docx', 'txt'].includes(ext)) {
      const source = detectFormat(fileName)
      sourceFormat = source
      if (!(target in DOC_MIMES)) {
        return badRequest(`Conversion from ${source} to ${target} is not supported`)
      }
      targetFormat = target
      result = await convertDocument(buffer, source, target as 'docx' | 'pdf' | 'txt')
    } else {
      return badRequest('Unsupported source file format')
    }

    const base = fileName.replace(/\.[^.]+$/, '') || 'document'
    await db.toolJob.create({
      data: {
        userId: session.id,
        toolType: 'convert',
        fileName,
        sourceFormat,
        targetFormat,
        status: 'completed',
        detail: `Converted ${sourceFormat} → ${targetFormat}`,
      },
    })

    return Response.json({
      fileName: `${base}-converted.${target}`,
      mimeType: result.mimeType,
      dataBase64: result.data.toString('base64'),
    })
  } catch (err) {
    console.error('[tools/convert]', err)
    if (session) {
      await db.toolJob
        .create({
          data: {
            userId: session.id,
            toolType: 'convert',
            fileName: jobFileName,
            sourceFormat,
            targetFormat,
            status: 'failed',
            detail: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error',
          },
        })
        .catch((e: unknown) => console.error('[tools/convert] job record failed', e))
    }
    return Response.json({ error: 'Conversion failed' }, { status: 500 })
  }
}
