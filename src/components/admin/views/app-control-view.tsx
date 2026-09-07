'use client'

// ============================================================
// التحكم المركزي — feature flags (مفاتيح Switch مع تأكيد للحساسة)
// + إعدادات المتجر + الإصدارات + إحصاءات النظام + بث الإشعارات
// ============================================================

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, Database, Megaphone, Rocket, Save, Send, Settings2, ShieldAlert, SlidersHorizontal, Smartphone, Wrench,
} from 'lucide-react'
import { api } from '@/lib/client/api'
import { dateTimeFmt, timeAgo } from '@/lib/client/format'
import { FEATURE_FLAG_KEYS } from '@/lib/shared/constants'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, StatCard, BROADCAST_TARGET_LABELS, UploadField, useApiMutation, usePerm, InlineWarning, MiniEmpty } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import { ConfirmDialog } from '@/components/admin/components/confirm-dialog'
import type { AppControlResponse, MaintenanceRow, VersionRow } from '@/components/admin/types'

const SENSITIVE_FLAGS = ['maintenance_mode', 'emergency_stop', 'force_update']

const SETTING_FIELDS: { key: string; label: string; type: 'text' | 'number' | 'image'; placeholder?: string }[] = [
  { key: 'store_name', label: 'اسم المتجر', type: 'text', placeholder: 'متجر الأصيل' },
  { key: 'store_tagline', label: 'الشعار النصي', type: 'text', placeholder: 'تسوق بثقة' },
  { key: 'store_logo_url', label: 'شعار المتجر', type: 'image' },
  { key: 'whatsapp_number', label: 'رقم واتساب (مع رمز الدولة)', type: 'text', placeholder: '9677xxxxxxxx' },
  { key: 'support_phone', label: 'هاتف الدعم', type: 'text' },
  { key: 'store_hours', label: 'ساعات العمل', type: 'text', placeholder: 'السبت-الخميس 8ص-10م' },
  { key: 'store_address', label: 'عنوان المتجر', type: 'text' },
  { key: 'maintenance_message', label: 'رسالة الصيانة الظاهرة للعملاء', type: 'text' },
  { key: 'currency_symbol', label: 'رمز العملة', type: 'text' },
  { key: 'min_order_total', label: 'الحد الأدنى للطلب', type: 'number' },
  { key: 'return_window_days', label: 'نافذة الإرجاع (أيام)', type: 'number' },
  { key: 'payment_expiry_hours', label: 'صلاحية الدفع (ساعات)', type: 'number' },
]

