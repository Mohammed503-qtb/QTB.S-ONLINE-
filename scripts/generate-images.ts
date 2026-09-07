// توليد صور المنتجات والبانرات — يعمل في الخلفية
import ZAI from 'z-ai-web-dev-sdk'
import sharp from 'sharp'
import { mkdirSync, writeFileSync, existsSync } from 'fs'
import path from 'path'

const OUT = (p: string) => path.join('/home/z/my-project/public/uploads', p)

type ImgSize = '1024x1024' | '1344x768' | '1440x720'
async function gen(prompt: string, outPath: string, size: ImgSize = '1024x1024', compress: [number, number] = [800, 800]) {
  if (existsSync(outPath)) { console.log('exists, skip:', outPath); return }
  try {
    const zai = await ZAI.create()
    const res = await zai.images.generations.create({ prompt, size })
    const b64 = res.data[0].base64
    const buf = Buffer.from(b64, 'base64')
    const webp = await sharp(buf).resize(compress[0], compress[1], { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
    writeFileSync(outPath, webp)
    console.log('✓', path.basename(outPath))
  } catch (e) {
    console.error('✗', path.basename(outPath), (e as Error).message)
  }
}

const P = (n: string) => OUT(`products/${n}.webp`)
const B = (n: string) => OUT(`banners/${n}.webp`)

const products: [string, string][] = [
  ['thobe', 'Elegant white men\'s traditional Yemeni thobe robe hanging on wooden hanger, professional product photography, clean beige studio background, soft lighting, high quality'],
  ['shirt', 'Casual light blue men\'s cotton shirt neatly folded displayed, professional e-commerce product photography, clean white background, studio lighting'],
  ['jeans', 'Classic dark indigo denim jeans men pants, product photography on clean white background, studio lighting, e-commerce style'],
  ['abaya', 'Elegant black women\'s abaya cloak with subtle embroidery on sleeves, displayed on mannequin, professional product photography, clean background'],
  ['dress', 'Elegant deep red evening dress women fashion, displayed on mannequin, studio product photography, soft lighting, high quality'],
  ['scarf', 'Luxurious beige silk hijab scarf flowing elegantly, professional product photography, soft neutral background, high quality'],
  ['oud-perfume', 'Luxury Arabian oud perfume bottle 50ml, dark amber glass with golden cap, oud chips around, professional product photography, black background, dramatic lighting'],
  ['musk-perfume', 'White musk perfume bottle 30ml, clean crystal glass bottle, soft white flowers background, professional product photography, elegant'],
  ['oud-oil', 'Traditional Cambodian oud oil 12ml in ornate small glass vial with wooden cap, oud wood chips, dark luxurious background, product photography'],
  ['earbuds', 'White wireless bluetooth earbuds with charging case, professional product photography, clean white background, studio lighting, e-commerce'],
  ['smartwatch', 'Modern black smartwatch with AMOLED colorful display, professional product photography, clean background, studio lighting'],
  ['powerbank', 'Black slim power bank 20000mAh with USB ports and LED indicators, product photography, white background, e-commerce style'],
  ['sneakers', 'Athletic running sneakers sport shoes modern design, black and white, professional product photography, clean background, studio lighting'],
  ['sandals', 'Traditional brown leather men\'s sandals slides handmade, professional product photography, clean beige background'],
  ['handbag', 'Elegant black leather women\'s handbag with gold hardware, professional product photography, clean background, studio lighting, e-commerce'],
  ['wallet', 'Brown genuine leather men\'s bifold wallet with cards, professional product photography, clean background, studio lighting'],
  ['silver-bracelet', 'Handcrafted Yemeni silver bracelet with traditional engraved patterns, professional jewelry photography, dark elegant background, high quality'],
  ['tea-cups', 'Set of 6 Arabic tea glasses with gold rims and saucers, traditional Yemeni tea set, professional product photography, warm background'],
  ['incense-burner', 'Ornate brass incense burner bakhoor mabkhara with intricate engravings, traditional Arabic design, professional product photography, dark elegant background'],
]

const banners: [string, string, ImgSize][] = [
  ['banner1', 'Luxury Arabian perfumes collection display with oud bottles, incense smoke, dark elegant atmosphere, gold accents, wide banner composition, professional advertising photography', '1440x720'],
  ['banner2', 'Modern electronics collection with headphones, smartwatch and gadgets on dark gradient background with teal accents, futuristic wide banner, professional advertising', '1440x720'],
  ['banner3', 'Elegant fashion clothing collection display with traditional and modern Arabic attire, warm colors, sophisticated boutique atmosphere, wide banner, professional photography', '1440x720'],
]

async function main() {
  mkdirSync(OUT('products'), { recursive: true })
  mkdirSync(OUT('banners'), { recursive: true })

  for (const [name, prompt] of products) {
    await gen(prompt, P(name))
  }
  for (const [name, prompt, size] of banners) {
    await gen(prompt, B(name), size, [1200, 600])
  }
  console.log('DONE ALL')
}

main().catch(console.error)
