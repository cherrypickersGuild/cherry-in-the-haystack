"use client"

import { useState } from "react"
import { Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Sidebar } from "./sidebar"

export function MobileSidebar({
  active,
  onSelect,
}: {
  active: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-gray-100 transition-colors"
          aria-label="메뉴 열기"
        >
          <Menu size={20} />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="p-0 w-[240px] sm:max-w-[240px]">
        <Sidebar
          active={active}
          onSelect={(id) => { onSelect(id); setOpen(false) }}
          hideLogo={true}
          className="h-full min-h-0"
        />
      </SheetContent>
    </Sheet>
  )
}
