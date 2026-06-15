import type { SupabaseClient } from '@supabase/supabase-js'

/** Replace all tag memberships for a product. */
export async function syncProductTags(
  supabase: SupabaseClient,
  productId: string,
  tagIds: string[],
): Promise<{ error?: string }> {
  const unique = [...new Set(tagIds.filter(Boolean))]

  const { data: existing } = await supabase
    .from('product_tags')
    .select('tag_id')
    .eq('product_id', productId)

  const existingIds = new Set((existing ?? []).map((r) => r.tag_id))
  const targetIds = new Set(unique)

  const toRemove = [...existingIds].filter((id) => !targetIds.has(id))
  const toAdd = unique.filter((id) => !existingIds.has(id))

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('product_tags')
      .delete()
      .eq('product_id', productId)
      .in('tag_id', toRemove)
    if (error) return { error: error.message }
  }

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('product_tags')
      .insert(toAdd.map((tag_id) => ({ product_id: productId, tag_id })))
    if (error) return { error: error.message }
  }

  return {}
}
