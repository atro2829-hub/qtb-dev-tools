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
