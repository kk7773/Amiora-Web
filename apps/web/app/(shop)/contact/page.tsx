'use client'

import { useState } from 'react'
import { useForm }    from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z }          from 'zod'
import { toast }      from 'sonner'
import { Loader2, Phone, Mail, MapPin, CheckCircle } from 'lucide-react'
import { AMIORA_STORE } from '@/lib/storefrontStore'

const schema = z.object({
  name:    z.string().min(2, 'Name required'),
  email:   z.string().email('Valid email required'),
  phone:   z.string().optional(),
  message: z.string().min(10, 'Message required'),
})
type FormData = z.infer<typeof schema>

export default function ContactPage() {
  const [loading,   setLoading]   = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      setSubmitted(true)
    } catch {
      toast.error('Failed to send. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="bg-surface section-x py-16 text-center">
        <p className="text-2xs uppercase tracking-widest2 text-teal mb-3">Get in Touch</p>
        <h1 className="font-display text-display-2xl text-ink">Contact Us</h1>
        <p className="text-ink-muted mt-3 max-w-sm mx-auto text-sm">We&apos;d love to hear from you. Drop a message or visit us in store.</p>
      </div>

      <div className="section-x py-14 grid gap-12 lg:grid-cols-2">
        {/* Form */}
        <div>
          {submitted ? (
            <div className="space-y-4 text-center py-12">
              <CheckCircle className="mx-auto h-12 w-12 text-teal" />
              <h2 className="font-display text-xl text-ink">Message Sent!</h2>
              <p className="text-sm text-ink-muted">We&apos;ll get back to you within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {[
                { label: 'Name',    key: 'name',    type: 'text',  placeholder: 'Your name',        error: errors.name?.message },
                { label: 'Email',   key: 'email',   type: 'email', placeholder: 'email@example.com', error: errors.email?.message },
                { label: 'Phone (optional)', key: 'phone', type: 'tel', placeholder: '+91 XXXXX', error: undefined },
              ].map(({ label, key, type, placeholder, error }) => (
                <div key={key}>
                  <label className="block text-xs uppercase tracking-widest text-ink-muted mb-1.5">{label}</label>
                  <input {...register(key as keyof FormData)} type={type} placeholder={placeholder} className={inputCls} />
                  {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                </div>
              ))}
              <div>
                <label className="block text-xs uppercase tracking-widest text-ink-muted mb-1.5">Message</label>
                <textarea {...register('message')} rows={5} placeholder="How can we help you?" className={`${inputCls} resize-none`} />
                {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message.message}</p>}
              </div>
              <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-3.5 bg-deep-teal text-cream text-sm font-medium uppercase tracking-widest rounded-xl hover:bg-teal disabled:opacity-50 transition-colors">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Send Message
              </button>
            </form>
          )}
        </div>

        {/* Info */}
        <div className="space-y-8">
          <div>
            <h2 className="font-display text-xl text-ink mb-4">Our Store</h2>
            <div className="flex gap-3">
              <div className="p-2 bg-teal/10 rounded-lg shrink-0 h-fit"><MapPin className="h-4 w-4 text-teal" /></div>
              <div>
                <p className="font-medium text-ink">{AMIORA_STORE.name}</p>
                <p className="text-sm text-ink-muted">{AMIORA_STORE.fullAddress}</p>
                <a
                  href={AMIORA_STORE.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-teal mt-0.5 inline-block hover:text-deep-teal transition-colors"
                >
                  View on Google Maps
                </a>
              </div>
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-divider">
              <iframe
                title="Amiora Diamonds location"
                src={AMIORA_STORE.embedUrl}
                className="h-72 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-ink-muted">
              <Phone className="h-4 w-4 text-teal" />
              <a href={`tel:${AMIORA_STORE.phone.replace(/\s+/g, '')}`} className="hover:text-teal transition-colors">{AMIORA_STORE.phone}</a>
            </div>
            <div className="flex items-center gap-3 text-sm text-ink-muted">
              <Mail className="h-4 w-4 text-teal" />
              <a href={`mailto:${AMIORA_STORE.email}`} className="hover:text-teal transition-colors">{AMIORA_STORE.email}</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2.5 text-sm bg-bg border border-divider rounded-lg text-ink placeholder-ink-faint focus:outline-none focus:ring-1 focus:ring-teal focus:border-teal transition-colors'
