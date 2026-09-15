'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

// ============================================================
// خطاف تثبيت التطبيق (PWA) — يلتقط beforeinstallprompt ويتيح
// التثبيت بنقرة واحدة على Android/Chrome، ويكشف iOS/وضع standalone
// (يُقرأ من المتصفح عبر useSyncExternalStore بلا فرق ترطيب)
// ============================================================

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STANDALONE_QUERY = '(display-mode: standalone)'

function subscribeStandalone(callback: () => void) {
  const mq = window.matchMedia(STANDALONE_QUERY)
  mq.addEventListener('change', callback)
  window.addEventListener('appinstalled', callback)
  return () => {
    mq.removeEventListener('change', callback)
    window.removeEventListener('appinstalled', callback)
  }
}

function getStandaloneSnapshot(): boolean {
  return (
    window.matchMedia(STANDALONE_QUERY).matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function getServerSnapshot(): boolean {
  return false
}

// وكيل المستخدم لا يتغير أثناء الجلسة — اشتراك فارغ يكفي
function subscribeUserAgent(): () => void {
  return () => {}
}

function getIOS(): boolean {
  const ua = navigator.userAgent
  // iPhone/iPad (يشمل iPadOS الذي يتنكر كـ Mac)
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  const isStandalone = useSyncExternalStore(subscribeStandalone, getStandaloneSnapshot, getServerSnapshot)
  const isIOS = useSyncExternalStore(subscribeUserAgent, getIOS, getServerSnapshot)

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setDeferred(null)

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferred) return 'unavailable'
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') setDeferred(null)
    return outcome
  }, [deferred])

  return {
    canInstall: deferred !== null,
    isStandalone,
    isIOS,
    install,
  }
}
