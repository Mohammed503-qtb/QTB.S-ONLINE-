# PLAN.md — متجر تجارة إلكترونية متكامل لليمن

## 0. تعريف المشروع

هذا المشروع عبارة عن تطبيق تجارة إلكترونية موحد مبني بـ Flutter، يعمل على Android وiPhone، ويقدم واجهة العميل وواجهة الإدارة والتشغيل داخل نفس التطبيق بحسب صلاحيات المستخدم.

الهدف ليس بناء واجهة متجر فقط، بل بناء دورة تجارية مترابطة End-to-End تبدأ من عرض المنتج وتنتهي بالتسليم أو الإرجاع والتسوية المالية، مع إدارة المخزون والحسابات البنكية والمحتوى والصلاحيات والإصدارات وحالة التطبيق من مكان واحد.

النظام يجب أن يكون عمليًا، واضحًا، قابلًا للتوسع، ولا يحتوي على وظيفة معزولة لا تعرف من أين تأتي بياناتها أو إلى أين تذهب نتيجتها.

---

# 1. مبادئ المشروع غير القابلة للكسر

## 1.1 Flutter

- التطبيق العميل والإدارة داخل مشروع Flutter واحد ما لم يظهر سبب تقني قوي للفصل.
- Android وiPhone هدفان أساسيان.
- الواجهة عربية RTL من البداية مع دعم تعدد اللغات لاحقًا.
- دعم الوضع الفاتح والداكن.

## 1.2 Backend هو مصدر الحقيقة

الهاتف لا يكون مصدر الحقيقة للبيانات الحساسة.

مصدر الحقيقة النهائي:
- الأسعار.
- المخزون.
- الطلبات.
- المدفوعات.
- صلاحيات المستخدمين.
- الحسابات المالية.
- إعدادات المتجر.
- Feature Flags.
- حالة الإصدار.

التطبيق يحتفظ Cache محليًا لتحسين السرعة، لكنه لا يقرر وحده العمليات الحساسة.

## 1.3 كل عملية مالية قابلة للتتبع

كل دفع أو استرداد أو مصروف أو حركة بنك يجب أن يكون لها:
- رقم مرجعي.
- الوقت.
- المستخدم/الجهة المنفذة.
- الحالة.
- سبب التعديل عند الحاجة.
- سجل Audit.

## 1.4 عدم الحذف المدمر

السجلات المالية والطلبات وحركات المخزون لا تُحذف حذفًا نهائيًا في التشغيل العادي.
تستخدم حالات Cancelled / Rejected / Archived / Reversed حسب نوع السجل.

## 1.5 عدم ازدواج العمليات

إنشاء الطلب والدفع وحجز المخزون والـ Refund يجب أن تكون Idempotent بحيث لا يؤدي الضغط المتكرر أو إعادة المحاولة بسبب الشبكة إلى إنشاء عملية ثانية.

## 1.6 لا ثقة في بيانات العميل الحساسة

الخادم يعيد حساب:
- سعر المنتج.
- الخصومات.
- الشحن.
- الإجمالي.
- أهلية الكوبون.
- توفر المخزون.

## 1.7 كل حالة لها انتقالات معروفة

لا توجد شاشة تغيّر حالة سجل إلى قيمة عشوائية.
كل Entity حساس له State Machine واضحة، ولكل انتقال شروط وصلاحيات وآثار جانبية.

---

# 2. الشكل العام للنظام

```text
Flutter App
├── Customer Experience
├── Operations/Admin Experience
└── Local Cache / Device State
          │
          ▼
       Backend API
          │
   ┌──────┼───────────────┐
   ▼      ▼               ▼
Database Storage       Object/File Storage
   │
   ├── Catalog
   ├── Customers
   ├── Orders
   ├── Payments
   ├── Inventory
   ├── Shipping
   ├── Accounting
   ├── Content
   ├── Security
   └── System Control
```

واتساب لا يستخدم API في هذا المشروع.
التطبيق يفتح WhatsApp مباشرة عبر رابط/Intent مع رقم المتجر ورسالة مجهزة عند الحاجة.

---

# 3. حدود النظام

## داخل المشروع

- متجر إلكتروني.
- كتالوج منتجات متعدد الفئات.
- سلة وCheckout.
- عناوين العملاء.
- طرق دفع، أهمها التحويل البنكي/المحافظ حسب إعدادات الإدارة.
- تسجيل إيصالات التحويل.
- مراجعة الدفع واعتماده أو رفضه.
- طلبات ومراحل تجهيز وشحن.
- تتبع الطلب.
- مخزون ومخازن وحركات مخزون.
- مشتريات وموردون.
- حسابات مالية وحسابات بنكية ومصروفات وتقارير.
- مرتجعات واستبدالات واستردادات.
- كوبونات وعروض.
- محتوى ديناميكي.
- دعم واتساب المباشر.
- إشعارات داخل التطبيق وPush إن تم إعداد مزود مناسب.
- أدوار وصلاحيات.
- Audit Log.
- Backup/Export/Archive.
- Remote Config وFeature Flags.
- Maintenance Mode.
- Version Control وForce Update.
- Emergency Stop.

## خارج النطاق في النسخة الأولى

- WhatsApp Business API.
- دردشة واتساب آلية داخل النظام.
- بوابة دفع إلكترونية غير متوفرة فعليًا في البيئة المستهدفة.
- نظام ERP صناعي كامل.
- سوق متعدد البائعين Marketplace.

---

# 4. الأدوار

## CUSTOMER

التصفح، السلة، الطلب، الدفع، التتبع، الإرجاع، الملف الشخصي، التواصل.

## SUPER_ADMIN

كل الصلاحيات النظامية، بما فيها إدارة الصلاحيات والإعدادات الحرجة والإصدارات والنسخ الاحتياطية.

## MANAGER

تشغيل المتجر والمنتجات والطلبات والمخزون والعملاء والتقارير وفق الصلاحيات.

## ACCOUNTANT

المدفوعات، الحسابات البنكية، المصروفات، الاستردادات، المشتريات، والتقارير المالية.

## WAREHOUSE

التجهيز والمخزون والحركات والتعبئة والاستلام والتسليم للشحن.

## CONTENT_MANAGER

المنتجات، التصنيفات، البنرات، الصفحة الرئيسية، المحتوى والعروض وفق الصلاحيات.

## DELIVERY_OPERATOR

الشحن، الحالات اللوجستية، ومحاولات التسليم فقط.

لا تُكتب الصلاحيات داخل الواجهة فقط؛ يتم فرضها على الخادم أيضًا.

---

# 5. التجربة الموحدة داخل التطبيق

عند فتح التطبيق:

```text
Splash
  ↓
Load Remote Config
  ↓
Check Maintenance
  ↓
Check Minimum Version
  ↓
Restore Session
  ↓
Resolve Role
  ↓
Customer Shell OR Admin/Operations Shell
```

إذا كانت هناك مشكلة حرجة:
- الصيانة تمنع الوظائف المحددة فقط أو التطبيق كاملًا حسب الإعداد.
- Force Update يمنع الاستخدام عند تجاوز الحد الأدنى.
- Emergency Stop يمكنه إيقاف الطلبات والدفع أو التطبيق بالكامل مع إبقاء شاشة الصيانة.

---

# 6. نظام Remote Config وFeature Flags

إعداد مركزي، مثل:

```text
store_enabled
catalog_enabled
registration_enabled
orders_enabled
bank_transfer_enabled
cash_on_delivery_enabled
returns_enabled
reviews_enabled
whatsapp_enabled
maintenance_mode
force_update
minimum_version
latest_version
```

يمكن أيضًا تعريف Flags لكل ميزة دون إصدار جديد.

## قواعد

- لا يعتمد التطبيق على قيمة قديمة بلا مدة صلاحية مناسبة.
- يتم التعامل مع فشل تحميل الإعدادات بسياسة Fallback آمنة.
- لا يمكن لـ Remote Config تجاوز صلاحيات المستخدم.
- تغيير الإعدادات الحساسة يسجل في Audit Log.

