'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter }  from 'next/navigation'
import { useForm }    from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z }          from 'zod'
import { toast }      from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Store, Truck, CreditCard, ChevronRight, Loader2, Tag, X } from 'lucide-react'
import { useCartStore, useCartHydrated }  from '@/stores/cartStore'
import { formatINR }     from '@/lib/pricing/calculator'
import { fadeUp }        from '@/lib/animations'

/* ── Types ── */
type DeliveryMethod = 'online' | 'pickup'
type PaymentMethod  = 'online' | 'at_store'

const addressSchema = z.object({
  full_name:    z.string().min(2, 'Name required'),
  phone:        z.string().min(10, 'Valid phone required'),
  line1:        z.string().min(5, 'Address required'),
  line2:        z.string().optional(),
  city:         z.string().min(2, 'City required'),
  state:        z.string().min(2, 'State required'),
  pincode:      z.string().regex(/^\d{6}$/, '6-digit pincode required'),
  email:        z.string().email('Valid email required'),
})

type AddressData = z.infer<typeof addressSchema>

type PublicCoupon = {
  id: string
  code: string
  description: string | null
  type: string
  value: number
  min_order_amount: number
  expires_at: string | null
  applies_to: string
}

const STORES = [
  { id: 's1', name: 'AMIORA — Connaught Place', address: '23 Connaught Place, New Delhi 110001', phone: '+91 98765-43210', timings: 'Mon–Sat 10am–8pm' },
  { id: 's2', name: 'AMIORA — Bandra West',      address: '14 Hill Road, Bandra West, Mumbai 400050', phone: '+91 98765-43211', timings: 'Mon–Sun 10am–9pm' },
  { id: 's3', name: 'AMIORA — Johari Bazaar',    address: '45 Johari Bazaar, Jaipur 302003', phone: '+91 98765-43212', timings: 'Mon–Sat 10am–7pm' },
]

const STEPS = ['Delivery', 'Details', 'Payment']

