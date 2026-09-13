import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const cs = await db.coupon.findMany();
  for (const c of cs) console.log(`${c.code} | نشط=${c.active} | خصم=${c.discountValue}${c.discountType === 'PERCENT' ? '%' : ' ريال'} | حد أدنى=${c.minCart} | استخدام=${c.usedCount}/${c.usageLimit ?? '∞'}`);
}
main().finally(() => db.$disconnect());
