import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const ms = await db.shippingMethod.findMany();
  console.log('طرق الشحن:');
  for (const m of ms) console.log(`  ${m.code} | ${m.name} | ${m.active ? 'نشط' : 'معطل'}`);
  const zs = await db.shippingZone.findMany({ take: 6 });
  console.log('مناطق الشحن:');
  for (const z of zs) console.log(`  ${z.governorate} = ${z.fee}`);
}
main().finally(() => db.$disconnect());
