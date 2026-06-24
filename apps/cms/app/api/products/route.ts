import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { buildDbProductRow } from '@/lib/productPayload'
import { normalizeStoneLines } from '@/lib/normalizeStoneLines'
import { requireCmsAccess, writeAuditLog } from '@/lib/rbac'

export async function POST(req: NextRequest) {
  const perm = await requireCmsAccess('products', 'edit')
  if (perm.ok === false) return perm.response
  try {
    const supabase = createServerClient()
    const { images, variants, full_description, tag_ids, faqs, ...rest } = await req.json()

    // Map form field → DB column
    const product = {
      ...rest,
      ...(full_description !== undefined && { description: full_description }),
      faqs: Array.isArray(faqs) ? faqs.filter((f: { question: string; answer: string }) => f.question && f.answer) : [],
      ...(Array.isArray((rest as { stone_lines?: unknown }).stone_lines)
        ? { stone_lines: normalizeStoneLines((rest as { stone_lines?: unknown }).stone_lines) }
        : {}),
    }

    const dbProduct = buildDbProductRow(product as Record<string, unknown>)

    const { data: prod, error } = await supabase
      .from('products')
      .insert(dbProduct)
      .select()
      .single()

    if (error) {
      console.error('[POST /api/products] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (images?.length) {
      const { error: imgErr } = await supabase.from('product_images').insert(
        images.map((img: { url: string; is_primary: boolean }, i: number) => ({
          product_id: prod.id,
          url:        img.url,
          is_primary: img.is_primary,
          sort_order: i,
        }))
      )
      if (imgErr) console.error('[POST /api/products] image insert error:', imgErr)
    }

    if (variants?.length) {
      const { error: varErr } = await supabase.from('product_variants').insert(
        (variants as Record<string, unknown>[]).map((v) => ({
          product_id:                 prod.id,
          purity:                     (v.purity as string) ?? '18K',
          weight_grams:               (v.weight_grams as number) ?? 0,
          gem_weight_ct:            v.gem_weight_ct ?? null,
          gem_price_override:         v.gem_price_inr ?? null,
          stock_status:               (v.stock_status as string) ?? 'in_stock',
          making_charge_discount_pct: v.making_charge_discount_pct ?? null,
          gem_price_discount_pct:     v.gem_price_discount_pct ?? null,
        }))
      )
      if (varErr) console.error('[POST /api/products] variant insert error:', varErr)
    }

    // Insert product → tag associations
    if (Array.isArray(tag_ids) && tag_ids.length > 0) {
      const { error: tagErr } = await supabase.from('product_tags').insert(
        tag_ids.map((tag_id: string) => ({ product_id: prod.id, tag_id }))
      )
      if (tagErr) console.error('[POST /api/products] tag insert error:', tagErr)
    }

    await writeAuditLog({ adminId: perm.adminId, action: 'create_product', resource: 'products', resourceId: prod.id })
    return NextResponse.json({ data: prod }, { status: 201 })
  } catch (err: unknown) {
    console.error('[POST /api/products] Unexpected error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
