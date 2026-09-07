# عقد واجهة المتجر (Frontend Brief) — وثيقة ملزمة للواجهتين

> المشروع: متجر الأصيل — SPA واحدة في مسار `/` (قيد البيئة: لا مسارات صفحات أخرى، فقط `/api/*`)
> هذه الوثيقة مرجع مشترك بين واجهة العميل (components/store) وواجهة الإدارة (components/admin)

## 1) البنية الجاهزة (لا تعدلها — فقط استخدمها)

### ملفات مشتركة
- `src/lib/client/api.ts` → `api.get/post/put/del/upload` — يرمي `ApiClientError {code, message}`
- `src/lib/client/format.ts` → `money(n)`, `dateFmt`, `timeAgo`, `orderStatusLabel`, `paymentStatusLabel`, `statusColor(s)`, `roleLabel`
- `src/lib/client/stores.ts`:
  - `useNav()` → `{ view, params, go(view, params?), replace, back, reset }` — **محرك التنقل الوحيد**
  - `useCart()` → `{ items, add, updateQty, remove, clear, count(), total() }` — مثبت localStorage (اسم ys-cart)
  - `useUi()` → `{ loginOpen, openLogin(reason?), closeLogin }`
  - `whatsappLink(phone, message)`
- `src/lib/client/session.ts` → `useConfig()` (Remote Config)، `useSession()` (يحتاج تسجيل؟ isAdmin؟)، `useLogin().refresh/logout`
- `src/lib/shared/constants.ts` → كل الحالات + الأدوار + `GOVERNORATES` + `RETURN_REASONS` + `REJECT_REASONS` + `EXPENSE_CATEGORIES` + تسميات عربية
- `src/components/app/spinner.tsx` → `Spinner`, `FullSpinner`, `EmptyState`, `ErrorState`
- `src/components/app/app-gate.tsx` + `root-app.tsx` → البوابة والقشرات (جاهزة)

### الواجهة تحمّل من خلال
- `StoreShell` من `@/components/store/store-shell` (props: `{ preview?: boolean }`)
- `AdminShell` من `@/components/admin/admin-shell` (بلا props)

**ملاحظة RootApp**: أي `view` يبدأ بـ `admin-` يفتح AdminShell. إداري يريد معاينة المتجر → `go('store-preview')`.

## 2) عقد API (الاستجابة دائمًا `{ok, data}` أو `{ok, error}`)

