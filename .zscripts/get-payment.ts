import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const p = await db.payment.findFirst({ where: { orderId: process.argv[2] }, orderBy: { createdAt: 'desc' } });
  console.log(p ? p.id : 'NO_PAYMENT');
}
main().finally(() => db.$disconnect());
