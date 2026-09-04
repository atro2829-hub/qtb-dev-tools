import { PrismaClient } from '@/generated/prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { hashPassword } from '@/lib/server/password'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  seeded: boolean | undefined
}

function createClient(): PrismaClient {
  // On Cloudflare Workers the SQLite file does not exist — bind Prisma to D1.
  try {
    const { env } = getCloudflareContext()
    const d1 = (env as { DB?: unknown }).DB
    if (d1) {
      return new PrismaClient({
        adapter: new PrismaD1(d1 as Parameters<typeof PrismaD1>[0]),
        log: ['error', 'warn'],
      })
    }
  } catch {
    // No Cloudflare context — local Node/Bun dev against the file database.
  }
  // Local dev: the queryCompiler client (engineType "client") always needs a
  // driver adapter — libsql (N-API safe across isolates) against the local file.
  return new PrismaClient({
    log: ['error', 'warn'],
    adapter: new PrismaLibSQL({
      url: process.env.DATABASE_URL ?? 'file:./db/custom.db',
    }),
  })
}

function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient()
  return globalForPrisma.prisma
}

/**
 * Lazy proxy: `db.user.findUnique(...)` resolves the real client on first
 * access — safely inside a request — instead of at module-eval time (where
 * the Cloudflare context may not exist yet, e.g. during build).
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const real = getDb()
    const value = Reflect.get(real as object, prop, real)
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value
  },
})

/**
 * Ensures the database has the required baseline rows:
 * - Super Admin account (admin@qutaibiv.com)
 * - SiteConfig singleton (main)
 */
export async function ensureSeed(): Promise<void> {
  if (globalForPrisma.seeded) return
  globalForPrisma.seeded = true

  try {
    await db.siteConfig.upsert({
      where: { id: 'main' },
      update: {},
      create: { id: 'main' },
    })

    const superAdminEmail = 'admin@qutaibiv.com'
    const existing = await db.user.findUnique({ where: { email: superAdminEmail } })
    if (!existing) {
      // SECURITY: the super-admin password comes from the SEED_ADMIN_PASSWORD env var.
      // It is NOT hardcoded — a fresh deployment without the env var gets a disabled
      // account whose password must be set via SEED_ADMIN_PASSWORD before first boot.
      const seedPassword = process.env.SEED_ADMIN_PASSWORD
      if (!seedPassword || seedPassword.length < 8) {
        console.error(
          '[seed] SEED_ADMIN_PASSWORD is not set (min 8 chars). Super Admin account NOT created.'
        )
      } else {
        const hashed = await hashPassword(seedPassword)
        await db.user.create({
          data: {
            email: superAdminEmail,
            password: hashed,
            name: 'Mohammed AL-QUTAIBI',
            role: 'super_admin',
            subscriptionStatus: 'active',
            profileComplete: true,
          },
        })
        console.log('[seed] Super Admin created: admin@qutaibiv.com')
      }
    }

    // ensure at least one bank account placeholder exists for demo purposes
    const banks = await db.bankAccount.count()
    if (banks === 0) {
      await db.bankAccount.create({
        data: {
          bankName: 'QTB National Bank',
          accountName: 'QTB DEV',
          accountNumber: '0000 0000 0000',
          iban: '',
          swiftCode: '',
          currency: 'USD',
          instructions:
            'Transfer the subscription amount to the account above, then submit your payment reference. (Placeholder bank — edit from Admin → Bank Accounts.)',
          iconSvg: '<path d="M3 10h18M5 10V7l7-4 7 4v3M6 10v8m4-8v8m4-8v8m4-8v8M4 20h16" />',
        },
      })
    }
  } catch (err) {
    globalForPrisma.seeded = false
    console.error('[seed] failed:', err)
  }
}
