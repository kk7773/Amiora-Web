'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { MapPin, Phone, Clock, Navigation, Loader2, Search } from 'lucide-react'
import { stagger, fadeUp } from '@/lib/animations'
import { DemoRequestModal } from '@/components/modals/DemoRequestModal'

type Timings = Record<string, string> | string | null

interface Store {
  id: string
  name: string
  address: string
  city: string
  state: string
  pincode: string
  phone: string | null
  timings: Timings
  maps_url: string | null
  lat: number | null
  lng: number | null
}

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function getTodayTiming(timings: Timings): string | null {
  if (!timings) return null
  if (typeof timings === 'string') return timings
  const today = DAYS[new Date().getDay()]
  return timings[today] ?? Object.values(timings)[0] ?? null
}

function getTimingsList(timings: Timings): { day: string; hours: string }[] | null {
  if (!timings || typeof timings === 'string') return null
  return Object.entries(timings).map(([day, hours]) => ({ day, hours }))
}

function buildDestination(store: Store): string {
  if (store.lat && store.lng) return `${store.lat},${store.lng}`
  return encodeURIComponent(`${store.address}, ${store.city}, ${store.state} ${store.pincode}, India`)
}

function openDirections(store: Store, userLat: number, userLng: number) {
  const dest = buildDestination(store)
  const url  = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${dest}&travelmode=driving`
  window.open(url, '_blank', 'noopener,noreferrer')
}

function openFallback(store: Store) {
  const url = store.maps_url
    ?? `https://www.google.com/maps/search/?api=1&query=${buildDestination(store)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

function buildEmbedSrc(store: Store) {
  if (store.lat && store.lng) return `https://www.google.com/maps?q=${store.lat},${store.lng}&z=17&output=embed`
  return `https://www.google.com/maps?q=${buildDestination(store)}&z=17&output=embed`
}

export function StoresPageClient({ stores }: { stores: Store[] }) {
  const searchParams               = useSearchParams()
  const [search, setSearch]        = useState(searchParams.get('city') ?? '')
  const [demoStore, setDemoStore]  = useState<string | null>(null)
  const [expandedId, setExpandedId]= useState<string | null>(null)
  const [loadingDir, setLoadingDir]= useState<string | null>(null)

  // Sync search when city query param changes (e.g. from StoreCitiesSection link)
  useEffect(() => {
    const city = searchParams.get('city')
    if (city) setSearch(city)
  }, [searchParams])

  function handleGetDirections(store: Store) {
    if (!navigator.geolocation) {
      openFallback(store)
      return
    }
    setLoadingDir(store.id)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoadingDir(null)
        openDirections(store, pos.coords.latitude, pos.coords.longitude)
      },
      () => {
        setLoadingDir(null)
        openFallback(store)
      },
      { timeout: 8000, maximumAge: 60_000 }
    )
  }

  const filtered = useMemo(() =>
    stores.filter((s) =>
      !search ||
      s.city.toLowerCase().includes(search.toLowerCase()) ||
      s.pincode.includes(search) ||
      s.name.toLowerCase().includes(search.toLowerCase())
    ),
    [stores, search]
  )

  const featuredStore = filtered[0] ?? stores[0] ?? null

  return (
    <div>
      {/* Hero */}
      <div className="bg-cream section-x py-16 text-center space-y-4">
        <p className="text-2xs uppercase tracking-widest2 text-teal">Visit Us</p>
        <h1 className="font-display text-display-2xl text-ink">Our Stores</h1>
        <p className="text-ink-muted max-w-md mx-auto text-sm">
          Experience AMIORA jewellery in person. Try before you buy, meet our experts, book a private appointment.
        </p>

        {stores.length > 1 && (
          <div className="relative max-w-sm mx-auto mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by city or pincode"
              className="w-full pl-9 pr-4 py-3 text-sm bg-bg border border-divider rounded-xl text-ink placeholder-ink-faint focus:outline-none focus:ring-1 focus:ring-teal transition-colors"
            />
          </div>
        )}
      </div>

      {featuredStore && (
        <div className="section-x pt-10">
          <div className="overflow-hidden rounded-3xl border border-divider bg-surface">
            <iframe
              title={`${featuredStore.name} map`}
              src={buildEmbedSrc(featuredStore)}
              className="h-[320px] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      )}

      {/* Store cards */}
      <motion.div
        className="section-x py-12"
        variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}
      >
        {filtered.length === 0 && (
          <p className="py-16 text-center text-ink-muted">No stores found for &quot;{search}&quot;.</p>
        )}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((store) => (
            <motion.div key={store.id} variants={fadeUp} className="bg-surface rounded-2xl p-6 space-y-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-deep-teal/10 rounded-xl shrink-0">
                  <MapPin className="h-5 w-5 text-deep-teal" />
                </div>
                <div>
                  <h3 className="font-display text-lg text-ink leading-tight">{store.name}</h3>
                  <p className="text-xs text-teal mt-0.5 uppercase tracking-wide">{store.city}, {store.state}</p>
                </div>
              </div>

              <p className="text-sm text-ink-muted leading-relaxed">{store.address}, {store.pincode}</p>

              <div className="space-y-1.5 text-sm">
                {store.phone && (
                  <div className="flex items-center gap-2 text-ink-muted">
                    <Phone className="h-3.5 w-3.5 text-teal shrink-0" />
                    <a href={`tel:${store.phone}`} className="hover:text-teal transition-colors">{store.phone}</a>
                  </div>
                )}
                {store.timings && (() => {
                  const todayHours  = getTodayTiming(store.timings)
                  const fullList    = getTimingsList(store.timings)
                  const isExpanded  = expandedId === store.id
                  return (
                    <div className="text-ink-muted">
                      <button
                        type="button"
                        className="flex items-center gap-2 hover:text-teal transition-colors w-full text-left"
                        onClick={() => setExpandedId(isExpanded ? null : store.id)}
                      >
                        <Clock className="h-3.5 w-3.5 text-teal shrink-0" />
                        <span>{todayHours ?? 'See timings'}</span>
                        {fullList && <span className="ml-auto text-2xs text-teal">{isExpanded ? '▲' : '▼'}</span>}
                      </button>
                      {isExpanded && fullList && (
                        <div className="mt-2 ml-5 space-y-1 text-xs border-l-2 border-divider pl-3">
                          {fullList.map(({ day, hours }) => (
                            <div key={day} className="flex justify-between gap-4">
                              <span className="text-ink-faint w-24 shrink-0">{day}</span>
                              <span>{hours}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleGetDirections(store)}
                  disabled={loadingDir === store.id}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs border border-divider rounded-lg text-ink-muted hover:border-teal hover:text-teal transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  title="Get directions from your current location"
                >
                  {loadingDir === store.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Navigation className="h-3.5 w-3.5" />
                  }
                  {loadingDir === store.id ? 'Locating…' : 'Get Directions'}
                </button>
                <button
                  onClick={() => setDemoStore(store.id)}
                  className="flex-1 px-4 py-2 text-xs bg-deep-teal text-cream rounded-lg hover:bg-teal transition-colors font-medium"
                >
                  Book Demo Here
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Demo modal */}
      <DemoRequestModal
        open={demoStore !== null}
        onOpenChange={(o) => { if (!o) setDemoStore(null) }}
        prefilledStoreId={demoStore ?? undefined}
      />
    </div>
  )
}