### عام (عميل)
| Endpoint | Method | مدخلات | مخرجات مهمة |
|---|---|---|---|
| `/api/config` | GET | — | flags/settings/appStatus/version |
| `/api/auth/request-otp` | POST | `{phone}` (9 خانات تبدأ 7) | `{devCode}` — اعرضه في الواجهة (وضع تجريبي) |
| `/api/auth/verify-otp` | POST | `{phone, code, name?}` (name إلزامي عند التسجيل الجديد) | `{isNew, user}` |
| `/api/auth/logout` | POST | — | `{loggedOut}` |
| `/api/auth/me` | GET | — | `{user, customer, unreadNotifications}` |
| `/api/catalog/home` | GET | — | `{flags, banners, sections, categories, shippingMethods, shippingZones, products:{FEATURED,OFFERS,NEW_ARRIVALS,BEST_SELLERS}}` |
| `/api/catalog/products` | GET | `?search&category&brand&sort&minPrice&maxPrice&page&limit` | `{total,page,pages,products[]}` (كل منتج فيه variants + available) |
| `/api/catalog/products/[id]` | GET | id أو slug | `{product, variants[], reviews, reviewsSummary, related}` — variant: `{id, attributes, price, discountPercent, imageUrl, available}` |
| `/api/catalog/categories` | GET | — | `{categories, brands}` |
| `/api/checkout/quote` | POST | `{items:[{variantId,quantity}], addressId?, shippingMethodCode?, couponCode?}` | `{items[], itemsTotal, couponDiscount, shippingFee, grandTotal, warnings[]}` |
| `/api/orders` | POST | `{addressId, items, shippingMethodCode, paymentMethodCode(BANK_TRANSFER\|COD), couponCode?, customerNote?, idempotencyKey?}` | `{orderNumber, paymentReference, trackingCode, grandTotal, orderId, ...}` — **أرسل idempotencyKey عشوائيًا (crypto.randomUUID()) عند فتح Checkout وخصصه للجلسة** |
| `/api/orders` | GET | `?page&limit` | `{orders[]}` (طبعًا فقط للجلسة) |
| `/api/orders/[id]` | GET | — | `{order, address, items[], timeline[], payment, shipment, returns[], invoice}` |
| `/api/orders/[id]/cancel` | POST | `{reason}` | `{cancelled}` |
| `/api/payments/[id]/submit` | POST | `{amount, paymentAccountId?, customerTransferRef?, transferDate?, senderName?, proofUrl?, notes?}` | `{paymentId, status, submittedAmount}` |
| `/api/track/[code]` | GET | ORD/PAY/TRK code | `{orderNumber, status, statusLabel, timeline, ...}` — عام بلا جلسة |
| `/api/addresses` | GET/POST | `{label, governorate, city, district?, neighborhood?, street?, landmark?, phone, notes?, isDefault?}` | قائمة/العنصر |
| `/api/addresses/[id]` | PUT/DELETE | — | — |
| `/api/payment-accounts` | GET | — | `{accounts[], codEnabled}` |
| `/api/returns` | GET/POST | POST: `{orderId, items:[{orderItemId,quantity}], reason, note?, photos?[]}` | طلباتي/`{returnNumber}` |
| `/api/notifications` | GET/POST | POST: `{ids?[]}` (فارغ=الكل) | — |
| `/api/support` | GET/POST | POST: `{orderId?, category, subject, message}` | — |
| `/api/support/[id]` | GET/POST | POST: `{message}` | — |
| `/api/content/pages/[slug]` | GET | — | `{title, content}` |
| `/api/coupons/validate` | POST | `{code, items}` | `{code, discount, label}` |
| `/api/favorites` | GET/POST | POST: `{productId}` (toggle) | — |
| `/api/reviews` | POST | `{productId, orderId, rating(1-5), comment?}` | — |
| `/api/upload` | POST | FormData `{file, folder}` | `{url}` — استخدم `api.upload(file, 'proofs')` |

