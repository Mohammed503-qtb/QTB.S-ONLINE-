'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  Clock,
  LayoutDashboard,
  Headphones,
  Home,
  LayoutGrid,
  LogIn,
  LogOut,
  MapPin,
  Package,
  Phone,
  Search,
  ShoppingCart,
  Store,
  User,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { EmptyState, FullSpinner } from '@/components/app/spinner'
import { useConfig, useLogin, useSession } from '@/lib/client/session'
import { useCart, useNav, useUi, whatsappLink } from '@/lib/client/stores'
import { LoginModal } from './components/login-modal'
import { HomeView } from './views/home-view'
import { CatalogView } from './views/catalog-view'
import { ProductView } from './views/product-view'
import { CartView } from './views/cart-view'
import { CheckoutView } from './views/checkout-view'
import { OrderSuccessView } from './views/order-success-view'
import { OrdersView } from './views/orders-view'
import { OrderDetailsView } from './views/order-details-view'
import { TrackView } from './views/track-view'
import { ReturnsView } from './views/returns-view'
import { ReturnNewView } from './views/return-new-view'
import { AddressesView } from './views/addresses-view'
import { NotificationsView } from './views/notifications-view'
import { SupportView } from './views/support-view'
import { SupportTicketView } from './views/support-ticket-view'
import { PageView } from './views/page-view'
import { FavoritesView } from './views/favorites-view'
import { ProfileView } from './views/profile-view'

// ============================================================
// قشرة واجهة العميل — Header + Views + Footer + تنقل سفلي موبايل
// ============================================================

const POLICY_LINKS: { slug: string; label: string }[] = [
  { slug: 'about', label: 'من نحن' },
  { slug: 'return-policy', label: 'سياسة الإرجاع' },
  { slug: 'shipping-policy', label: 'سياسة الشحن' },
  { slug: 'payment-policy', label: 'سياسة الدفع' },
  { slug: 'terms', label: 'الشروط والأحكام' },
  { slug: 'privacy', label: 'الخصوصية' },
  { slug: 'faq', label: 'الأسئلة الشائعة' },
]

export function StoreShell({ preview }: { preview?: boolean }) {
  const { data: config } = useConfig()
  const view = useNav((s) => s.view)
  const params = useNav((s) => s.params)
  const reset = useNav((s) => s.reset)

  // تمرير لأعلى عند تغيير الشاشة (سلوك SPA)
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [view, params])

  if (!config) return <FullSpinner label="جارِ تحميل المتجر..." />

  const whatsappEnabled = config.flags.whatsapp_enabled !== false

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {preview && (
        <div className="flex flex-wrap items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-bold text-amber-950">
          <span>أنت تعاين واجهة المتجر بصفتك إداريًا</span>
          <Button size="sm" variant="outline" className="h-8 border-amber-800 bg-transparent text-amber-950 hover:bg-amber-100" onClick={() => reset('admin-dashboard')}>
            العودة إلى لوحة الإدارة
          </Button>
        </div>
      )}

      <StoreHeader />

      <main className="flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${view}:${JSON.stringify(params)}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <CurrentView view={view} params={params} />
          </motion.div>
        </AnimatePresence>
      </main>

      <StoreFooter whatsappEnabled={whatsappEnabled} />

      {/* شريط التنقل السفلي (موبايل فقط) */}
      <BottomNav />

      {/* زر واتساب العائم */}
      {whatsappEnabled && (
        <a
          href={whatsappLink(config.settings.whatsappNumber, 'مرحبًا، لدي استفسار عن متجر الأصيل')}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="تواصل عبر واتساب"
          className="fixed bottom-20 end-4 z-50 flex size-14 items-center justify-center rounded-full bg-[#22c55e] text-white shadow-lg shadow-emerald-900/30 transition-transform hover:scale-110 lg:bottom-6"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-7" aria-hidden>
            <path d="M17.472 14.382c-.297-.148-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.148-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
          </svg>
        </a>
      )}

      <LoginModal />
    </div>
  )
}

