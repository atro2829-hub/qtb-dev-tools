/**
 * Zero-dependency Supabase Storage client (fetch-only) driven by SiteConfig.
 *
 * The admin stores the project URL + service_role key in Admin → Settings
 * (supabaseUrl / supabaseServiceKey). When both are present the app gains a
 * second cloud home alongside Cloudflare: tool results are archived to a
 * public, unguessable Storage bucket and every run keeps a shareable link.
 *
 * Deliberately no @supabase/supabase-js: the Workers bundle has ~50KB gzip
 * headroom and the Storage REST surface is a handful of fetch calls.
 */
import { db } from '@/lib/db'

export const RESULTS_BUCKET = 'qtb-results'

interface SbConfig {
  url: string
  key: string
}

export async function getSupabaseConfig(): Promise<SbConfig | null> {
  try {
    const cfg = await db.siteConfig.findUnique({ where: { id: 'main' } })
    const url = (cfg?.supabaseUrl ?? '').trim().replace(/\/+$/, '')
    const key = (cfg?.supabaseServiceKey ?? '').trim()
    if (!url || !key) return null
    if (!/^https:\/\/.+\.supabase\.(co|in|net)$/i.test(url)) return null
    return { url, key }
  } catch {
    return null
  }
}

export function supabaseAuthHeaders(key: string): Record<string, string> {
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
  }
}

async function sbFetch(
  cfg: SbConfig,
  path: string,
  init: RequestInit = {},
  timeoutMs = 15_000
): Promise<Response> {
  return fetch(`${cfg.url}/storage/v1${path}`, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  })
}

/** Creates the results bucket when missing. Returns an error message or null. */
export async function sbEnsureBucket(name = RESULTS_BUCKET): Promise<string | null> {
  const cfg = await getSupabaseConfig()
  if (!cfg) return 'Supabase is not configured'
  try {
    const res = await sbFetch(cfg, `/bucket`, {
      method: 'POST',
      headers: { ...supabaseAuthHeaders(cfg.key), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, public: true, fileSizeLimit: 52_428_800 }),
    })
    if (res.ok) return null
    if (res.status === 409 || res.status === 400) {
      // 409 = already exists (fine). 400 with "Duplicate" body also means exists.
      const body = await res.text().catch(() => '')
      if (/duplicate|exists/i.test(body) || res.status === 409) return null
    }
    return `Bucket check failed (${res.status})`
  } catch (err) {
    return err instanceof Error ? err.message.slice(0, 200) : 'Bucket check failed'
  }
}

/** Full connectivity probe used by the admin "Test connection" button. */
export async function sbTestConnection(): Promise<{ ok: boolean; message: string }> {
  const cfg = await getSupabaseConfig()
  if (!cfg) return { ok: false, message: 'Missing or malformed Supabase URL / service key' }
  try {
    const list = await sbFetch(cfg, `/bucket`, {
      method: 'GET',
      headers: supabaseAuthHeaders(cfg.key),
    })
    if (!list.ok) {
      return { ok: false, message: `Service key rejected (${list.status})` }
    }
    const ensureErr = await sbEnsureBucket(RESULTS_BUCKET)
    if (ensureErr) return { ok: false, message: ensureErr }
    return { ok: true, message: `Connected — bucket "${RESULTS_BUCKET}" ready` }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message.slice(0, 200) : 'Connection failed',
    }
  }
}

/**
 * Uploads a result artifact. Returns the public permalink or null on any
 * failure (cloud archive is best-effort — tools must never break because of it).
 */
export async function sbUploadResult(
  userId: string,
  fileName: string,
  data: Buffer | Uint8Array,
  contentType: string,
  runKey = ''
): Promise<string | null> {
  const cfg = await getSupabaseConfig()
  if (!cfg) return null
  try {
    const bucketErr = await sbEnsureBucket(RESULTS_BUCKET)
    if (bucketErr) {
      console.error('[supabase] bucket ensure failed:', bucketErr)
      return null
    }
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80) || 'result.bin'
    const stamp = Date.now().toString(36)
    const rand = Math.random().toString(36).slice(2, 8)
    const folder = runKey ? `${userId}/${runKey}` : `${userId}/${stamp}${rand}`
    const path = `${folder}/${safeName}`
    const body =
      data instanceof Uint8Array && !(data instanceof Buffer)
        ? Buffer.from(data)
        : (data as Buffer)
    const res = await sbFetch(
      cfg,
      `/object/${RESULTS_BUCKET}/${path}`,
      {
        method: 'POST',
        headers: {
          ...supabaseAuthHeaders(cfg.key),
          'Content-Type': contentType || 'application/octet-stream',
          'x-upsert': 'true',
        },
        body: new Uint8Array(body),
      },
      30_000
    )
    if (!res.ok) {
      console.error('[supabase] upload failed:', res.status, (await res.text().catch(() => '')).slice(0, 200))
      return null
    }
    return `${cfg.url}/object/public/${RESULTS_BUCKET}/${path}`
  } catch (err) {
    console.error('[supabase] upload error:', err instanceof Error ? err.message : err)
    return null
  }
}
