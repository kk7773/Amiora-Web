'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useForm }    from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z }          from 'zod'
import { toast }      from 'sonner'
import { Loader2, X, CalendarDays } from 'lucide-react'
import { AMIORA_STORE } from '@/lib/storefrontStore'

const schema = z.object({
  type:             z.enum(['store', 'home']),
  store_id:         z.string().optional(),
  address:          z.string().optional(),
  preferred_date:   z.string().min(1, 'Date required'),
  preferred_time:   z.string().optional(),
  notes:            z.string().optional(),
})
type FormData = z.infer<typeof schema>

const STORES = [
  { id: AMIORA_STORE.id, name: `${AMIORA_STORE.name} — ${AMIORA_STORE.city}` },
]

interface DemoRequestModalProps {
  trigger?:      React.ReactNode
  open?:         boolean
  onOpenChange?: (open: boolean) => void
  prefilledStoreId?: string
}

export function DemoRequestModal({ trigger, open: controlledOpen, onOpenChange, prefilledStoreId }: DemoRequestModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const isOpen    = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setIsOpen = onOpenChange ?? setInternalOpen

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'store', store_id: prefilledStoreId ?? STORES[0]!.id },
  })

  const demoType = watch('type')

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await fetch('/api/requests/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      toast.success('Demo request submitted! We\'ll confirm soon.')
      reset()
      setIsOpen(false)
    } catch {
      toast.error('Failed to submit. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 animate-fade-up max-h-[90vh] overflow-y-auto">
          <div className="bg-bg rounded-2xl p-8 shadow-lg">
            <div className="flex items-start justify-between mb-6">
              <div>
                <Dialog.Title className="font-display text-xl text-ink">Book a Demo</Dialog.Title>
                <Dialog.Description className="text-sm text-ink-muted mt-1">
                  Experience our jewellery in person — at a store or your home.
                </Dialog.Description>
              </div>
              <Dialog.Close className="p-2 text-ink-faint hover:text-ink transition-colors rounded-lg hover:bg-surface">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Type */}
              <div>
                <p className="text-xs uppercase tracking-widest text-ink-muted mb-2">Demo Type</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['store', 'home'] as const).map((t) => (
                    <label key={t} className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${demoType === t ? 'border-teal bg-teal/5' : 'border-divider hover:border-teal/50'}`}>
                      <input {...register('type')} type="radio" value={t} className="accent-teal" />
                      <span className="text-sm font-medium text-ink">{t === 'store' ? '🏪 Visit Store' : '🏠 Home Visit'}</span>
                    </label>
                  ))}
                </div>
              </div>

              {demoType === 'store' ? (
                <Field label="Select Store">
                  <select {...register('store_id')} className={inputCls}>
                    {STORES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
              ) : (
                <Field label="Your Address" error={errors.address?.message}>
                  <input {...register('address')} placeholder="Full address for home visit" className={inputCls} />
                </Field>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Preferred Date" error={errors.preferred_date?.message}>
                  <input {...register('preferred_date')} type="date" min={new Date().toISOString().split('T')[0]} className={inputCls} />
                </Field>
                <Field label="Time Slot">
                  <select {...register('preferred_time')} className={inputCls}>
                    <option value="">Any time</option>
                    <option>10am – 12pm</option>
                    <option>12pm – 3pm</option>
                    <option>3pm – 6pm</option>
                    <option>6pm – 8pm</option>
                  </select>
                </Field>
              </div>

              <Field label="Notes (optional)">
                <textarea {...register('notes')} placeholder="Products of interest, special requests…" rows={3} className={`${inputCls} resize-none`} />
              </Field>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-deep-teal text-cream text-sm font-medium uppercase tracking-widest rounded-xl hover:bg-teal disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                Book Demo
              </button>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const inputCls = 'w-full px-3 py-2.5 text-sm bg-bg border border-divider rounded-lg text-ink placeholder-ink-faint focus:outline-none focus:ring-1 focus:ring-teal focus:border-teal transition-colors'
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-ink-muted mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
