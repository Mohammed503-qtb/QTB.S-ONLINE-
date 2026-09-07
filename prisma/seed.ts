// ============================================================
// Seed — بيانات واقعية لمتجر يمني متكامل
// يستخدم المحركات الحقيقية (createOrder/submitPayment/verify...)
// لتوليد طلبات demo بسلاسل كاملة: حركات مخزون + مدفوعات + بنك + Audit
// تشغيل: bun prisma/seed.ts
// ============================================================

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// مساعدات
function daysAgo(n: number, h = 10) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(h, 0, 0, 0)
  return d
}

async function main() {
  console.log('🧹 تنظيف البيانات القديمة...')
  await wipe()

  console.log('👥 إنشاء المستخدمين والأدوار...')
  await seedUsers()
  await seedFlagsAndSettings()
  await seedCatalog()
  await seedShipping()
  await seedPayments()
  await seedBanks()
  await seedSuppliersAndPurchases()
  await seedContent()
  await seedCoupons()
  await seedDemoOrders()

  console.log('✅ اكتمل التهيئة بنجاح!')
}

async function wipe() {
  const tables = [
    'refundEvent', 'refund', 'returnItem', 'returnRequest',
    'deliveryAttempt', 'shipmentEvent', 'shipment', 'orderEvent', 'orderStatusHistory',
    'orderItem', 'invoice', 'paymentEvent', 'payment',
    'stockMovement', 'stockReservation', 'inventoryBalance', 'purchase',
    'supplierPayment', 'couponRedemption', 'coupon', 'review', 'favorite',
    'supportMessage', 'supportTicket', 'notification', 'auditLog',
    'bankTransaction', 'bankAccount', 'expense',
    'order', 'customerAddress', 'customer', 'userSession', 'user',
    'productImage', 'productVariant', 'product', 'brand', 'category',
    'warehouse', 'shippingZone', 'shippingMethod', 'paymentAccount', 'paymentMethod',
    'banner', 'homeSection', 'contentPage', 'featureFlag', 'appSetting',
    'appVersion', 'maintenanceWindow', 'sequenceCounter', 'idempotencyKey',
  ]
  for (const t of tables) {
    try {
       
      await (db as any)[t.charAt(0).toLowerCase() + t.slice(1)].deleteMany()
    } catch { /* قد لا يوجد النموذج */ }
  }
}

// ---------- المستخدمون ----------
async function seedUsers() {
  const users = [
    { phone: '777000001', name: 'المدير العام', role: 'SUPER_ADMIN' },
    { phone: '777000002', name: 'مدير المتجر', role: 'MANAGER' },
    { phone: '777000003', name: 'المحاسب الرئيسي', role: 'ACCOUNTANT' },
    { phone: '777000004', name: 'أمين المستودع', role: 'WAREHOUSE' },
    { phone: '777000005', name: 'مدير المحتوى', role: 'CONTENT_MANAGER' },
    { phone: '777000006', name: 'موظف الشحن', role: 'DELIVERY_OPERATOR' },
    { phone: '712345678', name: 'أحمد محمد', role: 'CUSTOMER' },
    { phone: '723456789', name: 'سارة علي', role: 'CUSTOMER' },
    { phone: '734567890', name: 'محمد صالح', role: 'CUSTOMER' },
  ]
  for (const u of users) {
    await db.user.create({ data: u })
  }
  // ملفات العملاء + العناوين
  const ahmed = await db.customer.create({
    data: {
      userId: (await db.user.findUniqueOrThrow({ where: { phone: '712345678' } })).id,
      tier: 'REGULAR',
    },
  })
  await db.customerAddress.create({
    data: {
      customerId: ahmed.id,
      label: 'المنزل',
      governorate: 'عدن',
      city: 'عدن',
      district: 'المنصورة',
      neighborhood: 'الحي السكني',
      street: 'شارع 14',
      landmark: 'بجوار صيدلية النور',
      phone: '712345678',
      isDefault: true,
    },
  })
  await db.customerAddress.create({
    data: {
      customerId: ahmed.id,
      label: 'العمل',
      governorate: 'عدن',
      city: 'عدن',
      district: 'كريتر',
      neighborhood: 'الميدان',
      street: 'شارع الميدان',
      phone: '712345678',
    },
  })
  const Sara = await db.user.findUniqueOrThrow({ where: { phone: '723456789' } })
  await db.customer.create({ data: { userId: Sara.id } })
  const Mohamed = await db.user.findUniqueOrThrow({ where: { phone: '734567890' } })
  await db.customer.create({ data: { userId: Mohamed.id } })
}

// ---------- الأعلام والإعدادات ----------
async function seedFlagsAndSettings() {
  const flags: [string, boolean, string][] = [
    ['store_enabled', true, 'المتجر مفتوح'],
    ['catalog_enabled', true, 'الكتالوج متاح'],
    ['registration_enabled', true, 'التسجيل مفتوح'],
    ['orders_enabled', true, 'الطلبات مفتوحة'],
    ['checkout_enabled', true, 'إتمام الشراء متاح'],
    ['bank_transfer_enabled', true, 'الدفع بالتحويل البنكي'],
    ['cash_on_delivery_enabled', true, 'الدفع عند الاستلام'],
    ['returns_enabled', true, 'الإرجاع متاح'],
    ['reviews_enabled', true, 'التقييمات متاحة'],
    ['whatsapp_enabled', true, 'زر واتساب'],
    ['coupons_enabled', true, 'الكوبونات'],
    ['maintenance_mode', false, 'وضع الصيانة'],
    ['emergency_stop', false, 'إيقاف طارئ'],
    ['force_update', false, 'تحديث إجباري'],
  ]
  for (const [key, value, label] of flags) {
    await db.featureFlag.create({ data: { key, value, label } })
  }

  const settings: [string, string, string, string][] = [
    ['store_name', 'متجر الأصيل', 'general', 'اسم المتجر'],
    ['store_tagline', 'تسوق بثقة — يصلك أينما كنت في اليمن', 'general', 'الشعار النصي'],
    ['store_logo_url', '/uploads/logo.svg', 'general', 'رابط الشعار'],
    ['whatsapp_number', '96712345678', 'general', 'رقم واتساب'],
    ['support_phone', '771234567', 'general', 'هاتف الدعم'],
    ['currency', 'YER', 'general', 'العملة'],
    ['currency_symbol', 'ريال', 'general', 'رمز العملة'],
    ['payment_expiry_hours', '48', 'orders', 'مدة صلاحية الدفع (ساعة)'],
    ['cod_fee_extra', '500', 'orders', 'رسوم إضافية للدفع عند الاستلام'],
    ['return_window_days', '7', 'orders', 'نافذة الإرجاع (أيام)'],
    ['min_order_total', '0', 'orders', 'الحد الأدنى للطلب'],
    ['store_hours', 'السبت - الخميس: 8 صباحًا - 10 مساءً', 'general', 'أوقات العمل'],
    ['store_address', 'عدن - المنصورة - شارع 14', 'general', 'عنوان المتجر'],
    ['maintenance_message', 'المتجر متوقف مؤقتًا للصيانة، سنعود قريبًا بإذن الله', 'general', 'رسالة الصيانة'],
    ['cod_bank_account_id', '', 'finance', 'حساب تحصيل الدفع عند الاستلام'],
  ]
  for (const [key, value, group, label] of settings) {
    await db.appSetting.create({ data: { key, value, group, label } })
  }

  await db.appVersion.create({
    data: { platform: 'WEB', versionName: '1.0.0', buildNumber: 1, isLatest: true, minimumSupported: true, releaseNotes: 'الإصدار الأول' },
  })
}

