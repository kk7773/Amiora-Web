/** Server-side Razorpay credentials (create-order API). */
export function getRazorpayServerCredentials(): {
  keyId: string | undefined
  keySecret: string | undefined
} {
  const keyId =
    process.env.RAZORPAY_KEY_ID?.trim() ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() ||
    undefined

  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || undefined

  return { keyId, keySecret }
}

export function isRazorpayConfigured(): boolean {
  const { keyId, keySecret } = getRazorpayServerCredentials()
  return Boolean(keyId && keySecret)
}