### إدارة (كلها تحت `/api/admin/...` — تحميها الأدوار في الخادم)
| Endpoint | Method | ملاحظات |
|---|---|---|
| `/api/admin/dashboard` | GET | `{today, queues, totals, banks, salesByDay}` |
| `/api/admin/operations` | GET | `{payments, orderIssues, lowStock, returns, failedDeliveries, tickets}` |
| `/api/admin/orders` | GET | `?status&search&paymentStatus&page&limit` → `{orders, statusCounts, total, pages}` |
| `/api/admin/orders/[id]` | GET | `{order, address, nextStatuses[], movements, changedByNames}` |
| `/api/admin/orders/[id]/status` | POST | `{to, reason?, note?, provider?}` — استخدم `nextStatuses` للأزرار |
| `/api/admin/payments` | GET | `?status&search&risk&page` → `{payments, statusCounts}` |
| `/api/admin/payments/[id]` | GET | `{payment, order, customer, account, events, actorNames, bankTxns, banks}` |
| `/api/admin/payments/[id]/action` | POST | `{action:'verify'\|'reject'\|'clarify'\|'review'\|'settle_overpayment', bankAccountId?, reason?, confirmAmount?, message?, method?}` |
| `/api/admin/products` | GET/POST | GET: `?search&category&status&page` → `{products, categories, brands}` — POST الإنشاء (فيه variants) |
| `/api/admin/products/[id]` | GET/PUT/DELETE | DELETE = أرشفة عند وجود طلبات |
| `/api/admin/catalog?type=category\|brand` | GET/POST/PUT/DELETE | CRUD موحد (`?type&id` للتحديث/الحذف) |
| `/api/admin/inventory` | GET/POST | GET: `?search&warehouseId&lowOnly&page` → `{balances, warehouses, summary}` — POST actions: `adjust\|damage\|transfer\|reorder_level` |
| `/api/admin/inventory/movements` | GET | `?variantId&type&page` |
| `/api/admin/warehouses` | GET/POST/PUT/DELETE | — |
| `/api/admin/purchases` | GET/POST/PUT | POST: `{supplierId, warehouseId, items:[{variantId,quantity,unitCost}], paidNow?, bankAccountId?, paymentMethod?}` — PUT: `{action:'pay', purchaseId, amount,...}` |
| `/api/admin/suppliers` | GET/POST/PUT | GET `?detail=ID` لكشف الحساب |
| `/api/admin/banks` | GET/POST | GET: `{accounts, transactions, typeTotals}` — POST actions: `create_account\|create_transaction\|update_account` |
| `/api/admin/expenses` | GET/POST | `{expenses, totalAmount, byCategory, accounts, categories}` |
| `/api/admin/returns` | GET | `?status&search&page` |
| `/api/admin/returns/[id]/action` | POST | `{to, reason?, note?, refundMethod?, bankAccountId?}` |
| `/api/admin/refunds` | GET/POST | POST: `{orderId, amount, method, bankAccountId?, reason, paymentId?}` |
| `/api/admin/refunds/[id]/action` | POST | `{action:'approve'\|'complete'\|'cancel', note?}` |
| `/api/admin/coupons` | GET/POST/PUT/DELETE | `?id` للتفاصيل |
| `/api/admin/content?type=banners\|sections\|pages` | GET/POST/DELETE | POST للإنشاء والتحديث (id اختياري) |
| `/api/admin/customers` | GET | `?search&tier&page` |
| `/api/admin/customers/[id]` | GET | ملف كامل (طلبات/دفعات/مرتجعات/عناوين) |
| `/api/admin/reports?type=...` | GET | `sales\|inventory\|payments\|financial\|products` + `?from&to` |
| `/api/admin/users` | GET/POST/PUT/DELETE | DELETE `?id` = إلغاء الجلسات |
| `/api/admin/audit` | GET | `?action&entityType&search&page` |
| `/api/admin/app-control` | GET/POST | POST actions: `set_flag\|set_setting\|set_version\|maintenance` |
| `/api/admin/notifications` | POST | `{title, body, target}` بث |
| `/api/admin/search?q=` | GET | `{orders, payments, customers, products, returns, shipments}` |
| `/api/admin/tickets` | GET | `?status&page` |
| `/api/admin/tickets/[id]` | GET/POST | POST: `{message?, status?}` |
| `/api/admin/reviews` | GET/PUT/DELETE | PUT: `{id, status}` |
| `/api/admin/export?type=...` | GET | CSV (رابط مباشر للتنزيل) |

## 3) أسماء الـ Views (عقد useNav)

### واجهة العميل (agent store):
`home`, `catalog` (params: `category?`, `search?`, `brand?`), `product` (param: `id`), `cart`, `checkout`, `order-success` (param: `id`), `orders`, `order-details` (param: `id`), `track` (param: `code?`), `returns`, `return-new` (param: `orderId`), `profile`, `addresses`, `notifications`, `support`, `support-ticket` (param: `id`), `page` (param: `slug`), `favorites`, `store-preview` (داخلية للإداري)

### واجهة الإدارة (agent admin) — كلها تبدأ بـ `admin-`:
`admin-dashboard`, `admin-operations`, `admin-orders`, `admin-order-details` (param: `id`), `admin-payments`, `admin-payment-details` (param: `id`), `admin-products`, `admin-inventory`, `admin-movements`, `admin-warehouses`, `admin-purchases`, `admin-suppliers`, `admin-banks`, `admin-expenses`, `admin-returns`, `admin-refunds`, `admin-coupons`, `admin-content`, `admin-customers`, `admin-customer-details` (param: `id`), `admin-reports`, `admin-users`, `admin-audit`, `admin-app-control`, `admin-tickets`, `admin-ticket-details` (param: `id`), `admin-reviews`, `admin-search` (param: `q`)

## 4) نظام التصميم (إلزامي)

