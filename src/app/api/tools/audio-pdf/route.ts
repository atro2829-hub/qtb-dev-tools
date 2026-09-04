import { geminiTextGenerate, GeminiTextError, zaiChatCompletion, zaiAsrTranscribe } from '@/lib/server/zai'
import { workersAiGenerate, workersAiTranscribe } from '@/lib/server/workers-ai'
import { getSessionUser, unauthorized } from '@/lib/auth'
import { enforceQuota } from '@/lib/server/quota'
import { db } from '@/lib/db'
import { badRequest, getFormString } from '@/lib/server/api-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180

const MAX_BYTES = 14 * 1024 * 1024 // 14 MB audio (Gemini inline limit is 20MB total request)
const MAX_TRANSCRIPT_CHARS = 26_000

const AUDIO_EXTS = /\.(mp3|wav|m4a|aac|ogg|oga|opus|webm|flac|mp4|3gp|amr)$/i

const ALLOWED_STYLES = new Set(['smart', 'minutes', 'lecture', 'interview', 'brief', 'verbatim'])

/* ------------------------------------------------------------------ */
/* Prompts                                                             */
/* ------------------------------------------------------------------ */

const TRANSCRIBE_SYSTEM =
  'You are a professional transcription engine. Transcribe the audio EXACTLY as spoken, in the SAME language the speaker uses. Keep natural sentence breaks. Never translate, never summarize, never add commentary. If the audio is silent or unintelligible, output an empty string.'

const STYLE_GUIDES: Record<string, string> = {
  smart:
    'Organize the content into logical thematic sections. Group related ideas together, give every section a short meaningful heading, and make the text flow naturally from an introduction to a conclusion.',
  minutes:
    'This is a meeting recording. Organize it as official meeting minutes: a section for topics discussed, a section for decisions made, and a section for action items (each action item mentions its owner and deadline when stated).',
  lecture:
    'This is a lecture or educational recording. Organize it as clean study notes: topic sections, definitions, key concepts, and examples as bullet points.',
  interview:
    'This is an interview or dialogue recording. Organize it as Question → Answer pairs: use the question as a short heading and the answer as the paragraph(s) under it.',
  brief:
    'Produce a concise executive brief: a tight summary, 3-6 key points, and at most 2 short sections. Keep it short and high-signal.',
  verbatim:
    'Keep the speaker flow chronological. Only lightly clean the text (punctuation, filler words, repetitions). Split into readable paragraphs WITHOUT restructuring or adding headings beyond generic ones.',
}

function organizeInstruction(
  transcript: string,
  style: string,
  targetLang: string
): string {
  const styleGuide = STYLE_GUIDES[style] ?? STYLE_GUIDES.smart
  const langRule =
    targetLang === 'auto'
      ? 'Write the document in the SAME language as the transcript (detect it).'
      : `Write the document in this language: ${targetLang}. Translate the content if needed.`
  return [
    `Below is the raw transcript of an audio recording. Turn it into a professionally organized document ("${style}" mode).`,
    styleGuide,
    langRule,
    '',
    'CLEANUP RULES:',
    '- Remove filler words, stutters, false starts and pointless repetitions.',
    '- Fix grammar, punctuation and sentence boundaries.',
    '- Keep the original meaning faithful — never invent facts.',
    '- Keep names, numbers and technical terms exactly as spoken.',
    '',
    'REQUIRED OUTPUT — one STRICT JSON object, no markdown fences, no commentary:',
    '{"title": string (max 90 chars),',
    ' "subtitle": string (max 120 chars, what this document is),',
    ' "language": string ("ar" | "en" | other ISO code),',
    ' "summary": string (executive summary, max 60 words),',
    ' "keyPoints": string[] (3-8 short key points),',
    ' "sections": [{"heading": string (short), "paragraphs": string[], "bullets": string[]}] (2-8 sections; use [] for empty lists),',
    ' "conclusion": string (max 50 words)}',
    '',
    '--- TRANSCRIPT ---',
    transcript.slice(0, MAX_TRANSCRIPT_CHARS),
  ].join('\n')
}

const ORGANIZE_SYSTEM =
  'You are an expert document editor that outputs ONLY valid JSON. No markdown, no code fences, no commentary — the response must start with { and end with }.'

/* ------------------------------------------------------------------ */
/* JSON parsing + doc normalization                                    */
/* ------------------------------------------------------------------ */

interface RawDoc {
  title?: unknown
  subtitle?: unknown
  language?: unknown
  summary?: unknown
  keyPoints?: unknown
  sections?: unknown
  conclusion?: unknown
}

export interface NormalizedSection {
  heading: string
  paragraphs: string[]
  bullets: string[]
}

export interface NormalizedDoc {
  title: string
  subtitle: string
  language: string
  summary: string
  keyPoints: string[]
  sections: NormalizedSection[]
  conclusion: string
  wordCount: number
}

function asString(v: unknown, max = 4000): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function asStringArray(v: unknown, maxItems: number, maxLen = 600): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => asString(x, maxLen))
    .filter((s) => s.length > 0)
    .slice(0, maxItems)
}

