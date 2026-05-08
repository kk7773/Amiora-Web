# AMIORA — PDP Variant System Implementation Plan
> Project: AMIORA Diamonds E-Commerce
> Stack: Next.js 14+ · TypeScript · Supabase · Cloudinary
> Date: May 2026
> Status: Planning → Implementation

---

## 1. What We Are Building

AMIORA ke har collection ke har product ke PDP pe ek **2-axis variant selection system** banana hai.

### Variant Axes (Current + Extensible)

| Axis | Current Options | Effect on PDP | Future |
|---|---|---|---|
| **Metal Color** | Rose Gold (RG), White Gold (WG), Yellow Gold (YG) | **Images change** | More colors add ho sakte hain |
| **Metal Purity** | 18Kt, 14Kt, 9Kt | **Price change** | More purities add ho sakti hain |
| **Both Combined** | 3 × 3 = 9 unique combos per product | **SKU change** | Auto-scales with new options |

> ⚠️ Schema flexible rakha hai — color ya purity future mein add karne ke liye koi code change nahi hoga, sirf database mein row add karni hogi.

### Static vs Dynamic on PDP

| Element | Type | Source |
|---|---|---|
| Product Name | Static | `products.name` |
| Description | Static | `products.description` |
| Diamond Specs | Static | `products.diamond_specs` |
| Weight | Static | `products.base_weight` |
| Reviews | Static | `reviews` table |
| **Images** | **Dynamic** | `product_color_groups` — color changes |
| **Price** | **Dynamic** | `product_variants.price` — purity changes |
| **SKU** | **Dynamic** | `product_variants.sku` — both change |
| **Add to Cart payload** | **Dynamic** | `product_variants.id` — both change |

---

## 2. SKU Structure

```
Format:  AMI + [CollectionCode] + [ProductNumber] + [Purity] + [ColorCode] + [Sequence]

Example: AMIBR  0661  18  YG  01
         │      │     │   │   └── Sequence (01, 02...)
         │      │     │   └────── Color Code (YG / WG / RG)
         │      │     └────────── Purity in Kt (18 / 14 / 09)
         │      └──────────────── Product Number in collection
         └─────────────────────── Brand + Collection (AMI + BR = AMIORA Bracelet)
```

**Collection Codes:**
| Code | Collection |
|---|---|
| BR | Bracelet |
| RG | Ring |
| NK | Necklace |
| ER | Earring |
| BD | Bangle / Kada |

**Color Codes:**
| Code | Label |
|---|---|
| YG | Yellow Gold |
| WG | White Gold |
| RG | Rose Gold |
| *(future)* | *(e.g. BG = Black Gold)* |

**Purity Codes:**
| Code | Label |
|---|---|
| 18 | 18 Karat |
| 14 | 14 Karat |
| 09 | 9 Karat |
| *(future)* | *(e.g. 22 = 22 Karat)* |

---

## 3. Supabase Database Schema

### Table 1: `products`
```sql
CREATE TABLE products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,           -- "Royal Bracelet"
  slug             TEXT UNIQUE NOT NULL,    -- "royal-bracelet"
  collection_code  TEXT NOT NULL,           -- "BR"
  product_number   TEXT NOT NULL,           -- "0661"
  description      TEXT,
  base_weight      NUMERIC,
  diamond_specs    JSONB DEFAULT '{}',      -- {shape, weight, clarity, color}
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);
```

### Table 2: `product_color_groups`
> 1 row = 1 color ke liye saari images
> Currently: 3 rows per product (RG, WG, YG) — future mein more rows add ho sakti hain

```sql
CREATE TABLE product_color_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID REFERENCES products(id) ON DELETE CASCADE,
  color_code   TEXT NOT NULL,    -- 'YG', 'WG', 'RG'
  color_label  TEXT NOT NULL,    -- 'Yellow Gold', 'White Gold', 'Rose Gold'
  images       JSONB NOT NULL DEFAULT '[]',
  -- images format: [{url: "...", alt: "...", is_primary: true/false}]
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, color_code)
);
```

