# Worklog — متجر اليمن الإلكتروني (Yemen Store)

> مشروع: متجر تجارة إلكترونية متكامل لليمن — دورة تجارية End-to-End
> المرجع: /home/z/my-project/upload/PLAN.md + /home/z/my-project/upload/Pasted Content_1788735834040.txt
> البيئة: Next.js 16 (App Router) + TypeScript + Prisma/SQLite + Tailwind 4 + shadcn/ui — مسار واحد `/` (SPA)

---
Task ID: 0
Agent: orchestrator (main)
Task: قراءة الملفات المرفقة كاملة، تحليل المشروع، اكتشاف التعارضات والفجوات، بناء خطة تنفيذ مرحلية، تجهيز الأدوات

Work Log:
- قراءة "Pasted Content_1788735834040.txt" كاملًا (113 قسم: رؤية النظام، دورة الشراء، الدفع البنكي، المخزون، المحاسبة، التحكم المركزي)
- قراءة "PLAN.md" كاملًا (120 قسم: المبادئ، الحدود، الأدوار، الكيانات، آلات الحالة، معايير القبول، ترتيب التنفيذ)
- فحص البيئة: dev server يعمل على 3000، .env موجود، Prisma+SQLite جاهز، كل الحزم المطلوبة مثبتة (zustand, tanstack query, zod, sharp, next-themes...)
- استخراج التعارضات وحسمها (انظر أدناه)
- بناء خطة تنفيذ مرحلية وتوزيعها على المهام

Stage Summary:

## فكرة المشروع (مختصرة)
منظومة من 5 أجزاء مترابطة: تطبيق العميل + نظام الإدارة + محرك الطلبات + محرك الحسابات والمخزون + طبقة التحكم المركزية (Remote Config/Feature Flags/Kill Switch). الدفع أساسًا تحويل بنكي/محافظ مع رفع إيصال وتحقق بشري إداري. واتساب عبر روابط مباشرة فقط (بدون API). واجهة عربية RTL.

## التعارضات المكتشفة وحلولها (قرارات معمارية موثقة)
1. **Flutter vs بيئة الويب**: الخطة تقول Flutter/Android+iPhone، لكن بيئة التنفيذ Next.js ويب. الحل: تطبيق مبدأ API-first المنصوص في الخطة (قسم 109 من ملف الرؤية): نبني Backend API كاملة + واجهة ويب للعميل والإدارة في مسار واحد `/`، والبنية جاهزة لاستهلاك Flutter لها لاحقًا بدون إعادة كتابة.
2. **حالة PICKED**: موجودة في مسار المستودع (PLAN ق24) وغائبة من قائمة حالات الطلب الرئيسية (PLAN ق14) → أضيفت للقائمة الموحدة.
3. **PAYMENT_SUBMITTED vs SUBMITTED**: تسمية مختلفة بين الملفين → تم توحيد الحالة إلى SUBMITTED.
4. **COMPLETED**: موجودة في PLAN.md وغائبة في ملف الرؤية → اعتمدت (بعد DELIVERED).
5. **توقيت حجز المخزون**: ملف الرؤية يقول "بعد تأكيد الدفع" (ق18) وPLAN.md يقول "عند إنشاء الطلب" (ق15 خطوة13، ق11) → اعتمدنا سياسة PLAN.md: الحجز عند إنشاء الطلب + تحرير تلقائي عند الإلغاء/انتهاء صلاحية الدفع (ق85) + تحويل الحجز إلى بيع عند الإنجاز.
6. **الأدوار غير موحدة**: قائمة الملف الأول تشمل ADMIN/OPERATOR وPLAN.md تشمل SUPER_ADMIN/DELIVERY_OPERATOR → اعتمدت قائمة PLAN.md الأدق: CUSTOMER, SUPER_ADMIN, MANAGER, ACCOUNTANT, WAREHOUSE, CONTENT_MANAGER, DELIVERY_OPERATOR.
7. **قرارات تقنية مفتوحة** (الخطة لم تحسمها): قاعدة البيانات = SQLite عبر Prisma (بيئة)، تخزين الصور = نظام ملفات محلي مع ضغط عبر sharp، OTP = وضع تطوير (الكود يُعاد في استجابة API لعدم وجود مزود SMS) مع بنية Adapter جاهزة، الإشعارات = داخل التطبيق (In-App).
8. **العملة والأرقام**: مبالغ كأعداد صحيحة Int بالريال اليمني YER (بدون كسور) — منع floating point وفق PLAN ق107/108، مع حقل currency للتوسع.
9. **Offline**: الخطة موجهة للموبايل — في الويب: TanStack Query cache + localStorage للسلة، ولا تُؤكد أي عملية حساسة offline.

