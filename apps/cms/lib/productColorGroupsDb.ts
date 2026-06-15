import type { SupabaseClient } from '@supabase/supabase-js'

export type ColorGroupWriteFields = {
  color_id: string
  images: string[]
  videos?: string[]
  display_order: number
  is_active?: boolean
}

function baseFields(fields: ColorGroupWriteFields) {
  return {
    color_id: fields.color_id,
    images: fields.images ?? [],
    display_order: fields.display_order,
    is_active: fields.is_active ?? true,
  }
}

function isVideosColumnMissing(message: string) {
  return /videos/i.test(message) && /(column|schema cache|does not exist)/i.test(message)
}

export async function insertProductColorGroup(
  supabase: SupabaseClient,
  payload: ColorGroupWriteFields & { product_id: string },
) {
  const full = {
    product_id: payload.product_id,
    ...baseFields(payload),
    videos: payload.videos ?? [],
  }
  const first = await supabase.from('product_color_groups').insert(full).select('id, color_id').single()
  if (!first.error) return first

  if (isVideosColumnMissing(first.error.message)) {
    const { videos: _videos, ...withoutVideos } = full
    return supabase.from('product_color_groups').insert(withoutVideos).select('id, color_id').single()
  }
  return first
}

export async function updateProductColorGroup(
  supabase: SupabaseClient,
  payload: ColorGroupWriteFields & { id: string; product_id: string },
) {
  const full = {
    ...baseFields(payload),
    videos: payload.videos ?? [],
  }
  const first = await supabase
    .from('product_color_groups')
    .update(full)
    .eq('id', payload.id)
    .eq('product_id', payload.product_id)

  if (!first.error) return first

  if (isVideosColumnMissing(first.error.message)) {
    const { videos: _videos, ...withoutVideos } = full
    return supabase
      .from('product_color_groups')
      .update(withoutVideos)
      .eq('id', payload.id)
      .eq('product_id', payload.product_id)
  }
  return first
}
