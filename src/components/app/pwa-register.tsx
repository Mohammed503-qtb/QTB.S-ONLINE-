'use client'

import { useEffect } from 'react'

// ============================================================
// تسجيل Service Worker — يجعل المتجر قابلاً للتثبيت والعمل
// بلا اتصال. عند توفر إصدار جديد يتم تفعيله فورًا (SKIP_WAITING)
// ============================================================

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          // قفزة الإصدار: تحديث فوري عند توفر نسخة جديدة
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing
            if (!worker) return
            worker.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                worker.postMessage('SKIP_WAITING')
              }
            })
          })
        })
        .catch(() => {
          // بيئة لا تدعم SW أو تسجيل فاشل — التطبيق يعمل كالمعتاد
        })
    }

    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
