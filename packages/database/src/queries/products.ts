import type { SupabaseClient } from '../client'
import type { PaginationParams } from '@amiora/types'

export async function getProducts(
  client: SupabaseClient,
  params: PaginationParams & {
    category?: string
    collectionId?: string
    isFeatured?: boolean
    isNewArrival?: boolean
    isBestSeller?: boolean
    isComingSoon?: boolean
    status?: string
  } = {}
) {
  const { page = 1, pageSize = 20, sortBy = 'created_at', sortOrder = 'desc', search } = params

  let query = client
    .from('products')
    .select(
      `
      *,
      product_variants (*),
      product_images: product_images (*),
      collections (id, name, slug)
    `,
      { count: 'exact' }
    )

  if (params.category) query = query.eq('category', params.category)
  if (params.collectionId) query = query.eq('collection_id', params.collectionId)
  if (params.isFeatured !== undefined) query = query.eq('is_featured', params.isFeatured)
  if (params.isNewArrival !== undefined) query = query.eq('is_new_arrival', params.isNewArrival)
  if (params.isBestSeller !== undefined) query = query.eq('is_best_seller', params.isBestSeller)
  if (params.isComingSoon !== undefined) query = query.eq('is_coming_soon', params.isComingSoon)
  if (params.status) query = query.eq('status', params.status)
  if (search) query = query.ilike('name', `%${search}%`)

  query = query
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range((page - 1) * pageSize, page * pageSize - 1)

  return query
}

export async function getProductBySlug(client: SupabaseClient, slug: string) {
  return client
    .from('products')
    .select(
      `
      *,
      product_variants (*),
      product_images: product_images (*),
      gemstones (*),
      reviews (*)
    `
    )
    .eq('slug', slug)
    .eq('status', 'active')
    .single()
}

export async function getFeaturedProducts(client: SupabaseClient, limit = 8) {
  return client
    .from('products')
    .select(`*, product_variants (*), product_images: product_images (*)`)
    .eq('is_featured', true)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit)
}

export async function getNewArrivals(client: SupabaseClient, limit = 8) {
  return client
    .from('products')
    .select(`*, product_variants (*), product_images: product_images (*)`)
    .eq('is_new_arrival', true)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit)
}

export async function searchProducts(client: SupabaseClient, query: string, limit = 10) {
  return client
    .from('products')
    .select(`id, slug, name, category, product_images: product_images (url, alt_text)`)
    .or(`name.ilike.%${query}%, tags.cs.{${query}}`)
    .eq('status', 'active')
    .limit(limit)
}

export async function upsertProduct(
  client: SupabaseClient,
  data: Database['public']['Tables']['products']['Insert']
) {
  return client.from('products').upsert(data).select().single()
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Database = import('../types/supabase').Database
