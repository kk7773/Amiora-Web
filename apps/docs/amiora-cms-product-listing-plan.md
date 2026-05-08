# AMIORA CMS — Product Listing & Variant Management Plan

> **Project:** AMIORA Diamonds E-Commerce  
> **Stack:** Next.js 14+ · TypeScript · Supabase · Cloudinary  
> **Scope:** CMS Product Creation with Multi-Axis Variant System (Color × Purity)  
> **Date:** May 2026

---

## 1. Overview & Architecture Philosophy

The AMIORA product system is built on a **2-axis variant model**:

- **Axis 1 — Color** → Controls product **images** (Yellow = gold-toned photos, White = silver-toned, Rose = pink-toned)
- **Axis 2 — Metal Purity** → Controls **price** (9Kt < 14Kt < 18Kt)
- **Color × Purity** → Generates a unique **SKU** for every combination

Both the CMS and Webapp share the **same Supabase backend**. Any change in CMS is instantly reflected on the storefront — no sync needed.

```
Admin (CMS)
    ↓ writes to
Supabase (Single Source of Truth)
    ↓ reads from
Storefront (Webapp)
```

---

## 2. SKU Design System

### Format
```
AMI - {CAT} - {NUM} - {PURITY} - {COLOR}

Example: AMI-BR-001-18-YG
```

### Breakdown

| Segment   | Meaning                        | Examples                      |
|-----------|--------------------------------|-------------------------------|
| `AMI`     | Brand — AMIORA                 | Fixed                         |
| `{CAT}`   | Category Code                  | BR, RN, ER, NK, BG            |
| `{NUM}`   | Product # within category      | 001, 002, 003 ...             |
| `{PURITY}`| Metal Purity                   | 18, 14, 09 (scalable)         |
| `{COLOR}` | Metal Color Code               | YG, WG, RG (scalable)         |

### Category Codes

| Category       | Code |
|----------------|------|
| Bracelet       | BR   |
| Ring           | RN   |
| Earring        | ER   |
| Necklace       | NK   |
| Bangle         | BG   |
| Pendent        | PD   |
| Chain          | CN   |
| Payel          | PL   |
| Mangal Sutra   | MS   |
| NosePin        | NP   |

### Color Codes (Flexible — CMS se add ho sake)

| Color       | Code |
|-------------|------|
| Yellow Gold | YG   |
| White Gold  | WG   |
| Rose Gold   | RG   |
| (future)    | PT (Platinum), SL (Silver) etc. |

### Purity Codes (Scalable)

| Purity   | Code |
|----------|------|
| 18Kt     | 18   |
| 14Kt     | 14   |
| 9Kt      | 09   |
| (future) | 22, PT (Platinum) etc. |

### Auto-Generation Logic (TypeScript)
```typescript
const CATEGORY_CODES: Record<string, string> = {
  Bracelet: 'BR', Ring: 'RN', Earring: 'ER',
  Necklace: 'NK', Bangle: 'BG', Pendent: 'PD',
  Chain: 'CN', Payel: 'PL', 'Mangal Sutra': 'MS', NosePin: 'NP',
};

function generateSKU(
  category: string,
  productNumber: number,
  purityCode: string,   // e.g. "18", "14", "09"
  colorCode: string     // e.g. "YG", "WG", "RG"
): string {
  const catCode = CATEGORY_CODES[category] ?? 'XX';
  const num = String(productNumber).padStart(3, '0');
  return `AMI-${catCode}-${num}-${purityCode}-${colorCode}`;
  // → AMI-BR-001-18-YG
}
```

> **Note:** Product number auto-increments per category. Admin can override manually if needed.

---

## 3. Supabase Database Schema

### 3.1 `metal_purities` — Master Table (Scalable)
```sql
CREATE TABLE metal_purities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label        TEXT NOT NULL UNIQUE,   -- "18Kt Gold", "14Kt Gold", "9Kt Gold"
  code         TEXT NOT NULL UNIQUE,   -- "18", "14", "09"
  display_order INT DEFAULT 0,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Seed data
INSERT INTO metal_purities (label, code, display_order) VALUES
  ('18Kt Gold', '18', 1),
  ('14Kt Gold', '14', 2),
  ('9Kt Gold',  '09', 3);
```

