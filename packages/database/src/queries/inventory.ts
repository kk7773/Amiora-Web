import type { SupabaseClient } from '../client'

export async function getVariantInventory(client: SupabaseClient, variantId: string) {
  return client
    .from('product_variants')
    .select('id, sku, stock_qty, is_active')
    .eq('id', variantId)
    .single()
}

export async function getLowStockVariants(client: SupabaseClient, threshold = 5) {
  return client
    .from('product_variants')
    .select(`*, products (name, slug)`)
    .lte('stock_qty', threshold)
    .eq('is_active', true)
    .order('stock_qty', { ascending: true })
}

export async function updateVariantStock(
  client: SupabaseClient,
  variantId: string,
  stockQuantity: number,
) {
  return client
    .from('product_variants')
    .update({
      stock_qty:  stockQuantity,
      is_active: stockQuantity > 0,
    })
    .eq('id', variantId)
    .select()
    .single()
}

export async function reserveStock(
  client: SupabaseClient,
  variantId: string,
  quantity: number
) {
  return client.rpc('reserve_stock', { p_variant_id: variantId, p_quantity: quantity })
}

export async function releaseStock(
  client: SupabaseClient,
  variantId: string,
  quantity: number
) {
  return client.rpc('release_stock', { p_variant_id: variantId, p_quantity: quantity })
}
