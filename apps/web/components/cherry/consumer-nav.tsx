"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { CherryBao } from "./cherry-bao"
import { useAuthTick, getAccessToken, clearAccessToken } from "@/lib/auth"

const TABS: { href: string; label: string }[] = [
  { href: "/start/workshop", label: "Workshop" },
  { href: "/start/connect",  label: "Install Skill" },
  { href: "/start/shop",     label: "Shop" },
]

export function ConsumerNav() {
  const pathname = usePathname()
  const router = useRouter()
  useAuthTick()
  const token = getAccessToken()

  function handleAuth() {
    if (getAccessToken()) {
      clearAccessToken()
      return
    }
    // 컨슈머 진입점(/start/*) 에서 로그인하면 다시 같은 경로로 돌아오도록
    const here = pathname && pathname.startsWith("/start") && pathname !== "/start/login" ? pathname : "/start"
    router.push(`/start/login?next=${encodeURIComponent(here)}`)
  }

  return (
    <header
      className="sticky top-0 z-40 border-b border-[#E9D1A6]/60 backdrop-blur"
      style={{ backgroundColor: "rgba(247, 241, 224, 0.9)" }}
    >
      <div className="w-full max-w-[1200px] mx-auto flex items-center gap-4 px-4 lg:px-6 h-14">
        {/* Brand — clicks go to landing */}
        <Link href="/start" className="flex items-center gap-2 flex-shrink-0">
          <CherryBao size={36} animate />
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold text-[#3A2A1C] tracking-tight">Cherry</div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#9A7C55]">
              for everyone
            </div>
          </div>
        </Link>

        {/* Tabs */}
        <nav className="flex items-center gap-1 flex-1 justify-center">
          {TABS.map((t) => {
            const active = pathname === t.href || (t.href !== "/start" && pathname?.startsWith(t.href))
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
                  active
                    ? "bg-[#3A2A1C] text-[#FDFBF5]"
                    : "text-[#6B4F2A] hover:bg-[#F5E4C2]/50"
                }`}
              >
                {t.label}
              </Link>
            )
          })}
        </nav>

        {/* Auth */}
        <button
          onClick={handleAuth}
          className="px-3 py-1.5 text-[12px] font-semibold rounded-full border border-[#E9D1A6] text-[#6B4F2A] hover:bg-[#F5E4C2]/40 cursor-pointer flex-shrink-0 transition-colors"
        >
          {token ? "Logout" : "Login"}
        </button>
      </div>
    </header>
  )
}
