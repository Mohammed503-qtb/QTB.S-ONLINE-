import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const w = await db.warehouse.findFirst({ where: { isDefault: true } });
  console.log(w?.id ?? '');
}
main().finally(() => db.$disconnect());
