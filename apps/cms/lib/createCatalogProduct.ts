import type { SupabaseClient } from '@supabase/supabase-js'
import { computeCatalogVariantPrice, readManualPriceOverride } from '@amiora/pricing'
import { generateAmioraSKU } from '@/lib/sku'
import { insertProductColorGroup } from '@/lib/productColorGroupsDb'
import { normalizeStoneLines, parseOptionalGrams } from '@/lib/normalizeStoneLines'
import { normalizeChainLengths } from '@/lib/normalizeChainLengths'
import { syncProductVariantSizes } from '@/lib/syncProductVariantSizes'
import type { CatalogProductPayload } from '@/lib/catalogProductTypes'
import { fetchNextProductNumber } from '@/lib/productIdentity'

export type CreateCatalogProductResult =
  | { ok: true; productId: string }
  | { ok: false; error: string }

export async function createCatalogProduct(
  supabase: SupabaseClient,
  body: CatalogProductPayload,
): Promise<CreateCatalogProductResult> {
  if (!body.product?.name || !body.product.slug || !body.product.category_id) {
    return { ok: false, error: 'Missing name, slug, or category' }
  }
  if (!Array.isArray(body.color_variants) || body.color_variants.length === 0) {
    return { ok: false, error: 'Add at least one colour variant' }
  }
  if (!Array.isArray(body.matrix) || body.matrix.length === 0) {
    return { ok: false, error: 'Pricing matrix empty' }
  }

  const { data: catRow, error: catErr } = await supabase
    .from('categories')
    .select('code')
    .eq('id', body.product.category_id)
    .single()

  if (catErr || !catRow?.code) {
    return { ok: false, error: 'Invalid category or missing category code' }
  }
  const catCode = String(catRow.code)

  const [{ data: purityRows }, { data: goldRow }, { data: silverRow }, { data: diamondRow }] = await Promise.all([
    supabase
      .from('metal_purities')
      .select('id, code, metal')
      .in('id', [...new Set(body.matrix.map((m) => m.purity_id))]),
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

  const goldPerGram = goldRow?.price_per_gram != null ? Number(goldRow.price_per_gram) : null
  const silverPerGram = silverRow?.price_per_gram != null ? Number(silverRow.price_per_gram) : null
  const diamondPerCarat = diamondRow?.price_per_gram != null ? Number(diamondRow.price_per_gram) : null
  const purityMeta = Object.fromEntries(
    (purityRows ?? []).map((r) => [r.id, { code: r.code, metal: r.metal }]),
  )

  const { data: colorRows } = await supabase
    .from('metal_colors')
    .select('id, code')
    .in('id', [...new Set(body.matrix.map((m) => m.color_id))])

  const purityCode = Object.fromEntries((purityRows ?? []).map((r) => [r.id, r.code]))
  const colorCodeMap = Object.fromEntries((colorRows ?? []).map((r) => [r.id, r.code]))
  const stoneLines = body.product.has_stone ? normalizeStoneLines(body.product.stone_lines) : []
  const designNumber = body.product.design_number?.trim().toUpperCase() ?? ''
  if (!designNumber) {
    return { ok: false, error: 'Design number is required to generate product ID' }
  }

  const productNumber =
    typeof body.product.product_number === 'number' && Number.isFinite(body.product.product_number)
      ? Math.max(1, Math.floor(body.product.product_number))
      : await fetchNextProductNumber(supabase, body.product.category_id)

  const prodInsert = {
    name: body.product.name.trim(),
    slug: body.product.slug.trim(),
    category_id: body.product.category_id,
    collection_id: body.product.collection_id ?? null,
    product_number: productNumber,
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

  const stripChainLengths = (payload: Record<string, unknown>) => {
    const { chain_lengths: _chainLengths, ...rest } = payload
    return rest
  }

  let insertPayload: Record<string, unknown> = { ...prodInsert }
  let { data: prod, error: pErr } = await supabase.from('products').insert(insertPayload).select('id').single()

  if ((pErr || !prod) && pErr?.message && /chain_lengths/i.test(pErr.message) && /(column|schema cache|does not exist|42703)/i.test(pErr.message)) {
    const retry = await supabase.from('products').insert(stripChainLengths(insertPayload)).select('id').single()
    prod = retry.data
    pErr = retry.error
  }

  if ((pErr || !prod) && pErr?.message && /design_number/i.test(pErr.message)) {
    const { design_number: _dn, ...withoutDesign } = insertPayload
    const retry = await supabase.from('products').insert(withoutDesign).select('id').single()
    prod = retry.data
    pErr = retry.error
  }

  if (pErr || !prod) {
    console.error('[createCatalogProduct] product insert', pErr)
    return { ok: false, error: pErr?.message ?? 'Insert failed' }
  }

  const productId = prod.id
  const groupByColor = new Map<string, string>()

  for (let i = 0; i < body.color_variants.length; i++) {
    const cv = body.color_variants[i]!
    const { data: grp, error: gErr } = await insertProductColorGroup(supabase, {
      product_id: productId,
      color_id: cv.color_id,
      images: cv.images ?? [],
      videos: cv.videos ?? [],
      display_order: cv.display_order ?? i,
      is_active: cv.is_active ?? true,
    })
    if (gErr || !grp) {
      console.error('[createCatalogProduct] color group', gErr)
      await supabase.from('products').delete().eq('id', productId)
      return { ok: false, error: gErr?.message ?? 'Color group insert failed' }
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
    const metalWeight = parseOptionalGrams(cell.metal_weight_g)
    if (metalWeight == null || metalWeight <= 0) continue

    const meta = purityMeta[cell.purity_id]
    const breakdown = computeCatalogVariantPrice({
      metalWeightG: metalWeight,
      purityCode: String(meta?.code ?? pCode),
      metalType: meta?.metal,
      makingChargePct: prodInsert.making_charge_pct,
      stoneLines,
      goldPerGram,
      silverPerGram,
      diamondPricePerCarat: diamondPerCarat,
    })
    const snapshotPrice = readManualPriceOverride(cell.price) ?? breakdown?.finalPrice ?? 0

    variantRows.push({
      product_id: productId,
      color_group_id: gId,
      color_id: cell.color_id,
      purity_id: cell.purity_id,
      sku: generateAmioraSKU(catCode, prodInsert.product_number, String(pCode), String(cCode)),
      price: snapshotPrice,
      stock_qty: Math.max(0, Math.floor(cell.stock_qty ?? 3)),
      metal_weight_g: metalWeight,
      is_active: cell.is_active ?? true,
    })
  }

  if (variantRows.length === 0) {
    await supabase.from('products').delete().eq('id', productId)
    return { ok: false, error: 'No valid variant rows — check metal weights' }
  }

  const { data: insertedVariants, error: vErr } = await supabase
    .from('product_variants')
    .insert(variantRows)
    .select('id, color_id, purity_id')
  if (vErr) {
    console.error('[createCatalogProduct] variants', vErr)
    await supabase.from('products').delete().eq('id', productId)
    return { ok: false, error: vErr.message }
  }

  const variantMap = new Map<string, string>()
  for (const row of insertedVariants ?? []) {
    variantMap.set(`${row.color_id}:${row.purity_id}`, row.id)
  }

  if (body.size_stocks && body.size_stocks.length > 0) {
    const sizeSync = await syncProductVariantSizes(supabase, productId, body.size_stocks, variantMap)
    if (sizeSync.error) {
      console.error('[createCatalogProduct] size stocks', sizeSync.error)
      await supabase.from('products').delete().eq('id', productId)
      return { ok: false, error: sizeSync.error.message }
    }
  }

  const collectionIds = body.collection_ids ?? (
    body.product.collection_id ? [body.product.collection_id] : []
  )
  if (collectionIds.length > 0) {
    const { syncCollectionProducts } = await import('@/lib/syncCollectionProducts')
    const syncResult = await syncCollectionProducts(
      supabase,
      productId,
      collectionIds,
      body.product.collection_id ?? collectionIds[0] ?? null,
    )
    if (syncResult.error) {
      console.error('[createCatalogProduct] collection sync', syncResult.error)
    }
  }

  if (body.tag_ids && body.tag_ids.length > 0) {
    const { syncProductTags } = await import('@/lib/syncProductTags')
    const tagResult = await syncProductTags(supabase, productId, body.tag_ids)
    if (tagResult.error) {
      console.error('[createCatalogProduct] tag sync', tagResult.error)
    }
  }

  return { ok: true, productId }
}
