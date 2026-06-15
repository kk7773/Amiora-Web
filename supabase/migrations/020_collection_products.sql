-- =============================================================================
-- AMIORA DIAMONDS — Manual collection membership (many-to-many)
-- =============================================================================

CREATE TABLE IF NOT EXISTS collection_products (
  collection_id  uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id     uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  display_order  integer NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  PRIMARY KEY (collection_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_products_product
  ON collection_products(product_id);

CREATE INDEX IF NOT EXISTS idx_collection_products_order
  ON collection_products(collection_id, display_order);

-- Backfill from existing single-FK assignments
INSERT INTO collection_products (collection_id, product_id, display_order)
SELECT collection_id, id, 0
FROM products
WHERE collection_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- RLS: public read, admin write (matches product_tags)
ALTER TABLE collection_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collection_products_public_read"
  ON collection_products FOR SELECT USING (true);

CREATE POLICY "collection_products_admin_write"
  ON collection_products FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());
