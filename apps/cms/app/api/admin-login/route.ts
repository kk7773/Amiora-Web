import { NextRequest, NextResponse } from 'next/server'

// ── Hardcoded admin credentials ──────────────────────────────────────
const ADMIN_EMAIL    = 'thesandeepmaity@gmail.com'
const ADMIN_PASSWORD = 'Amioraadmin'
const COOKIE_NAME    = 'amiora_admin_session'
const COOKIE_VALUE   = 'amiora-admin-authenticated-2024'
// ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const res = NextResponse.json({ success: true })
    res.cookies.set(COOKIE_NAME, COOKIE_VALUE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })
    return res
  }

  // 200 (not 401) so normal Supabase admins do not see a red "failed" request on every login
  return NextResponse.json({ success: false, error: 'Invalid credentials' })
}

export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.delete('amiora_admin_session')
  return res
}
