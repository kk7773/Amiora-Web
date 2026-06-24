import type { MetalType, MetalPurity, CalculatedPrice } from './pricing'

export type ProductStatus = 'active' | 'draft' | 'archived' | 'out_of_stock'
export type ProductCategory =
  | 'rings'
  | 'necklaces'
  | 'earrings'
  | 'bangles'
  | 'pendants'
  | 'chains'
  | 'anklets'
  | 'sets'

export type GemstoneType =
  | 'diamond'
  | 'ruby'
  | 'emerald'
  | 'sapphire'
  | 'pearl'
  | 'moissanite'
  | 'none'

export interface ProductImage {
  id: string
  url: string
  altText: string
  position: number
  isPrimary: boolean
}

export interface Gemstone {
  type: GemstoneType
  caratWeight: number
  quality: string
  count: number
  certificationNumber?: string
}

export interface ProductVariant {
  id: string
  productId: string
  sku: string
  size?: string
  metalType: MetalType
  metalPurity: MetalPurity
  grossWeight: number
  netWeight: number
  stoneWeight: number
  stockQuantity: number
  reservedQuantity: number
  isAvailable: boolean
  additionalPrice: number
  images?: ProductImage[]
}

export interface Product {
  id: string
  slug: string
  name: string
  description: string
  shortDescription: string
  category: ProductCategory
  subcategory?: string
  collectionId?: string
  status: ProductStatus
  isFeatured: boolean
  isNewArrival: boolean
  isBestseller: boolean
  tags: string[]
  gemstones: Gemstone[]
  variants: ProductVariant[]
  images: ProductImage[]
  seoTitle?: string
  seoDescription?: string
  createdAt: string
  updatedAt: string
}

export interface ProductWithPrice extends Product {
  livePrice?: CalculatedPrice
  variantPrices?: Record<string, CalculatedPrice>
}

export interface Collection {
  id: string
  slug: string
  name: string
  description: string
  coverImage: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}
