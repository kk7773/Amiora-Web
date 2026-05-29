-- Optional multi-row stone breakdown for catalog products (CMS).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS has_stone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stone_lines jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.products.has_stone IS 'CMS: product includes gemstone(s) — show stone detail table when true';
COMMENT ON COLUMN public.products.stone_lines IS 'CMS: [{ name, cut_size, rate_inr }]';
