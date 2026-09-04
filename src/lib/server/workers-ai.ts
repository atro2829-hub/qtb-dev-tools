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
 * Chunked ArrayBuffer → base64 (btoa needs a JS string; large buffers must be
 * fed in slices to avoid call-stack and memory blowups on the Workers runtime).
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

/**
 * Transcribe an audio recording with Workers AI (runs inside Cloudflare —
 * region-independent, no Gemini geo-block). Tries every STT model in order.
 */
export async function workersAiTranscribe(
  audio: Uint8Array,
  mimeType?: string,
  opts?: { timeoutMs?: number }
): Promise<WorkersAiSttResult> {
  const ai = getWorkersAi()
  if (!ai) throw new Error('Workers AI is not available in this runtime')

  // The AI binding serializes inputs as JSON — the documented binary format
  // is a BASE64 STRING ("string, format: binary" in the model schema; the
  // official chunking tutorial passes `audio: base64String`). Some models
  // (deepgram nova-3) instead accept { body, contentType } with the same
  // base64 body. Blobs/ArrayBuffers can never pass JSON-schema validation.
  const bytes = audio instanceof Uint8Array ? audio : new Uint8Array(audio)
  const b64 = bytesToBase64(bytes)
  const type = mimeType || 'audio/wav'
  const representations: Record<string, unknown>[] = [
    { audio: b64 },
    { audio: { body: b64, contentType: type } },
  ]

  const attempts: string[] = []
  const errors: string[] = []
  let lastError = 'Workers AI transcription failed'
  for (const model of WORKERS_AI_STT_MODELS) {
    attempts.push(model)
    for (let i = 0; i < representations.length; i++) {
      try {
        const run = ai.run.bind(ai)
        const raw = (await Promise.race([
          run(model, representations[i]),
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
        errors.push(`${model}#${i}: empty`)
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        errors.push(`${model}#${i}: ${lastError.slice(0, 120)}`)
        // Schema-validation failures → try the next representation.
        // Real inference failures (timeout/gateway) → skip to the next model.
        if (!/5006|8001|required properties|invalid|schema|mismatch/i.test(lastError)) break
      }
    }
  }
  throw new Error(`${lastError} | all: ${errors.join(' ;; ').slice(0, 800)}`)
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
