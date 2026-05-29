-- ═══ 016: Admin Audit Log ═══════════════════════════════════════════════════
-- Tracks all significant CMS admin actions for SUPER_ADMIN visibility.
-- Safe to re-run: uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID        REFERENCES public.profiles (id) ON DELETE SET NULL,
  action       TEXT        NOT NULL,
  resource     TEXT,
  resource_id  TEXT,
  meta         JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_admin     ON public.admin_audit_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_action    ON public.admin_audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_created   ON public.admin_audit_logs (created_at DESC);

COMMENT ON TABLE  public.admin_audit_logs IS 'Immutable record of CMS admin actions (creates, updates, deletes, permission changes).';
COMMENT ON COLUMN public.admin_audit_logs.action      IS 'e.g. create_product | update_product | delete_product | create_admin | delete_admin | update_permissions | disable_admin | enable_admin';
COMMENT ON COLUMN public.admin_audit_logs.resource    IS 'Module slug, e.g. products | orders | admin-management';
COMMENT ON COLUMN public.admin_audit_logs.resource_id IS 'PK of the affected row, if applicable';
COMMENT ON COLUMN public.admin_audit_logs.meta        IS 'Arbitrary JSON context (e.g. old/new values, tab list)';

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Service role: full write access (used by API routes)
DROP POLICY IF EXISTS "audit_service_role_all" ON public.admin_audit_logs;
CREATE POLICY "audit_service_role_all"
  ON public.admin_audit_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Authenticated users: read only their own log entries
DROP POLICY IF EXISTS "audit_self_select" ON public.admin_audit_logs;
CREATE POLICY "audit_self_select"
  ON public.admin_audit_logs FOR SELECT TO authenticated
  USING (admin_id = (SELECT auth.uid()));

-- Super admins can read all entries (checked via profiles)
DROP POLICY IF EXISTS "audit_super_admin_select_all" ON public.admin_audit_logs;
CREATE POLICY "audit_super_admin_select_all"
  ON public.admin_audit_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'super_admin'
        AND p.is_active = true
    )
  );
