// ============================================================
// أنواع مشتركة لواجهة الإدارة — مطابقة لعقد API (docs/frontend-brief.md)
// 'use client' غير مطلوب: ملف أنواع فقط
// ============================================================

import type { Role } from '@/lib/shared/constants'

export type StatusCounts = Record<string, number>

export type PagedInfo = { total: number; page: number; pages: number }

export type UserLite = { id: string; name: string; phone: string; email?: string | null; role?: Role; status?: string }

export type OrderCustomerRef = { user: { name: string; phone: string; email?: string | null } }

// ---------- الطلبات ----------
export type OrderItemMini = { productName: string; quantity: number; imageUrl?: string | null; unitPrice?: number; lineTotal?: number }

export type OrderRow = {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  itemsTotal: number
  discountTotal: number
  shippingFee: number
  grandTotal: number
  paymentMethod: string
  shippingMethod: string
  paymentReference?: string | null
  trackingCode?: string | null
  couponCode?: string | null
  customerNote?: string | null
  adminNote?: string | null
  version?: number
  placedAt: string
  createdAt: string
  updatedAt: string
  cancelledAt?: string | null
  cancelReason?: string | null
  customer?: OrderCustomerRef | null
  items?: OrderItemMini[]
}

export type OrderItemRow = {
  id: string
  productName: string
  skuSnapshot?: string | null
  attributesJson: string
  imageUrl?: string | null
  unitPrice: number
  comparePrice?: number | null
  discountPercent?: number
  quantity: number
  lineTotal: number
}

export type StatusHistoryRow = {
  id: string
  fromStatus?: string | null
  toStatus: string
  changedById?: string | null
  reason?: string | null
  note?: string | null
  createdAt: string
}

export type MovementLinkedRow = {
  id: string
  movementType: string
  quantityDelta: number
  refType?: string | null
  refNumber?: string | null
  reason?: string | null
  balanceAfter?: number | null
  createdAt: string
  variant: { sku?: string | null; product: { name: string } }
  warehouse: { name: string }
}

export type ShipmentRow = {
  id: string
  shipmentNumber: string
  trackingCode: string
  methodName: string
  providerName: string
  fee: number
  status: string
  codCollected: number
  shippedAt?: string | null
  deliveredAt?: string | null
  createdAt: string
  events: { id: string; status: string; note?: string | null; createdAt: string }[]
  attempts: { id: string; status: string; reason?: string | null; createdAt: string }[]
}

export type InvoiceRow = { id: string; invoiceNumber: string; total: number; issuedAt: string }

export type OrderDetailResponse = {
  order: Omit<OrderRow, 'items'> & {
    items: OrderItemRow[]
    statusHistory: StatusHistoryRow[]
    events: { id: string; type: string; dataJson: string; createdAt: string }[]
    payments: PaymentRow[]
    shipments: ShipmentRow[]
    returnRequests: {
      id: string
      returnNumber: string
      status: string
      reason: string
      createdAt: string
      items: { quantity: number; orderItem: { productName: string } }[]
      refunds: { refundNumber: string; status: string; amount: number; method: string }[]
    }[]
    invoice: InvoiceRow | null
    reservations: { id: string; variantId: string; warehouseId: string; quantity: number; status: string; createdAt: string }[]
    customer: OrderCustomerRef
  }
  address: {
    label?: string
    governorate?: string
    city?: string
    district?: string
    neighborhood?: string
    street?: string
    landmark?: string
    phone?: string
    notes?: string | null
  }
  nextStatuses: string[]
  movements: MovementLinkedRow[]
  changedByNames: Record<string, string>
}

// ---------- المدفوعات ----------
export type PaymentRow = {
  id: string
  paymentNumber: string
  status: string
  expectedAmount: number
  submittedAmount?: number | null
  paidAmount: number
  refundedAmount?: number | null
  overpayment?: number | null
  riskFlags: string
  customerTransferRef?: string | null
  transferDate?: string | null
  senderName?: string | null
  proofUrl?: string | null
  notes?: string | null
  submittedAt?: string | null
  verifiedAt?: string | null
  rejectReason?: string | null
  createdAt: string
  order?: {
    id: string
    orderNumber: string
    grandTotal: number
    status: string
    customer?: { user: { name: string; phone: string } } | null
  } | null
}

