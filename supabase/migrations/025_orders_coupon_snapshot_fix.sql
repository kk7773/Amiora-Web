-- Align live orders schema with checkout order snapshots.
-- This migration is idempotent so it can be applied safely on projects
-- where 022 already ran partially or the schema drifted.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES coupons(id),
  ADD COLUMN IF NOT EXISTS coupon_code TEXT;

COMMENT ON COLUMN orders.coupon_id IS 'Applied coupon at checkout (server-validated)';
COMMENT ON COLUMN orders.coupon_code IS 'Snapshot of coupon code on order';