export function AppControlView({ tab }: { tab?: string }) {
  const { can, role } = usePerm()

  const query = useQuery({
    queryKey: ['admin-app-control'],
    queryFn: () => api.get<AppControlResponse>('/api/admin/app-control'),
  })

  const [activeTab, setActiveTab] = useState(tab === 'broadcast' ? 'broadcast' : 'flags')

  // flags
  const [pendingFlag, setPendingFlag] = useState<{ key: string; label: string; value: boolean } | null>(null)

  // settings
  const [settingsDraft, setSettingsDraft] = useState<Record<string, string>>({})
  const settingsMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of query.data?.settings ?? []) map[s.key] = s.value
    return map
  }, [query.data?.settings])

  // versions
  const [versionForm, setVersionForm] = useState<{ versionName: string; buildNumber: string; minimumSupported: boolean; isLatest: boolean; releaseNotes: string; mandatory: boolean } | null>(null)
  const [versionError, setVersionError] = useState('')

  // maintenance
  const [maintenanceForm, setMaintenanceForm] = useState<{ message: string; endsAt: string } | null>(null)
  const [maintenanceError, setMaintenanceError] = useState('')

  // broadcast
  const [broadcast, setBroadcast] = useState<{ title: string; body: string; target: string }>({ title: '', body: '', target: 'CUSTOMERS' })
  const [broadcastError, setBroadcastError] = useState('')

  const setFlag = useApiMutation<{ key: string; value: boolean; reason?: string }, unknown>(
    (vars) => api.post('/api/admin/app-control', { action: 'set_flag', key: vars.key, value: vars.value, reason: vars.reason }),
    {
      success: (res, vars) => `تم ${vars.value ? 'تفعيل' : 'تعطيل'} «${vars.key}»`,
      invalidate: [['admin-app-control'], ['config'], ['admin-dashboard']],
      onDone: () => setPendingFlag(null),
    }
  )

  const setSetting = useApiMutation<{ key: string; value: string }, unknown>(
    (vars) => api.post('/api/admin/app-control', { action: 'set_setting', key: vars.key, value: vars.value }),
    {
      success: 'تم حفظ الإعدادات المعدلة',
      invalidate: [['admin-app-control'], ['config']],
      onDone: () => setSettingsDraft({}),
    }
  )

  const setVersion = useApiMutation<Record<string, unknown>, unknown>(
    (body) => api.post('/api/admin/app-control', { action: 'set_version', ...body }),
    {
      success: 'سُجل الإصدار الجديد',
      invalidate: [['admin-app-control'], ['config']],
      onDone: () => setVersionForm(null),
    }
  )

  const enableMaintenance = useApiMutation<Record<string, unknown>, unknown>(
    (body) => api.post('/api/admin/app-control', { action: 'maintenance', ...body }),
    {
      success: 'فُعّل وضع الصيانة على المتجر',
      invalidate: [['admin-app-control'], ['config']],
      onDone: () => setMaintenanceForm(null),
    }
  )

  const sendBroadcast = useApiMutation<Record<string, unknown>, { sent: number }>(
    (body) => api.post('/api/admin/notifications', body),
    {
      success: (res) => `تم إرسال الإشعار إلى ${res.sent} مستخدم`,
      invalidate: [],
      onDone: () => setBroadcast({ title: '', body: '', target: broadcast.target }),
    }
  )

  const data = query.data
  const flagsMap = useMemo(() => {
    const m: Record<string, boolean> = {}
    for (const f of data?.flags ?? []) m[f.key] = f.value
    return m
  }, [data?.flags])

  const canManage = can('app_settings.manage')
  const isSuperAdmin = role === 'SUPER_ADMIN'
  const canBroadcast = can('notifications.send')

  const changedSettings = SETTING_FIELDS.filter((f) => settingsDraft[f.key] !== undefined && settingsDraft[f.key] !== settingsMap[f.key])
  const knownKeys = new Set(SETTING_FIELDS.map((f) => f.key))
  const otherSettings = (data?.settings ?? []).filter((s) => !knownKeys.has(s.key))

  const toggleFlag = (key: string, label: string, value: boolean) => {
    if (SENSITIVE_FLAGS.includes(key)) {
      setPendingFlag({ key, label, value })
      return
    }
    setFlag.mutate({ key, value })
  }

  const saveSettings = async () => {
    if (changedSettings.length === 0) return
    for (const f of changedSettings) {
      await setSetting.mutateAsync({ key: f.key, value: settingsDraft[f.key] })
    }
  }

  const submitVersion = async () => {
    if (!versionForm) return
    setVersionError('')
    if (versionForm.versionName.trim().length < 1) return setVersionError('اسم الإصدار مطلوب')
    const build = Number(versionForm.buildNumber)
    if (!Number.isFinite(build) || build < 1) return setVersionError('رقم البناء رقم صحيح 1+')
    await setVersion.mutateAsync({
      versionName: versionForm.versionName.trim(),
      buildNumber: build,
      minimumSupported: versionForm.minimumSupported,
      isLatest: versionForm.isLatest,
      releaseNotes: versionForm.releaseNotes.trim(),
      mandatory: versionForm.mandatory,
    })
  }

  const submitMaintenance = async () => {
    if (!maintenanceForm) return
    setMaintenanceError('')
    if (maintenanceForm.message.trim().length < 2) return setMaintenanceError('رسالة الصيانة مطلوبة')
    await enableMaintenance.mutateAsync({
      message: maintenanceForm.message.trim(),
      endsAt: maintenanceForm.endsAt || null,
    })
  }

  const submitBroadcast = async () => {
    setBroadcastError('')
    if (broadcast.title.trim().length < 2) return setBroadcastError('العنوان مطلوب')
    if (broadcast.body.trim().length < 2) return setBroadcastError('النص مطلوب')
    await sendBroadcast.mutateAsync({
      title: broadcast.title.trim(),
      body: broadcast.body.trim(),
      target: broadcast.target,
    })
  }

  const versionColumns: Column<VersionRow>[] = [
    {
      key: 'version',
      header: 'الإصدار',
      cell: (v) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold flex items-center gap-1.5" dir="ltr">
            {v.versionName}
            {v.isLatest && <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-px text-[10px] font-bold">الأحدث</span>}
            {v.mandatory && <span className="rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 px-1.5 py-px text-[10px] font-bold">إجباري</span>}
          </p>
          <p className="text-[11px] text-muted-foreground" dir="ltr">build {v.buildNumber} · {v.platform}</p>
        </div>
      ),
    },
    {
      key: 'minimum',
      header: 'الحد الأدنى',
      cell: (v) => <span className={`text-xs font-semibold ${v.minimumSupported ? 'text-amber-600' : 'text-muted-foreground'}`}>{v.minimumSupported ? 'إصدار أدنى مدعوم' : '—'}</span>,
    },
    {
      key: 'notes',
      header: 'ملاحظات الإصدار',
      cell: (v) => <span className="text-xs text-muted-foreground truncate block max-w-52">{v.releaseNotes || '—'}</span>,
    },
    {
      key: 'date',
      header: 'التاريخ',
      cell: (v) => <span className="text-xs text-muted-foreground whitespace-nowrap">{dateTimeFmt(v.createdAt)}</span>,
    },
  ]

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="التحكم بالمتجر" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
      </div>
    )
  }
  if (query.error || !data) {
    return (
      <div className="space-y-4">
        <PageHeader title="التحكم بالمتجر" />
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">تعذر تحميل بيانات التحكم: {query.error?.message}</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader title="التحكم بالمتجر" description="مفاتيح الميزات والإعدادات والإصدارات والبث — Remote Config مركزي" />

      {/* إحصاءات النظام */}
      <section aria-label="إحصاءات النظام">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          <StatCard title="المستخدمون" value={data.stats.users} icon={<Settings2 className="size-5" />} />
          <StatCard title="الطلبات" value={data.stats.orders} icon={<Database className="size-5" />} />
          <StatCard title="المنتجات" value={data.stats.products} icon={<Database className="size-5" />} />
          <StatCard title="المدفوعات" value={data.stats.payments} icon={<Database className="size-5" />} />
          <StatCard title="حركات المخزون" value={data.stats.movements} icon={<Database className="size-5" />} />
          <StatCard title="سجلات التدقيق" value={data.stats.auditLogs} icon={<Database className="size-5" />} />
          <StatCard title="الإشعارات" value={data.stats.notifications} icon={<Megaphone className="size-5" />} />
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="flags" className="gap-1.5 flex-1"><SlidersHorizontal className="size-4" /> المفاتيح</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 flex-1"><Settings2 className="size-4" /> إعدادات المتجر</TabsTrigger>
          <TabsTrigger value="versions" className="gap-1.5 flex-1"><Rocket className="size-4" /> الإصدارات</TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-1.5 flex-1"><Wrench className="size-4" /> الصيانة</TabsTrigger>
          <TabsTrigger value="broadcast" className="gap-1.5 flex-1"><Megaphone className="size-4" /> بث الإشعارات</TabsTrigger>
        </TabsList>

        {/* المفاتيح */}
        <TabsContent value="flags" className="mt-3 space-y-4">
          {flagsMap.emergency_stop && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-400 bg-rose-50 dark:bg-rose-950/50 p-3 text-sm text-rose-800 dark:text-rose-300">
              <ShieldAlert className="size-4 shrink-0" />
              <span>الإيقاف الطارئ مفعّل — المتجر موقوف أمام العملاء الآن!</span>
            </div>
          )}
          {flagsMap.maintenance_mode && (
            <InlineWarning>وضع الصيانة مفعّل — العملاء يرون رسالة الصيانة، والإدارة تعمل بشكل طبيعي.</InlineWarning>
          )}
          <Card>
            <CardContent className="space-y-1">
              {FEATURE_FLAG_KEYS.map((f) => {
                const sensitive = SENSITIVE_FLAGS.includes(f.key)
                const current = flagsMap[f.key] ?? false
                const flagRow = (data.flags ?? []).find((x) => x.key === f.key)
                const disabled = !canManage || (sensitive && !isSuperAdmin) || setFlag.isPending
                return (
                  <div key={f.key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        {f.label}
                        {sensitive && <AlertTriangle className="size-3.5 text-amber-600" />}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate" dir="ltr">
                        {f.key}
                        {flagRow?.updatedAt ? ` · ${timeAgo(flagRow.updatedAt)}` : ''}
                      </p>
                      {sensitive && !isSuperAdmin && (
                        <p className="text-[11px] text-amber-600">هذا المفتاح لمدير النظام فقط</p>
                      )}
                    </div>
                    <Switch
                      checked={current}
                      disabled={disabled}
                      onCheckedChange={(v) => toggleFlag(f.key, f.label, v)}
                      aria-label={f.label}
                      className={sensitive && current ? 'data-[state=checked]:bg-rose-600' : ''}
                    />
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* الإعدادات */}
        <TabsContent value="settings" className="mt-3 space-y-4">
          <Card>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {SETTING_FIELDS.map((f) => {
                  const value = settingsDraft[f.key] !== undefined ? settingsDraft[f.key] : (settingsMap[f.key] ?? '')
                  return f.type === 'image' ? (
                    <div key={f.key} className="sm:col-span-2">
                      <UploadField label={f.label} value={value} onChange={(url) => setSettingsDraft({ ...settingsDraft, [f.key]: url })} folder="brand" pending={setSetting.isPending} />
                    </div>
                  ) : (
                    <div key={f.key} className="space-y-2">
                      <Label htmlFor={`st-${f.key}`}>{f.label}</Label>
                      <Input
                        id={`st-${f.key}`}
                        type={f.type === 'number' ? 'number' : 'text'}
                        inputMode={f.type === 'number' ? 'numeric' : undefined}
                        value={value}
                        disabled={!canManage}
                        onChange={(e) => setSettingsDraft({ ...settingsDraft, [f.key]: e.target.value })}
                        placeholder={f.placeholder}
                      />
                    </div>
                  )
                })}
              </div>

              {otherSettings.length > 0 && (
                <div className="space-y-1.5 border-t pt-3">
                  <p className="text-xs font-semibold text-muted-foreground">إعدادات أخرى (متقدمة — raw)</p>
                  {otherSettings.map((s) => (
                    <div key={s.key} className="flex items-center justify-between text-xs">
                      <span dir="ltr" className="text-muted-foreground">{s.key}</span>
                      <span dir="ltr">{s.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {canManage && (
                <div className="flex items-center justify-between border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    {changedSettings.length > 0 ? `${changedSettings.length} إعداد معدل — لم يُحفظ بعد` : 'لا تغييرات معلقة'}
                  </p>
                  <Button className="gap-1.5" onClick={saveSettings} disabled={setSetting.isPending || changedSettings.length === 0}>
                    <Save className="size-4" /> حفظ التعديلات
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* الإصدارات */}
        <TabsContent value="versions" className="mt-3 space-y-3">
          {canManage && (
            <Button className="gap-1.5" onClick={() => { setVersionError(''); setVersionForm({ versionName: '', buildNumber: '', minimumSupported: false, isLatest: true, releaseNotes: '', mandatory: false }) }}>
              <Rocket className="size-4" /> تسجيل إصدار
            </Button>
          )}
          <Card>
            <CardContent>
              <DataTable columns={versionColumns} rows={data.versions} emptyIcon="🚀" emptyTitle="لا توجد إصدارات مسجلة" compact />
            </CardContent>
          </Card>
        </TabsContent>

        {/* الصيانة */}
        <TabsContent value="maintenance" className="mt-3 space-y-4">
          {flagsMap.maintenance_mode ? (
            <InlineWarning>وضع الصيانة مفعّل حاليًا. أوقفه من تبويب «المفاتيح» لإعادة تشغيل المتجر للعملاء.</InlineWarning>
          ) : (
            <p className="text-sm text-muted-foreground">المتجر يعمل بشكل طبيعي — لا صيانة مفعّلة.</p>
          )}
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-2 border-b pb-3">
                <h2 className="font-bold text-sm md:text-base flex items-center gap-2">
                  <Wrench className="size-4 text-primary" /> نِوافذ الصيانة السابقة
                </h2>
                {canManage && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setMaintenanceError(''); setMaintenanceForm({ message: settingsMap.maintenance_message ?? 'المتجر تحت الصيانة، نعود قريبًا إن شاء الله', endsAt: '' }) }}>
                    <Wrench className="size-4" /> تشغيل صيانة الآن
                  </Button>
                )}
              </div>
              {data.maintenance.length === 0 && <MiniEmpty title="لا توجد نوافذ صيانة مسجلة" icon="🔧" />}
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {data.maintenance.map((m: MaintenanceRow) => (
                  <div key={m.id} className="rounded-lg border p-3 space-y-1">
                    <p className="text-sm">{m.message}</p>
                    <p className="text-xs text-muted-foreground">
                      بدأت {dateTimeFmt(m.startsAt)}
                      {m.endsAt ? ` · حتى ${dateTimeFmt(m.endsAt)}` : ' · بلا نهاية محددة'}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* البث */}
        <TabsContent value="broadcast" className="mt-3">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-3">
                <Megaphone className="size-4 text-primary" />
                <h2 className="font-bold text-sm md:text-base">بث إشعار عام</h2>
              </div>
              {!canBroadcast && <p className="text-sm text-muted-foreground">لا تملك صلاحية بث الإشعارات.</p>}
              {canBroadcast && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bc-title">العنوان *</Label>
                    <Input id="bc-title" value={broadcast.title} onChange={(e) => setBroadcast({ ...broadcast, title: e.target.value })} placeholder="مثال: عروض نهاية الأسبوع" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bc-body">النص *</Label>
                    <Textarea id="bc-body" value={broadcast.body} onChange={(e) => setBroadcast({ ...broadcast, body: e.target.value })} rows={3} placeholder="نص الإشعار الذي سيصل للمستلمين..." />
                  </div>
                  <div className="space-y-2">
                    <Label>الفئة المستهدفة *</Label>
                    <Select value={broadcast.target} onValueChange={(v) => setBroadcast({ ...broadcast, target: v })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(BROADCAST_TARGET_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {broadcastError && <p className="text-sm text-rose-600 dark:text-rose-400">{broadcastError}</p>}
                  <Button className="gap-1.5" onClick={submitBroadcast} disabled={sendBroadcast.isPending}>
                    <Send className="size-4" /> إرسال الإشعار
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* تأكيد المفاتيح الحساسة */}
      <ConfirmDialog
        open={pendingFlag !== null}
        onOpenChange={(v) => { if (!v) setPendingFlag(null) }}
        title={`${pendingFlag?.value ? 'تفعيل' : 'تعطيل'}: ${pendingFlag?.label ?? ''}`}
        description={
          pendingFlag?.key === 'emergency_stop'
            ? 'تحذير: الإيقاف الطارئ يوقف المتجر بالكامل أمام العملاء فورًا. الإدارة تبقى تعمل.'
            : pendingFlag?.key === 'maintenance_mode'
              ? 'سيرى العملاء رسالة الصيانة ولن يمكنهم التسوق. الإدارة تبقى تعمل.'
              : 'التحديث الإجباري سيطالب كل العملاء بتحديث التطبيق/الصفحة.'
        }
        confirmLabel={pendingFlag?.value ? 'تفعيل' : 'تعطيل'}
        danger={pendingFlag?.value === true}
        noteField
        noteLabel="سبب التغيير (يُسجل في التدقيق)"
        onConfirm={async ({ note }) => {
          if (!pendingFlag) return
          await setFlag.mutateAsync({ key: pendingFlag.key, value: pendingFlag.value, reason: note || undefined })
        }}
      />

      {/* تسجيل إصدار */}
      <Dialog open={versionForm !== null} onOpenChange={(v) => { if (!setVersion.isPending && !v) setVersionForm(null) }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="size-5 text-primary" />
              تسجيل إصدار جديد
            </DialogTitle>
            <DialogDescription>للتحكم في الحد الأدنى المدعوم والتحديث الإجباري.</DialogDescription>
          </DialogHeader>
          {versionForm && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ver-name">اسم الإصدار *</Label>
                  <Input id="ver-name" value={versionForm.versionName} onChange={(e) => setVersionForm({ ...versionForm, versionName: e.target.value })} placeholder="1.2.0" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ver-build">رقم البناء *</Label>
                  <Input id="ver-build" type="number" min={1} value={versionForm.buildNumber} onChange={(e) => setVersionForm({ ...versionForm, buildNumber: e.target.value })} dir="ltr" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ver-notes">ملاحظات الإصدار</Label>
                <Textarea id="ver-notes" value={versionForm.releaseNotes} onChange={(e) => setVersionForm({ ...versionForm, releaseNotes: e.target.value })} rows={3} placeholder="ما الجديد..." />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center gap-2 border rounded-lg px-2.5 h-11">
                  <Switch id="ver-min" checked={versionForm.minimumSupported} onCheckedChange={(v) => setVersionForm({ ...versionForm, minimumSupported: v })} />
                  <Label htmlFor="ver-min" className="text-xs cursor-pointer">حد أدنى</Label>
                </div>
                <div className="flex items-center gap-2 border rounded-lg px-2.5 h-11">
                  <Switch id="ver-latest" checked={versionForm.isLatest} onCheckedChange={(v) => setVersionForm({ ...versionForm, isLatest: v })} />
                  <Label htmlFor="ver-latest" className="text-xs cursor-pointer">الأحدث</Label>
                </div>
                <div className="flex items-center gap-2 border rounded-lg px-2.5 h-11">
                  <Switch id="ver-mand" checked={versionForm.mandatory} onCheckedChange={(v) => setVersionForm({ ...versionForm, mandatory: v })} />
                  <Label htmlFor="ver-mand" className="text-xs cursor-pointer">إجباري</Label>
                </div>
              </div>
              {versionError && <p className="text-sm text-rose-600 dark:text-rose-400">{versionError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVersionForm(null)} disabled={setVersion.isPending}>إلغاء</Button>
            <Button onClick={submitVersion} disabled={setVersion.isPending}>تسجيل الإصدار</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تشغيل صيانة */}
      <Dialog open={maintenanceForm !== null} onOpenChange={(v) => { if (!enableMaintenance.isPending && !v) setMaintenanceForm(null) }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="size-5 text-amber-600" />
              تشغيل وضع الصيانة
            </DialogTitle>
            <DialogDescription>سيتوقف المتجر أمام العملاء فورًا (وتبقى الإدارة تعمل).</DialogDescription>
          </DialogHeader>
          {maintenanceForm && (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label htmlFor="mt-msg">رسالة الصيانة *</Label>
                <Textarea id="mt-msg" value={maintenanceForm.message} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, message: e.target.value })} rows={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mt-end">تنتهي في (اختياري)</Label>
                <Input id="mt-end" type="datetime-local" value={maintenanceForm.endsAt} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, endsAt: e.target.value })} />
              </div>
              {maintenanceError && <p className="text-sm text-rose-600 dark:text-rose-400">{maintenanceError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintenanceForm(null)} disabled={enableMaintenance.isPending}>إلغاء</Button>
            <Button variant="destructive" onClick={submitMaintenance} disabled={enableMaintenance.isPending}>تفعيل الصيانة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
