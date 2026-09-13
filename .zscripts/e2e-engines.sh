#!/bin/bash
# ===== E2E المرحلة 3: محركات الخادم — بالأشكال الصحيحة =====
BASE="http://localhost:3000/api"
PASS=0; FAIL=0
check() { if [ "$2" = "1" ]; then PASS=$((PASS+1)); echo "  ✓ $1"; else FAIL=$((FAIL+1)); echo "  ❌ $1"; fi }
j() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d$2)" 2>/dev/null; }

echo "=== 3.1 محرك المصادقة: OTP لكل دور ==="
declare -A ROLES=( [SUPER_ADMIN]=777000001 [MANAGER]=777000002 [ACCOUNTANT]=777000003 [WAREHOUSE]=777000004 [CONTENT_MANAGER]=777000005 [DELIVERY_OPERATOR]=777000006 )
for role in SUPER_ADMIN MANAGER ACCOUNTANT WAREHOUSE CONTENT_MANAGER DELIVERY_OPERATOR; do
  phone=${ROLES[$role]}
  R=$(curl -s -X POST $BASE/auth/request-otp -H 'Content-Type: application/json' -d "{\"phone\":\"$phone\"}")
  CODE=$(j "$R" "['data']['devCode']")
  V=$(curl -s -c /tmp/e2e-${role,,}.txt -X POST $BASE/auth/verify-otp -H 'Content-Type: application/json' -d "{\"phone\":\"$phone\",\"code\":\"$CODE\"}")
  VOK=$(j "$V" "['ok']"); ROLE_GOT=$(j "$V" "['data']['user']['role']")
  check "$role: دخول OTP" $([ "$VOK" = "True" ] && [ "$ROLE_GOT" = "$role" ] && echo 1 || echo 0)
done
# عميل جديد مع اسم (تسجيل)
R=$(curl -s -X POST $BASE/auth/request-otp -H 'Content-Type: application/json' -d '{"phone":"778899001"}')
CODE=$(j "$R" "['data']['devCode']")
V=$(curl -s -c /tmp/e2e-customer.txt -X POST $BASE/auth/verify-otp -H 'Content-Type: application/json' -d "{\"phone\":\"778899001\",\"code\":\"$CODE\",\"name\":\"عميل E2E\"}")
VOK=$(j "$V" "['ok']"); ROLE_GOT=$(j "$V" "['data']['user']['role']")
check "CUSTOMER جديد: تسجيل باسم → role=$ROLE_GOT" $([ "$VOK" = "True" ] && [ "$ROLE_GOT" = "CUSTOMER" ] && echo 1 || echo 0)

echo "=== 3.2 محرك الجلسات: me + خروج ==="
ME=$(curl -s -b /tmp/e2e-customer.txt $BASE/auth/me)
check "GET /auth/me يعيد الجلسة" $([ "$(j "$ME" "['ok']")" = "True" ] && [ "$(j "$ME" "['data']['user']['role']")" = "CUSTOMER" ] && echo 1 || echo 0)
LO=$(curl -s -b /tmp/e2e-customer.txt -X POST $BASE/auth/logout)
ME2=$(curl -s -b /tmp/e2e-customer.txt $BASE/auth/me)
check "خروج يبطل الجلسة (me→null)" $([ "$(j "$LO" "['ok']")" = "True" ] && [ "$(j "$ME2" "['data']")" = "None" ] && echo 1 || echo 0)
# إعادة دخول
R=$(curl -s -X POST $BASE/auth/request-otp -H 'Content-Type: application/json' -d '{"phone":"778899001"}')
CODE=$(j "$R" "['data']['devCode']")
curl -s -c /tmp/e2e-customer.txt -X POST $BASE/auth/verify-otp -H 'Content-Type: application/json' -d "{\"phone\":\"778899001\",\"code\":\"$CODE\"}" > /dev/null

echo "=== 3.3 محرك التسعير ==="
PID=$(curl -s "$BASE/catalog/products?limit=1" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['products'][0]['id'])")
VID=$(curl -s "$BASE/catalog/products/$PID" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['variants'][0]['id'])")
AVAIL=$(curl -s "$BASE/catalog/products/$PID" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['variants'][0]['available'])")
# عنوان أولاً
ADDR=$(curl -s -b /tmp/e2e-customer.txt -X POST $BASE/addresses -H 'Content-Type: application/json' -d '{"label":"منزل","governorate":"عدن","city":"عدن","district":"كريتر","street":"شارع الطلاب","phone":"778899001"}')
AID=$(j "$ADDR" "['data']['id']")
check "إنشاء عنوان" $([ -n "$AID" ] && echo 1 || echo 0)
Q=$(curl -s -b /tmp/e2e-customer.txt -X POST $BASE/checkout/quote -H 'Content-Type: application/json' -d "{\"items\":[{\"variantId\":\"$VID\",\"quantity\":2}],\"addressId\":\"$AID\",\"shippingMethodCode\":\"HOME_DELIVERY\"}")
check "quote: تسعير+شحن من الخادم" $([ "$(j "$Q" "['ok']")" = "True" ] && [ "$(j "$Q" "['data']['grandTotal']")" -gt 0 ] && echo 1 || echo 0)
GT=$(j "$Q" "['data']['grandTotal']")
SF=$(j "$Q" "['data']['shippingFee']")
IT=$(j "$Q" "['data']['itemsTotal']")
echo "    بنود=$IT شحن=$SF مجموع=$GT"
# كوبون خاطئ يجب رفضه
QC=$(curl -s -b /tmp/e2e-customer.txt -X POST $BASE/checkout/quote -H 'Content-Type: application/json' -d "{\"items\":[{\"variantId\":\"$VID\",\"quantity\":1}],\"couponCode\":\"WRONG999\"}")
check "كوبون غير موجود → رفض صريح برسالة عربية" $([ "$(j "$QC" "['ok']")" = "False" ] && [ -n "$(j "$QC" "['error']['message']")" ] && echo 1 || echo 0)