export function CheckoutClient() {
  const router = useRouter()
  const cartHydrated = useCartHydrated()
  const { items, total, clearCart } = useCartStore()
  const revalidateCouponCodeRef = useRef<string | null>(null)

  const [step,           setStep]           = useState(0)
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('online')
  const [paymentMethod,  setPaymentMethod]  = useState<PaymentMethod>('online')
  const [selectedStore,  setSelectedStore]  = useState<string>(STORES[0]!.id)
  const [pickupDate,     setPickupDate]     = useState('')
  const [loading,        setLoading]        = useState(false)
  const [publicCoupons,  setPublicCoupons]  = useState<PublicCoupon[]>([])
  const [loadingCoupons, setLoadingCoupons] = useState(true)
  const [selectedCouponId, setSelectedCouponId]   = useState<string | null>(null)
  const [appliedCoupon,    setAppliedCoupon]     = useState<{
    couponId: string
    code: string
    total_discount: number
  } | null>(null)
  const [couponBusy,   setCouponBusy]   = useState(false)
  const [couponError,  setCouponError]  = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<AddressData>({
    resolver: zodResolver(addressSchema),
  })

  const subtotal = total()
  const couponOff = appliedCoupon?.total_discount ?? 0
  const subtotalAfterCoupon = Math.max(0, subtotal - couponOff)
  const shipping   = deliveryMethod === 'pickup' ? 0 : (subtotalAfterCoupon >= 5000 ? 0 : 199)
  const grandTotal = subtotalAfterCoupon + shipping

  useEffect(() => {
    let cancelled = false
    setLoadingCoupons(true)
    fetch('/api/coupons')
      .then((r) => r.json())
      .then((d: { coupons?: PublicCoupon[] }) => {
        if (!cancelled) setPublicCoupons(d.coupons ?? [])
      })
      .catch(() => { if (!cancelled) setPublicCoupons([]) })
      .finally(() => { if (!cancelled) setLoadingCoupons(false) })
    return () => { cancelled = true }
  }, [])

  const cartLinePayload = useCallback(
    () =>
      items.map((i) => ({
        product_id: i.productId,
        variant_id: i.variantId,
        quantity:   i.quantity,
      })),
    [items]
  )

  const tryApplyCoupon = useCallback(
    async (code: string): Promise<boolean> => {
      setCouponBusy(true)
      setCouponError(null)
      try {
        const res  = await fetch('/api/coupons/validate', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ code, items: cartLinePayload() }),
        })
        const data = (await res.json()) as
          { valid?: boolean; error?: string; total_discount?: number; coupon_id?: string; code?: string }
        if (!res.ok || !data.valid) {
          revalidateCouponCodeRef.current = null
          setAppliedCoupon(null)
          setCouponError(data.error ?? 'This coupon could not be applied')
          return false
        }
        revalidateCouponCodeRef.current = data.code ?? code
        setAppliedCoupon({
          couponId: data.coupon_id!,
          code:     data.code!,
          total_discount: Number(data.total_discount ?? 0),
        })
        return true
      } catch {
        revalidateCouponCodeRef.current = null
        setCouponError('Could not apply coupon')
        setAppliedCoupon(null)
        return false
      } finally {
        setCouponBusy(false)
      }
    },
    [cartLinePayload]
  )

  const cartSignature = useMemo(
    () =>
      JSON.stringify(
        items.map((i) => [i.productId, i.variantId, i.quantity, i.unitPrice])
      ),
    [items]
  )

  useEffect(() => {
    const code = revalidateCouponCodeRef.current
    if (!code) return
    if (items.length === 0) {
      revalidateCouponCodeRef.current = null
      setAppliedCoupon(null)
      setSelectedCouponId(null)
      setCouponError(null)
      return
    }
    void tryApplyCoupon(code)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- revalidate when line items change, not on every object identity
  }, [cartSignature, tryApplyCoupon, items.length])

  const selectCoupon = async (c: PublicCoupon) => {
    if (selectedCouponId === c.id) {
      revalidateCouponCodeRef.current = null
      setSelectedCouponId(null)
      setAppliedCoupon(null)
      setCouponError(null)
      return
    }
    setSelectedCouponId(c.id)
    const ok = await tryApplyCoupon(c.code)
    if (!ok) setSelectedCouponId(null)
  }

  const clearCoupon = () => {
    revalidateCouponCodeRef.current = null
    setSelectedCouponId(null)
    setAppliedCoupon(null)
    setCouponError(null)
  }

  if (!cartHydrated) {
    return (
      <div className="section-x py-24 text-center">
        <Loader2 className="inline h-8 w-8 animate-spin text-teal" aria-hidden />
        <p className="mt-4 font-display text-lg text-ink-muted">Loading your bag…</p>
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="section-x py-24 text-center">
        <p className="font-display text-xl text-ink-muted">Your cart is empty.</p>
      </div>
    )
  }

  /* ── Place order ── */
  const placeOrder = async (addressData?: AddressData) => {
    setLoading(true)
    try {
      const payload = {
        items: items.map((i) => ({
          product_id: i.productId,
          variant_id: i.variantId,
          quantity:   i.quantity,
          unit_price: i.unitPrice,
          size_label: i.sizeLabel,
          metal_weight_g: i.metalWeightG,
          metal_rate_per_gram: i.metalRatePerGram,
        })),
        total_amount:    grandTotal,
        delivery_method: deliveryMethod,
        payment_method:  paymentMethod,
        store_id:        deliveryMethod === 'pickup' ? selectedStore : undefined,
        pickup_date:     deliveryMethod === 'pickup' ? pickupDate     : undefined,
        shipping_address: addressData,
      }

      if (paymentMethod === 'online') {
        await handleRazorpay(payload)
      } else {
        const res  = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, status: 'booked_for_pickup' }) })
        const data = (await res.json()) as { order_number?: string; error?: string }
        if (!res.ok) {
          toast.error(data.error ?? 'Order could not be placed.')
          return
        }
        if (!data.order_number) {
          toast.error('Order could not be placed.')
          return
        }
        clearCart()
        router.push(`/order-confirmation/${data.order_number}`)
      }
    } catch {
      toast.error('Order failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Razorpay ── */
  const handleRazorpay = async (payload: object) => {
    const orderRes  = await fetch('/api/payment/create-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: grandTotal }) })
    if (!orderRes.ok) {
      const err = (await orderRes.json().catch(() => ({}))) as { error?: string }
      toast.error(err.error ?? 'Could not start payment.')
      return
    }
    const orderData = (await orderRes.json()) as { id: string; currency: string }

    const options = {
      key:      process.env['NEXT_PUBLIC_RAZORPAY_KEY_ID'],
      amount:   grandTotal * 100,
      currency: orderData.currency ?? 'INR',
      name:     'Amiora Diamonds',
      order_id: orderData.id,
      handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
        const res  = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, payment_id: response.razorpay_payment_id, razorpay_order_id: response.razorpay_order_id, status: 'confirmed' }) })
        const data = (await res.json()) as { order_number?: string; error?: string }
        if (!res.ok) {
          toast.error(data.error ?? 'Payment succeeded but we could not save your order. Please contact support with your payment ID.')
          return
        }
        if (!data.order_number) {
          toast.error('Could not confirm your order. Please contact support.')
          return
        }
        clearCart()
        router.push(`/order-confirmation/${data.order_number}`)
      },
      prefill: { name: '', email: '', contact: '' },
      theme:   { color: '#285260' },
      modal:   {
        ondismiss: () => {
          setLoading(false)
        },
      },
    }

    // @ts-expect-error Razorpay loaded via script
    const rzp = new window.Razorpay(options)
    rzp.on('payment.failed', () => {
      setLoading(false)
      toast.error('Payment failed. Your bag is unchanged.')
    })
    rzp.open()
  }

  const onAddressSubmit = (data: AddressData) => {
    setStep(2)
    if (paymentMethod === 'online') {
      void placeOrder(data)
    }
  }

  return (
    <div className="section-x py-10 grid gap-10 lg:grid-cols-[1fr_360px]">
      {/* Left — Steps */}
      <div>
        {/* Step indicator */}
        <div className="flex items-center gap-0 mb-10">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium transition-colors ${
                i < step ? 'bg-teal text-white' : i === step ? 'bg-deep-teal text-white' : 'bg-surface-2 text-ink-faint'
              }`}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`ml-2 text-sm ${i === step ? 'text-ink font-medium' : 'text-ink-muted'}`}>{label}</span>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-divider mx-3" />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 0 — Delivery Method */}
          {step === 0 && (
            <motion.div key="step0" variants={fadeUp} initial="hidden" animate="visible" exit={{ opacity: 0 }} className="space-y-4">
              <h2 className="font-display text-xl text-ink">How would you like your order?</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <DeliveryCard
                  icon={<Truck className="h-6 w-6" />}
                  title="Online Order"
                  sub="Delivered to your address"
                  active={deliveryMethod === 'online'}
                  onClick={() => setDeliveryMethod('online')}
                />
                <DeliveryCard
                  icon={<Store className="h-6 w-6" />}
                  title="Book & Pick Up"
                  sub="Visit our store, try before paying"
                  active={deliveryMethod === 'pickup'}
                  onClick={() => setDeliveryMethod('pickup')}
                />
              </div>
              <button
                onClick={() => setStep(1)}
                className="mt-4 flex items-center gap-2 bg-deep-teal text-cream px-8 py-3.5 text-sm font-medium uppercase tracking-widest rounded-xl hover:bg-teal transition-colors"
              >
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {/* STEP 1 — Address / Store */}
          {step === 1 && deliveryMethod === 'online' && (
            <motion.div key="step1-online" variants={fadeUp} initial="hidden" animate="visible" exit={{ opacity: 0 }}>
              <h2 className="font-display text-xl text-ink mb-6">Shipping Address</h2>
              <form onSubmit={handleSubmit(onAddressSubmit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full Name"  error={errors.full_name?.message}><input {...register('full_name')}  placeholder="Your full name"   className={inputCls} /></Field>
                  <Field label="Email"      error={errors.email?.message}><input    {...register('email')}       placeholder="email@example.com" className={inputCls} type="email" /></Field>
                  <Field label="Phone"      error={errors.phone?.message}><input    {...register('phone')}       placeholder="+91 XXXXX XXXXX"   className={inputCls} /></Field>
                  <Field label="Pincode"    error={errors.pincode?.message}><input  {...register('pincode')}     placeholder="6-digit pincode"   className={inputCls} /></Field>
                  <Field label="Address"    error={errors.line1?.message} className="sm:col-span-2"><input {...register('line1')} placeholder="Flat/House no., Street" className={inputCls} /></Field>
                  <Field label="Area (optional)"><input {...register('line2')} placeholder="Area, Landmark" className={inputCls} /></Field>
                  <Field label="City"       error={errors.city?.message}><input   {...register('city')}   placeholder="City"  className={inputCls} /></Field>
                  <Field label="State"      error={errors.state?.message}><input  {...register('state')}  placeholder="State" className={inputCls} /></Field>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setStep(0)} className="px-6 py-3 text-sm border border-divider rounded-xl hover:border-teal transition-colors">Back</button>
                  <button type="submit" className="flex items-center gap-2 bg-deep-teal text-cream px-8 py-3 text-sm font-medium uppercase tracking-widest rounded-xl hover:bg-teal transition-colors">
                    Continue to Payment <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {step === 1 && deliveryMethod === 'pickup' && (
            <motion.div key="step1-pickup" variants={fadeUp} initial="hidden" animate="visible" exit={{ opacity: 0 }}>
              <h2 className="font-display text-xl text-ink mb-6">Select Store & Date</h2>
              <div className="space-y-3 mb-6">
                {STORES.map((store) => (
                  <div
                    key={store.id}
                    onClick={() => setSelectedStore(store.id)}
                    className={`cursor-pointer rounded-xl p-4 border-2 transition-all ${selectedStore === store.id ? 'border-teal bg-teal/5' : 'border-divider hover:border-teal/50'}`}
                  >
                    <p className="font-medium text-ink">{store.name}</p>
                    <p className="text-sm text-ink-muted mt-0.5">{store.address}</p>
                    <p className="text-xs text-ink-faint mt-1">{store.timings} · {store.phone}</p>
                  </div>
                ))}
              </div>
              <div className="mb-6">
                <label className="block text-xs uppercase tracking-widest text-ink-muted mb-2">Preferred Pickup Date</label>
                <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className={inputCls} />
              </div>
              <div className="mb-6">
                <p className="text-xs uppercase tracking-widest text-ink-muted mb-3">Payment Option</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <PaymentCard title="Pay Now Online" sub="Confirm booking instantly" icon={<CreditCard className="h-5 w-5" />} active={paymentMethod === 'online'} onClick={() => setPaymentMethod('online')} />
                  <PaymentCard title="Pay At Store" sub="Pay when you pick up" icon={<Store className="h-5 w-5" />} active={paymentMethod === 'at_store'} onClick={() => setPaymentMethod('at_store')} />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="px-6 py-3 text-sm border border-divider rounded-xl hover:border-teal transition-colors">Back</button>
                <button
                  onClick={() => void placeOrder()}
                  disabled={loading || !pickupDate}
                  className="flex items-center gap-2 bg-deep-teal text-cream px-8 py-3.5 text-sm font-medium uppercase tracking-widest rounded-xl hover:bg-teal disabled:opacity-50 transition-colors"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {paymentMethod === 'online' ? 'Pay & Confirm' : 'Confirm Booking'}
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2 — Payment (online order) */}
          {step === 2 && (
            <motion.div key="step2" variants={fadeUp} initial="hidden" animate="visible" exit={{ opacity: 0 }} className="space-y-6">
              <h2 className="font-display text-xl text-ink">Completing Payment</h2>
              {loading ? (
                <div className="flex items-center gap-3 text-ink-muted">
                  <Loader2 className="h-6 w-6 animate-spin text-teal" />
                  <p>Opening payment gateway…</p>
                </div>
              ) : (
                <p className="text-sm text-ink-muted">If the payment window didn&apos;t open, click below.</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right — Order summary */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="bg-surface rounded-2xl p-6 space-y-4">
          <h3 className="font-display text-lg text-ink">Order Summary</h3>
          <ul className="space-y-3 divide-y divide-divider">
            {items.map((item) => (
              <li key={`${item.productId}-${item.variantId}`} className="pt-3 first:pt-0 flex justify-between text-sm gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-ink line-clamp-1">{item.productName}</p>
                  <p className="text-xs text-ink-muted">{item.variantLabel} · Qty {item.quantity}</p>
                </div>
                <p className="shrink-0 font-medium text-ink">{formatINR(item.unitPrice * item.quantity)}</p>
              </li>
            ))}
          </ul>

          <div className="border-t border-divider pt-4">
            <p className="text-xs uppercase tracking-widest text-ink-muted mb-2 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" aria-hidden />
              Offers (use one)
            </p>
            {loadingCoupons ? (
              <p className="text-sm text-ink-faint">Loading offers…</p>
            ) : publicCoupons.length === 0 ? (
              <p className="text-sm text-ink-faint">No public coupons right now.</p>
            ) : (
              <ul className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
                {publicCoupons.map((c) => {
                  const selected = selectedCouponId === c.id
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => void selectCoupon(c)}
                        disabled={couponBusy}
                        className={`w-full text-left rounded-xl border p-2.5 text-sm transition-colors ${
                          selected ? 'border-teal bg-teal/5' : 'border-divider hover:border-teal/40'
                        } ${couponBusy ? 'opacity-60' : ''}`}
                      >
                        <span className="font-mono font-semibold text-ink tracking-wide">{c.code}</span>
                        {c.description && (
                          <span className="block text-xs text-ink-muted mt-0.5 line-clamp-2">{c.description}</span>
                        )}
                        {c.min_order_amount > 0 && (
                          <span className="block text-xs text-ink-faint mt-0.5">Min. order {formatINR(c.min_order_amount)}</span>
                        )}
                        <span className="block text-[0.7rem] text-ink-faint mt-0.5">
                          {selected ? 'Tap to remove' : 'Tap to apply'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {couponError && <p className="text-xs text-red-600 mt-2">{couponError}</p>}
            {appliedCoupon && !couponError && (
              <div className="mt-2 flex items-center justify-between text-sm text-teal">
                <span>Coupon {appliedCoupon.code}</span>
                <button type="button" onClick={clearCoupon} className="inline-flex items-center gap-1 text-ink-muted hover:text-ink" aria-label="Remove coupon">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-divider pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-ink-muted"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
            {couponOff > 0 && (
              <div className="flex justify-between text-teal">
                <span>Discount</span>
                <span>−{formatINR(couponOff)}</span>
              </div>
            )}
            <div className="flex justify-between text-ink-muted"><span>Shipping</span><span className={shipping === 0 ? 'text-teal font-medium' : ''}>{shipping === 0 ? 'FREE' : formatINR(shipping)}</span></div>
            <div className="flex justify-between text-base font-semibold text-ink pt-2 border-t border-divider"><span>Total</span><span>{formatINR(grandTotal)}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Small helper components ── */
const inputCls = 'w-full px-3 py-2.5 text-sm bg-bg border border-divider rounded-lg text-ink placeholder-ink-faint focus:outline-none focus:ring-1 focus:ring-teal focus:border-teal transition-colors'

function Field({ label, error, children, className = '' }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs uppercase tracking-widest text-ink-muted mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function DeliveryCard({ icon, title, sub, active, onClick }: { icon: React.ReactNode; title: string; sub: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl p-5 border-2 transition-all w-full ${active ? 'border-teal bg-teal/5' : 'border-divider hover:border-teal/50'}`}
    >
      <div className={`mb-3 ${active ? 'text-teal' : 'text-ink-muted'}`}>{icon}</div>
      <p className="font-medium text-ink">{title}</p>
      <p className="text-xs text-ink-muted mt-0.5">{sub}</p>
    </button>
  )
}

function PaymentCard({ icon, title, sub, active, onClick }: { icon: React.ReactNode; title: string; sub: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl p-4 border-2 transition-all w-full ${active ? 'border-teal bg-teal/5' : 'border-divider hover:border-teal/50'}`}
    >
      <div className={`mb-2 ${active ? 'text-teal' : 'text-ink-muted'}`}>{icon}</div>
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="text-xs text-ink-muted">{sub}</p>
    </button>
  )
}