## الحالات الموحدة (State Machines النهائية)
- OrderStatus: PENDING_PAYMENT, PAYMENT_REVIEW, PAYMENT_ISSUE, CONFIRMED, STOCK_RESERVED, PROCESSING, PICKED, PACKED, READY_TO_SHIP, SHIPPED, OUT_FOR_DELIVERY, DELIVERED, COMPLETED, CANCELLED, FAILED_DELIVERY, RETURN_IN_PROGRESS
- PaymentStatus: UNPAID, SUBMITTED, UNDER_REVIEW, VERIFIED, PARTIALLY_PAID, REJECTED, EXPIRED, REFUND_PENDING, REFUNDED, PARTIALLY_REFUNDED
- ShipmentStatus: PENDING, READY, HANDED_OVER, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, FAILED, RETURNING, RETURNED
- ReturnStatus: REQUESTED, UNDER_REVIEW, APPROVED, REJECTED, ITEM_SHIPPED_BACK, RECEIVED, INSPECTED, REFUND_PENDING, COMPLETED, CANCELLED
- RefundStatus: REQUESTED, APPROVED, PROCESSING, COMPLETED, FAILED, CANCELLED
- TicketStatus: OPEN, IN_PROGRESS, WAITING_CUSTOMER, RESOLVED, CLOSED
- StoreAppStatus: ONLINE, PARTIAL_PAUSED, MAINTENANCE, EMERGENCY_STOP

## سياسة المحاسبة المعتمدة (حسم PLAN ق55)
- Revenue يثبت عند VERIFY الدفع (مع BankTransaction نوع CUSTOMER_PAYMENT)
- COGS يقيد عند إتمام التسليم (تحويل الحجز إلى SALE في حركات المخزون)
- كل مبلغ له مرجع + Audit، لا حذف مالي، التسويات عبر حالات

## خطة التنفيذ المرحلية
- Task 0 (منفذ): التحليل + الخطة + worklog ✓
- Task 1 (منفذ): Prisma schema كامل (~45 كيان) + push + seed واقعي
- Task 2 (منفذ): نواة الخادم: lib/shared (ثوابت+آلات حالة+أنواع) + lib/server (auth/RBAC/session/audit/codes/inventory/accounting/pricing)
- Task 3 (منفذ): APIs العميل: auth, config, catalog, orders(مع Idempotency), payments, returns, addresses, notifications, support, content
- Task 4 (منفذ): APIs الإدارة: dashboard, operations, orders/transitions, payments queue, catalog CRUD, inventory, purchases/suppliers, banks/expenses, returns/refunds, coupons, content, customers, users, audit, reports, app-control, search, export
- Task 5 (منفذ): توليد الصور (شعار/بانرات/منتجات) عبر image-generation skill
- Task 6-a (وكيل فرعي): واجهة العميل SPA كاملة (RTL عربي)
- Task 6-b (وكيل فرعي): واجهة الإدارة SPA كاملة (RTL عربي)
- Task 7 (منفذ): الدمج في page.tsx الواحد + providers + lint + إصلاحات
- Task 8 (منفذ): تحقق E2E بالمتصفح (agent-browser) + إصلاح أي خلل

## عقود مشتركة بين الواجهات و الـ API
- كل استجابة: { ok: true, data } أو { ok: false, error: { code, message } }
- الجلسة: httpOnly cookie (sid) + GET /api/auth/me
- العملة: نصوص منسقة في الواجهة فقط؛ الأرقام خام Int

---
Task ID: 1
Agent: orchestrator (main)
Task: مخطط قاعدة البيانات الكامل + seed واقعي