---

# 7. إدارة الإصدارات والتحكم في التطبيق

الإدارة تحدد:
- Latest Version.
- Minimum Supported Version.
- Release Notes.
- رابط التحديث المناسب للمنصة.
- Force Update.
- Maintenance Message.

## حالات التطبيق

```text
ONLINE
PARTIAL_PAUSED
MAINTENANCE
EMERGENCY_STOP
```

PARTIAL_PAUSED مثال:
- الكتالوج يعمل.
- الطلبات متوقفة.
- واتساب يعمل.

---

# 8. الهوية والمصادقة

- تسجيل عبر رقم الهاتف/OTP حسب Backend المستخدم.
- Session آمنة.
- Refresh/Expiry حسب التنفيذ.
- Logout من الجهاز.
- إدارة الأجهزة والجلسات للإدارة.
- إمكانية إلغاء جلسة مشبوهة.

## بيانات العميل الأساسية

```text
id
name
phone
email optional
status
created_at
updated_at
```

## حالات المستخدم

```text
ACTIVE
SUSPENDED
BLOCKED
DELETED/ANONYMIZED
```

---

# 9. الكتالوج

## Category

- id
- name
- slug
- image
- parent_id optional
- active
- sort_order

يدعم التصنيفات الهرمية دون فرض عمق غير ضروري.

## Product

- id
- name
- description
- brand_id optional
- category_id
- base_price
- compare_at_price optional
- cost_price optional ومقيد بالصلاحيات
- SKU
- barcode optional
- status
- weight optional
- created_at
- updated_at

## Product Variant

كل Variant يمثل تركيبة قابلة للبيع والمخزون، مثال:

```text
Product: قميص
Color: Black
Size: M
SKU: SH-BLK-M
```

ويحتوي على:
- variant id
- attributes
- price override optional
- cost override optional
- barcode
- SKU
- weight
- active

## الصور

- Product Images.
- Variant Images عند الحاجة.
- ترتيب الصور.
- صورة رئيسية.
- روابط تخزين بدل حفظ الصور الثقيلة داخل قاعدة البيانات.

---

# 10. التسعير والعروض

السعر النهائي يجب أن ينتج من محرك تسعير واحد وليس من شاشات متعددة.

```text
Base Price
→ Price Rule
→ Product/Variant Discount
→ Coupon
→ Order Discount
→ Shipping
→ Final Total
```

قبل تأكيد الطلب يعاد الحساب على الخادم.

## Promotion Types

- نسبة.
- مبلغ ثابت.
- منتج/تصنيف.
- مدة زمنية.
- استخدامات محدودة.
- حد أدنى للسلة.

لا يسمح بتداخل خصومات غير مسموح به حسب السياسة.

---

# 11. السلة

السلة مرتبطة بالمستخدم أو بجلسة ضيف عند دعم الضيف.

كل Cart Item:
- product_id
- variant_id
- quantity
- snapshot metadata display only

السعر الحقيقي يعاد من الخادم عند Checkout.

السلة لا تحجز المخزون بشكل دائم.
الحجز يبدأ عند إنشاء الطلب وفق سياسة الحجز.

---

# 12. العناوين والمناطق

Address:
- المحافظة.
- المدينة.
- المديرية.
- الحي.
- الشارع.
- معلم قريب.
- الهاتف.
- ملاحظات.
- latitude/longitude optional.

يتم حفظ Snapshot للعنوان داخل الطلب عند إنشائه، حتى لو عدله العميل لاحقًا.

---

# 13. محرك الشحن

Shipping Zone:
- المحافظة.
- المدينة/المنطقة.
- تكلفة الشحن.
- زمن التوصيل.
- حالة التفعيل.

Shipping Method:
- استلام من المتجر.
- مندوب داخلي.
- شركة شحن.

Checkout يستدعي محرك الشحن للحصول على تكلفة موثقة.

---

# 14. الطلبات

## بنية الطلب

```text
Order
├── Customer
├── Address Snapshot
├── Items Snapshot
├── Pricing Snapshot
├── Payment Reference
├── Shipping
├── Status History
└── Audit History
```

## Order Status

```text
DRAFT
PENDING_PAYMENT
PAYMENT_REVIEW
CONFIRMED
STOCK_RESERVED
PROCESSING
PACKED
READY_TO_SHIP
SHIPPED
OUT_FOR_DELIVERY
DELIVERED
CANCELLED
FAILED_DELIVERY
RETURN_IN_PROGRESS
COMPLETED
```

بعض الحالات ليست مستقلة زمنيًا ويمكن تنفيذها كـ status + substatus، لكن المنطق يجب أن يبقى صريحًا.

---

# 15. إنشاء الطلب End-to-End

1. العميل يفتح Checkout.
2. التطبيق يرسل المنتجات والـ variants والكميات والعنوان وطريقة الشحن.
3. الخادم يعيد قراءة المنتجات والأسعار.
4. الخادم يتحقق من أن المنتجات نشطة.
5. الخادم يتحقق من المخزون القابل للحجز.
6. يحسب الخصومات.
7. يتحقق من الكوبون.
8. يحسب الشحن.
9. يحسب الإجمالي النهائي.
10. ينشئ Order Number.
11. ينشئ Payment Reference.
12. ينشئ Tracking Code عند السياسة المناسبة.
13. ينشئ حجز مخزون أو يحجز في نفس Transaction المنطقية.
14. يسجل Order Event.
15. يعيد بيانات الطلب للعميل.

إذا فشلت العملية قبل Commit، لا ينتج طلب جزئي غير صالح ولا حجز يتيم.

---

# 16. معرفات المعاملات

لكل طلب مفاتيح واضحة:

```text
Order Number: ORD-...
Payment Reference: PAY-...
Tracking Code: TRK-...
Invoice Number: INV-...
Refund Number: REF-...
Purchase Number: PUR-...
```

هذه المعرفات لا تكون بديلًا عن UUID الداخلي؛ كلاهما يستخدم حسب الحاجة.

---

# 17. الدفع بالتحويل البنكي/المحافظ

## Payment Method

- id
- name
- type
- active
- instructions

## Payment Account

- bank/wallet name
- beneficiary
- account number
- wallet number optional
- display instructions
- active
- sort order

## Payment Record

- payment id
- order_id
- payment reference
- expected amount
- submitted amount
- method
- destination account
- customer transfer number/reference
- transfer date
- proof image URL optional
- notes
- status

## Payment Status

```text
UNPAID
SUBMITTED
UNDER_REVIEW
VERIFIED
PARTIALLY_PAID
REJECTED
EXPIRED
REFUND_PENDING
REFUNDED
PARTIALLY_REFUNDED
```

---

# 18. تدفق الدفع الكامل

```text
Order Created
↓
Payment Reference Generated
↓
Customer sees bank/wallet account
↓
Customer transfers funds externally
↓
Customer returns to app
↓
Submits transfer data + proof if available
↓
Payment = UNDER_REVIEW
↓
Accountant/authorized operator reviews
↓
VERIFY / REJECT / REQUEST_CLARIFICATION
```

عند VERIFY:
- payment status = VERIFIED.
- order payment state updates.
- accounting transaction is posted.
- order moves to next valid state.
- notification is generated.
- audit log is written.

عند REJECT:
- سبب إلزامي.
- payment remains auditable.
- order stays payable or moves to payment issue state حسب السياسة.

---

# 19. حالات الدفع غير الطبيعي

## دفع ناقص

```text
Expected 50,000
Received 45,000
```

الحالة PARTIALLY_PAID، والرصيد المتبقي 5,000.

## دفع زائد

```text
Expected 50,000
Received 55,000
```

Overpayment = 5,000.
تحدد الإدارة: Refund أو Customer Credit أو Apply to another order.

## دفع مكرر

يتم اكتشاف تكرار المرجع/المبلغ/التحويل عند الإمكان، ويظهر Duplicate/Review Flag بدل إنشاء أثر مالي مضاعف.

## إيصال مشكوك فيه

يظل Under Review ولا يصبح Verified تلقائيًا.

