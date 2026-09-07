# Task 6-a — واجهة العميل SPA كاملة (Customer Storefront)

Agent: customer-storefront-agent
Scope: `src/components/store/**` فقط — لم يُلمس أي ملف خارج المجلد
الحالة: مكتمل — `bun run lint` = 0 errors / 0 warnings، `tsc --noEmit` نظيف لملفات المتجر

## الملفات المنتجة (28 ملفًا)

### القشرة والأساس
- `src/components/store/store-shell.tsx` — القشرة الرئيسية: StoreShell({preview}) — هيدر ثابت (شعار + اسم متجر من useConfig + بحث → catalog + إشعارات بbadge + حساب dropdown/login)، شريط سفلي موبايل 5 عناصر (home/catalog/cart+badge/orders/account)، Footer بـ mt-auto sticky (أوقات العمل/العنوان/الهاتف + روابط السياسات + زر واتساب)، FAB واتساب أخضر bottom-end (فوق الشريط السفلي في الموبايل)، LoginModal، مفتاح switch للـ views مع AnimatePresence + scroll-to-top عند تغيير الشاشة، banner معاينة للإداري (preview → العودة للإدارة)
- `src/components/store/types.ts` — كل أنواع API للعميل (strict TS، لا any)
- `src/components/store/utils.ts` — applyDiscount / cardPrice / asCardProduct / eventLabel (ORDER_<STATUS> + أحداث الدفع والإرجاع) / tierLabel / ticketCategoryLabel / shippingMethodLabel / paymentMethodLabel / accountSummary

### المكونات المشتركة (store/components)
- `login-modal.tsx` — خطوتان: هاتف (7xxxxxxxx) → request-otp → **devCode في Alert ظاهر داخل المودال (وضع تجريبي)** → إدخال كود 6 خانات + اسم اختياري (يظهر تلقائيًا عند طلب الخادم الاسم للتسجيل الجديد) → verify → refresh الجلسة + toast + إغلاق
- `safe-img.tsx` — `<img loading="lazy">` + onError → placeholder متدرج زمردي/ذهبي
- `code-box.tsx` — كود كبير قابل للنسخ (ORD/PAY/TRK) بنسخ عبر clipboard + toast
- `product-card.tsx` — بطاقة منتج (صورة/اسم/سعر/خصم badge/نافد badge) + نسخة مصغرة للصفوف الأفقية + زر مفضلة اختياري
- `product-row.tsx` — صف تمرير أفقي بعنوان قسم + "عرض الكل"
- `require-auth.tsx` — حارس الجلسة (skeleton/loading → EmptyState + زر دخول)
- `address-form.tsx` — نموذج عنوان كامل (GOVERNORATES select, city, district, neighborhood, street, landmark, phone 7xxxxxxxx, notes, isDefault) — إضافة/تعديل
- `payment-account-card.tsx` — بطاقة حساب بنكي/محفظة مع نسخ الرقم (بنك/محفظة icons)

### الشاشات (store/views) — 18 شاشة
- `home-view.tsx` — أقسام ديناميكية من sections: بانرات embla (loop RTL) + شبكة تصنيفات + صفوف FEATURED/OFFERS/NEW_ARRIVALS/BEST_SELLERS + شريط ثقة
- `catalog-view.tsx` — category/search/brand من nav params (replace) + sort/minPrice/maxPrice/page محلي + شرائح تصنيفات + Grid + Pagination (RTL arrows)
- `product-view.tsx` — معرض صور + أزرار attributes مع تعطيل القيم غير المتاحة (لون/مقاس) + سعر وخصم + كمية بحد available + إضافة للسلة (تتحقق available) + مفضلة toggle + تقييمات + وصف + منتجات ذات صلة + "اسأل عبر واتساب"
- `cart-view.tsx` — تعديل كميات + حذف + تفريغ + **quote حي من /api/checkout/quote** + كوبون (validate ثم تمريره للـ quote) + زر إتمام الشراء (openLogin إن لم يسجل)
- `checkout-view.tsx` — 4 خطوات: عنوان (قائمة+اختيار+إضافة حوار) → شحن (طرق من home + quote بالعنوان والطريقة) → دفع (BANK_TRANSFER → حسابات /api/payment-accounts أو COD) → مراجعة (ملاحظة + إجماليات الخادم) → POST /api/orders مع **idempotencyKey = crypto.randomUUID() مرة واحدة (useState initializer)** — **يرسل variantId+quantity فقط** → replace('order-success')
- `order-success-view.tsx` — احتفال + CodeBoxes كبيرة (orderNumber/paymentReference/trackingCode) + خطوات الدفع + حساب الدفع + واتساب بالسياق + زر عرض الطلب
- `orders-view.tsx` — بطاقات (رقم/حالة/حالة دفع/إجمالي/تاريخ/معاينة صور) + فلاتر حالة (client-side) + Pagination (page&limit=10)
- `order-details-view.tsx` — عناصر + ملخص + دفع + شحنة + إرجاعات + فاتورة + **خط زمني صادق (لا "تم الدفع" إلا إذا payment.status=VERIFIED)** + أزرار: تسجيل التحويل (حوار: مبلغ/حساب/مرجع/تاريخ/اسم محول/رفع إيصال api.upload→proofs ثم POST /api/payments/[id]/submit)، إلغاء (CUSTOMER_CANCELLABLE + سبب)، طلب إرجاع (RETURNABLE_STATUSES)، واتساب بالسياق، تقييم (DELIVERED/COMPLETED + reviews_enabled)
- `track-view.tsx` — تتبع عام بلا جلسة: حقل كود → /api/track/[code] → بطاقة حالة + أكواد قابلة للنسخ + timeline
- `returns-view.tsx` — قائمة الطلبات + حوار اختيار طلب مؤهل (DELIVERED/COMPLETED) للانتقال لطلب جديد
- `return-new-view.tsx` — اختيار أصناف وكميات + سبب من RETURN_REASONS + ملاحظة → POST /api/returns
- `addresses-view.tsx` — CRUD كامل + تعيين افتراضي + تحقق من عدم حذف الافتراضي (الخادم يرفض)
- `notifications-view.tsx` — قائمة + تعليم الكل/فردي + الانتقال عبر linkView/linkParam (روابط admin-* للإداريين فقط)
- `support-view.tsx` — تذاكري + إنشاء تذكرة (category: ORDER/PAYMENT/RETURN/SHIPPING/OTHER + subject + message)
- `support-ticket-view.tsx` — محادثة فقاعات (عميل/دعم) + رد + refetchInterval 15s + إظهار القفل عند RESOLVED/CLOSED
- `page-view.tsx` — صفحة محتوى (title + content فقرات)
- `favorites-view.tsx` — شبكة بطاقات + إزالة بالقلب (toggle /api/favorites)
- `profile-view.tsx` — بياناتي + إحصاءات (tier/totalSpent/creditBalance/ordersCount) + روابط سريعة + سياسات + **مفتاح الوضع الداكن (next-themes useTheme)** + خروج (logout → reload)

