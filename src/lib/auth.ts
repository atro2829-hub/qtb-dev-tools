import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { db } from './db'

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'qtb-dev-tools-dev-secret-change-in-production'
)

export const COOKIE_NAME = 'qtb_token'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export type Role = 'user' | 'staff' | 'admin' | 'super_admin'

export interface SessionUser {
  id: string
  email: string
  name: string | null
  country: string | null
  address: string | null
  role: Role
  subscriptionStatus: string
  trialEndsAt: string | null
  profileComplete: boolean
  banned: boolean
  createdAt: string
}

export function roleRank(role: string): number {
  switch (role) {
    case 'user':
      return 0
    case 'staff':
      return 1
    case 'admin':
      return 2
    case 'super_admin':
      return 3
    default:
      return -1
  }
}

export function isAdminRole(role: string | undefined | null): boolean {
  return role === 'admin' || role === 'super_admin'
}

export async function signToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(SECRET)
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE,
    path: '/',
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.set(COOKIE_NAME, '', { httpOnly: true, maxAge: 0, path: '/' })
}

export function toSessionUser(u: {
  id: string
  email: string
  name: string | null
  country: string | null
  address: string | null
  role: string
  subscriptionStatus: string
  trialEndsAt: Date | null
  profileComplete: boolean
  banned: boolean
  createdAt: Date
}): SessionUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    country: u.country,
    address: u.address,
    role: (u.role as Role) ?? 'user',
    subscriptionStatus: u.subscriptionStatus,
    trialEndsAt: u.trialEndsAt ? u.trialEndsAt.toISOString() : null,
    profileComplete: u.profileComplete,
    banned: u.banned,
    createdAt: u.createdAt.toISOString(),
  }
}

/** Returns the authenticated user or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const store = await cookies()
    const token = store.get(COOKIE_NAME)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, SECRET)
    const userId = payload.sub
    if (!userId) return null
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user || user.banned) return null
    return toSessionUser(user)
  } catch {
    return null
  }
}

/** Throws-free guard: returns user or null if not admin. */
export async function getAdminUser(): Promise<SessionUser | null> {
  const user = await getSessionUser()
  if (!user || !isAdminRole(user.role)) return null
  return user
}

export function unauthorized(message = 'Unauthorized'): Response {
  return Response.json({ error: message }, { status: 401 })
}

export function forbidden(message = 'Forbidden'): Response {
  return Response.json({ error: message }, { status: 403 })
}
