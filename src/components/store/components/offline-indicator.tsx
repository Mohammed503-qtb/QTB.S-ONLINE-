'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

// ============================================================
// مؤشر الاتصال العام — شريط أعلى الشاشة يظهر عند:
// 1) انقطاع الجهاز عن الإنترنت (حدث offline / navigator.onLine)
// 2) تعذر الوصول إلى الخادم (فحص دوري حقيقي + أخطاء الاستعلامات)
// وعند عودة الاتصال يختفي تلقائيًا مع إعادة جلب البيانات النشطة
// ============================================================

export const NETWORK_ERROR_EVENT = 'qtb:network-error'

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getOnlineSnapshot(): boolean {
  return navigator.onLine
}

function getServerSnapshot(): boolean {
  // SSR: نفترض متصلًا حتى الترطيب
  return true
}

export function OfflineIndicator() {
  const queryClient = useQueryClient()
  const onLine = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerSnapshot)
  const [serverUnreachable, setServerUnreachable] = useState(false)
  const wasShownRef = useRef(false)

  // فحص حقيقي للوصول إلى الخادم (HEAD لملف ثابت خفيف — يتجاوز كل الذاكرات)
  const probe = useCallback(async () => {
    if (document.visibilityState === 'hidden') return
    try {
      const res = await fetch('/manifest.webmanifest', { method: 'HEAD', cache: 'no-store' })
      setServerUnreachable(!res.ok)
    } catch {
      setServerUnreachable(true)
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(probe, 12_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void probe()
    }
    const onQueryNetworkError = () => setServerUnreachable(true)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener(NETWORK_ERROR_EVENT, onQueryNetworkError)
    // فحص أول مؤجل خارج المسار المتزامن للـ effect
    const first = window.setTimeout(probe, 0)
    return () => {
      window.clearInterval(id)
      window.clearTimeout(first)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener(NETWORK_ERROR_EVENT, onQueryNetworkError)
    }
  }, [probe])

  // عند عودة الجهاز للاتصال: فحص فوري (لا انتظار للدورة التالية)
  useEffect(() => {
    if (!onLine) return
    const t = window.setTimeout(probe, 0)
    return () => window.clearTimeout(t)
  }, [onLine, probe])

  const show = !onLine || serverUnreachable

  // الاستعادة: عند الانتقال من "ظاهر" إلى "مخفي" أعد جلب الاستعلامات النشطة
  useEffect(() => {
    if (wasShownRef.current && !show) {
      wasShownRef.current = false
      void queryClient.refetchQueries({ type: 'active' }).catch(() => {})
    } else if (show) {
      wasShownRef.current = true
    }
  }, [show, queryClient])

  if (!show) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-amber-500 text-amber-950 dark:bg-amber-600 dark:text-amber-50"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center text-xs font-bold sm:text-sm">
        <WifiOff className="size-4 shrink-0" aria-hidden />
        <span>
          {!onLine
            ? 'لا يوجد اتصال بالإنترنت — الصفحات التي زرتها سابقًا تعمل الآن من الذاكرة'
            : 'تعذر الوصول إلى المتجر — سنعود تلقائيًا فور عودة الاتصال'}
        </span>
      </div>
    </div>
  )
}
