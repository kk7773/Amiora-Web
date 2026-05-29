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

type Ctx = { params: Promise<{ id: string }> }

type ColorVariantIn = {
  id?: string
  color_id: string
  images: string[]
  display_order?: number
  is_active?: boolean
}

type MatrixCell = {
  id?: string
  color_id: string
  purity_id: string
  price: number
  stock_qty?: number
  is_active?: boolean
}

type Body = {
  product: {
    name: string
    slug: string
    category_id: string
    collection_id?: string | null
    product_number: number
    short_desc?: string | null
    description?: string | null
    diamond_shape?: string | null
    diamond_count?: number | null
    total_diamond_wt?: number | null
    diamond_color?: string | null
    diamond_clarity?: string | null
    size_range?: string | null
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
  color_variants: ColorVariantIn[]
  matrix: MatrixCell[]
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('products', 'edit')
  if (!perm.ok) return perm.response
  try {
    const { id } = await params
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

    const uniqColors = new Set(body.color_variants.map((row) => row.color_id))
    if (uniqColors.size !== body.color_variants.length) {
      return NextResponse.json({ error: 'Colour variants must be unique per product' }, { status: 400 })
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

    const [purityRes, colorRes, existingGroupsRes, existingVariantsRes] = await Promise.all([
      supabase
        .from('metal_purities')
        .select('id, code')
        .in('id', [...new Set(body.matrix.map((row) => row.purity_id))]),
      supabase
        .from('metal_colors')
        .select('id, code')
        .in('id', [...new Set(body.color_variants.map((row) => row.color_id))]),
      supabase
        .from('product_color_groups')
        .select('id, color_id')
        .eq('product_id', id),
      supabase
        .from('product_variants')
        .select('id, color_group_id, color_id, purity_id')
        .eq('product_id', id),
    ])

    const purityCode = Object.fromEntries((purityRes.data ?? []).map((row) => [row.id, row.code]))
    const colorCode = Object.fromEntries((colorRes.data ?? []).map((row) => [row.id, row.code]))
    const existingGroups = existingGroupsRes.data ?? []
    const existingVariants = existingVariantsRes.data ?? []

    const productUpdate = {
      name: body.product.name.trim(),
      slug: body.product.slug.trim(),
      category_id: body.product.category_id,
      collection_id: body.product.collection_id ?? null,
      product_number: Math.max(1, Math.floor(body.product.product_number)),
      short_desc: body.product.short_desc ?? null,
      description: body.product.description ?? null,
      diamond_shape: body.product.diamond_shape ?? null,
      diamond_count: body.product.diamond_count ?? null,
      total_diamond_wt: body.product.total_diamond_wt ?? null,
      diamond_color: body.product.diamond_color ?? null,
      diamond_clarity: body.product.diamond_clarity ?? null,
      size_range: body.product.size_range ?? null,
      metal_weight_g: parseOptionalGrams(body.product.metal_weight_g),
      meta_title: body.product.meta_title ?? null,
      meta_description: body.product.meta_description ?? null,
      status: body.product.status ?? 'draft',
      is_featured: body.product.is_featured ?? false,
      is_new_arrival: body.product.is_new_arrival ?? false,
      is_best_seller: body.product.is_best_seller ?? false,
      is_coming_soon: body.product.is_coming_soon ?? false,
      making_charge_pct: body.product.making_charge_pct ?? 8,
      has_stone: Boolean(body.product.has_stone),
      stone_lines: body.product.has_stone ? normalizeStoneLines(body.product.stone_lines) : [],
    }

    const { error: productError } = await supabase
      .from('products')
      .update(productUpdate)
      .eq('id', id)

    if (productError) {
      console.error('[PATCH /api/products/:id] product update', productError)
      return NextResponse.json({ error: productError.message }, { status: 500 })
    }

    const keepGroupIds = new Set(body.color_variants.map((row) => row.id).filter((value): value is string => !!value))
    const groupsToDelete = existingGroups.filter((row) => !keepGroupIds.has(row.id))

    if (groupsToDelete.length > 0) {
      const groupIds = groupsToDelete.map((row) => row.id)
      const { error: deleteVariantsError } = await supabase
        .from('product_variants')
        .delete()
        .eq('product_id', id)
        .in('color_group_id', groupIds)
      if (deleteVariantsError) {
        console.error('[PATCH /api/products/:id] delete variants for removed groups', deleteVariantsError)
        return NextResponse.json({ error: deleteVariantsError.message }, { status: 500 })
      }

      const { error: deleteGroupsError } = await supabase
        .from('product_color_groups')
        .delete()
        .eq('product_id', id)
        .in('id', groupIds)
      if (deleteGroupsError) {
        console.error('[PATCH /api/products/:id] delete groups', deleteGroupsError)
        return NextResponse.json({ error: deleteGroupsError.message }, { status: 500 })
      }
    }

    const groupByColorId = new Map<string, string>()
    for (let index = 0; index < body.color_variants.length; index++) {
      const colorVariant = body.color_variants[index]!
      if (colorVariant.id) {
        const { error } = await supabase
          .from('product_color_groups')
          .update({
            color_id: colorVariant.color_id,
            images: colorVariant.images ?? [],
            display_order: colorVariant.display_order ?? index,
            is_active: colorVariant.is_active ?? true,
          })
          .eq('id', colorVariant.id)
          .eq('product_id', id)
        if (error) {
          console.error('[PATCH /api/products/:id] update group', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
        groupByColorId.set(colorVariant.color_id, colorVariant.id)
        continue
      }

      const { data, error } = await supabase
        .from('product_color_groups')
        .insert({
          product_id: id,
          color_id: colorVariant.color_id,
          images: colorVariant.images ?? [],
          display_order: colorVariant.display_order ?? index,
          is_active: colorVariant.is_active ?? true,
        })
        .select('id')
        .single()

      if (error || !data) {
        console.error('[PATCH /api/products/:id] insert group', error)
        return NextResponse.json({ error: error?.message ?? 'Color group insert failed' }, { status: 500 })
      }
      groupByColorId.set(colorVariant.color_id, data.id)
    }

    const incomingVariantIds = new Set(body.matrix.map((row) => row.id).filter((value): value is string => !!value))
    const variantsToDelete = existingVariants.filter((row) => !incomingVariantIds.has(row.id))
    if (variantsToDelete.length > 0) {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('product_id', id)
        .in('id', variantsToDelete.map((row) => row.id))
      if (error) {
        console.error('[PATCH /api/products/:id] delete variants', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    for (const cell of body.matrix) {
      const groupId = groupByColorId.get(cell.color_id)
      const purity = purityCode[cell.purity_id]
      const color = colorCode[cell.color_id]
      const price = Number(cell.price)

      if (!groupId || !purity || !color || !Number.isFinite(price) || price <= 0) continue

      const payload = {
        color_group_id: groupId,
        color_id: cell.color_id,
        purity_id: cell.purity_id,
        sku: generateAmioraSKU(String(catRow.code), productUpdate.product_number, String(purity), String(color)),
        price,
        stock_qty: Math.max(0, Math.floor(cell.stock_qty ?? 0)),
        is_active: cell.is_active ?? true,
      }

      if (cell.id) {
        const { error } = await supabase
          .from('product_variants')
          .update(payload)
          .eq('id', cell.id)
          .eq('product_id', id)
        if (error) {
          console.error('[PATCH /api/products/:id] update variant', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
      } else {
        const { error } = await supabase
          .from('product_variants')
          .insert({
            product_id: id,
            ...payload,
          })
        if (error) {
          console.error('[PATCH /api/products/:id] insert variant', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
      }
    }

    await writeAuditLog({ adminId: perm.adminId, action: 'update_product', resource: 'products', resourceId: id })
    return NextResponse.json({ id })
  } catch (err: unknown) {
    console.error('[PATCH /api/products/:id]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    )
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('products', 'edit')
  if (!perm.ok) return perm.response
  try {
    const { id } = await params
    const supabase = createServerClient()
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await writeAuditLog({ adminId: perm.adminId, action: 'delete_product', resource: 'products', resourceId: id })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    )
  }
}
