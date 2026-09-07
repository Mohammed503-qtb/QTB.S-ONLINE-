// ============================================================
// الثوابت المشتركة — آلات الحالة + الأدوار + الصلاحيات + التسميات
// مشترك بين الواجهة والخادم (isomorphic)
// المرجع: worklog Task 0 — الحالات الموحدة
// ============================================================

// ---------- أدوار المستخدمين ----------
export const ROLES = [
  'SUPER_ADMIN',
  'MANAGER',
  'ACCOUNTANT',
  'WAREHOUSE',
  'CONTENT_MANAGER',
  'DELIVERY_OPERATOR',
  'CUSTOMER',
] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'مدير النظام',
  MANAGER: 'مدير المتجر',
  ACCOUNTANT: 'محاسب',
  WAREHOUSE: 'موظف مستودع',
  CONTENT_MANAGER: 'مدير محتوى',
  DELIVERY_OPERATOR: 'موظف شحن',
  CUSTOMER: 'عميل',
}

export const ADMIN_ROLES: Role[] = [
  'SUPER_ADMIN',
  'MANAGER',
  'ACCOUNTANT',
  'WAREHOUSE',
  'CONTENT_MANAGER',
  'DELIVERY_OPERATOR',
]

// ---------- صلاحيات (PLAN ق44) ----------
export const PERMISSIONS = [
  'orders.view', 'orders.update', 'orders.cancel',
  'payments.view', 'payments.review', 'payments.verify', 'payments.reject',
  'products.create', 'products.update', 'products.archive',
  'categories.manage', 'brands.manage',
  'inventory.view', 'inventory.adjust', 'inventory.transfer',
  'warehouses.manage',
  'purchases.create', 'purchases.view', 'suppliers.manage',
  'accounting.view', 'bank.manage', 'expenses.create', 'expenses.view',
  'refunds.approve', 'refunds.process',
  'returns.view', 'returns.manage',
  'customers.view', 'customers.manage',
  'content.manage', 'coupons.manage',
  'app_settings.manage', 'versions.manage', 'users.manage', 'roles.manage',
  'audit.view', 'reports.view', 'backup.export', 'support.manage',
  'shipping.manage', 'notifications.send', 'system.health',
] as const
export type Permission = (typeof PERMISSIONS)[number]

// مصفوفة الأدوار → الصلاحيات (تُفرض في الخادم)
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [...PERMISSIONS],
  MANAGER: [
    'orders.view', 'orders.update', 'orders.cancel',
    'payments.view', 'payments.review', 'payments.verify', 'payments.reject',
    'products.create', 'products.update', 'products.archive',
    'categories.manage', 'brands.manage',
    'inventory.view', 'inventory.adjust', 'inventory.transfer', 'warehouses.manage',
    'purchases.create', 'purchases.view', 'suppliers.manage',
    'accounting.view', 'expenses.view', 'expenses.create',
    'returns.view', 'returns.manage', 'customers.view', 'customers.manage',
    'content.manage', 'coupons.manage', 'reports.view', 'support.manage',
    'shipping.manage', 'notifications.send', 'audit.view', 'system.health', 'backup.export',
  ],
  ACCOUNTANT: [
    'payments.view', 'payments.review', 'payments.verify', 'payments.reject',
    'accounting.view', 'bank.manage', 'expenses.create', 'expenses.view',
    'refunds.approve', 'refunds.process', 'returns.view',
    'purchases.view', 'suppliers.manage', 'customers.view',
    'reports.view', 'audit.view',
  ],
  WAREHOUSE: [
    'orders.view', 'orders.update',
    'inventory.view', 'inventory.adjust', 'inventory.transfer',
    'warehouses.manage', 'returns.view', 'returns.manage',
  ],
  CONTENT_MANAGER: [
    'products.create', 'products.update', 'products.archive',
    'categories.manage', 'brands.manage', 'content.manage', 'coupons.manage',
  ],
  DELIVERY_OPERATOR: [
    'orders.view', 'orders.update', 'shipping.manage', 'returns.view',
  ],
  CUSTOMER: [],
}