---

# 20. الدفع عند الاستلام

إن فُعّل:
- لا يعتبر الطلب Paid عند الإنشاء.
- يبقى COD outstanding.
- عند التسليم يسجل التحصيل.
- يتم تسجيل وسيلة التحصيل والحساب المستلم إن لزم.
- في حال فشل التوصيل يعاد الطلب إلى الحالة اللوجستية المناسبة.

---

# 21. الفاتورة

عند تحقق الشروط المحاسبية/العملية، ينشئ النظام Invoice.

الفاتورة تحتوي على Snapshot:
- المتجر.
- العميل.
- الطلب.
- العناصر.
- الأسعار.
- الخصومات.
- الشحن.
- الإجمالي.
- حالة الدفع.
- التاريخ.

الفاتورة مرتبطة بالطلب وليست المصدر الوحيد للحقيقة؛ الطلب والمعاملات المالية محفوظة مستقلًا.

---

# 22. حجز المخزون

Stock Ledger يفرق بين:

```text
On Hand
Reserved
Available
Sold
Damaged
Returned
```

المعادلة التشغيلية:

```text
Available = On Hand - Reserved
```

مع قواعد إضافية حسب حالات المعالجة.

لا يعتمد العميل على Available المرسل من الهاتف.
الخادم يعيد التحقق عند إنشاء الطلب.

---

# 23. مستودعات وحركات المخزون

Warehouse:
- id
- name
- active

Inventory Balance:
- warehouse_id
- variant_id
- on_hand
- reserved
- reorder_level

Stock Movement:
- movement id
- variant
- warehouse
- quantity delta
- movement type
- reference type
- reference id
- reason
- user
- timestamp

## أنواع الحركات

```text
PURCHASE_RECEIPT
ORDER_RESERVATION
ORDER_RELEASE
SALE
RETURN
DAMAGE
ADJUSTMENT
TRANSFER_OUT
TRANSFER_IN
```

لا يجوز تعديل الرصيد يدويًا دون حركة توضح السبب.

---

# 24. تجهيز الطلب في المستودع

```text
CONFIRMED
↓
STOCK_RESERVED
↓
PROCESSING
↓
PICKED
↓
PACKED
↓
READY_TO_SHIP
```

عند Pick/Pack يمكن تسجيل العامل والمخزن والوقت.

إذا اكتشف العامل نقصًا غير متوقع، لا يعدل المخزون بصمت؛ ينشئ Stock Issue ويوقف انتقال الطلب حتى تعالج المشكلة.

---

# 25. الشحن والتتبع

Shipment:
- shipment id
- order id
- method
- provider/operator
- fee
- tracking code
- status
- timestamps

## Shipment Status

```text
PENDING
READY
HANDED_OVER
IN_TRANSIT
OUT_FOR_DELIVERY
DELIVERED
FAILED
RETURNING
RETURNED
```

العميل يرى Timeline مبنيًا من الأحداث المسموح بعرضها.

---

# 26. التسليم الفاشل

أسباب نموذجية:
- العميل غير متاح.
- العنوان خاطئ.
- العميل رفض الاستلام.
- مشكلة مع المندوب.

كل محاولة تسليم تسجل:
- وقت.
- المستخدم/المندوب.
- الحالة.
- السبب.
- ملاحظات.

بعد عدد معين من المحاولات أو بقرار مشغل، ينتقل الطلب إلى الإجراء المناسب: إعادة محاولة، تعديل عنوان، أو Return.

---

# 27. الإلغاء

قبل الدفع: Cancel حسب شروط المتجر.

بعد الدفع وقبل التجهيز: Cancel + Refund/Credit عند الحاجة.

بعد الشحن: تطبق سياسة الشحن والإرجاع.

كل عملية إلغاء تتطلب:
- من قام بها.
- السبب.
- الحالة السابقة.
- الحالة الجديدة.
- الأثر على المخزون.
- الأثر المالي إن وجد.

---

# 28. المرتجعات

Return Request:
- order id
- item ids
- quantities
- reason
- customer note
- photos optional
- status

## الحالات

```text
REQUESTED
UNDER_REVIEW
APPROVED
REJECTED
ITEM_SHIPPED_BACK
RECEIVED
INSPECTED
REFUND_PENDING
COMPLETED
```

لا يتم Refund لمجرد ضغط Approved إذا كانت السياسة تتطلب استلام وفحص المنتج.

---

# 29. الاستبدال

Replacement يرتبط بالطلب الأصلي.

إذا كان المنتج البديل أعلى سعرًا:
- ينشأ فرق مستحق.

إذا كان أقل:
- ينشأ Refund/Credit.

إذا كان مساويًا:
- لا يوجد فرق مالي.

المخزون الأصلي والبديل يسجلان بحركات منفصلة.

---

# 30. Refund

Refund Record:
- refund number
- order/payment reference
- amount
- reason
- destination method
- status
- processor
- timestamps

## الحالات

```text
REQUESTED
APPROVED
PROCESSING
COMPLETED
FAILED
CANCELLED
```

لا يتم كتابة “Refunded” قبل وجود سجل Refund قابل للتدقيق.

---

# 31. المشتريات والموردون

Purchase:
- supplier
- date
- items
- cost
- discount
- total
- paid
- remaining
- destination warehouse

عند استلام المشتريات:
- يزيد المخزون.
- يسجل Purchase Receipt.
- تسجل تكلفة البضاعة.
- ينشأ التزام للمورد إذا لم يدفع بالكامل.

Supplier Account يحتوي على:
- مشتريات.
- دفعات.
- مرتجعات.
- رصيد مستحق.

---

# 32. الحسابات البنكية

Bank Account:
- id
- name
- institution
- account number masked/display policy
- opening balance
- currency
- active

Bank Transaction:
- transaction id
- account id
- direction
- amount
- reference type/id
- date
- description
- reconciliation status

## أنواع الحركة

```text
CUSTOMER_PAYMENT
REFUND
EXPENSE
SUPPLIER_PAYMENT
TRANSFER_IN
TRANSFER_OUT
ADJUSTMENT
FEE
```

---

# 33. المحاسبة التشغيلية

النظام يفرق بين:

```text
Sales
Collections
Revenue
Inventory Cost
Refunds
Expenses
Bank Movements
Supplier Payables
Customer Receivables
```

مثال بيع مدفوع بتحويل بنكي:

```text
Order Confirmed
→ Sales/Revenue recorded
→ Payment verified
→ Bank receipt recorded
→ Inventory reduced when sale is finalized
→ COGS recorded from inventory cost policy
```

أي قيود محاسبية تفصيلية تتبع تصميم الحسابات النهائي، لكن يجب عدم تسجيل أثر محاسبي مرتين لنفس الحدث.

---

# 34. المصروفات

Expense:
- category
- amount
- account/cash source
- date
- description
- attachment
- created_by

لا يؤثر المصروف على المبيعات، لكنه يؤثر على النقد/البنك والتقارير المالية.

---

# 35. التسوية البنكية

يجب أن يستطيع المحاسب مقارنة:

```text
System Transactions
vs
Actual Bank Statement/Reference
```

الحالة:

```text
UNRECONCILED
MATCHED
PARTIAL_MATCH
DISPUTED
```

لا يتم حذف فرق التسوية؛ يتم تسجيل سبب المعالجة.

---

# 36. حساب العميل

Dashboard العميل:
- بياناته.
- عناوينه.
- الطلبات.
- المدفوعات المتعلقة بالطلبات.
- الاستردادات.
- الأرصدة/الـ Credit إن كانت الخدمة تدعمها.
- المفضلة.
- الإشعارات.
- تذاكر الدعم.

---

# 37. البحث

بحث العميل:
- اسم المنتج.
- SKU.
- Barcode إذا كان مناسبًا.
- التصنيف.
- العلامة التجارية.

بحث الإدارة العالمي:
- رقم الطلب.
- كود الدفع.
- كود التتبع.
- رقم الهاتف.
- اسم العميل.
- SKU.
- رقم العملية البنكية.
- رقم الفاتورة.
- رقم المرتجع.

