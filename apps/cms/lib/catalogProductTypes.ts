export type ColorVariantIn = {
  id?: string
  color_id: string
  images: string[]
  videos?: string[]
  display_order?: number
  is_active?: boolean
}

export type MatrixCell = {
  id?: string
  color_id: string
  purity_id: string
  price?: number
  stock_qty?: number
  is_active?: boolean
  metal_weight_g: number
}

export type VariantSizeStock = {
  id?: string
  variant_id?: string
  color_id: string
  purity_id: string
  size_label: string
  size_type: 'ring_us' | 'chain_inch'
  stock_qty?: number
  price_override?: number | null
  is_active?: boolean
}

export type CatalogProductPayload = {
  product: {
    name: string
    slug: string
    category_id: string
    collection_id?: string | null
    product_number?: number
    design_number?: string | null
    product_code?: string | null
    short_desc?: string | null
    description?: string | null
    diamond_shape?: string | null
    diamond_count?: number | null
    total_diamond_wt?: number | null
    diamond_color?: string | null
    diamond_clarity?: string | null
    size_range?: string | null
    chain_lengths?: unknown
    metal_weight_g?: number | null
    meta_title?: string | null
    meta_description?: string | null
    status?: 'draft' | 'active' | 'archived'
    is_featured?: boolean
    is_new_arrival?: boolean
    is_best_seller?: boolean
    is_coming_soon?: boolean
    making_charge_pct?: number
    has_stone?: boolean
    stone_lines?: unknown
  }
  /** All collections this product belongs to (many-to-many). */
  collection_ids?: string[]
  /** Taxonomy tag IDs (many-to-many via product_tags). */
  tag_ids?: string[]
  color_variants: ColorVariantIn[]
  matrix: MatrixCell[]
  size_stocks?: VariantSizeStock[]
}
