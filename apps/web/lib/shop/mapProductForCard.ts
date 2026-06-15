import { attachCardPrice, type PurityMeta } from '@/lib/pricing/attachCardPrice'
import { resolveProductCardImages } from '@/lib/shop/resolveProductCardImages'

/** Disambiguate embed after collection_products junction added a second FK path. */
export const PRODUCT_COLLECTION_EMBED = 'collections!products_collection_id_fkey'
export const PRODUCT_CATEGORY_EMBED = 'categories!products_category_id_fkey'

/** Standard Supabase select for ProductCard listings. */
export const PRODUCT_CARD_SELECT =
  `id,name,slug,making_charge_pct,making_charge_discount_pct,gem_price_discount_pct,stone_lines,collection:${PRODUCT_COLLECTION_EMBED}(slug),category:${PRODUCT_CATEGORY_EMBED}(slug),product_images(*),product_color_groups(id,color_id,images,display_order,is_active),product_variants(id,sku,price,stock_qty,metal_weight_g,purity_id,is_active)`

export type ProductCardRaw = {
  id: string
  name: string
  slug: string
  making_charge_pct: number
  making_charge_discount_pct?: number | null
  gem_price_discount_pct?: number | null
  stone_lines?: unknown
  product_images?: Parameters<typeof resolveProductCardImages>[1]
  product_color_groups?: Parameters<typeof resolveProductCardImages>[2]
  product_variants?: {
    id: string
    sku?: string
    price?: number
    stock_qty: number
    metal_weight_g?: number | null
    purity_id?: string
    is_active?: boolean
  }[]
  collection?: { slug?: string } | null
  category?: { slug?: string } | null
}

/** Resolve card images from legacy + colour groups, then attach live price. */
export function mapProductForCard(
  raw: ProductCardRaw,
  goldPrice: number,
  silverPrice: number,
  purityMap: Record<string, PurityMeta> = {},
) {
  const images = resolveProductCardImages(raw.name, raw.product_images, raw.product_color_groups)
  return attachCardPrice(
    {
      ...raw,
      product_images: images,
      collectionSlug: raw.collection?.slug ?? null,
      categorySlug: raw.category?.slug ?? null,
      product_variants: raw.product_variants ?? [],
    },
    goldPrice,
    silverPrice,
    purityMap,
  )
}
