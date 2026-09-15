'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ============================================================
// متاجر الحالة (Zustand)
// - nav: التنقل داخل SPA (مسار واحد /) بتكامل كامل مع History API
//   → زر/إيماءة الرجوع في أندرويد والمتصفح وiOS تعمل داخل التطبيق
// - cart: السلة مع localStorage
// - ui: حالات عامة (modal تسجيل الدخول ...)
// ============================================================

// ---------- التنقل ----------
export type ViewParams = Record<string, string>
export type NavEntry = { view: string; params: ViewParams }

// شاشات صالحة للوصول العميق عبر الرابط ?view= (اختصارات التطبيق المثبّت + المشاركة)
export const DEEP_VIEWS = new Set([
  'home', 'catalog', 'cart', 'orders', 'order-details', 'favorites',
  'track', 'returns', 'profile', 'addresses', 'notifications',
  'support', 'page', 'product', 'checkout', 'order-success',
  'return-new', 'support-ticket',
])

// شاشات المستوى الأعلى (شريط التنقل السفلي) — لا يظهر لها زر رجوع في الرأس
export const TOP_LEVEL_VIEWS = new Set(['home', 'catalog', 'cart', 'orders', 'profile'])

// شكل حالة السجل الخاصة بنا — تُحفظ داخل كل مدخل History وتنجو من إعادة التحميل
type HistState = {
  qtb: true
  view: string
  params: ViewParams
  stack: NavEntry[]
  qtbModal?: 'login'
}

type NavState = {
  view: string
  params: ViewParams
  stack: NavEntry[]
  go: (view: string, params?: ViewParams) => void
  replace: (view: string, params?: ViewParams) => void
  back: () => void
  reset: (view: string) => void
}

// رابط الشاشة: الشاشات القابلة للمشاركة تظهر في الرابط، والإدارية تبقى نظيفة
function viewUrl(view: string, params: ViewParams): string {
  if (view === 'home' || !DEEP_VIEWS.has(view)) return '/'
  const qs = new URLSearchParams({ view })
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v)
  return `/?${qs.toString()}`
}

const homeState = (): HistState => ({ qtb: true, view: 'home', params: {}, stack: [] })

export const useNav = create<NavState>((set, get) => ({
  view: 'home',
  params: {},
  stack: [],

  // تنقل للأمام: يدخل الشاشة الحالية في المكدس + مدخل سجل جديد
  // → الرجوع (زر أندرويد/المتصفح/سحب iOS) يعود للشاشة السابقة داخل التطبيق
  go: (view, params = {}) => {
    const s = get()
    const stack = [...s.stack.slice(-29), { view: s.view, params: s.params }]
    const state: HistState = { qtb: true, view, params, stack }
    if (typeof window !== 'undefined') window.history.pushState(state, '', viewUrl(view, params))
    set({ view, params, stack })
  },

  // استبدال الشاشة الحالية (فلاتر الكتالوج مثلاً) بلا مدخل سجل جديد
  replace: (view, params = {}) => {
    const state: HistState = { qtb: true, view, params, stack: get().stack }
    if (typeof window !== 'undefined') window.history.replaceState(state, '', viewUrl(view, params))
    set({ view, params })
  },

  // الرجوع: عبر السجل إن وُجد، وإلا إلى الشاشة الجذرية للسياق الحالي
  back: () => {
    const s = get()
    if (typeof window !== 'undefined' && s.stack.length > 0) {
      window.history.back()
      return
    }
    if (s.view.startsWith('admin')) {
      if (s.view !== 'admin-dashboard') get().reset('admin-dashboard')
    } else if (s.view !== 'home' && s.view !== 'store-preview') {
      get().reset('home')
    }
  },

  // إعادة تعيين كاملة (يستبدل مدخل السجل الحالي — لا تاريخ خلفه)
  reset: (view) => {
    const state: HistState = { qtb: true, view, params: {}, stack: [] }
    if (typeof window !== 'undefined') window.history.replaceState(state, '', viewUrl(view, {}))
    set({ view, params: {}, stack: [] })
  },
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
      remove: (variantId) => set({ items: [...get().items.filter((i) => i.variantId !== variantId)] }),
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
  openLogin: (reason) => {
    set({ loginOpen: true, loginReason: reason })
    // مدخل سجل خاص بالنافذة → زر الرجوع يغلقها بدل مغادرة التطبيق
    if (typeof window === 'undefined') return
    const st = window.history.state as HistState | null
    if (st && st.qtb && !st.qtbModal) {
      window.history.pushState({ ...st, qtbModal: 'login' }, '', window.location.href)
    }
  },
  closeLogin: () => {
    set({ loginOpen: false, loginReason: undefined })
    if (typeof window === 'undefined') return
    const st = window.history.state as HistState | null
    if (st && st.qtbModal === 'login') {
      // إزالة علامة النافذة من المدخل الحالي (بدل history.back — يتفادى سباقات popstate)
      const { qtbModal: _modal, ...rest } = st
      window.history.replaceState(rest, '', window.location.href)
    }
  },
}))

