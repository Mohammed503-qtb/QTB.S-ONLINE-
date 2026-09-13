import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const fkOrphans = await db.$queryRawUnsafe<any[]>(`
    SELECT 'OrderItem.variantId' AS rel, COUNT(*) AS cnt FROM OrderItem oi LEFT JOIN ProductVariant v ON oi.variantId = v.id WHERE oi.variantId IS NOT NULL AND v.id IS NULL
    UNION ALL SELECT 'Payment.orderId', COUNT(*) FROM Payment p LEFT JOIN "Order" o ON p.orderId = o.id WHERE p.orderId IS NOT NULL AND o.id IS NULL
    UNION ALL SELECT 'Invoice.orderId', COUNT(*) FROM Invoice i LEFT JOIN "Order" o ON i.orderId = o.id WHERE i.orderId IS NOT NULL AND o.id IS NULL
    UNION ALL SELECT 'StockMovement.variantId', COUNT(*) FROM StockMovement m LEFT JOIN ProductVariant v ON m.variantId = v.id WHERE m.variantId IS NOT NULL AND v.id IS NULL
    UNION ALL SELECT 'BankTransaction.bankAccountId', COUNT(*) FROM BankTransaction t LEFT JOIN BankAccount b ON t.bankAccountId = b.id WHERE t.bankAccountId IS NOT NULL AND b.id IS NULL
    UNION ALL SELECT 'Order.customerId', COUNT(*) FROM "Order" od LEFT JOIN Customer c ON od.customerId = c.id WHERE od.customerId IS NOT NULL AND c.id IS NULL
  `);
  const orphansBad = fkOrphans.filter(r => r.cnt > 0).length;
  
  const openResForCancelled = await db.stockReservation.count({ where: { status: 'ACTIVE', order: { status: 'CANCELLED' } } });
  
  // دفعة VERIFIED تحتاج أثراً بنكياً: بمرجع الدفعة (تحويل) أو بمرجع الطلب (COD)
  const verifiedPays = await db.payment.findMany({ where: { status: 'VERIFIED' }, include: { order: { select: { id: true, orderNumber: true } } } });
  let missingTx = 0;
  for (const p of verifiedPays) {
    const found = await db.bankTransaction.findFirst({
      where: { OR: [{ refId: p.id }, { refNumber: p.paymentNumber }, { refId: p.order.id }, { refNumber: p.order.orderNumber }] },
    });
    if (!found) { missingTx++; console.log('  ❌ بلا أثر:', p.paymentNumber, '→', p.order.orderNumber); }
  }
  
  const confirmedStatuses = ['CONFIRMED','STOCK_RESERVED','PROCESSING','PICKED','PACKED','READY_TO_SHIP','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','COMPLETED'];
  const confirmedOrders = await db.order.findMany({ where: { status: { in: confirmedStatuses } }, select: { id: true, orderNumber: true } });
  let missingInv = 0;
  for (const o of confirmedOrders) {
    const inv = await db.invoice.findFirst({ where: { orderId: o.id } });
    if (!inv) { missingInv++; console.log('  ❌ طلب بلا فاتورة:', o.orderNumber); }
  }
  
  const negative = await db.inventoryBalance.count({ where: { OR: [{ onHand: { lt: 0 } }, { reserved: { lt: 0 } }] } });
  
  // اتساق أرصدة البنوك: الرصيد المعروض = مجموع الحركات (بما يطابق مبدأ الرصيد المشتق)
  const banks = await db.bankAccount.findMany({ include: { transactions: true } });
  let bankDrift = 0;
  for (const b of banks) {
    const derived = b.transactions.reduce((acc, t) => acc + (t.direction === 'IN' ? t.amount : -t.amount), 0) + (b.openingBalance ?? 0);
    if (derived !== b.currentBalance) { bankDrift++; console.log(`  ❌ انحراف بنكي ${b.accountName}: معروض=${b.currentBalance} مشتق=${derived}`); }
  }
  
  console.log(`يتامى مرجعيون: ${orphansBad === 0 ? '✓' : '⚠️ ' + orphansBad} | حجوزات مسربة: ${openResForCancelled === 0 ? '✓ 0' : '⚠️ ' + openResForCancelled} | دفعات بلا أثر بنكي: ${missingTx}/${verifiedPays.length} ${missingTx === 0 ? '✓' : '⚠️'} | طلبات بلا فاتورة: ${missingInv}/${confirmedOrders.length} ${missingInv === 0 ? '✓' : '⚠️'} | أرصدة سالبة: ${negative} ✓ | انحراف بنكي: ${bankDrift}/${banks.length} ${bankDrift === 0 ? '✓' : '⚠️'}`);
  const bad = orphansBad + (openResForCancelled > 0 ? 1 : 0) + (missingTx > 0 ? 1 : 0) + (missingInv > 0 ? 1 : 0) + (negative > 0 ? 1 : 0) + (bankDrift > 0 ? 1 : 0);
  console.log(bad === 0 ? '✅ كل فحوصات السلامة المرجعية والمحاسبية ناجحة' : `⚠️ فئات مشكلات: ${bad}`);
}
main().finally(() => db.$disconnect());
