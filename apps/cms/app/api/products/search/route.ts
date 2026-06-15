import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess } from '@/lib/rbac'

export async function GET(req: NextRequest) {
  const perm = await requireCmsAccess('products', 'view')
  if (perm.ok === false) return perm.response

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(30, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '15', 10) || 15))
  const excludeRaw = req.nextUrl.searchParams.get('excludeIds') ?? ''
  const excludeIds = excludeRaw.split(',').map((s) => s.trim()).filter(Boolean)

  if (q.length < 1) {
    return NextResponse.json({ products: [] })
  }

  const supabase = createServerClient()
  const pattern = `%${q.replace(/[%_]/g, '')}%`

  let query = supabase
    .from('products')
    .select('id, name, slug, design_number, product_number, status')
    .or(`name.ilike.${pattern},slug.ilike.${pattern},design_number.ilike.${pattern}`)
    .order('name', { ascending: true })
    .limit(limit)

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const numMatch = /^\d+$/.test(q) ? parseInt(q, 10) : null
  let rows = data ?? []

  if (numMatch != null) {
    const { data: numRows } = await supabase
      .from('products')
      .select('id, name, slug, design_number, product_number, status')
      .eq('product_number', numMatch)
      .limit(limit)

    const seen = new Set(rows.map((r) => r.id))
    for (const r of numRows ?? []) {
      if (!seen.has(r.id) && !excludeIds.includes(r.id)) {
        rows.push(r)
        seen.add(r.id)
      }
    }
  }

  const products = rows.slice(0, limit).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    design_number: row.design_number,
    product_number: row.product_number,
    status: row.status,
    image_url: null,
  }))

  return NextResponse.json({ products })
}