function extractJson(text: string): RawDoc | null {
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as RawDoc
  } catch {
    return null
  }
}

function normalizeDoc(raw: RawDoc | null, transcript: string): NormalizedDoc | null {
  if (!raw) return null
  const title = asString(raw.title, 200)
  const summary = asString(raw.summary, 2000)
  if (!title && !summary) return null
  const sectionsRaw = Array.isArray(raw.sections) ? raw.sections.slice(0, 10) : []
  const sections: NormalizedSection[] = sectionsRaw
    .map((s) => {
      const sec = (s ?? {}) as { heading?: unknown; paragraphs?: unknown; bullets?: unknown }
      return {
        heading: asString(sec.heading, 160),
        paragraphs: asStringArray(sec.paragraphs, 12, 4000),
        bullets: asStringArray(sec.bullets, 14, 400),
      }
    })
    .filter((s) => s.heading || s.paragraphs.length || s.bullets.length)
  if (!sections.length) return null
  const doc: NormalizedDoc = {
    title: title || 'Audio Report',
    subtitle: asString(raw.subtitle, 300),
    language: asString(raw.language, 12) || 'ar',
    summary,
    keyPoints: asStringArray(raw.keyPoints, 8, 300),
    sections,
    conclusion: asString(raw.conclusion, 1200),
    wordCount: 0,
  }
  doc.wordCount = countWords(doc, transcript)
  return doc
}

function countWords(doc: NormalizedDoc, transcript: string): number {
  let text = `${doc.title} ${doc.subtitle} ${doc.summary} ${doc.conclusion}`
  for (const s of doc.sections) {
    text += ` ${s.heading} ${s.paragraphs.join(' ')} ${s.bullets.join(' ')}`
  }
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return words || transcript.split(/\s+/).filter(Boolean).length
}

/** Graceful fallback: build a readable doc straight from the transcript. */
function verbatimDoc(transcript: string, fileName: string): NormalizedDoc {
  const paras = transcript
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  const merged: string[] = []
  let buf = ''
  for (const p of paras.length ? paras : transcript.split(/\n/)) {
    if ((buf + ' ' + p).trim().length > 900) {
      if (buf) merged.push(buf.trim())
      buf = p
    } else {
      buf = `${buf} ${p}`
    }
  }
  if (buf.trim()) merged.push(buf.trim())
  const base = fileName.replace(/\.[^.]+$/, '') || 'Audio recording'
  const doc: NormalizedDoc = {
    title: base.slice(0, 90),
    subtitle: 'Transcribed recording',
    language: /[\u0600-\u06FF]/.test(transcript) ? 'ar' : 'en',
    summary: '',
    keyPoints: [],
    sections: [
      {
        heading: '',
        paragraphs: merged.slice(0, 12),
        bullets: [],
      },
    ],
    conclusion: '',
    wordCount: 0,
  }
  doc.wordCount = countWords(doc, transcript)
  return doc
}

/* ------------------------------------------------------------------ */
/* Engine helpers                                                      */
/* ------------------------------------------------------------------ */

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

