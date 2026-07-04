export const AMIORA_STORE = {
  id: 'amiora-kolkata',
  name: 'Amiora Diamonds',
  city: 'Kolkata',
  state: 'West Bengal',
  pincode: '700136',
  addressLine: 'AS/170, Main Road, Chinar Park, Tegharia, Rajarhat',
  fullAddress: 'AS/170, Main Road, Chinar Park, Tegharia, Rajarhat, Kolkata, West Bengal 700136',
  phone: '090889 89888',
  email: 'info@amioradiamonds.com',
  mapsUrl:
    'https://www.google.com/maps/place/Amiora+Diamonds/@22.6246781,88.4403251,167m/data=!3m1!1e3!4m6!3m5!1s0x39f89f0055ad4be1:0xbc1a364e4cf2d3d!8m2!3d22.6242093!4d88.4404869!16s%2Fg%2F11x___754h!18m1!1e1?entry=ttu&g_ep=EgoyMDI2MDYyOS4wIKXMDSoASAFQAw%3D%3D',
  embedUrl: 'https://www.google.com/maps?q=22.6242093,88.4404869&z=17&output=embed',
  lat: 22.6242093,
  lng: 88.4404869,
} as const

function normalize(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function scoreStoreMatch(store: {
  name?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  address?: string | null
  maps_url?: string | null
  lat?: number | null
  lng?: number | null
}) {
  let score = 0

  if (store.maps_url && store.maps_url === AMIORA_STORE.mapsUrl) score += 100

  if (
    typeof store.lat === 'number' &&
    typeof store.lng === 'number' &&
    Math.abs(store.lat - AMIORA_STORE.lat) < 0.01 &&
    Math.abs(store.lng - AMIORA_STORE.lng) < 0.01
  ) {
    score += 80
  }

  if (normalize(store.city) === normalize(AMIORA_STORE.city)) score += 20
  if (normalize(store.state) === normalize(AMIORA_STORE.state)) score += 10
  if (normalize(store.pincode) === normalize(AMIORA_STORE.pincode)) score += 20

  const haystack = [
    store.name,
    store.address,
    store.city,
    store.state,
    store.pincode,
  ]
    .map(normalize)
    .join(' ')

  for (const keyword of ['amiora', 'kolkata', 'chinar park', 'tegharia', 'rajarhat', '700136']) {
    if (haystack.includes(keyword)) score += 10
  }

  return score
}

export function pickVisibleStores<T extends {
  name?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  address?: string | null
  maps_url?: string | null
  lat?: number | null
  lng?: number | null
}>(stores: T[]) {
  if (stores.length <= 1) return stores

  const ranked = [...stores]
    .map((store) => ({ store, score: scoreStoreMatch(store) }))
    .sort((a, b) => b.score - a.score)

  if ((ranked[0]?.score ?? 0) > 0) return [ranked[0]!.store]
  return stores.slice(0, 1)
}
