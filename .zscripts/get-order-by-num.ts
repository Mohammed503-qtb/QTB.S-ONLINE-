import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const o = await db.order.findFirst({ where: { orderNumber: process.argv[2] } });
  console.log(o?.id ?? '');
}
main().finally(() => db.$disconnect());
