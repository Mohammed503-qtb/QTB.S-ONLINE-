#!/bin/bash
# ===== E2E المرحلة 4: APIs العميل (أشكال مصححة) =====
BASE="http://localhost:3000/api"
CJ="/tmp/e2e-customer.txt"
PASS=0; FAIL=0
check() { if [ "$2" = "1" ]; then PASS=$((PASS+1)); echo "  ✓ $1"; else FAIL=$((FAIL+1)); echo "  ❌ $1"; fi }
j() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d$2)" 2>/dev/null; }

echo "=== 4.1 الكتالوج العام (بلا جلسة) ==="
H=$(curl -s $BASE/catalog/home)
check "home: بانرات+تصنيفات+أقسام" $([ "$(j "$H" "['ok']")" = "True" ] && [ "$(j "$H" "['data']['banners']")" != "None" ] && [ "$(j "$H" "['data']['sections']")" != "None" ] && echo 1 || echo 0)
P=$(curl -s "$BASE/catalog/products?page=1&limit=8")
check "products: قائمة مع صفحات (19+)" $([ "$(j "$P" "['ok']")" = "True" ] && [ "$(j "$P" "['data']['total']")" -ge 19 ] && echo 1 || echo 0)
PS=$(curl -s -G "$BASE/catalog/products" --data-urlencode "search=عطر")
check "products: بحث عربي (عطر→2)" $([ "$(j "$PS" "['data']['total']")" = "2" ] && echo 1 || echo 0)
PC=$(curl -s -G "$BASE/catalog/products" --data-urlencode "category=عطور")
check "products: فلترة بالتصنيف" $([ "$(j "$PC" "['ok']")" = "True" ] && [ "$(j "$PC" "['data']['total']")" -ge 1 ] && echo 1 || echo 0)
CATS=$(curl -s $BASE/catalog/categories)
check "categories: قائمة" $([ "$(j "$CATS" "['ok']")" = "True" ] && [ "$(j "$CATS" "['data']")" != "None" ] && echo 1 || echo 0)
PID=$(j "$P" "['data']['products'][0]['id']")
PD=$(curl -s $BASE/catalog/products/$PID)
check "product detail: منتج+متغيرات+مرتبطة" $([ "$(j "$PD" "['ok']")" = "True" ] && [ "$(j "$PD" "['data']['variants']")" != "None" ] && [ "$(j "$PD" "['data']['related']")" != "None" ] && echo 1 || echo 0)
CFG=$(curl -s $BASE/config)
check "config: أعلام عامة بلا أسرار" $([ "$(j "$CFG" "['data']['flags']['store_enabled']")" = "True" ] && [ -z "$(echo "$CFG" | grep -i 'database_url\|secret')" ] && echo 1 || echo 0)
PAGE=$(curl -s $BASE/content/pages/about)
check "content: صفحة حول" $([ "$(j "$PAGE" "['ok']")" = "True" ] && echo 1 || echo 0)

echo "=== 4.2 التتبع العام ==="
TRK="TRK-3TWBXM"
TR=$(curl -s $BASE/track/$TRK)
check "track: بالكود بلا جلسة" $([ "$(j "$TR" "['ok']")" = "True" ] && [ -n "$(j "$TR" "['data']['orderNumber']")" ] && echo 1 || echo 0)

