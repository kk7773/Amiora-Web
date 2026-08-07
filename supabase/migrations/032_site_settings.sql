-- ═══ 032: Site Settings ═════════════════════════════════════════════════════
-- Global key/value settings used by CMS and storefront.
-- Safe to re-run: uses IF NOT EXISTS and idempotent policies.

CREATE TABLE IF NOT EXISTS public.site_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.site_settings IS 'Global key/value settings such as default making charge and announcement bar text.';
COMMENT ON COLUMN public.site_settings.key IS 'Stable setting key, e.g. making_charge_pct or announcement_bar.';
COMMENT ON COLUMN public.site_settings.value IS 'Stringified setting value.';

CREATE OR REPLACE FUNCTION public.set_site_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER trg_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_site_settings_updated_at();

INSERT INTO public.site_settings (key, value)
VALUES
  ('making_charge_pct', '8'),
  ('announcement_bar', '')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_settings_service_role_all" ON public.site_settings;
CREATE POLICY "site_settings_service_role_all"
  ON public.site_settings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "site_settings_authenticated_select" ON public.site_settings;
CREATE POLICY "site_settings_authenticated_select"
  ON public.site_settings FOR SELECT TO authenticated
  USING (true);

