import { db } from '@/lib/db'
import type { SessionUser } from '@/lib/auth'

export interface QuotaInfo {
  unlimited: boolean
  used: number
  limit: number
  resetsAt: string
}

/** Start of today (UTC) — quotas reset daily. */
function startOfToday(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function startOfTomorrow(): Date {
  const start = startOfToday()
  return new Date(start.getTime() + 24 * 60 * 60 * 1000)
}

export function isProUser(user: Pick<SessionUser, 'role' | 'subscriptionStatus'>): boolean {
  if (user.role === 'admin' || user.role === 'super_admin' || user.role === 'staff') return true
  return user.subscriptionStatus === 'trial' || user.subscriptionStatus === 'active'
}

/**
 * Computes today's quota info for a user without enforcing anything.
 */
export async function getQuotaInfo(user: SessionUser): Promise<QuotaInfo> {
  const cfg = await db.siteConfig.findUnique({ where: { id: 'main' } })
  const limit = Math.max(cfg?.freeDailyLimit ?? 5, 1)
  if (isProUser(user)) {
    return { unlimited: true, used: 0, limit: 0, resetsAt: startOfTomorrow().toISOString() }
  }
  const used = await db.toolJob.count({
    where: { userId: user.id, createdAt: { gte: startOfToday() } },
  })
  return { unlimited: false, used, limit, resetsAt: startOfTomorrow().toISOString() }
}

/**
 * Enforces the daily free-tier quota. Returns null when the action is allowed,
 * or a 429 Response (with quota details) when the user is over the limit.
 */
export async function enforceQuota(user: SessionUser): Promise<Response | null> {
  const info = await getQuotaInfo(user)
  if (info.unlimited) return null
  if (info.used < info.limit) return null
  return Response.json(
    {
      error: `You've used all ${info.limit} free uses for today. Upgrade to Pro for unlimited access.`,
      code: 'QUOTA_EXCEEDED',
      used: info.used,
      limit: info.limit,
      resetsAt: info.resetsAt,
    },
    { status: 429 }
  )
}
