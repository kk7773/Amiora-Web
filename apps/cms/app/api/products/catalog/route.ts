import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { generateAmioraSKU } from '@/lib/sku'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'

function parseOptionalGrams(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

function normalizeStoneLines(input: unknown): Array<{
  name: string; cut_size: string; shape: string; color: string;
  count: number | null; rate_inr: number | null; price_inr: number | null
}> {
  if (!Array.isArray(input)) return []
  const out: Array<{
    name: string; cut_size: string; shape: string; color: string;
    count: number | null; rate_inr: number | null; price_inr: number | null
  }> = []
  for (const row of input) {
    if (!row || typeof row !== 'object') continue
    const r        = row as Record<string, unknown>
    const name     = typeof r.name     === 'string' ? r.name.trim()     : ''
    const cut_size = typeof r.cut_size === 'string' ? r.cut_size.trim() : ''
    const shape    = typeof r.shape    === 'string' ? r.shape.trim()    : ''
    const color    = typeof r.color    === 'string' ? r.color.trim()    : ''
    let rate_inr: number | null = null
    if (typeof r.rate_inr === 'number' && Number.isFinite(r.rate_inr)) rate_inr = r.rate_inr
    else if (r.rate_inr != null && r.rate_inr !== '') {
      const n = parseFloat(String(r.rate_inr))
      if (Number.isFinite(n)) rate_inr = n
    }
    let count: number | null = null
    if (typeof r.count === 'number' && Number.isFinite(r.count)) count = Math.floor(r.count)
    else if (r.count != null && r.count !== '') {
      const n = parseInt(String(r.count))
      if (Number.isFinite(n)) count = n
    }
    const price_inr = rate_inr != null && count != null ? rate_inr * count : null
    if (!name && !cut_size && rate_inr == null) continue
    out.push({ name, cut_size, shape, color, count, rate_inr, price_inr })
  }
  return out
}

type ColorVariantIn = {
  id?:           string
  color_id:      string
  images:        string[]
  display_order?: number
  is_active?:    boolean
}

type MatrixCell = {
  id?:          string
  color_id:    string
  purity_id:   string
  price:      number
  stock_qty?: number
  is_active?:  boolean
}

type Body = {
  product: {
    name:             string
    slug:             string
    category_id:      string
    collection_id?:   string | null
    product_number:   number
    short_desc?:      string | null
    description?:     string | null
    diamond_shape?:   string | null
    diamond_count?:   number | null
    total_diamond_wt?: number | null
    diamond_color?:   string | null
    diamond_clarity?: string | null
    size_range?:      string | null
    metal_weight_g?:  number | null
    meta_title?:      string | null
    meta_description?: string | null
    status?:          'draft' | 'active' | 'archived'
    is_featured?:     boolean
    is_new_arrival?:  boolean
    is_best_seller?:  boolean
    is_coming_soon?:  boolean
    making_charge_pct?: number
    has_stone?: boolean
    stone_lines?: unknown
  }
  color_variants: ColorVariantIn[]
  matrix: MatrixCell[]
}

export async function POST(req: NextRequest) {
  const perm = await requireCmsAccess('products', 'edit')
  if (perm.ok === false) return perm.response
  try {
    const body = (await req.json()) as Body
    if (!body.product?.name || !body.product.slug || !body.product.category_id) {
      return NextResponse.json({ error: 'Missing name, slug, or category' }, { status: 400 })
    }
    if (!Array.isArray(body.color_variants) || body.color_variants.length === 0) {
      return NextResponse.json({ error: 'Add at least one colour variant with images' }, { status: 400 })
    }
    if (!Array.isArray(body.matrix) || body.matrix.length === 0) {
      return NextResponse.json({ error: 'Pricing matrix empty' }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: catRow, error: catErr } = await supabase
      .from('categories')
      .select('code')
      .eq('id', body.product.category_id)
      .single()

    if (catErr || !catRow?.code) {
      return NextResponse.json({ error: 'Invalid category or missing category code' }, { status: 400 })
    }
    const catCode = String(catRow.code)

    const { data: purityRows } = await supabase
      .from('metal_purities')
      .select('id, code')
      .in(
        'id',
        [...new Set(body.matrix.map((m) => m.purity_id))],
      )

    const { data: colorRows } = await supabase
      .from('metal_colors')
      .select('id, code')
      .in(
        'id',
        [...new Set(body.matrix.map((m) => m.color_id))],
      )

    const purityCode = Object.fromEntries((purityRows ?? []).map((r) => [r.id, r.code]))
    const colorCodeMap = Object.fromEntries((colorRows ?? []).map((r) => [r.id, r.code]))

    const prodInsert = {
      name:               body.product.name.trim(),
      slug:               body.product.slug.trim(),
      category_id:        body.product.category_id,
      collection_id:      body.product.collection_id ?? null,
      product_number:     Math.max(1, Math.floor(body.product.product_number)),
      short_desc:         body.product.short_desc ?? null,
      description:        body.product.description ?? null,
      diamond_shape:      body.product.diamond_shape ?? null,
      diamond_count:      body.product.diamond_count ?? null,
      total_diamond_wt:   body.product.total_diamond_wt ?? null,
      diamond_color:      body.product.diamond_color ?? null,
      diamond_clarity:    body.product.diamond_clarity ?? null,
      size_range:         body.product.size_range ?? null,
      metal_weight_g:     parseOptionalGrams(body.product.metal_weight_g),
      meta_title:         body.product.meta_title ?? null,
      meta_description:   body.product.meta_description ?? null,
      status:             body.product.status ?? 'draft',
      is_featured:        body.product.is_featured ?? false,
      is_new_arrival:     body.product.is_new_arrival ?? false,
      is_best_seller:     body.product.is_best_seller ?? false,
      is_coming_soon:     body.product.is_coming_soon ?? false,
      making_charge_pct:    body.product.making_charge_pct ?? 8,
      has_stone:             Boolean(body.product.has_stone),
      stone_lines:           body.product.has_stone ? normalizeStoneLines(body.product.stone_lines) : [],
    }

    const { data: prod, error: pErr } = await supabase.from('products').insert(prodInsert).select('id').single()
    if (pErr || !prod) {
      console.error('[catalog] product insert', pErr)
      return NextResponse.json({ error: pErr?.message ?? 'Insert failed' }, { status: 500 })
    }

    const productId = prod.id
    const groupByColor = new Map<string, string>()

    for (let i = 0; i < body.color_variants.length; i++) {
      const cv = body.color_variants[i]!
      const { data: grp, error: gErr } = await supabase
        .from('product_color_groups')
        .insert({
          product_id:    productId,
          color_id:      cv.color_id,
          images:        cv.images ?? [],
          display_order: cv.display_order ?? i,
          is_active:     cv.is_active ?? true,
        })
        .select('id, color_id')
        .single()
      if (gErr || !grp) {
        console.error('[catalog] color group', gErr)
        await supabase.from('products').delete().eq('id', productId)
        return NextResponse.json({ error: gErr?.message ?? 'Color group insert failed' }, { status: 500 })
      }
      groupByColor.set(grp.color_id, grp.id)
    }

    const variantRows = []
    for (const cell of body.matrix) {
      const gId = groupByColor.get(cell.color_id)
      if (!gId) continue
      const pCode = purityCode[cell.purity_id]
      const cCode = colorCodeMap[cell.color_id]
      if (!pCode || !cCode) continue
      const price = Number(cell.price)
      if (!Number.isFinite(price) || price <= 0) continue

      variantRows.push({
        product_id:     productId,
        color_group_id: gId,
        color_id:       cell.color_id,
        purity_id:      cell.purity_id,
        sku:            generateAmioraSKU(catCode, prodInsert.product_number, String(pCode), String(cCode)),
        price,
        stock_qty:      Math.max(0, Math.floor(cell.stock_qty ?? 1)),
        is_active:      cell.is_active ?? true,
      })
    }

    if (variantRows.length === 0) {
      await supabase.from('products').delete().eq('id', productId)
      return NextResponse.json({ error: 'No valid variant rows — check prices' }, { status: 400 })
    }

    const { error: vErr } = await supabase.from('product_variants').insert(variantRows)
    if (vErr) {
      console.error('[catalog] variants', vErr)
      await supabase.from('products').delete().eq('id', productId)
      return NextResponse.json({ error: vErr.message }, { status: 500 })
    }

    await writeAuditLog({ adminId: perm.adminId, action: 'create_product', resource: 'products', resourceId: productId })
    return NextResponse.json({ id: productId }, { status: 201 })
  } catch (e: unknown) {
    console.error('[catalog]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
