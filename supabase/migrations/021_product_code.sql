ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_code text;

UPDATE public.products p
SET product_code = upper(regexp_replace(c.code || coalesce(p.design_number, ''), '\s+', '', 'g'))
FROM public.categories c
WHERE p.category_id = c.id
  AND p.design_number IS NOT NULL
  AND btrim(p.design_number) <> '';

CREATE OR REPLACE FUNCTION public.sync_product_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  category_code text;
BEGIN
  IF NEW.category_id IS NULL OR NEW.design_number IS NULL OR btrim(NEW.design_number) = '' THEN
    NEW.product_code := NULL;
    RETURN NEW;
  END IF;

  SELECT code
    INTO category_code
  FROM public.categories
  WHERE id = NEW.category_id;

  IF category_code IS NULL OR btrim(category_code) = '' THEN
    NEW.product_code := NULL;
    RETURN NEW;
  END IF;

  NEW.product_code := upper(regexp_replace(category_code || NEW.design_number, '\s+', '', 'g'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_sync_product_code ON public.products;
CREATE TRIGGER products_sync_product_code
  BEFORE INSERT OR UPDATE OF category_id, design_number
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_product_code();

CREATE UNIQUE INDEX IF NOT EXISTS uq_products_product_code
  ON public.products (product_code)
  WHERE product_code IS NOT NULL;
