import { db } from '@/lib/db'
import { toBankJson } from '@/lib/server/api-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const banks = await db.bankAccount.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
    })
    return Response.json({ banks: banks.map(toBankJson) })
  } catch (err) {
    console.error('[banks/GET]', err)
    return Response.json({ error: 'Failed to load bank accounts' }, { status: 500 })
  }
}
