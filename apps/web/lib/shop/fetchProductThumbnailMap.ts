import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resolve one thumbnail URL per product from legacy product_images,
 * then active product_color_groups (catalog CMS path).
 */
export async function fetchProductThumbnailMap(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Record<string, string | null>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))]
  const thumbnails: Record<string, string | null> = Object.fromEntries(
    uniqueIds.map((id) => [id, null]),
  )
  if (uniqueIds.length === 0) return thumbnails

  const { data: images } = await supabase
    .from('product_images')
    .select('product_id, url, is_primary')
    .in('product_id', uniqueIds)
    .order('is_primary', { ascending: false })

  const seen = new Set<string>()
  for (const row of images ?? []) {
    if (seen.has(row.product_id)) continue
    const url = typeof row.url === 'string' ? row.url.trim() : ''
    if (url) {
      thumbnails[row.product_id] = url
      seen.add(row.product_id)
    }
  }

  const missing = uniqueIds.filter((id) => !thumbnails[id])
  if (missing.length === 0) return thumbnails

  const { data: groups } = await supabase
    .from('product_color_groups')
    .select('product_id, images, display_order, is_active')
    .in('product_id', missing)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  const byProduct = new Map<string, { images?: string[] | null }[]>()
  for (const g of groups ?? []) {
    const list = byProduct.get(g.product_id) ?? []
    list.push(g)
    byProduct.set(g.product_id, list)
  }

  for (const pid of missing) {
    for (const g of byProduct.get(pid) ?? []) {
      const url = (g.images ?? []).find((u) => typeof u === 'string' && u.trim())
      if (url) {
        thumbnails[pid] = url.trim()
        break
      }
    }
  }

  return thumbnails
}
