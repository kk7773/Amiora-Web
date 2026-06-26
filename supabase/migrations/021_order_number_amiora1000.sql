-- 021: Switch order numbers to AMIORA1000-style sequence

CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1000;

DO $$
DECLARE
  max_numeric bigint;
BEGIN
  SELECT MAX(CASE
    WHEN order_number ~ '^AMIORA[0-9]+$' THEN substring(order_number FROM 'AMIORA([0-9]+)$')::bigint
    ELSE NULL
  END)
  INTO max_numeric
  FROM orders;

  IF max_numeric IS NULL OR max_numeric < 999 THEN
    PERFORM setval('order_number_seq', 999, true);
  ELSE
    PERFORM setval('order_number_seq', max_numeric, true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'AMIORA' || nextval('order_number_seq')::text;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
