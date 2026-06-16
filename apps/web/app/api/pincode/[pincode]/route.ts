import { NextRequest, NextResponse } from 'next/server'

type PincodeCacheEntry = {
  data: PincodeResult
  expiresAt: number
}

export type PincodeResult = {
  ok: boolean
  state?: string
  district?: string
  postOffices?: { name: string }[]
  error?: string
}

const CACHE_TTL_MS = 60 * 60 * 1000
const cache = new Map<string, PincodeCacheEntry>()

type IndiaPostResponse = {
  Status?: string
  Message?: string
  PostOffice?: Array<{
    Name?: string
    District?: string
    State?: string
  }>
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pincode: string }> },
) {
  const { pincode } = await params

  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json(
      { ok: false, error: 'Enter a valid 6-digit pincode' } satisfies PincodeResult,
      { status: 400 },
    )
  }

  const cached = cache.get(pincode)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data)
  }

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: 'Could not look up pincode' } satisfies PincodeResult,
        { status: 502 },
      )
    }

    const json = (await res.json()) as IndiaPostResponse[]
    const first = json[0]

    if (!first || first.Status !== 'Success' || !first.PostOffice?.length) {
      const result: PincodeResult = {
        ok: false,
        error: first?.Message ?? 'Pincode not found',
      }
      return NextResponse.json(result, { status: 404 })
    }

    const offices = first.PostOffice
    const state = offices[0]?.State ?? ''
    const district = offices[0]?.District ?? ''
    const postOffices = offices
      .map((o) => ({ name: o.Name ?? '' }))
      .filter((o) => o.name.length > 0)

    const result: PincodeResult = {
      ok: true,
      state,
      district,
      postOffices,
    }

    cache.set(pincode, { data: result, expiresAt: Date.now() + CACHE_TTL_MS })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/pincode]', err)
    return NextResponse.json(
      { ok: false, error: 'Pincode lookup failed' } satisfies PincodeResult,
      { status: 500 },
    )
  }
}
