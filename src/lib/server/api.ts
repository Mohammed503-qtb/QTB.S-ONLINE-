import { NextResponse } from 'next/server'
import { ZodError, ZodType } from 'zod'
import { ERROR_CODES, type ErrorCode } from '@/lib/shared/constants'

// ---------- شكل الاستجابة الموحد ----------
// { ok: true, data } أو { ok: false, error: { code, message } }

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init)
}

export function fail(code: ErrorCode, message?: string, status = 400) {
  return NextResponse.json(
    { ok: false, error: { code, message: message ?? ERROR_CODES[code] ?? 'خطأ' } },
    { status }
  )
}

export class ApiError extends Error {
  code: ErrorCode
  status: number
  constructor(code: ErrorCode, message?: string, status = 400) {
    super(message ?? ERROR_CODES[code] ?? 'خطأ')
    this.code = code
    this.status = status
  }
}

// ---------- معالجة أخطاء موحدة لكل الـ routes ----------
export function handleRouteError(e: unknown) {
  if (e instanceof ApiError) return fail(e.code, e.message, e.status)
  if (e instanceof ZodError) {
    const first = e.issues[0]
    return fail('VALIDATION_ERROR', first ? `${first.path.join('.')}: ${first.message}` : 'بيانات غير صحيحة')
  }
  console.error('[API ERROR]', e)
  return fail('SERVER_ERROR', 'حدث خطأ غير متوقع في الخادم', 500)
}

// ---------- تحليل الجسم مع Zod ----------
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    throw new ApiError('VALIDATION_ERROR', 'جسم الطلب غير صالح')
  }
  const result = schema.safeParse(json)
  if (!result.success) {
    throw new ApiError('VALIDATION_ERROR', result.error.issues[0]?.message ?? 'بيانات غير صحيحة')
  }
  return result.data
}

export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const url = new URL(req.url)
  const obj: Record<string, string> = {}
  url.searchParams.forEach((v, k) => { obj[k] = v })
  const result = schema.safeParse(obj)
  if (!result.success) {
    throw new ApiError('VALIDATION_ERROR', result.error.issues[0]?.message ?? 'معاملات غير صحيحة')
  }
  return result.data
}
