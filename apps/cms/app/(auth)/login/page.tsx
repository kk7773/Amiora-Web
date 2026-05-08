'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { createBrowserClient } from '@/lib/supabase/client'
import { describeSupabasePublicEnvIssue } from '@/lib/supabase/envMatch'

const schema = z.object({
  email:    z.string().email('Valid email required'),
  password: z.string().min(6, 'Password required'),
})
type FormData = z.infer<typeof schema>

function supabaseAuthMessage(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  if (msg.includes('invalid login') || msg.includes('invalid email or password') || msg.includes('email not confirmed')) {
    return 'Wrong email or password, or this user is not registered in Supabase. Ask a Super Admin to reset the password in Admin Management.'
  }
  if (msg.includes('invalid api key') || (msg.includes('api key') && msg.includes('invalid'))) {
    return 'Invalid Supabase key: open Supabase → Project Settings → API, copy Project URL and anon public key from the same project into apps/cms/.env.local, then restart npm run dev.'
  }
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Network error. Check your connection and that the dev server is running.'
  }
  return err instanceof Error ? err.message : String(err)
}

export default function AdminLoginPage() {
  const [showPw,    setShowPw]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [envIssue,  setEnvIssue]  = useState<string | null>(null)

  useEffect(() => {
    setEnvIssue(describeSupabasePublicEnvIssue())
  }, [])

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const email = data.email.trim().toLowerCase()

      // ── Step 1: Try hardcoded admin credentials first ──────────────
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: data.password }),
      })
      const step1 = await res.json().catch(() => ({} as { success?: boolean }))

      if (!res.ok) {
        toast.error('Could not reach login service. Please try again.')
        return
      }
      if (step1.success) {
        toast.success('Welcome back, Admin!')
        window.location.assign('/dashboard')
        return
      }

      // ── Step 2: Fall back to Supabase Auth ────────────────────────
      // Clear any leftover hardcoded super-admin cookie before proceeding
      await fetch('/api/admin-login', { method: 'DELETE' })

      const supabase = createBrowserClient()
      const { data: auth, error } = await supabase.auth.signInWithPassword({
        email,
        password: data.password,
      })

      if (error) throw error

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Could not establish a session. Check Supabase settings and try again.')
        return
      }

      const meRes = await fetch('/api/me', { credentials: 'same-origin' })
      const me    = await meRes.json() as { cms_role?: string; error?: string }

      if (!meRes.ok || me.error) {
        await supabase.auth.signOut()
        toast.error(me.error ?? 'Access denied. Admin privileges required.')
        return
      }
      if (me.cms_role !== 'admin' && me.cms_role !== 'super_admin') {
        await supabase.auth.signOut()
        toast.error('Access denied. Admin privileges required.')
        return
      }

      toast.success('Welcome back, Admin!')
      window.location.assign('/dashboard')
    } catch (err: unknown) {
      toast.error(supabaseAuthMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-sidebar-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-full bg-teal items-center justify-center mb-3">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-display text-3xl text-cream">AMIORA CMS</h1>
          <p className="text-sidebar-text text-sm mt-1">Admin Portal — Authorised Access Only</p>
        </div>

        {envIssue && (
          <div className="mb-4 flex gap-2 rounded-xl border border-amber-500/50 bg-amber-950/40 px-3 py-2.5 text-left text-amber-100/95 text-xs leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <p>{envIssue}</p>
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white/5 backdrop-blur rounded-2xl p-7 border border-white/10 space-y-5"
        >
          {/* Email */}
          <div className="space-y-1">
            <label className="text-xs text-sidebar-text uppercase tracking-wider">Email</label>
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              placeholder="admin@amiora.in"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-cream placeholder:text-white/30 outline-none focus:border-teal text-sm"
            />
            {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-xs text-sidebar-text uppercase tracking-wider">Password</label>
            <div className="relative">
              <input
                {...register('password')}
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 pr-10 text-cream placeholder:text-white/30 outline-none focus:border-teal text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPw(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal hover:bg-sidebar-active text-white py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <ShieldCheck className="w-4 h-4" />}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sidebar-text text-xs mt-6">
          © {new Date().getFullYear()} AMIORA Diamonds. All rights reserved.
        </p>
      </div>
    </div>
  )
}
