import { createServerClient } from '@amiora/database'
import { ProductCatalogCreateForm } from '@/components/forms/ProductCatalogCreateForm'
import { ensureGoldMetalPurities } from '@/lib/ensureMetalPurities'
import { fetchCmsPricingContext } from '@/lib/fetchCmsPricingContext'

export default async function NewProductPage() {
  const supabase = createServerClient()
  await ensureGoldMetalPurities(supabase)
  const pricingContext = await fetchCmsPricingContext(supabase)

  const [{ data: collections }, { data: categories }, { data: tags }, { data: metalColors }, { data: metalPurities }, { data: settingsRows }] =
    await Promise.all([
      supabase.from('collections').select('id, name').eq('is_active', true).order('sort_order'),
      supabase
        .from('categories')
        .select('id, name, code')
        .eq('is_active', true)
        .order('sort_order'),
      supabase.from('tags').select('id, name, color').eq('is_active', true).order('sort_order'),
      supabase
        .from('metal_colors')
        .select('id, label, code, hex, display_order')
        .eq('is_active', true)
        .order('display_order'),
      supabase
        .from('metal_purities')
        .select('id, label, code, display_order, metal')
        .eq('is_active', true)
        .order('display_order'),
      supabase
        .from('site_settings')
        .select('key, value')
        .eq('key', 'making_charge_pct')
    ])

  const makingChargeSetting = settingsRows?.[0]?.value
  const defaultMakingChargePct = Number(makingChargeSetting ?? 8)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl text-deep-teal">New product (colour × purity)</h2>
        <p className="text-sm text-ink-muted mt-0.5">Create a SKU matrix with Cloudinary images per colour.</p>
      </div>
      <ProductCatalogCreateForm
        collections={collections ?? []}
        tags={tags ?? []}
      categories={(categories ?? []) as Parameters<typeof ProductCatalogCreateForm>[0]['categories']}
      metalColors={(metalColors ?? []) as Parameters<typeof ProductCatalogCreateForm>[0]['metalColors']}
      metalPurities={(metalPurities ?? []) as Parameters<typeof ProductCatalogCreateForm>[0]['metalPurities']}
      defaultMakingChargePct={Number.isFinite(defaultMakingChargePct) ? defaultMakingChargePct : 8}
      pricingContext={pricingContext}
    />
  </div>
  )
}
