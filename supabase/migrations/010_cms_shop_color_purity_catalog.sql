-- ============================================================================
-- 010: AMIORA CMS — Color × Purity catalog (DESTRUCTIVE on legacy variants)
-- WARNING:
-- - Drops legacy product_variants/product_sizes chains.
-- - Sets order_items.variant_id / wishlists.variant_id NULL to preserve FK graph.
-- - Optional block below clears catalog rows — uncomment before apply if desired.
-- Test on staging; backup production before applying.
-- Requires: public.handle_updated_at, public.is_admin() from earlier migrations.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- OPTIONAL: wipe catalog rows (keeps orders; nulls variants already handled)
-- ---------------------------------------------------------------------------
-- DELETE FROM public.product_images;
-- DELETE FROM public.smart_pairs;
-- DELETE FROM public.product_tags;
-- DELETE FROM public.reviews;
-- DELETE FROM public.wishlists;
-- DELETE FROM public.products;


-- ---------------------------------------------------------------------------
-- 1) Tear down legacy variant model + dependents
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS public_read_pv  ON public.product_variants;
DROP POLICY IF EXISTS admin_all_pv    ON public.product_variants;
DROP POLICY IF EXISTS public_read_ps  ON public.product_sizes;
DROP POLICY IF EXISTS admin_all_ps   ON public.product_sizes;

UPDATE public.order_items SET variant_id = NULL WHERE variant_id IS NOT NULL;
UPDATE public.wishlists   SET variant_id = NULL WHERE variant_id IS NOT NULL;

DROP TABLE IF EXISTS public.product_sizes CASCADE;

DROP POLICY IF EXISTS public_read_pi ON public.product_images;
DROP POLICY IF EXISTS admin_all_pi   ON public.product_images;
ALTER TABLE public.product_images DROP CONSTRAINT IF EXISTS product_images_variant_id_fkey;
ALTER TABLE public.product_images DROP COLUMN IF EXISTS variant_id;

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read_pi ON public.product_images;
DROP POLICY IF EXISTS admin_all_pi   ON public.product_images;
CREATE POLICY public_read_pi ON public.product_images FOR SELECT USING (true);
CREATE POLICY admin_all_pi   ON public.product_images FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TABLE IF EXISTS public.product_variants CASCADE;


-- ---------------------------------------------------------------------------
-- 2) Masters: metal_purities, metal_colors
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metal_purities (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label          text NOT NULL,
  code           text NOT NULL,
  display_order  integer NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT metal_purities_label_unique UNIQUE (label),
  CONSTRAINT metal_purities_code_unique UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS public.metal_colors (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label          text NOT NULL,
  code           text NOT NULL,
  hex            text,
  display_order  integer NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT metal_colors_label_unique UNIQUE (label),
  CONSTRAINT metal_colors_code_unique UNIQUE (code)
);

ALTER TABLE public.metal_purities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metal_colors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_read_active_metal_purities ON public.metal_purities;
CREATE POLICY store_read_active_metal_purities
  ON public.metal_purities FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS admin_all_metal_purities ON public.metal_purities;
CREATE POLICY admin_all_metal_purities
  ON public.metal_purities FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS store_read_active_metal_colors ON public.metal_colors;
CREATE POLICY store_read_active_metal_colors
  ON public.metal_colors FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS admin_all_metal_colors ON public.metal_colors;
CREATE POLICY admin_all_metal_colors
  ON public.metal_colors FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ---------------------------------------------------------------------------
-- 3) categories — extend legacy table (parent_id unchanged from 003)
-- ---------------------------------------------------------------------------
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS code           text,
  ADD COLUMN IF NOT EXISTS display_order  integer DEFAULT 0;

UPDATE public.categories
SET display_order = COALESCE(NULLIF(display_order, 0), sort_order, 0);

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_code_unique;
ALTER TABLE public.categories ADD CONSTRAINT categories_code_unique UNIQUE (code);

INSERT INTO public.categories (name, slug, description, sort_order, display_order, is_active, code)
VALUES
  ('Bracelet',      'bracelets',      NULL, 1, 1, true, 'BR'),
  ('Ring',          'rings',          NULL, 2, 2, true, 'RN'),
  ('Earring',       'earrings',       NULL, 3, 3, true, 'ER'),
  ('Necklace',      'necklaces',      NULL, 4, 4, true, 'NK'),
  ('Bangle',        'bangles',        NULL, 5, 5, true, 'BG'),
  ('Pendent',       'pendants',       NULL, 6, 6, true, 'PD'),
  ('Chain',         'chains',         NULL, 7, 7, true, 'CN'),
  ('Payel',         'payels',         NULL, 8, 8, true, 'PL'),
  ('Mangal Sutra',  'mangal-sutras',  NULL, 9, 9, true, 'MS'),
  ('NosePin',       'nosepins',       NULL,10,10, true, 'NP')
ON CONFLICT (slug) DO UPDATE SET
  name           = EXCLUDED.name,
  code           = EXCLUDED.code,
  display_order  = EXCLUDED.display_order,
  sort_order     = EXCLUDED.sort_order,
  is_active      = EXCLUDED.is_active;