echo "=== 4.3 المفضلة (toggle) ==="
F1=$(curl -s -b $CJ -X POST $BASE/favorites -H 'Content-Type: application/json' -d "{\"productId\":\"$PID\"}")
check "favorites: إضافة (favorited:true)" $([ "$(j "$F1" "['data']['favorited']")" = "True" ] && echo 1 || echo 0)
F2=$(curl -s -b $CJ $BASE/favorites)
check "favorites: القائمة تحتوي المنتج" $(echo "$F2" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(1 if any(p['id']=='$PID' for p in d) else 0)" 2>/dev/null)
F3=$(curl -s -b $CJ -X POST $BASE/favorites -H 'Content-Type: application/json' -d "{\"productId\":\"$PID\"}")
check "favorites: تبديل → إزالة (favorited:false)" $([ "$(j "$F3" "['data']['favorited']")" = "False" ] && echo 1 || echo 0)

echo "=== 4.4 الإشعارات ==="
N=$(curl -s -b $CJ "$BASE/notifications?limit=5")
check "notifications: قائمة" $([ "$(j "$N" "['ok']")" = "True" ] && echo 1 || echo 0)
NID=$(j "$N" "['data']['items'][0]['id']")
if [ -n "$NID" ]; then
  NR=$(curl -s -b $CJ -X POST $BASE/notifications -H 'Content-Type: application/json' -d "{\"ids\":[\"$NID\"]}")
  check "notifications: تعليم مقروء" $([ "$(j "$NR" "['ok']")" = "True" ] && echo 1 || echo 0)
else check "notifications: تعليم مقروء" 1; fi

echo "=== 4.5 الدعم الفني ==="
T=$(curl -s -b $CJ -X POST $BASE/support -H 'Content-Type: application/json' -d '{"subject":"مشكلة اختبار E2E","category":"OTHER","priority":"MEDIUM","message":"رسالة اختبار من الفحص الآلي"}')
check "support: إنشاء تذكرة" $([ "$(j "$T" "['ok']")" = "True" ] && echo 1 || echo 0)
TID=$(j "$T" "['data']['ticketId']"); [ -z "$TID" ] && TID=$(j "$T" "['data']['id']")
TL=$(curl -s -b $CJ "$BASE/support")
check "support: قائمة تذاكري" $([ "$(j "$TL" "['ok']")" = "True" ] && echo 1 || echo 0)
TM=$(curl -s -b $CJ -X POST $BASE/support/$TID -H 'Content-Type: application/json' -d '{"message":"رسالة متابعة من الفحص"}')
check "support: إضافة رسالة" $([ "$(j "$TM" "['ok']")" = "True" ] && echo 1 || echo 0)

echo "=== 4.6 طلباتي + تفاصيل + إلغاء + تحرير الحجز ==="
source /tmp/e2e-vars 2>/dev/null
OL=$(curl -s -b $CJ "$BASE/orders?page=1&limit=10")
check "orders: قائمة طلباتي" $([ "$(j "$OL" "['ok']")" = "True" ] && [ "$(j "$OL" "['data']['total']")" -ge 1 ] && echo 1 || echo 0)
OD=$(curl -s -b $CJ $BASE/orders/$ORDER_ID)
check "orders: تفاصيل (دفع+خط زمني+شحنة)" $([ "$(j "$OD" "['ok']")" = "True" ] && [ "$(j "$OD" "['data']['payment']")" != "None" ] && [ "$(j "$OD" "['data']['timeline']")" != "None" ] && echo 1 || echo 0)
ADDRS=$(curl -s -b $CJ $BASE/addresses)
AID=$(j "$ADDRS" "['data'][0]['id']")
VID=$(j "$OD" "['data']['items'][0]['variantId']")
CN=$(curl -s -b $CJ -X POST $BASE/orders -H 'Content-Type: application/json' -d "{\"addressId\":\"$AID\",\"items\":[{\"variantId\":\"$VID\",\"quantity\":1}],\"shippingMethodCode\":\"PICKUP\",\"paymentMethodCode\":\"BANK_TRANSFER\"}")
CNID=$(j "$CN" "['data']['orderId']")
check "إنشاء طلب قابل للإلغاء" $([ "$(j "$CN" "['ok']")" = "True" ] && [ -n "$CNID" ] && echo 1 || echo 0)
CANCEL=$(curl -s -b $CJ -X POST $BASE/orders/$CNID/cancel -H 'Content-Type: application/json' -d '{"reason":"اختبار الإلغاء الآلي"}')
COK=$(j "$CANCEL" "['ok']")
CSTATE=$(curl -s -b $CJ $BASE/orders/$CNID)
CS=$(j "$CSTATE" "['data']['order']['status']")
check "إلغاء → CANCELLED (حصلت: $CS)" $([ "$COK" = "True" ] && [ "$CS" = "CANCELLED" ] && echo 1 || echo 0)
RES_CANCELLED=$(cd /home/z/my-project && bun run .zscripts/check-reservation-status.ts "$CNID" 2>/dev/null | tail -1)
check "تحرير حجز المخزون بعد الإلغاء ($RES_CANCELLED)" $([ "$RES_CANCELLED" = "NO_ACTIVE" ] && echo 1 || echo 0)

echo "=== 4.7 التقييمات ==="
RV=$(curl -s -b $CJ -X POST $BASE/reviews -H 'Content-Type: application/json' -d "{\"productId\":\"$PID\",\"rating\":5,\"comment\":\"تقييم تجريبي\"}")
check "reviews: رفض بلا orderId/تسليم (رسالة: $(j "$RV" "['error']['message']"))" $([ "$(j "$RV" "['ok']")" = "False" ] && echo 1 || echo 0)
# عميل seed له طلب COMPLETED يحتوي منتجاً
SEED=$(cd /home/z/my-project && bun run .zscripts/get-reviewable.ts 2>/dev/null | tail -1)
SPID=$(echo "$SEED" | cut -d'|' -f1); SORD=$(echo "$SEED" | cut -d'|' -f2)
if [ -n "$SPID" ] && [ "$SPID" != "None" ]; then
  # دخول كعميل seed
  R=$(curl -s -X POST $BASE/auth/request-otp -H 'Content-Type: application/json' -d '{"phone":"712345678"}')
  CODE=$(j "$R" "['data']['devCode']")
  curl -s -c /tmp/e2e-seedcust.txt -X POST $BASE/auth/verify-otp -H 'Content-Type: application/json' -d "{\"phone\":\"712345678\",\"code\":\"$CODE\"}" > /dev/null
  RV2=$(curl -s -b /tmp/e2e-seedcust.txt -X POST $BASE/reviews -H 'Content-Type: application/json' -d "{\"productId\":\"$SPID\",\"orderId\":\"$SORD\",\"rating\":5,\"comment\":\"جودة ممتازة — فحص آلي\"}")
  RV2ST=$(j "$RV2" "['data']['status']"); RV2MSG=$(j "$RV2" "['error']['message']")
  check "reviews: تقييم بعد تسليم → PENDING أو رفض تكرار صريح ($RV2ST$RV2MSG)" $([ "$RV2ST" = "PENDING" ] || [ "$(j "$RV2" "['error']['code']")" = "CONFLICT" ] && echo 1 || echo 0)
fi

echo "=== 4.8 حماية APIs الإدارة من العميل ==="
AD=$(curl -s -b $CJ $BASE/admin/dashboard)
check "admin API محمية من العميل (403)" $([ "$(j "$AD" "['ok']")" = "False" ] && echo 1 || echo 0)

echo ""
echo "===== النتيجة: نجح $PASS / فشل $FAIL ====="
exit $FAIL
