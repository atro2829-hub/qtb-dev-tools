import { zaiChatCompletion, geminiTextGenerate, GeminiTextError } from '@/lib/server/zai'
import { workersAiGenerate } from '@/lib/server/workers-ai'
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
    const extractedTextRaw = form.get('extractedText')
    const clientExtractedText =
      typeof extractedTextRaw === 'string'
        ? extractedTextRaw.slice(0, 500_000)
        : ''

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
    let rawText: string
    if (source === 'pdf') {
      // pdfjs cannot run on Workers — the browser extracts the text and
      // sends it along (see src/lib/client-pdf.ts).
      if (clientExtractedText.trim()) {
        rawText = clientExtractedText
      } else {
        return badRequest(
          'PDF text must be extracted in the browser — please use the web app.'
        )
      }
    } else {
      rawText = await extractText(buffer, source)
    }
    const truncated = rawText.slice(0, MAX_TRANSLATION_CHARS)

    let translated = ''

    const cfg = await db.siteConfig.findUnique({ where: { id: 'main' } })
    const geminiKey = cfg?.geminiApiKey?.trim() ?? ''

    let engine = 'gemini'
    if (geminiKey) {
      try {
        const result = await geminiTextGenerate(
          geminiKey,
          [{ parts: [{ text: buildInstruction(sourceLang, targetLang, truncated) }] }],
          { systemInstruction: SYSTEM_PROMPT, timeoutMs: 90_000 }
        )
        translated = result.text
        if (!translated) throw new Error('Gemini returned an empty translation')
      } catch (geminiErr) {
        // Gemini unavailable (geo-blocked, key invalid, model retired…)
        // → fall back to Workers AI, which runs inside Cloudflare and is
        // NOT subject to regional API blocks.
        const result = await workersAiGenerate(
          SYSTEM_PROMPT,
          buildInstruction(sourceLang, targetLang, truncated),
          { timeoutMs: 110_000 }
        )
        translated = result.text
        engine = `workers-ai (${result.model})`
        jobDetail = `${sourceLang}→${targetLang} [${engine}]`
        console.log(
          `[tools/translate] Gemini fallback → Workers AI (${result.model}):`,
          geminiErr instanceof Error ? geminiErr.message.slice(0, 160) : geminiErr
        )
      }
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
    let hint = ''
    if (err instanceof Error && /Workers AI is not available/i.test(err.message)) {
      hint = ' The automatic Workers AI fallback only runs on the Cloudflare deployment.'
    } else if (err instanceof GeminiTextError) {
      if (/location is not supported/i.test(err.message)) {
        hint = ' The Gemini key is valid, but Google geo-blocks this server region — and the Workers AI fallback also failed (it may have hit its free daily limit; it resets at 00:00 UTC).'
      } else if (/API key not valid|API_KEY_INVALID/i.test(err.message)) {
        hint = ' The stored Gemini API key is invalid — an admin can update it in Admin → Settings → AI & Agent API Keys.'
      }
    } else if (err instanceof Error && /ZAI API request failed/.test(err.message)) {
      hint = ' The built-in AI backend is unreachable from this deployment. An admin can add a Gemini API key in Admin → Settings → AI & Agent API Keys to enable translation.'
    }
    return Response.json({ error: `Translation failed, please try again.${hint}` }, { status: 502 })
  }
}