-- ---------------------------------------------------------------------------
-- 4) products — reshape (migrate is_active → status; short_description → short_desc)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS public_read_products ON public.products;
DROP POLICY IF EXISTS admin_all_products   ON public.products;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS status text
  CHECK (status IN ('draft', 'active', 'archived'));
UPDATE public.products
SET status = CASE WHEN COALESCE(is_active, false) THEN 'active' ELSE 'draft' END
WHERE status IS NULL;
UPDATE public.products SET status = 'draft' WHERE status IS NULL;
ALTER TABLE public.products ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE public.products ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS short_desc text;
UPDATE public.products
SET short_desc = short_description
WHERE short_description IS NOT NULL AND (short_desc IS NULL OR short_desc = '');

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_number integer;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY category_id ORDER BY created_at ASC NULLS LAST, id ASC
         ) AS rn
  FROM public.products
  WHERE category_id IS NOT NULL
)
UPDATE public.products p
SET product_number = ranked.rn
FROM ranked WHERE p.id = ranked.id;

UPDATE public.products SET product_number = COALESCE(product_number, 1);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_sku_key,
  DROP COLUMN IF EXISTS sku,
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS sort_order,
  DROP COLUMN IF EXISTS short_description;

ALTER TABLE public.products ALTER COLUMN product_number SET NOT NULL;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS diamond_shape   text,
  ADD COLUMN IF NOT EXISTS diamond_count   integer,
  ADD COLUMN IF NOT EXISTS total_diamond_wt numeric(8, 3),
  ADD COLUMN IF NOT EXISTS diamond_color   text,
  ADD COLUMN IF NOT EXISTS diamond_clarity text,
  ADD COLUMN IF NOT EXISTS size_range      text;

DROP INDEX IF EXISTS idx_products_active;

CREATE INDEX IF NOT EXISTS idx_products_status
  ON public.products (status) WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uq_products_category_number
  ON public.products (category_id, product_number)
  WHERE category_id IS NOT NULL;

DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_read_products_active ON public.products;
CREATE POLICY store_read_products_active
  ON public.products FOR SELECT
  USING (status = 'active');

DROP POLICY IF EXISTS admin_all_products_write ON public.products;
CREATE POLICY admin_all_products_write
  ON public.products FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ---------------------------------------------------------------------------
-- 5) product_color_groups
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_color_groups (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  color_id       uuid NOT NULL REFERENCES public.metal_colors (id),
  images         text[] NOT NULL DEFAULT '{}',
  display_order  integer NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, color_id)
);

CREATE INDEX IF NOT EXISTS idx_pcg_product ON public.product_color_groups (product_id);

ALTER TABLE public.product_color_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_read_active_pcg ON public.product_color_groups;
CREATE POLICY store_read_active_pcg
  ON public.product_color_groups FOR SELECT
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_color_groups.product_id AND p.status = 'active'
    )
  );

DROP POLICY IF EXISTS admin_all_pcg ON public.product_color_groups;
CREATE POLICY admin_all_pcg
  ON public.product_color_groups FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ---------------------------------------------------------------------------
-- 6) product_variants — color × purity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_variants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  color_group_id  uuid NOT NULL REFERENCES public.product_color_groups (id) ON DELETE CASCADE,
  color_id        uuid NOT NULL REFERENCES public.metal_colors (id),
  purity_id       uuid NOT NULL REFERENCES public.metal_purities (id),
  sku             text NOT NULL UNIQUE,
  price           numeric(12, 2) NOT NULL,
  stock_qty       integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, color_id, purity_id)
);

CREATE INDEX IF NOT EXISTS idx_pv_prod ON public.product_variants (product_id);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_read_active_pv ON public.product_variants;
CREATE POLICY store_read_active_pv
  ON public.product_variants FOR SELECT
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_variants.product_id AND p.status = 'active'
    )
  );

DROP POLICY IF EXISTS admin_all_pv ON public.product_variants;
CREATE POLICY admin_all_pv
  ON public.product_variants FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


ALTER TABLE public.wishlists DROP CONSTRAINT IF EXISTS wishlists_variant_id_fkey;
ALTER TABLE public.wishlists
  ADD CONSTRAINT wishlists_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES public.product_variants (id) ON DELETE SET NULL;

ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_variant_id_fkey;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES public.product_variants (id) ON DELETE SET NULL;


-- ---------------------------------------------------------------------------
-- 7) Seed masters
-- ---------------------------------------------------------------------------
INSERT INTO public.metal_purities (label, code, display_order) VALUES
  ('18Kt Gold', '18', 1),
  ('14Kt Gold', '14', 2),
  ('9Kt Gold',  '09', 3)
ON CONFLICT (code) DO UPDATE SET
  label         = EXCLUDED.label,
  display_order = EXCLUDED.display_order;

INSERT INTO public.metal_colors (label, code, hex, display_order) VALUES
  ('Yellow Gold', 'YG', '#E8C97A', 1),
  ('White Gold',  'WG', '#E0E0E0', 2),
  ('Rose Gold',   'RG', '#E8A598', 3)
ON CONFLICT (code) DO UPDATE SET
  label         = EXCLUDED.label,
  hex           = EXCLUDED.hex,
  display_order = EXCLUDED.display_order;

COMMIT;
