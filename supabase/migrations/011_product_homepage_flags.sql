-- Add homepage selection flags on products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_new_arrival boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_best_seller boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_coming_soon boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_is_new_arrival ON products (is_new_arrival);
CREATE INDEX IF NOT EXISTS idx_products_is_best_seller ON products (is_best_seller);
CREATE INDEX IF NOT EXISTS idx_products_is_coming_soon ON products (is_coming_soon);
