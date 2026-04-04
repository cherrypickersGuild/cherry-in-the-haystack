"use client"

export function PageHeader() {
  return (
    <div className="mb-6">
      <h1
        className="font-extrabold text-[#1A1626] leading-none mb-2.5 text-[20px] lg:text-[30px]"
        style={{ letterSpacing: "-0.5px" }}
      >
        {"This Week's Highlight"}
      </h1>
      <p className="text-[13px] lg:text-[15px] text-text-muted leading-relaxed">
        Digest · Week of Mar 24, 2026
      </p>
    </div>
  )
}
