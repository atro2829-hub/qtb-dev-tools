import { forbidden, getAdminUser } from '@/lib/auth'
import { sbTestConnection } from '@/lib/server/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Admin "Test connection" for the Supabase cloud-storage settings card. */
export async function POST() {
  try {
    const admin = await getAdminUser()
    if (!admin) return forbidden('Admin access required')

    const result = await sbTestConnection()
    return Response.json(result, { status: result.ok ? 200 : 400 })
  } catch (err) {
    console.error('[admin/supabase-test/POST]', err)
    return Response.json({ ok: false, message: 'Test failed' }, { status: 500 })
  }
}
