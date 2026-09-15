'use client'

import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { ApiClientError } from '@/lib/client/api'
import { NETWORK_ERROR_EVENT, OfflineIndicator } from '@/components/store/components/offline-indicator'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 10_000,
          },
        },
        queryCache: new QueryCache({
          onError: (error) => {
            // خطأ شبكة (فشل fetch أو استجابة offline من الـ SW) → بث فوري لمؤشر الاتصال
            if (
              typeof window !== 'undefined' &&
              error instanceof ApiClientError &&
              (error.status === 0 || error.code === 'NETWORK_ERROR' || error.code === 'OFFLINE')
            ) {
              window.dispatchEvent(new Event(NETWORK_ERROR_EVENT))
            }
          },
        }),
      })
  )
  return (
    <QueryClientProvider client={client}>
      <OfflineIndicator />
      {children}
    </QueryClientProvider>
  )
}
