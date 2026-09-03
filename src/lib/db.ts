import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  seeded: boolean | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

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
        const hashed = await bcrypt.hash(seedPassword, 10)
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
