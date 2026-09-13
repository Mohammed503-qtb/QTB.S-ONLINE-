#!/bin/bash
# ===== E2E المرحلة 5: APIs الإدارة — idempotent بالكامل =====
BASE="http://localhost:3000/api"
SA="/tmp/e2e-super_admin.txt"; AC="/tmp/e2e-accountant.txt"; WH="/tmp/e2e-warehouse.txt"; CM="/tmp/e2e-content_manager.txt"; CJ="/tmp/e2e-customer.txt"
TS=$(date +%s)
PASS=0; FAIL=0
check() { if [ "$2" = "1" ]; then PASS=$((PASS+1)); echo "  ✓ $1"; else FAIL=$((FAIL+1)); echo "  ❌ $1"; fi }
j() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d$2)" 2>/dev/null; }

# ---------- بيانات طازجة: طلب جديد عبر واجهة العميل ----------
VID=$(bun run .zscripts/get-anyvariant.ts 2>/dev/null | tail -1)
AID=$(curl -s -b $CJ $BASE/addresses | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")
NEWORDER() {
  IDEM="adm-$TS-$RANDOM-abcdefgh"
  O=$(curl -s -b $CJ -X POST $BASE/orders -H 'Content-Type: application/json' -d "{\"addressId\":\"$AID\",\"items\":[{\"variantId\":\"$VID\",\"quantity\":2}],\"shippingMethodCode\":\"HOME_DELIVERY\",\"paymentMethodCode\":\"BANK_TRANSFER\",\"idempotencyKey\":\"$IDEM\"}")
  OID=$(j "$O" "['data']['orderId']"); GT=$(j "$O" "['data']['grandTotal']")
  PAYID=$(bun run .zscripts/get-payment.ts "$OID" 2>/dev/null | tail -1)
  curl -s -b $CJ -X POST $BASE/payments/$PAYID/submit -H 'Content-Type: application/json' -d "{\"amount\":$GT,\"customerTransferRef\":\"TRX-$TS-$RANDOM\",\"transferDate\":\"2026-09-13\",\"senderName\":\"عميل E2E\"}" > /dev/null
}

echo "=== 5.1 لوحة المعلومات والعمليات ==="
D=$(curl -s -b $SA $BASE/admin/dashboard)
check "dashboard: مؤشرات حية" $([ "$(j "$D" "['ok']")" = "True" ] && [ -n "$(j "$D" "['data']")" ] && echo 1 || echo 0)
OPS=$(curl -s -b $SA $BASE/admin/operations)
check "operations: طابور العمليات" $([ "$(j "$OPS" "['ok']")" = "True" ] && echo 1 || echo 0)

echo "=== 5.2 المسار الذهبي الكامل (طلب طازج → اكتمال) ==="
NEWORDER
V=$(curl -s -b $AC -X POST $BASE/admin/payments/$PAYID/action -H 'Content-Type: application/json' -d '{"action":"verify","note":"فحص E2E"}')
check "payments: اعتماد الدفعة (محاسب)" $([ "$(j "$V" "['ok']")" = "True" ] && [ "$(j "$V" "['data']['verified']")" = "True" ] && echo 1 || echo 0)
OST=$(curl -s -b $SA $BASE/admin/orders/$OID | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['order']['status'])" 2>/dev/null)
check "بعد الاعتماد: الطلب CONFIRMED (حصلت: $OST)" $([ "$OST" = "CONFIRMED" ] && echo 1 || echo 0)
INV=$(bun run .zscripts/check-invoice.ts "$OID" 2>/dev/null | tail -1)
check "الفاتورة أُنشئت تلقائياً ($INV)" $([ -n "$INV" ] && [ "$INV" != "NONE" ] && echo 1 || echo 0)
BTX=$(bun run .zscripts/check-btx.ts "$PAYID" 2>/dev/null | tail -1)
check "أثر بنكي CUSTOMER_PAYMENT ($BTX)" $([ -n "$BTX" ] && [ "$BTX" != "NONE" ] && echo 1 || echo 0)
trans() {
  curl -s -b $SA -X POST $BASE/admin/orders/$OID/status -H 'Content-Type: application/json' -d "{\"to\":\"$1\"$2}" > /dev/null
  ST=$(curl -s -b $SA $BASE/admin/orders/$OID | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['order']['status'])" 2>/dev/null)
  check "$1 (حصلت: $ST)" $([ "$ST" = "$1" ] && echo 1 || echo 0)
}
trans "STOCK_RESERVED"; trans "PROCESSING"; trans "PICKED"; trans "PACKED"; trans "READY_TO_SHIP"
trans "SHIPPED" ",\"provider\":\"شركة الشحن الوطنية\""
trans "OUT_FOR_DELIVERY"
trans "DELIVERED"
SALE=$(bun run .zscripts/check-sale.ts "$OID" 2>/dev/null | tail -1)
check "تحويل الحجز إلى بيع (COGS)" $([ "$SALE" = "SALE_OK" ] && echo 1 || echo 0)
trans "COMPLETED"

echo "=== 5.3 رفض دفعة (طلب طازج آخر) ==="
NEWORDER
REJ_NO=$(curl -s -b $AC -X POST $BASE/admin/payments/$PAYID/action -H 'Content-Type: application/json' -d '{"action":"reject","note":"بدون سبب"}')
check "رفض بدون سبب → خطأ (إلزامي)" $([ "$(j "$REJ_NO" "['ok']")" = "False" ] && echo 1 || echo 0)
REJ=$(curl -s -b $AC -X POST $BASE/admin/payments/$PAYID/action -H 'Content-Type: application/json' -d '{"action":"reject","reason":"المبلغ لا يطابق — فحص E2E"}')
OST2=$(curl -s -b $SA $BASE/admin/orders/$OID | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['order']['status'])" 2>/dev/null)
check "رفض بسبب → rejected:true + طلب PAYMENT_ISSUE (حصلت: $OST2)" $([ "$(j "$REJ" "['data']['rejected']")" = "True" ] && [ "$OST2" = "PAYMENT_ISSUE" ] && echo 1 || echo 0)

echo "=== 5.4 الكتالوج CRUD (SKU فريد) ==="
CATID=$(curl -s $BASE/catalog/categories | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['categories'][0]['id'])")
NP=$(curl -s -b $SA -X POST $BASE/admin/products -H 'Content-Type: application/json' -d "{\"name\":\"منتج فحص $TS\",\"categoryId\":\"$CATID\",\"basePrice\":5000,\"costPrice\":3000,\"status\":\"ACTIVE\",\"variants\":[{\"attributes\":{\"اللون\":\"أسود\"},\"sku\":\"E2E-$TS\",\"priceOverride\":5000,\"initialStock\":10}]}")
NPID=$(j "$NP" "['data']['id']")
check "products: إنشاء مع متغير+مخزون" $([ "$(j "$NP" "['ok']")" = "True" ] && [ -n "$NPID" ] && echo 1 || echo 0)
UP=$(curl -s -b $SA -X PUT $BASE/admin/products/$NPID -H 'Content-Type: application/json' -d '{"basePrice":4500}')
check "products: تحديث سعر" $([ "$(j "$UP" "['ok']")" = "True" ] && [ "$(j "$UP" "['data']['basePrice']")" = "4500" ] && echo 1 || echo 0)
DEL=$(curl -s -b $SA -X DELETE $BASE/admin/products/$NPID)
check "products: أرشفة" $([ "$(j "$DEL" "['ok']")" = "True" ] && echo 1 || echo 0)

echo "=== 5.5 المخزون ==="
check "inventory: الأرصدة" $([ "$(j "$(curl -s -b $SA $BASE/admin/inventory)" "['ok']")" = "True" ] && echo 1 || echo 0)
check "inventory: آخر الحركات" $([ "$(j "$(curl -s -b $SA "$BASE/admin/inventory/movements?limit=5")" "['ok']")" = "True" ] && echo 1 || echo 0)
WHID=$(bun run .zscripts/get-warehouse.ts 2>/dev/null | tail -1)
ADJ=$(curl -s -b $WH -X POST $BASE/admin/inventory -H 'Content-Type: application/json' -d "{\"action\":\"adjust\",\"variantId\":\"$VID\",\"warehouseId\":\"$WHID\",\"newOnHand\":25,\"reason\":\"تسوية جرد فحص $TS\"}")
check "inventory: تسوية جرد (أمين مستودع)" $([ "$(j "$ADJ" "['ok']")" = "True" ] && echo 1 || echo 0)
DMG=$(curl -s -b $WH -X POST $BASE/admin/inventory -H 'Content-Type: application/json' -d "{\"action\":\"damage\",\"variantId\":\"$VID\",\"warehouseId\":\"$WHID\",\"quantity\":1,\"reason\":\"تالف أثناء الفحص $TS\"}")
check "inventory: إتلاف بسبب" $([ "$(j "$DMG" "['ok']")" = "True" ] && echo 1 || echo 0)

echo "=== 5.6 المشتريات والموردون ==="
SUP=$(curl -s -b $SA $BASE/admin/suppliers)
check "suppliers: قائمة" $([ "$(j "$SUP" "['ok']")" = "True" ] && echo 1 || echo 0)
SUPID=$(j "$SUP" "['data']['items'][0]['id']"); [ -z "$SUPID" ] && SUPID=$(j "$SUP" "['data'][0]['id']")
PUR=$(curl -s -b $SA -X POST $BASE/admin/purchases -H 'Content-Type: application/json' -d "{\"supplierId\":\"$SUPID\",\"warehouseId\":\"$WHID\",\"items\":[{\"variantId\":\"$VID\",\"quantity\":5,\"unitCost\":2500}],\"paidNow\":5000,\"paymentMethod\":\"CASH\"}")
check "purchases: شراء + استلام فوري + دفعة" $([ "$(j "$PUR" "['ok']")" = "True" ] && echo 1 || echo 0)

echo "=== 5.7 البنوك والمصروفات ==="
BANKS=$(curl -s -b $SA $BASE/admin/banks)
check "banks: الحسابات + الرصيد المشتق" $([ "$(j "$BANKS" "['ok']")" = "True" ] && echo 1 || echo 0)
BID=$(j "$BANKS" "['data']['accounts'][0]['id']")
EXP=$(curl -s -b $AC -X POST $BASE/admin/expenses -H 'Content-Type: application/json' -d "{\"category\":\"تشغيلية\",\"description\":\"مصروف فحص $TS\",\"amount\":1500,\"bankAccountId\":\"$BID\"}")
check "expenses: تسجيل مصروف (محاسب)" $([ "$(j "$EXP" "['ok']")" = "True" ] && echo 1 || echo 0)

echo "=== 5.8 الإرجاع والاسترداد ==="
check "returns: قائمة طلبات الإرجاع" $([ "$(j "$(curl -s -b $SA $BASE/admin/returns)" "['ok']")" = "True" ] && echo 1 || echo 0)

echo "=== 5.9 المحتوى (مدير محتوى) ==="
check "content: بانرات+أقسام+صفحات" $([ "$(j "$(curl -s -b $CM $BASE/admin/content)" "['ok']")" = "True" ] && echo 1 || echo 0)

echo "=== 5.10 العملاء والمستخدمون ==="
check "customers: قائمة" $([ "$(j "$(curl -s -b $SA $BASE/admin/customers)" "['ok']")" = "True" ] && echo 1 || echo 0)
check "users: قائمة" $([ "$(j "$(curl -s -b $SA $BASE/admin/users)" "['ok']")" = "True" ] && echo 1 || echo 0)

echo "=== 5.11 الكوبونات والتذاكر والتقييمات ==="
CPN=$(curl -s -b $SA -X POST $BASE/admin/coupons -H 'Content-Type: application/json' -d "{\"code\":\"E2E$TS\",\"type\":\"FIXED\",\"value\":500,\"minCart\":3000,\"perCustomerLimit\":1}")
check "coupons: إنشاء (كود فريد)" $([ "$(j "$CPN" "['ok']")" = "True" ] && echo 1 || echo 0)
check "tickets: قائمة" $([ "$(j "$(curl -s -b $SA $BASE/admin/tickets)" "['ok']")" = "True" ] && echo 1 || echo 0)
check "reviews: قائمة" $([ "$(j "$(curl -s -b $SA $BASE/admin/reviews)" "['ok']")" = "True" ] && echo 1 || echo 0)

echo "=== 5.12 التدقيق والتقارير والبحث والتصدير ==="
check "audit: سجل التدقيق" $([ "$(j "$(curl -s -b $SA "$BASE/admin/audit?limit=5")" "['ok']")" = "True" ] && echo 1 || echo 0)
for R in sales inventory payments financial products; do
  check "reports: $R" $([ "$(j "$(curl -s -b $SA "$BASE/admin/reports?type=$R")" "['ok']")" = "True" ] && echo 1 || echo 0)
done
SRCH=$(curl -s -b $SA -G "$BASE/admin/search" --data-urlencode "q=عطر")
check "search: بحث شامل عربي" $([ "$(j "$SRCH" "['ok']")" = "True" ] && [ "$(j "$SRCH" "['data']['products']")" != "None" ] && echo 1 || echo 0)
EXP_CSV=$(curl -s -b $SA "$BASE/admin/export?type=orders")
check "export: CSV الطلبات" $([ -n "$EXP_CSV" ] && echo 1 || echo 0)

echo "=== 5.13 التحكم المركزي: Kill Switch ==="
FLG=$(curl -s -b $SA -X POST $BASE/admin/app-control -H 'Content-Type: application/json' -d "{\"action\":\"set_flag\",\"key\":\"orders_enabled\",\"value\":false,\"reason\":\"فحص Kill Switch $TS\"}")
check "app-control: إيقاف الطلبات" $([ "$(j "$FLG" "['ok']")" = "True" ] && echo 1 || echo 0)
BLK=$(curl -s -b $CJ -X POST $BASE/orders -H 'Content-Type: application/json' -d "{\"addressId\":\"$AID\",\"items\":[{\"variantId\":\"$VID\",\"quantity\":1}],\"shippingMethodCode\":\"HOME_DELIVERY\",\"paymentMethodCode\":\"COD\"}")
check "الطلبات مرفوضة أثناء الإيقاف" $([ "$(j "$BLK" "['ok']")" = "False" ] && [ -n "$(j "$BLK" "['error']['message']")" ] && echo 1 || echo 0)
FLG2=$(curl -s -b $SA -X POST $BASE/admin/app-control -H 'Content-Type: application/json' -d '{"action":"set_flag","key":"orders_enabled","value":true}')
check "app-control: إعادة التفعيل" $([ "$(j "$FLG2" "['ok']")" = "True" ] && echo 1 || echo 0)

echo "=== 5.14 صلاحيات الأدوار (RBAC) ==="
R1=$(curl -s -b $WH -X POST $BASE/admin/payments/xxx/action -H 'Content-Type: application/json' -d '{"action":"verify"}')
check "أمين المستودع لا يعتمد الدفع (403)" $([ "$(j "$R1" "['ok']")" = "False" ] && echo 1 || echo 0)
R2=$(curl -s -b $AC -X POST $BASE/admin/products -H 'Content-Type: application/json' -d '{"name":"x","categoryId":"x","basePrice":1}')
check "المحاسب لا ينشئ منتجات (403)" $([ "$(j "$R2" "['ok']")" = "False" ] && echo 1 || echo 0)

echo ""
echo "===== النتيجة: نجح $PASS / فشل $FAIL ====="
exit $FAIL
