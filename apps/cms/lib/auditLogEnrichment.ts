import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AuditLink, ResourceSnapshot } from '@/lib/auditLogTypes'
import { getStorefrontUrl } from '@/lib/storefrontUrl'

export type { AuditLink, ResourceSnapshot } from '@/lib/auditLogTypes'
export { formatMetaEntries, META_FIELD_LABELS } from '@/lib/auditLogTypes'

export type EnrichedAuditLog = {
  links: AuditLink[]
  snapshot: ResourceSnapshot | null
  snapshotMissing: boolean
}

function storefrontBase(): string {
  return getStorefrontUrl()
}

function adminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function enrichAuditLog(log: {
  action: string
  resource: string | null
  resource_id: string | null
}): Promise<EnrichedAuditLog> {
  const links: AuditLink[] = []
  let snapshot: ResourceSnapshot | null = null
  let snapshotMissing = false

  if (!log.resource_id) {
    return { links, snapshot, snapshotMissing }
  }

  const ac = adminClient()
  const id = log.resource_id
  const shop = storefrontBase()
  const isDelete = log.action.startsWith('delete_')

  if (log.resource === 'products' && log.resource_id) {
    const { data: product } = await ac
      .from('products')
      .select('id, name, slug, status, design_number')
      .eq('id', id)
      .maybeSingle()

    if (product) {
      snapshot = {
        type: 'product',
        id: product.id,
        name: product.name,
        slug: product.slug,
        status: product.status,
        design_number: product.design_number,
      }
      links.push({
        kind: 'cms',
        label: 'Edit in CMS',
        href: `/products/${product.id}`,
      })
      if (!isDelete) {
        const draft = product.status !== 'active'
        links.push({
          kind: 'storefront',
          label: draft ? 'Preview on website (draft)' : 'View on website',
          href: `${shop}/products/${product.slug}`,
          external: true,
          note: draft
            ? 'Product is draft — publish first to show on shop listings. Direct link may not open until active.'
            : 'Opens the live product page on the storefront.',
        })
      }
    } else if (!isDelete) {
      snapshotMissing = true
    }
  }

  if (
    log.resource === 'collections' &&
    log.resource_id &&
    log.action.includes('collection') &&
    !log.action.includes('category')
  ) {
    const { data: col } = await ac
      .from('collections')
      .select('id, name, slug, is_active')
      .eq('id', id)
      .maybeSingle()

    if (col) {
      snapshot = {
        type: 'collection',
        id: col.id,
        name: col.name,
        slug: col.slug,
        is_active: col.is_active,
      }
      links.push({
        kind: 'cms',
        label: 'Manage in CMS',
        href: '/collections',
      })
      if (!isDelete) {
        links.push({
          kind: 'storefront',
          label: col.is_active ? 'View collection on website' : 'View collection (inactive)',
          href: `${shop}/shop/${col.slug}`,
          external: true,
          note: col.is_active
            ? 'Opens the collection page on the storefront.'
            : 'Collection is inactive — may not appear in shop navigation.',
        })
      }
    } else if (!isDelete) {
      snapshotMissing = true
    }
  }

  if (log.resource === 'blogs' && log.resource_id) {
    const { data: blog } = await ac
      .from('blogs')
      .select('id, title, slug, status')
      .eq('id', id)
      .maybeSingle()

    if (blog) {
      snapshot = {
        type: 'blog',
        id: blog.id,
        title: blog.title,
        slug: blog.slug,
        status: blog.status,
      }
      links.push({ kind: 'cms', label: 'Edit in CMS', href: '/blogs' })
      if (!isDelete) {
        links.push({
          kind: 'storefront',
          label: 'View blog on website',
          href: `${shop}/blogs/${blog.slug}`,
          external: true,
        })
      }
    } else if (!isDelete) {
      snapshotMissing = true
    }
  }

  if (log.resource === 'orders' && log.resource_id) {
    const { data: order } = await ac
      .from('orders')
      .select('id, order_number, status')
      .eq('id', id)
      .maybeSingle()

    if (order) {
      snapshot = {
        type: 'order',
        id: order.id,
        order_number: order.order_number,
        status: order.status,
      }
      links.push({
        kind: 'cms',
        label: 'View order in CMS',
        href: `/orders/${order.id}`,
      })
    } else {
      snapshotMissing = true
    }
  }

  return { links, snapshot, snapshotMissing }
}
