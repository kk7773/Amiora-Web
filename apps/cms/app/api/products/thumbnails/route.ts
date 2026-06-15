import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@amiora/database'
import { requireCmsAccess } from '@/lib/rbac'

const MAX_IDS = 30

export async function GET(req: NextRequest) {
  const perm = await requireCmsAccess('products', 'view')
  if (perm.ok === false) return perm.response

  const raw = req.nextUrl.searchParams.get('ids') ?? ''
  const ids = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, MAX_IDS)

  if (ids.length === 0) {
    return NextResponse.json({ thumbnails: {} as Record<string, string | null> })
  }

  const supabase = createServerClient()
  const thumbnails: Record<string, string | null> = Object.fromEntries(ids.map((id) => [id, null]))

  const { data: images } = await supabase
    .from('product_images')
    .select('product_id, url, is_primary')
    .in('product_id', ids)
    .order('is_primary', { ascending: false })

  const seen = new Set<string>()
  for (const row of images ?? []) {
    if (seen.has(row.product_id)) continue
    if (row.url?.trim()) {
      thumbnails[row.product_id] = row.url.trim()
      seen.add(row.product_id)
    }
  }

  const missing = ids.filter((id) => !thumbnails[id])
  if (missing.length > 0) {
    const { data: groups } = await supabase
      .from('product_color_groups')
      .select('product_id, images, display_order, is_active')
      .in('product_id', missing)
      .order('display_order', { ascending: true })

    const byProduct: Record<string, typeof groups> = {}
    for (const g of groups ?? []) {
      if (g.is_active === false) continue
      if (!byProduct[g.product_id]) byProduct[g.product_id] = []
      byProduct[g.product_id]!.push(g)
    }

    for (const pid of missing) {
      const productGroups = byProduct[pid] ?? []
      for (const g of productGroups) {
        const url = g.images?.find((u) => typeof u === 'string' && u.trim())
        if (url) {
          thumbnails[pid] = url.trim()
          break
        }
      }
    }
  }

  return NextResponse.json({ thumbnails })
}