// ---------- الكتالوج ----------
async function seedCatalog() {
  const cats: [string, string, number][] = [
    ['ملابس رجالية', 'mens-clothing', 1], ['ملابس نسائية', 'womens-clothing', 2],
    ['عطور', 'perfumes', 3], ['إلكترونيات', 'electronics', 4],
    ['أحذية', 'shoes', 5], ['حقائب', 'bags', 6],
    ['أكسسوارات', 'accessories', 7], ['مستلزمات منزلية', 'home', 8],
  ]
  const catIds: Record<string, string> = {}
  for (const [name, slug, sortOrder] of cats) {
    const c = await db.category.create({ data: { name, slug, sortOrder, imageUrl: `/uploads/products/cat-${slug}.svg` } })
    catIds[slug] = c.id
  }

  const brands: [string, string, number][] = [['الأصيل', 'alaseel', 1], ['يماني', 'yamani', 2], ['عدن جولد', 'aden-gold', 3], ['تك نوفا', 'tecnova', 4], ['عبق اليمن', 'aroma-ye', 5]]
  const brandIds: Record<string, string> = {}
  for (const [name, slug, sortOrder] of brands) {
    const b = await db.brand.create({ data: { name, slug, sortOrder } })
    brandIds[slug] = b.id
  }

  type P = {
    name: string, slug: string, cat: string, brand?: string, basePrice: number, compareAt?: number,
    cost: number, img: string, desc: string, featured?: boolean,
    variants: { attrs: Record<string, string>; extra?: number }[]
  }
  const products: P[] = [
    {
      name: 'ثوب رجالي قطن فاخر', slug: 'thobe-cotton', cat: 'mens-clothing', brand: 'alaseel',
      basePrice: 18000, compareAt: 22000, cost: 11000, img: '/uploads/products/thobe.webp',
      desc: 'ثوب رجالي من القطن المصري الفاخر، خياطة متقنة، مناسب لجميع المناسبات. مريح وقابل للتنفس في الأجواء الحارة.',
      featured: true,
      variants: [
        { attrs: { 'اللون': 'أبيض', 'المقاس': '52' } }, { attrs: { 'اللون': 'أبيض', 'المقاس': '54' } },
        { attrs: { 'اللون': 'أبيض', 'المقاس': '56' } }, { attrs: { 'اللون': 'بيج', 'المقاس': '54' } },
      ],
    },
    {
      name: 'قميص قطن كاجوال', slug: 'shirt-casual', cat: 'mens-clothing', brand: 'yamani',
      basePrice: 12500, compareAt: 15000, cost: 7000, img: '/uploads/products/shirt.webp',
      desc: 'قميص كاجوال قطن 100% بقصة عصرية، مناسب للعمل والخروج.',
      variants: [
        { attrs: { 'اللون': 'أزرق فاتح', 'المقاس': 'M' } }, { attrs: { 'اللون': 'أزرق فاتح', 'المقاس': 'L' } },
        { attrs: { 'اللون': 'أبيض', 'المقاس': 'L' } }, { attrs: { 'اللون': 'أسود', 'المقاس': 'XL' } },
      ],
    },
    {
      name: 'بنطال جينز كلاسيك', slug: 'jeans-classic', cat: 'mens-clothing', brand: 'yamani',
      basePrice: 15000, cost: 9000, img: '/uploads/products/jeans.webp',
      desc: 'بنطال جينز متين بقصة مستقيمة، قماش سميك عالي الجودة.',
      variants: [
        { attrs: { 'المقاس': '30' } }, { attrs: { 'المقاس': '32' } }, { attrs: { 'المقاس': '34' } }, { attrs: { 'المقاس': '36' } },
      ],
    },
    {
      name: 'عباية كلوش مطرزة', slug: 'abaya-cloche', cat: 'womens-clothing', brand: 'alaseel',
      basePrice: 22000, compareAt: 28000, cost: 14000, img: '/uploads/products/abaya.webp',
      desc: 'عباية كلوش بتطريز يدوي راقٍ على الأكمام، قماش كريب فاخر لا يتجعد.',
      featured: true,
      variants: [
        { attrs: { 'اللون': 'أسود', 'المقاس': 'S' } }, { attrs: { 'اللون': 'أسود', 'المقاس': 'M' } },
        { attrs: { 'اللون': 'كحلي', 'المقاس': 'M' } }, { attrs: { 'اللون': 'بني', 'المقاس': 'L' } },
      ],
    },
    {
      name: 'فستان سهرة أنيق', slug: 'evening-dress', cat: 'womens-clothing',
      basePrice: 35000, compareAt: 42000, cost: 22000, img: '/uploads/products/dress.webp',
      desc: 'فستان سهرة بتصميم راقٍ وتفاصيل لامعة، مثالي للمناسبات الخاصة.',
      variants: [
        { attrs: { 'اللون': 'أحمر', 'المقاس': 'M' } }, { attrs: { 'اللون': 'زيتي', 'المقاس': 'M' } }, { attrs: { 'اللون': 'أسود', 'المقاس': 'L' } },
      ],
    },
    {
      name: 'طرحة حرير طبيعي', slug: 'silk-scarf', cat: 'womens-clothing', brand: 'yamani',
      basePrice: 8000, cost: 4500, img: '/uploads/products/scarf.webp',
      desc: 'طرحة من الحرير الطبيعي بخفة وأناقة، بألوان متعددة تناسب كل الإطلالات.',
      variants: [
        { attrs: { 'اللون': 'بيج' } }, { attrs: { 'اللون': 'وردي' } }, { attrs: { 'اللون': 'رمادي' } },
      ],
    },
    {
      name: 'عطر عود ملكي 50 مل', slug: 'royal-oud', cat: 'perfumes', brand: 'aroma-ye',
      basePrice: 28000, compareAt: 34000, cost: 16000, img: '/uploads/products/oud-perfume.webp',
      desc: 'عطر شرقي فاخر بمزيج العود الكمبودي والعنبر والمسك، ثبات يدوم أكثر من 12 ساعة.',
      featured: true,
      variants: [{ attrs: { 'الحجم': '50 مل' } }],
    },
    {
      name: 'عطر مسك الطهارة 30 مل', slug: 'musk-tahara', cat: 'perfumes', brand: 'aroma-ye',
      basePrice: 15000, cost: 8000, img: '/uploads/products/musk-perfume.webp',
      desc: 'مسك أبيض نقي برائحة نظيفة هادئة، مناسب للاستخدام اليومي.',
      variants: [{ attrs: { 'الحجم': '30 مل' } }],
    },
    {
      name: 'دهن عود كمبودي 12 مل', slug: 'cambodi-oud-oil', cat: 'perfumes', brand: 'aroma-ye',
      basePrice: 65000, compareAt: 78000, cost: 40000, img: '/uploads/products/oud-oil.webp',
      desc: 'دهن عود كمبودي أصلي 100%، تركيز عالٍ وثبات استثنائي. للمناسبات الكبرى.',
      variants: [{ attrs: { 'الحجم': '12 مل' } }],
    },
    {
      name: 'سماعة بلوتوث لاسلكية', slug: 'bt-earbuds', cat: 'electronics', brand: 'tecnova',
      basePrice: 9500, compareAt: 12000, cost: 5500, img: '/uploads/products/earbuds.webp',
      desc: 'سماعة لاسلكية بتقنية بلوتوث 5.3، عزل ضوضاء، بطارية تدوم 24 ساعة مع علبة الشحن، مقاومة للماء IPX5.',
      featured: true,
      variants: [
        { attrs: { 'اللون': 'أبيض' } }, { attrs: { 'اللون': 'أسود' } },
      ],
    },
    {
      name: 'ساعة ذكية سمارت واتش', slug: 'smartwatch', cat: 'electronics', brand: 'tecnova',
      basePrice: 19000, compareAt: 24000, cost: 12000, img: '/uploads/products/smartwatch.webp',
      desc: 'ساعة ذكية بشاشة AMOLED، تتبع النبض والنوم، إشعارات المكالمات والرسائل، أكثر من 100 نمط رياضي.',
      variants: [{ attrs: { 'اللون': 'أسود' } }, { attrs: { 'اللون': 'فضي' } }],
    },
    {
      name: 'باور بانك 20000 مللي أمبير', slug: 'powerbank-20k', cat: 'electronics', brand: 'tecnova',
      basePrice: 7500, cost: 4200, img: '/uploads/products/powerbank.webp',
      desc: 'بطارية متنقلة بسعة 20000mAh، شحن سريع 22.5W، منفذان USB ومنفذ Type-C.',
      variants: [{ attrs: {} }],
    },
    {
      name: 'حذاء رياضي جري', slug: 'running-shoes', cat: 'shoes', brand: 'yamani',
      basePrice: 16500, compareAt: 20000, cost: 10000, img: '/uploads/products/sneakers.webp',
      desc: 'حذاء رياضي خفيف بنعل ماص للصدمات، مناسب للجري والمشي اليومي.',
      variants: [
        { attrs: { 'المقاس': '40' } }, { attrs: { 'المقاس': '41' } }, { attrs: { 'المقاس': '42' } }, { attrs: { 'المقاس': '43' } }, { attrs: { 'المقاس': '44' } },
      ],
    },
    {
      name: 'شبشب جلد طبيعي', slug: 'leather-slippers', cat: 'shoes', brand: 'alaseel',
      basePrice: 6000, cost: 3200, img: '/uploads/products/sandals.webp',
      desc: 'شبشب من الجلد الطبيعي المدبوغ، مريح ودائم.',
      variants: [
        { attrs: { 'المقاس': '41' } }, { attrs: { 'المقاس': '42' } }, { attrs: { 'المقاس': '43' } },
      ],
    },
    {
      name: 'حقيبة يد نسائية جلد', slug: 'leather-handbag', cat: 'bags', brand: 'aden-gold',
      basePrice: 13000, compareAt: 16000, cost: 7500, img: '/uploads/products/handbag.webp',
      desc: 'حقيبة يد أنيقة من الجلد الصناعي الفاخر، مساحة داخلية واسعة وحزام كتف قابل للفصل.',
      variants: [
        { attrs: { 'اللون': 'أسود' } }, { attrs: { 'اللون': 'بيج' } }, { attrs: { 'اللون': 'بني' } },
      ],
    },
    {
      name: 'محفظة جلد رجالية', slug: 'mens-wallet', cat: 'bags', brand: 'aden-gold',
      basePrice: 5500, cost: 2800, img: '/uploads/products/wallet.webp',
      desc: 'محفظة رجالية أنيقة بجلد طبيعي، 8 فتحات بطاقات وجيب نقود مضاد للماء.',
      variants: [{ attrs: { 'اللون': 'بني' } }, { attrs: { 'اللون': 'أسود' } }],
    },
    {
      name: 'سوار فضة يمني أصلي', slug: 'silver-bracelet', cat: 'accessories', brand: 'aden-gold',
      basePrice: 4500, cost: 2500, img: '/uploads/products/silver-bracelet.webp',
      desc: 'سوار من الفضة اليمنية الأصيلة بتصميم تقليدي موروث، صناعة يدوية من صاغة صنعاء.',
      variants: [{ attrs: {} }],
    },
    {
      name: 'طقم أكواب شاي زجاجي', slug: 'tea-cups-set', cat: 'home',
      basePrice: 5800, compareAt: 7000, cost: 3200, img: '/uploads/products/tea-cups.webp',
      desc: 'طقم 6 أكواب شاي زجاجي مقاوم للحرارة مع صحون، تصميم كلاسيكي أنيق.',
      variants: [{ attrs: { 'عدد القطع': '12 قطعة' } }],
    },
    {
      name: 'مبخرة نحاسية فاخرة', slug: 'brass-incense-burner', cat: 'home', brand: 'alaseel',
      basePrice: 7200, cost: 4000, img: '/uploads/products/incense-burner.webp',
      desc: 'مبخرة نحاسية مشغولة يدويًا بتفاصيل دقيقة، مناسبة للبخور والعود.',
      featured: true,
      variants: [{ attrs: {} }],
    },
  ]

  for (const p of products) {
    const product = await db.product.create({
      data: {
        name: p.name, slug: p.slug, description: p.desc,
        categoryId: catIds[p.cat], brandId: p.brand ? brandIds[p.brand] : null,
        basePrice: p.basePrice, compareAtPrice: p.compareAt, costPrice: p.cost,
        status: 'ACTIVE', isFeatured: p.featured ?? false,
        imageUrl: p.img,
      },
    })
    await db.productImage.create({ data: { productId: product.id, url: p.img, alt: p.name, sortOrder: 0 } })
    let i = 0
    for (const v of p.variants) {
      await db.productVariant.create({
        data: {
          productId: product.id,
          attributesJson: JSON.stringify(v.attrs),
          sku: `${p.slug.toUpperCase().slice(0, 12)}-${Object.values(v.attrs).map((x) => x.slice(0, 3)).join('-')}-${i}`,
          priceOverride: v.extra ?? null,
          discountPercent: p.compareAt && p.compareAt > p.basePrice ? 0 : 0,
          imageUrl: p.img,
          sortOrder: i,
        },
      })
      i++
    }
  }
}

