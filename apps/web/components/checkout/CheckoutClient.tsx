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
import { useUser } from '@/hooks/useUser'
import { formatINR }     from '@/lib/pricing/calculator'
import { APPLIES_TO_LABELS, type AppliesTo } from '@/lib/coupons/constants'
import { fadeUp }        from '@/lib/animations'
import { getPublicRazorpayKeyId, loadRazorpayCheckout } from '@/lib/razorpay/loadCheckout'

/* ── Types ── */
type DeliveryMethod = 'online' | 'pickup'
type PaymentMethod  = 'online' | 'at_store'

const addressSchema = z.object({
  full_name:    z.string().min(2, 'Name required'),
  phone:        z.string().min(10, 'Valid phone required'),
  line1:        z.string().min(5, 'Address required'),
  line2:        z.string().optional(),
  city:         z.string().min(2, 'City required'),
  district:     z.string().min(2, 'District required'),
  state:        z.string().min(2, 'State required'),
  pincode:      z.string().regex(/^\d{6}$/, '6-digit pincode required'),
  email:        z.string().email('Valid email required'),
})

type AddressData = z.infer<typeof addressSchema>

type EvaluatedCoupon = {
  id: string
  code: string
  description: string | null
  type: string
  value: number
  min_order_amount: number
  expires_at: string | null
  applies_to: string
  applicable: boolean
  reason?: string
  total_discount: number
  is_best: boolean
}

type CartQuote = {
  lines: Array<{
    product_id: string
    variant_id: string
    quantity: number
    unit_price: number
    line_total: number
  }>
  subtotal: number
  discount_amount: number
  subtotal_after_coupon: number
  shipping: number
  grand_total: number
  coupon: { id: string; code: string; total_discount: number } | null
  errors: string[]
  coupons?: EvaluatedCoupon[]
}

type OrderPayload = {
  items: Array<{
    product_id: string
    variant_id: string
    quantity: number
    size_label: string
    product_name: string
    variant_label: string
    image_url: string | null
    unit_price?: number
  }>
  delivery_method: DeliveryMethod
  payment_method: PaymentMethod
  store_id?: string
  pickup_date?: string
  shipping_address?: AddressData
  coupon_code?: string
}

const STORES = [
  { id: 's1', name: 'AMIORA — Connaught Place', address: '23 Connaught Place, New Delhi 110001', phone: '+91 98765-43210', timings: 'Mon–Sat 10am–8pm' },
  { id: 's2', name: 'AMIORA — Bandra West',      address: '14 Hill Road, Bandra West, Mumbai 400050', phone: '+91 98765-43211', timings: 'Mon–Sun 10am–9pm' },
  { id: 's3', name: 'AMIORA — Johari Bazaar',    address: '45 Johari Bazaar, Jaipur 302003', phone: '+91 98765-43212', timings: 'Mon–Sat 10am–7pm' },
]

const STEPS = ['Delivery', 'Details', 'Payment']

