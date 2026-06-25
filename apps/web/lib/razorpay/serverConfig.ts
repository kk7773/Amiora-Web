/** Server-side Razorpay credentials (create-order API). */
export type RazorpayMode = 'live' | 'sandbox'

function readMode(value: string | undefined): RazorpayMode | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === 'live' || normalized === 'production') return 'live'
  if (normalized === 'sandbox' || normalized === 'test') return 'sandbox'
  return undefined
}

export function getRazorpayMode(): RazorpayMode {
  return (
    readMode(process.env.RAZORPAY_MODE) ??
    readMode(process.env.NEXT_PUBLIC_RAZORPAY_MODE) ??
    (process.env.NODE_ENV === 'production' ? 'live' : 'sandbox')
  )
}

export function getRazorpayServerCredentials(): {
  keyId: string | undefined
  keySecret: string | undefined
} {
  const mode = getRazorpayMode()
  const keyId =
    (mode === 'sandbox'
      ? process.env.RAZORPAY_SANDBOX_KEY_ID?.trim() ||
        process.env.NEXT_PUBLIC_RAZORPAY_SANDBOX_KEY_ID?.trim()
      : process.env.RAZORPAY_KEY_ID?.trim() ||
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim()) || undefined
  const keySecret =
    (mode === 'sandbox'
      ? process.env.RAZORPAY_SANDBOX_KEY_SECRET?.trim()
      : process.env.RAZORPAY_KEY_SECRET?.trim()) || undefined

  return { keyId, keySecret }
}

export function getRazorpayWebhookSecret(): string | undefined {
  return process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || undefined
}

export function isRazorpayConfigured(): boolean {
  const { keyId, keySecret } = getRazorpayServerCredentials()
  return Boolean(keyId && keySecret)
}
