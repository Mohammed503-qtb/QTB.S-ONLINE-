/* ============================================================
   Service Worker — متجر الأصيل
   - صفحات: شبكة أولاً (أحدث دائمًا) مع سقوط للنسخة المخزنة ثم offline
   - أصول ثابتة وأيقونات وصور المنتجات: تخزين أولاً
   - API: شبكة فقط (بيانات أعمال حية لا تُخزن)
   - خطوط Google: stale-while-revalidate
   ============================================================ */

const VERSION = 'v1.0.0'
const STATIC_CACHE = `qtb-static-${VERSION}`
const PAGES_CACHE = `qtb-pages-${VERSION}`
const ASSETS_CACHE = `qtb-assets-${VERSION}`
const OFFLINE_URL = '/offline.html'

const PRECACHE = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
]

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

  // API بيانات حية — شبكة فقط
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return

  // تنقلات (HTML) — شبكة أولاً مع سقوط لصفحة offline المستقلة
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(PAGES_CACHE).then((c) => c.put(req, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match(OFFLINE_URL))
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
