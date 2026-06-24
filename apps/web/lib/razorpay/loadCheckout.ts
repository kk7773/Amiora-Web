const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js'

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void
      on: (event: string, handler: () => void) => void
    }
  }
}

/** Ensures Razorpay checkout.js is loaded before opening the payment modal. */
export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay can only load in the browser'))
  }

  if (window.Razorpay) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_SCRIPT_URL}"]`,
    )

    if (existing) {
      if (window.Razorpay) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = RAZORPAY_SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'))
    document.body.appendChild(script)
  })
}

export function getPublicRazorpayKeyId(): string | undefined {
  if (process.env.NODE_ENV !== 'production') {
    return (
      process.env.NEXT_PUBLIC_RAZORPAY_SANDBOX_KEY_ID?.trim() ||
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() ||
      undefined
    )
  }

  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || undefined
}
