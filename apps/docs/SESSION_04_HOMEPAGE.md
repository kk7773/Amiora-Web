# SESSION 04 — Homepage

> **Depends on:** SESSION_03 (scaffold, layout, ProductCard ready)  
> **Deliverable:** Complete, animated homepage  
> **Estimated Time:** 3–4 hours

---

## Page: `src/app/page.tsx` (Homepage)

### Sections in Order

```
1. HeroBanner
2. MarqueeStrip (trust signals)
3. FeaturedCollections
4. NewArrivals (ProductGrid)
5. MaterialShowcase (Gold / Silver / Diamond)
6. BestSellers (ProductGrid)
7. CustomizationCTA (full-width banner)
8. Testimonials (carousel)
9. BlogPreview
10. StoreLocatorTeaser
11. InstagramGrid (static or feed)
```

---

## Section Specs

### 1. HeroBanner (`src/components/sections/HeroBanner.tsx`)
```
- Full viewport height (100dvh), no scroll-below-fold on first load
- Background: full-bleed jewellery lifestyle image (Cloudinary)
- Overlay: gradient from --color-deep-teal/50 to transparent
- Left-aligned content (not centered — avoid AI template look):
  - Eyebrow text: "NEW COLLECTION 2025" (--text-xs, tracked uppercase, --color-light-teal)
  - Heading: "Crafted for  
    Every Moment" (--font-display, --text-3xl, white)
  - Subtext: short tagline (--text-base, --color-cream)
  - CTA: "Explore Collections" (primary button, --color-teal)
  - Secondary: "Book a Demo" (ghost button, white outline)
- Animation: Framer Motion fade-up on load (stagger children)
- Slide behavior: if multiple hero images, auto-play carousel with 5s interval
```

### 2. MarqueeStrip
```
Scrolling marquee (CSS animation, infinite loop):
"Free Sizing on All Rings" · "BIS Hallmarked Jewellery" · "100-Day Return Policy"
· "Book a Home Demo" · "Custom Design Available" · "EMI Available"
Background: --color-deep-teal | Text: --color-cream
Height: 40px, --text-sm
```

### 3. FeaturedCollections (`src/components/sections/FeaturedCollections.tsx`)
```
- Section heading: "Our Collections" (--font-display, --text-2xl)
- Grid: 4 collection cards (responsive: 2×2 on tablet, 4×1 on desktop)
- Each card:
  - Tall aspect ratio (3:4)
  - Collection banner image (Cloudinary)
  - Hover: slight zoom + dark overlay
  - Collection name overlay (bottom-left, --font-display, white)
  - Click → /collections/[slug]
- Data: GET /api/collections (top 4 by sort_order)
```

### 4. NewArrivals (ProductGrid)
```
- Heading: "New Arrivals" + "View All" link
- Grid: 4 product cards (from latest 4 products)
- Same ProductCard component from SESSION_03
```

### 5. MaterialShowcase
```
- 3-column layout (stacks on mobile)
- Gold (with rose/yellow/white variants visual)
- Silver (92.5 purity badge)
- Diamond (cuts visual)
- Each: icon/image + heading + short paragraph + CTA
- Background: --color-surface alternating per column
```

### 6. BestSellers (ProductGrid)
```
- Heading: "Best Sellers"
- 4 product cards (is_featured=true, sorted by orders count)
```

### 7. CustomizationCTA
```
- Full-width section
- Background: --color-deep-teal
- Left: heading "Design Your Dream Piece" + subtext + "Start Customizing" button
- Right: jewellery lifestyle image
- On mobile: stack vertically
```

### 8. Testimonials (`src/components/sections/Testimonials.tsx`)
```
- Section heading: "What Our Customers Say"
- Auto-playing carousel (3s per slide)
- Each slide: star rating + quote + customer name + location
- Navigation: dot indicators + prev/next arrows
- Data: GET /api/testimonials (is_featured=true)
```

### 9. BlogPreview
```
- Heading: "From Our Journal" + "Read All" link
- 3-column card grid
- Each card: cover image (2:3 aspect) + tag + title + date + Read More
- Data: GET /api/blogs (latest 3, published)
```

### 10. StoreLocatorTeaser
```
- Single row banner: "Visit Us In Store"
- Store count badge (e.g., "3 Stores")
- City chips (Kolkata)
- CTA: "Find Your Nearest Store"
- Background: --color-cream
```

---

## Animation Guidelines (Framer Motion)

```tsx
// Fade-up on scroll enter (use for all sections)
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
}

// Stagger children
const stagger = {
  visible: { transition: { staggerChildren: 0.1 } }
}

// Use IntersectionObserver via Framer's whileInView
<motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
```

---

## Tasks for This Session

- [ ] Build HeroBanner with Framer Motion fade-up
- [ ] Build MarqueeStrip (CSS infinite scroll marquee)
- [ ] Build FeaturedCollections grid with hover zoom
- [ ] Build MaterialShowcase 3-column section
- [ ] Build CustomizationCTA full-width banner
- [ ] Build Testimonials carousel (auto-play + dots)
- [ ] Build BlogPreview 3-column grid
- [ ] Build StoreLocatorTeaser strip
- [ ] Wire all sections to real API data
- [ ] Skeleton loading states for all data-fetched sections
- [ ] Verify full homepage on mobile (375px) and desktop (1280px)

---

## Next Session
→ **SESSION_05_COLLECTIONS_SHOP.md** — Collections pages, Shop page, filters & sorting