---

# 38. واتساب بدون API

الأزرار:
- WhatsApp Store.
- WhatsApp Product.
- WhatsApp Order.
- WhatsApp Payment Help.
- WhatsApp Return Help.

عند الضغط:
1. تجهيز رقم المتجر.
2. تجهيز رسالة قصيرة ذات سياق.
3. فتح WhatsApp مباشرة.

أمثلة للرسائل:

```text
أريد الاستفسار عن المنتج: {product_name}
SKU: {sku}
```

```text
أريد الاستفسار عن الطلب: {order_number}
Tracking: {tracking_code}
```

لا يدعي النظام أن واتساب تم تحديثه آليًا؛ التطبيق فقط فتح المحادثة.

---

# 39. الإشعارات

## للعميل

- طلب جديد.
- تعليمات الدفع.
- الدفع قيد المراجعة.
- الدفع مقبول/مرفوض.
- الطلب جاهز.
- تم الشحن.
- خرج للتوصيل.
- تم التسليم.
- طلب الإرجاع.
- Refund.

## للإدارة

- طلب جديد.
- دفعة جديدة.
- إيصال ينتظر المراجعة.
- مخزون منخفض.
- تسليم فاشل.
- طلب إرجاع.
- مشكلة نظام.

الإشعار ليس مصدر الحقيقة؛ الضغط عليه يفتح السجل المرتبط.

---

# 40. إدارة المحتوى

Content Manager يتحكم في:
- اسم المتجر.
- الشعار.
- البنرات.
- أقسام الصفحة الرئيسية.
- التصنيفات.
- المنتجات المميزة.
- المنتجات الجديدة.
- الأكثر مبيعًا.
- الصفحات الثابتة.
- السياسات.
- الأسئلة الشائعة.
- أرقام التواصل.
- رابط واتساب.

Home Page تعتمد على Sections ديناميكية قابلة للترتيب والإخفاء.

---

# 41. الكوبونات والعروض

Coupon:
- code
- type
- value
- min cart
- max discount
- usage limit
- per-customer limit
- start/end
- eligible products/categories
- active

قبل تطبيق الكوبون يتم التحقق على الخادم.

---

# 42. التقييمات والمراجعات

بعد التسليم فقط، وفق سياسة المتجر، يستطيع العميل تقييم المنتج/الطلب.

الإدارة تستطيع:
- إخفاء المراجعة.
- مراجعة المحتوى.
- الإبقاء عليها.

لا يجوز إنشاء تقييم على طلب ملغى أو غير مكتمل إذا كانت السياسة تمنع ذلك.

---

# 43. الدعم

Support Ticket:
- ticket number
- customer
- order optional
- category
- message
- attachments optional
- status
- assigned operator

الحالات:

```text
OPEN
IN_PROGRESS
WAITING_CUSTOMER
RESOLVED
CLOSED
```

يوفر زر واتساب، لكن تذكرة التطبيق تظل مستقلة ولا تعتمد على WhatsApp API.

---

# 44. الصلاحيات

Permission examples:

```text
orders.view
orders.update
orders.cancel
payments.view
payments.review
payments.verify
payments.reject
products.create
products.update
inventory.adjust
inventory.transfer
purchases.create
accounting.view
expenses.create
refunds.approve
content.manage
app_settings.manage
versions.manage
users.manage
roles.manage
backup.export
```

قاعدة مهمة: UI hiding ليس حماية؛ Authorization يجب أن يُفرض في Backend.

---

# 45. Audit Log

كل عملية حساسة تسجل:

```text
actor
role
action
entity_type
entity_id
old_value snapshot when needed
new_value snapshot when needed
reason optional/required
created_at
```

أمثلة:
- تعديل السعر.
- اعتماد الدفع.
- رفض الدفع.
- تعديل المخزون.
- إلغاء الطلب.
- Refund.
- تعديل حساب بنكي.
- تغيير Minimum Version.
- تشغيل Emergency Stop.

---

# 46. الإدارة اليومية — Home Dashboard

يعرض:
- مبيعات اليوم.
- المدفوعات المعلقة.
- طلبات التجهيز.
- الشحنات.
- المرتجعات.
- المخزون المنخفض.
- الإيرادات المحصلة.
- المصروفات.
- صافي مؤشرات اليوم.

كل بطاقة Dashboard تفتح قائمة تفصيلية؛ لا توجد أرقام يتيمة بلا مصدر.

---

# 47. مركز العمليات

Operations Center هو شاشة مركزة للأعمال التي تحتاج تدخلًا:

```text
Payment Reviews
Order Issues
Low Stock
Returns
Failed Deliveries
Support Tickets
System Alerts
```

هذا يقلل الحاجة للتنقل بين شاشات كثيرة لإنهاء يوم العمل.

---

# 48. التقارير

## المبيعات
- حسب الفترة.
- التصنيف.
- المنتج.
- العميل.
- طريقة الدفع.

## المخزون
- الكميات.
- المتاح.
- المحجوز.
- التالف.
- الحركات.
- إعادة الطلب.

## الدفع
- Submitted.
- Verified.
- Rejected.
- Partial.
- Refunded.

## المالية
- المبيعات.
- التحصيل.
- المصروفات.
- الموردون.
- الاستردادات.
- البنك.

كل تقرير يجب أن يحدد بوضوح هل هو Cash-based أو Order-based أو Accounting-based، حتى لا تختلط الأرقام.

---

# 49. إدارة المساحة والبيانات

لأن البنية قد تستخدم خدمة مجانية محدودة:

- الصور خارج قاعدة البيانات.
- ضغط الصور.
- Pagination لكل القوائم.
- عدم تحميل كل المنتجات مرة واحدة.
- أرشفة السجلات غير النشطة.
- تنظيف الجلسات والسجلات المؤقتة.
- سياسة احتفاظ للـ logs.
- Export دوري للبيانات الضرورية.

لا يتم حذف البيانات المالية لمجرد تقليل الحجم؛ تتم الأرشفة أو النقل وفق سياسة واضحة.

---

# 50. النسخ الاحتياطية والاسترجاع

Admin يستطيع تشغيل:
- Export كامل.
- Export انتقائي.
- Backup metadata.
- Restore وفق صلاحية Super Admin فقط.

قبل Restore:
- تحقق من الإصدار.
- تحقق من الملف.
- سجل العملية.
- يفضل إنشاء نقطة Backup حالية.

---

# 51. Offline/Network Strategy

التطبيق يمكنه تخزين:
- كتالوج حديث.
- تفاصيل مستخدم.
- سلة مسودة.
- إعدادات غير حساسة.

عند انقطاع الشبكة:
- القراءة من Cache حيث تسمح السياسة.
- عرض حالة الاتصال.
- عدم تأكيد عمليات مالية أو مخزنية حساسة كأنها تمت.

بعد عودة الشبكة:
- Sync Drafts وفق قواعد Idempotency.
- إعادة محاولة آمنة.
- عدم تكرار الطلب.

---

# 52. الأخطاء

Error Handling مركزي.

تصنيف:

```text
NETWORK_ERROR
AUTH_ERROR
VALIDATION_ERROR
CONFLICT
OUT_OF_STOCK
PAYMENT_ERROR
PERMISSION_ERROR
SERVER_ERROR
UNKNOWN_ERROR
```

كل Error للمستخدم بلغة مفهومة، بينما التفاصيل التقنية تذهب إلى Logging آمن.

---

# 53. Observability وLogging

تسجيل:
- API failures.
- Payment workflow failures.
- Inventory conflicts.
- Crash metadata.
- App version.
- Critical business events.

لا يتم تسجيل:
- كلمات المرور.
- Tokens السرية.
- بيانات بنكية حساسة كاملة في السجلات العامة.

---

# 54. قواعد التزامن والاتساق

العمليات التالية يجب أن تكون آمنة ضد التزامن:
- بيع آخر قطعة.
- حجز المخزون.
- اعتماد الدفع مرتين.
- Refund مرتين.
- تعديل المخزون.
- استخدام كوبون محدود.

