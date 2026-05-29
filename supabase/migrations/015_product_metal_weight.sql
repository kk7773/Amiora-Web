-- Net metal weight for the piece (grams), same for all purities of that product.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS metal_weight_g numeric(12, 4);

COMMENT ON COLUMN public.products.metal_weight_g IS 'Product-level metal weight in grams (gold or silver)';
