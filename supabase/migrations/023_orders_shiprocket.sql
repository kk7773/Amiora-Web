-- Shiprocket shipment + tracking fields on orders

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shiprocket_order_id bigint,
  ADD COLUMN IF NOT EXISTS shiprocket_shipment_id bigint,
  ADD COLUMN IF NOT EXISTS awb_code text,
  ADD COLUMN IF NOT EXISTS courier_name text,
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS shipment_status text,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_awb_code ON orders (awb_code)
  WHERE awb_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_shiprocket_order_id ON orders (shiprocket_order_id)
  WHERE shiprocket_order_id IS NOT NULL;

COMMENT ON COLUMN orders.shiprocket_order_id IS 'Shiprocket internal order id';
COMMENT ON COLUMN orders.shiprocket_shipment_id IS 'Shiprocket shipment id used for AWB assignment';
COMMENT ON COLUMN orders.awb_code IS 'Courier AWB / tracking number';
COMMENT ON COLUMN orders.shipment_status IS 'Latest status from Shiprocket webhook';
