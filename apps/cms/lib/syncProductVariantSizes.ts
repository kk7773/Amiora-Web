import type { SupabaseClient } from '@supabase/supabase-js'
import type { VariantSizeStock } from '@/lib/catalogProductTypes'

export type VariantKeyMap = Map<string, string>

function buildVariantKey(colorId: string, purityId: string) {
  return `${colorId}:${purityId}`
}

function isMissingMetalWeightColumn(error: { message?: string | null; code?: string } | null | undefined) {
  return !!error?.message && /metal_weight_g/i.test(error.message) && /(column|schema cache|does not exist|42703)/i.test(error.message)
}

export async function syncProductVariantSizes(
  supabase: SupabaseClient,
  productId: string,
  sizeStocks: VariantSizeStock[] | undefined,
  variantMap: VariantKeyMap,
) {
  const rows = Array.isArray(sizeStocks) ? sizeStocks : []
  const { error: deleteError } = await supabase
    .from('product_variant_sizes')
    .delete()
    .eq('product_id', productId)

  if (deleteError) {
    return { error: deleteError }
  }

  if (rows.length === 0) {
    return { error: null }
  }

  const insertRows = rows
    .map((row) => {
      const variantId = variantMap.get(buildVariantKey(row.color_id, row.purity_id))
      if (!variantId) return null
      const sizeLabel = String(row.size_label ?? '').trim()
      if (!sizeLabel) return null
      return {
        product_id: productId,
        variant_id: variantId,
        size_label: sizeLabel,
        size_type: row.size_type,
        stock_qty: Math.max(0, Math.floor(Number(row.stock_qty ?? 0))),
        metal_weight_g:
          row.metal_weight_g != null && Number.isFinite(Number(row.metal_weight_g))
            ? Math.round(Number(row.metal_weight_g) * 1000) / 1000
            : null,
        price_override:
          row.price_override != null && Number.isFinite(Number(row.price_override))
            ? Math.round(Number(row.price_override) * 100) / 100
            : null,
        is_active: row.is_active ?? true,
      }
    })
    .filter((row): row is {
      product_id: string
      variant_id: string
      size_label: string
      size_type: 'ring_us' | 'chain_inch'
      stock_qty: number
      metal_weight_g: number | null
      price_override: number | null
      is_active: boolean
    } => row != null)

  if (insertRows.length === 0) {
    return { error: null }
  }

  const { error: insertError } = await supabase.from('product_variant_sizes').insert(insertRows)
  if (!insertError) {
    return { error: null }
  }

  if (!isMissingMetalWeightColumn(insertError)) {
    return { error: insertError }
  }

  const fallbackRows = insertRows.map(({ metal_weight_g: _metalWeightG, ...row }) => row)
  const { error: fallbackError } = await supabase.from('product_variant_sizes').insert(fallbackRows)
  return { error: fallbackError ?? null }
}
