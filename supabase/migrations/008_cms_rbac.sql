-- ═══ 008: CMS RBAC (profiles, cms registry, per-tab permissions) ═══
-- Run after 007. Safe to re-run: uses IF NOT EXISTS / OR REPLACE.

-- ── 1. profiles (extends auth.users) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles (id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (lower(email));
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);

COMMENT ON TABLE public.profiles IS 'CMS operators; one row per auth user that may access the CMS.';

-- ── 2. Tab registry ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cms_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

-- ── 3. Admin ↔ tab (view/edit flags for future) ───────────────────────
CREATE TABLE IF NOT EXISTS public.admin_tab_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  tab_id UUID NOT NULL REFERENCES public.cms_tabs (id) ON DELETE CASCADE,
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_edit BOOLEAN NOT NULL DEFAULT true,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES public.profiles (id),
  UNIQUE (admin_id, tab_id)
);

CREATE INDEX IF NOT EXISTS idx_atp_admin ON public.admin_tab_permissions (admin_id);
CREATE INDEX IF NOT EXISTS idx_atp_tab ON public.admin_tab_permissions (tab_id);

-- ── 4. RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_tab_permissions ENABLE ROW LEVEL SECURITY;

-- Service role: migration / API
DROP POLICY IF EXISTS "service_role_full_profiles" ON public.profiles;
CREATE POLICY "service_role_full_profiles" ON public.profiles
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_cms_tabs" ON public.cms_tabs;
CREATE POLICY "service_role_full_cms_tabs" ON public.cms_tabs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_atp" ON public.admin_tab_permissions;
CREATE POLICY "service_role_full_atp" ON public.admin_tab_permissions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Logged-in user: read own profile
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

-- All CMS users: read tab catalog (for UI)
DROP POLICY IF EXISTS "cms_tabs_select_auth" ON public.cms_tabs;
CREATE POLICY "cms_tabs_select_auth" ON public.cms_tabs
  FOR SELECT TO authenticated
  USING (true);

-- Admins: read own row grants
DROP POLICY IF EXISTS "atp_select_own" ON public.admin_tab_permissions;
CREATE POLICY "atp_select_own" ON public.admin_tab_permissions
  FOR SELECT TO authenticated
  USING (admin_id = (SELECT auth.uid()));

-- super_admin may read all profiles (for future UI) — use service in API; skip broad policy to keep simple

-- ── 5. Has access to a route tab? (used by Next middleware) ───────────
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

  -- Admin management UI: only super_admin
  IF p_slug = 'admin-management' THEN
    RETURN p_role = 'super_admin';
  END IF;

  IF p_role = 'super_admin' THEN
    RETURN true;
  END IF;

  IF p_role != 'admin' THEN
    RETURN false;
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

REVOKE ALL ON FUNCTION public.cms_user_has_tab(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cms_user_has_tab(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.cms_user_has_tab IS 'True if current user may open CMS route tab by slug.';

-- ── 6. Optional helper: current role (API / debugging) ─────────────────
CREATE OR REPLACE FUNCTION public.cms_current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pr.role
  FROM public.profiles pr
  WHERE pr.id = auth.uid() AND pr.is_active = true
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.cms_current_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cms_current_role() TO authenticated, service_role;

-- ── 7. Seed cms_tabs (align with Sidebar, excluding super-only route) ─
INSERT INTO public.cms_tabs (slug, label, sort_order) VALUES
  ('dashboard',    'Dashboard',     0),
  ('products',     'Products',      1),
  ('collections',  'Collections',   2),
  ('orders',       'Orders',        3),
  ('customers',    'Customers',     4),
  ('requests',     'Requests',      5),
  ('reviews',      'Reviews',       6),
  ('blogs',        'Blogs',         7),
  ('testimonials', 'Testimonials',  8),
  ('stores',       'Stores',        9),
  ('coupons',      'Coupons',       10),
  ('faqs',         'FAQs',          11),
  ('pricing',      'Pricing',       12),
  ('settings',     'Settings',      13)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order;

-- ── 8. Backfill profiles from existing auth + metadata (only CMS-relevant) ─
INSERT INTO public.profiles (id, email, full_name, role, is_active)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    split_part(COALESCE(u.email, ''), '@', 1)
  ) AS full_name,
  CASE
    WHEN (u.raw_user_meta_data->>'cms_role') = 'super_admin' THEN 'super_admin'
    WHEN (u.raw_user_meta_data->>'role' = 'admin') OR (u.raw_user_meta_data->>'cms_role' = 'admin') THEN 'admin'
    ELSE 'admin'
  END AS role,
  true
FROM auth.users u
WHERE
  (u.raw_user_meta_data->>'role') = 'admin'
  OR (u.raw_user_meta_data->>'cms_role') IN ('admin', 'super_admin')
  OR EXISTS (
    SELECT 1 FROM public.cms_admin_permissions cap WHERE cap.user_id = u.id
  )
ON CONFLICT (id) DO UPDATE SET
  email     = EXCLUDED.email,
  full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
  role      = EXCLUDED.role;

-- If you have existing cms_admin_permissions (007), copy into new table
INSERT INTO public.admin_tab_permissions (admin_id, tab_id, can_view, can_edit)
SELECT
  cap.user_id,
  ct.id,
  true,
  true
FROM public.cms_admin_permissions cap
INNER JOIN public.cms_tabs ct ON ct.slug = cap.tab_slug
INNER JOIN public.profiles pr ON pr.id = cap.user_id
ON CONFLICT (admin_id, tab_id) DO NOTHING;
