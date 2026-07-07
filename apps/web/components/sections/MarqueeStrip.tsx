const ITEMS = [
  'Free Sizing on All Rings',
  'BIS Hallmarked Jewellery',
  '15-Days Return Policy',
  'Book a Demo',
  'Custom Design Available',
  'Free Shipping on ₹5,000+',
  'Certified Diamonds',
]

export function MarqueeStrip() {
  const doubled = [...ITEMS, ...ITEMS]

  return (
    <div className="bg-deep-teal overflow-hidden h-10 flex items-center">
      <div className="flex animate-marquee whitespace-nowrap">
        {doubled.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-4 px-6 text-sm text-cream tracking-wide"
          >
            {item}
            <span className="text-gold opacity-60">✦</span>
          </span>
        ))}
      </div>
    </div>
  )
}