### Table 3: `product_variants`
> 1 row = 1 color + purity combination = 1 unique SKU
> Currently: 9 rows per product (3 colors × 3 purities) — auto-scales with new options

```sql
CREATE TABLE product_variants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID REFERENCES products(id) ON DELETE CASCADE,
  color_code        TEXT NOT NULL,         -- 'YG', 'WG', 'RG'
  purity_kt         INTEGER NOT NULL,      -- 18, 14, 9
  sku               TEXT UNIQUE NOT NULL,  -- 'AMIBR066118YG01'
  price             NUMERIC NOT NULL,
  discounted_price  NUMERIC,
  stock_quantity    INTEGER DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, color_code, purity_kt)
);
```

### Example Data — "Royal Bracelet" (9 variants)

| SKU | color_code | purity_kt | price |
|---|---|---|---|
| AMIBR066118YG01 | YG | 18 | 45000 |
| AMIBR066114YG01 | YG | 14 | 35000 |
| AMIBR066109YG01 | YG | 9 | 25000 |
| AMIBR066118WG00 | WG | 18 | 47000 |
| AMIBR066114WG00 | WG | 14 | 37000 |
| AMIBR066109WG00 | WG | 9 | 27000 |
| AMIBR066118RG00 | RG | 18 | 46000 |
| AMIBR066114RG00 | RG | 14 | 36000 |
| AMIBR066109RG00 | RG | 9 | 26000 |

---

## 4. CMS Admin Panel — Product Add Flow

Admin panel mein product add karte time yeh 3-step form hoga:

### Step 1 — Basic Product Info
- Product Name
- Collection (dropdown: Bracelet, Ring, Necklace, Earring, Bangle)
- Product Number (auto-suggest ya manual)
- Description, Weight, Diamond Specs (JSONB fields)
- Slug (auto-generate from name)

### Step 2 — Color Groups + Image Upload
- Default 3 color tabs dikhenge: Rose Gold | White Gold | Yellow Gold
- Har color tab ke andar: multiple images upload karo (Cloudinary)
- Primary image mark karo (thumbnail ke liye)
- Images JSONB array mein store hongi per color
- Future: "Add New Color" button se naya color tab add ho sakta hai

### Step 3 — Variant Matrix (Price Grid)
- Auto-generate 3×3 grid (Color rows × Purity columns)
- Har cell mein: Price input, Discounted Price (optional), Stock Quantity
- SKU auto-generate hoga: `AMI + collectionCode + productNumber + purity + colorCode + sequence`
- Save → teeno tables mein insert ho jaata hai

---

## 5. Frontend PDP Logic (Next.js)

### Data Fetch — Single Query (Server Component)
```typescript
const { data: product } = await supabase
  .from('products')
  .select(`
    *,
    product_color_groups(*),
    product_variants(*)
  `)
  .eq('slug', slug)
  .single();
```
> ✅ Ek hi fetch — phir sab kuch in-memory state se handle hoga. No re-fetch on variant change.

### State + Derived Values (Client Component)
```typescript
// Default: pehla available color + highest purity
const [selectedColor, setSelectedColor] = useState<string>(
  product.product_color_groups[0]?.color_code ?? 'YG'
);
const [selectedPurity, setSelectedPurity] = useState<number>(18);

// Derived — computed from state, no API call
const currentImages = product.product_color_groups
  .find(g => g.color_code === selectedColor)?.images ?? [];

const activeVariant = product.product_variants
  .find(v => v.color_code === selectedColor && v.purity_kt === selectedPurity)
  ?? product.product_variants[0]; // fallback: never undefined
```

### Color Selector UI
```tsx
{product.product_color_groups
  .sort((a, b) => a.sort_order - b.sort_order)
  .map(group => (
    <button
      key={group.color_code}
      onClick={() => setSelectedColor(group.color_code)}
      className={selectedColor === group.color_code ? 'ring-2 ring-black' : ''}
    >
      {group.color_label}
    </button>
  ))}
```