export function CheckoutClient({ razorpayKeyId: initialRazorpayKeyId }: { razorpayKeyId?: string }) {
  const router = useRouter()
  const { user } = useUser()
  const cartHydrated = useCartHydrated()
  const { items, clearCart } = useCartStore()
  const revalidateCouponCodeRef = useRef<string | null>(null)
  const razorpayKeyId = initialRazorpayKeyId ?? getPublicRazorpayKeyId()

  const [step,           setStep]           = useState(0)
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('online')
  const [paymentMethod,  setPaymentMethod]  = useState<PaymentMethod>('online')
  const [selectedStore,  setSelectedStore]  = useState<string>(STORES[0]!.id)
  const [pickupDate,     setPickupDate]     = useState('')
  const [loading,        setLoading]        = useState(false)
  const [loadingCoupons, setLoadingCoupons] = useState(true)
  const [loadingQuote,   setLoadingQuote]   = useState(true)
  const [quoteError,     setQuoteError]     = useState<string | null>(null)
  const [quote,          setQuote]          = useState<CartQuote | null>(null)
  const [evaluatedCoupons, setEvaluatedCoupons] = useState<EvaluatedCoupon[]>([])
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null)
  const [appliedCoupon, setAppliedCoupon] = useState<{
    couponId: string
    code: string
    total_discount: number
  } | null>(null)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<AddressData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      email: user?.email ?? '',
    },
  })

  const subtotal = quote?.subtotal ?? 0
  const couponOff = quote?.discount_amount ?? 0
  const subtotalAfterCoupon = quote?.subtotal_after_coupon ?? 0
  const shipping = quote?.shipping ?? 0
  const grandTotal = quote?.grand_total ?? 0

  useEffect(() => {
    if (user?.email) {
      setValue('email', user.email)
    }
  }, [setValue, user?.email])

  const orderItemsPayload = useCallback(
    () =>
      items.map((i) => ({
        product_id: i.productId,
        variant_id: i.variantId,
        quantity:   i.quantity,
        variant_sku: i.variantSku || i.variantLabel || i.variantId,
        unit_price: i.unitPrice,
        size_label: i.sizeLabel,
        product_name: i.productName,
        variant_label: i.variantLabel,
        image_url: i.imageUrl ?? null,
      })),
    [items],
  )

  const cartLinePayload = useCallback(
    () =>
      items.map((i) => ({
        product_id: i.productId,
        variant_id: i.variantId,
        quantity:   i.quantity,
        variant_sku: i.variantSku || i.variantLabel || i.variantId,
        unit_price: i.unitPrice,
      })),
    [items],
  )

  const cartSignature = useMemo(
    () =>
      JSON.stringify(
        items.map((i) => [i.productId, i.variantId, i.quantity]),
      ),
    [items],
  )

  const quoteSignature = useMemo(
    () => JSON.stringify([cartSignature, appliedCoupon?.code ?? null, deliveryMethod]),
    [cartSignature, appliedCoupon?.code, deliveryMethod],
  )

  const quoteLineMap = useMemo(
    () =>
      new Map(
        (quote?.lines ?? []).map((l) => [`${l.product_id}:${l.variant_id}`, l] as const),
      ),
    [quote?.lines],
  )

  useEffect(() => {
    if (items.length === 0) {
      setQuote(null)
      setEvaluatedCoupons([])
      setAppliedCoupon(null)
      setSelectedCouponId(null)
      setQuoteError(null)
      setLoadingQuote(false)
      setLoadingCoupons(false)
      return
    }

    let cancelled = false
    setLoadingQuote(true)
    setLoadingCoupons(true)
    setQuoteError(null)

    fetch('/api/checkout/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cartLinePayload(),
        coupon_code: appliedCoupon?.code,
        delivery_method: deliveryMethod,
      }),
    })
      .then((r) => r.json())
      .then((d: CartQuote & { error?: string }) => {
        if (cancelled) return
        if (d.error) {
          setQuote(null)
          setEvaluatedCoupons([])
          setQuoteError(d.error)
          return
        }
        setQuote(d)

        const list = d.coupons ?? []
        setEvaluatedCoupons(list)

        setAppliedCoupon((prev) => {
          if (!prev) return null
          const match = list.find((c) => c.id === prev.couponId)
          if (!match?.applicable) {
            setSelectedCouponId(null)
            revalidateCouponCodeRef.current = null
            return null
          }
          revalidateCouponCodeRef.current = match.code
          return {
            couponId: match.id,
            code: match.code,
            total_discount: match.total_discount,
          }
        })

        const couponErr = d.errors?.find((e) => e.toLowerCase().includes('coupon'))
        if (appliedCoupon?.code && couponErr) {
          setAppliedCoupon(null)
          setSelectedCouponId(null)
          revalidateCouponCodeRef.current = null
          toast.error(couponErr)
        } else if (appliedCoupon && d.coupon) {
          setAppliedCoupon({
            couponId: d.coupon.id,
            code: d.coupon.code,
            total_discount: d.coupon.total_discount,
          })
        }

        const itemErr = d.errors?.find((e) => !e.toLowerCase().includes('coupon'))
        setQuoteError(itemErr ?? null)
      })
      .catch(() => {
        if (!cancelled) {
          setQuote(null)
          setEvaluatedCoupons([])
          setQuoteError('Could not load pricing')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingQuote(false)
          setLoadingCoupons(false)
        }
      })

    return () => { cancelled = true }
  }, [quoteSignature, cartLinePayload, items.length, appliedCoupon?.code, deliveryMethod])

  const selectCoupon = (c: EvaluatedCoupon) => {
    if (!c.applicable) return

    if (selectedCouponId === c.id) {
      revalidateCouponCodeRef.current = null
      setSelectedCouponId(null)
      setAppliedCoupon(null)
      return
    }

    revalidateCouponCodeRef.current = c.code
    setSelectedCouponId(c.id)
    setAppliedCoupon({
      couponId: c.id,
      code: c.code,
      total_discount: c.total_discount,
    })
  }

  const clearCoupon = () => {
    revalidateCouponCodeRef.current = null
    setSelectedCouponId(null)
    setAppliedCoupon(null)
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
    if (loadingQuote || !quote || quote.lines.length === 0) {
      toast.error(quoteError ?? 'Prices are still loading. Please wait.')
      return
    }
    if (quoteError) {
      toast.error(quoteError)
      return
    }

    setLoading(true)
    try {
      const payload: OrderPayload = {
        items: orderItemsPayload(),
        delivery_method: deliveryMethod,
        payment_method:  paymentMethod,
        store_id:        deliveryMethod === 'pickup' ? selectedStore : undefined,
        pickup_date:     deliveryMethod === 'pickup' ? pickupDate     : undefined,
        shipping_address: addressData,
        coupon_code: appliedCoupon?.code,
      }

      if (paymentMethod === 'online') {
        await handleRazorpay(payload)
      } else {
        const res  = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
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
  const handleRazorpay = async (payload: OrderPayload) => {
    if (!razorpayKeyId) {
      toast.error('Razorpay key is missing.')
      return
    }

    await loadRazorpayCheckout()

    const orderRes  = await fetch('/api/payment/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: orderItemsPayload(),
        coupon_code: appliedCoupon?.code,
        delivery_method: deliveryMethod,
      }),
    })
    if (!orderRes.ok) {
      const err = (await orderRes.json().catch(() => ({}))) as { error?: string; details?: { code?: string; description?: string; field?: string; reason?: string } }
      const extra =
        err.details?.description ??
        err.details?.reason ??
        err.details?.code ??
        ''
      toast.error(err.error ?? 'Could not start payment.', {
        description: extra ? String(extra) : undefined,
      })
      return
    }
    const orderData = (await orderRes.json()) as { id: string; currency: string; grand_total: number }
    const payAmount = orderData.grand_total ?? grandTotal

    const options = {
      key:      razorpayKeyId,
      amount:   payAmount * 100,
      currency: orderData.currency ?? 'INR',
      name:     'Amiora Diamonds',
      order_id: orderData.id,
      handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
        const res  = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          }),
        })
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
      prefill: {
        name: payload.shipping_address?.full_name ?? user?.user_metadata?.full_name ?? '',
        email: payload.shipping_address?.email ?? user?.email ?? '',
        contact: payload.shipping_address?.phone ?? '',
      },
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
    <div className="section-x py-6 md:py-10 pb-28 md:pb-10 grid gap-6 lg:gap-10 lg:grid-cols-[1fr_360px] overflow-x-hidden min-w-0">
      {/* Steps */}
      <div className="order-2 lg:order-1 min-w-0">
        {/* Step indicator */}
        <div className="flex items-center mb-6 sm:mb-10">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none min-w-0">
              <div className="flex flex-col items-center gap-1 min-w-[3.25rem] sm:min-w-0 sm:flex-row sm:gap-2">
                <div className={`flex shrink-0 items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                  i < step ? 'bg-teal text-white' : i === step ? 'bg-deep-teal text-white' : 'bg-surface-2 text-ink-faint'
                }`}>
                  {i < step ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : i + 1}
                </div>
                <span className={`text-[10px] leading-tight sm:text-sm text-center sm:text-left max-w-[4.5rem] sm:max-w-none truncate sm:overflow-visible sm:whitespace-normal ${
                  i === step ? 'text-ink font-medium' : 'text-ink-muted'
                }`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="h-px flex-1 min-w-2 bg-divider mx-1 sm:mx-3 self-start mt-3.5 sm:mt-0 sm:self-center" aria-hidden />
              )}
            </div>
          ))}
        </div>

        {/* <div className="mb-6 rounded-2xl border border-teal/15 bg-teal/5 px-4 py-3 text-sm text-ink-muted">
          Checkout as guest is available. Sign in is only needed for wishlist and account features.
        </div> */}

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
                className="mt-4 flex w-full sm:w-auto items-center justify-center gap-2 bg-deep-teal text-cream px-8 py-3.5 text-sm font-medium uppercase tracking-widest rounded-xl hover:bg-teal transition-colors"
              >
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {/* STEP 1 — Address / Store */}
          {step === 1 && deliveryMethod === 'online' && (
            <motion.div key="step1-online" variants={fadeUp} initial="hidden" animate="visible" exit={{ opacity: 0 }} className="min-w-0">
              <h2 className="font-display text-lg sm:text-xl text-ink mb-4 sm:mb-6">Shipping Address</h2>
              <form onSubmit={handleSubmit(onAddressSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 gap-3.5 sm:gap-4 sm:grid-cols-2">
                  <Field label="Full Name" error={errors.full_name?.message}>
                    <input {...register('full_name')} placeholder="Your full name" className={inputCls} autoComplete="name" />
                  </Field>
                  <Field label="Phone" error={errors.phone?.message}>
                    <input {...register('phone')} placeholder="+91 XXXXX XXXXX" className={inputCls} type="tel" inputMode="tel" autoComplete="tel" />
                  </Field>
                  <Field label="Email" error={errors.email?.message} className="sm:col-span-2">
                    <input {...register('email')} placeholder="email@example.com" className={inputCls} type="email" autoComplete="email" />
                  </Field>
                  <Field label="Address" error={errors.line1?.message} className="sm:col-span-2">
                    <input {...register('line1')} placeholder="Flat/House no., Street" className={inputCls} autoComplete="address-line1" />
                  </Field>
                  <Field label="Landmark (optional)" className="sm:col-span-2">
                    <input {...register('line2')} placeholder="Area, landmark" className={inputCls} autoComplete="address-line2" />
                  </Field>
                  <Field label="City" error={errors.city?.message}>
                    <input {...register('city')} placeholder="City" className={inputCls} autoComplete="address-level2" />
                  </Field>
                  <Field label="State" error={errors.state?.message}>
                    <input {...register('state')} placeholder="State" className={inputCls} autoComplete="address-level1" />
                  </Field>
                  <Field label="District" error={errors.district?.message}>
                    <input {...register('district')} placeholder="District" className={inputCls} />
                  </Field>
                  <Field label="Pincode" error={errors.pincode?.message}>
                    <input
                      {...register('pincode')}
                      placeholder="6-digit pincode"
                      className={inputCls}
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="postal-code"
                    />
                  </Field>
                </div>
                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                  <button type="button" onClick={() => setStep(0)} className={secondaryBtnCls}>Back</button>
                  <button type="submit" className={primaryBtnCls}>
                    <span className="sm:hidden">Continue</span>
                    <span className="hidden sm:inline">Continue to Payment</span>
                    <ChevronRight className="h-4 w-4" />
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
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button type="button" onClick={() => setStep(0)} className={secondaryBtnCls}>Back</button>
                <button
                  type="button"
                  onClick={() => void placeOrder()}
                  disabled={loading || !pickupDate}
                  className={primaryBtnCls}
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

      {/* Order summary — compact on top for mobile */}
      <div className="order-1 lg:order-2 lg:sticky lg:top-24 lg:self-start min-w-0">
        <div className="bg-surface rounded-2xl p-4 sm:p-6 space-y-4">
          <h3 className="font-display text-base sm:text-lg text-ink">Order Summary</h3>
          <ul className="space-y-3 divide-y divide-divider max-h-40 sm:max-h-none overflow-y-auto sm:overflow-visible">
            {items.map((item) => {
              const priced = quoteLineMap.get(`${item.productId}:${item.variantId}`)
              const lineTotal = priced?.line_total ?? null
              return (
              <li key={`${item.productId}-${item.variantId}`} className="pt-3 first:pt-0 flex justify-between text-sm gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-ink line-clamp-1">{item.productName}</p>
                  <p className="text-xs text-ink-muted">{item.variantLabel} · Qty {item.quantity}</p>
                </div>
                <p className="shrink-0 font-medium text-ink">
                  {loadingQuote || lineTotal == null ? '…' : formatINR(lineTotal)}
                </p>
              </li>
              )
            })}
          </ul>

          {quoteError && (
            <p className="text-xs text-red-500">{quoteError}</p>
          )}

          <div className="border-t border-divider pt-4">
            <p className="text-xs uppercase tracking-widest text-ink-muted mb-2 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" aria-hidden />
              Offers (use one)
            </p>
            {loadingCoupons ? (
              <p className="text-sm text-ink-faint">Loading offers…</p>
            ) : evaluatedCoupons.length === 0 ? (
              <p className="text-sm text-ink-faint">No offers available for this cart.</p>
            ) : (
              <ul className="space-y-2 max-h-36 sm:max-h-56 overflow-y-auto pr-0.5">
                {evaluatedCoupons.map((c) => {
                  const selected = selectedCouponId === c.id
                  const disabled = !c.applicable
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => selectCoupon(c)}
                        disabled={disabled}
                        className={`w-full text-left rounded-xl border p-2.5 text-sm transition-colors relative ${
                          !c.applicable
                            ? 'border-divider opacity-50 cursor-not-allowed'
                            : selected
                              ? 'border-teal bg-teal/5'
                              : c.is_best
                                ? 'border-gold bg-gold/5 hover:border-gold/80'
                                : 'border-divider hover:border-teal/40'
                        }`}
                      >
                        {c.is_best && c.applicable && (
                          <span className="absolute top-2 right-2 text-[0.65rem] uppercase tracking-wider font-semibold text-gold bg-gold/10 px-1.5 py-0.5 rounded">
                            Best deal
                          </span>
                        )}
                        <span className="font-mono font-semibold text-ink tracking-wide">{c.code}</span>
                        <span className="block text-[0.65rem] uppercase tracking-wider text-ink-faint mt-0.5">
                          {APPLIES_TO_LABELS[(c.applies_to as AppliesTo) ?? 'both']}
                        </span>
                        {c.description && (
                          <span className="block text-xs text-ink-muted mt-0.5 line-clamp-2 pr-16">{c.description}</span>
                        )}
                        {c.applicable && c.total_discount > 0 && (
                          <span className="block text-xs text-teal mt-0.5 font-medium">
                            Save {formatINR(c.total_discount)}
                          </span>
                        )}
                        {!c.applicable && c.reason && (
                          <span className="block text-xs text-ink-faint mt-0.5">{c.reason}</span>
                        )}
                        {c.applicable && c.min_order_amount > 0 && (
                          <span className="block text-xs text-ink-faint mt-0.5">
                            Min. {c.applies_to === 'gem_price' ? 'diamond/stone value' : c.applies_to === 'making_charge' ? 'making charge' : 'discountable value'} {formatINR(c.min_order_amount)}
                          </span>
                        )}
                        {c.applicable && (
                          <span className="block text-[0.7rem] text-ink-faint mt-0.5">
                            {selected ? 'Tap to remove' : 'Tap to apply'}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {appliedCoupon && (
              <div className="mt-2 flex items-center justify-between text-sm text-teal">
                <span>Coupon {appliedCoupon.code}</span>
                <button type="button" onClick={clearCoupon} className="inline-flex items-center gap-1 text-ink-muted hover:text-ink" aria-label="Remove coupon">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-divider pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-ink-muted"><span>Subtotal</span><span>{loadingQuote ? '…' : formatINR(subtotal)}</span></div>
            {couponOff > 0 && (
              <div className="flex justify-between text-teal">
                <span>Discount</span>
                <span>−{formatINR(couponOff)}</span>
              </div>
            )}
            <div className="flex justify-between text-ink-muted"><span>Shipping</span><span className={shipping === 0 ? 'text-teal font-medium' : ''}>{loadingQuote ? '…' : shipping === 0 ? 'FREE' : formatINR(shipping)}</span></div>
            <div className="flex justify-between text-base font-semibold text-ink pt-2 border-t border-divider"><span>Total</span><span>{loadingQuote ? '…' : formatINR(grandTotal)}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Small helper components ── */
const inputCls =
  'w-full min-h-[44px] px-3 py-3 sm:py-2.5 text-base sm:text-sm bg-bg border border-divider rounded-lg text-ink placeholder-ink-faint focus:outline-none focus:ring-1 focus:ring-teal focus:border-teal transition-colors'

const primaryBtnCls =
  'flex w-full sm:w-auto sm:flex-1 items-center justify-center gap-2 bg-deep-teal text-cream px-6 sm:px-8 py-3.5 text-sm font-medium uppercase tracking-widest rounded-xl hover:bg-teal transition-colors disabled:opacity-50'

const secondaryBtnCls =
  'w-full sm:w-auto px-6 py-3.5 text-sm border border-divider rounded-xl hover:border-teal transition-colors text-center'

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