// ---------- الشحن ----------
async function seedShipping() {
  await db.warehouse.create({ data: { name: 'المستودع الرئيسي - صنعاء', code: 'WH-MAIN', city: 'صنعاء', isDefault: true } })
  await db.warehouse.create({ data: { name: 'فرع عدن', code: 'WH-ADEN', city: 'عدن' } })

  const methods: [string, string, string, number, string, number][] = [
    ['HOME_DELIVERY', 'توصيل منزلي', 'التوصيل إلى عنوانك خلال 1-4 أيام حسب المنطقة', 1000, '1-4 أيام', 1],
    ['PICKUP', 'استلام من المتجر', 'استلم طلبك مجانًا من فرع المتجر في عدن - المنصورة', 0, 'خلال ساعات', 2],
    ['COURIER', 'شركة شحن سريعة', 'شحن سريع عبر شركات الشحن المعتمدة', 1500, '1-3 أيام', 3],
  ]
  for (const [code, name, description, baseFee, etaNote, sortOrder] of methods) {
    await db.shippingMethod.create({ data: { code, name, description, baseFee, etaNote, sortOrder } })
  }

  const zones: [string, number, number][] = [
    ['عدن', 1000, 1], ['لحج', 1500, 2], ['أبين', 1800, 3], ['صنعاء', 1500, 2], ['تعز', 1500, 2],
    ['الحديدة', 1800, 3], ['إب', 1800, 3], ['ذمار', 2000, 3], ['مأرب', 2000, 3], ['شبوة', 2200, 4],
    ['حضرموت', 2500, 4], ['الضالع', 2000, 3], ['البيضاء', 2200, 4], ['المحويت', 2200, 4], ['ريمة', 2200, 4],
    ['الجوف', 2500, 4], ['عمران', 2000, 3], ['صعدة', 2500, 4], ['المهرة', 3000, 5], ['سقطرى', 4000, 7],
  ]
  for (const [governorate, fee, etaDays] of zones) {
    await db.shippingZone.create({ data: { governorate, city: '', fee, etaDays } })
  }
}

