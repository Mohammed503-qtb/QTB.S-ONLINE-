import { ok, fail, handleRouteError } from '@/lib/server/api'
import { requireUser } from '@/lib/server/auth'
import { randomBytes } from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

// رفع الصور (إيصالات الدفع وغيرها — PLAN ق69)
// - تحقق من النوع والحجم
// - ضغط وتحويل WebP
// - اسم تخزين غير قابل للتخمين
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']

export async function POST(req: Request) {
  try {
    await requireUser()
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return fail('VALIDATION_ERROR', 'لم يتم إرسال ملف', 400)

    if (!ALLOWED.includes(file.type)) {
      return fail('VALIDATION_ERROR', 'نوع الملف غير مدعوم (JPG / PNG / WebP فقط)', 400)
    }
    if (file.size > MAX_SIZE) {
      return fail('VALIDATION_ERROR', 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت', 400)
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // ضغط + WebP (توفير مساحة — ملف الرؤية ق52)
    const folder = (form.get('folder') as string) || 'misc'
    const safeFolder = folder.replace(/[^a-z0-9-]/gi, '')
    const name = `${Date.now()}-${randomBytes(8).toString('hex')}.webp`
    const dir = path.join(process.cwd(), 'public', 'uploads', safeFolder)
    await mkdir(dir, { recursive: true })

    const compressed = await sharp(buffer)
      .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()

    await writeFile(path.join(dir, name), compressed)

    return ok({ url: `/uploads/${safeFolder}/${name}`, size: compressed.length })
  } catch (e) {
    return handleRouteError(e)
  }
}
