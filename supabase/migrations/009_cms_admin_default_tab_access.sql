-- Fix: admin with profiles row but zero admin_tab_permissions rows was locked out of
-- every tab (EXISTS(...) was always false) and Sidebar saw tabs=[] → empty nav.
-- Admins with no explicit grants behave like legacy full admins (except admin-management).

CREATE OR REPLACE FUNCTION public.cms_user_has_tab(p_slug text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_role  text;
  active  boolean;
  uid     uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL OR p_slug IS NULL OR btrim(p_slug) = '' THEN
    RETURN false;
  END IF;

  SELECT pr.role, pr.is_active
    INTO p_role, active
  FROM public.profiles pr
  WHERE pr.id = uid;

  IF NOT COALESCE(active, false) OR p_role IS NULL THEN
    RETURN false;
  END IF;

  IF p_slug = 'admin-management' THEN
    RETURN p_role = 'super_admin';
  END IF;

  IF p_role = 'super_admin' THEN
    RETURN true;
  END IF;

  IF p_role != 'admin' THEN
    RETURN false;
  END IF;

  -- No explicit tab rows yet: treat as full CMS admin (legacy-style).
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_tab_permissions atp WHERE atp.admin_id = uid
  ) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.admin_tab_permissions atp
    INNER JOIN public.cms_tabs ct ON ct.id = atp.tab_id
    WHERE atp.admin_id = uid
      AND ct.slug = p_slug
      AND atp.can_view = true
  );
END;
$$;

COMMENT ON FUNCTION public.cms_user_has_tab(text) IS
  'True if current user may open CMS route tab by slug. Admin with no admin_tab_permissions rows gets all non–super-admin tabs.';