// ---------- الدفع ----------
async function seedPayments() {
  await db.paymentMethod.createMany({
    data: [
      { code: 'BANK_TRANSFER', name: 'تحويل بنكي / محفظة', description: 'حوّل المبلغ إلى أحد حساباتنا ثم سجّل التحويل من صفحة الطلب', sortOrder: 1 },
      { code: 'COD', name: 'الدفع عند الاستلام', description: 'ادفع نقدًا عند وصول الطلب إلى باب منزلك (رسوم إضافية 500 ريال)', sortOrder: 2 },
    ],
  })

  const accounts = [
    { type: 'BANK', name: 'بنك التضامن الإسلامي', institution: 'بنك التضامن', beneficiary: 'متجر الأصيل للتجارة', accountNumber: '0021-0154-8876', branch: 'فرع المنصورة - عدن', instructions: 'حوّل المبلغ ثم أرسل صورة الإيصال عبر التطبيق', sortOrder: 1 },
    { type: 'BANK', name: 'بنك الكريمي', institution: 'بنك الكريمي', beneficiary: 'متجر الأصيل للتجارة', accountNumber: 'KR-447120993', branch: 'فرع كريتر - عدن', instructions: 'يرجى كتابة كود الدفع في خانة الملاحظات عند التحويل', sortOrder: 2 },
    { type: 'WALLET', name: 'محفظة جوال موبايل', institution: 'خدمة جوال', beneficiary: 'متجر الأصيل', accountNumber: '771234567', instructions: 'حوّل عبر تطبيق جوال إلى الرقم الموضح', sortOrder: 3 },
    { type: 'WALLET', name: 'محفظة ONE Cash', institution: 'ONE Cash', beneficiary: 'متجر الأصيل', accountNumber: '777654321', instructions: 'حوّل عبر تطبيق ONE Cash ثم سجّل رقم العملية', sortOrder: 4 },
  ]
  for (const a of accounts) {
    await db.paymentAccount.create({ data: a })
  }
}

