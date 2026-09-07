'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ============================================================
// متاجر الحالة (Zustand)
// - nav: التنقل داخل SPA (مسار واحد /)
// - cart: السلة مع localStorage
// - ui: حالات عامة (modal تسجيل الدخول ...)
// ============================================================

// ---------- التنقل ----------
export type ViewParams = Record<string, string>

type NavState = {
  view: string
  params: ViewParams
  stack: { view: string; params: ViewParams }[]
  go: (view: string, params?: ViewParams) => void
  replace: (view: string, params?: ViewParams) => void
  back: () => void
  reset: (view: string) => void
}

export const useNav = create<NavState>((set, get) => ({
  view: 'home',
  params: {},
  stack: [],
  go: (view, params = {}) => set((s) => ({ view, params, stack: [...s.stack.slice(-30), { view: s.view, params: s.params }] })),
  replace: (view, params = {}) => set({ view, params }),
  back: () => {
    const s = get()
    const prev = s.stack[s.stack.length - 1]
    if (prev) set({ view: prev.view, params: prev.params, stack: s.stack.slice(0, -1) })
  },
  reset: (view) => set({ view, params: {}, stack: [] }),
}))

// ---------- السلة ----------
export type CartItem = {
  productId: string
  variantId: string
  name: string
  image?: string | null
  price: number
  attributes: Record<string, string>
  quantity: number
}

type CartState = {
  items: CartItem[]
  add: (item: CartItem) => void
  updateQty: (variantId: string, qty: number) => void
  remove: (variantId: string) => void
  clear: () => void
  count: () => number
  total: () => number
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => {
        const items = [...get().items]
        const idx = items.findIndex((i) => i.variantId === item.variantId)
        if (idx >= 0) {
          items[idx] = { ...items[idx], quantity: Math.min(99, items[idx].quantity + item.quantity) }
        } else {
          items.push(item)
        }
        set({ items })
      },
      updateQty: (variantId, qty) => set((s) => ({
        items: qty <= 0 ? s.items.filter((i) => i.variantId !== variantId) : s.items.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(99, qty) } : i)),
      })),
      remove: (variantId) => set((s) => ({ items: s.items.filter((i) => i.variantId !== variantId) })),
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((s, i) => s + i.quantity, 0),
      total: () => get().items.reduce((s, i) => s + i.price * i.quantity, 0),
    }),
    { name: 'ys-cart' }
  )
)

// ---------- حالة UI ----------
type UiState = {
  loginOpen: boolean
  loginReason?: string
  openLogin: (reason?: string) => void
  closeLogin: () => void
}

export const useUi = create<UiState>((set) => ({
  loginOpen: false,
  openLogin: (reason) => set({ loginOpen: true, loginReason: reason }),
  closeLogin: () => set({ loginOpen: false, loginReason: undefined }),
}))

// ---------- واتساب (روابط مباشرة — PLAN ق38) ----------
export function whatsappLink(phone: string, message: string): string {
  const clean = phone.replace(/[^0-9]/g, '')
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`
}
