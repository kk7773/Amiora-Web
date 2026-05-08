// 'use client'

// import { usePricing } from '@/hooks/usePricing'
// import { formatINR }  from '@/lib/pricing/calculator'
// import { TrendingUp } from 'lucide-react'

// export function PriceTicker() {
//   const { gold, silver, loading } = usePricing()

//   if (loading) {
//     return (
//       <div className="bg-surface border-b border-divider py-3">
//         <div className="section-x flex gap-8">
//           {[1, 2].map((i) => (
//             <div key={i} className="skeleton h-4 w-40 rounded" />
//           ))}
//         </div>
//       </div>
//     )
//   }

//   const items = [
//     gold   && { label: 'Gold 999 / g',   price: gold.pricePerGram   },
//     silver && { label: 'Silver 999 / g', price: silver.pricePerGram },
//   ].filter(Boolean) as { label: string; price: number }[]

//   if (!items.length) return null

//   return (
//     <div className="bg-surface border-b border-divider py-3">
//       <div className="section-x flex flex-wrap items-center gap-6">
//         <span className="text-2xs uppercase tracking-widest2 text-ink-faint hidden sm:block">Live Rates</span>
//         {items.map(({ label, price }) => (
//           <div key={label} className="flex items-center gap-2">
//             <span className="text-xs text-ink-muted">{label}</span>
//             <span className="text-sm font-semibold text-deep-teal tabular-nums">
//               {formatINR(price)}
//             </span>
//             <TrendingUp className="h-3 w-3 text-teal" />
//           </div>
//         ))}
//         <span className="text-2xs text-ink-faint ml-auto">
//           Updated {gold ? new Date(gold.fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
//         </span>
//       </div>
//     </div>
//   )
// }