Work Log:
- كتابة prisma/schema.prisma بـ ~45 كيانًا (هوية/عملاء/كتالوج/طلبات/دفع/فواتير/مخزون/شحن/إرجاء/موردون/مالية/عروض/محتوى/دعم/تحكم/تدقيق)
- إصلاح أخطاء العلاقات (علاقات معاكسة مفقودة + علاقة 1-1 غير موحدة)
- إضافة imageUrl للـ Product للأداء
- bun run db:push ناجح
- كتابة prisma/seed.ts: 9 مستخدمين (7 أدوار) + 8 تصنيفات + 5 ماركات + 19 منتجًا بمتغيرات + مخزنان + 20 منطقة شحن + 3 طرق شحن + 4 حسابات دفع + 3 حسابات بنكية + موردون ومشتريات (استلام مخزون حقيقي عبر محرك receiveStock) + مصروفات + كوبونات + محتوى (3 بانرات + 6 أقسام + 7 صفحات)
- توليد 6 طلبات تجريبية عبر المحركات الحقيقية (كل الحالات: PENDING_PAYMENT حتى COMPLETED + RETURN_IN_PROGRESS)
- إصلاح 3 أخطاء أثناء التشغيل: متغير from خارج النطاق، تأكيد طلبات COD مباشرة عند الإنشاء، أرقام هواتف بـ 9 خانات

Stage Summary:
- قاعدة البيانات: 7 طلبات/7 مدفوعات/57 حركة مخزون/3 فواتير/89 إشعارًا/46 سجل تدقيق/حركات بنكية صحيحة
- الأرصدة البنكية تُشتق من الحركات فعليًا

---
Task ID: 2
Agent: orchestrator (main)
Task: نواة الخادم — الثوابت وآلات الحالة والمحركات

Work Log:
- src/lib/shared/constants.ts: الأدوار السبعة + مصفوفة صلاحيات ROLE_PERMISSIONS + آلات حالة (طلب/دفع/شحنة/إرجاء/استرداد/تذكرة) مع خرائط انتقالات + مفاتيح الأعلام + تسميات عربية + أكواد أخطاء
- src/lib/server/api.ts: استجابات موحدة {ok,data|error} + Zod + أخطاء
- src/lib/server/auth.ts: جلسات httpOnly cookie + OTP وضع تطوير (جاهز لربط SMS)
- src/lib/server/codes.ts: مولدات ORD/PAY/TRK/INV/RET/REF/PUR/BTX/TKT/EXP/SHP داخل المعاملات
- src/lib/server/audit.ts: writeAudit
- src/lib/server/flags.ts: Remote Config + Settings مع كاش 5 ثوان + getPublicConfig + assertFlagEnabled
- src/lib/server/inventory.ts: محرك مخزون (حجز/تحرير/تحويل لبيع/استلام/إرجاع/تالف/تسوية/نقل) — لا رصيد سالب، لا تعديل بلا حركة
- src/lib/server/pricing.ts: محرك تسعير (خادم يعيد حساب كل شيء + كوبونات + شحن بالمنطقة)
- src/lib/server/accounting.ts: حركات بنكية برصيد مشتق + مصروفات + دفعات موردون + تحصيل COD
- src/lib/server/notifications.ts: إشعارات مستخدم/دور (مالية/مستودع)
- src/lib/server/orders.ts: createOrder (معاملة ذرية + Idempotency + حجز مخزون + كوبون + إشعارات) + transitionOrder (آلة حالة بآثار جانبية كاملة) + expireStaleOrders + ensureInvoice + customerCancelOrder
- src/lib/server/payments.ts: submitPayment (تراكمي + كشف التكرار) + verifyPayment (أثر مالي + فاتورة) + rejectPayment (سبب إلزامي) + requestClarification + settleOverpayment
- src/lib/server/returns.ts: createReturnRequest (نافذة إرجاع) + transitionReturn (استلام يعيد المخزون) + createRefund + completeRefund (أثر بنكي/رصيد)

Stage Summary:
- كل منطق الأعمال مركزي في محركات (PLAN ق59)
- أي إجراء حساس له Audit + إشعار + أثر في الكيانات التابعة

