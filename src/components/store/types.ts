// ============================================================
// أنواع بيانات واجهة العميل — مطابقة لعقد API (docs/frontend-brief.md)
// TypeScript صارم — لا any
// ============================================================

// ---------- الكتالوج ----------
export type Category = { id: string; name: string; slug: string; imageUrl?: string | null }
export type Brand = { id: string; name: string; slug: string }

export type HomeVariant = {
  id: string
  attributesJson?: string | null
  priceOverride: number | null
  discountPercent: number | null
  imageUrl: string | null
  active: boolean
}

export type HomeProduct = {
  id: string
  name: string
  slug: string
  basePrice: number
  compareAtPrice: number | null
  imageUrl: string | null
  salesCount?: number
  categoryId?: string
  variants?: HomeVariant[]
}

export type Banner = {
  id: string
  title: string | null
  subtitle: string | null
  imageUrl: string
  actionType: string // NONE | CATEGORY | PRODUCT | PAGE
  target: string | null
}

export type HomeSection = {
  id: string
  type: string // BANNER | CATEGORIES | FEATURED | BEST_SELLERS | NEW_ARRIVALS | OFFERS | BRANDS | CUSTOM
  title: string | null
  active: boolean
  sortOrder: number
}

export type ShippingMethod = {
  id: string
  code: string
  name: string
  description: string
  baseFee: number
  etaNote: string | null
  active: boolean
}

export type HomeData = {
  flags: Record<string, boolean>
  banners: Banner[]
  sections: HomeSection[]
  categories: Category[]
  shippingMethods: ShippingMethod[]
  products: Record<'FEATURED' | 'OFFERS' | 'NEW_ARRIVALS' | 'BEST_SELLERS', HomeProduct[]>
}

export type CatalogProduct = {
  id: string
  name: string
  slug: string
  basePrice: number
  compareAtPrice: number | null
  imageUrl: string | null
  salesCount?: number
  available: number
  category?: { name: string; slug: string } | null
  brand?: { name: string; slug: string } | null
  variants: HomeVariant[]
}

export type CatalogListResult = {
  total: number
  page: number
  pages: number
  products: CatalogProduct[]
}

export type ProductVariant = {
  id: string
  attributes: Record<string, string>
  price: number
  discountPercent: number | null
  imageUrl: string | null
  available: number
}

export type Review = {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  customerName: string
}

export type ProductDetail = {
  product: {
    id: string
    name: string
    slug: string
    description: string | null
    basePrice: number
    compareAtPrice: number | null
    imageUrl: string | null
    images: { url: string; alt: string | null }[]
    category: { name: string; slug: string } | null
    brand: { name: string; slug: string } | null
    salesCount: number
  }
  variants: ProductVariant[]
  reviews: Review[]
  reviewsSummary: { count: number; average: number }
  related: {
    id: string
    name: string
    basePrice: number
    compareAtPrice: number | null
    imageUrl: string | null
    slug: string
  }[]
}

export type FavoriteProduct = {
  id: string
  name: string
  basePrice: number
  compareAtPrice: number | null
  imageUrl: string | null
  slug: string
  variants: { id: string; priceOverride: number | null; discountPercent: number | null }[]
}

// ---------- السلة والدفع ----------
export type QuoteLineItem = {
  productId: string
  variantId: string
  productName: string
  attributes: Record<string, string>
  imageUrl: string | null
  unitPrice: number
  comparePrice: number | null
  discountPercent: number
  quantity: number
  lineTotal: number
  active: boolean
  available: number
}

export type QuoteResult = {
  items: QuoteLineItem[]
  itemsTotal: number
  discountTotal: number
  couponCode?: string
  couponDiscount: number
  shippingFee: number
  grandTotal: number
  currency: string
  warnings: string[]
}

export type PaymentAccount = {
  id: string
  type: string // BANK | WALLET | OTHER
  name: string
  institution: string
  beneficiary: string
  accountNumber: string
  iban: string | null
  walletNumber: string | null
  phone: string | null
  branch: string | null
  instructions: string
}

export type CouponValidateResult = {
  code: string
  type: string
  value: number
  discount: number
  label: string
}

