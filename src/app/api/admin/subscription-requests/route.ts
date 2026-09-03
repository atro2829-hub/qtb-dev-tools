import { z } from 'zod'
import { forbidden, getAdminUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from '@/lib/server/api-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const reviewSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['approve', 'deny']),
  reviewNote: z.string().trim().max(1000).optional(),
})

function toRequestJson(r: {
  id: string
  userId: string
  plan: string
  bankAccountId: string
  bankName: string
  amount: number | null
  currency: string
  paymentReference: string
  proofFileName: string
  proofData: string
  note: string
  status: string
  reviewNote: string
  reviewedAt: Date | null
  createdAt: Date
  user: { email: string; name: string | null } | null
}) {
  return {
    id: r.id,
    userId: r.userId,
    plan: r.plan,
    bankAccountId: r.bankAccountId,
    bankName: r.bankName,
    amount: r.amount,
    currency: r.currency,
    paymentReference: r.paymentReference,
    proofFileName: r.proofFileName,
    proofData: r.proofData,
    note: r.note,
    status: r.status,
    reviewNote: r.reviewNote,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    user: r.user ? { email: r.user.email, name: r.user.name } : null,
  }
}

export async function GET() {
  try {
    const admin = await getAdminUser()
    if (!admin) return forbidden('Admin access required')

    const requests = await db.subscriptionRequest.findMany({
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return Response.json({ requests: requests.map(toRequestJson) })
  } catch (err) {
    console.error('[admin/subscription-requests/GET]', err)
    return Response.json({ error: 'Failed to load subscription requests' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await getAdminUser()
    if (!admin) return forbidden('Admin access required')

    const body: unknown = await request.json().catch(() => null)
    const parsed = reviewSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input'
      return Response.json({ error: message }, { status: 400 })
    }

    const { id, action, reviewNote } = parsed.data
    const existing = await db.subscriptionRequest.findUnique({ where: { id } })
    if (!existing) return notFound('Subscription request not found')

    const status = action === 'approve' ? 'approved' : 'denied'

    await db.subscriptionRequest.update({
      where: { id },
      data: {
        status,
        reviewedAt: new Date(),
        reviewNote: reviewNote !== undefined ? reviewNote : undefined,
      },
    })

    // Approving a request activates the requester's subscription.
    if (action === 'approve') {
      await db.user.update({
        where: { id: existing.userId },
        data: { subscriptionStatus: 'active' },
      })
    }
    // Denying leaves the user's subscription status untouched.

    const fresh = await db.subscriptionRequest.findUnique({
      where: { id },
      include: { user: { select: { email: true, name: true } } },
    })
    if (!fresh) return notFound('Subscription request not found')

    return Response.json({ request: toRequestJson(fresh) })
  } catch (err) {
    console.error('[admin/subscription-requests/PUT]', err)
    return Response.json({ error: 'Failed to review subscription request' }, { status: 500 })
  }
}
