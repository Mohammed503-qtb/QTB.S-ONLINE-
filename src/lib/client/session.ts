'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/client/api'
import { ADMIN_ROLES, type Role } from '@/lib/shared/constants'

// ============================================================
// الجلسة + الإعدادات العامة (TanStack Query)
// ============================================================

export type Me = {
  user: { id: string; name: string; phone: string; role: Role; status: string; avatarUrl?: string | null; customerId?: string | null }
  customer?: { id: string; tier: string; creditBalance: number; totalSpent: number; ordersCount: number } | null
  unreadNotifications: number
} | null

export type PublicConfig = {
  flags: Record<string, boolean>
  settings: {
    storeName: string
    storeTagline: string
    storeLogoUrl: string
    whatsappNumber: string
    supportPhone: string
    currency: string
    currencySymbol: string
    storeHours: string
    address: string
    maintenanceMessage: string
    returnWindowDays: number
    paymentExpiryHours: number
    minOrderTotal: number
  }
  appStatus: string
  version: { minimum: string; latest: string; forceUpdate: boolean; releaseNotes: string }
}

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => api.get<PublicConfig>('/api/config'),
    staleTime: 30_000,
  })
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<Me>('/api/auth/me'),
    staleTime: 15_000,
  })
}

export function useSession() {
  const { data, isLoading, refetch } = useMe()
  const user = data?.user ?? null
  return {
    user,
    customer: data?.customer ?? null,
    unread: data?.unreadNotifications ?? 0,
    isAuthenticated: !!user,
    isAdmin: !!user && ADMIN_ROLES.includes(user.role as Role),
    isLoading,
    refetch,
  }
}

export function useLogin() {
  const qc = useQueryClient()
  return {
    refresh: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
    logout: async () => {
      await api.post('/api/auth/logout')
      qc.clear()
      qc.setQueryData(['me'], { user: null, customer: null, unreadNotifications: 0 })
    },
  }
}
