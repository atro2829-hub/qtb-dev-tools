import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const del = await db.user.deleteMany({ where: { email: { startsWith: 'rltest' } } });
  console.log('deleted test users:', del.count);
}
main().finally(() => db.$disconnect());
