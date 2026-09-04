/**
 * Workers-compatible ZAI client.
 *
 * `z-ai-web-dev-sdk` reads its configuration from a FILESYSTEM file
 * (`.z-ai-config`), which does not exist on Cloudflare Workers. This wrapper
 * provides the two calls the app needs (chat completions + image edit) with:
 *  - Workers/deployed runtime: config from env vars (ZAI_BASE_URL, ZAI_API_KEY,
 *    ZAI_CHAT_ID, ZAI_USER_ID, ZAI_TOKEN) wired as Worker secrets.
 *  - Local Node/Bun runtime (env vars absent): delegates to the official SDK,
 *    which reads /etc/.z-ai-config as before. Zero behavior change in dev.
 */

export interface ZaiImageEditResult {
  data?: Array<{ base64?: string; url?: string; format?: string }>
}

export interface ZaiChatResult {
  choices?: Array<{ message?: { content?: string } }>
}

interface ZaiConfig {
  baseUrl: string
  apiKey: string
  chatId?: string
  userId?: string
  token?: string
}

export function isWorkersRuntime(): boolean {
  try {
    // Minimal structural probe — avoid importing runtime-only symbols at module scope.
    return typeof (globalThis as Record<string, unknown>).caches === 'object' &&
      typeof (globalThis as Record<string, unknown>).WebSocketPair === 'function'
  } catch {
    return false
  }
}

function configFromEnv(): ZaiConfig | null {
  const baseUrl = process.env.ZAI_BASE_URL?.trim()
  const apiKey = process.env.ZAI_API_KEY?.trim()
  if (!baseUrl || !apiKey) return null
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
    chatId: process.env.ZAI_CHAT_ID?.trim() || undefined,
    userId: process.env.ZAI_USER_ID?.trim() || undefined,
    token: process.env.ZAI_TOKEN?.trim() || undefined,
  }
}

function headersFor(config: ZaiConfig, json = true): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Z-AI-From': 'Z',
  }
  if (json) headers['Content-Type'] = 'application/json'
  headers['Authorization'] = `Bearer ${config.apiKey}`
  if (config.chatId) headers['X-Chat-Id'] = config.chatId
  if (config.userId) headers['X-User-Id'] = config.userId
  if (config.token) headers['X-Token'] = config.token
  return headers
}

async function readError(res: Response): Promise<string> {
  const body = await res.text().catch(() => '')
  return `ZAI API request failed with status ${res.status}: ${body.slice(0, 500)}`
}

/** OpenAI-style chat completion. Returns the parsed JSON response. */
export async function zaiChatCompletion(body: Record<string, unknown>): Promise<ZaiChatResult> {
  if (isWorkersRuntime()) {
    const config = configFromEnv()
    if (!config) throw new Error('ZAI configuration missing (ZAI_BASE_URL / ZAI_API_KEY secrets)')
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: headersFor(config),
      body: JSON.stringify({ ...body, thinking: (body.thinking as unknown) ?? { type: 'disabled' } }),
    })
    if (!res.ok) throw new Error(await readError(res))
    return (await res.json()) as ZaiChatResult
  }
  // Local dev — use the official SDK exactly as before.
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()
  const response: unknown = await zai.chat.completions.create({
    ...body,
    thinking: (body.thinking as unknown) ?? { type: 'disabled' },
  } as Parameters<typeof zai.chat.completions.create>[0])
  return response as ZaiChatResult
}

/** Image edit (used for background removal). Mirrors the SDK's URL→base64 download. */
export async function zaiImageEdit(body: {
  prompt: string
  images: Array<{ url: string }>
  size?: string
}): Promise<ZaiImageEditResult> {
  if (isWorkersRuntime()) {
    const config = configFromEnv()
    if (!config) throw new Error('ZAI configuration missing (ZAI_BASE_URL / ZAI_API_KEY secrets)')
    const res = await fetch(`${config.baseUrl}/images/generations/edit`, {
      method: 'POST',
      headers: headersFor(config),
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await readError(res))
    const result = (await res.json()) as ZaiImageEditResult
    const data = await Promise.all(
      (result.data ?? []).map(async (item) => {
        if (item.url) {
          const imgRes = await fetch(item.url)
          if (!imgRes.ok) throw new Error(`Failed to download image: ${imgRes.status}`)
          const buf = await imgRes.arrayBuffer()
          let bin = ''
          const bytes = new Uint8Array(buf)
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
          return { base64: btoa(bin), format: 'png' }
        }
        return item
      })
    )
    return { ...result, data }
  }
  // Local dev — official SDK.
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()
  const result = (await zai.images.generations.edit(
    body as unknown as Parameters<typeof zai.images.generations.edit>[0]
  )) as unknown as ZaiImageEditResult
  return result
}

/** Gemini image models to try, in order (image generation/editing capable). */
const GEMINI_IMAGE_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-3.6-flash-image',
  'gemini-2.5-flash-image-preview',
  'gemini-2.0-flash-preview-image-generation',
]

