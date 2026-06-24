import type { SupabaseClient } from '@supabase/supabase-js'

/** Recompute products.collection_id when primary collection was removed. */
export async function recomputePrimaryCollection(
  supabase: SupabaseClient,
  productId: string,
): Promise<void> {
  const { data: product } = await supabase
    .from('products')
    .select('collection_id')
    .eq('id', productId)
    .maybeSingle()

  const currentPrimary = product?.collection_id ?? null

  const { data: memberships } = await supabase
    .from('collection_products')
    .select('collection_id, display_order')
    .eq('product_id', productId)
    .order('display_order', { ascending: true })

  const rows = memberships ?? []
  const stillValid =
    currentPrimary != null && rows.some((r) => r.collection_id === currentPrimary)

  if (stillValid || rows.length === 0) {
    if (rows.length === 0 && currentPrimary != null) {
      await supabase.from('products').update({ collection_id: null }).eq('id', productId)
    }
    return
  }

  const nextPrimary = rows[0]?.collection_id ?? null
  await supabase.from('products').update({ collection_id: nextPrimary }).eq('id', productId)
}

/** Sync junction rows for a product; primary must be in collectionIds or null. */
export async function syncCollectionProducts(
  supabase: SupabaseClient,
  productId: string,
  collectionIds: string[],
  primaryCollectionId: string | null,
): Promise<{ error?: string }> {
  const uniqueIds = [...new Set(collectionIds.filter(Boolean))]
  const primary =
    primaryCollectionId && uniqueIds.includes(primaryCollectionId)
      ? primaryCollectionId
      : uniqueIds[0] ?? null

  const { data: existing } = await supabase
    .from('collection_products')
    .select('collection_id')
    .eq('product_id', productId)

  const existingIds = new Set((existing ?? []).map((r) => r.collection_id))
  const targetIds = new Set(uniqueIds)

  const toAdd = uniqueIds.filter((id) => !existingIds.has(id))
  const toRemove = [...existingIds].filter((id) => !targetIds.has(id))

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('collection_products')
      .delete()
      .eq('product_id', productId)
      .in('collection_id', toRemove)
    if (error) return { error: error.message }
  }

  if (toAdd.length > 0) {
    const inserts = toAdd.map((collectionId, index) => ({
      collection_id: collectionId,
      product_id: productId,
      display_order: index,
    }))
    const { error } = await supabase.from('collection_products').insert(inserts)
    if (error) return { error: error.message }
  }

  const { error: primaryError } = await supabase
    .from('products')
    .update({ collection_id: primary })
    .eq('id', productId)

  if (primaryError) return { error: primaryError.message }
  return {}
}

/** Add products to a collection from taxonomy manager. */
export async function addProductsToCollection(
  supabase: SupabaseClient,
  collectionId: string,
  productIds: string[],
): Promise<{ error?: string; added: number }> {
  const unique = [...new Set(productIds.filter(Boolean))]
  if (unique.length === 0) return { added: 0 }

  const { data: existing } = await supabase
    .from('collection_products')
    .select('product_id, display_order')
    .eq('collection_id', collectionId)

  const existingSet = new Set((existing ?? []).map((r) => r.product_id))
  const toAdd = unique.filter((id) => !existingSet.has(id))
  if (toAdd.length === 0) return { added: 0 }

  const maxOrder = (existing ?? []).reduce(
    (max, r) => Math.max(max, r.display_order ?? 0),
    -1,
  )

  const inserts = toAdd.map((productId, i) => ({
    collection_id: collectionId,
    product_id: productId,
    display_order: maxOrder + 1 + i,
  }))

  const { error } = await supabase.from('collection_products').insert(inserts)
  if (error) return { error: error.message, added: 0 }

  for (const productId of toAdd) {
    const { data: product } = await supabase
      .from('products')
      .select('collection_id')
      .eq('id', productId)
      .maybeSingle()
    if (!product?.collection_id) {
      await supabase
        .from('products')
        .update({ collection_id: collectionId })
        .eq('id', productId)
    }
  }

  return { added: toAdd.length }
}

/** Remove one product from a collection; recompute primary if needed. */
export async function removeProductFromCollection(
  supabase: SupabaseClient,
  collectionId: string,
  productId: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('collection_products')
    .delete()
    .eq('collection_id', collectionId)
    .eq('product_id', productId)

  if (error) return { error: error.message }
  await recomputePrimaryCollection(supabase, productId)
  return {}
}

/** Reorder products within a collection. */
export async function reorderCollectionProducts(
  supabase: SupabaseClient,
  collectionId: string,
  orderedProductIds: string[],
): Promise<{ error?: string }> {
  for (let i = 0; i < orderedProductIds.length; i++) {
    const productId = orderedProductIds[i]!
    const { error } = await supabase
      .from('collection_products')
      .update({ display_order: i })
      .eq('collection_id', collectionId)
      .eq('product_id', productId)
    if (error) return { error: error.message }
  }
  return {}
}

/** Swap display_order with adjacent product (pagination-safe reorder). */
export async function swapCollectionProductOrder(
  supabase: SupabaseClient,
  collectionId: string,
  productId: string,
  direction: 'up' | 'down',
): Promise<{ error?: string }> {
  const { data: rows, error: listErr } = await supabase
    .from('collection_products')
    .select('product_id, display_order')
    .eq('collection_id', collectionId)
    .order('display_order', { ascending: true })

  if (listErr) return { error: listErr.message }
  const list = rows ?? []
  const idx = list.findIndex((r) => r.product_id === productId)
  if (idx < 0) return { error: 'Product not in collection' }

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= list.length) return {}

  const current = list[idx]!
  const neighbor = list[swapIdx]!

  const { error: e1 } = await supabase
    .from('collection_products')
    .update({ display_order: neighbor.display_order })
    .eq('collection_id', collectionId)
    .eq('product_id', current.product_id)

  if (e1) return { error: e1.message }

  const { error: e2 } = await supabase
    .from('collection_products')
    .update({ display_order: current.display_order })
    .eq('collection_id', collectionId)
    .eq('product_id', neighbor.product_id)

  if (e2) return { error: e2.message }
  return {}
}

export type TaxonomyProductSummary = {
  id: string
  name: string
  slug: string
  design_number: string | null
  product_code?: string | null
  product_number: number
  status: string
  image_url: string | null
  display_order?: number
}

/** Pick primary image from product row with nested images/groups. */
export function pickProductImageUrl(
  images: { url: string; is_primary?: boolean }[] | null | undefined,
  colorGroups: { images: string[] | null; display_order?: number; is_active?: boolean }[] | null | undefined,
): string | null {
  const primary = (images ?? []).find((i) => i.is_primary)?.url ?? images?.[0]?.url
  if (primary) return primary
  const groups = (colorGroups ?? [])
    .filter((g) => g.is_active !== false)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  for (const g of groups) {
    const first = g.images?.[0]
    if (first) return first
  }
  return null
}