الهدف:

```text
No Negative Stock
No Double Charge Effect
No Double Refund
No Duplicate Order
No Duplicate Stock Reservation
```

---

# 55. التسلسل المحاسبي للطلب المدفوع بتحويل

```text
Customer Checkout
↓
Order Created
↓
Payment Submitted
↓
Payment Verified
↓
Bank Receipt Posted
↓
Order Financial State Updated
↓
Stock Sale/COGS posted according to fulfillment accounting policy
↓
Invoice/Receipt available
```

ويجب تحديد بالتصميم النهائي هل Revenue يثبت عند التأكيد أم عند التسليم بحسب السياسة المحاسبية المطلوبة، وعدم خلط السياستين داخل النظام.

---

# 56. حالات End-to-End الإلزامية للاختبار

## A — شراء ناجح

```text
Browse → Product → Cart → Checkout → Bank Instructions → Submit Payment → Verify → Reserve → Pack → Ship → Deliver → Complete
```

يجب أن يتغير كل من:
- الطلب.
- الدفع.
- المخزون.
- الحساب/البنك.
- الإشعارات.
- التقارير.

## B — دفع ناقص

```text
Order → Partial Payment → Remaining Balance → Complete Payment → Verify → Continue
```

## C — دفع مرفوض

```text
Order → Payment Submitted → Rejected → Customer notified → Retry/Cancel
```

## D — نفاد المخزون قبل التأكيد

```text
Checkout → Server Check → Conflict → No valid order confirmation
```

## E — إلغاء قبل الدفع

```text
Order → Cancel → Release reservation if any → Audit
```

## F — إلغاء بعد الدفع

```text
Order → Refund Request → Approve → Refund → Bank transaction → Finalize
```

## G — إرجاع واسترداد

```text
Delivered → Return Request → Approve → Receive → Inspect → Refund → Inventory Return Movement
```

## H — استبدال

```text
Delivered → Replacement Request → Approve → Return old → Add replacement → Settle difference
```

## I — فشل توصيل

```text
Shipped → Out for Delivery → Failed → Retry OR Return
```

## J — تحديث إجباري

```text
Open App → Version Check → Force Update Screen → Block old app
```

## K — إيقاف جزئي

```text
Catalog ON → Orders OFF → Customer can browse but cannot checkout
```

## L — Emergency Stop

```text
Emergency Stop ON → Block designated critical actions → Show safe message → Admin still accessible if allowed
```

---

# 57. API/Service Boundaries

الخدمات المنطقية:

```text
AuthService
CatalogService
PricingService
CartService
OrderService
PaymentService
InventoryService
ShippingService
ReturnService
RefundService
PurchaseService
AccountingService
CustomerService
ContentService
NotificationService
SupportService
AppControlService
VersionService
AuditService
BackupService
```

كل Service مسؤول عن قواعده، ولا تقوم الواجهات بتنفيذ Business Logic مباشر.

---

# 58. Repository Pattern

Flutter:

```text
Presentation
↓
State/Controller
↓
Use Case
↓
Repository Interface
↓
Remote/Local Data Source
```

هذه الطبقات تمنع ربط الشاشة بمزود التخزين مباشرة.

---

# 59. قاعدة عدم التكرار

لا يوجد:
- منطق سعر داخل Product Screen ومنطق آخر داخل Checkout.
- حساب شحن مختلف بين شاشة السلة والطلب.
- منطق مخزون مختلف بين المستودع والطلب.
- طريقة مستقلة لحساب Refund في كل شاشة.

كل منطق مركزي في Service/Use Case مناسب.

---

# 60. الصفحات الأساسية للعميل

```text
Splash
Onboarding optional
Login/Register
Home
Categories
Search
Product Listing
Product Details
Favorites
Cart
Checkout
Address Selection
Payment Instructions
Submit Payment
Order Success
Orders
Order Details
Tracking
Notifications
Profile
Addresses
Returns
Support
Policies
About
Settings
```

---

# 61. الصفحات الأساسية للإدارة

```text
Admin Login/Role Gate
Dashboard
Operations Center
Orders
Order Details
Payment Queue
Payment Details
Customers
Customer Details
Products
Product Editor
Categories
Brands
Inventory
Stock Movement
Warehouses
Purchases
Suppliers
Shipping
Returns
Refunds
Expenses
Bank Accounts
Bank Transactions
Reports
Coupons
Promotions
Banners
Home Sections
Content Pages
Notifications
Support Tickets
Users
Roles & Permissions
App Control
Remote Config
Version Control
Audit Logs
Backups/Exports
System Health
Settings
```

---

# 62. تحرير المنتج من الإدارة

عند الحفظ:
1. Validate البيانات.
2. تحقق من SKU uniqueness.
3. تحقق من Variant combinations.
4. احفظ المنتج.
5. حدّث المحتوى المرتبط.
6. سجل Audit.
7. أرسل Cache invalidation/event عند الحاجة.

إذا تغير السعر، لا يتم تعديل أسعار الطلبات القديمة؛ الطلب يحتفظ بـ Snapshot لسعره.

---

# 63. تعديل المخزون

هناك نوعان:

### تعديل مبرر
Admin/authorized operator يسجل:
- كمية.
- سبب.
- المستودع.
- المنتج.

### تصحيح بسبب جرد
Inventory Count/Adjustment.

في الحالتين تنشأ Stock Movement، ولا يكتب الرصيد النهائي مباشرة بدون أثر.

---

# 64. جرد المخزون

اختياري في النسخة الأولى لكن البنية يجب أن تكون جاهزة.

```text
Start Count
→ Freeze/Protect relevant movements حسب السياسة
→ Enter counted quantity
→ Compare system vs counted
→ Approve Adjustment
→ Create movements
→ Audit
```

---

# 65. إدارة الحالة الزمنية

أي عرض، كوبون، Banner، أو إعداد موسمي يملك:
- start_at
- end_at
- timezone policy
- active

لا تعتمد الواجهة فقط على إخفائه بعد انتهاء الوقت؛ الخادم يتحقق أيضًا.

---

# 66. المنطقة الزمنية

يجب اعتماد منطقة زمنية واحدة للعمليات التجارية في Backend، وتخزين timestamps بشكل موحد، ثم عرضها للعميل محليًا.

---

# 67. اللغة والأرقام

- RTL.
- تنسيق الأرقام.
- تنسيق العملة من إعداد المتجر.
- تجنب تخزين الرقم كـ formatted string؛ تخزن قيمة رقمية ثم تعرض بالتنسيق.

---

# 68. الأمان

الحد الأدنى:
- HTTPS/TLS.
- Secure token storage.
- Least privilege.
- Server-side authorization.
- Rate limiting للواجهات الحساسة.
- Validation.
- حماية رفع الملفات.
- منع الوصول المباشر للبيانات غير المصرح بها.
- Audit للعمليات الحرجة.

---

# 69. رفع إيصالات الدفع والصور

قبل التخزين:
- التحقق من النوع والحجم.
- ضغط/تحسين الصور.
- اسم تخزين غير قابل للتخمين.
- صلاحيات وصول مناسبة.
- عدم وضع صورة إيصال داخل DB كـ Blob في التصميم الأساسي.

---

# 70. حماية بيانات العميل

الواجهة تعرض فقط ما يحتاجه المستخدم.

موظف المستودع مثلًا لا يرى الحسابات البنكية.

المحاسب لا يحتاج لتعديل Catalog إلا إذا مُنح الصلاحية.

---

# 71. إدارة الحساب البنكي المعروض للعميل

إذا تغير رقم الحساب:
- لا تتغير بيانات الدفع التاريخية للطلبات القديمة.
- كل Payment يحفظ Destination Account Snapshot/Reference عند الإرسال.
- الحساب القديم يمكن تعطيله بدل حذفه.

هذا يمنع عدم تطابق سجل دفع قديم مع بيانات حساب حالي.

---

# 72. قواعد الأسعار التاريخية