// ---------- العناوين ----------
export type Address = {
  id: string
  label: string
  governorate: string
  city: string
  district?: string | null
  neighborhood?: string | null
  street?: string | null
  landmark?: string | null
  phone: string
  notes?: string | null
  isDefault: boolean
  createdAt: string
}

// ---------- الطلبات ----------
export type OrderListItem = {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  grandTotal: number
  trackingCode: string
  paymentReference: string
  createdAt: string
  placedAt: string | null
  items: { productName: string; quantity: number; imageUrl: string | null; lineTotal: number }[]
  payments?: { paymentNumber: string; status: string; expectedAmount: number; paidAmount: number }[]
}

export type OrdersListResult = {
  total: number
  page: number
  orders: OrderListItem[]
}

export type OrderTimelineEvent = {
  type: string
  at: string
  data?: Record<string, unknown>
}

export type OrderDetailsResult = {
  order: {
    id: string
    orderNumber: string
    status: string
    paymentStatus: string
    itemsTotal: number
    discountTotal: number
    couponCode: string | null
    shippingFee: number
    grandTotal: number
    currency: string
    shippingMethod: string
    paymentMethod: string
    paymentReference: string
    trackingCode: string
    customerNote: string | null
    placedAt: string | null
    confirmedAt: string | null
    shippedAt: string | null
    deliveredAt: string | null
    completedAt: string | null
    cancelledAt: string | null
    cancelReason: string | null
  }
  address: Partial<Address>
  items: {
    id: string
    productName: string
    attributes: Record<string, string>
    imageUrl: string | null
    unitPrice: number
    comparePrice: number | null
    discountPercent: number | null
    quantity: number
    lineTotal: number
    productId: string
    variantId: string
  }[]
  timeline: OrderTimelineEvent[]
  statusHistory: { from: string | null; to: string; reason: string | null; note: string | null; at: string }[]
  payment: {
    id: string
    paymentNumber: string
    status: string
    expectedAmount: number
    submittedAmount: number | null
    paidAmount: number
    rejectReason: string | null
    expiresAt: string | null
    proofUrl: string | null
    account: Partial<PaymentAccount> | null
  } | null
  shipment: {
    shipmentNumber: string
    trackingCode: string
    status: string
    provider: string
    shippedAt: string | null
    deliveredAt: string | null
    events: { status: string; note: string | null; at: string }[]
  } | null
  returns: {
    id: string
    returnNumber: string
    status: string
    reason: string
    items: { productName: string; quantity: number }[]
  }[]
  invoice: { invoiceNumber: string; total: number; issuedAt: string } | null
}

export type TrackResult = {
  orderNumber: string
  trackingCode: string
  paymentReference: string
  status: string
  statusLabel: string
  paymentStatus: string
  grandTotal: number
  itemsCount: number
  placedAt: string | null
  timeline: { type: string; at: string }[]
  customerName: string
}

// ---------- الإرجاع ----------
export type ReturnRequest = {
  id: string
  returnNumber: string
  status: string
  reason: string
  customerNote: string | null
  createdAt: string
  order: { orderNumber: string; grandTotal: number }
  items: { productName: string; imageUrl: string | null; unitPrice: number; quantity: number }[]
  refunds: { refundNumber: string; status: string; amount: number }[]
}

// ---------- الإشعارات ----------
export type AppNotification = {
  id: string
  type: string
  title: string
  body: string
  linkView: string | null
  linkParam: string | null
  read: boolean
  createdAt: string
}

// ---------- الدعم ----------
export type SupportMessage = {
  id: string
  senderType: string // CUSTOMER | STAFF
  senderName: string
  body: string
  createdAt: string
}

export type SupportTicket = {
  id: string
  ticketNumber: string
  category: string // ORDER | PAYMENT | RETURN | SHIPPING | OTHER
  subject: string
  status: string
  orderId: string | null
  createdAt: string
  updatedAt: string
  messages: SupportMessage[]
}

// ---------- المحتوى ----------
export type ContentPage = {
  id: string
  slug: string
  title: string
  content: string
}
