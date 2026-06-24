import type { SupabaseClient } from '@supabase/supabase-js'

export function normalizeProductIdentityPart(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

export function buildProductCode(categoryCode: string, designNumber: string) {
  const category = normalizeProductIdentityPart(categoryCode)
  const design = normalizeProductIdentityPart(designNumber)
  return category && design ? `${category}${design}` : ''
}

export async function fetchNextProductNumber(supabase: SupabaseClient, categoryId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('product_number')
    .eq('category_id', categoryId)
    .order('product_number', { ascending: false })
    .limit(1)

  if (error) throw new Error(error.message)
  return ((data?.[0]?.product_number ?? 0) as number) + 1
}
