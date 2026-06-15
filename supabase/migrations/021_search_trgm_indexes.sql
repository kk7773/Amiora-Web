-- Faster ILIKE search for storefront autocomplete (pg_trgm).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON public.products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_slug_trgm
  ON public.products USING gin (slug gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_status_name
  ON public.products (status, name)
  WHERE status = 'active';
