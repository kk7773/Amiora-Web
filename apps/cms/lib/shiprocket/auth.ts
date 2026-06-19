import { shiprocketFetch } from './client'
import type { ShiprocketLoginResponse } from './types'

const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000 // refresh before 10-day expiry

let cachedToken: string | null = null
let tokenExpiresAt = 0

function getCredentials() {
  const email = process.env.SHIPROCKET_API_EMAIL
  const password = process.env.SHIPROCKET_API_PASSWORD

  if (!email || !password) {
    throw new Error('Shiprocket API credentials are not configured (SHIPROCKET_API_EMAIL / SHIPROCKET_API_PASSWORD)')
  }

  return { email, password }
}

export async function getShiprocketToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken
  }

  const { email, password } = getCredentials()

  const data = await shiprocketFetch<ShiprocketLoginResponse>('/v1/external/auth/login', {
    method: 'POST',
    body: { email, password },
  })

  if (!data.token) {
    throw new Error(data.message ?? 'Shiprocket login failed — no token returned')
  }

  cachedToken = data.token
  tokenExpiresAt = Date.now() + TOKEN_TTL_MS
  return cachedToken
}

/** Clear cached token (useful after auth errors). */
export function clearShiprocketToken() {
  cachedToken = null
  tokenExpiresAt = 0
}
