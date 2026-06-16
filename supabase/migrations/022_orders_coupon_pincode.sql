-- Orders: persist applied coupon
-- Addresses: district for pincode auto-fill

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES coupons(id),
  ADD COLUMN IF NOT EXISTS coupon_code TEXT;

ALTER TABLE addresses
  ADD COLUMN IF NOT EXISTS district TEXT;

COMMENT ON COLUMN orders.coupon_id IS 'Applied coupon at checkout (server-validated)';
COMMENT ON COLUMN orders.coupon_code IS 'Snapshot of coupon code on order';
COMMENT ON COLUMN addresses.district IS 'District from pincode lookup or manual entry';