export type PaymentEventRow = { id: string; type: string; dataJson: string; actorId?: string | null; createdAt: string }

export type PaymentDetailResponse = {
  payment: PaymentRow & { events: PaymentEventRow[]; orderId: string }
  order: { id: string; orderNumber: string; grandTotal: number; status: string; items: OrderItemRow[] }
  customer: { name: string; phone: string }
  account: { name?: string; institution?: string; accountNumber?: string; beneficiary?: string } | null
  events: PaymentEventRow[]
  actorNames: Record<string, string>
  bankTxns: { id: string; txnNumber: string; direction: string; amount: number; txnType: string; description: string; date: string }[]
  duplicateOf?: { paymentNumber: string; status: string; orderId: string } | null
  banks: { id: string; name: string; institution: string }[]
}

// ---------- المنتجات ----------
export type ProductVariantRow = {
  id: string
  attributesJson?: string
  attributes?: Record<string, string>
  sku?: string | null
  priceOverride?: number | null
  costOverride?: number | null
  discountPercent: number
  imageUrl?: string | null
  active: boolean
  sortOrder: number
  available?: number
}

export type ProductRow = {
  id: string
  name: string
  slug: string
  description: string
  categoryId: string
  brandId?: string | null
  category?: { name: string; slug: string } | null
  brand?: { name: string; slug: string } | null
  basePrice: number
  compareAtPrice?: number | null
  costPrice?: number | null
  sku?: string | null
  status: string
  imageUrl?: string | null
  isFeatured: boolean
  sortOrder: number
  salesCount?: number
  variants: ProductVariantRow[]
  totalAvailable?: number
}

export type CategoryRow = {
  id: string
  name: string
  slug: string
  imageUrl?: string | null
  sortOrder: number
  active: boolean
  _count?: { products: number }
}

export type BrandRow = {
  id: string
  name: string
  slug: string
  logoUrl?: string | null
  sortOrder: number
  active: boolean
  _count?: { products: number }
}

// ---------- المخزون ----------
export type WarehouseRow = {
  id: string
  name: string
  code?: string | null
  city: string
  isDefault: boolean
  active: boolean
  _count?: { balances: number; movements: number; purchases: number }
}

export type InventoryRow = {
  id: string
  variantId: string
  warehouseId: string
  onHand: number
  reserved: number
  reorderLevel: number
  available: number
  attributes: Record<string, string>
  variant: { sku: string | null; product: { id: string; name: string; imageUrl: string | null; basePrice: number; status: string } }
  warehouse: { id: string; name: string }
}

export type MovementRow = {
  id: string
  movementType: string
  quantityDelta: number
  refType?: string | null
  refNumber?: string | null
  reason?: string | null
  balanceAfter?: number | null
  createdAt: string
  attributes: Record<string, string>
  productName: string
  warehouse: { name: string }
}

// ---------- المشتريات والموردون ----------
export type SupplierRow = {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  active: boolean
  balance: number
  createdAt: string
  _count?: { purchases: number }
  totalPurchases?: number
}

export type SupplierDetail = SupplierRow & {
  purchases: { id: string; purchaseNumber: string; date: string; total: number; paid: number; status: string }[]
  payments: { id: string; amount: number; method: string; date: string; reference?: string | null; note?: string | null }[]
}

export type PurchaseRow = {
  id: string
  purchaseNumber: string
  date: string
  subtotal: number
  total: number
  paid: number
  status: string
  invoiceRef?: string | null
  notes?: string | null
  createdAt: string
  supplier: { id: string; name: string; phone?: string | null }
  warehouse: { id: string; name: string }
  items: { quantity: number; unitCost: number; lineTotal: number; productName: string; attributes: Record<string, string> }[]
}

// ---------- المالية ----------
export type BankAccountRow = {
  id: string
  name: string
  institution: string
  type: string
  accountNumber: string
  beneficiary: string
  openingBalance: number
  currentBalance: number
  active: boolean
  _count?: { transactions: number }
}

