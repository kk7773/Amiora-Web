-- Add 22Kt Gold purity to the catalog master for existing databases.

INSERT INTO public.metal_purities (label, code, display_order, metal, is_active)
VALUES ('22Kt Gold', '22', 1, 'gold', true)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  display_order = EXCLUDED.display_order,
  metal = EXCLUDED.metal,
  is_active = EXCLUDED.is_active;

UPDATE public.metal_purities
SET display_order = CASE code
  WHEN '22' THEN 1
  WHEN '18' THEN 2
  WHEN '14' THEN 3
  WHEN '09' THEN 4
  ELSE display_order
END
WHERE code IN ('22', '18', '14', '09');
