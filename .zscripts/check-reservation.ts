import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const r = await db.stockReservation.findFirst({ where: { orderId: process.argv[2] }, orderBy: { createdAt: 'desc' } });
  console.log(r ? `RESERVED:${r.quantity}` : 'NO_RESERVATION');
}
main().finally(() => db.$disconnect());
