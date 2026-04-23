"use client"

import { KaasCatalogPage } from "@/components/cherry/kaas-catalog-page"

export default function ShopPage() {
  return (
    <div>
      <header className="mb-4">
        <h1 className="text-[22px] font-extrabold text-[#3A2A1C]">Shop</h1>
        <p className="text-[12px] text-[#9A7C55] mt-1">
          AI 에게 필요한 기술을 둘러보세요.
        </p>
      </header>
      {/* Reuse the existing catalog. It already handles search / categories / compare. */}
      <KaasCatalogPage />
    </div>
  )
}
