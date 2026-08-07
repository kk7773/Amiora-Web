import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { computeCatalogVariantPrice, readManualPriceOverride } from '@amiora/pricing'
import { generateAmioraSKU } from '@/lib/sku'
import { normalizeStoneLines } from '@/lib/normalizeStoneLines'
import { normalizeChainLengths } from '@/lib/normalizeChainLengths'
import { syncProductVariantSizes } from '@/lib/syncProductVariantSizes'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'
import { insertProductColorGroup, updateProductColorGroup } from '@/lib/productColorGroupsDb'

function parseOptionalGrams(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

function isMissingChainLengthsColumn(message: string) {
  return /chain_lengths/i.test(message) && /(column|schema cache|does not exist|42703)/i.test(message)
}

type Ctx = { params: Promise<{ id: string }> }

type ColorVariantIn = {
  id?: string
  color_id: string
  images: string[]
  videos?: string[]
  display_order?: number
  is_active?: boolean
}

type MatrixCell = {
  id?: string
  color_id: string
  purity_id: string
  price?: number
  stock_qty?: number
  is_active?: boolean
  metal_weight_g: number
}

type Body = {
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
    status?: 'draft' | 'active' | 'archived' | 'make_to_order'
    is_featured?: boolean
    is_new_arrival?: boolean
    is_best_seller?: boolean
    is_coming_soon?: boolean
    making_charge_pct?: number
    has_stone?: boolean
    stone_lines?: unknown
  }
  size_stocks?: Array<{
    id?: string
    color_id: string
    purity_id: string
    size_label: string
    size_type: 'ring_us' | 'chain_inch'
    stock_qty?: number
    price_override?: number | null
    is_active?: boolean
  }>
  collection_ids?: string[]
  tag_ids?: string[]
  color_variants: ColorVariantIn[]
  matrix: MatrixCell[]
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const perm = await requireCmsAccess('products', 'edit')
  if (perm.ok === false) return perm.response
  try {
    const { id } = await params
    const body = (await req.json()) as Body

    if (!body.product?.name || !body.product.slug || !body.product.category_id) {
      return NextResponse.json({ error: 'Missing name, slug, or category' }, { status: 400 })
    }
    if (!body.product.design_number?.trim()) {
      return NextResponse.json({ error: 'Design number is required to generate product ID' }, { status: 400 })
    }
    if (!Array.isArray(body.color_variants) || body.color_variants.length === 0) {
      return NextResponse.json({ error: 'Add at least one colour variant with images or videos' }, { status: 400 })
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

    const { data: existingProduct } = await supabase
      .from('products')
      .select('product_number')
      .eq('id', id)
      .maybeSingle()

    if (catErr || !catRow?.code) {
      return NextResponse.json({ error: 'Invalid category or missing category code' }, { status: 400 })
    }

    const [purityRes, colorRes, existingGroupsRes, existingVariantsRes, goldRes, silverRes, diamondRes] =
      await Promise.all([
      supabase
        .from('metal_purities')
        .select('id, code, metal')
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
      supabase
        .from('live_prices')
        .select('price_per_gram')
        .eq('metal', 'gold_999')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('live_prices')
        .select('price_per_gram')
        .eq('metal', 'silver_999')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('live_prices')
        .select('price_per_gram')
        .eq('metal', 'diamond_ct')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const goldPerGram =
      goldRes.data?.price_per_gram != null ? Number(goldRes.data.price_per_gram) : null
    const silverPerGram =
      silverRes.data?.price_per_gram != null ? Number(silverRes.data.price_per_gram) : null
    const diamondPerCarat =
      diamondRes.data?.price_per_gram != null ? Number(diamondRes.data.price_per_gram) : null
    const purityMeta = Object.fromEntries(
      (purityRes.data ?? []).map((row) => [row.id, { code: row.code, metal: row.metal }]),
    )
    const purityCode = Object.fromEntries((purityRes.data ?? []).map((row) => [row.id, row.code]))
    const colorCode = Object.fromEntries((colorRes.data ?? []).map((row) => [row.id, row.code]))
    const existingGroups = existingGroupsRes.data ?? []
    const existingVariants = existingVariantsRes.data ?? []
    const designNumber = body.product.design_number.trim().toUpperCase()
    const productNumber =
      typeof body.product.product_number === 'number' && Number.isFinite(body.product.product_number)
        ? Math.max(1, Math.floor(body.product.product_number))
        : Math.max(1, Math.floor(existingProduct?.product_number ?? 1))

    const productUpdate = {
      name: body.product.name.trim(),
      slug: body.product.slug.trim(),
      category_id: body.product.category_id,
      collection_id: body.product.collection_id ?? null,
      design_number: designNumber,
      short_desc: body.product.short_desc ?? null,
      description: body.product.description ?? null,
      diamond_shape: body.product.diamond_shape ?? null,
      diamond_count: body.product.diamond_count ?? null,
      total_diamond_wt: body.product.total_diamond_wt ?? null,
      diamond_color: body.product.diamond_color ?? null,
      diamond_clarity: body.product.diamond_clarity ?? null,
      size_range: body.product.size_range ?? null,
      chain_lengths: normalizeChainLengths(body.product.chain_lengths),
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

    if (productError && isMissingChainLengthsColumn(productError.message)) {
      const { chain_lengths: _chainLengths, ...withoutChainLengths } = productUpdate
      const retry = await supabase
        .from('products')
        .update(withoutChainLengths)
        .eq('id', id)
      if (retry.error) {
        console.error('[PATCH /api/products/:id] product update', retry.error)
        return NextResponse.json({ error: retry.error.message }, { status: 500 })
      }
    } else if (productError) {
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
        const { error } = await updateProductColorGroup(supabase, {
          id: colorVariant.id,
          product_id: id,
          color_id: colorVariant.color_id,
          images: colorVariant.images ?? [],
          videos: colorVariant.videos ?? [],
          display_order: colorVariant.display_order ?? index,
          is_active: colorVariant.is_active ?? true,
        })
        if (error) {
          console.error('[PATCH /api/products/:id] update group', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
        groupByColorId.set(colorVariant.color_id, colorVariant.id)
        continue
      }

      const { data, error } = await insertProductColorGroup(supabase, {
        product_id: id,
        color_id: colorVariant.color_id,
        images: colorVariant.images ?? [],
        videos: colorVariant.videos ?? [],
        display_order: colorVariant.display_order ?? index,
        is_active: colorVariant.is_active ?? true,
      })

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

    const stoneLines = productUpdate.stone_lines

    for (const cell of body.matrix) {
      const groupId = groupByColorId.get(cell.color_id)
      const purity = purityCode[cell.purity_id]
      const color = colorCode[cell.color_id]
      const metalWeight = parseOptionalGrams(cell.metal_weight_g)

      if (!groupId || !purity || !color || metalWeight == null || metalWeight <= 0) continue

      const meta = purityMeta[cell.purity_id]
      const breakdown = computeCatalogVariantPrice({
        metalWeightG: metalWeight,
        purityCode: String(meta?.code ?? purity),
        metalType: meta?.metal,
        makingChargePct: productUpdate.making_charge_pct,
        stoneLines,
        goldPerGram,
        silverPerGram,
        diamondPricePerCarat: diamondPerCarat,
      })
      const snapshotPrice = readManualPriceOverride(cell.price) ?? breakdown?.finalPrice ?? 0

      const payload = {
        color_group_id: groupId,
        color_id: cell.color_id,
        purity_id: cell.purity_id,
        sku: generateAmioraSKU(String(catRow.code), productNumber, String(purity), String(color)),
        price: snapshotPrice,
        stock_qty: Math.max(0, Math.floor(cell.stock_qty ?? 3)),
        metal_weight_g: metalWeight,
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

    const { data: currentVariants, error: currentVariantsError } = await supabase
      .from('product_variants')
      .select('id, color_id, purity_id')
      .eq('product_id', id)

    if (currentVariantsError) {
      console.error('[PATCH /api/products/:id] read variants for size sync', currentVariantsError)
      return NextResponse.json({ error: currentVariantsError.message }, { status: 500 })
    }

    const variantMap = new Map<string, string>()
    for (const row of currentVariants ?? []) {
      variantMap.set(`${row.color_id}:${row.purity_id}`, row.id)
    }

    const sizeSync = await syncProductVariantSizes(supabase, id, body.size_stocks, variantMap)
    if (sizeSync.error) {
      console.error('[PATCH /api/products/:id] sync size stocks', sizeSync.error)
      return NextResponse.json({ error: sizeSync.error.message }, { status: 500 })
    }

    const { syncCollectionProducts } = await import('@/lib/syncCollectionProducts')
    const collectionIds = body.collection_ids ?? (
      body.product.collection_id ? [body.product.collection_id] : []
    )
    const collSync = await syncCollectionProducts(
      supabase,
      id,
      collectionIds,
      body.product.collection_id ?? collectionIds[0] ?? null,
    )
    if (collSync.error) {
      console.error('[PATCH /api/products/:id] collection sync', collSync.error)
    }

    const { syncProductTags } = await import('@/lib/syncProductTags')
    const tagSync = await syncProductTags(supabase, id, body.tag_ids ?? [])
    if (tagSync.error) {
      console.error('[PATCH /api/products/:id] tag sync', tagSync.error)
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
  if (perm.ok === false) return perm.response
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