// ---------- البنوك ----------
async function seedBanks() {
  const accounts = [
    { name: 'حساب بنك التضامن الرئيسي', institution: 'بنك التضامن', type: 'BANK', accountNumber: '0021-0154-8876', beneficiary: 'متجر الأصيل للتجارة', openingBalance: 1500000 },
    { name: 'حساب بنك الكريمي', institution: 'بنك الكريمي', type: 'BANK', accountNumber: 'KR-447120993', beneficiary: 'متجر الأصيل للتجارة', openingBalance: 800000 },
    { name: 'صندوق النقد (كاش)', institution: 'المتجر', type: 'CASH', accountNumber: 'CASH-001', beneficiary: 'المتجر', openingBalance: 200000 },
  ]
  for (const a of accounts) {
    await db.bankAccount.create({ data: { ...a, currentBalance: a.openingBalance } })
  }
}

// ---------- الموردون والمشتريات ----------
async function seedSuppliersAndPurchases() {
  const suppliers = [
    { name: 'مؤسسة النسيج الوطنية', phone: '771112233', balance: 0 },
    { name: 'شركة العبق للعطور', phone: '772223344', balance: 350000 },
    { name: 'مؤسسة التقنية للإلكترونيات', phone: '773334455', balance: 0 },
  ]
  const supplierIds: string[] = []
  for (const s of suppliers) {
    const sup = await db.supplier.create({ data: s })
    supplierIds.push(sup.id)
  }

  // مشتريات استلام لتخزين الكميات
  const mainWarehouse = await db.warehouse.findFirstOrThrow({ where: { isDefault: true } })

  const { receiveStock } = await import('../src/lib/server/inventory')

  // شراء 1: ملابس
  const thobe = await db.product.findUniqueOrThrow({ where: { slug: 'thobe-cotton' }, include: { variants: true } })
  const shirt = await db.product.findUniqueOrThrow({ where: { slug: 'shirt-casual' }, include: { variants: true } })
  const abaya = await db.product.findUniqueOrThrow({ where: { slug: 'abaya-cloche' }, include: { variants: true } })
  const dress = await db.product.findUniqueOrThrow({ where: { slug: 'evening-dress' }, include: { variants: true } })
  const scarf = await db.product.findUniqueOrThrow({ where: { slug: 'silk-scarf' }, include: { variants: true } })
  const jeans = await db.product.findUniqueOrThrow({ where: { slug: 'jeans-classic' }, include: { variants: true } })

  const pur1 = await db.purchase.create({
    data: {
      purchaseNumber: 'PUR-INIT01', supplierId: supplierIds[0], warehouseId: mainWarehouse.id,
      invoiceRef: 'INV-SUP-1001', date: daysAgo(30), status: 'PAID', notes: 'دفعة أولى — ملابس',
    },
  })
  let sub1 = 0
  for (const v of [...thobe.variants, ...shirt.variants, ...abaya.variants, ...dress.variants, ...scarf.variants, ...jeans.variants]) {
    const qty = 12
    const cost = (await db.product.findUniqueOrThrow({ where: { id: v.productId } })).costPrice ?? 5000
    await db.purchaseItem.create({ data: { purchaseId: pur1.id, variantId: v.id, quantity: qty, unitCost: cost, lineTotal: qty * cost } })
    sub1 += qty * cost
    await receiveStock(db, { variantId: v.id, warehouseId: mainWarehouse.id, quantity: qty, refType: 'purchase', refId: pur1.id, refNumber: pur1.purchaseNumber, unitCost: cost })
  }
  await db.purchase.update({ where: { id: pur1.id }, data: { subtotal: sub1, total: sub1, paid: sub1 } })

  // شراء 2: عطور
  const oud = await db.product.findUniqueOrThrow({ where: { slug: 'royal-oud' }, include: { variants: true } })
  const musk = await db.product.findUniqueOrThrow({ where: { slug: 'musk-tahara' }, include: { variants: true } })
  const oudOil = await db.product.findUniqueOrThrow({ where: { slug: 'cambodi-oud-oil' }, include: { variants: true } })
  const pur2 = await db.purchase.create({
    data: {
      purchaseNumber: 'PUR-INIT02', supplierId: supplierIds[1], warehouseId: mainWarehouse.id,
      invoiceRef: 'INV-SUP-1002', date: daysAgo(25), status: 'PARTIALLY_PAID', notes: 'دفعة ثانية — عطور',
    },
  })
  let sub2 = 0
  for (const v of [...oud.variants, ...musk.variants, ...oudOil.variants]) {
    const qty = 8
    const cost = (await db.product.findUniqueOrThrow({ where: { id: v.productId } })).costPrice ?? 5000
    await db.purchaseItem.create({ data: { purchaseId: pur2.id, variantId: v.id, quantity: qty, unitCost: cost, lineTotal: qty * cost } })
    sub2 += qty * cost
    await receiveStock(db, { variantId: v.id, warehouseId: mainWarehouse.id, quantity: qty, refType: 'purchase', refId: pur2.id, refNumber: pur2.purchaseNumber, unitCost: cost })
  }
  const paid2 = sub2 - 350000
  await db.purchase.update({ where: { id: pur2.id }, data: { subtotal: sub2, total: sub2, paid: paid2 } })
  await db.supplierPayment.create({
    data: { supplierId: supplierIds[1], purchaseId: pur2.id, amount: paid2, method: 'CASH', note: 'دفعة جزئية', date: daysAgo(25) },
  })

  // شراء 3: إلكترونيات وأحذية وبقية
  const others = ['bt-earbuds', 'smartwatch', 'powerbank-20k', 'running-shoes', 'leather-slippers', 'leather-handbag', 'mens-wallet', 'silver-bracelet', 'tea-cups-set', 'brass-incense-burner']
  const pur3 = await db.purchase.create({
    data: { purchaseNumber: 'PUR-INIT03', supplierId: supplierIds[2], warehouseId: mainWarehouse.id, invoiceRef: 'INV-SUP-1003', date: daysAgo(20), status: 'PAID' },
  })
  let sub3 = 0
  for (const slug of others) {
    const p = await db.product.findUniqueOrThrow({ where: { slug }, include: { variants: true } })
    for (const v of p.variants) {
      const qty = 15
      await db.purchaseItem.create({ data: { purchaseId: pur3.id, variantId: v.id, quantity: qty, unitCost: p.costPrice ?? 3000, lineTotal: qty * (p.costPrice ?? 3000) } })
      sub3 += qty * (p.costPrice ?? 3000)
      await receiveStock(db, { variantId: v.id, warehouseId: mainWarehouse.id, quantity: qty, refType: 'purchase', refId: pur3.id, refNumber: pur3.purchaseNumber, unitCost: p.costPrice ?? 3000 })
    }
  }
  await db.purchase.update({ where: { id: pur3.id }, data: { subtotal: sub3, total: sub3, paid: sub3 } })

  // مصروفات تجريبية
  const { postBankTransaction } = await import('../src/lib/server/accounting')
  const tadamun = await db.bankAccount.findFirstOrThrow({ where: { institution: 'بنك التضامن' } })
  const admin = await db.user.findUniqueOrThrow({ where: { phone: '777000003' } })
  await db.expense.create({ data: { expenseNumber: 'EXP-INIT01', category: 'إيجار', description: 'إيجار المعرض - شهر حالي', amount: 120000, bankAccountId: tadamun.id, date: daysAgo(5), createdById: admin.id } })
  await postBankTransaction(db, {
    bankAccountId: tadamun.id, direction: 'OUT', amount: 120000, txnType: 'EXPENSE',
    refType: 'expense', refNumber: 'EXP-INIT01', description: 'إيجار المعرض', date: daysAgo(5),
  })
  await db.expense.create({ data: { expenseNumber: 'EXP-INIT02', category: 'تغليف', description: 'أكياس وكراتين تغليف', amount: 35000, date: daysAgo(3), createdById: admin.id } })
}

