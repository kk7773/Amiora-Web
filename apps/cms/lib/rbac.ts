import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createUserSupabase } from '@/lib/supabase/server-user'
import { isListedSuperAdminEmail } from '@/lib/cmsSuperAdmins'

const HARDCODED_COOKIE_NAME  = 'amiora_admin_session'
const HARDCODED_COOKIE_VALUE = 'amiora-admin-authenticated-2024'

export type CmsAccessResult =
  | { ok: true;  isSuperAdmin: boolean; adminId: string | null }
  | { ok: false; response: NextResponse }

/**
 * Server-side API route guard for the CMS.
 *
 * Call at the top of every API handler:
 *   const perm = await requireCmsAccess('products', 'edit')
 *   if (perm.ok === false) return perm.response
 *
 * Access tiers (first match wins):
 * 1. Hardcoded super-admin cookie → allow all
 * 2. Env-listed super-admin email → allow all
 * 3. profiles.is_active === false → 403
 * 4. profiles.role === 'super_admin' → allow all
 * 5. profiles.role === 'admin', no admin_tab_permissions rows → allow all (migration-009 default)
 * 6. profiles.role === 'admin', explicit grant with can_view/can_edit → allow or 403
 * 7. No profile row → 403
 */
export async function requireCmsAccess(
  slug: string,
  action: 'view' | 'edit',
): Promise<CmsAccessResult> {
  const store = await cookies()

  // Tier 1: hardcoded cookie (legacy super-admin bypass)
  if (store.get(HARDCODED_COOKIE_NAME)?.value === HARDCODED_COOKIE_VALUE) {
    return { ok: true, isSuperAdmin: true, adminId: null }
  }

  const supa = await createUserSupabase()
  const { data: { user }, error: authErr } = await supa.auth.getUser()

  if (authErr || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthenticated' }, { status: 401 }),
    }
  }

  // Tier 2: env allowlist
  if (isListedSuperAdminEmail(user.email)) {
    return { ok: true, isSuperAdmin: true, adminId: user.id }
  }

  const { data: profile } = await supa
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  // Tier 3: inactive account
  if (profile && profile.is_active === false) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Account disabled' }, { status: 403 }),
    }
  }

  // Tier 4: super_admin profile
  if (profile?.role === 'super_admin') {
    return { ok: true, isSuperAdmin: true, adminId: user.id }
  }

  if (profile?.role === 'admin') {
    // Tier 5: admin with zero explicit grants → full CMS access (migration-009 default)
    const { count, error: countErr } = await supa
      .from('admin_tab_permissions')
      .select('id', { count: 'exact', head: true })
      .eq('admin_id', user.id)

    if (!countErr && (count ?? 0) === 0) {
      return { ok: true, isSuperAdmin: false, adminId: user.id }
    }

    // Tier 6: check explicit grant for this slug
    const flag = action === 'view' ? 'can_view' : 'can_edit'
    const { data: grant } = await supa
      .from('admin_tab_permissions')
      .select(`${flag}, cms_tabs!inner(slug)`)
      .eq('admin_id', user.id)
      .eq('cms_tabs.slug', slug)
      .maybeSingle()

    if (grant && (grant as Record<string, unknown>)[flag] === true) {
      return { ok: true, isSuperAdmin: false, adminId: user.id }
    }

    return {
      ok: false,
      response: NextResponse.json(
        { error: `Permission denied: ${action} access to '${slug}' is not granted` },
        { status: 403 },
      ),
    }
  }

  // Tier 7: no CMS profile at all
  return {
    ok: false,
    response: NextResponse.json({ error: 'Forbidden: not a CMS user' }, { status: 403 }),
  }
}

/**
 * Write an entry to admin_audit_logs using the service-role client.
 * Fire-and-forget — does NOT throw on failure to avoid blocking the handler.
 */
export async function writeAuditLog(opts: {
  adminId:     string | null
  action:      string
  resource?:   string
  resourceId?: string
  meta?:       Record<string, unknown>
}): Promise<void> {
  try {
    const ac = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    await ac.from('admin_audit_logs').insert({
      admin_id:    opts.adminId ?? null,
      action:      opts.action,
      resource:    opts.resource    ?? null,
      resource_id: opts.resourceId  ?? null,
      meta:        opts.meta        ?? null,
    })
  } catch {
    // Intentionally silent — audit failures must not break the main response
  }
}
