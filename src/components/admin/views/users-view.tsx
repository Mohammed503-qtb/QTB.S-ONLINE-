'use client'

// ============================================================
// المستخدمون — جدول + إنشاء (هاتف/اسم/دور) + تعديل (دور/حالة)
// + إلغاء الجلسات (مع حماية الذات)
// ============================================================

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, Pencil, Plus, ShieldAlert, UserCog } from 'lucide-react'
import { api } from '@/lib/client/api'
import { roleLabel, timeAgo, dateTimeFmt } from '@/lib/client/format'
import { ROLES, ROLE_LABELS } from '@/lib/shared/constants'
import { useSession } from '@/lib/client/session'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, SearchInput, StatusBadge, StatusTabs, USER_STATUS_LABELS, useApiMutation, useDebounced, usePerm } from '@/components/admin/components/kit'
import { DataTable, type Column } from '@/components/admin/components/data-table'
import { ConfirmDialog } from '@/components/admin/components/confirm-dialog'
import type { AdminUserRow } from '@/components/admin/types'

type EditForm = { id: string; name: string; role: string; status: string }

export function UsersView() {
  const qc = useQueryClient()
  const { can } = usePerm()
  const { user: me } = useSession()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search, 300)
  const [role, setRole] = useState('')

  const [createForm, setCreateForm] = useState<{ phone: string; name: string; role: string } | null>(null)
  const [createError, setCreateError] = useState('')
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [editError, setEditError] = useState('')
  const [revokeTarget, setRevokeTarget] = useState<AdminUserRow | null>(null)

  const query = useQuery({
    queryKey: ['admin-users', { search: debouncedSearch, role }],
    queryFn: () => {
      const sp = new URLSearchParams()
      if (debouncedSearch.trim()) sp.set('search', debouncedSearch.trim())
      if (role) sp.set('role', role)
      return api.get<AdminUserRow[]>(`/api/admin/users?${sp.toString()}`)
    },
  })

  const createMutation = useApiMutation<{ phone: string; name: string; role: string }, unknown>(
    (f) => api.post('/api/admin/users', f),
    {
      success: 'تم إنشاء المستخدم (يمكنه الدخول بـ OTP على رقمه)',
      invalidate: [['admin-users']],
      onDone: () => setCreateForm(null),
    }
  )

  const editMutation = useApiMutation<EditForm, unknown>(
    (f) => api.put('/api/admin/users', { id: f.id, name: f.name, role: f.role, status: f.status }),
    {
      success: 'تم تحديث المستخدم',
      invalidate: [['admin-users'], ['me']],
      onDone: () => setEditForm(null),
    }
  )

  const revokeMutation = useApiMutation<string, unknown>(
    (id) => api.del(`/api/admin/users?id=${id}`),
    {
      success: 'أُلغيت كل جلسات المستخدم النشطة',
      invalidate: [['admin-users']],
      onDone: () => setRevokeTarget(null),
    }
  )

  const submitCreate = async () => {
    if (!createForm) return
    setCreateError('')
    if (!/^7\d{8}$/.test(createForm.phone.trim())) return setCreateError('رقم الهاتف يجب أن يكون 9 خانات تبدأ بـ 7')
    if (createForm.name.trim().length < 2) return setCreateError('الاسم مطلوب')
    await createMutation.mutateAsync({ phone: createForm.phone.trim(), name: createForm.name.trim(), role: createForm.role })
  }

  const submitEdit = async () => {
    if (!editForm) return
    setEditError('')
    if (editForm.name.trim().length < 2) return setEditError('الاسم مطلوب')
    await editMutation.mutateAsync({ ...editForm, name: editForm.name.trim() })
  }

  const columns: Column<AdminUserRow>[] = [
    {
      key: 'user',
      header: 'المستخدم',
      cell: (u) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate max-w-40">
            {u.name}
            {me?.id === u.id && <span className="ms-1.5 rounded-full bg-primary/10 text-primary px-1.5 py-px text-[10px] font-bold">أنت</span>}
          </p>
          <p className="text-[11px] text-muted-foreground" dir="ltr">{u.phone}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'الدور',
      cell: (u) => <span className="text-sm">{roleLabel(u.role)}</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      cell: (u) => <StatusBadge status={u.status} label={USER_STATUS_LABELS[u.status] ?? u.status} />,
    },
    {
      key: 'sessions',
      header: 'الجلسات النشطة',
      cell: (u) => (
        <div className="text-xs">
          <p className="tabular-nums">{u.sessions?.length ?? 0} جلسة</p>
          {u.sessions?.[0] && <p className="text-muted-foreground">آخر نشاط: {timeAgo(u.sessions[0].lastActiveAt)}</p>}
        </div>
      ),
    },
    {
      key: 'login',
      header: 'آخر دخول',
      cell: (u) => <span className="text-xs text-muted-foreground">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'لم يسجل'}</span>,
    },
    {
      key: 'actions',
      header: 'إجراءات',
      cell: (u) => {
        const isSelf = me?.id === u.id
        return (
          <div className="flex items-center gap-1" data-no-row-click>
            {can('users.manage') && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`تحرير ${u.name}`}
                onClick={() => { setEditError(''); setEditForm({ id: u.id, name: u.name, role: u.role, status: u.status }) }}
              >
                <Pencil className="size-4" />
              </Button>
            )}
            {can('users.manage') && !isSelf && (
              <Button variant="ghost" size="icon" onClick={() => setRevokeTarget(u)} aria-label={`إلغاء جلسات ${u.name}`}>
                <LogOut className="size-4 text-rose-600" />
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  const roleTabs = [
    { value: '', label: 'كل الأدوار' },
    ...ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="المستخدمون"
        description={query.data ? `${query.data.length} مستخدم` : 'إدارة الأدوار والصلاحيات والجلسات'}
        actions={
          can('users.manage') ? (
            <Button className="gap-1.5" onClick={() => { setCreateError(''); setCreateForm({ phone: '', name: '', role: 'CUSTOMER' }) }}>
              <Plus className="size-4" /> مستخدم جديد
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="space-y-3">
          <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو الهاتف..." className="sm:max-w-sm" />
          <StatusTabs value={role} onChange={setRole} options={roleTabs} />
          <DataTable
            columns={columns}
            rows={query.data}
            loading={query.isLoading}
            error={query.error}
            onRetry={() => void qc.invalidateQueries({ queryKey: ['admin-users'] })}
            emptyIcon="👤"
            emptyTitle="لا يوجد مستخدمون مطابقون"
            compact
          />
        </CardContent>
      </Card>

      {/* إنشاء مستخدم */}
      <Dialog open={createForm !== null} onOpenChange={(v) => { if (!createMutation.isPending && !v) setCreateForm(null) }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="size-5 text-primary" />
              مستخدم جديد
            </DialogTitle>
            <DialogDescription>يدخل المستخدم بـ OTP على رقمه، والصلاحيات تُفرض من الدور في الخادم.</DialogDescription>
          </DialogHeader>
          {createForm && (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label htmlFor="us-phone">الهاتف *</Label>
                <Input id="us-phone" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="7xxxxxxxx" dir="ltr" inputMode="numeric" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="us-name">الاسم *</Label>
                <Input id="us-name" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="مثال: سامي العمودي" />
              </div>
              <div className="space-y-2">
                <Label>الدور *</Label>
                <Select value={createForm.role} onValueChange={(v) => setCreateForm({ ...createForm, role: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {createError && <p className="text-sm text-rose-600 dark:text-rose-400">{createError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateForm(null)} disabled={createMutation.isPending}>إلغاء</Button>
            <Button onClick={submitCreate} disabled={createMutation.isPending}>إنشاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تحرير */}
      <Dialog open={editForm !== null} onOpenChange={(v) => { if (!editMutation.isPending && !v) setEditForm(null) }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تحرير: {editForm?.name}</DialogTitle>
            <DialogDescription>
              تغيير الحالة لغير «نشط» يلغي جلساته فورًا. لا يمكن تخفيض دور آخر مدير نظام نشط.
            </DialogDescription>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label htmlFor="ue-name">الاسم *</Label>
                <Input id="ue-name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>الدور</Label>
                  <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })} disabled={me?.id === editForm.id}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الحالة</Label>
                  <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })} disabled={me?.id === editForm.id}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(USER_STATUS_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {me?.id === editForm.id && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-300">
                  <ShieldAlert className="size-4 shrink-0" />
                  حماية ذاتية: لا يمكنك تغيير دورك أو حالتك من هنا.
                </div>
              )}
              {editError && <p className="text-sm text-rose-600 dark:text-rose-400">{editError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditForm(null)} disabled={editMutation.isPending}>إلغاء</Button>
            <Button onClick={submitEdit} disabled={editMutation.isPending}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* إلغاء الجلسات */}
      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(v) => { if (!v) setRevokeTarget(null) }}
        title={`إلغاء جلسات ${revokeTarget?.name ?? ''}`}
        description={`سيُخرج المستخدم من كل الأجهزة فورًا. آخر نشاط: ${revokeTarget?.lastLoginAt ? dateTimeFmt(revokeTarget.lastLoginAt) : 'غير معروف'}`}
        confirmLabel="إلغاء الجلسات"
        danger
        onConfirm={async () => {
          if (!revokeTarget) return
          await revokeMutation.mutateAsync(revokeTarget.id)
        }}
      />
    </div>
  )
}