## الالتزام بالعقد
- التنقل عبر useNav().go/replace فقط — لا next/link إطلاقًا
- الأسعار دائمًا من الخادم (quote/orders يرسلان variantId+quantity فقط)
- Idempotency: مفتاح واحد لكل جلسة شراء (يُعاد استخدامه عند إعادة المحاولة)
- الخط الزمني لا يكذب: PAYMENT_VERIFIED يُخفى ما لم يكن payment.status=VERIFIED
- CUSTOMER_CANCELLABLE / RETURNABLE_STATUSES / reviews_enabled / whatsapp_enabled / bank_transfer_enabled / codEnabled محترمة كلها
- RTL كامل، عملة عبر money()، تواريخ dateFmt/timeAgo، أرقام الأكواد فقط بالإنجليزية (ORD-/PAY-/TRK-)
- كل شاشة: Loading (skeleton) + Empty + Error مع retry + toasts نجاح/فشل (sonner)
- صور: img عادي + loading=lazy + onError placeholder (لا next/image — تجنب مشاكل domain)
- framer-motion خفيف (انتقالات شاشة + بطاقات) + embla للبانرات
- sticky footer: القشرة flex min-h-screen والفوتر mt-auto + مسافة آمنة أسفل الشريط الثابت (pb-20 lg:pb-4 + env(safe-area-inset-bottom))
- الأزرار ≥ 44px (min-h-11) والأيقونات التفاعلية size-11

## قرارات تنفيذية
1. **الألوان**: استخدمت `bg-emerald-700` (وفروع dark) صريحًا لأزرار الـ CTA الرئيسية لأن `--primary` في globals.css الحالي محايد (رمادي) — عقد التصميم يقرّ أن primary = emerald، و(المُندمج في Task 7) قد يحدّث الثيم؛ الأزرار الافتراضية من shadcn تستخدم bg-primary وستتبع الثيم تلقائيًا. لا أزرق/indigo في أي مكان. amber للتحذيرات، rose/destructive للأخطاء.
2. **defaults بلا effects**: متوافق مع قواعد lint الجديدة (react-hooks/set-state-in-effect) — الاشتقاق أثناء العرض (العنوان الافتراضي في checkout، أول variant في صفحة المنتج) بدل useEffect+setState.
3. **فلترة حالة الطلبات في orders-view جانبية (على الصفحة الحالية)** لأن GET /api/orders لا يقبل status param — بمواصفة الـ API.
4. **كوبون السلة يمرر إلى checkout عبر nav params** ({coupon}) — لا حاجة لمتجر إضافي.
5. **view 'store-preview'** يعرض HomeView داخل StoreShell(preview) مع banner «أنت تعاين واجهة المتجر» + زر عودة للإدارة (reset('admin-dashboard')).

## ملاحظات للدمج (Task 7)
- globals.css: --primary ما زال محايدًا؛ يُنصح بضبطه إلى emerald (oklch ~0.55 0.15 160) ليتناسق مع bg-emerald-700 المستخدم صريحًا — لكن الواجهة تعمل وتظهر زمرديًا في كل العناصر الرئيسية حتى دون ذلك.
- dev.log الحالي فيه أخطاء من admin-shell (views ناقصة عند الوكيل 6-b) — ليست من ملفات العميل؛ عند اكتمال admin views ستختفي.
- Toaster (sonner) مثبت في layout.tsx بـ dir=rtl ومركز أعلى — لا إعداد مطلوب.