// ---------- واتساب (روابط مباشرة — PLAN ق38) ----------
export function whatsappLink(phone: string, message: string): string {
  const clean = phone.replace(/[^0-9]/g, '')
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`
}

// ============================================================
// تكامل History API — يهيّأ مرة واحدة عند تحميل الوحدة في المتصفح
// ============================================================

function isQtbState(st: unknown): st is HistState {
  return !!st && typeof st === 'object' && (st as { qtb?: unknown }).qtb === true
}

if (typeof window !== 'undefined' && !(window as { __qtbNavReady?: boolean }).__qtbNavReady) {
  ;(window as { __qtbNavReady?: boolean }).__qtbNavReady = true

  // نتحكم بالتمرير بأنفسنا (استعادة المتصفح التلقائية تتعارض مع انتقالات الشاشات)
  window.history.scrollRestoration = 'manual'

  // ربط زر/إيماءة الرجوع (أندرويد/المتصفح/iOS) بمكدس الشاشات
  window.addEventListener('popstate', (e) => {
    const st = e.state
    if (isQtbState(st)) {
      useNav.setState({ view: st.view, params: st.params ?? {}, stack: st.stack ?? [] })
      // مزامنة نافذة الدخول مع السجل: الرجوع يغلقها ولا يغادر التطبيق
      if (st.qtbModal === 'login') {
        if (!useUi.getState().loginOpen) useUi.setState({ loginOpen: true })
      } else if (useUi.getState().loginOpen) {
        useUi.setState({ loginOpen: false, loginReason: undefined })
      }
    } else {
      useNav.setState({ view: 'home', params: {}, stack: [] })
      useUi.setState({ loginOpen: false, loginReason: undefined })
    }
  })

  // تهيئة الإقلاع: استعادة الجلسة بعد إعادة التحميل، أو وصول عميق عبر ?view=
  const raw = window.history.state
  if (isQtbState(raw)) {
    // إعادة تحميل: الحالة محفوظة داخل مدخل السجل الحالي — استعادتها كما كانت
    if (raw.qtbModal === 'login') {
      const { qtbModal: _m, ...rest } = raw
      window.history.replaceState(rest, '', window.location.href)
    }
    useNav.setState({ view: raw.view, params: raw.params ?? {}, stack: raw.stack ?? [] })
  } else {
    // وصول عميق: /?view=cart&id=… (اختصارات التطبيق المثبّت + الروابط المشاركة)
    const qs = new URLSearchParams(window.location.search)
    const target = qs.get('view')
    if (target && DEEP_VIEWS.has(target)) {
      const params: ViewParams = {}
      qs.forEach((v, k) => {
        if (k !== 'view' && v) params[k] = v
      })
      const root: NavEntry = { view: 'home', params: {} }
      // نمط التطبيقات الأصلية: الرئيسية تحت الشاشة المستهدفة
      // → الرجوع من اختصار التطبيق يفتح الرئيسية ولا يغلق التطبيق
      window.history.replaceState(homeState(), '', '/')
      useNav.setState({ view: target, params, stack: [root] })
      window.history.pushState({ qtb: true, view: target, params, stack: [root] }, '', viewUrl(target, params))
    } else {
      window.history.replaceState(homeState(), '', window.location.pathname)
    }
  }
}

// مقبض للفحص الآلي (بيئة التطوير فقط)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  ;(window as { __qtbNavStore?: unknown }).__qtbNavStore = useNav
}
