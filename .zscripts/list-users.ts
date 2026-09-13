import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const users = await db.user.findMany({ select: { phone: true, role: true, name: true } });
  for (const u of users) console.log(`${u.role.padEnd(18)} ${u.phone}  ${u.name}`);
}
main().finally(() => db.$disconnect());