// ---------- الهيدر ----------
function StoreHeader() {
  const { data: config } = useConfig()
  const { user, unread, isAuthenticated, isAdmin } = useSession()
  const go = useNav((s) => s.go)
  const openLogin = useUi((s) => s.openLogin)
  const { logout } = useLogin()
  const cartCount = useCart((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  const storeName = config?.settings.storeName ?? 'متجر الأصيل'
  const logo = config?.settings.storeLogoUrl

  const [search, setSearch] = useState('')
  const submitSearch = () => {
    const q = search.trim()
    if (!q) return
    go('catalog', { search: q })
    setMobileSearchOpen(false)
    setSearch('')
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
        {/* الشعار واسم المتجر */}
        <button
          type="button"
          onClick={() => go('home')}
          className="flex min-h-11 items-center gap-2 font-extrabold"
          aria-label={`${storeName} — الرئيسية`}
        >
          {logo ? (
            <img src={logo} alt={`شعار ${storeName}`} className="size-9 rounded-xl object-contain" />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-700 text-lg text-white" aria-hidden>
              🛍️
            </span>
          )}
          <span className="hidden text-lg sm:inline">{storeName}</span>
        </button>

        {/* صندوق البحث (سطح المكتب) */}
        <div className="relative mx-4 hidden flex-1 md:block">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            aria-label="بحث في المتجر"
            className="min-h-11 ps-9"
            placeholder="ابحث عن منتج..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitSearch()
            }}
          />
        </div>

        <div className="ms-auto flex items-center gap-1">
          {/* زر البحث (موبايل) */}
          <Button
            variant="ghost"
            size="icon"
            className="size-11 md:hidden"
            aria-label="بحث"
            onClick={() => setMobileSearchOpen((o) => !o)}
          >
            {mobileSearchOpen ? <X className="size-5" aria-hidden /> : <Search className="size-5" aria-hidden />}
          </Button>

          {/* السلة (سطح المكتب) */}
          <Button variant="ghost" size="icon" className="relative hidden size-11 lg:inline-flex" aria-label={`السلة${cartCount > 0 ? ` (${cartCount} منتج)` : ''}`} onClick={() => go('cart')}>
            <ShoppingCart className="size-5" aria-hidden />
            {cartCount > 0 && (
              <span className="absolute end-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </Button>

          {/* الإشعارات */}
          <Button variant="ghost" size="icon" className="relative size-11" aria-label={`الإشعارات${unread > 0 ? ` (${unread} غير مقروء)` : ''}`} onClick={() => go('notifications')}>
            <Bell className="size-5" aria-hidden />
            {unread > 0 && (
              <span className="absolute end-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Button>

          {/* الحساب */}
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-11" aria-label="حسابي">
                  <User className="size-5" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-sm">
                  {user?.name}
                  <span dir="ltr" className="block text-xs font-normal text-muted-foreground">
                    {user?.phone}
                  </span>
                </DropdownMenuLabel>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => go('admin-dashboard')} className="min-h-10 cursor-pointer font-medium text-emerald-700 focus:text-emerald-700">
                    <LayoutDashboard className="size-4" aria-hidden /> لوحة الإدارة
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => go('profile')} className="min-h-10 cursor-pointer">
                  <User className="size-4" aria-hidden /> بياناتي
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => go('orders')} className="min-h-10 cursor-pointer">
                  <Package className="size-4" aria-hidden /> طلباتي
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => go('favorites')} className="min-h-10 cursor-pointer">
                  <Bell className="size-4" aria-hidden /> المفضلة
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => go('support')} className="min-h-10 cursor-pointer">
                  <Headphones className="size-4" aria-hidden /> الدعم الفني
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="min-h-10 cursor-pointer text-rose-600 focus:text-rose-600"
                  onClick={async () => {
                    try {
                      await logout()
                      toast.success('تم تسجيل الخروج')
                      window.setTimeout(() => window.location.reload(), 400)
                    } catch {
                      toast.error('تعذر تسجيل الخروج')
                    }
                  }}
                >
                  <LogOut className="size-4" aria-hidden /> تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label="تسجيل الدخول"
              onClick={() => openLogin()}
            >
              <LogIn className="size-5" aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {/* صندوق البحث (موبايل) */}
      {mobileSearchOpen && (
        <div className="border-t p-3 md:hidden">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              autoFocus
              aria-label="بحث في المتجر"
              className="min-h-11 ps-9"
              placeholder="ابحث عن منتج..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitSearch()
              }}
            />
          </div>
        </div>
      )}
    </header>
  )
}