### 3.2 `metal_colors` — Master Table (Flexible)
```sql
CREATE TABLE metal_colors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label        TEXT NOT NULL UNIQUE,   -- "Yellow Gold"
  code         TEXT NOT NULL UNIQUE,   -- "YG"
  hex          TEXT,                   -- "#F5C518"
  display_order INT DEFAULT 0,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Seed data
INSERT INTO metal_colors (label, code, hex, display_order) VALUES
  ('Yellow Gold', 'YG', '#E8C97A', 1),
  ('White Gold',  'WG', '#E0E0E0', 2),
  ('Rose Gold',   'RG', '#E8A598', 3);
```

### 3.3 `categories` — Master Table
```sql
CREATE TABLE categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,   -- "Bracelet"
  code         TEXT NOT NULL UNIQUE,   -- "BR"
  slug         TEXT NOT NULL UNIQUE,   -- "bracelets"
  display_order INT DEFAULT 0,
  is_active    BOOLEAN DEFAULT true
);
```

### 3.4 `collections` — Optional (Future-Ready)
```sql
CREATE TABLE collections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,          -- "Tennis Collection"
  slug         TEXT UNIQUE NOT NULL,
  description  TEXT,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

### 3.5 `products` — Parent Product Table
```sql
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  category_id     UUID REFERENCES categories(id),
  collection_id   UUID REFERENCES collections(id),  -- nullable, future use
  product_number  INT NOT NULL,      -- auto-incremented per category (001, 002...)
  
  -- Static Description (same across all variants)
  description     TEXT,
  short_desc      TEXT,
  
  -- Diamond Specifications (Static — same for all variants)
  diamond_shape   TEXT,              -- "Round Brilliant"
  diamond_count   INT,               -- 28
  total_diamond_wt DECIMAL(6,3),     -- 1.50 ct
  diamond_color   TEXT,              -- "G-H"
  diamond_clarity TEXT,              -- "SI1-SI2"
  
  -- Physical Specs (Static)
  size_range      TEXT,              -- "6.5 inches"
  
  -- Meta / SEO
  meta_title      TEXT,
  meta_description TEXT,
  
  -- Status
  status          TEXT DEFAULT 'draft',  -- 'draft' | 'active' | 'archived'
  is_featured     BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

### 3.6 `product_color_groups` — Color → Images Mapping
```sql
CREATE TABLE product_color_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID REFERENCES products(id) ON DELETE CASCADE,
  color_id     UUID REFERENCES metal_colors(id),
  
  -- Images array (Cloudinary URLs)
  images       TEXT[] DEFAULT '{}',  -- [url1, url2, url3...]
  
  display_order INT DEFAULT 0,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(product_id, color_id)  -- ek product mei ek color ek baar
);
```

### 3.7 `product_variants` — SKU-Level Rows (Price + Combo)
```sql
CREATE TABLE product_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  color_group_id  UUID REFERENCES product_color_groups(id),
  color_id        UUID REFERENCES metal_colors(id),
  purity_id       UUID REFERENCES metal_purities(id),
  
  -- Auto-generated SKU
  sku             TEXT UNIQUE NOT NULL,  -- "AMI-BR-001-18-YG"
  
  -- Price for this exact combination
  price           DECIMAL(12,2) NOT NULL,
  
  -- Stock
  stock_qty       INT DEFAULT 0,
  
  -- Status
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(product_id, color_id, purity_id)  -- no duplicate combos
);
```

### Full Schema — Entity Relationship

```
metal_colors ──────────┐
                        ├──→ product_color_groups ──→ products ←── categories
metal_purities ─────────┤                                │
                        └──→ product_variants ───────────┘
                                    │
                                    └── collections (optional, future)
```

---

## 4. CMS Product Form — UI Flow

### Form Structure (Single Page, Sectioned)

