import type { ReactNode } from "react"
import { ConsumerNav } from "@/components/cherry/consumer-nav"

export default function StartLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#F7F1E0", color: "#3A2A1C" }}
    >
      <ConsumerNav />
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 lg:px-6 py-4 lg:py-8">
        {children}
      </main>
      <footer className="border-t border-[#E9D1A6]/50 mt-8">
        <div className="w-full max-w-[1200px] mx-auto px-4 lg:px-6 py-4 flex items-center justify-between text-[11px] text-[#9A7C55]">
          <span>© Cherry Bao</span>
          <a href="/" className="hover:text-[#6B4F2A] transition-colors">
            For developers →
          </a>
        </div>
      </footer>
    </div>
  )
}