export type BankTxnRow = {
  id: string
  txnNumber: string
  bankAccountId: string
  direction: string
  amount: number
  txnType: string
  refType?: string | null
  refNumber?: string | null
  description: string
  date: string
  reconciliationStatus: string
  bankAccount?: { name: string; institution: string } | null
}

export type ExpenseRow = {
  id: string
  expenseNumber: string
  category: string
  description: string
  amount: number
  bankAccountId?: string | null
  date: string
  receiptUrl?: string | null
}

// ---------- المرتجعات والاستردادات ----------
export type ReturnRow = {
  id: string
  returnNumber: string
  status: string
  reason: string
  customerNote?: string | null
  createdAt: string
  order: { id: string; orderNumber: string; grandTotal: number; status: string }
  customer: { user: { name: string; phone: string } }
  items: { quantity: number; orderItem: { productName: string; imageUrl?: string | null; unitPrice: number; quantity: number } }[]
  refunds: { id: string; refundNumber: string; status: string; amount: number; method: string }[]
}

export type RefundRow = {
  id: string
  refundNumber: string
  status: string
  amount: number
  method: string
  reason?: string | null
  bankAccountId?: string | null
  createdAt: string
  completedAt?: string | null
  order?: { orderNumber: string; grandTotal: number } | null
  returnRequest?: { returnNumber: string; status: string } | null
}

// ---------- التسويق والمحتوى ----------
export type CouponRow = {
  id: string
  code: string
  type: string
  value: number
  minCart: number
  maxDiscount?: number | null
  usageLimit?: number | null
  usedCount: number
  perCustomerLimit: number
  startsAt: string
  endsAt?: string | null
  appliesTo: string
  targetsJson?: string
  active: boolean
  _count?: { redemptions: number }
}

export type BannerRow = {
  id: string
  title?: string | null
  subtitle?: string | null
  imageUrl: string
  actionType: string
  target?: string | null
  active: boolean
  sortOrder: number
}

export type HomeSectionRow = {
  id: string
  type: string
  title?: string | null
  configJson: string
  active: boolean
  sortOrder: number
}

export type ContentPageRow = {
  id: string
  slug: string
  title: string
  content: string
  published: boolean
  sortOrder: number
  updatedAt: string
}

export type ReviewRow = {
  id: string
  rating: number
  comment?: string | null
  status: string
  createdAt: string
  product: { id: string; name: string; imageUrl?: string | null }
  customer?: { user: { name: string } } | null
}

// ---------- العملاء والدعم ----------
export type CustomerRow = {
  id: string
  tier: string
  creditBalance: number
  totalSpent: number
  ordersCount: number
  createdAt: string
  user: { name: string; phone: string; email?: string | null; status: string; createdAt: string }
  _count?: { orders: number; returnRequests: number; tickets: number }
}

export type CustomerOrderMini = { id: string; orderNumber: string; status: string; paymentStatus: string; grandTotal: number; createdAt: string; trackingCode?: string | null }
export type CustomerRefundMini = { refundNumber: string; status: string; amount: number; method: string; createdAt: string }
export type CustomerPaymentMini = { paymentNumber: string; status: string; expectedAmount: number; paidAmount: number; createdAt: string }
export type CustomerReturnMini = { returnNumber: string; status: string; reason: string; createdAt: string }
export type CustomerReviewMini = { id: string; rating: number; comment?: string | null; createdAt: string; product: { name: string } }

export type CustomerDetailResponse = {
  customer: CustomerRow & {
    user: { id: string; name: string; phone: string; email?: string | null; status: string; role: string; createdAt: string; lastLoginAt?: string | null }
    ordersTotal: number
    ordersCount: number
    cancellations: number
    addresses: {
      id: string
      label: string
      governorate: string
      city: string
      district?: string
      neighborhood?: string
      street?: string
      landmark?: string
      phone: string
      notes?: string | null
      isDefault: boolean
    }[]
    favorites: { id: string; product: { name: string } }[]
  }
  orders: CustomerOrderMini[]
  payments: CustomerPaymentMini[]
  returns: CustomerReturnMini[]
  refunds: CustomerRefundMini[]
  reviews: CustomerReviewMini[]
}

