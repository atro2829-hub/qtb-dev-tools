import { getSessionUser, forbidden, unauthorized } from '@/lib/auth'
import { db } from '@/lib/db'
import { enforceRateLimit } from '@/lib/server/rate-limit'
import { geminiTextGenerate, GeminiTextError } from '@/lib/server/zai'

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

    const colo =
      (request as Request & { cf?: { colo?: string } }).cf?.colo ?? null
    const result = await geminiTextGenerate(
      keyToTest,
      [{ parts: [{ text: 'Reply with exactly: OK' }] }],
      { timeoutMs: 15_000 }
    )
    return Response.json({
      ok: true,
      model: result.model,
      latencyMs: result.latencyMs,
      colo,
      message: `Key works! AI translation ran on ${result.model} in ${result.latencyMs}ms${colo ? ` (edge: ${colo})` : ''}.`,
    })
  } catch (err) {
    console.error('[admin/verify-gemini]', err)
    const attempts = err instanceof GeminiTextError ? err.attempts : []
    const colo = (request as Request & { cf?: { colo?: string } }).cf?.colo ?? null
    let message =
      err instanceof Error
        ? err.message.slice(0, 240)
        : 'Verification failed — could not reach the Gemini API.'
    const geoBlocked = /location is not supported/i.test(message)
    if (geoBlocked) {
      message =
        'The key is VALID (it authenticated), but Google blocks AI inference from this server region ("User location is not supported"). Visitors from supported regions can still use the AI tools — Gemini runs on the edge nearest to each visitor.'
    } else if (/API key not valid|API_KEY_INVALID/i.test(message)) {
      message = 'Key rejected — the API key is not valid. Double-check it in Google AI Studio.'
    } else if (err instanceof GeminiTextError && err.name === 'AbortError') {
      message = 'Request timed out — check network access to generativelanguage.googleapis.com.'
    } else if (attempts.length > 1) {
      message += ` (tried: ${attempts.join(', ')})`
    }
    return Response.json({
      ok: false,
      model: attempts.at(-1) ?? null,
      latencyMs: 0,
      colo,
      geoBlocked,
      message,
    })
  }
}
