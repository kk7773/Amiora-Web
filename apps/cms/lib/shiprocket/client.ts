import { SHIPROCKET_BASE_URL } from './types'

export class ShiprocketApiError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = 'ShiprocketApiError'
    this.status = status
  }
}

export async function shiprocketFetch<T>(
  path: string,
  options: {
    method?: string
    token?: string
    body?: unknown
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  const res = await fetch(`${SHIPROCKET_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body != null ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  })

  const text = await res.text()
  let json: T & { message?: string } | null = null

  try {
    json = text ? (JSON.parse(text) as T & { message?: string }) : null
  } catch {
    throw new ShiprocketApiError(
      `Shiprocket returned invalid JSON (${res.status})`,
      res.status,
    )
  }

  if (!res.ok) {
    const msg =
      (json as { message?: string } | null)?.message ??
      `Shiprocket request failed (${res.status})`
    throw new ShiprocketApiError(msg, res.status)
  }

  return json as T
}
