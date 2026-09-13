import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const o = await db.order.findFirst({ where: { trackingCode: { not: null }, status: 'DELIVERED' } });
  console.log(o?.trackingCode ?? o?.orderNumber ?? '');
}
main().finally(() => db.$disconnect());
