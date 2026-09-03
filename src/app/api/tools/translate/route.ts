import { zaiChatCompletion } from '@/lib/server/zai'
import { getSessionUser, unauthorized } from '@/lib/auth'
import { enforceQuota } from '@/lib/server/quota'
import { db } from '@/lib/db'
import { badRequest, getFormString } from '@/lib/server/api-utils'
import { detectFormat, extractText } from '@/lib/server/text-extraction'
import { textToDocxBuffer } from '@/lib/server/docx-generation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_BYTES = 15 * 1024 * 1024 // 15 MB
const MAX_TRANSLATION_CHARS = 12000

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const SYSTEM_PROMPT =
  'You are a professional document translator. Output ONLY the translated text preserving paragraph breaks and line structure. No explanations, no notes.'

function buildInstruction(sourceLang: string, targetLang: string, text: string): string {
  return [
    `Translate the following document text from ${sourceLang} to ${targetLang}.`,
    'Preserve the paragraph breaks and line structure exactly as in the original.',
    'Do not add explanations, notes or the original text. Return ONLY the translated text.',
    '',
    '---',
    text,
  ].join('\n')
}

/** Narrow the OpenAI-style chat completion response to its message content. */
function extractChatContent(response: unknown): string {
  if (response && typeof response === 'object' && 'choices' in response) {
    const choices = (response as { choices?: unknown }).choices
    if (Array.isArray(choices) && choices.length > 0) {
      const first = choices[0]
      if (first && typeof first === 'object' && 'message' in first) {
        const message = (first as { message?: unknown }).message
        if (message && typeof message === 'object' && 'content' in message) {
          const content = (message as { content?: unknown }).content
          if (typeof content === 'string') return content
        }
      }
    }
  }
  return ''
}

/** Narrow the Gemini generateContent response to the first candidate's text. */
function extractGeminiText(response: unknown): string {
  if (response && typeof response === 'object' && 'candidates' in response) {
    const candidates = (response as { candidates?: unknown }).candidates
    if (Array.isArray(candidates) && candidates.length > 0) {
      const first = candidates[0]
      if (first && typeof first === 'object' && 'content' in first) {
        const content = (first as { content?: unknown }).content
        if (content && typeof content === 'object' && 'parts' in content) {
          const parts = (content as { parts?: unknown }).parts
          if (Array.isArray(parts)) {
            const texts = parts
              .map((p) =>
                p && typeof p === 'object' && 'text' in p && typeof (p as { text?: unknown }).text === 'string'
                  ? (p as { text: string }).text
                  : ''
              )
              .filter(Boolean)
            return texts.join('')
          }
        }
      }
    }
  }
  return ''
}

function sanitizeFileNamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'translation'
}

export async function POST(request: Request) {
  const session = await getSessionUser().catch(() => null)
  if (!session) return unauthorized()

  const denied = await enforceQuota(session)
  if (denied) return denied

  let jobFileName = ''
  let jobDetail = ''

  try {
    const form = await request.formData()
    const file = form.get('file')
    const sourceLang = getFormString(form, 'sourceLang') || 'auto'
    const targetLang = getFormString(form, 'targetLang')

    if (!(file instanceof File) || file.size === 0) {
      return badRequest('A document file is required')
    }
    if (!targetLang) {
      return badRequest('targetLang is required')
    }
    if (file.size > MAX_BYTES) {
      return badRequest('File exceeds the 15MB size limit')
    }

    const fileName = file.name || 'document'
    jobFileName = fileName
    const source = detectFormat(fileName)
    if (source === 'unknown') {
      return badRequest('Unsupported file format. Use PDF, DOCX or TXT.')
    }
    jobDetail = `${sourceLang}→${targetLang}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const rawText = await extractText(buffer, source)
    const truncated = rawText.slice(0, MAX_TRANSLATION_CHARS)

    let translated = ''

    const cfg = await db.siteConfig.findUnique({ where: { id: 'main' } })
    const geminiKey = cfg?.geminiApiKey?.trim() ?? ''

    if (geminiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildInstruction(sourceLang, targetLang, truncated) }] }],
          }),
        }
      )
      if (!res.ok) {
        const errorBody = await res.text().catch(() => '')
        throw new Error(`Gemini API error ${res.status}: ${errorBody.slice(0, 300)}`)
      }
      const json: unknown = await res.json()
      translated = extractGeminiText(json)
      if (!translated) throw new Error('Gemini returned an empty translation')
    } else {
      const response = await zaiChatCompletion({
        messages: [
          { role: 'assistant', content: SYSTEM_PROMPT },
          { role: 'user', content: buildInstruction(sourceLang, targetLang, truncated) },
        ],
        thinking: { type: 'disabled' },
      })
      translated = extractChatContent(response)
      if (!translated) throw new Error('Translation service returned an empty response')
    }

    const docxBuffer = await textToDocxBuffer(translated)
    const base = (fileName.replace(/\.[^.]+$/, '') || 'document').slice(0, 80)
    const langPart = sanitizeFileNamePart(targetLang)
    const outFileName = `${base}.${langPart}.docx`

    await db.toolJob.create({
      data: {
        userId: session.id,
        toolType: 'translate',
        fileName,
        sourceFormat: source,
        targetFormat: 'docx',
        status: 'completed',
        detail: jobDetail,
      },
    })

    return Response.json({
      fileName: outFileName,
      mimeType: DOCX_MIME,
      dataBase64: docxBuffer.toString('base64'),
      preview: translated.slice(0, 500),
    })
  } catch (err) {
    console.error('[tools/translate]', err)
    if (session) {
      await db.toolJob
        .create({
          data: {
            userId: session.id,
            toolType: 'translate',
            fileName: jobFileName,
            sourceFormat: '',
            targetFormat: 'docx',
            status: 'failed',
            detail: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error',
          },
        })
        .catch((e: unknown) => console.error('[tools/translate] job record failed', e))
    }
    const hint =
      err instanceof Error && /ZAI API request failed/.test(err.message)
        ? ' The built-in AI backend is unreachable from this deployment. An admin can add a Gemini API key in Admin → Settings → AI & Agent API Keys to enable translation.'
        : ''
    return Response.json({ error: `Translation failed, please try again.${hint}` }, { status: 502 })
  }
}