export type TicketRow = {
  id: string
  ticketNumber: string
  subject: string
  category: string
  status: string
  orderId?: string | null
  createdAt: string
  updatedAt: string
  customer?: { user: { name: string; phone: string } } | null
  messages?: { body: string; createdAt: string; senderType: string; senderName: string }[]
}

export type TicketMessageRow = { id: string; senderType: string; senderName: string; body: string; createdAt: string }

export type TicketDetailResponse = Omit<TicketRow, 'messages'> & {
  messages: TicketMessageRow[]
}

// ---------- النظام ----------
export type AdminUserRow = {
  id: string
  name: string
  phone: string
  email?: string | null
  role: string
  status: string
  lastLoginAt?: string | null
  createdAt: string
  sessions: { id: string; lastActiveAt: string; ip?: string | null }[]
}

export type AuditRow = {
  id: string
  action: string
  entityType: string
  entityId: string
  reason?: string | null
  ip?: string | null
  createdAt: string
  actorId?: string | null
  actorRole?: string | null
  oldValues: unknown
  newValues: unknown
  actor?: { name: string; role: string } | null
}

export type FeatureFlagRow = { key: string; value: boolean; label: string; reason?: string | null; updatedAt: string }
export type SettingRow = { key: string; value: string; group: string; label: string; updatedAt: string }
export type VersionRow = {
  id: string
  platform: string
  versionName: string
  buildNumber: number
  minimumSupported: boolean
  isLatest: boolean
  releaseNotes: string
  mandatory: boolean
  createdAt: string
}
export type MaintenanceRow = { id: string; message: string; startsAt: string; endsAt?: string | null; active: boolean }

export type AppControlResponse = {
  flags: FeatureFlagRow[]
  settings: SettingRow[]
  versions: VersionRow[]
  maintenance: MaintenanceRow[]
  stats: { users: number; orders: number; products: number; payments: number; auditLogs: number; notifications: number; movements: number }
}

// ---------- لوحة المعلومات والعمليات ----------
export type DashboardResponse = {
  today: { orders: number; sales: number; collected: number; expenses: number; net: number }
  queues: { pendingPayments: number; reviewPayments: number; processingOrders: number; shippingOrders: number; pendingReturns: number; lowStock: number }
  totals: { customers: number; activeProducts: number; orders7d: number }
  banks: { name: string; currentBalance: number; institution: string; type: string }[]
  salesByDay: { day: string; total: number; count: number }[]
}

export type OperationsResponse = {
  payments: {
    id: string
    paymentNumber: string
    status: string
    expectedAmount: number
    submittedAmount?: number | null
    riskFlags: string
    submittedAt?: string | null
    order: { id: string; orderNumber: string }
    customer: { name: string; phone: string }
  }[]
  orderIssues: { id: string; orderNumber: string; status: string; paymentStatus: string; grandTotal: number }[]
  lowStock: { variantId: string; product: string; image?: string | null; attributes: Record<string, string>; warehouse: string; onHand: number; reserved: number; reorderLevel: number }[]
  returns: { id: string; returnNumber: string; status: string; reason: string; createdAt: string; orderNumber: string }[]
  failedDeliveries: { id: string; trackingCode: string; status: string; orderNumber: string; customer: { name: string; phone: string } }[]
  tickets: { id: string; ticketNumber: string; subject: string; status: string; createdAt: string }[]
}

// ---------- البحث الشامل ----------
export type SearchResponse = {
  query: string
  orders: { id: string; orderNumber: string; status: string; paymentStatus: string; grandTotal: number; trackingCode?: string | null; paymentReference?: string | null; customer?: { user: { name: string } } | null }[]
  payments: { id: string; paymentNumber: string; status: string; expectedAmount: number; submittedAmount?: number | null; order: { orderNumber: string } }[]
  customers: { id: string; user: { name: string; phone: string } }[]
  products: { id: string; name: string; basePrice: number; status: string; imageUrl?: string | null }[]
  returns: { id: string; returnNumber: string; status: string; order: { orderNumber: string } }[]
  shipments: { id: string; trackingCode: string; status: string; order: { orderNumber: string } }[]
}