// ---------- الفوتر ----------
function StoreFooter({ whatsappEnabled }: { whatsappEnabled: boolean }) {
  const { data: config } = useConfig()
  const go = useNav((s) => s.go)
  const s = config?.settings
  if (!s) return null

  return (
    <footer className="mt-auto border-t bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-3">
        {/* معلومات المتجر */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {s.storeLogoUrl ? (
              <img src={s.storeLogoUrl} alt={`شعار ${s.storeName}`} className="size-10 rounded-xl object-contain" />
            ) : (
              <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-700 text-lg text-white" aria-hidden>
                <Store className="size-5" />
              </span>
            )}
            <div>
              <h3 className="font-extrabold">{s.storeName}</h3>
              <p className="text-xs text-muted-foreground">{s.storeTagline}</p>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              <span>أوقات العمل: {s.storeHours || 'السبت–الخميس 8ص–8م'}</span>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              <span>{s.address || 'اليمن'}</span>
            </li>
            <li className="flex items-start gap-2">
              <Phone className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              <span dir="ltr">{s.supportPhone || s.whatsappNumber}</span>
            </li>
          </ul>
          {whatsappEnabled && (
            <a
              href={whatsappLink(s.whatsappNumber, 'مرحبًا، لدي استفسار')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#22c55e] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden>
                <path d="M17.472 14.382c-.297-.148-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.148-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
              </svg>
              تواصل معنا عبر واتساب
            </a>
          )}
        </div>

        {/* روابط السياسات */}
        <nav aria-label="السياسات والصفحات">
          <h3 className="mb-3 font-bold">السياسات والمساعدة</h3>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
            {POLICY_LINKS.map((l) => (
              <li key={l.slug}>
                <button
                  type="button"
                  onClick={() => go('page', { slug: l.slug })}
                  className="flex min-h-9 items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {l.label}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => go('track')}
                className="flex min-h-9 items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                تتبع طلبك
              </button>
            </li>
          </ul>
        </nav>

        {/* اختصارات */}
        <nav aria-label="اختصارات">
          <h3 className="mb-3 font-bold">حسابي</h3>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
            {[
              { view: 'orders', label: 'طلباتي' },
              { view: 'addresses', label: 'عناويني' },
              { view: 'returns', label: 'طلبات الإرجاع' },
              { view: 'favorites', label: 'المفضلة' },
              { view: 'support', label: 'الدعم الفني' },
              { view: 'notifications', label: 'الإشعارات' },
            ].map((l) => (
              <li key={l.view}>
                <button
                  type="button"
                  onClick={() => go(l.view)}
                  className="flex min-h-9 items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {l.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t px-4 pb-20 pt-4 text-center text-xs text-muted-foreground lg:pb-4">
        © {new Date().getFullYear()} {s.storeName} — جميع الحقوق محفوظة · صنع بحب في اليمن 🇾🇪
      </div>
    </footer>
  )
}

// ---------- التنقل السفلي (موبايل) ----------
function BottomNav() {
  const view = useNav((s) => s.view)
  const go = useNav((s) => s.go)
  const openLogin = useUi((s) => s.openLogin)
  const { isAuthenticated } = useSession()
  const count = useCart((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))

  const items: { view: string; label: string; icon: React.ReactNode; badge?: number }[] = [
    { view: 'home', label: 'الرئيسية', icon: <Home className="size-5" aria-hidden /> },
    { view: 'catalog', label: 'الأقسام', icon: <LayoutGrid className="size-5" aria-hidden /> },
    { view: 'cart', label: 'السلة', icon: <ShoppingCart className="size-5" aria-hidden />, badge: count },
    { view: 'orders', label: 'طلباتي', icon: <Package className="size-5" aria-hidden /> },
  ]

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {items.map((item) => {
        const active = view === item.view || (item.view === 'catalog' && view.startsWith('catal'))
        return (
          <button
            key={item.view}
            type="button"
            onClick={() => go(item.view)}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
              active ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'
            }`}
          >
            <span className="relative">
              {item.icon}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -end-2.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </span>
            {item.label}
            {active && <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-emerald-600" aria-hidden />}
          </button>
        )
      })}
      <button
        type="button"
        onClick={() => (isAuthenticated ? go('profile') : openLogin())}
        aria-label="حسابي"
        aria-current={view === 'profile' ? 'page' : undefined}
        className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
          view === 'profile' ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'
        }`}
      >
        {isAuthenticated ? <User className="size-5" aria-hidden /> : <LogIn className="size-5" aria-hidden />}
        حسابي
        {view === 'profile' && <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-emerald-600" aria-hidden />}
      </button>
    </nav>
  )
}

// ---------- مفتاح الشاشات ----------
function CurrentView({ view, params }: { view: string; params: Record<string, string> }) {
  switch (view) {
    case 'home':
    case 'store-preview':
      return <HomeView />
    case 'catalog':
      return <CatalogView />
    case 'product':
      return <ProductView id={params.id ?? ''} />
    case 'cart':
      return <CartView />
    case 'checkout':
      return <CheckoutView couponCode={params.coupon} />
    case 'order-success':
      return <OrderSuccessView id={params.id ?? ''} />
    case 'orders':
      return <OrdersView />
    case 'order-details':
      return <OrderDetailsView id={params.id ?? ''} />
    case 'track':
      return <TrackView initialCode={params.code} />
    case 'returns':
      return <ReturnsView />
    case 'return-new':
      return <ReturnNewView orderId={params.orderId ?? ''} />
    case 'profile':
      return <ProfileView />
    case 'addresses':
      return <AddressesView />
    case 'notifications':
      return <NotificationsView />
    case 'support':
      return <SupportView />
    case 'support-ticket':
      return <SupportTicketView id={params.id ?? ''} />
    case 'page':
      return <PageView slug={params.slug ?? ''} />
    case 'favorites':
      return <FavoritesView />
    default:
      return (
        <EmptyState
          icon="🧭"
          title="الصفحة غير موجودة"
          subtitle="انتقل إلى الرئيسية واستكشف منتجاتنا"
        />
      )
  }
}
