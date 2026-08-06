BEGIN;

ALTER TABLE public.product_variants
  ALTER COLUMN stock_qty SET DEFAULT 3;

ALTER TABLE public.product_variant_sizes
  ALTER COLUMN stock_qty SET DEFAULT 3;

UPDATE public.product_variants
SET stock_qty = 3;

UPDATE public.product_variant_sizes
SET stock_qty = 3;

COMMIT;
