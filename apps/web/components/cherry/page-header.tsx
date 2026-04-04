"use client"

export function PageHeader() {
  return (
    <div className="mb-6">
      {/* Mobile: split title with different sizes */}
      <div className="block lg:hidden mb-3">
        <h1
          className="text-[20px] font-extrabold text-[#1A1626] leading-tight"
          style={{ letterSpacing: "-0.4px" }}
        >
          {"This Week's Highlight"}
        </h1>
      </div>

      {/* Desktop: single-line title */}
      <h1
        className="hidden lg:block font-extrabold text-[#1A1626] leading-none mb-2.5"
        style={{ fontSize: "30px", letterSpacing: "-0.5px" }}
      >
        {"This Week's Highlight · 이번 주 하이라이트"}
      </h1>

      <p className="text-[13px] lg:text-[15px] text-text-muted leading-relaxed">
        Digest 다이제스트 · 2026년 3월 24일 주간
      </p>
    </div>
  )
}
