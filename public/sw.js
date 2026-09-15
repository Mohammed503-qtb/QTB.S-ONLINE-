/* ============================================================
   Service Worker — متجر الأصيل (v1.1.0)
   - تنقلات (HTML): شبكة أولاً ← نسخة مخزنة لنفس الرابط ← نسخة
     مخزنة بمعاملات مهملة ← قشرة "/" ← offline.html
     (الصفحات التي زرتها سابقًا تفتح بلا إنترنت)
   - API للقراءة فقط (الإعدادات + الكتالوج): شبكة أولاً مع سقوط
     للنسخة الأخيرة المخزنة (بيانات آخر زيارة عند انقطاع الاتصال)
   - باقي API: شبكة فقط (بيانات أعمال حية لا تُخزن)
   - أصول ثابتة وأيقونات وصور المنتجات: تخزين أولاً
   - خطوط Google: stale-while-revalidate
   ============================================================ */

const VERSION = 'v1.1.0'
const STATIC_CACHE = `qtb-static-${VERSION}`
const PAGES_CACHE = `qtb-pages-${VERSION}`
const ASSETS_CACHE = `qtb-assets-${VERSION}`
const API_CACHE = `qtb-api-${VERSION}`
const OFFLINE_URL = '/offline.html'

const PRECACHE = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
]

// نقاط نهاية للقراءة فقط — مسموح عرض نسخة مخزنة عند انقطاع الاتصال
function isReadOnlyApi(pathname) {
  return pathname === '/api/config' || pathname.startsWith('/api/catalog/')
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.endsWith(VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // بيانات أعمال حية (طلبات/سلة/دفع...) — شبكة فقط
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    if (isReadOnlyApi(url.pathname)) {
      // قراءة فقط: شبكة أولاً ← آخر نسخة مخزنة ← خطأ عربي منظم
      event.respondWith(
        fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(API_CACHE).then((c) => c.put(req, copy)).catch(() => {})
            }
            return res
          })
          .catch(() =>
            caches.match(req).then(
              (cached) =>
                cached ||
                new Response(
                  JSON.stringify({
                    ok: false,
                    error: { code: 'OFFLINE', message: 'لا يوجد اتصال — تظهر البيانات المخزنة عند توفرها' },
                  }),
                  { status: 503, headers: { 'Content-Type': 'application/json' } }
                )
            )
          )
      )
    }
    return
  }

  // تنقلات (HTML) — شبكة أولاً مع سلسلة رجوع للصفحات المخزنة
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(PAGES_CACHE).then((c) => c.put(req, copy)).catch(() => {})
          return res
        })
        .catch(async () => {
          // 1) نفس الرابط مخزنًا  2) نفس المساس بمعاملات مهملة  3) قشرة التطبيق "/"  4) صفحة عدم الاتصال
          const exact = await caches.match(req)
          if (exact) return exact
          const loose = await caches.match(req, { ignoreSearch: true })
          if (loose) return loose
          const shell = await caches.match('/')
          if (shell) return shell
          return (await caches.match(OFFLINE_URL)) || Response.error()
        })
    )
    return
  }

  // خطوط جوجل (cross-origin) — stale-while-revalidate
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(ASSETS_CACHE).then((c) => c.put(req, copy)).catch(() => {})
            }
            return res
          })
          .catch(() => cached)
        return cached || network
      })
    )
    return
  }

  // أصول محلية (أيقونات، صور المنتجات، ملفات عامة) — تخزين أولاً ثم شبكة
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached
        return fetch(req)
          .then((res) => {
            if (res.ok && (url.pathname.startsWith('/icons/') || url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/_next/static/'))) {
              const copy = res.clone()
              caches.open(ASSETS_CACHE).then((c) => c.put(req, copy)).catch(() => {})
            }
            return res
          })
          .catch(() => cached)
      })
    )
  }
})

// قفزة إصدار: عند توفر تحديث خذ التحكم فورًا
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
