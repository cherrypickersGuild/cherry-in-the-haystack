"use client"

import Link from "next/link"
import { CherryBao } from "@/components/cherry/cherry-bao"
import { AssemblyBlocks } from "@/components/cherry/assembly-blocks"
import { CryptoChart, AuctionTicket, PhoneChat } from "@/components/cherry/showcase-visuals"

export default function StartLanding() {
  return (
    <div className="space-y-20 pb-12">
      {/* ══════════ Hero — editorial, two-column ══════════ */}
      <section className="relative overflow-hidden pt-10 lg:pt-16 pb-4">
        <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8 relative z-10 max-w-[900px] mx-auto">
          <div className="text-center lg:text-left order-2 lg:order-1 flex-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-5" style={{ backgroundColor: "#EDE0C2" }}>
              <span className="w-1 h-1 rounded-full bg-[#B12A17]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6B4F2A]">
                Build your own AI
              </span>
            </div>

            <h1 className="text-[30px] lg:text-[42px] font-extrabold text-[#2A1E15] tracking-tight leading-[1.08] max-w-[640px] mx-auto lg:mx-0">
              Your personal AI assistant,
              <br />
              <span className="text-[#B12A17]">assembled</span> like a game character.
            </h1>

            <p className="mt-5 text-[14px] lg:text-[15px] text-[#6B4F2A] leading-relaxed max-w-[440px] mx-auto lg:mx-0">
              Pick skill cards, drag to equip. That's it.
              <br className="hidden lg:block" />
              No coding needed — build your own assistant.
            </p>

            <div className="mt-8 flex items-center gap-2.5 flex-wrap justify-center lg:justify-start">
              <Link
                href="/start/workshop"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#B12A17] text-white text-[13px] font-bold hover:bg-[#8F1D12] transition-colors"
              >
                Start building
                <span className="text-[11px]">→</span>
              </Link>
              <Link
                href="/start/shop"
                className="inline-flex items-center px-5 py-2.5 rounded-full text-[#6B4F2A] text-[13px] font-semibold hover:bg-[#EDE0C2]/60 transition-colors"
                style={{ border: "1px solid #E9D1A6" }}
              >
                Browse skills
              </Link>
            </div>
          </div>

          <div className="flex justify-center order-1 lg:order-2 flex-shrink-0">
            <AssemblyBlocks size={220} />
          </div>
        </div>

        {/* Soft blob — inside bounds, no overflow */}
        <div
          className="absolute top-0 right-0 w-[240px] h-[240px] rounded-full opacity-25 pointer-events-none"
          style={{ background: "radial-gradient(circle, #FBE8E3, transparent 70%)" }}
        />
      </section>

      {/* ══════════ How it works ══════════ */}
      <section>
        <div className="text-center mb-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9A7C55] mb-2">How it works</p>
          <h2 className="text-[22px] lg:text-[26px] font-extrabold text-[#2A1E15] tracking-tight">
            Done in three steps.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-[20px] bg-[#FDFBF5] p-6 text-center"
              style={{ border: "1px solid #E9D1A6", boxShadow: "0 4px 20px rgba(107,79,42,0.08)" }}
            >
              <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-[18px] font-black"
                style={{ backgroundColor: "#3A2A1C" }}
              >
                {s.n}
              </div>
              <div className="text-[32px] mb-2">{s.emoji}</div>
              <h3 className="text-[16px] font-extrabold text-[#3A2A1C] mb-2">{s.title}</h3>
              <p className="text-[13px] text-[#6B4F2A] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ Showcase — zigzag storytelling ══════════ */}
      <section>
        <div className="flex items-end justify-between mb-20 lg:mb-28 flex-wrap gap-2 pb-6 border-b border-[#E9D1A6]/50">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9A7C55] mb-1.5">Showcase</p>
            <h2 className="text-[22px] lg:text-[26px] font-extrabold text-[#2A1E15] tracking-tight">
              This is how your assistant talks to you.
            </h2>
            <p className="text-[13px] text-[#9A7C55] mt-1.5">
              Real messages, charts, and alerts your sample will send.
            </p>
          </div>
          <Link
            href="/start/shop"
            className="text-[12px] font-bold text-[#B12A17] hover:underline"
          >
            Browse skills →
          </Link>
        </div>

        <div className="space-y-28 lg:space-y-32">
          {SAMPLES.map((s, i) => (
            <ShowcaseRow key={s.title} sample={s} reversed={i % 2 === 1} />
          ))}
        </div>
      </section>

      {/* ══════════ Bottom CTA ══════════ */}
      <section
        className="rounded-[24px] p-8 lg:p-10 flex items-center gap-6 lg:gap-8 flex-wrap justify-center text-center lg:text-left"
        style={{
          background: "linear-gradient(135deg, #FBEFD8 0%, #F0E0B8 100%)",
          border: "1px solid #E9D1A6",
        }}
      >
        <CherryBao size={72} variant="celebrate" />
        <div className="flex-1 min-w-[240px]">
          <h2 className="text-[20px] lg:text-[22px] font-extrabold text-[#2A1E15] tracking-tight">
            Now it's your turn.
          </h2>
          <p className="mt-1.5 text-[13px] text-[#6B4F2A]">
            Sign up and get 200 free credits. Ready right away.
          </p>
        </div>
        <Link
          href="/start/workshop"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#B12A17] text-white text-[13px] font-bold hover:bg-[#8F1D12] transition-colors flex-shrink-0"
        >
          Start building
          <span className="text-[11px]">→</span>
        </Link>
      </section>
    </div>
  )
}