// ---------- المحتوى ----------
async function seedContent() {
  await db.banner.createMany({
    data: [
      { title: 'عروض العطور — خصم حتى 20%', subtitle: 'عبق اليمن الأصيل بين يديك', imageUrl: '/uploads/banners/banner1.webp', actionType: 'CATEGORY', target: 'perfumes', sortOrder: 1 },
      { title: 'إلكترونيات بأسعار لا تُقاوم', subtitle: 'سماعات وساعات ذكية بضمان', imageUrl: '/uploads/banners/banner2.webp', actionType: 'CATEGORY', target: 'electronics', sortOrder: 2 },
      { title: 'جديد الأزياء وصل', subtitle: 'تشكيلة المواسم الجديدة', imageUrl: '/uploads/banners/banner3.webp', actionType: 'CATEGORY', target: 'mens-clothing', sortOrder: 3 },
    ],
  })

  await db.homeSection.createMany({
    data: [
      { type: 'BANNER', title: 'عروض خاصة', sortOrder: 1 },
      { type: 'CATEGORIES', title: 'تسوق حسب القسم', sortOrder: 2 },
      { type: 'FEATURED', title: 'منتجات مميزة', configJson: '{"limit":8}', sortOrder: 3 },
      { type: 'OFFERS', title: 'عروض وخصومات', configJson: '{"limit":8}', sortOrder: 4 },
      { type: 'NEW_ARRIVALS', title: 'وصل حديثًا', configJson: '{"limit":8}', sortOrder: 5 },
      { type: 'BEST_SELLERS', title: 'الأكثر مبيعًا', configJson: '{"limit":8}', sortOrder: 6 },
    ],
  })

  const pages = [
    ['about', 'من نحن', 'متجر الأصيل — متجر يمني متكامل يقدم منتجات أصلية بأسعار منافسة مع خدمة توصيل لجميع المحافظات. بدأنا من عدن وطموحنا الوصول لكل بيت يمني.\n\nنؤمن بأن التسوق حق للجميع، ونعمل على توفير تجربة تسوق سهلة وآمنة، مع فريق دعم يرد على استفساراتك خلال دقائق.'],
    ['return-policy', 'سياسة الإرجاع والاستبدال', 'يمكنك طلب الإرجاع خلال 7 أيام من تاريخ الاستلام وفق الشروط التالية:\n\n- أن يكون المنتج بحالته الأصلية وغير مستخدم\n- أن تكون جميع الملحقات والتغليف الأصلي موجودة\n- العطور ومستحضرات التجميل غير قابلة للإرجاع بعد الفتح\n- المنتجات المخصصة أو المفصلة حسب الطلب غير قابلة للإرجاع\n\nفي حال الاستبدال بسبب مقاس غير مناسب، يتحمل العميل فرق شحن الإرجاع.'],
    ['shipping-policy', 'سياسة الشحن والتوصيل', 'نوصل لجميع المحافظات اليمنية عبر شبكة توصيل موثوقة:\n\n- عدن ولحج: خلال 1-2 يوم عمل\n- صنعاء وتعز والحديدة: 2-3 أيام عمل\n- بقية المحافظات: 3-5 أيام عمل\n\nالشحن مجاني للطلبات التي تتجاوز 50,000 ريال (قريبًا). حاليًا تُحسب أجرة الشحن حسب المحافظة عند إتمام الطلب.'],
    ['payment-policy', 'سياسة الدفع', 'نوفر طرق دفع تناسب الجميع:\n\n1. التحويل البنكي: حوّل المبلغ إلى أحد حساباتنا المعروضة عند إتمام الطلب، ثم سجّل رقم العملية وارفع صورة الإيصال من صفحة الطلب. تتم مراجعة التحويل خلال ساعات العمل (8 ص - 10 م).\n\n2. الدفع عند الاستلام: متاح لجميع المناطق مع رسوم إضافية 500 ريال.\n\nكود الدفع الخاص بك هو مفتاح الربط بين تحويلك وطلبك — احرص على كتابته في ملاحظات التحويل.'],
    ['terms', 'شروط الاستخدام', 'باستخدامك لتطبيق متجر الأصيل فإنك توافق على الشروط التالية:\n\n- الأسعار المعروضة بالريال اليمني وتشمل جميع الرسوم ما عدا الشحن\n- يحق للمتجر تعديل الأسعار والعروض في أي وقت، والطلبات المؤكدة تحتفظ بسعرها وقت الطلب\n- الطلبات غير المدفوعة خلال 48 ساعة تُلغى تلقائيًا\n- الحساب المسجل باسمك مسؤوليتك الكاملة، ولا تشارك بيانات الدخول مع أحد'],
    ['privacy', 'سياسة الخصوصية', 'نحترم خصوصيتك ونلتزم بحماية بياناتك:\n\n- نجمع فقط البيانات اللازمة لإتمام الطلبات (الاسم، الهاتف، العنوان)\n- لا نشارك بياناتك مع أي طرف ثالث إلا لغرض التوصيل\n- صور إيصالات الدفع تُخزن بأمان ولا يطّلع عليها إلا فريق المحاسبة\n- يمكنك طلب حذف حسابك وبياناتك في أي وقت (تبقى السجلات المالية حسب النظام)'],
    ['faq', 'الأسئلة الشائعة', 'س: كيف أعرف أن طلبي تم استلامه؟\nج: ستصلك رسالة داخل التطبيق فور استلام الطلب، ويمكنك متابعة حالة الطلب من صفحة "طلباتي".\n\nس: كم يستغرق اعتماد الدفعة؟\nج: خلال ساعات العمل الرسمية يتم الاعتماد عادة خلال 1-3 ساعات.\n\nس: ماذا لو دفعت مبلغًا مختلفًا؟\nج: إن كان المبلغ أقل، ستصلك رسالة بالمتبقي. وإن كان أكثر، يُسجل الفرق كرصيد أو يُرد لك.\n\nس: هل يمكنني تغيير عنواني بعد الطلب؟\nج: نعم قبل الشحن — تواصل معنا عبر واتساب فورًا.'],
  ]
  for (const [slug, title, content] of pages) {
    await db.contentPage.create({ data: { slug, title, content, sortOrder: pages.findIndex((p) => p[0] === slug) } })
  }
}