async function chatText(
  system: string,
  user: string,
  geminiKey: string,
  opts?: { timeoutMs?: number }
): Promise<{ text: string; engine: string }> {
  if (geminiKey) {
    try {
      const r = await geminiTextGenerate(
        geminiKey,
        [{ parts: [{ text: user }] }],
        { systemInstruction: system, timeoutMs: opts?.timeoutMs ?? 90_000 }
      )
      if (r.text.trim()) return { text: r.text, engine: `gemini:${r.model}` }
    } catch {
      /* fall through to Workers AI */
    }
  }
  try {
    const r = await workersAiGenerate(system, user, { timeoutMs: 120_000 })
    return { text: r.text, engine: `workers-ai:${r.model}` }
  } catch (err) {
    if (err instanceof Error && /not available in this runtime/i.test(err.message)) {
      // Node dev fallback (ZAI SDK reads its config from the filesystem).
      const response = await zaiChatCompletion({
        messages: [
          { role: 'assistant', content: system },
          { role: 'user', content: user },
        ],
        thinking: { type: 'disabled' },
      })
      const text = extractChatContent(response)
      if (!text.trim()) throw new Error('AI service returned an empty response')
      return { text, engine: 'zai' }
    }
    throw err
  }
}

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

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
    const styleRaw = getFormString(form, 'style') || 'smart'
    const style = ALLOWED_STYLES.has(styleRaw) ? styleRaw : 'smart'
    const targetLang = getFormString(form, 'targetLang') || 'auto'
    const durationLabel = getFormString(form, 'duration').slice(0, 20)

    if (!(file instanceof File) || file.size === 0) {
      return badRequest('An audio file is required')
    }
    if (file.size > MAX_BYTES) {
      return badRequest('Audio exceeds the 14MB size limit')
    }
    const fileName = file.name || 'recording.webm'
    jobFileName = fileName
    const isAudioMime =
      /^audio\//i.test(file.type) || /^video\/(webm|mp4)$/i.test(file.type)
    if (!isAudioMime && !AUDIO_EXTS.test(fileName)) {
      return badRequest(
        'Unsupported file. Upload an audio recording (mp3, wav, m4a, ogg, webm…).'
      )
    }
    jobDetail = style

    const buffer = Buffer.from(await file.arrayBuffer())
    const lower = fileName.toLowerCase()
    const mimeType = /^audio\//i.test(file.type)
      ? file.type
      : lower.endsWith('.webm')
        ? 'audio/webm'
        : lower.endsWith('.m4a') || lower.endsWith('.mp4')
          ? 'audio/mp4'
          : lower.endsWith('.ogg') || lower.endsWith('.oga')
            ? 'audio/ogg'
            : lower.endsWith('.wav')
              ? 'audio/wav'
              : lower.endsWith('.flac')
                ? 'audio/flac'
                : 'audio/mpeg'
    const audioBase64 = buffer.toString('base64')

    /* ---- 1) Transcribe ---- */
    const cfg = await db.siteConfig.findUnique({ where: { id: 'main' } })
    const geminiKey = cfg?.geminiApiKey?.trim() ?? ''

    let transcript = ''
    let transcribeEngine = ''

    if (geminiKey) {
      try {
        const r = await geminiTextGenerate(
          geminiKey,
          [
            {
              parts: [
                { text: 'Transcribe this audio recording exactly as spoken, in the same language.' },
                { inlineData: { mimeType, data: audioBase64 } },
              ],
            },
          ],
          { systemInstruction: TRANSCRIBE_SYSTEM, timeoutMs: 150_000 }
        )
        transcript = r.text.trim()
        transcribeEngine = `gemini:${r.model}`
      } catch (geminiErr) {
        console.log(
          '[tools/audio-pdf] Gemini transcription unavailable → fallback:',
          geminiErr instanceof Error ? geminiErr.message.slice(0, 160) : geminiErr
        )
      }
    }

    if (!transcript) {
      try {
        const r = await workersAiTranscribe(new Uint8Array(buffer))
        transcript = r.text.trim()
        transcribeEngine = `workers-ai:${r.model}`
      } catch (waErr) {
        if (
          waErr instanceof Error &&
          /not available in this runtime/i.test(waErr.message)
        ) {
          // Local dev (Node): ZAI SDK ASR.
          transcript = await zaiAsrTranscribe(audioBase64)
          transcribeEngine = 'zai-asr'
        } else {
          throw waErr
        }
      }
    }

    if (!transcript) {
      return Response.json(
        {
          error:
            'The audio appears to be silent or unintelligible — no speech was detected.',
        },
        { status: 422 }
      )
    }

    /* ---- 2) Smart organization ---- */
    const { text: orgRaw, engine: orgEngine } = await chatText(
      ORGANIZE_SYSTEM,
      organizeInstruction(transcript, style, targetLang),
      geminiKey,
      { timeoutMs: 120_000 }
    )
    const doc =
      normalizeDoc(extractJson(orgRaw), transcript) ?? verbatimDoc(transcript, fileName)
    jobDetail = `${style} [org:${orgEngine} · asr:${transcribeEngine}]`

    /* ---- 3) Record + respond ---- */
    const ext = (fileName.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? 'webm').toLowerCase()
    await db.toolJob.create({
      data: {
        userId: session.id,
        toolType: 'audio-pdf',
        fileName,
        sourceFormat: ext,
        targetFormat: 'pdf',
        status: 'completed',
        detail: jobDetail,
      },
    })

    return Response.json({
      doc,
      transcript,
      engine: { organize: orgEngine, transcribe: transcribeEngine },
      durationLabel,
    })
  } catch (err) {
    console.error('[tools/audio-pdf]', err)
    if (session) {
      await db.toolJob
        .create({
          data: {
            userId: session.id,
            toolType: 'audio-pdf',
            fileName: jobFileName,
            sourceFormat: '',
            targetFormat: 'pdf',
            status: 'failed',
            detail: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error',
          },
        })
        .catch((e: unknown) => console.error('[tools/audio-pdf] job record failed', e))
    }
    let hint = ''
    const errMessage = err instanceof Error ? err.message : String(err)
    if (err instanceof GeminiTextError && /location is not supported/i.test(errMessage)) {
      hint = ' The Gemini key is valid, but Google geo-blocks this server region, and the Workers AI fallback also failed (its free daily quota may be exhausted — it resets at 00:00 UTC).'
    } else if (
      err instanceof GeminiTextError &&
      /API key not valid|API_KEY_INVALID/i.test(err.message)
    ) {
      hint = ' The stored Gemini API key is invalid — an admin can update it in Admin → Settings.'
    } else if (err instanceof Error && /ZAI API request failed|ZAI ASR/.test(err.message)) {
      hint = ' No AI transcription backend is reachable in this deployment. An admin should add a Gemini API key in Admin → Settings.'
    } else if (err instanceof Error && /1214|30秒|0-30/i.test(errMessage)) {
      hint = ' The local development ASR fallback only supports clips under 30 seconds — production (Gemini / Workers AI) handles long recordings.'
    }
    return Response.json(
      {
        error: `Audio processing failed, please try again.${hint}`,
        detail: errMessage.slice(0, 400),
      },
      { status: 502 }
    )
  }
}
