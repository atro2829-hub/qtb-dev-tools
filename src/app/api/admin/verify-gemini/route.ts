import { getSessionUser, forbidden, unauthorized } from '@/lib/auth'
import { db } from '@/lib/db'
import { enforceRateLimit } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/verify-gemini
 * body: { key?: string }  (falls back to the stored geminiApiKey)
 * → { ok, message, model, latencyMs }
 * Never echoes the key back to the client.
 */
export async function POST(request: Request) {
  const session = await getSessionUser()
  if (!session) return unauthorized()
  if (session.role !== 'admin' && session.role !== 'super_admin') return forbidden()

  const blocked = enforceRateLimit(request, 'admin:verify-gemini', 6, 60 * 1000)
  if (blocked) return blocked

  try {
    const body: unknown = await request.json().catch(() => ({}))
    const provided = typeof (body as { key?: unknown })?.key === 'string'
      ? String((body as { key?: unknown }).key).trim()
      : ''

    let keyToTest = provided
    if (!keyToTest) {
      const cfg = await db.siteConfig.findUnique({ where: { id: 'main' } })
      keyToTest = cfg?.geminiApiKey?.trim() ?? ''
    }

    if (!keyToTest) {
      return Response.json({
        ok: false,
        model: null,
        latencyMs: 0,
        message: 'No Gemini key configured. Paste a key above or in the AI settings, then verify.',
      })
    }

    if (keyToTest.length < 20) {
      return Response.json({
        ok: false,
        model: null,
        latencyMs: 0,
        message: 'That does not look like a valid Gemini API key (too short).',
      })
    }

    const started = Date.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(keyToTest)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Reply with exactly: OK' }] }],
            generationConfig: { maxOutputTokens: 8 },
          }),
        }
      )
      const latencyMs = Date.now() - started

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        let reason = `HTTP ${res.status}`
        try {
          const parsed = JSON.parse(errText) as { error?: { message?: string } }
          if (parsed?.error?.message) reason = parsed.error.message.slice(0, 200)
        } catch {
          /* keep HTTP status reason */
        }
        return Response.json({
          ok: false,
          model: 'gemini-2.0-flash',
          latencyMs,
          message: `Key rejected — ${reason}`,
        })
      }

      return Response.json({
        ok: true,
        model: 'gemini-2.0-flash',
        latencyMs,
        message: `Key works! Translation will use Gemini (responded in ${latencyMs}ms).`,
      })
    } finally {
      clearTimeout(timeout)
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    console.error('[admin/verify-gemini]', err)
    return Response.json({
      ok: false,
      model: 'gemini-2.0-flash',
      latencyMs: 0,
      message: aborted
        ? 'Request timed out after 15s — check network access to generativelanguage.googleapis.com.'
        : 'Verification failed — could not reach the Gemini API.',
    })
  }
}
