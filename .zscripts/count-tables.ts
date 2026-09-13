import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const counts = {
    users: await db.user.count(),
    customers: await db.customer.count(),
    products: await db.product.count(),
    variants: await db.productVariant.count(),
    categories: await db.category.count(),
    brands: await db.brand.count(),
    orders: await db.order.count(),
    orderItems: await db.orderItem.count(),
    payments: await db.payment.count(),
    shipments: await db.shipment.count(),
    returns: await db.returnRequest.count(),
    refunds: await db.refund.count(),
    invoices: await db.invoice.count(),
    movements: await db.stockMovement.count(),
    reservations: await db.stockReservation.count(),
    balances: await db.inventoryBalance.count(),
    warehouses: await db.warehouse.count(),
    zones: await db.shippingZone.count(),
    methods: await db.shippingMethod.count(),
    payAccounts: await db.paymentAccount.count(),
    payMethods: await db.paymentMethod.count(),
    banks: await db.bankAccount.count(),
    bankTx: await db.bankTransaction.count(),
    suppliers: await db.supplier.count(),
    purchases: await db.purchase.count(),
    supplierPays: await db.supplierPayment.count(),
    coupons: await db.coupon.count(),
    redemptions: await db.couponRedemption.count(),
    expenses: await db.expense.count(),
    banners: await db.banner.count(),
    sections: await db.homeSection.count(),
    pages: await db.contentPage.count(),
    reviews: await db.review.count(),
    favorites: await db.favorite.count(),
    tickets: await db.supportTicket.count(),
    messages: await db.supportMessage.count(),
    notifications: await db.notification.count(),
    audit: await db.auditLog.count(),
    flags: await db.featureFlag.count(),
    settings: await db.appSetting.count(),
    appVersions: await db.appVersion.count(),
    sessions: await db.userSession.count(),
    addresses: await db.customerAddress.count(),
    maintenance: await db.maintenanceWindow.count(),
  };
  console.table(counts);
  const integrity = await db.$queryRawUnsafe<{ integrity_check: string }[]>("PRAGMA integrity_check;");
  console.log("DB integrity:", integrity[0]?.integrity_check);
}
main().finally(() => db.$disconnect());