/** Gemini text models to try, in order (Google retires old ones regularly). */
export const GEMINI_TEXT_MODELS = [
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
]

export interface GeminiTextResult {
  text: string
  model: string
  latencyMs: number
}

export class GeminiTextError extends Error {
  readonly attempts: string[]
  constructor(message: string, attempts: string[]) {
    super(message)
    this.name = 'GeminiTextError'
    this.attempts = attempts
  }
}

/**
 * Generate text via the Gemini API, trying every text model in order.
 * Retired/unavailable models are skipped automatically; the error from the
 * last attempt is surfaced with the list of tried models.
 */
export async function geminiTextGenerate(
  apiKey: string,
  contents: unknown,
  opts?: { timeoutMs?: number; systemInstruction?: string }
): Promise<GeminiTextResult> {
  const attempts: string[] = []
  let lastMessage = 'Gemini request failed'
  for (const model of GEMINI_TEXT_MODELS) {
    attempts.push(model)
    const started = Date.now()
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      opts?.timeoutMs ?? 60_000
    )
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify(
            opts?.systemInstruction
              ? { contents, systemInstruction: { parts: [{ text: opts.systemInstruction }] } }
              : { contents }
          ),
        }
      )
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        let msg = `Gemini API error ${res.status}`
        try {
          const parsed = JSON.parse(body) as { error?: { message?: string; status?: string } }
          if (parsed?.error?.message) msg = parsed.error.message.slice(0, 300)
        } catch {
          /* keep generic */
        }
        lastMessage = msg
        // Regional blocks apply to the caller's location — identical for
        // every model → fail fast with the clear geo message.
        if (/location is not supported/i.test(msg)) {
          throw new GeminiTextError(msg, attempts)
        }
        // Retired / unknown model → try the next one.
        const retired =
          res.status === 404 ||
          /no longer available|not found for API version/i.test(msg)
        if (retired) continue
        throw new GeminiTextError(msg, attempts)
      }
      const json = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> }
        }>
      }
      const text = (json.candidates?.[0]?.content?.parts ?? [])
        .map((p) => (typeof p?.text === 'string' ? p.text : ''))
        .join('')
      if (!text) {
        lastMessage = 'Gemini returned an empty response'
        continue
      }
      return { text, model, latencyMs: Date.now() - started }
    } catch (err) {
      if (err instanceof GeminiTextError) throw err
      if (err instanceof Error && err.name === 'AbortError') {
        lastMessage = `Gemini request timed out after ${(opts?.timeoutMs ?? 60_000) / 1000}s`
        continue
      }
      lastMessage = err instanceof Error ? err.message : String(err)
      // Network-level failure: no point hammering the other models.
      throw new GeminiTextError(lastMessage, attempts)
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new GeminiTextError(lastMessage, attempts)
}

export interface GeminiImageResult {
  base64: string
  mimeType: string
}

/**
 * Image editing via the Gemini image models (used on the Workers deployment,
 * where the ZAI internal API is not reachable). Returns the first inline image
 * found in the response.
 */
export async function geminiImageEdit(
  apiKey: string,
  prompt: string,
  imageDataUrl: string
): Promise<GeminiImageResult> {
  const marker = 'base64,'
  const commaIdx = imageDataUrl.indexOf(marker)
  const mimeType = commaIdx > 0 ? imageDataUrl.slice(5, commaIdx - 7) : 'image/jpeg'
  const base64Data = commaIdx > 0 ? imageDataUrl.slice(commaIdx + marker.length) : imageDataUrl

  let lastError = 'Gemini image edit failed'
  for (const model of GEMINI_IMAGE_MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inlineData: { mimeType, data: base64Data } },
              ],
            },
          ],
        }),
      }
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      lastError = `Gemini API error ${res.status}: ${body.slice(0, 300)}`
      continue // try next model
    }
    const json = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } }> }
      }>
    }
    const parts = json.candidates?.[0]?.content?.parts ?? []
    for (const part of parts) {
      const inline = part.inlineData ?? part.inline_data
      const data = (inline as { data?: string } | undefined)?.data
      if (data) {
        const mime =
          (inline as { mimeType?: string; mime_type?: string }).mimeType ??
          (inline as { mime_type?: string }).mime_type ??
          'image/png'
        return { base64: data, mimeType: mime }
      }
    }
    lastError = 'Gemini returned no image data'
  }
  throw new Error(lastError)
}
