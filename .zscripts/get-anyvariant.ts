import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const v = await db.productVariant.findFirst({ where: { active: true } });
  console.log(v?.id ?? '');
}
main().finally(() => db.$disconnect());