Order Item يحفظ:
- product id.
- variant id.
- name snapshot.
- SKU snapshot.
- unit price snapshot.
- discount snapshot.
- quantity.

تعديل المنتج مستقبلًا لا يغيّر الفاتورة التاريخية.

---

# 73. قواعد البيانات الأساسية

الجداول/الكيانات الرئيسية:

```text
users
roles
permissions
user_roles
user_sessions
user_devices

customers
customer_addresses

categories
brands
products
product_variants
product_images
product_attributes

carts
cart_items

orders
order_items
order_status_history
order_events

payment_methods
payment_accounts
payments
payment_proofs
payment_events

invoices
invoice_items

warehouses
inventory_balances
stock_reservations
stock_movements

shipping_methods
shipping_zones
shipments
shipment_events
delivery_attempts

returns
return_items
refunds
refund_events

suppliers
purchases
purchase_items
supplier_payments

bank_accounts
bank_transactions
expenses

coupons
promotions
promotion_rules

banners
home_sections
content_pages

notifications
support_tickets

app_settings
feature_flags
app_versions
maintenance_windows

audit_logs
system_events
backup_jobs
```

الأسماء قد تتكيف مع تقنية قاعدة البيانات، لكن العلاقات والمنطق يجب ألا يضيع.

---

# 74. العلاقات الجوهرية

```text
Customer 1 ─── N Orders
Order 1 ─── N OrderItems
Product 1 ─── N Variants
Variant 1 ─── N StockMovements
Order 1 ─── N Payments
Payment N ─── 1 PaymentAccount
Order 1 ─── N Shipments/Events حسب السياسة
Order 1 ─── N Returns
Return 1 ─── N Refunds/Items حسب السياسة
Supplier 1 ─── N Purchases
BankAccount 1 ─── N BankTransactions
```

كل مرجع مالي حساس يجب أن يبقى قابلًا للتتبع إلى المصدر التجاري.

---

# 75. Transaction Boundaries

عمليات تحتاج Transaction/atomicity قدر الإمكان:

- إنشاء الطلب + حجز المخزون.
- اعتماد الدفع + تحديث حالة الدفع + الأثر المالي.
- إرجاع المخزون + إغلاق Return.
- Refund + الأثر المالي.
- تعديل المخزون + Stock Movement.
- استلام شراء + زيادة المخزون.

إذا كانت بعض المكونات خارج نفس قاعدة البيانات، تستخدم Outbox/Eventual Consistency مع حالات واضحة وإعادة محاولة آمنة.

---

# 76. Outbox/Events عند الحاجة

للأحداث غير المتزامنة:

```text
OrderCreated
PaymentVerified
OrderPacked
ShipmentUpdated
ReturnApproved
RefundCompleted
```

تُستخدم لتغذية:
- الإشعارات.
- Analytics.
- Cache invalidation.
- التكاملات المستقبلية.

الأحداث لا تستبدل السجل الأساسي.

---

# 77. سياسة التعارض

إذا فتح موظفان نفس الطلب:
- كل عملية تتحقق من آخر version/state.
- إذا تغيرت الحالة، يطلب النظام تحديث الشاشة بدل الكتابة فوق التغيير.

يمكن استخدام optimistic concurrency/version fields.

---

# 78. التجارة عبر الأجهزة المختلفة

العميل يستطيع تسجيل الدخول من Android أو iPhone.

البيانات الحقيقية مرتبطة بحساب العميل على الخادم، وليست مخزنة داخل جهاز واحد.

السلة يمكن مزامنتها بعد تسجيل الدخول وفق سياسة واضحة.

---

# 79. الصور والمحتوى والأداء

- Lazy loading.
- Pagination.
- Thumbnails.
- WebP/AVIF عند دعم البيئة.
- Cache للصور.
- لا تحمل الإدارة آلاف الصور دفعة واحدة.

---

# 80. قابلية التوسع

يمكن لاحقًا إضافة:
- موقع ويب.
- POS داخل المتجر.
- تطبيق مندوب مستقل.
- أكثر من فرع.
- أكثر من مخزن.
- أكثر من عملة.
- شركات شحن متعددة.
- بوابات دفع.

بدون إعادة تصميم Business Core من الصفر.

---

# 81. سياسة فشل الخدمات

إذا Storage متوقف:
- يمنع رفع إيصال جديد إن كان مطلوبًا.
- لا يعتبر الدفع Verified.

إذا Notification Service فاشل:
- العملية التجارية لا تفشل بسبب الإشعار.
- يعاد الإرسال عبر Queue.

إذا WhatsApp غير مثبت:
- يعرض بديل الاتصال/نسخ الرقم.

إذا الإنترنت ضعيف:
- لا ينشئ الطلب مرتين.

---

# 82. شاشة حالة الطلب للعميل

تقرأ من Order + Order Events المسموح عرضها.

مثال:

```text
✓ تم إنشاء الطلب
✓ تم استلام الدفع
✓ تم تجهيز الطلب
✓ تم تسليمه للشحن
✓ خرج للتوصيل
○ تم التسليم
```

الخط الزمني لا يكذب على العميل: إذا لم يتم التحقق من الدفع فلا يظهر “تم الدفع”.

---

# 83. تجربة Checkout

ترتيب مقترح:

```text
Cart Summary
↓
Address
↓
Shipping Method
↓
Payment Method
↓
Order Review
↓
Confirm
```

في المراجعة الأخيرة يظهر:
- المنتجات.
- الكمية.
- السعر.
- الخصم.
- الشحن.
- الإجمالي.
- وسيلة الدفع.
- العنوان.

---

# 84. ما بعد إنشاء الطلب

Success Screen تعرض:

```text
Order Number
Payment Reference
Tracking Code
Payment Instructions
WhatsApp Help
View Order
```

ولا تفترض أن الدفع تم بمجرد إنشاء الطلب.

---

# 85. انتهاء صلاحية الدفع

إذا لم يصل الدفع خلال المدة:
- Order/Pament يصبح Expired حسب السياسة.
- يتم Release للحجز إن وجد.
- العميل يرى سببًا واضحًا.
- لا يحذف السجل.

إذا وصل تحويل بعد انتهاء الطلب، يدخل Review وليس Auto-Apply.

---

# 86. إعادة المحاولة

كل طلبة شبكة حساسة لها retry policy.

لكن Retry لا يعني تنفيذ العملية مرتين.

يستخدم:
- Idempotency Key.
- Request ID.
- Server state check.

---

# 87. التحكم في المتجر من الإدارة

صفحة Store Control:

```text
Store Online
Orders
Checkout
Payments
COD
Returns
Reviews
Registration
WhatsApp
```

كل مفتاح يملك:
- Current Value.
- Last Changed By.
- Last Changed At.
- Optional reason.

---

# 88. التحكم في المحتوى من الإدارة

المدير يمكنه تغيير محتوى الواجهة دون نشر إصدار:

```text
Home Sections
Banner
Category Order
Featured Products
Promo Cards
Policy Pages
Contact Information
```

التغييرات تظهر بعد refresh/cache invalidation وفق سياسة مناسبة.

---

# 89. التحكم في الإصدارات من الإدارة

Version record:

```text
platform
version_name
build_number
minimum_supported
latest
release_notes
download_url
mandatory
active
```

يجب مقارنة build number/version بطريقة صحيحة، وليس Lexicographic string فقط.

---

# 90. الصحة النظامية

System Health:
- Backend reachable.
- DB reachable.
- Storage reachable.
- Queue health.
- Recent errors.
- App distribution.
- Active version.

هذه شاشة مراقبة، وليس بديلًا عن monitoring خارجي عند التوسع.

---

# 91. القواعد الخاصة بالبيانات القديمة

Archive candidates:
- notifications القديمة.
- logs غير الحساسة.
- sessions المنتهية.
- بيانات cache.

Orders/Payments/Bank/Accounting/Stock history تحفظ وفق retention policy؛ الأرشفة لا تكسر العلاقات.

---

# 92. القواعد الخاصة بالـ Delete

يمكن حذف:
- Banner draft.
- Content draft غير منشور.
- صورة غير مستخدمة.