### Purity Selector UI
```tsx
{[18, 14, 9].map(kt => (
  <button
    key={kt}
    onClick={() => setSelectedPurity(kt)}
    className={selectedPurity === kt ? 'bg-black text-white' : ''}
  >
    {kt}Kt
  </button>
))}
```

> ⚠️ Future-proofing: Purity list bhi database se fetch karo instead of hardcoding [18, 14, 9] — 
> `const purities = [...new Set(product.product_variants.map(v => v.purity_kt))].sort((a,b) => b-a)`

---

## 6. Previous Implementation — What Went Wrong & Fixes

### ❌ Issue 1: Flat Variant Structure (Single Table)
**What was tried:** Color + purity + images + price — sab ek hi `product_variants` table mein

**Why it failed:**
- Same color ki images 3 rows mein duplicate ho jaati thi
- Image update karne ke liye saari rows update karni padti
- No single source of truth for color-level images

**✅ Fix:** Separate `product_color_groups` table — color ke images sirf ek baar store, variants sirf price + SKU rakhte hain.

---

### ❌ Issue 2: TypeScript Type Mismatch on Netlify Build
**What was tried:** Supabase query data directly component ko pass kiya bina normalization ke

**Why it failed:**
- Local `next dev` → TypeScript errors ignore karta hai
- Netlify `next build` → strict mode mein fail
- `metal_variant.variant_name` field type mismatch

**✅ Fix:**
```typescript
const normalized = product.product_variants.map(v => ({
  ...v,
  color_code: v.color_code ?? 'YG',
  purity_kt:  v.purity_kt  ?? 18,
}));
```

---

### ❌ Issue 3: No Default Variant on Page Load
**What was tried:** useState without initial value

**Why it failed:** `activeVariant` = undefined → `activeVariant.price` → runtime crash

**✅ Fix:** Always initialize state with first available color + highest purity (18Kt default). Add ultimate fallback: `?? product.product_variants[0]`

---

### ❌ Issue 4: Re-fetching on Every Variant Change
**What was tried:** API call on every color/purity button click

**Why it failed:** Slow UX, unnecessary Supabase reads, possible race conditions

**✅ Fix:** Fetch everything once on page load → filter in-memory. No re-fetch needed.

---

## 7. Implementation Order

```
Phase 1 — Database
[ ] SQL migration run karo (3 tables: products, product_color_groups, product_variants)
[ ] Supabase TypeScript types regenerate karo (supabase gen types)

Phase 2 — CMS (Admin Panel)
[ ] Step 1 form: basic product info
[ ] Step 2 form: color groups + Cloudinary image upload
[ ] Step 3 form: variant matrix + auto SKU generation
[ ] Save API route: insert into all 3 tables atomically

Phase 3 — Storefront PDP
[ ] /products/[slug]: single Supabase fetch query
[ ] VariantSelector.tsx: reusable component (used on ALL product PDPs)
[ ] Image gallery: re-renders on color change
[ ] Price + SKU display: re-renders on purity change
[ ] Add to Cart: sends activeVariant.id
```

---

## 8. Quick Reference

| User Action | What Changes on PDP | Data Source |
|---|---|---|
| Select Color | Images gallery | `product_color_groups.images` |
| Select Purity | Price shown | `product_variants.price` |
| Select Color + Purity | SKU displayed | `product_variants.sku` |
| Click Add to Cart | Variant ID sent | `product_variants.id` |
| Page first load | Nothing — static HTML | Server rendered |

---

## 9. Scalability Notes

- **New color added** (e.g. Black Gold) → CMS mein 1 new color group add karo → PDP automatically new button dikhayega
- **New purity added** (e.g. 22Kt) → CMS mein new variants add karo → PDP automatically new purity button dikhayega
- **New collection added** (e.g. Pendant) → New collection code assign karo → same schema works
- **New product in same collection** → Same flow, different product_number → same PDP component reused

---

*Last updated: May 2026 | AMIORA Diamonds — Internal Dev Docs*
*This format applies to ALL products across ALL collections.*
