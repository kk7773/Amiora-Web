const CATALOG_MIGRATION_HINTS: Array<{ pattern: RegExp; migration: string }> = [
  { pattern: /product_color_groups|metal_colors|metal_purities|product_variants.*(color_id|purity_id|stock_qty)|collection_products/i, migration: '010_cms_shop_color_purity_catalog.sql' },
  { pattern: /product_variants.*metal_weight_g|metal_weight_g/i, migration: '017_variant_metal_weight.sql' },
  { pattern: /product_color_groups.*videos|videos/i, migration: '018_product_color_group_videos.sql' },
  { pattern: /product_variant_sizes/i, migration: '029_variant_size_stocks.sql' },
  { pattern: /make_to_order|status.*check/i, migration: '031_products_make_to_order_status.sql' },
]

export function formatCatalogSchemaError(message: string | null | undefined) {
  const text = String(message ?? '').trim()
  if (!text) return null

  const missingSchema =
    /(does not exist|schema cache|column .* does not exist|relation .* does not exist|check constraint)/i.test(text)
  if (!missingSchema) return null

  const matched = CATALOG_MIGRATION_HINTS.find((entry) => entry.pattern.test(text))
  if (!matched) return null

  return `Supabase catalog schema is behind. Run migration \`${matched.migration}\` and redeploy/refresh, then try again. Original error: ${text}`
}
