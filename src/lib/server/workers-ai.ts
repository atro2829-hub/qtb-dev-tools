import { isWorkersRuntime } from '@/lib/server/zai'
import { getCloudflareContext } from '@opennextjs/cloudflare'

/**
 * Cloudflare Workers AI client — region-independent AI inference that runs
 * INSIDE Cloudflare's network. Unlike the Gemini REST API (which geo-blocks
 * some server regions), Workers AI works for every visitor on every colo.
 * Used as the automatic fallback when the Gemini path is unavailable.
 */

export interface WorkersAiEnv {
  AI?: {
    run: (model: string, input: Record<string, unknown>) => Promise<unknown>
  }
}

/** Preferred fallback models, in order (quality → cheaper). */
export const WORKERS_AI_TEXT_MODELS = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/zai-org/glm-5.3-flash',
  '@cf/meta/llama-3.1-8b-instruct-fp8',
]

export interface WorkersAiTextResult {
  text: string
  model: string
}

/**
 * Get the Workers AI binding, or null outside Workers / when unbound.
 */
export function getWorkersAi(): WorkersAiEnv['AI'] | null {
  if (!isWorkersRuntime()) return null
  try {
    const env = getCloudflareContext().env as WorkersAiEnv
    return env?.AI ?? null
  } catch {
    return null
  }
}

/** Extract the assistant text from any Workers AI chat-completion response shape. */
function extractText(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object' && 'response' in raw) {
    const r = (raw as { response?: unknown }).response
    if (typeof r === 'string') return r
  }
  if (raw && typeof raw === 'object' && 'choices' in raw) {
    const first = (raw as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]
    const content = first?.message?.content
    if (typeof content === 'string') return content
  }
  if (raw && typeof raw === 'object' && 'result' in raw) {
    return extractText((raw as { result?: unknown }).result)
  }
  return ''
}

/** Preferred speech-to-text models, in order (quality → fallback). */
export const WORKERS_AI_STT_MODELS = [
  '@cf/openai/whisper-large-v3-turbo',
  '@cf/openai/whisper',
  '@cf/deepgram/nova-3',
]

export interface WorkersAiSttResult {
  text: string
  model: string
}

/**
 * Extract the transcript from any Workers AI speech-to-text response shape:
 * whisper ({text}), deepgram ({results:{channels:[…]}}), or wrapped {result}.
 */
function extractTranscript(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (!raw || typeof raw !== 'object') return ''
  const r = raw as Record<string, unknown>
  if (typeof r.text === 'string' && r.text.trim()) return r.text
  if (typeof r.transcript === 'string' && r.transcript.trim()) return r.transcript
  if (r.results && typeof r.results === 'object') {
    const results = r.results as Record<string, unknown>
    if (Array.isArray(results.channels)) {
      const ch = results.channels[0] as Record<string, unknown> | undefined
      if (ch && Array.isArray(ch.alternatives)) {
        const alt = ch.alternatives[0] as Record<string, unknown> | undefined
        if (alt && typeof alt.transcript === 'string') return alt.transcript
      }
    }
  }
  if ('result' in r) return extractTranscript(r.result)
  return ''
}

/**
 * Transcribe an audio recording with Workers AI (runs inside Cloudflare —
 * region-independent, no Gemini geo-block). Tries every STT model in order.
 */
export async function workersAiTranscribe(
  audio: Uint8Array,
  opts?: { timeoutMs?: number }
): Promise<WorkersAiSttResult> {
  const ai = getWorkersAi()
  if (!ai) throw new Error('Workers AI is not available in this runtime')

  const attempts: string[] = []
  let lastError = 'Workers AI transcription failed'
  for (const model of WORKERS_AI_STT_MODELS) {
    attempts.push(model)
    try {
      const run = ai.run.bind(ai)
      const isDeepgram = model.includes('deepgram')
      const input: Record<string, unknown> = isDeepgram
        ? { audio: Array.from(audio) }
        : { audio }
      const raw = (await Promise.race([
        run(model, input),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Workers AI transcription timed out')),
            opts?.timeoutMs ?? 110_000
          )
        ),
      ])) as unknown
      const text = extractTranscript(raw)
      if (text.trim()) return { text, model }
      lastError = 'Workers AI returned an empty transcript'
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
  }
  throw new Error(`${lastError} (tried: ${attempts.join(', ')})`)
}

/**
 * Run a chat instruction on Workers AI, trying the fallback model chain.
 * Throws with a combined message when every model fails.
 */
export async function workersAiGenerate(
  systemPrompt: string,
  userPrompt: string,
  opts?: { timeoutMs?: number; maxTokens?: number }
): Promise<WorkersAiTextResult> {
  const ai = getWorkersAi()
  if (!ai) throw new Error('Workers AI is not available in this runtime')

  const attempts: string[] = []
  let lastError = 'Workers AI request failed'
  for (const model of WORKERS_AI_TEXT_MODELS) {
    attempts.push(model)
    try {
      const run = ai.run.bind(ai)
      const raw = (await Promise.race([
        run(model, {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: opts?.maxTokens ?? 8192,
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Workers AI request timed out')),
            opts?.timeoutMs ?? 100_000
          )
        ),
      ])) as unknown
      const text = extractText(raw)
      if (text.trim()) return { text, model }
      lastError = 'Workers AI returned an empty response'
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
  }
  throw new Error(`${lastError} (tried: ${attempts.join(', ')})`)
}
