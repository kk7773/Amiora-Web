-- Classify each purity row by base metal; add silver grades for catalog matrix.

ALTER TABLE public.metal_purities
  ADD COLUMN IF NOT EXISTS metal text;

UPDATE public.metal_purities SET metal = 'gold' WHERE metal IS NULL;

ALTER TABLE public.metal_purities
  ALTER COLUMN metal SET NOT NULL,
  ALTER COLUMN metal SET DEFAULT 'gold';

ALTER TABLE public.metal_purities DROP CONSTRAINT IF EXISTS metal_purities_metal_check;
ALTER TABLE public.metal_purities ADD CONSTRAINT metal_purities_metal_check
  CHECK (metal IN ('gold', 'silver', 'platinum'));

UPDATE public.metal_purities SET metal = 'gold' WHERE code IN ('22', '18', '14', '09');

INSERT INTO public.metal_purities (label, code, display_order, metal) VALUES
  ('22Kt Gold', '22', 1, 'gold')
ON CONFLICT (code) DO UPDATE SET
  label         = EXCLUDED.label,
  display_order = EXCLUDED.display_order,
  metal         = EXCLUDED.metal;

INSERT INTO public.metal_purities (label, code, display_order, metal) VALUES
  ('925 Silver', '925', 10, 'silver'),
  ('835 Silver', '835', 11, 'silver')
ON CONFLICT (code) DO UPDATE SET
  label         = EXCLUDED.label,
  display_order = EXCLUDED.display_order,
  metal         = EXCLUDED.metal;
