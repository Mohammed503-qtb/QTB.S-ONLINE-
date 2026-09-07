'use client'

// ============================================================
// جدول موحد للإدارة: أعمدة + صفوف + تحميل skeleton + فراغ + خطأ
// ============================================================

import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState, ErrorState } from '@/components/app/spinner'
import { cn } from '@/lib/utils'

export type Column<T> = {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  className?: string
  thClassName?: string
}

// نتجاهل نقر الصف إذا كان النقر على عنصر تفاعلي داخله (زر/رابط/حقل)
function isInteractiveClick(e: React.MouseEvent): boolean {
  const target = e.target as HTMLElement | null
  if (!target) return false
  return !!target.closest('button, a, input, select, textarea, label, [role="menuitem"], [role="switch"], [data-no-row-click]')
}

export function DataTable<T>({
  columns,
  rows,
  loading,
  error,
  onRetry,
  emptyIcon = '📭',
  emptyTitle = 'لا توجد بيانات',
  emptySubtitle,
  onRowClick,
  skeletonRows = 6,
  footer,
  compact,
}: {
  columns: Column<T>[]
  rows: T[] | undefined
  loading?: boolean
  error?: Error | null
  onRetry?: () => void
  emptyIcon?: string
  emptyTitle?: string
  emptySubtitle?: string
  onRowClick?: (row: T) => void
  skeletonRows?: number
  footer?: ReactNode
  compact?: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-2 py-1">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            {columns.map((c) => (
              <Skeleton key={c.key} className={cn('h-10 flex-1 min-w-16', compact && 'h-8')} />
            ))}
          </div>
        ))}
      </div>
    )
  }
  if (error) {
    return <ErrorState message={error.message} retry={onRetry} />
  }
  if (!rows || rows.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} subtitle={emptySubtitle} />
  }
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => (
              <TableHead key={c.key} className={cn('text-start text-xs text-muted-foreground', compact && 'h-8', c.thClassName)}>
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => {
            const clickable = !!onRowClick
            return (
              <TableRow
                key={idx}
                className={cn(clickable && 'cursor-pointer')}
                onClick={clickable ? (e) => { if (!isInteractiveClick(e)) onRowClick?.(row) } : undefined}
              >
                {columns.map((c) => (
                  <TableCell key={c.key} className={cn(compact ? 'py-1.5' : 'py-2.5', c.className)}>
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {footer}
    </div>
  )
}