---
Task ID: 3+4
Agent: orchestrator (main)
Task: كل مسارات API (العميل + الإدارة)

Work Log:
- العميل: config, auth(request-otp/verify-otp/logout/me), catalog(home/products/[id]/categories), checkout/quote, orders(GET/POST+id+cancel), payments/[id]/submit, track/[code], addresses CRUD, returns, notifications, support(+[id]), content/pages/[slug], coupons/validate, favorites, payment-accounts, reviews, upload (sharp→WebP)
- الإدارة: dashboard, operations, orders(+[id]+status), payments(+[id]+action: verify/reject/clarify/settle_overpayment), products(+[id]), catalog(categories/brands), inventory(+movements+actions), warehouses, purchases(create+receive+pay), suppliers, banks(+transactions), expenses, returns(+[id]/action), refunds(+[id]/action), coupons(+[id]), content(banners/sections/pages), customers(+[id]), reports(sales/inventory/payments/financial/products), users(+[id]), audit, app-control(flags/settings/versions/maintenance), notifications(broadcast), search, tickets(+[id]), reviews, export(CSV)
- إصلاحات: أقواس Prisma include، Zod v4 يستخدم .issues بدل .errors، dashboard/operations لكل الأدوار الإدارية (requireAdmin)

Stage Summary:
- المسار الذهبي مختبر حيًّا عبر curl: دخول عميل → quote → إنشاء طلب → Idempotency يعيد نفس الطلب → تسجيل تحويل → دخول محاسب → اعتماد → الطلب CONFIRMED + الفاتورة INV + أثر بنكي + إشعارات
- لوحة المعلومات والتقارير والتحكم تعمل ببيات حية

---
Task ID: 6-a
Agent: customer-storefront-agent
Task: واجهة العميل SPA كاملة (RTL عربي)

Work Log:
- قراءة العقد كاملًا (docs/frontend-brief.md) + worklog + الثوابت + مكتبات العميل الجاهزة (api/format/stores/session) + spinner components + فحص أشكال استجابات API من مسارات الخادم مباشرة (home/products/[id]/quote/orders/[id]/track/addresses/returns/notifications/support/content/favorites/payment-accounts/auth)
- بناء الأساس: types.ts (كل أنواع API بدقة) + utils.ts (cardPrice/applyDiscount/eventLabel/تسميات) + مكونات مشتركة: login-modal (هاتف→OTP مع devCode ظاهر في الواجهة للوضع التجريبي) / safe-img (بديل متدرج عند فشل الصورة) / code-box (أكواد قابلة للنسخ) / product-card + mini / product-row / require-auth / address-form / payment-account-card
- store-shell.tsx: هيدر ثابت (شعار+اسم من useConfig، بحث→catalog، إشعارات بbadge، حساب dropdown/دخول) + شريط سفلي موبايل 5 عناصر مع badge سلة + Footer sticky (mt-auto) بمعلومات المتجر والسياسات وواتساب + FAB واتساب أخضر + مفتاح شاشات بـ AnimatePresence مع scroll-to-top + banner معاينة للإداري (preview)
- الشاشات الجوهرية: home (بانرات embla RTL + شبكة تصنيفات + أقسام ديناميكية FEATURED/OFFERS/NEW_ARRIVALS/BEST_SELLERS من sections)، catalog (فلاتر تصنيف/ماركة/سعر/ترتيب + بحث مؤجل من params + Grid + Pagination)، product (معرض + أزرار attributes مع تعطيل القيم غير المتاحة + كمية بحد available + مفضلة + تقييمات + واتساب)، cart (quote حي من الخادم + كوبون validate + إتمام الشراء يتطلب جلسة)
- Checkout 4 خطوات (عنوان→شحن→دفع→مراجعة): idempotencyKey=crypto.randomUUID() مرة واحدة، إرسال variantId+quantity فقط، حسابات الدفع للتحويل أو COD، replace لorder-success
- order-success: أكواد كبيرة قابلة للنسخ + تعليمات الدفع + الحساب المسجل + واتساب بالسياق
- orders/order-details: بطاقات + فلاتر حالة + Pagination؛ التفاصيل الكاملة مع خط زمني صادق (لا "تم الدفع" إلا إذا payment.status=VERIFIED) + تسجيل التحويل (حوار مع رفع إيصال عبر api.upload('proofs') ثم POST /api/payments/[id]/submit) + إلغاء بشرط CUSTOMER_CANCELLABLE + إرجاع بشرط RETURNABLE_STATUSES + تقييم بعد DELIVERED/COMPLETED
- track (بلا جلسة) + returns/return-new (اختيار أصناف وكميات + سبب من RETURN_REASONS) + addresses CRUD + notifications (تعليم مقروء + انتقال عبر linkView مع تجاهل admin-* لغير الإداريين) + support/support-ticket (محادثة حية 15s) + page (المحتوى) + favorites + profile (إحصاءات + وضع داكن next-themes + خروج)
- إصلاحات جودة: 0 أخطاء ESLint (مع ترحيل الحالات الافتراضية من useEffect إلى اشتقاق أثناء العرض لقاعدة set-state-in-effect) + 0 أخطاء TypeScript لملفات المتجر + تنظيف الاستيرادات غير المستخدمة