لا تحذف مباشرة:
- Order.
- Payment.
- Bank Transaction.
- Stock Movement.
- Invoice.
- Refund.

تستخدم حالات وتدقيقًا.

---

# 93. حالات الحسابات والأرصدة

لا يُشتق رصيد حساب مالي من “آخر قيمة تم تعديلها” فقط.

يفضل أن يكون:

```text
Opening Balance
+ Transactions
= Current Balance
```

ويمكن إضافة snapshots/aggregates للأداء، لكن المصدر القابل للتدقيق هو الحركة.

---

# 94. قواعد Customer Credit

إن دعم النظام رصيد عميل:
- كل Credit/Debit له حركة مرجعية.
- لا يعدل الرصيد مباشرة.
- يظهر كشف حساب.
- Refund يتحول إلى Credit فقط إذا اعتمدته السياسة.

---

# 95. تسوية الطلبات القديمة

يجب أن توجد وظيفة reconciliation تفحص:
- Orders دون Payment state متسق.
- Payments دون Orders.
- Reservations قديمة.
- Refunds غير مكتملة.
- Shipments عالقة.

تنتج قائمة Recovery وليس حذفًا آليًا.

---

# 96. اختبارات الوحدات والعمليات

## Unit Tests

- pricing.
- discounts.
- shipping.
- status transitions.
- permission checks.
- money calculations.

## Integration Tests

- Order + inventory.
- Payment + accounting.
- Return + inventory + refund.
- Purchase + supplier + stock.

## End-to-End Tests

كل السيناريوهات المذكورة في القسم 56.

## Failure Tests

- double tap.
- timeout.
- duplicate request.
- stale state.
- out-of-stock conflict.
- permission denial.
- broken image/storage.

---

# 97. معايير قبول المشروع

لا تعتبر الوحدة مكتملة إذا:

1. الواجهة تعمل لكن بياناتها لا تحفظ.
2. العملية تحفظ لكن لا تحدث الحالات التابعة.
3. الدفع يغير الطلب دون أثر مالي.
4. الإرجاع يرجع للعميل دون حركة مخزون.
5. المخزون يتغير دون حركة.
6. تعديل السعر يغير الطلبات القديمة.
7. حذف سجل مالي ممكن من الواجهة العادية.
8. الحالة يمكن تخطيها دون شروط.
9. موظف غير مصرح يستطيع استدعاء API المحمي.
10. إعادة الطلب بسبب الشبكة تنشئ نسخة ثانية.

---

# 98. تعريف Done لكل Feature

الـ Feature لا تصبح Done إلا عند توفر:

```text
UI
+ Validation
+ Backend/API
+ Database
+ Authorization
+ State transitions
+ Error handling
+ Audit where needed
+ Loading/empty/error states
+ Tests
+ End-to-End integration
```

---

# 99. ترتيب التنفيذ العملي

## Phase 1 — Foundation

- Flutter project.
- Routing.
- Theme/RTL.
- Networking.
- DI.
- Logging.
- Error handling.
- Auth shell.

## Phase 2 — Backend/Data Core

- Users/Roles.
- Catalog.
- Customers.
- Inventory core.
- Orders core.
- Payments core.

## Phase 3 — Customer Commerce

- Home.
- Catalog.
- Product.
- Cart.
- Checkout.
- Address.
- Payment submission.
- Orders.

## Phase 4 — Operations

- Admin dashboard.
- Payment review.
- Order processing.
- Warehouse.
- Shipping.

## Phase 5 — Finance

- Bank accounts.
- Transactions.
- Purchases.
- Suppliers.
- Expenses.
- Refunds.
- Reports.

## Phase 6 — Content/Control

- Banners.
- Home sections.
- Promotions.
- Remote Config.
- Feature Flags.
- Version control.
- Maintenance.

## Phase 7 — Hardening

- Audit.
- Backup.
- Security.
- Concurrency.
- Failure recovery.
- Full E2E tests.
- Release builds.

---

# 100. ترتيب تنفيذ كل وحدة

عند تنفيذ أي وحدة يجب اتباع:

```text
1. Domain/Data Model
2. Database/API Contract
3. Business Rules
4. State Machine
5. Repository/Service
6. API implementation
7. Flutter State
8. Screens
9. Error/Loading/Empty states
10. Authorization
11. Audit/Event hooks
12. Tests
13. End-to-End verification
```

لا يتم القفز مباشرة إلى تصميم الشاشة.

---

# 101. قاعدة العمل على PLAN.md

المشروع ينفذ تدريجيًا، وليس دفعة واحدة.

بعد كل Phase:
- Build.
- Analyze.
- Test.
- Fix.
- Verify integration.
- تحديث progress.

لا يتم الانتقال إلى Feature جديدة إذا كانت Feature السابقة تكسر التدفق السابق.

---

# 102. سياسة التغيير

عند طلب ميزة جديدة:

1. تحديد الكيانات المتأثرة.
2. تحديد التدفقات المتأثرة.
3. تحديد API/DB changes.
4. تحديد التقارير المتأثرة.
5. تحديد permissions.
6. تحديد Audit.
7. تحديد الاختبارات.
8. تنفيذ التغيير.
9. تشغيل regression tests.

لا تضاف ميزة فوق النظام دون فحص الترابط.

---

# 103. مثال على Feature صحيحة

Feature: “إيقاف التحويل البنكي”.

ليست مجرد Toggle في UI.

يجب أن تؤثر على:
- Remote Config.
- Checkout payment methods.
- Order creation validation.
- Admin status.
- Customer error message.
- Audit Log.
- Tests.

وهذا هو تعريف “ميزة متكاملة”.

---

# 104. مثال ثانٍ: إضافة حساب بنكي جديد

الإدارة:
1. تنشئ الحساب.
2. تعتمد الصلاحية.
3. الحساب يصبح Active.
4. يظهر في Checkout.
5. العميل يرى معلوماته.
6. Payment يحفظ account reference/snapshot.
7. Verification تربط الدفع بالحساب.
8. Bank transaction تحفظ على الحساب.
9. التقرير البنكي يعرض الحركة.
10. تعطيل الحساب يمنع استخدامه للمدفوعات الجديدة ولا يفسد العمليات التاريخية.

---

# 105. مثال ثالث: تغيير سعر المنتج

الإدارة تغير 20,000 إلى 25,000.

النظام:
- المنتجات الجديدة تستخدم 25,000.
- السلال الحالية يعاد تسعيرها عند Checkout.
- الطلبات المنشأة سابقًا تحتفظ بسعرها التاريخي.
- Audit يسجل القديم والجديد.
- لا يتم تعديل الفواتير السابقة.

---

# 106. مثال رابع: Refund

```text
Customer requests return
↓
Return approved
↓
Product received
↓
Inspection passed
↓
Refund approved
↓
Refund transaction created
↓
Bank/Credit balance updated
↓
Order financial state updated
↓
Customer notified
↓
Audit complete
```

إذا فشل أي جزء، الحالة تعكس ذلك ولا تدعي النجاح.

---

# 107. قاعدة الأرقام المالية

كل الحسابات المالية يجب أن تستخدم نوعًا رقميًا مناسبًا للأموال وتجنب floating point غير المنضبط.

يتم توحيد:
- precision.
- rounding.
- currency.

والتقريب يحدد في Service مركزي.

---

# 108. قاعدة العملة

كل مبلغ مالي يحمل:
- amount.
- currency.

إذا كانت النسخة الأولى بعملة واحدة، يظل الحقل موجودًا للتوسع، مع منع خلط عملتين في عملية واحدة دون قاعدة تحويل صريحة.

---

# 109. قاعدة الخصوصية

لا تعرض معلومات حساسة أكثر من اللازم في:
- Notifications.
- Screenshots.
- Logs.
- URLs.

Payment proof URLs يجب ألا تكون عامة بلا حماية إذا كانت البيانات حساسة.

---

# 110. قاعدة تجربة المستخدم

كل شاشة يجب أن تحتوي على الحالات:

```text
Loading
Success
Empty
Error
Permission denied
Offline where applicable
```

ولا توجد شاشة بيضاء عند فشل API.

---

# 111. الصفحة الرئيسية عند تعطل الخدمات

إذا فشل تحميل بعض المحتوى:
- تعرض البيانات الأساسية المخزنة أو الأقسام المتاحة.
- لا تنهار الصفحة كلها.
- تعرض رسالة غير مزعجة.

---

# 112. إمكانية التوسع إلى POS لاحقًا

إذا أضيف POS مستقبلاً، لا يستخدم منطقًا جديدًا للحساب؛ يستعمل نفس:
- Product/Variant.
- Inventory.
- Pricing.
- Order.
- Payment.
- Accounting.

مع إضافة Channel = POS/ONLINE.

---

# 113. Source of Truth Matrix

| البيانات | المصدر النهائي |
|---|---|
| السعر الحالي | Backend Catalog/Pricing |
| السعر التاريخي | Order Item Snapshot |
| المخزون | Inventory Ledger/Balance |
| حالة الطلب | Order State |
| حالة الدفع | Payment State |
| حركة البنك | Bank Transaction |
| الفاتورة | Invoice + Order snapshot |
| صلاحية المستخدم | Authorization system |
| إعدادات المتجر | Remote Config/App Settings |
| نسخة التطبيق | Version Service |
| حالة الشحن | Shipment |
| حالة الإرجاع | Return |

---

# 114. أهم End-to-End Chain في النظام

هذه السلسلة يجب أن تبقى صحيحة دائمًا:

```text
PRODUCT
  ↓
PRICE
  ↓
CART
  ↓
CHECKOUT
  ↓
ORDER
  ↓
PAYMENT
  ↓
BANK / CASH COLLECTION
  ↓
STOCK RESERVATION
  ↓
PROCESSING
  ↓
SHIPMENT
  ↓
DELIVERY
  ↓
COMPLETION
```

وفي المسار العكسي:

```text
DELIVERY / COMPLETION
  ↓
RETURN
  ↓
INSPECTION
  ↓
INVENTORY RETURN OR NON-RETURN
  ↓
REFUND / CREDIT
  ↓
BANK / CUSTOMER BALANCE
  ↓
FINALIZED
```

---

# 115. ما يجب ألا يحدث أبدًا

- طلب بدون رقم فريد.
- Payment بدون Order reference.
- Refund بدون مرجع مالي.
- Sale تقلل المخزون دون Stock Movement.
- Return تزيد المخزون بدون فحص الحالة/السياسة.
- تغيير Product يمس تاريخ Order.
- حساب بنكي معطل يقبل مدفوعات جديدة.
- موظف غير مصرح يعتمد Payment.
- الضغط المتكرر ينشئ Order ثاني.
- Force Update يمكن تجاوزه من نسخة قديمة.
- Emergency Stop يتوقف بمجرد إعادة تشغيل التطبيق لأن الإعداد يجب أن يكون مركزيًا.
- Dashboard يعرض رقمًا لا يمكن الوصول إلى مصدره.

---

# 116. Definition of Production Ready

المشروع يعتبر Production Ready فقط عندما:

- Flutter builds نظيفة على Android وiPhone target.
- Backend deployed بطريقة موثوقة.
- Database migrations tested.
- Authentication and authorization tested.
- Full critical E2E flows pass.
- Payment workflow pass.
- Inventory concurrency pass.
- Refund/Return pass.
- Audit pass.
- Backup/export pass.
- Version control pass.
- Maintenance/emergency controls pass.
- Error handling pass.
- No known critical business logic defects.

---

# 117. مبدأ التنفيذ الأخير

لا نريد بناء “شاشات كثيرة”.
نريد بناء “دورات عمل صحيحة”.

كل Feature يجب أن تجيب عن الأسئلة الأربعة:

1. من يبدأ العملية؟
2. أين تحفظ الحقيقة؟
3. ما الحالات التي تمر بها؟
4. ما الذي يتغير في الوحدات الأخرى؟

إذا لم تكن الإجابات واضحة، فالـ Feature لم تكتمل بعد.

---

# 118. النتيجة المستهدفة

عند اكتمال المشروع، يجب أن يستطيع السيناريو التالي العمل دون تدخل يدوي خارج النظام إلا حيث يتطلب الدفع البنكي تحققًا بشريًا:

```text
عميل
→ يفتح التطبيق
→ يتصفح
→ يختار Variant
→ يضيف للسلة
→ يحدد عنوانه
→ يرى الشحن
→ يؤكد الطلب
→ يحصل على Payment Reference
→ يحول إلى الحساب المعلن
→ يسجل التحويل
→ الإدارة ترى الدفع
→ تتحقق منه
→ النظام يسجل الأثر المالي
→ يحجز/يؤكد المخزون
→ المستودع يجهز
→ الشحن يستلم
→ العميل يتابع
→ يتم التسليم
→ الطلب يكتمل
→ التقارير والمخزون والحسابات تتحدث
```

وفي حالة الفشل:

```text
Wrong Amount
→ Partial/Review

Rejected Payment
→ Retry/Cancel

Out of Stock
→ Conflict/Resolution

Failed Delivery
→ Retry/Return

Return
→ Inspection
→ Inventory decision
→ Refund/Credit
```

وفي حالة تشغيل المتجر:

```text
Admin
→ يغير المحتوى
→ يغير الأسعار
→ يغير الحسابات المتاحة
→ يوقف الدفع
→ يوقف الطلبات
→ يضع Maintenance
→ يفرض إصدارًا جديدًا
→ يراجع النظام
→ يصدر تقارير
```

وهذا هو معيار التكامل: **أي تغيير إداري أو تجاري يجب أن ينعكس فقط في الأماكن التي ينبغي أن يتأثر بها، وأن يترك السجلات التاريخية الصحيحة دون كسر العلاقات أو الحسابات.**

---

# 119. قاعدة تنفيذ صارمة للمطور/نموذج الذكاء الاصطناعي

- اقرأ هذا الملف كاملًا قبل تعديل البنية.
- لا تبنِ Feature معزولة.
- لا تنشئ Business Logic داخل UI.
- لا تستخدم Mock كبديل دائم عن النظام الحقيقي.
- لا تعتبر “الشاشة ظهرت” إنجازًا كافيًا.
- كل زر يجب أن يؤدي إلى عملية حقيقية أو حالة واضحة.
- كل عملية يجب أن تحدث الكيانات التابعة لها.
- كل عملية حساسة لها Audit.
- كل State Transition له شروط.
- لا تكسر API أو Database contracts القائمة دون Migration وخطة ترقية.
- بعد أي تغيير، شغّل Regression على التدفقات المتأثرة.
- لا تحذف التاريخ التجاري لتسهيل البرمجة.
- لا تضف خدمة خارجية دون Adapter/Repository مناسب.
- لا تربط المشروع بمزود واحد بطريقة تمنع الهجرة مستقبلًا.

---

# 120. معيار القبول النهائي الشامل

يمكن اعتبار المشروع مكتملًا فقط عندما يستطيع الفريق إثبات هذه السلسلة بالبيانات الفعلية:

```text
Customer
→ Product
→ Variant
→ Cart
→ Checkout
→ Order
→ Payment Reference
→ Payment Submission
→ Payment Verification
→ Bank Transaction
→ Stock Reservation
→ Warehouse Processing
→ Shipment
→ Delivery
→ Invoice/Financial State
→ Reports
```

وكذلك:

```text
Order
→ Return
→ Inspection
→ Inventory Adjustment/Return
→ Refund
→ Bank/Credit Update
→ Audit
```

وكذلك:

```text
Admin
→ Change Setting
→ API enforces it
→ Customer sees effect
→ Existing historical records remain correct
→ Audit records the change
```

إذا نجحت هذه السلاسل والسيناريوهات السلبية والاختبارات المرتبطة بها، يكون لدينا متجر متكامل فعليًا بدل مجموعة شاشات متجاورة.

---

# END OF PLAN.md
