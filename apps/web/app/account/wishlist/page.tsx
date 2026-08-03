import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link         from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { WishlistGrid } from '@/components/account/WishlistGrid'
import { fetchPurityMapForProducts } from '@/lib/pricing/fetchPurityMap'
import { getLatestPrices } from '@/lib/pricing/engine'
import { PRODUCT_CARD_SELECT_LITE } from '@/lib/shop/fetchProductCards'
import { mapProductForCard, PRODUCT_CARD_SELECT, type ProductCardRaw } from '@/lib/shop/mapProductForCard'

export const metadata: Metadata = { title: 'My Wishlist' }

export default async function WishlistPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let wishlistRows = await supabase
    .from('wishlists')
    .select(`*, product:products(${PRODUCT_CARD_SELECT})`)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (wishlistRows.error) {
    wishlistRows = await supabase
      .from('wishlists')
      .select(`*, product:products(${PRODUCT_CARD_SELECT_LITE})`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
  }

  const [{ data: wishlists }, prices] = await Promise.all([
    Promise.resolve(wishlistRows),
    getLatestPrices().catch(() => ({ gold: null, silver: null, diamond: null, goldPurityRates: {} })),
  ])

  const gold   = prices.gold?.pricePerGram ?? 7200
  const silver = prices.silver?.pricePerGram ?? 90
  const diamond = prices.diamond?.pricePerGram ?? 0
  const goldPurityRates = prices.goldPurityRates ?? {}

  const rawProducts = (wishlists ?? []).map((w) => w.product).filter(Boolean)
  const purityMap = await fetchPurityMapForProducts(supabase, rawProducts)

  const products = rawProducts.map((p) =>
    mapProductForCard(p as ProductCardRaw, gold, silver, purityMap, diamond, goldPurityRates),
  ) as Parameters<typeof WishlistGrid>[0]['products']

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-display-xl text-ink">My Wishlist</h1>
        <p className="text-sm text-ink-muted">{products.length} items</p>
      </div>
      {products.length === 0 ? (
        <div className="py-20 text-center space-y-4">
          <p className="font-display text-xl text-ink-muted">Your wishlist is empty</p>
          <p className="text-sm text-ink-faint">Save items you love and come back later.</p>
          <Link href="/shop" className="inline-block bg-deep-teal text-cream px-8 py-3 text-sm uppercase tracking-widest rounded-xl hover:bg-teal transition-colors">
            Start Shopping
          </Link>
        </div>
      ) : (
        <WishlistGrid products={products} />
      )}
    </div>
  )
}
