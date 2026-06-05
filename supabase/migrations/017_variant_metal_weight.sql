-- Per-variant metal weight (grams) for each colour × purity combination.
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS metal_weight_g numeric(12, 4);

COMMENT ON COLUMN public.product_variants.metal_weight_g IS
  'Net metal weight in grams for this colour × purity variant';

-- Backfill from legacy product-level weight
UPDATE public.product_variants pv
SET metal_weight_g = p.metal_weight_g
FROM public.products p
WHERE pv.product_id = p.id
  AND pv.metal_weight_g IS NULL
  AND p.metal_weight_g IS NOT NULL;
