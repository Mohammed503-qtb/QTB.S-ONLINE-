import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const m = await db.stockMovement.findFirst({ where: { refId: process.argv[2], movementType: 'SALE' } });
  console.log(m ? 'SALE_OK' : 'NO_SALE');
}
main().finally(() => db.$disconnect());
