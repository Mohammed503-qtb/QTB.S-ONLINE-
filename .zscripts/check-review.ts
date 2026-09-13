import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const r = await db.review.findFirst({ where: { comment: { contains: 'فحص آلي' } } });
  console.log(r ? `REVIEW_EXISTS:${r.status}` : 'NO_REVIEW');
}
main().finally(() => db.$disconnect());
