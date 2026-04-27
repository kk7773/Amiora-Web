-- ─── Migration 007: CMS Admin Roles & Tab Permissions ────────────────────────

CREATE TABLE IF NOT EXISTS cms_admin_permissions (
  user_id    UUID NOT NULL,
  tab_slug   TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tab_slug)
);

COMMENT ON TABLE cms_admin_permissions IS
  'Stores which CMS sidebar tabs each admin user can access. Super admins bypass this table entirely.';

-- RLS
ALTER TABLE cms_admin_permissions ENABLE ROW LEVEL SECURITY;

-- Service role: full access (for API routes that create/delete permissions)
CREATE POLICY "service_role_full_access"
  ON cms_admin_permissions
  FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated admin: can read their OWN permissions (needed by middleware)
CREATE POLICY "admin_read_own"
  ON cms_admin_permissions
  FOR SELECT
  USING (auth.uid() = user_id);
