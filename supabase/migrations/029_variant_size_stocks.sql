BEGIN;

CREATE TABLE IF NOT EXISTS public.product_variant_sizes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id    uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  size_label    text NOT NULL,
  size_type     text NOT NULL CHECK (size_type IN ('ring_us', 'chain_inch')),
  stock_qty     integer NOT NULL DEFAULT 0,
  price_override numeric(12,2),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_variant_sizes_variant_size_uq
  ON public.product_variant_sizes (variant_id, size_label, size_type);

ALTER TABLE public.product_variant_sizes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_pvs ON public.product_variant_sizes;
CREATE POLICY public_read_pvs
  ON public.product_variant_sizes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS admin_all_pvs ON public.product_variant_sizes;
CREATE POLICY admin_all_pvs
  ON public.product_variant_sizes FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS trg_product_variant_sizes_updated_at ON public.product_variant_sizes;
CREATE TRIGGER trg_product_variant_sizes_updated_at
  BEFORE UPDATE ON public.product_variant_sizes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMIT;
