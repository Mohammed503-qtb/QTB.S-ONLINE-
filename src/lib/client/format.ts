'use client'

import { CURRENCY_SYMBOL, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, SHIPMENT_STATUS_LABELS, RETURN_STATUS_LABELS, REFUND_STATUS_LABELS, TICKET_STATUS_LABELS, ROLE_LABELS, type Role, type OrderStatus, type PaymentStatus, type ShipmentStatus, type ReturnStatus, type RefundStatus, type TicketStatus } from '@/lib/shared/constants'

// ============================================================
// تنسيقات العرض (العملة والتواريخ والتسميات)
// ============================================================

export function money(n: number | null | undefined, symbol = CURRENCY_SYMBOL): string {
  const v = n ?? 0
  return `${v.toLocaleString('en-US')} ${symbol}`
}

export function shortMoney(n: number | null | undefined): string {
  const v = n ?? 0
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1000) return `${Math.round(v / 1000)}K`
  return String(v)
}

export function dateFmt(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function timeFmt(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })
}

export function dateTimeFmt(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return `${dateFmt(d)} · ${timeFmt(d)}`
}

export function timeAgo(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `قبل ${mins} دقيقة`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `قبل ${hours} ساعة`
  const days = Math.floor(hours / 24)
  if (days < 30) return `قبل ${days} يوم`
  return dateFmt(d)
}

// التسميات الآمنة
export const orderStatusLabel = (s: string) => ORDER_STATUS_LABELS[s as OrderStatus] ?? s
export const paymentStatusLabel = (s: string) => PAYMENT_STATUS_LABELS[s as PaymentStatus] ?? s
export const shipmentStatusLabel = (s: string) => SHIPMENT_STATUS_LABELS[s as ShipmentStatus] ?? s
export const returnStatusLabel = (s: string) => RETURN_STATUS_LABELS[s as ReturnStatus] ?? s
export const refundStatusLabel = (s: string) => REFUND_STATUS_LABELS[s as RefundStatus] ?? s
export const ticketStatusLabel = (s: string) => TICKET_STATUS_LABELS[s as TicketStatus] ?? s
export const roleLabel = (s: string) => ROLE_LABELS[s as Role] ?? s

// ألوان الشرائح حسب الحالة (emerald/amber/rose palette)
export function statusColor(status: string): string {
  const green = ['CONFIRMED', 'VERIFIED', 'DELIVERED', 'COMPLETED', 'APPROVED', 'ACTIVE', 'ONLINE', 'PAID', 'RESOLVED']
  const amber = ['PENDING_PAYMENT', 'PAYMENT_REVIEW', 'SUBMITTED', 'UNDER_REVIEW', 'PROCESSING', 'STOCK_RESERVED', 'PICKED', 'PACKED', 'READY_TO_SHIP', 'SHIPPED', 'OUT_FOR_DELIVERY', 'PARTIALLY_PAID', 'REFUND_PENDING', 'REQUESTED', 'OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'PENDING', 'PARTIALLY_PAID']
  const red = ['CANCELLED', 'REJECTED', 'FAILED_DELIVERY', 'FAILED', 'BLOCKED', 'SUSPENDED', 'EXPIRED', 'EMERGENCY_STOP', 'MAINTENANCE']
  const gray = ['ARCHIVED', 'DRAFT', 'UNPAID', 'CLOSED', 'HIDDEN', 'RETURNING', 'RETURNED', 'RETURN_IN_PROGRESS', 'ITEM_SHIPPED_BACK', 'RECEIVED', 'INSPECTED', 'PAYMENT_ISSUE']
  if (green.includes(status)) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
  if (amber.includes(status)) return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
  if (red.includes(status)) return 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
}
