-- Align orders checkout fields with the storefront checkout flow.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_method text DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS pickup_date date,
  ADD COLUMN IF NOT EXISTS razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS razorpay_signature text;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (
    status IN (
      'pending',
      'confirmed',
      'processing',
      'ready_to_ship',
      'shipped',
      'out_for_delivery',
      'delivered',
      'booked_for_pickup',
      'cancelled',
      'refund_requested',
      'refunded'
    )
  );

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_payment_mode_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_mode_check
  CHECK (payment_mode IN ('online', 'pay_at_store'));

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));

CREATE INDEX IF NOT EXISTS idx_orders_delivery_method
  ON orders (delivery_method);

CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id
  ON orders (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id
  ON orders (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;