export function hasPermission(role: string, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role as Role] ?? []).includes(permission)
}

// ---------- حالة الطلب (موحدة) ----------
export const ORDER_STATUSES = [
  'PENDING_PAYMENT', 'PAYMENT_REVIEW', 'PAYMENT_ISSUE',
  'CONFIRMED', 'STOCK_RESERVED', 'PROCESSING', 'PICKED', 'PACKED', 'READY_TO_SHIP',
  'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED',
  'CANCELLED', 'FAILED_DELIVERY', 'RETURN_IN_PROGRESS',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'بانتظار الدفع',
  PAYMENT_REVIEW: 'الدفع قيد المراجعة',
  PAYMENT_ISSUE: 'مشكلة في الدفع',
  CONFIRMED: 'تم التأكيد',
  STOCK_RESERVED: 'تم حجز المخزون',
  PROCESSING: 'قيد التجهيز',
  PICKED: 'تم الانتقاء',
  PACKED: 'تم التغليف',
  READY_TO_SHIP: 'جاهز للشحن',
  SHIPPED: 'تم الشحن',
  OUT_FOR_DELIVERY: 'خرج للتوصيل',
  DELIVERED: 'تم التسليم',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغي',
  FAILED_DELIVERY: 'فشل التوصيل',
  RETURN_IN_PROGRESS: 'إرجاع جارٍ',
}

// انتقالات آلة حالة الطلب — من → [إلى] (PLAN ق1.7: كل انتقال له شروط)
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PAYMENT_REVIEW', 'PAYMENT_ISSUE', 'CANCELLED'],
  PAYMENT_REVIEW: ['CONFIRMED', 'PAYMENT_ISSUE', 'PENDING_PAYMENT', 'CANCELLED'],
  PAYMENT_ISSUE: ['PENDING_PAYMENT', 'PAYMENT_REVIEW', 'CANCELLED'],
  CONFIRMED: ['STOCK_RESERVED', 'CANCELLED'],
  STOCK_RESERVED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PICKED', 'CANCELLED'],
  PICKED: ['PACKED'],
  PACKED: ['READY_TO_SHIP'],
  READY_TO_SHIP: ['SHIPPED', 'FAILED_DELIVERY'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'FAILED_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED_DELIVERY'],
  DELIVERED: ['COMPLETED', 'RETURN_IN_PROGRESS'],
  FAILED_DELIVERY: ['OUT_FOR_DELIVERY', 'RETURN_IN_PROGRESS', 'CANCELLED'],
  RETURN_IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

// حالات يرى فيها العميل زر الإلغاء
export const CUSTOMER_CANCELLABLE: OrderStatus[] = ['PENDING_PAYMENT', 'PAYMENT_REVIEW', 'PAYMENT_ISSUE']
// حالات يسمح فيها بطلب الإرجاع
export const RETURNABLE_STATUSES: OrderStatus[] = ['DELIVERED', 'COMPLETED']

// ---------- حالة الدفع ----------
export const PAYMENT_STATUSES = [
  'UNPAID', 'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED',
  'PARTIALLY_PAID', 'REJECTED', 'EXPIRED',
  'REFUND_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED',
] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: 'غير مدفوع',
  SUBMITTED: 'تم تسجيل التحويل',
  UNDER_REVIEW: 'قيد المراجعة',
  VERIFIED: 'معتمد',
  PARTIALLY_PAID: 'مدفوع جزئيًا',
  REJECTED: 'مرفوض',
  EXPIRED: 'منتهي الصلاحية',
  REFUND_PENDING: 'استرداد قيد التنفيذ',
  REFUNDED: 'تم الاسترداد',
  PARTIALLY_REFUNDED: 'استرداد جزئي',
}

