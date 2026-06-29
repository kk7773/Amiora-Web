import type { SupabaseClient } from '@supabase/supabase-js'

const GOLD_PURITY_ROWS = [
  { label: '22Kt Gold', code: '22', display_order: 1, metal: 'gold', is_active: true },
  { label: '18Kt Gold', code: '18', display_order: 2, metal: 'gold', is_active: true },
  { label: '14Kt Gold', code: '14', display_order: 3, metal: 'gold', is_active: true },
  { label: '9Kt Gold', code: '09', display_order: 4, metal: 'gold', is_active: true },
] as const

export async function ensureGoldMetalPurities(supabase: SupabaseClient) {
  const { error } = await supabase
    .from('metal_purities')
    .upsert(GOLD_PURITY_ROWS, { onConflict: 'code' })

  if (error) {
    console.error('[ensureGoldMetalPurities] upsert failed:', error.message)
  }
}
