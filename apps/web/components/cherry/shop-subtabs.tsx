"use client"

/** Reusable underline-style tab strip for Shop sub-navigation. */

interface Props<T extends string> {
  value: T
  onChange: (v: T) => void
  options: ReadonlyArray<{ value: T; label: string; icon?: string }>
}

export function ShopSubTabs<T extends string>({ value, onChange, options }: Props<T>) {
  return (
    <div
      role="tablist"
      className="flex items-end gap-1 mb-4 border-b"
      style={{ borderColor: "#E9D1A6" }}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`relative px-3.5 py-1.5 text-[12px] font-bold transition-colors -mb-px border-b-2 cursor-pointer ${
              active
                ? "text-[#3A2A1C] border-[#B12A17]"
                : "text-[#9A7C55] border-transparent hover:text-[#6B4F2A] hover:border-[#E9D1A6]"
            }`}
          >
            {opt.icon && <span className="mr-1">{opt.icon}</span>}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
