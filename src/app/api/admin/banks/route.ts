import { z } from 'zod'
import { forbidden, getAdminUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { clampString, notFound, toBankJson } from '@/lib/server/api-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_STR = 2000

const createSchema = z.object({
  bankName: z.string().trim().min(1, 'Bank name is required').max(200),
  accountName: z.string().trim().min(1, 'Account name is required').max(200),
  accountNumber: z.string().trim().min(1, 'Account number is required').max(120),
  iban: z.string().trim().max(120).optional(),
  swiftCode: z.string().trim().max(60).optional(),
  currency: z.string().trim().max(10).optional(),
  instructions: z.string().trim().max(MAX_STR).optional(),
  iconSvg: z.string().max(MAX_STR).optional(),
})

const updateSchema = createSchema.partial().extend({
  id: z.string().min(1),
  active: z.boolean().optional(),
})

export async function GET() {
  try {
    const admin = await getAdminUser()
    if (!admin) return forbidden('Admin access required')

    const banks = await db.bankAccount.findMany({ orderBy: { createdAt: 'desc' } })
    return Response.json({ banks: banks.map(toBankJson) })
  } catch (err) {
    console.error('[admin/banks/GET]', err)
    return Response.json({ error: 'Failed to load bank accounts' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getAdminUser()
    if (!admin) return forbidden('Admin access required')

    const body: unknown = await request.json().catch(() => null)
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input'
      return Response.json({ error: message }, { status: 400 })
    }

    const d = parsed.data
    const bank = await db.bankAccount.create({
      data: {
        bankName: clampString(d.bankName, 200),
        accountName: clampString(d.accountName, 200),
        accountNumber: clampString(d.accountNumber, 120),
        iban: clampString(d.iban ?? '', 120),
        swiftCode: clampString(d.swiftCode ?? '', 60),
        currency: clampString(d.currency ?? 'USD', 10),
        instructions: clampString(d.instructions ?? '', MAX_STR),
        iconSvg: clampString(d.iconSvg ?? '', MAX_STR),
      },
    })

    return Response.json({ bank: toBankJson(bank) }, { status: 201 })
  } catch (err) {
    console.error('[admin/banks/POST]', err)
    return Response.json({ error: 'Failed to create bank account' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await getAdminUser()
    if (!admin) return forbidden('Admin access required')

    const body: unknown = await request.json().catch(() => null)
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input'
      return Response.json({ error: message }, { status: 400 })
    }

    const { id, active, ...fields } = parsed.data
    const existing = await db.bankAccount.findUnique({ where: { id } })
    if (!existing) return notFound('Bank account not found')

    const data: Record<string, string | boolean> = {}
    if (fields.bankName !== undefined) data.bankName = clampString(fields.bankName, 200)
    if (fields.accountName !== undefined) data.accountName = clampString(fields.accountName, 200)
    if (fields.accountNumber !== undefined) data.accountNumber = clampString(fields.accountNumber, 120)
    if (fields.iban !== undefined) data.iban = clampString(fields.iban, 120)
    if (fields.swiftCode !== undefined) data.swiftCode = clampString(fields.swiftCode, 60)
    if (fields.currency !== undefined) data.currency = clampString(fields.currency, 10)
    if (fields.instructions !== undefined) data.instructions = clampString(fields.instructions, MAX_STR)
    if (fields.iconSvg !== undefined) data.iconSvg = clampString(fields.iconSvg, MAX_STR)
    if (typeof active === 'boolean') data.active = active

    if (Object.keys(data).length === 0) {
      return Response.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const bank = await db.bankAccount.update({ where: { id }, data })
    return Response.json({ bank: toBankJson(bank) })
  } catch (err) {
    console.error('[admin/banks/PUT]', err)
    return Response.json({ error: 'Failed to update bank account' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await getAdminUser()
    if (!admin) return forbidden('Admin access required')

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return Response.json({ error: 'id query parameter is required' }, { status: 400 })

    const existing = await db.bankAccount.findUnique({ where: { id } })
    if (!existing) return notFound('Bank account not found')

    await db.bankAccount.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[admin/banks/DELETE]', err)
    return Response.json({ error: 'Failed to delete bank account' }, { status: 500 })
  }
}
