'use client'

// ============================================================
// عميل API موحد — كل الطلبات نسبية عبر نفس الأصل
// الاستجابة: { ok, data } أو { ok, error: { code, message } }
// ============================================================

export class ApiClientError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function request<T = unknown>(method: string, url: string, body?: unknown, isForm = false): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: isForm ? (body as FormData) : body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    })
  } catch {
    throw new ApiClientError('NETWORK_ERROR', 'تعذر الاتصال بالخادم — تحقق من اتصالك', 0)
  }

  let json: { ok?: boolean; data?: T; error?: { code: string; message: string } } | null = null
  try {
    json = await res.json()
  } catch {
    /* CSV أو استجابة غير JSON */
  }

  if (!res.ok || (json && json.ok === false)) {
    const err = json?.error
    throw new ApiClientError(err?.code ?? 'SERVER_ERROR', err?.message ?? `خطأ (${res.status})`, res.status)
  }
  return (json?.data ?? (json as unknown)) as T
}

export const api = {
  get: <T = unknown>(url: string) => request<T>('GET', url),
  post: <T = unknown>(url: string, body?: unknown) => request<T>('POST', url, body),
  put: <T = unknown>(url: string, body?: unknown) => request<T>('PUT', url, body),
  del: <T = unknown>(url: string) => request<T>('DELETE', url),
  upload: async (file: File, folder = 'misc'): Promise<{ url: string; size: number }> => {
    const form = new FormData()
    form.append('file', file)
    form.append('folder', folder)
    return request('POST', '/api/upload', form, true)
  },
}