```
┌─────────────────────────────────────────────────┐
│  SECTION 1: Basic Information                   │
│  ─────────────────────────────────────────────  │
│  Product Name  : [________________________]      │
│  Slug          : [auto-generated, editable]      │
│  Category      : [Bracelet ▼]                   │
│  Collection    : [None ▼] (optional)             │
│  Product #     : [001] (auto, editable)          │
│  Short Desc    : [________________________]      │
│  Description   : [Rich Text Editor]              │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  SECTION 2: Diamond Specifications (Static)     │
│  ─────────────────────────────────────────────  │
│  Diamond Shape    : [Round Brilliant]            │
│  Diamond Count    : [28]                         │
│  Total Diamond Wt : [1.50] ct                   │
│  Diamond Color    : [G-H]                        │
│  Diamond Clarity  : [SI1-SI2]                   │
│  Size / Length    : [6.5 inches]                │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  SECTION 3: Color Variants + Images             │
│  ─────────────────────────────────────────────  │
│  [+ Add Color Variant]                          │
│                                                 │
│  ┌── Yellow Gold ──────────────────────────┐   │
│  │  Color: ● Yellow Gold  Code: YG          │   │
│  │  Images: [Upload] [img1][img2][img3][+]  │   │
│  │                          [Delete Color] │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌── White Gold ───────────────────────────┐   │
│  │  Color: ● White Gold   Code: WG          │   │
│  │  Images: [Upload] [img1][img2][+]        │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  SECTION 4: Pricing Matrix                      │
│  (Auto-renders when colors are added above)     │
│  ─────────────────────────────────────────────  │
│                  9Kt Gold  14Kt Gold  18Kt Gold  │
│  Yellow Gold  [₹ _____]  [₹ _____]  [₹ _____] │
│  White Gold   [₹ _____]  [₹ _____]  [₹ _____] │
│  Rose Gold    [₹ _____]  [₹ _____]  [₹ _____] │
│                                                 │
│  SKU Preview (auto-shown below each cell):      │
│  AMI-BR-001-09-YG  AMI-BR-001-14-YG  AMI-BR-001-18-YG  │
│  AMI-BR-001-09-WG  AMI-BR-001-14-WG  AMI-BR-001-18-WG  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  SECTION 5: SEO & Publish                       │
│  ─────────────────────────────────────────────  │
│  Meta Title       : [________________________]   │
│  Meta Description : [________________________]   │
│  Status           : [Draft ▼ / Active]           │
│  Featured         : [ ] Mark as Featured         │
│                                                 │
│  [Save Draft]              [Publish Product]    │
└─────────────────────────────────────────────────┘
```

---

## 5. What is Static vs Dynamic on PDP

| PDP Element               | Type         | Source Table            | Changes When        |
|---------------------------|--------------|-------------------------|---------------------|
| Product Name              | **Static**   | `products.name`         | Never               |
| Description               | **Static**   | `products.description`  | Never               |
| Diamond Specs (all)       | **Static**   | `products.*`            | Never               |
| Size / Length             | **Static**   | `products.size_range`   | Never               |
| Product Images            | **Dynamic**  | `product_color_groups`  | Color changes       |
| Price                     | **Dynamic**  | `product_variants.price`| Purity changes      |
| SKU                       | **Dynamic**  | `product_variants.sku`  | Color + Purity both |
| Color selector active     | **Dynamic**  | Frontend state          | User clicks color   |
| Purity selector active    | **Dynamic**  | Frontend state          | User clicks purity  |
| Add to Cart payload       | **Dynamic**  | `activeVariant.id`      | Both change         |
| Special Offer / Coupon    | **Semi**     | CMS config / hardcoded  | Coupon campaign     |

---

## 6. Webapp PDP — Data Fetching & State Logic

### Supabase Query
```typescript
// app/products/[slug]/page.tsx (Server Component)
const { data: product } = await supabase
  .from('products')
  .select(`
    *,
    category:categories(name, code),
    collection:collections(name, slug),
    color_groups:product_color_groups(
      *,
      color:metal_colors(label, code, hex)
    ),
    variants:product_variants(
      *,
      color:metal_colors(label, code),
      purity:metal_purities(label, code, display_order)
    )
  `)
  .eq('slug', slug)
  .eq('status', 'active')
  .single();
```

### Client-Side Variant Selector Logic
```typescript
// components/VariantSelector.tsx
'use client';

const [selectedColor, setSelectedColor] = useState(
  product.color_groups[0]?.color.code ?? ''
);
const [selectedPurity, setSelectedPurity] = useState('18');

// Active images — driven by color only
const activeImages = useMemo(() =>
  product.color_groups.find(g => g.color.code === selectedColor)?.images ?? []
, [selectedColor]);

// Active variant — driven by color + purity
const activeVariant = useMemo(() =>
  product.variants.find(
    v => v.color.code === selectedColor && v.purity.code === selectedPurity
  )
, [selectedColor, selectedPurity]);

// Active price and SKU come from activeVariant
const activePrice = activeVariant?.price;
const activeSKU   = activeVariant?.sku;
```

