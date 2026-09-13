import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const inv = await db.invoice.findFirst({ where: { orderId: process.argv[2] } });
  console.log(inv ? inv.invoiceNumber : 'NONE');
}
main().finally(() => db.$disconnect());
