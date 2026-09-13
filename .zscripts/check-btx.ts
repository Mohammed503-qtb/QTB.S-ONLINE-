import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const tx = await db.bankTransaction.findFirst({ where: { refId: process.argv[2] } });
  console.log(tx ? `${tx.txnNumber}:${tx.amount}` : 'NONE');
}
main().finally(() => db.$disconnect());
