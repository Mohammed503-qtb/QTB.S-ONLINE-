import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const o = await db.order.findFirst({ where: { status: { in: ['DELIVERED','COMPLETED'] } }, include: { items: true, customer: true } });
  if (!o) { console.log('None|None'); return; }
  const item = o.items[0];
  console.log(`${item.productId}|${o.id}`);
}
main().finally(() => db.$disconnect());
