import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { buildDbProductRow } from '@/lib/productPayload'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const supabase = createServerClient()
    const { images, variants, full_description, tag_ids, faqs, ...rest } = await req.json()

    // Map form field → DB column
    const product = {
      ...rest,
      ...(full_description !== undefined && { description: full_description }),
      ...(Array.isArray(faqs) && { faqs: faqs.filter((f: { question: string; answer: string }) => f.question && f.answer) }),
    }

    const dbProduct = buildDbProductRow(product as Record<string, unknown>)

    const { data, error } = await supabase
      .from('products')
      .update(dbProduct)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[PATCH /api/products] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Replace images
    if (Array.isArray(images)) {
      await supabase.from('product_images').delete().eq('product_id', id)
      if (images.length) {
        const { error: imgErr } = await supabase.from('product_images').insert(
          images.map((img: { url: string; is_primary: boolean }, i: number) => ({
            product_id: id,
            url:        img.url,
            is_primary: img.is_primary,
            sort_order: i,
          }))
        )
        if (imgErr) console.error('[PATCH /api/products] image insert error:', imgErr)
      }
    }

    // Replace tags — delete existing then re-insert selected
    if (Array.isArray(tag_ids)) {
      await supabase.from('product_tags').delete().eq('product_id', id)
      if (tag_ids.length > 0) {
        const { error: tagErr } = await supabase.from('product_tags').insert(
          tag_ids.map((tag_id: string) => ({ product_id: id, tag_id }))
        )
        if (tagErr) console.error('[PATCH /api/products] tag insert error:', tagErr)
      }
    }

    if (Array.isArray(variants)) {
      const { data: existingRows, error: exErr } = await supabase
        .from('product_variants')
        .select('id')
        .eq('product_id', id)
      if (exErr) console.error('[PATCH /api/products] variant list error:', exErr)
      const existingIds = new Set((existingRows ?? []).map((r: { id: string }) => r.id))
      type V = {
        id?: string
        purity?: string
        weight_grams?: number
        gem_weight_ct?: number | null
        gem_price_inr?: number | null
        stock_status?: string
        making_charge_discount_pct?: number | null
        gem_price_discount_pct?: number | null
      }
      const list = variants as V[]
      const keepIds = new Set(list.map((v) => v.id).filter((x): x is string => Boolean(x)))
      for (const eid of existingIds) {
        if (!keepIds.has(eid)) {
          const { error: delErr } = await supabase
            .from('product_variants')
            .delete()
            .eq('id', eid)
            .eq('product_id', id)
          if (delErr) console.error('[PATCH /api/products] variant delete error:', delErr)
        }
      }
      for (const v of list) {
        const row = {
          product_id: id,
          purity: (v.purity as string) ?? '18K',
          weight_grams: (v.weight_grams as number) ?? 0,
          gem_weight_ct: v.gem_weight_ct ?? null,
          gem_price_override: v.gem_price_inr ?? null,
          stock_status: (v.stock_status as string) ?? 'in_stock',
          making_charge_discount_pct: v.making_charge_discount_pct ?? null,
          gem_price_discount_pct: v.gem_price_discount_pct ?? null,
        }
        if (v.id) {
          const { error: upErr } = await supabase
            .from('product_variants')
            .update(row)
            .eq('id', v.id)
            .eq('product_id', id)
          if (upErr) console.error('[PATCH /api/products] variant update error:', upErr)
        } else {
          const { error: insErr } = await supabase.from('product_variants').insert(row)
          if (insErr) console.error('[PATCH /api/products] variant insert error:', insErr)
        }
      }
    }

    return NextResponse.json({ data })
  } catch (err: unknown) {
    console.error('[PATCH /api/products] Unexpected error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const supabase = createServerClient()
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