- **RTL عربي** كل شيء (`dir=rtl` مضبوط في html). لا نصوص إنجليزية ظاهرة للمستخدم (الأكواد والـ SKU فقط).
- **الألوان**: primary = زمردي emerald (شعار المتجر زمردي/ذهبي). لا أزرق ولا indigo إطلاقًا. ثانوي: amber للتنبيهات، rose للأخطاء. استخدم متغيرات Tailwind: `bg-primary`, `text-muted-foreground`, `bg-card`... مع `dark:` للوضع الداكن.
- **مكونات**: shadcn/ui الموجودة في `src/components/ui` (button, card, badge, dialog, sheet, tabs, table, input, select, drawer, dropdown-menu, alert-dialog, toast/sonner...). لا تبنِ مكونات موجودة من الصفر.
- **الأيقونات**: lucide-react.
- **الأرقام والعملة**: `money()` من format.ts فقط. التواريخ عبر dateFmt/timeAgo.
- **التنسيقات**: p-4/p-6 للبطاقات، gap-4/gap-6. القوائم الطويلة: `max-h-96 overflow-y-auto` مع سكرول مخصص.
- **الاستجابة**: موبايل أولًا (شريط سفلي للعميل: الرئيسية/الأقسام/السلة/طلباتي/حسابي). الإدارة: Sidebar يتحول Drawer على الموبايل.
- **Sticky Footer إلزامي**: القشرة `min-h-screen flex flex-col` والفوتر `mt-auto`. لا فجوة فارغة أسفل الشاشات القصيرة ولا تغطية للمحتوى الطويل.
- **اللمس**: عناصر تفاعلية ≥ 44px.
- **الحالات لكل شاشة**: Loading (Skeleton/FullSpinner) + Empty (EmptyState) + Error (ErrorState) + النجاح. لا شاشة بيضاء أبدًا.
- **التنبيهات**: sonner `toast.success/error(...)` بعد كل عملية.
- **أنيميشن**: خفيف عبر framer-motion (اختياري، غير مبالغ).

## 5) قواعد سلوكية إلزامية (من PLAN.md)

1. **السعر يأتي من الخادم**: أرسل `{variantId, quantity}` فقط للـ quote/orders. لا ترسل أسعارًا.
2. **Idempotency**: عند بدء Checkout ولّد `idempotencyKey` (crypto.randomUUID()) واحفظه في state المكون وأرسله مع الطلب مرة واحدة؛ لا تولد جديدًا عند إعادة المحاولة.
3. **الخط الزمني للعميل لا يكذب**: "تم الدفع" لا يظهر إلا إذا كانت حالة الدفع VERIFIED.
4. **أزرار الإلغاء للعميل** تظهر فقط في PENDING_PAYMENT/PAYMENT_REVIEW/PAYMENT_ISSUE (استخدم CUSTOMER_CANCELLABLE).
5. **طلب الإرجاع** يظهر فقط بعد DELIVERED/COMPLETED (RETURNABLE_STATUSES).
6. **واتساب**: زر عائم/داخل صفحة الطلب يفتح `whatsappLink(config.settings.whatsappNumber, رسالة مجهزة بالسياق)` — الرسالة تتضمن رقم الطلب/كود الدفع أو اسم المنتج.
7. **الإدارة**: زر "التالي" لكل انتقال من `nextStatuses` فقط + سبب إلزامي عند CANCELLED ورفض الدفع (dialog صغير).
8. **صلاحيات الواجهة**: خبئ ما لا يملكه الدور حسب ROLE_PERMISSIONS من constants (الخادم يفرضها أصلًا — هذا UX فقط).
9. **الكمية في السلة**: تعتمد على available المعروض من الخادم؛ عند OUT_OF_STOCK اعرض رسالة وامنع الإضافة.
10. **devCode**: عند طلب OTP اعرض الكود في تنبيه ظاهر (وضع تجريبي) ليسهل الدخول.
11. **البحث في الإدارة**: صندوق موحد ينتقل إلى admin-search.
12. **بث الإشعارات والدفع والطلبات**: كل action يعرض toast نجاح/خطأ ويعمل invalidateQueries للقوائم المعنية.

## 6) بيانات دخول للتجربة (وضع تجريبي)
- عميل: 712345678 (أحمد محمد) — OTP يظهر في الواجهة
- أدوار: 777000001 SUPER_ADMIN، 777000002 MANAGER، 777000003 ACCOUNTANT، 777000004 WAREHOUSE، 777000005 CONTENT_MANAGER، 777000006 DELIVERY_OPERATOR
