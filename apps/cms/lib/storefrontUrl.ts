export function getStorefrontUrl() {
  return (
    process.env.NEXT_PUBLIC_STOREFRONT_URL ??
    process.env.NEXT_PUBLIC_WEB_URL ??
    'https://mts.amioradiamonds.com'
  ).replace(/\/$/, '')
}
