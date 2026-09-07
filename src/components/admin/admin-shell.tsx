'use client'

// ============================================================
// قشرة الإدارة — Sidebar يمين (RTL) + شريط علوي + مبدل Views
// تُستخدم من RootApp لأي view يبدأ بـ admin-*
// ============================================================

import { useState, type ComponentType } from 'react'
import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'
import {
  Activity, ArrowLeftRight, BarChart3, Bell, Boxes, ChevronDown, ClipboardList, CreditCard,
  Eye, HandCoins, Landmark, LayoutDashboard, LifeBuoy, LogOut, Megaphone, Menu, Moon, Newspaper,
  Package, ReceiptText, ScrollText, Search, ShoppingCart, SlidersHorizontal, Star, Sun, Tags,
  TicketPercent, Truck, Undo2, UserCog, Users, Warehouse,
} from 'lucide-react'
import { useNav } from '@/lib/client/stores'
import { useConfig, useLogin, useSession } from '@/lib/client/session'
import { roleLabel } from '@/lib/client/format'
import { hasPermission, type Permission, type Role } from '@/lib/shared/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { FullSpinner } from '@/components/app/spinner'
import { SmartImage } from '@/components/admin/components/kit'
import { cn } from '@/lib/utils'

import { DashboardView } from '@/components/admin/views/dashboard-view'
import { OperationsView } from '@/components/admin/views/operations-view'
import { OrdersView } from '@/components/admin/views/orders-view'
import { OrderDetailsView } from '@/components/admin/views/order-details-view'
import { PaymentsView } from '@/components/admin/views/payments-view'
import { PaymentDetailsView } from '@/components/admin/views/payment-details-view'
import { ProductsView } from '@/components/admin/views/products-view'
import { CategoriesView } from '@/components/admin/views/categories-view'
import { InventoryView } from '@/components/admin/views/inventory-view'
import { MovementsView } from '@/components/admin/views/movements-view'
import { WarehousesView } from '@/components/admin/views/warehouses-view'
import { PurchasesView } from '@/components/admin/views/purchases-view'
import { SuppliersView } from '@/components/admin/views/suppliers-view'
import { BanksView } from '@/components/admin/views/banks-view'
import { ExpensesView } from '@/components/admin/views/expenses-view'
import { ReturnsView } from '@/components/admin/views/returns-view'
import { RefundsView } from '@/components/admin/views/refunds-view'
import { CouponsView } from '@/components/admin/views/coupons-view'
import { ContentView } from '@/components/admin/views/content-view'
import { CustomersView } from '@/components/admin/views/customers-view'
import { CustomerDetailsView } from '@/components/admin/views/customer-details-view'
import { ReportsView } from '@/components/admin/views/reports-view'
import { UsersView } from '@/components/admin/views/users-view'
import { AuditView } from '@/components/admin/views/audit-view'
import { AppControlView } from '@/components/admin/views/app-control-view'
import { TicketsView } from '@/components/admin/views/tickets-view'
import { TicketDetailsView } from '@/components/admin/views/ticket-details-view'
import { ReviewsView } from '@/components/admin/views/reviews-view'
import { SearchView } from '@/components/admin/views/search-view'

// ---------- بنية القائمة ----------
type NavItem = { view: string; label: string; icon: ComponentType<{ className?: string }>; perm?: Permission; params?: Record<string, string> }
type NavGroup = { title: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'الرئيسية',
    items: [
      { view: 'admin-dashboard', label: 'لوحة المعلومات', icon: LayoutDashboard },
      { view: 'admin-operations', label: 'مركز العمليات', icon: Activity },
    ],
  },
  {
    title: 'التشغيل',
    items: [
      { view: 'admin-orders', label: 'الطلبات', icon: ShoppingCart, perm: 'orders.view' },
      { view: 'admin-payments', label: 'المدفوعات', icon: CreditCard, perm: 'payments.view' },
      { view: 'admin-returns', label: 'المرتجعات', icon: Undo2, perm: 'returns.view' },
      { view: 'admin-refunds', label: 'الاستردادات', icon: HandCoins, perm: 'accounting.view' },
      { view: 'admin-tickets', label: 'تذاكر الدعم', icon: LifeBuoy, perm: 'support.manage' },
    ],
  },
  {
    title: 'المخزون والمشتريات',
    items: [
      { view: 'admin-products', label: 'المنتجات', icon: Package, perm: 'products.update' },
      { view: 'admin-categories', label: 'التصنيفات والماركات', icon: Tags, perm: 'categories.manage' },
      { view: 'admin-inventory', label: 'المخزون', icon: Boxes, perm: 'inventory.view' },
      { view: 'admin-movements', label: 'حركات المخزون', icon: ArrowLeftRight, perm: 'inventory.view' },
      { view: 'admin-warehouses', label: 'المخازن', icon: Warehouse, perm: 'inventory.view' },
      { view: 'admin-purchases', label: 'المشتريات', icon: ClipboardList, perm: 'purchases.view' },
      { view: 'admin-suppliers', label: 'الموردون', icon: Truck, perm: 'purchases.view' },
    ],
  },
  {
    title: 'المالية',
    items: [
      { view: 'admin-banks', label: 'الحسابات البنكية', icon: Landmark, perm: 'accounting.view' },
      { view: 'admin-expenses', label: 'المصروفات', icon: ReceiptText, perm: 'expenses.view' },
      { view: 'admin-reports', label: 'التقارير', icon: BarChart3, perm: 'reports.view' },
    ],
  },
  {
    title: 'التسويق والمحتوى',
    items: [
      { view: 'admin-coupons', label: 'الكوبونات', icon: TicketPercent, perm: 'coupons.manage' },
      { view: 'admin-content', label: 'المحتوى', icon: Newspaper, perm: 'content.manage' },
      { view: 'admin-reviews', label: 'التقييمات', icon: Star, perm: 'content.manage' },
      { view: 'admin-app-control', label: 'الإشعارات', icon: Megaphone, perm: 'notifications.send', params: { tab: 'broadcast' } },
    ],
  },
  {
    title: 'النظام',
    items: [
      { view: 'admin-customers', label: 'العملاء', icon: Users, perm: 'customers.view' },
      { view: 'admin-users', label: 'المستخدمون', icon: UserCog, perm: 'users.manage' },
      { view: 'admin-audit', label: 'سجل التدقيق', icon: ScrollText, perm: 'audit.view' },
      { view: 'admin-app-control', label: 'التحكم بالمتجر', icon: SlidersHorizontal, perm: 'app_settings.manage' },
    ],
  },
]

