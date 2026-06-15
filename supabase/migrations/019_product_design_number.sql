-- Merchant-facing design / style reference per product (e.g. AMI-2041).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS design_number text;

COMMENT ON COLUMN public.products.design_number IS 'Internal design or style number shown on CMS and PDP';

CREATE INDEX IF NOT EXISTS idx_products_design_number
  ON public.products (design_number)
  WHERE design_number IS NOT NULL;
