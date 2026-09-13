import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const b = await db.inventoryBalance.findFirst({ where: { variantId: process.argv[2] }, orderBy: { warehouseId: 'asc' } });
  console.log(b ? `onHand=${b.onHand} reserved=${b.reserved}` : 'NOT_FOUND');
}
main().finally(() => db.$disconnect());
