import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const os = await db.order.findMany({ select: { orderNumber: true, status: true, trackingCode: true }, orderBy: { createdAt: 'desc' }, take: 12 });
  for (const o of os) console.log(`${o.orderNumber} | ${o.status.padEnd(20)} | ${(o.trackingCode ?? '—')}`);
}
main().finally(() => db.$disconnect());
