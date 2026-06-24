/** Server-side Razorpay credentials (create-order API). */
export function getRazorpayServerCredentials(): {
  keyId: string | undefined
  keySecret: string | undefined
} {
  const useSandbox = process.env.NODE_ENV !== 'production'

  if (useSandbox) {
    const sandboxKeyId =
      process.env.RAZORPAY_SANDBOX_KEY_ID?.trim() ||
      process.env.NEXT_PUBLIC_RAZORPAY_SANDBOX_KEY_ID?.trim() ||
      undefined
    const sandboxKeySecret =
      process.env.RAZORPAY_SANDBOX_KEY_SECRET?.trim() ||
      process.env.NEXT_PUBLIC_RAZORPAY_SANDBOX_KEY_SECRET?.trim() ||
      undefined

    return {
      keyId: sandboxKeyId,
      keySecret: sandboxKeySecret,
    }
  }

  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || undefined
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || undefined

  return { keyId, keySecret }
}

export function getRazorpayWebhookSecret(): string | undefined {
  return (
    process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ||
    process.env.NEXT_PUBLIC_RAZORPAY_WEBHOOK_SECRET?.trim() ||
    undefined
  )
}

export function isRazorpayConfigured(): boolean {
  const { keyId, keySecret } = getRazorpayServerCredentials()
  return Boolean(keyId && keySecret)
}