---

## 7. Cursor Prompt — Full Implementation

```
I am building a CMS + E-Commerce Webapp for AMIORA Diamonds.

Stack:
- Next.js 14+ App Router
- TypeScript
- Supabase (PostgreSQL + Auth + Storage)
- Cloudinary (image uploads)
- Tailwind CSS

=== CONTEXT ===
Products have a 2-axis variant system:
  Axis 1 — Metal Color (e.g. Yellow Gold, White Gold, Rose Gold) → drives IMAGES
  Axis 2 — Metal Purity (e.g. 18Kt, 9Kt, 14Kt) → drives PRICE
  Color + Purity → unique SKU (format: AMI-{CAT}-{NUM}-{PURITY}-{COLOR})

Example SKUs:
  AMI-BR-001-18-YG → Bracelet #001, 18Kt, Yellow Gold
  AMI-BR-001-14-WG → Bracelet #001, 14Kt, White Gold
  AMI-BR-001-09-RG → Bracelet #001, 9Kt, Rose Gold

Colors and Purities are FLEXIBLE — managed from CMS master tables.

=== STEP 1: Supabase SQL Migration ===
Create the following tables:
1. metal_purities (id, label, code, display_order, is_active)
   Seed: 18Kt Gold (18), 14Kt Gold (14), 9Kt Gold (09)

2. metal_colors (id, label, code, hex, display_order, is_active)
   Seed: Yellow Gold (YG, #E8C97A), White Gold (WG, #E0E0E0), Rose Gold (RG, #E8A598)

3. categories (id, name, code, slug, display_order, is_active)
   Seed: Bracelet(BR), Ring(RN), Earring(ER), Necklace(NK), Bangle(BG)

4. collections (id, name, slug, description, is_active) — nullable FK, future use

5. products (id, name, slug, category_id, collection_id, product_number,
             description, short_desc, diamond_shape, diamond_count,
             total_diamond_wt, diamond_color, diamond_clarity,
             size_range, meta_title, meta_description, status, is_featured,
             created_at, updated_at)
   - product_number is auto-incremented per category
   - status: 'draft' | 'active' | 'archived'

6. product_color_groups (id, product_id, color_id, images TEXT[], display_order, is_active)
   UNIQUE(product_id, color_id)

7. product_variants (id, product_id, color_group_id, color_id, purity_id, sku, price, stock_qty, is_active)
   UNIQUE(product_id, color_id, purity_id)
   UNIQUE(sku)

Add RLS policies:
  - Anon can SELECT active products, variants, color_groups, metal_colors, metal_purities
  - Authenticated admin can INSERT, UPDATE, DELETE all

=== STEP 2: CMS Product Form (/admin/products/new) ===
Build a single-page form with 5 sections:

SECTION 1 — Basic Info
  - Product Name (text input)
  - Slug (auto-generated from name, manually editable)
  - Category (dropdown from categories table)
  - Collection (dropdown from collections, optional/nullable)
  - Product Number (auto-suggest next available per category, editable)
  - Short Description (text input)
  - Description (textarea or rich text)

SECTION 2 — Diamond Specifications
  - Diamond Shape (text)
  - Diamond Count (number)
  - Total Diamond Weight in carats (decimal)
  - Diamond Color (text, e.g. G-H)
  - Diamond Clarity (text, e.g. SI1-SI2)
  - Size / Length (text)

SECTION 3 — Color Variants + Images
  - [+ Add Color Variant] button
  - Each color card shows:
    - Color dropdown (from metal_colors table)
    - Color swatch preview (hex)
    - Cloudinary image uploader (multiple images, drag reorder)
    - [Remove Color] button
  - Colors added here drive Section 4 matrix rows

SECTION 4 — Pricing Matrix
  - Auto-renders as a grid: Rows = Colors added, Columns = all active metal_purities
  - Each cell: price input (₹)
  - Below each cell: SKU preview (auto-computed, read-only)
  - SKU formula: AMI-{catCode}-{productNum padded 3}-{purityCode}-{colorCode}

SECTION 5 — SEO + Publish
  - Meta Title
  - Meta Description
  - Status toggle (Draft / Active)
  - Is Featured checkbox
  - [Save Draft] and [Publish] buttons

On Submit:
  1. INSERT into products
  2. For each color: INSERT into product_color_groups (with uploaded Cloudinary URLs)
  3. For each color × purity cell: INSERT into product_variants (with generated SKU)

=== STEP 3: Webapp PDP Page (/products/[slug]) ===
Build a Server Component that:
  1. Fetches product with all color_groups, variants, category, collection
  2. Passes data to a Client Component <VariantSelector />

<VariantSelector /> handles:
  - selectedColor state (default: first color)
  - selectedPurity state (default: highest purity, e.g. 18Kt)
  - activeImages = color_groups.find(color === selectedColor).images
  - activeVariant = variants.find(color === selectedColor AND purity === selectedPurity)
  - activePrice = activeVariant.price
  - activeSKU = activeVariant.sku
  
  UI:
  - Image gallery (driven by activeImages — changes on color select)
  - Color selector: colored dot buttons, active state border
  - Purity selector: text buttons (9Kt, 14Kt, 18Kt), active state border
  - SKU display (driven by activeVariant.sku)
  - Price display (driven by activeVariant.price, formatted as ₹X,XX,XXX)
  - Add to Cart button → sends activeVariant.id to cart

Static sections (same for all variants):
  - Product name
  - Description
  - Diamond specs table
  - Size/length
  - Pincode checker
  - Delivery info

=== STEP 4: CMS Master Tables Management ===
Build simple CRUD pages:
  - /admin/settings/colors → Add/Edit/Delete metal colors (label, code, hex)
  - /admin/settings/purities → Add/Edit/Delete metal purities (label, code, display_order)
  - /admin/settings/categories → Add/Edit/Delete categories

These pages let admin add new colors (e.g. Platinum) or new purities (e.g. 22Kt) in future without code changes.

=== IMPORTANT RULES ===
- TypeScript strict mode throughout
- Supabase client: use server-side client for all data fetching in Server Components
- Cloudinary upload: use unsigned upload preset, return secure_url, store in images TEXT[]
- All prices stored in decimal, displayed with Indian number formatting (toLocaleString('en-IN'))
- SKU auto-generated on frontend, never editable by admin
- Slug auto-generated from product name (kebab-case), admin can manually edit
- Product number auto-suggested as (max product_number in category + 1)

Start with Step 1 (SQL migration). Show the complete SQL, then wait for confirmation before Step 2.
```

