-- Per-variant optional overrides for making / gem discounts (NULL = inherit from product)
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS making_charge_discount_pct NUMERIC(5,2)
    CHECK (making_charge_discount_pct IS NULL OR (making_charge_discount_pct >= 0 AND making_charge_discount_pct <= 100)),
  ADD COLUMN IF NOT EXISTS gem_price_discount_pct NUMERIC(5,2)
    CHECK (gem_price_discount_pct IS NULL OR (gem_price_discount_pct >= 0 AND gem_price_discount_pct <= 100));

COMMENT ON COLUMN product_variants.making_charge_discount_pct IS
  'Optional % off making charge for this variant; NULL uses products.making_charge_discount_pct.';
COMMENT ON COLUMN product_variants.gem_price_discount_pct IS
  'Optional % off gem/stone for this variant; NULL uses products.gem_price_discount_pct.';