echo "=== 3.4 محرك الطلبات + Idempotency ==="
BAL_BEFORE=$(bun run .zscripts/get-balance.ts "$VID" 2>/dev/null | tail -1)
IDEM="e2e-$(date +%s)-abc123"
O1=$(curl -s -b /tmp/e2e-customer.txt -X POST $BASE/orders -H 'Content-Type: application/json' -d "{\"addressId\":\"$AID\",\"items\":[{\"variantId\":\"$VID\",\"quantity\":2}],\"shippingMethodCode\":\"HOME_DELIVERY\",\"paymentMethodCode\":\"BANK_TRANSFER\",\"idempotencyKey\":\"$IDEM\"}")
O1OK=$(j "$O1" "['ok']"); OST=$(j "$O1" "['data']['status']")
check "إنشاء طلب تحويل → PENDING_PAYMENT" $([ "$O1OK" = "True" ] && [ "$OST" = "PENDING_PAYMENT" ] && echo 1 || echo 0)
OID=$(j "$O1" "['data']['orderId']"); ONUM=$(j "$O1" "['data']['orderNumber']")
O2=$(curl -s -b /tmp/e2e-customer.txt -X POST $BASE/orders -H 'Content-Type: application/json' -d "{\"addressId\":\"$AID\",\"items\":[{\"variantId\":\"$VID\",\"quantity\":2}],\"shippingMethodCode\":\"HOME_DELIVERY\",\"paymentMethodCode\":\"BANK_TRANSFER\",\"idempotencyKey\":\"$IDEM\"}")
SAME=$(j "$O2" "['data']['orderId']")
DUPF=$(j "$O2" "['data']['duplicated']")
check "Idempotency: نفس المفتاح → نفس الطلب ($DUPF)" $([ "$SAME" = "$OID" ] && [ "$DUPF" = "True" ] && echo 1 || echo 0)
echo "    الطلب: $ONUM | متاح قبل: $BAL_BEFORE"

echo "=== 3.5 محرك المخزون: حجز فوري ==="
BAL_AFTER=$(bun run .zscripts/get-balance.ts "$VID" 2>/dev/null | tail -1)
RES=$(bun run .zscripts/check-reservation.ts "$OID" 2>/dev/null | tail -1)
check "الحجز عند الإنشاء: $BAL_BEFORE → $BAL_AFTER ($RES)" $([ "$RES" = "RESERVED:2" ] && echo 1 || echo 0)

echo "=== 3.6 محرك الدفع: تسجيل التحويل ==="
PAYID=$(bun run .zscripts/get-payment.ts "$OID" 2>/dev/null | tail -1)
PS=$(curl -s -b /tmp/e2e-customer.txt -X POST $BASE/payments/$PAYID/submit -H 'Content-Type: application/json' -d "{\"amount\":$GT,\"customerTransferRef\":\"TRX-$RANDOM\",\"transferDate\":\"2026-09-07\",\"senderName\":\"عميل E2E\"}")
PSOK=$(j "$PS" "['ok']"); PST=$(j "$PS" "['data']['status']")
OD=$(curl -s -b /tmp/e2e-customer.txt $BASE/orders/$OID)
OST2=$(j "$OD" "['data']['order']['status']")
check "تسجيل تحويل → SUBMITTED + طلب PAYMENT_REVIEW ($OST2)" $([ "$PSOK" = "True" ] && [ "$PST" = "SUBMITTED" ] && [ "$OST2" = "PAYMENT_REVIEW" ] && echo 1 || echo 0)
# مبلغ خاطئ يجب أن يُسجل كما هو (التحقق الإداري لاحقاً)
echo "PAYMENT_ID=$PAYID" > /tmp/e2e-vars
echo "ORDER_ID=$OID" >> /tmp/e2e-vars
echo "ORDER_NUM=$ONUM" >> /tmp/e2e-vars
echo "GT=$GT" >> /tmp/e2e-vars

echo ""
echo "===== النتيجة: نجح $PASS / فشل $FAIL ====="
exit $FAIL