---

## 8. Execution Checklist

### Phase 1 — Database (Supabase)
- [ ] Run SQL migration (master tables first, then products, then variants)
- [ ] Seed metal_colors, metal_purities, categories
- [ ] Set RLS policies (anon read, admin write)
- [ ] Test queries in Supabase SQL editor

### Phase 2 — CMS Form
- [ ] Build `/admin/products/new` form (5 sections)
- [ ] Cloudinary upload integration per color
- [ ] Pricing matrix auto-render
- [ ] SKU auto-generation preview
- [ ] Save/Publish flow (3 sequential INSERTs)
- [ ] Edit existing product (`/admin/products/[id]/edit`)

### Phase 3 — Webapp PDP
- [ ] Server component fetch with full joins
- [ ] `<VariantSelector />` client component
- [ ] Image gallery with color-driven swap
- [ ] Price + SKU update on selection
- [ ] Add to Cart with variant ID

### Phase 4 — Master Settings (CMS)
- [ ] `/admin/settings/colors` CRUD
- [ ] `/admin/settings/purities` CRUD
- [ ] `/admin/settings/categories` CRUD

---

## 9. Future Scalability

| Feature            | How It's Ready                                          |
|--------------------|---------------------------------------------------------|
| New color added    | Add row to `metal_colors` → appears in CMS dropdown and storefront |
| New purity added   | Add row to `metal_purities` → new column in pricing matrix |
| Collections added  | `collection_id` already on products table (nullable FK) |
| New category       | Add row to `categories` → auto-code + auto-SKU prefix   |
| Platinum / 22Kt    | Just add to master tables — no code change needed       |
| Size variants      | Add `size_id` axis to `product_variants` (future step)  |