const STEPS = [
  {
    n: 1,
    emoji: "🎒",
    title: "Pick your skills",
    desc: "Browse skill cards at the Shop — RAG, coding, reasoning, and more. Pick what you need.",
  },
  {
    n: 2,
    emoji: "⚔️",
    title: "Drag to equip",
    desc: "Drop onto your character's slots and it's equipped. Save up to 3 different builds.",
  },
  {
    n: 3,
    emoji: "✨",
    title: "Your AI is ready",
    desc: "Plug it into Claude Code. One line in your terminal — you're live.",
  },
]

type Sample = {
  emoji: string
  title: string
  category: string
  hook: string
  desc: string
  assistantName: string
  accent: string
  visual: "chart" | "ticket" | "phone"
  notif: { title: string; body: string; when: string }
}

const SAMPLES: Sample[] = [
  {
    emoji: "📈",
    title: "Crypto Watcher",
    category: "Crypto",
    hook: "Eyes on the market — even while you sleep",
    desc: "Watches your tracked coins 24/7 and pings you on big swings and wallet changes. The timing you used to miss while sipping coffee — your assistant catches it now.",
    assistantName: "Crypto Watcher",
    accent: "#B12A17",
    visual: "chart",
    notif: {
      title: "BTC broke +18% · Sell the top?",
      body: "$68,400 → $80,734 in 30 min",
      when: "Just now",
    },
  },
  {
    emoji: "🔨",
    title: "Auction Sniper",
    category: "Auction",
    hook: "Strikes right before the gavel",
    desc: "Watches auctions across multiple sites at the same time. Closing soon, bid changes, new listings — it never misses the moment, so you don't have to sit and refresh.",
    assistantName: "Auction Watcher",
    accent: "#B12A17",
    visual: "ticket",
    notif: {
      title: "5 min to close · bid $245",
      body: "Your watched poster, closing now.",
      when: "2 min ago",
    },
  },
  {
    emoji: "⚡",
    title: "Marketplace Hunter",
    category: "Used Market",
    hook: "The best deals go to the fastest",
    desc: "The moment a matching listing goes up, your assistant finds it and messages you. Even a 3am listing — you get the shot to message the seller before anyone else.",
    assistantName: "Deal Hunter",
    accent: "#B12A17",
    visual: "phone",
    notif: {
      title: "Just listed · LG Gram 16\" sealed $590",
      body: "Matches filter · $90 below market",
      when: "3 sec ago",
    },
  },
]

function SampleVisual({ sample }: { sample: Sample }) {
  switch (sample.visual) {
    case "chart":  return <CryptoChart sample={sample} />
    case "ticket": return <AuctionTicket sample={sample} />
    case "phone":  return <PhoneChat sample={sample} />
  }
}

function ShowcaseRow({ sample, reversed }: { sample: Sample; reversed: boolean }) {
  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-20 items-center">
      <div className={`flex justify-center ${reversed ? "lg:order-2 lg:justify-start" : "lg:order-1 lg:justify-end"}`}>
        <SampleVisual sample={sample} />
      </div>
      <div className={`${reversed ? "lg:order-1 lg:text-right" : "lg:order-2"} max-w-[440px] ${reversed ? "lg:ml-auto" : ""}`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9A7C55] mb-2">
          {sample.category}
        </p>
        <h3 className="text-[26px] lg:text-[32px] font-extrabold text-[#2A1E15] tracking-tight leading-[1.08]">
          {sample.title}
        </h3>
        <p className="mt-3 text-[15px] font-bold text-[#B12A17] italic">
          "{sample.hook}"
        </p>
        <p className="mt-4 text-[13px] text-[#6B4F2A] leading-relaxed">
          {sample.desc}
        </p>
        <Link
          href="/start/workshop"
          className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#B12A17] hover:underline"
        >
          Build this assistant
          <span className="text-[11px]">→</span>
        </Link>
      </div>
    </div>
  )
}
