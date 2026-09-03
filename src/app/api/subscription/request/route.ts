import { getSessionUser, unauthorized } from '@/lib/auth'
import { db } from '@/lib/db'
import { clampString, getFormFile, getFormString, toRequestJson } from '@/lib/server/api-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_PROOF_BYTES = 8 * 1024 * 1024 // 8 MB
const ALLOWED_PROOF_MIMES = new Set(['image/png', 'image/jpeg', 'application/pdf'])
const PLANS = new Set(['monthly', 'yearly', 'lifetime'])

export async function POST(request: Request) {
  try {
    const session = await getSessionUser()
    if (!session) return unauthorized()

    const form = await request.formData()
    const plan = getFormString(form, 'plan').toLowerCase()
    const bankAccountId = getFormString(form, 'bankAccountId')
    const paymentReference = getFormString(form, 'paymentReference')
    const note = getFormString(form, 'note')
    const proof = getFormFile(form, 'proof')

    // Free-trial path: grant trial immediately, no request/proof needed.
    if (session.subscriptionStatus === 'none') {
      const cfg = await db.siteConfig.findUnique({ where: { id: 'main' } })
      if (cfg?.freeTrialEnabled) {
        const trialEndsAt = new Date(Date.now() + cfg.freeTrialDays * 24 * 60 * 60 * 1000)
        await db.user.update({
          where: { id: session.id },
          data: { subscriptionStatus: 'trial', trialEndsAt },
        })
        return Response.json({ ok: true, trialGranted: true })
      }
    }

    // Full subscription request path — validate everything.
    if (!PLANS.has(plan)) {
      return Response.json({ error: 'Invalid plan. Use monthly, yearly or lifetime.' }, { status: 400 })
    }
    if (!paymentReference) {
      return Response.json({ error: 'Payment reference is required' }, { status: 400 })
    }
    if (paymentReference.length > 120) {
      return Response.json({ error: 'Payment reference must be at most 120 characters' }, { status: 400 })
    }

    let bankName = ''
    if (bankAccountId) {
      const bank = await db.bankAccount.findUnique({ where: { id: bankAccountId } })
      if (bank) bankName = bank.bankName
    }

    let proofData = ''
    let proofFileName = ''
    if (proof) {
      if (!ALLOWED_PROOF_MIMES.has(proof.type)) {
        return Response.json(
          { error: 'Proof file must be PNG, JPG or PDF' },
          { status: 400 }
        )
      }
      if (proof.size > MAX_PROOF_BYTES) {
        return Response.json({ error: 'Proof file exceeds the 8MB size limit' }, { status: 400 })
      }
      const proofBuffer = Buffer.from(await proof.arrayBuffer())
      proofData = `data:${proof.type};base64,${proofBuffer.toString('base64')}`
      proofFileName = proof.name || 'proof'
    }

    await db.subscriptionRequest.create({
      data: {
        userId: session.id,
        plan,
        bankAccountId,
        bankName,
        paymentReference: clampString(paymentReference, 120),
        note: clampString(note, 1000),
        proofData,
        proofFileName,
        status: 'pending',
      },
    })

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[subscription/request/POST]', err)
    return Response.json({ error: 'Failed to submit subscription request' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await getSessionUser()
    if (!session) return unauthorized()

    const requests = await db.subscriptionRequest.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return Response.json({ requests: requests.map(toRequestJson) })
  } catch (err) {
    console.error('[subscription/request/GET]', err)
    return Response.json({ error: 'Failed to load subscription requests' }, { status: 500 })
  }
}
