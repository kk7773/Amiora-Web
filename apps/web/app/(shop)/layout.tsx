import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-screen pb-[62px] md:pb-0">{children}</main>
      <div className="hidden md:block"><Footer /></div>
      <MobileBottomNav />
    </>
  )
}
