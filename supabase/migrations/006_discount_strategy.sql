-- ─── Migration 006: Discount Strategy ────────────────────────────────────────
-- Discounts apply ONLY to making charges and/or gem/stone price.
-- Never on the metal price or overall order total.
--
-- Run AFTER: 004_coupons.sql and 001_initial_schema.sql (products table)

-- 1. Coupons: which price component the coupon discounts
ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS applies_to TEXT NOT NULL DEFAULT 'both'
    CHECK (applies_to IN ('making_charge', 'gem_price', 'both'));

-- 2. Products: permanent (product-level) component discounts
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS making_charge_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (making_charge_discount_pct >= 0 AND making_charge_discount_pct <= 100),
  ADD COLUMN IF NOT EXISTS gem_price_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (gem_price_discount_pct >= 0 AND gem_price_discount_pct <= 100);

COMMENT ON COLUMN coupons.applies_to IS
  'Which price component the coupon discounts: making_charge, gem_price, or both. Never the metal/total price.';

COMMENT ON COLUMN products.making_charge_discount_pct IS
  'Permanent % discount applied to making charges for this product (0 = no discount).';

COMMENT ON COLUMN products.gem_price_discount_pct IS
  'Permanent % discount applied to gem/stone price for this product (0 = no discount).';