// ---------- حالة الشحنة ----------
export const SHIPMENT_STATUSES = [
  'PENDING', 'READY', 'HANDED_OVER', 'IN_TRANSIT', 'OUT_FOR_DELIVERY',
  'DELIVERED', 'FAILED', 'RETURNING', 'RETURNED',
] as const
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number]

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: 'بانتظار الاستلام',
  READY: 'جاهزة',
  HANDED_OVER: 'تم التسليم لشركة الشحن',
  IN_TRANSIT: 'في الطريق',
  OUT_FOR_DELIVERY: 'خرجت للتوصيل',
  DELIVERED: 'تم التسليم',
  FAILED: 'فشل التوصيل',
  RETURNING: 'قيد الإرجاع',
  RETURNED: 'تم الإرجاع',
}

// ---------- حالة الإرجاع ----------
export const RETURN_STATUSES = [
  'REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED',
  'ITEM_SHIPPED_BACK', 'RECEIVED', 'INSPECTED', 'REFUND_PENDING',
  'COMPLETED', 'CANCELLED',
] as const
export type ReturnStatus = (typeof RETURN_STATUSES)[number]

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  REQUESTED: 'مطلوب',
  UNDER_REVIEW: 'قيد المراجعة',
  APPROVED: 'معتمد',
  REJECTED: 'مرفوض',
  ITEM_SHIPPED_BACK: 'المنتج في طريق الإرجاع',
  RECEIVED: 'تم الاستلام',
  INSPECTED: 'تم الفحص',
  REFUND_PENDING: 'الاسترداد قيد التنفيذ',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغي',
}

export const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['ITEM_SHIPPED_BACK', 'RECEIVED'],
  REJECTED: [],
  ITEM_SHIPPED_BACK: ['RECEIVED'],
  RECEIVED: ['INSPECTED'],
  INSPECTED: ['REFUND_PENDING'],
  REFUND_PENDING: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
}

// ---------- حالة الاسترداد ----------
export const REFUND_STATUSES = [
  'REQUESTED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED',
] as const
export type RefundStatus = (typeof REFUND_STATUSES)[number]

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  REQUESTED: 'مطلوب',
  APPROVED: 'معتمد',
  PROCESSING: 'قيد التنفيذ',
  COMPLETED: 'مكتمل',
  FAILED: 'فشل',
  CANCELLED: 'ملغي',
}

export const REFUND_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  REQUESTED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: ['PROCESSING'],
  CANCELLED: [],
}

// ---------- حالة تذكرة الدعم ----------
export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'مفتوحة',
  IN_PROGRESS: 'قيد المعالجة',
  WAITING_CUSTOMER: 'بانتظار العميل',
  RESOLVED: 'تم الحل',
  CLOSED: 'مغلقة',
}

// ---------- حالة التطبيق العامة (Store Control) ----------
export const STORE_APP_STATUSES = ['ONLINE', 'PARTIAL_PAUSED', 'MAINTENANCE', 'EMERGENCY_STOP'] as const
export type StoreAppStatus = (typeof STORE_APP_STATUSES)[number]

export const STORE_APP_STATUS_LABELS: Record<StoreAppStatus, string> = {
  ONLINE: 'يعمل',
  PARTIAL_PAUSED: 'متوقف جزئيًا',
  MAINTENANCE: 'صيانة',
  EMERGENCY_STOP: 'إيقاف طارئ',
}

// ---------- مفاتيح Feature Flags (Remote Config — PLAN ق6) ----------
export const FEATURE_FLAG_KEYS = [
  { key: 'store_enabled', label: 'المتجر مفتوح' },
  { key: 'catalog_enabled', label: 'الكتالوج متاح' },
  { key: 'registration_enabled', label: 'التسجيل مفتوح' },
  { key: 'orders_enabled', label: 'الطلبات مفتوحة' },
  { key: 'checkout_enabled', label: 'إتمام الشراء متاح' },
  { key: 'bank_transfer_enabled', label: 'الدفع بالتحويل البنكي' },
  { key: 'cash_on_delivery_enabled', label: 'الدفع عند الاستلام' },
  { key: 'returns_enabled', label: 'الإرجاع متاح' },
  { key: 'reviews_enabled', label: 'التقييمات متاحة' },
  { key: 'whatsapp_enabled', label: 'زر واتساب' },
  { key: 'coupons_enabled', label: 'الكوبونات' },
  { key: 'maintenance_mode', label: 'وضع الصيانة' },
  { key: 'emergency_stop', label: 'إيقاف طارئ (Kill Switch)' },
  { key: 'force_update', label: 'تحديث إجباري' },
] as const
export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number]['key']

