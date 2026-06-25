# Amiora Diamonds — Deployment Guide

## ⚠️ Static "out" folder kyun nahi chalega

Tumhari apps mein yeh sab hai jo static export ke saath kaam nahi karta:
- Supabase SSR authentication (cookies/middleware)
- API routes (`/api/*`)
- Server Components (data fetching server-side)
- Next.js Middleware (auth protection)

Isliye ek **Node.js server** chahiye. Neeche 3 options hain — **Option A sabse aasaan hai.**

---

## ✅ Option A — Vercel (Sabse Easy — 5 min)

Vercel = Next.js banane waale. Zero config, auto-detects monorepo.

### Steps:
```
1. vercel.com pe jaao → Sign up (GitHub se)
2. "Add New Project" → GitHub repo connect karo
3. Project 1 (Storefront):
   - Framework: Next.js (auto-detect)
   - Root Directory: apps/web
   - Deploy!
4. Project 2 (CMS):
   - Same repo → "Add New Project" again
   - Root Directory: apps/cms
   - Deploy!
```

### Env Variables (har project ke liye alag set karo):

**Storefront (apps/web):**
```
NEXT_PUBLIC_SUPABASE_URL          = https://ifbyzgelotoneozqhomy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY     = eyJhbGci...PdyWbY
SUPABASE_SERVICE_ROLE_KEY         = eyJhbGci...T5w0
NEXT_PUBLIC_SITE_URL              = https://your-storefront.vercel.app
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = dqayol6fn
CLOUDINARY_CLOUD_NAME             = dqayol6fn
CLOUDINARY_API_KEY                = 465881383896453
CLOUDINARY_API_SECRET             = i1kohYlAlodMEwWGCelItA4UPdI
CMS_PRICING_SECRET                = amiora-cms-secret-2024
RAZORPAY_MODE                     = live
NEXT_PUBLIC_RAZORPAY_MODE         = live
NEXT_PUBLIC_RAZORPAY_KEY_ID       = rzp_live_xxxxx
RAZORPAY_KEY_ID                   = rzp_live_xxxxx
RAZORPAY_KEY_SECRET               = your_live_secret
```

**CMS (apps/cms):**
```
NEXT_PUBLIC_SUPABASE_URL          = https://ifbyzgelotoneozqhomy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY     = eyJhbGci...PdyWbY
SUPABASE_SERVICE_ROLE_KEY         = eyJhbGci...T5w0
NEXT_PUBLIC_SITE_URL              = https://your-cms.vercel.app
NEXT_PUBLIC_STOREFRONT_URL        = https://your-storefront.vercel.app
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = dqayol6fn
CLOUDINARY_CLOUD_NAME             = dqayol6fn
CLOUDINARY_API_KEY                = 465881383896453
CLOUDINARY_API_SECRET             = i1kohYlAlodMEwWGCelItA4UPdI
CMS_PRICING_SECRET                = amiora-cms-secret-2024
```

---

## ✅ Option B — Netlify (GitHub Auto-Deploy)

`netlify.toml` dono apps mein already ready hai.

### Steps:
```
1. netlify.com → "Add new site" → "Import from Git"
2. GitHub repo → Site 1 settings:
   Base directory  : apps/web
   Build command   : (leave blank)
   Publish dir     : .next
3. Env vars add karo (same as above)
4. Deploy!
5. Phir "Add new site" → same repo → Site 2:
   Base directory  : apps/cms
6. Done
```

---

## ✅ Option C — Local Build + Manual Upload (Netlify Drop)

Agar GitHub nahi use karna:

### Step 1 — Build karo (terminal mein):
```powershell
# Root folder mein jaao
cd "C:\Users\Sandip\Desktop\Atraski\Amiora Diamonds"

# Dependencies install
pnpm install

# Storefront build
pnpm --filter @amiora/web build

# CMS build
pnpm --filter @amiora/cms build
```

### Step 2 — Deploy:
**Netlify Drop:**
- app.netlify.com/drop pe jaao
- `apps/web/.next` folder drag-and-drop karo → **YEH KAAM NAHI KAREGA** (SSR ke liye server chahiye)

**Sahi manual deploy — Netlify CLI se:**
```powershell
# Install Netlify CLI (PowerShell as Admin)
npm install -g netlify-cli

# Login
netlify login

# Storefront deploy
cd "C:\Users\Sandip\Desktop\Atraski\Amiora Diamonds\apps\web"
netlify deploy --build --prod

# CMS deploy
cd "C:\Users\Sandip\Desktop\Atraski\Amiora Diamonds\apps\cms"
netlify deploy --build --prod
```

---

## 🔴 Supabase Auth URLs Update (MUST DO after deploy)

Jab URL mil jaaye, Supabase Dashboard mein update karo:

**Authentication → URL Configuration:**
```
Site URL: https://amioradiamonds.com

Redirect URLs:
  https://amioradiamonds.com/auth/callback
  https://amioradiamonds.com/auth/reset-password
  https://your-storefront.vercel.app/auth/callback
  https://your-storefront.vercel.app/auth/reset-password
  http://localhost:3000/auth/callback
  http://localhost:3000/auth/reset-password
```

---

## 📁 Build Output Structure (Reference)

```
apps/web/.next/          ← Storefront build output (Node.js server needed)
apps/cms/.next/          ← CMS build output (Node.js server needed)
```

> **Note:** `.next` folder directly zip karke upload nahi hota.
> Platform (Vercel/Netlify) apna server setup karta hai automatically.

---

## 🏆 Recommendation

| Platform | Ease | Free Tier | Speed |
|----------|------|-----------|-------|
| **Vercel** | ⭐⭐⭐⭐⭐ | ✅ Generous | Fastest |
| Netlify   | ⭐⭐⭐⭐   | ✅ Good     | Fast   |
| Railway   | ⭐⭐⭐     | ✅ Limited  | Good   |

**Vercel use karo — Next.js banane wale hain, best compatibility hai.**