// ---------- الكوبونات ----------
async function seedCoupons() {
  await db.coupon.createMany({
    data: [
      { code: 'WELCOME10', type: 'PERCENT', value: 10, minCart: 10000, maxDiscount: 5000, perCustomerLimit: 1, active: true },
      { code: 'SAVE2000', type: 'FIXED', value: 2000, minCart: 20000, perCustomerLimit: 2, active: true },
    ],
  })
}

// ---------- طلبات تجريبية بسلاسل كاملة ----------
async function seedDemoOrders() {
  console.log('🛒 توليد طلبات تجريبية عبر المحركات الحقيقية...')
  const { createOrder, transitionOrder } = await import('../src/lib/server/orders')
  const { submitPayment, verifyPayment } = await import('../src/lib/server/payments')
  const { createReturnRequest } = await import('../src/lib/server/returns')

  const ahmed = await db.user.findUniqueOrThrow({ where: { phone: '712345678' } })
  const ahmedCustomer = await db.customer.findUniqueOrThrow({ where: { userId: ahmed.id } })
  const addr = await db.customerAddress.findFirstOrThrow({ where: { customerId: ahmedCustomer.id, isDefault: true } })

  const sara = await db.user.findUniqueOrThrow({ where: { phone: '723456789' } })
  await db.customerAddress.create({
    data: {
      customerId: (await db.customer.findUniqueOrThrow({ where: { userId: sara.id } })).id,
      label: 'المنزل', governorate: 'صنعاء', city: 'صنعاء', district: 'صنعاء القديمة',
      neighborhood: 'حارة الميدان', phone: '723456789', isDefault: true,
    },
  })

  const accountant = await db.user.findUniqueOrThrow({ where: { phone: '777000003' } })
  const manager = await db.user.findUniqueOrThrow({ where: { phone: '777000002' } })
  const warehouseUser = await db.user.findUniqueOrThrow({ where: { phone: '777000004' } })
  const delivery = await db.user.findUniqueOrThrow({ where: { phone: '777000006' } })
  const accountCtx = { id: accountant.id, name: accountant.name, phone: accountant.phone, role: 'ACCOUNTANT' as const, status: 'ACTIVE' }
  const managerCtx = { id: manager.id, name: manager.name, phone: manager.phone, role: 'MANAGER' as const, status: 'ACTIVE' }
  const whCtx = { id: warehouseUser.id, name: warehouseUser.name, phone: warehouseUser.phone, role: 'WAREHOUSE' as const, status: 'ACTIVE' }
  const dlCtx = { id: delivery.id, name: delivery.name, phone: delivery.phone, role: 'DELIVERY_OPERATOR' as const, status: 'ACTIVE' }

  const getVariant = async (slug: string, idx = 0) => {
    const p = await db.product.findUniqueOrThrow({ where: { slug }, include: { variants: { orderBy: { sortOrder: 'asc' } } } })
    return p.variants[Math.min(idx, p.variants.length - 1)]
  }

  // ---------- طلب 1: بانتظار الدفع (جديد) ----------
  await createOrder({
    customerId: ahmedCustomer.id, customerUserId: ahmed.id, addressId: addr.id,
    items: [{ variantId: (await getVariant('bt-earbuds')).id, quantity: 1 }],
    shippingMethodCode: 'HOME_DELIVERY', paymentMethodCode: 'BANK_TRANSFER',
  })

  // ---------- طلب 2: دفع مسجل بانتظار المراجعة ----------
  const o2 = await createOrder({
    customerId: ahmedCustomer.id, customerUserId: ahmed.id, addressId: addr.id,
    items: [{ variantId: (await getVariant('royal-oud')).id, quantity: 1 }, { variantId: (await getVariant('musk-tahara')).id, quantity: 1 }],
    shippingMethodCode: 'HOME_DELIVERY', paymentMethodCode: 'BANK_TRANSFER',
    couponCode: 'WELCOME10',
  })
  const p2 = await db.payment.findFirstOrThrow({ where: { orderId: o2.order.id } })
  const acc = await db.paymentAccount.findFirstOrThrow({ where: { institution: 'بنك الكريمي' } })
  await submitPayment({
    paymentId: p2.id, customerUserId: ahmed.id, amount: o2.order.grandTotal,
    paymentAccountId: acc.id, customerTransferRef: 'TRF-889912', senderName: 'أحمد محمد',
    notes: 'تم التحويل من تطبيق الكريمي',
  })

  // ---------- طلب 3: قيد التجهيز (دفع معتمد) ----------
  const o3 = await createOrder({
    customerId: ahmedCustomer.id, customerUserId: ahmed.id, addressId: addr.id,
    items: [{ variantId: (await getVariant('thobe-cotton')).id, quantity: 2 }],
    shippingMethodCode: 'HOME_DELIVERY', paymentMethodCode: 'BANK_TRANSFER',
  })
  const p3 = await db.payment.findFirstOrThrow({ where: { orderId: o3.order.id } })
  await submitPayment({
    paymentId: p3.id, customerUserId: ahmed.id, amount: o3.order.grandTotal,
    customerTransferRef: 'TRF-889913', senderName: 'أحمد محمد',
  })
  const tadamun = await db.bankAccount.findFirstOrThrow({ where: { institution: 'بنك التضامن' } })
  await verifyPayment({ paymentId: p3.id, actor: accountCtx, bankAccountId: tadamun.id, note: 'مطابقة كشف الحساب' })
  await transitionOrder({ orderId: o3.order.id, to: 'STOCK_RESERVED', actor: whCtx })
  await transitionOrder({ orderId: o3.order.id, to: 'PROCESSING', actor: whCtx })

  // ---------- طلب 4: تم شحنه ----------
  const o4 = await createOrder({
    customerId: ahmedCustomer.id, customerUserId: ahmed.id, addressId: addr.id,
    items: [{ variantId: (await getVariant('running-shoes', 2)).id, quantity: 1 }, { variantId: (await getVariant('mens-wallet')).id, quantity: 1 }],
    shippingMethodCode: 'COURIER', paymentMethodCode: 'BANK_TRANSFER',
  })
  const p4 = await db.payment.findFirstOrThrow({ where: { orderId: o4.order.id } })
  await submitPayment({ paymentId: p4.id, customerUserId: ahmed.id, amount: o4.order.grandTotal, customerTransferRef: 'TRF-889914', senderName: 'أحمد محمد' })
  await verifyPayment({ paymentId: p4.id, actor: accountCtx, bankAccountId: tadamun.id })
  for (const s of ['STOCK_RESERVED', 'PROCESSING', 'PICKED', 'PACKED', 'READY_TO_SHIP'] as const) {
    await transitionOrder({ orderId: o4.order.id, to: s, actor: whCtx })
  }
  await transitionOrder({ orderId: o4.order.id, to: 'SHIPPED', actor: dlCtx, extra: { provider: 'شركة الأمانة للشحن' } })
  await transitionOrder({ orderId: o4.order.id, to: 'OUT_FOR_DELIVERY', actor: dlCtx })

  // ---------- طلب 5: تم التسليم + مكتمل (COD) ----------
  const o5 = await createOrder({
    customerId: ahmedCustomer.id, customerUserId: ahmed.id, addressId: addr.id,
    items: [{ variantId: (await getVariant('tea-cups-set')).id, quantity: 1 }],
    shippingMethodCode: 'HOME_DELIVERY', paymentMethodCode: 'COD',
  })
  for (const s of ['STOCK_RESERVED', 'PROCESSING', 'PICKED', 'PACKED', 'READY_TO_SHIP', 'SHIPPED', 'OUT_FOR_DELIVERY'] as const) {
    const actor = ['SHIPPED', 'OUT_FOR_DELIVERY'].includes(s) ? dlCtx : whCtx
    await transitionOrder({ orderId: o5.order.id, to: s, actor })
  }
  await transitionOrder({ orderId: o5.order.id, to: 'DELIVERED', actor: dlCtx })
  await transitionOrder({ orderId: o5.order.id, to: 'COMPLETED', actor: managerCtx })

  // ---------- طلب 6: إرجاع مطلوب بعد التسليم ----------
  const o6 = await createOrder({
    customerId: ahmedCustomer.id, customerUserId: ahmed.id, addressId: addr.id,
    items: [{ variantId: (await getVariant('shirt-casual', 1)).id, quantity: 1 }],
    shippingMethodCode: 'HOME_DELIVERY', paymentMethodCode: 'BANK_TRANSFER',
  })
  const p6 = await db.payment.findFirstOrThrow({ where: { orderId: o6.order.id } })
  await submitPayment({ paymentId: p6.id, customerUserId: ahmed.id, amount: o6.order.grandTotal, customerTransferRef: 'TRF-889916', senderName: 'أحمد محمد' })
  await verifyPayment({ paymentId: p6.id, actor: accountCtx, bankAccountId: tadamun.id })
  for (const s of ['STOCK_RESERVED', 'PROCESSING', 'PICKED', 'PACKED', 'READY_TO_SHIP', 'SHIPPED', 'OUT_FOR_DELIVERY'] as const) {
    const actor = ['SHIPPED', 'OUT_FOR_DELIVERY'].includes(s) ? dlCtx : whCtx
    await transitionOrder({ orderId: o6.order.id, to: s, actor })
  }
  await transitionOrder({ orderId: o6.order.id, to: 'DELIVERED', actor: dlCtx })
  const item6 = await db.orderItem.findFirstOrThrow({ where: { orderId: o6.order.id } })
  await createReturnRequest({
    orderId: o6.order.id, customerUserId: ahmed.id,
    items: [{ orderItemId: item6.id, quantity: 1 }],
    reason: 'مقاس غير مناسب', note: 'المقاس L كبير عليّ، أريد استبداله بمقاس M إن أمكن',
  })

  console.log('✨ تم توليد الطلبات التجريبية بنجاح')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