export const PUBLIC_FLAGS: FeatureFlagKey[] = [
  'store_enabled', 'catalog_enabled', 'registration_enabled', 'orders_enabled',
  'checkout_enabled', 'bank_transfer_enabled', 'cash_on_delivery_enabled',
  'returns_enabled', 'reviews_enabled', 'whatsapp_enabled', 'coupons_enabled',
  'maintenance_mode', 'emergency_stop', 'force_update',
]

// ---------- مفاتيح إعدادات المتجر ----------
export const SETTING_KEYS = {
  storeName: 'store_name',
  storeTagline: 'store_tagline',
  storeLogoUrl: 'store_logo_url',
  whatsappNumber: 'whatsapp_number',
  supportPhone: 'support_phone',
  currency: 'currency',
  currencySymbol: 'currency_symbol',
  defaultWarehouseId: 'default_warehouse_id',
  paymentExpiryHours: 'payment_expiry_hours',
  codFeeExtra: 'cod_fee_extra',
  returnWindowDays: 'return_window_days',
  minOrderTotal: 'min_order_total',
  maintenanceMessage: 'maintenance_message',
  storeHours: 'store_hours',
  address: 'store_address',
} as const

// ---------- أنواع حركات المخزون ----------
export const MOVEMENT_TYPES = [
  'PURCHASE_RECEIPT', 'ORDER_RESERVATION', 'ORDER_RELEASE', 'SALE',
  'RETURN', 'DAMAGE', 'ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN', 'STOCK_ISSUE',
] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

// ---------- أكواد الأخطاء (PLAN ق52) ----------
export const ERROR_CODES = {
  NETWORK_ERROR: 'خطأ في الاتصال',
  AUTH_ERROR: 'يجب تسجيل الدخول',
  VALIDATION_ERROR: 'بيانات غير صحيحة',
  CONFLICT: 'تعارض في البيانات',
  OUT_OF_STOCK: 'الكمية المطلوبة غير متوفرة',
  PAYMENT_ERROR: 'خطأ في الدفع',
  PERMISSION_ERROR: 'لا تملك صلاحية لهذا الإجراء',
  SERVER_ERROR: 'خطأ في الخادم',
  UNKNOWN_ERROR: 'خطأ غير معروف',
} as const
export type ErrorCode = keyof typeof ERROR_CODES

// ---------- ثوابت عامة ----------
export const CURRENCY = 'YER'
export const CURRENCY_SYMBOL = 'ريال'

export const GOVERNORATES = [
  'عدن', 'صنعاء', 'تعز', 'الحديدة', 'لحج', 'أبين', 'مأرب', 'إب', 'ذمار',
  'حضرموت', 'شبوة', 'الضالع', 'البيضاء', 'ريمة', 'المحويت', 'الجوف',
  'عمران', 'صعدة', 'المهرة', 'سقطرى',
]

export const REJECT_REASONS = [
  'المبلغ غير مطابق',
  'لم يتم العثور على التحويل',
  'الإيصال غير واضح',
  'تحويل مكرر',
  'بيانات التحويل غير صحيحة',
]

export const RETURN_REASONS = [
  'مقاس غير مناسب',
  'المنتج مختلف عن الوصف',
  'منتج تالف',
  'تم استلام منتج خاطئ',
  'لم يعجبني المنتج',
  'أخرى',
]

export const EXPENSE_CATEGORIES = [
  'إيجار', 'رواتب', 'شحن وتوصيل', 'تغليف', 'عمولات',
  'مصاريف بنكية', 'كهرباء وماء', 'إنترنت', 'صيانة', 'أخرى',
]