function isVisible(item: NavItem, role: Role): boolean {
  return !item.perm || hasPermission(role, item.perm)
}

export function AdminShell() {
  const view = useNav((s) => s.view)
  const params = useNav((s) => s.params)
  const go = useNav((s) => s.go)
  const reset = useNav((s) => s.reset)
  const { user, isAdmin, unread } = useSession()
  const { data: config } = useConfig()
  const login = useLogin()
  const { theme, setTheme } = useTheme()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [q, setQ] = useState('')

  if (!user || !isAdmin) {
    return <FullSpinner label="جارِ التحقق من صلاحيات الدخول..." />
  }
  const role = user.role as Role

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const s = q.trim()
    if (s.length > 0) go('admin-search', { q: s })
  }

  const navigate = (item: NavItem) => {
    go(item.view, item.params)
    setMobileOpen(false)
  }

  const logout = async () => {
    await login.logout()
    reset('home')
  }

  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => isVisible(i, role)) })).filter((g) => g.items.length > 0)

  const isActive = (item: NavItem) => {
    if (item.view !== view) return false
    if (item.view === 'admin-app-control') {
      return item.params?.tab === 'broadcast' ? params.tab === 'broadcast' : params.tab !== 'broadcast'
    }
    return true
  }

  const renderView = () => {
    switch (view) {
      case 'admin-dashboard':
        return <DashboardView />
      case 'admin-operations':
        return <OperationsView />
      case 'admin-orders':
        return <OrdersView />
      case 'admin-order-details':
        return <OrderDetailsView id={params.id ?? ''} />
      case 'admin-payments':
        return <PaymentsView />
      case 'admin-payment-details':
        return <PaymentDetailsView id={params.id ?? ''} />
      case 'admin-products':
        return <ProductsView />
      case 'admin-categories':
        return <CategoriesView />
      case 'admin-inventory':
        return <InventoryView />
      case 'admin-movements':
        return <MovementsView />
      case 'admin-warehouses':
        return <WarehousesView />
      case 'admin-purchases':
        return <PurchasesView />
      case 'admin-suppliers':
        return <SuppliersView />
      case 'admin-banks':
        return <BanksView />
      case 'admin-expenses':
        return <ExpensesView />
      case 'admin-returns':
        return <ReturnsView />
      case 'admin-refunds':
        return <RefundsView />
      case 'admin-coupons':
        return <CouponsView />
      case 'admin-content':
        return <ContentView />
      case 'admin-customers':
        return <CustomersView />
      case 'admin-customer-details':
        return <CustomerDetailsView id={params.id ?? ''} />
      case 'admin-reports':
        return <ReportsView />
      case 'admin-users':
        return <UsersView />
      case 'admin-audit':
        return <AuditView />
      case 'admin-app-control':
        return <AppControlView tab={params.tab} />
      case 'admin-tickets':
        return <TicketsView />
      case 'admin-ticket-details':
        return <TicketDetailsView id={params.id ?? ''} />
      case 'admin-reviews':
        return <ReviewsView />
      case 'admin-search':
        return <SearchView q={params.q ?? ''} />
      default:
        return <DashboardView />
    }
  }

  const navContent = (
    <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4" aria-label="قائمة الإدارة">
      {groups.map((g) => (
        <div key={g.title + (g.items[0]?.view ?? '')}>
          <p className="px-2 mb-1 text-[11px] font-bold text-muted-foreground/80 tracking-wide">{g.title}</p>
          <div className="space-y-0.5">
            {g.items.map((item) => {
              const active = isActive(item)
              const Icon = item.icon
              return (
                <button
                  key={item.view + (item.params?.tab ?? '')}
                  onClick={() => navigate(item)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors min-h-[40px] text-start',
                    active
                      ? 'bg-primary/10 text-primary font-semibold border border-primary/25'
                      : 'text-foreground/80 hover:bg-accent border border-transparent'
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )

  const brandBlock = (
    <div className="flex items-center gap-3 border-b p-4">
      <SmartImage src={config?.settings.storeLogoUrl} alt={config?.settings.storeName ?? 'المتجر'} className="size-9 rounded-lg border bg-background" fallbackIcon={false} />
      <div className="min-w-0">
        <p className="font-bold text-sm truncate">{config?.settings.storeName ?? 'لوحة الإدارة'}</p>
        <p className="text-[11px] text-muted-foreground">لوحة التحكم الإدارية</p>
      </div>
    </div>
  )

  const userBlock = (
    <div className="border-t p-3 flex items-center gap-2.5">
      <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">
        {user.name.slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{user.name}</p>
        <p className="text-[11px] text-muted-foreground truncate">{roleLabel(user.role)}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={logout} aria-label="تسجيل الخروج" title="تسجيل الخروج">
        <LogOut className="size-4" />
      </Button>
    </div>
  )

  return (
    <div className="h-screen flex bg-background overflow-hidden" dir="rtl">
      {/* Sidebar يمين — ثابت على الشاشات الكبيرة */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-e bg-card/60">
        {brandBlock}
        {navContent}
        {userBlock}
      </aside>

      {/* المنطقة الرئيسية */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* الشريط العلوي */}
        <header className="h-14 md:h-16 shrink-0 border-b bg-background/80 backdrop-blur flex items-center gap-2 px-3 md:px-5">
          <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="فتح القائمة">
            <Menu className="size-5" />
          </Button>

          {/* البحث الشامل */}
          <form onSubmit={submitSearch} className="flex-1 max-w-md" role="search">
            <div className="relative">
              <Search className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" aria-hidden />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="بحث شامل: طلب / دفعة / عميل / منتج / تتبع..."
                className="ps-3 pe-9 h-10"
                aria-label="بحث شامل"
              />
            </div>
          </form>

          <div className="flex-1" />

          {/* الإشعارات */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative" aria-label="الإشعارات والتنبيهات">
                <Bell className="size-4" />
                {unread > 0 && (
                  <span className="absolute -top-1 -end-1 flex min-w-5 h-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white px-1">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>تنبيهات تحتاج انتباهك</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => go('admin-operations')}>
                <Activity className="size-4" /> مركز العمليات
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => go('admin-payments')}>
                <CreditCard className="size-4" /> طابور المدفوعات
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => go('admin-tickets')}>
                <LifeBuoy className="size-4" /> تذاكر الدعم
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => go('admin-app-control', { tab: 'broadcast' })}>
                <Megaphone className="size-4" /> بث إشعار جديد
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* الوضع الداكن */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
            title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          {/* معاينة المتجر */}
          <Button variant="outline" size="sm" onClick={() => go('store-preview')} className="hidden md:inline-flex gap-1.5">
            <Eye className="size-4" />
            معاينة المتجر
          </Button>

          {/* المستخدم */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 min-h-10 hover:bg-accent transition-colors" aria-label="قائمة المستخدم">
                <div className="hidden sm:block text-start leading-tight">
                  <p className="text-xs font-semibold truncate max-w-28">{user.name}</p>
                  <p className="text-[10px] text-muted-foreground">{roleLabel(user.role)}</p>
                </div>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <p>{user.name}</p>
                <p className="text-xs font-normal text-muted-foreground">{user.phone}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => go('store-preview')}>
                <Eye className="size-4" /> معاينة المتجر
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="text-rose-600 focus:text-rose-600">
                <LogOut className="size-4" /> تسجيل الخروج
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* المحتوى */}
        <main className="flex-1 overflow-y-auto" id="admin-main">
          <motion.div
            key={`${view}:${params.id ?? params.q ?? params.tab ?? ''}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="mx-auto max-w-7xl p-4 md:p-6 space-y-6 pb-16"
          >
            {renderView()}
            <footer className="pt-6 text-center text-[11px] text-muted-foreground/70">
              {config?.settings.storeName ?? 'المتجر'} — لوحة الإدارة
              {config?.version?.latest ? ` · إصدار ${config.version.latest}` : ''}
            </footer>
          </motion.div>
        </main>
      </div>

      {/* قائمة الموبايل */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-72 p-0 flex flex-col">
          <SheetHeader className="p-0 m-0 border-b [&>div]:ps-14">
            <div className="sr-only">
              <SheetTitle>قائمة الإدارة</SheetTitle>
            </div>
            {brandBlock}
          </SheetHeader>
          {navContent}
          {userBlock}
        </SheetContent>
      </Sheet>
    </div>
  )
}
