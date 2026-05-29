-- Sterling silver finish for catalog SKUs / variant rows (silver products use this single colour row).
INSERT INTO public.metal_colors (label, code, hex, display_order) VALUES
  ('Sterling Silver', 'SV', '#B8B8B8', 50)
ON CONFLICT (code) DO UPDATE SET
  label         = EXCLUDED.label,
  hex           = EXCLUDED.hex,
  display_order = EXCLUDED.display_order;
