/**
 * Serverless-safe password hashing.
 *
 * bcryptjs (cost 10) needs ~80-150ms of pure-JS CPU which exceeds the
 * Cloudflare Workers FREE plan budget (~10ms CPU per request). WebCrypto
 * PBKDF2-SHA256 is a native implementation and finishes in a few ms, so it
 * is used for every NEW hash on every runtime.
 *
 * Stored formats:
 * - `pbkdf2$sha256$15000$<saltB64url>$<hashB64url>`  (this module)
 * - `$2a$…` / `$2b$…` (legacy bcryptjs — still verified for old local rows)
 */
import bcrypt from 'bcryptjs'

const PBKDF2_ITERATIONS = 15_000
const KEY_LENGTH_BITS = 256
const SALT_LENGTH_BYTES = 16
const PREFIX = `pbkdf2$sha256$${PBKDF2_ITERATIONS}$`

function toB64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64Url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  const bin = atob(b64 + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

async function derive(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    key,
    KEY_LENGTH_BITS
  )
  return new Uint8Array(bits)
}

/** Hash a plaintext password with PBKDF2-SHA256 (WebCrypto — works on Node, Bun and Workers). */
export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES))
  const hash = await derive(plain, salt)
  return `${PREFIX}${toB64Url(salt)}$${toB64Url(hash)}`
}

/** Verify a plaintext password against a stored pbkdf2 or legacy bcrypt hash. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored) return false
  if (stored.startsWith(PREFIX)) {
    try {
      const parts = stored.split('$')
      // pbkdf2 / sha256 / 15000 / salt / hash
      if (parts.length !== 5) return false
      const salt = fromB64Url(parts[3])
      const expected = fromB64Url(parts[4])
      const actual = await derive(plain, salt)
      return timingSafeEqual(actual, expected)
    } catch {
      return false
    }
  }
  // Legacy bcrypt hashes ($2a$ / $2b$ / $2y$) — kept for rows created before the
  // PBKDF2 migration. Never produced for new accounts on the Workers deployment.
  if (stored.startsWith('$2')) {
    try {
      return await bcrypt.compare(plain, stored)
    } catch {
      return false
    }
  }
  return false
}