Stage Summary:
- 28 ملفًا في src/components/store/**: القشرة + 8 مكونات مشتركة + 18 شاشة + types + utils — كل التنقل عبر useNav فقط (لا next/link)
- كل قواعد العقد مطبقة: أسعار من الخادم، Idempotency، خط زمني صادق، أعلام الميزات (whatsapp/bank/cod/reviews/returns)، devCode ظاهر، skeleton/empty/error لكل شاشة، toasts sonner، RTL كامل، أزرار ≥44px، footer sticky بمساحة آمنة
- انحراف واحد موثق: أزرار CTA الرئيسية تستخدم bg-emerald-700 صريحًا (بدل الاعتماد على --primary المحايد حاليًا في globals.css) لضمان الهوية الزمردية فورًا — يُنصح في الدمج بضبط --primary إلى emerald لتتناسق بقية مكونات shadcn الافتراضية
- أخطاء dev.log الحالية من ملفات admin-shell للوكيل الموازي (6-b) وليست من واجهة العميل

---
Task ID: 5
Agent: orchestrator (main)
Task: توليد الصور (شعار/بانرات/منتجات)

Work Log:
- شعار SVG زمردي/ذهبي (public/uploads/logo.svg) + 8 صور تصنيفات SVG
- 19 صورة منتج WebP مضغوطة عبر image-generation skill + sharp (scripts/generate-images.ts)
- 3 بانرات إعلانية 1200x600 (إصلاح مقاس API: مضاعفات 32)
- فشل مؤقت في nohup → تشغيل setsid ناجح

Stage Summary:
- 22 صورة AI + 9 SVG جاهزة تحت public/uploads

---
Task ID: 6-b
Agent: admin-panel-agent (subagent)
Task: واجهة الإدارة SPA كاملة

Work Log:
- أنشأ admin-shell.tsx (Sidebar مصنف + بحث شامل + إشعارات + معاينة المتجر + وضع داكن + حماية القائمة بالأدوار)
- 29 شاشة views (dashboard/operations/orders+details/payments+details/products/categories/inventory/movements/warehouses/purchases/suppliers/banks/expenses/returns/refunds/coupons/content/customers+details/reports/users/audit/app-control/tickets+details/reviews/search)
- مكونات مشتركة: data-table, confirm-dialog (سبب إلزامي), kit
- types.ts شامل
- انتهى سياق الوكيل قبل كتابة التقرير لكن كل الملفات اكتملت وصفر أخطاء TypeScript

Stage Summary:
- لوحة إدارة كاملة RTL مع كل أنظمة المشروع العشرة

---
Task ID: 7
Agent: orchestrator (main)
Task: الدمج النهائي + إصلاحات الجودة

Work Log:
- layout.tsx: خط Cairo عربي + RTL + ThemeProvider + QueryProvider + Toaster sonner
- page.tsx → RootApp (قشرة حسب الدور + بوابات الحالة + fallback آمن)
- app-gate.tsx (صيانة/إيقاف طارئ/متجر مغلق مع بقاء دخول الإدارة)
- providers.tsx (QueryClient)
- ثيم زمردي في globals.css (--primary/--ring/--chart-1 + خط Cairo)
- إصلاحات TS: علاقة PurchaseItem→variant بالمخطط، verify-otp أنواع، maintenance startsAt إلزامي، coupons/audit/operations/content/returns أخطاء أنواع — **صفر أخطاء في src/**
- إضافة زر سلة للهيدر (سطح المكتب) + زر "لوحة الإدارة" في قائمة الحساب + توجيه الأدوار للوحة بعد الدخول

Stage Summary:
- lint نظيف + tsc نظيف لكل src/ + الهوية الزمردية مطبقة

---
Task ID: 8
Agent: orchestrator (main)
Task: التحقق E2E بالمتصفح (agent-browser)

Work Log:
- ✅ الرئيسية: بانرات carousel + تصنيفات + 4 أقسام منتجات + فوتر sticky (footerBottom == pageH بلا فجوات)
- ✅ منتج: متغيرات + كمية محدودة بالمتاح + مفضلة + تقييمات + ذات صلة + واتساب
- ✅ السلة: quote حي من الخادم + إضافة للسلة (localStorage persist عبر reload)
- ✅ دخول OTP: devCode معروض → جلسة عميل (712345678)
- ✅ Checkout 4 خطوات: عنوان→شحن→دفع (حسابات بنكية معروضة)→مراجعة → طلب ORD-20260907-000001 + PAY + TRK + Idempotency مُتحقق
- ✅ تسجيل تحويل → PAYMENT_REVIEW
- ✅ دخول SUPER_ADMIN → لوحة مع مؤشرات حية
- ✅ رفض دفعة بسبب إلزامي (المبلغ غير مطابق): payment REJECTED + order PAYMENT_ISSUE + إشعار + Audit
- ✅ إعادة تقديم → اعتماد: payment VERIFIED + order CONFIRMED + فاتورة INV-8KS5NK + حركة بنكية BTX IN 29000 + إشعار
- ✅ تدفق المستودع: CONFIRMED→حجز→تجهيز→انتقاء→تغليف→جاهز→شحن (مع مزود)→توصيل→تسليم→مكتمل (13 انتقالًا، حركة SALE بالسالب، إحصاء العميل تحدث، شحنة DELIVERED)
- ✅ Kill Switch: orders_enabled=false → POST /api/orders مرفوض برسالة عربية + Audit للمفتاح
- ✅ وضع الصيانة: visitor يرى شاشة الصيانة والإدارة تعمل + Audit بالسبب
- ✅ موبايل 390px: شريط سفلي 5 عناصر + الوضع الداكن يعمل (bg lab white↔near-black)
- ✅ معاينة المتجر من الإدارة (بانر + عودة)
- ✅ صفر أخطاء console/server (تحذير Radix تجميلي واحد)

Stage Summary:
- **المسار الذهبي كاملًا يعمل live من المتصفح مع كل السلاسل المترابطة** (طلب→دفع→اعتماد→مخزون→شحن→تسليم→محاسبة→إشعارات→تدقيق)
- المتجر جاهز للاستخدام عبر لوحة المعاينة

---
Task ID: 9
Agent: orchestrator (main)
Task: رفع المشروع بالكامل إلى GitHub

Work Log:
- إضافة remote origin إلى https://github.com/Mohammed503-qtb/QTB.S-ONLINE-.git (التوثيق عبر توكن المستخدم)
- التحقق: المستودع البعيد كان فارغاً تماماً (لا فروع) → دفع مباشر بلا تعارضات
- git push -u origin main ناجح: 275 ملفاً متعقباً (كل الكود + Prisma schema + seed + قاعدة البيانات db/custom.db + الصور public/uploads + ملفات الخطة upload/PLAN.md)
- node_modules مستثنى تلقائياً عبر .gitignore
- التحقق النهائي: git ls-remote يطابق hash المحلي 0b82ec28df1abff59b4fd55736bef19415f793eb

Stage Summary:
- المشروع كاملاً على GitHub تحت الفرع main في مستودع QTB.S-ONLINE-
- بانتظار أوامر المستخدم لبدء التنفيذ بحسب الخطة
