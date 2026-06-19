import { unstable_cache } from 'next/cache'
import { createServerClient } from '@amiora/database'
import type { PurityMeta } from './attachCardPrice'

type VariantLike = { purity_id?: string | null }

type ProductLike = { product_variants?: VariantLike[] | null | unknown }

function collectPurityIds(products: ProductLike[]): string[] {
  const ids = new Set<string>()
  for (const product of products) {
    const variants = Array.isArray(product.product_variants) ? product.product_variants : []
    for (const variant of variants) {
      if (variant && typeof variant === 'object' && 'purity_id' in variant) {
        const pid = (variant as VariantLike).purity_id
        if (typeof pid === 'string') ids.add(pid)
      }
    }
  }
  return [...ids].sort()
}

async function fetchPurityMapByIds(
  supabase: ReturnType<typeof createServerClient>,
  ids: string[],
): Promise<Record<string, PurityMeta>> {
  const { data } = await supabase
    .from('metal_purities')
    .select('id, code, metal')
    .in('id', ids)

  return Object.fromEntries(
    (data ?? []).map((row) => [row.id, { code: row.code, metal: row.metal }]),
  )
}

export async function fetchPurityMapForProducts(
  supabase: ReturnType<typeof createServerClient>,
  products: ProductLike[],
): Promise<Record<string, PurityMeta>> {
  const ids = collectPurityIds(products)
  if (ids.length === 0) return {}

  return unstable_cache(
    async () => fetchPurityMapByIds(createServerClient(), ids),
    ['fetchPurityMap', ids.join(',')],
    { revalidate: 300 },
  )()
}
