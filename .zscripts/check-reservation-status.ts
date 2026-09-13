import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const r = await db.stockReservation.findFirst({ where: { orderId: process.argv[2] }, orderBy: { createdAt: 'desc' } });
  console.log(!r || r.status !== 'ACTIVE' ? 'NO_ACTIVE' : `ACTIVE:${r.quantity}`);
}
main().finally(() => db.$disconnect());
