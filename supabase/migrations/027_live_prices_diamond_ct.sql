ALTER TABLE public.live_prices
  DROP CONSTRAINT IF EXISTS live_prices_metal_check;

ALTER TABLE public.live_prices
  ADD CONSTRAINT live_prices_metal_check
  CHECK (metal IN ('gold_999', 'silver_999', 'diamond_ct'));

COMMENT ON COLUMN public.live_prices.price_per_gram IS
  'Rate value for the live price row. Gold/silver use INR per gram; diamond_ct uses INR per carat.';
