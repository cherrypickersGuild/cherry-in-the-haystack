"use client"

import Link from "next/link"
import { CherryBao } from "@/components/cherry/cherry-bao"

export default function StartLanding() {
  return (
    <div className="space-y-24 pb-12">
      {/* ══════════ Hero ══════════ */}
      <section className="relative overflow-hidden">
        <div className="flex flex-col items-center text-center pt-16 pb-8 relative z-10">
          <CherryBao size={180} animate />

          <h1 className="mt-8 text-[36px] lg:text-[48px] font-black text-[#3A2A1C] tracking-tight leading-[1.1] max-w-3xl">
            나만의 AI,
            <br />
            <span className="text-[#C8301E]">게임 캐릭터처럼</span> 만들어 보세요
          </h1>

          <p className="mt-5 text-[16px] lg:text-[18px] text-[#6B4F2A] leading-relaxed max-w-lg">
            드래그 · 드롭 · 완성.
            <br />
            개발은 전혀 몰라도 괜찮아요.
          </p>

          <div className="mt-8 flex items-center gap-3 flex-wrap justify-center">
            <Link
              href="/start/workshop"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#C8301E] text-white text-[14px] font-extrabold shadow-md hover:shadow-lg hover:scale-[1.02] transition-all"
            >
              지금 시작하기 →
            </Link>
            <Link
              href="/start/arena"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-[#E9D1A6] text-[#6B4F2A] text-[14px] font-bold hover:bg-[#F5E4C2]/40 transition-colors"
            >
              다른 AI 구경하기
            </Link>
          </div>
        </div>

        {/* Soft floating blobs for depth */}
        <div
          className="absolute top-20 -left-20 w-[300px] h-[300px] rounded-full opacity-40 pointer-events-none"
          style={{ background: "radial-gradient(circle, #FBE8E3, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 -right-20 w-[280px] h-[280px] rounded-full opacity-40 pointer-events-none"
          style={{ background: "radial-gradient(circle, #F5E4C2, transparent 70%)" }}
        />
      </section>

      {/* ══════════ How it works ══════════ */}
      <section>
        <h2 className="text-center text-[22px] lg:text-[28px] font-black text-[#3A2A1C] mb-10">
          3단계로 완성돼요
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-[20px] bg-white p-6 text-center"
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

      {/* ══════════ Showcase — what people built ══════════ */}
      <section>
        <div className="flex items-end justify-between mb-6 flex-wrap gap-2">
          <div>
            <h2 className="text-[22px] lg:text-[28px] font-black text-[#3A2A1C]">
              이런 AI 를 만들 수 있어요
            </h2>
            <p className="text-[13px] text-[#9A7C55] mt-1">
              샘플로 먼저 체험해 보세요. Workshop 에서 바로 불러올 수 있어요.
            </p>
          </div>
          <Link
            href="/start/arena"
            className="text-[13px] font-bold text-[#C8301E] hover:underline"
          >
            모두 보기 →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {SAMPLES.map((s) => (
            <div
              key={s.title}
              className="rounded-[20px] bg-white p-5 flex flex-col"
              style={{ border: "1px solid #E9D1A6", boxShadow: "0 4px 20px rgba(107,79,42,0.08)" }}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="text-[40px] leading-none flex-shrink-0">{s.emoji}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9A7C55]">
                    {s.category}
                  </p>
                  <h3 className="text-[17px] font-extrabold text-[#3A2A1C] leading-tight">{s.title}</h3>
                  <p className="text-[12px] font-bold text-[#C8301E] mt-0.5">"{s.hook}"</p>
                </div>
              </div>
              <p className="text-[12px] text-[#6B4F2A] leading-relaxed mb-4 flex-1">{s.desc}</p>
              <Link
                href="/start/workshop"
                className="inline-flex items-center gap-1 text-[12px] font-bold text-[#C8301E] hover:underline"
              >
                이 AI 만들기 →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ Bottom CTA ══════════ */}
      <section
        className="rounded-[28px] p-10 text-center"
        style={{
          background: "linear-gradient(135deg, #FBEFD8 0%, #F5E4C2 100%)",
          border: "1px solid #E9D1A6",
        }}
      >
        <CherryBao size={88} variant="celebrate" />
        <h2 className="mt-4 text-[22px] lg:text-[26px] font-black text-[#3A2A1C]">
          준비됐어요. 이제 AI 를 만들 차례예요.
        </h2>
        <p className="mt-2 text-[13px] text-[#6B4F2A]">
          등록만 하면 200 크레딧 무료. 바로 쓸 수 있어요.
        </p>
        <Link
          href="/start/workshop"
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#C8301E] text-white text-[14px] font-extrabold shadow-md hover:shadow-lg hover:scale-[1.02] transition-all"
        >
          지금 시작하기 →
        </Link>
      </section>
    </div>
  )
}

const STEPS = [
  {
    n: 1,
    emoji: "🎒",
    title: "기술을 고르세요",
    desc: "Shop 에서 마음에 드는 기술 카드를 골라요. RAG / 코딩 / 추론 등 종류가 다양해요.",
  },
  {
    n: 2,
    emoji: "⚔️",
    title: "드래그로 장착하세요",
    desc: "캐릭터 슬롯에 끌어다 놓으면 바로 장착돼요. 3 가지 빌드를 저장할 수 있어요.",
  },
  {
    n: 3,
    emoji: "✨",
    title: "AI 가 완성됐어요",
    desc: "Claude Code 에 연결하면 바로 쓸 수 있어요. 터미널 한 줄 붙여넣기만.",
  },
]

const SAMPLES = [
  {
    emoji: "📈",
    title: "코인 시세 비서",
    category: "Crypto",
    hook: "잘 때도 시장을 본다",
    desc: "관심 코인 급등·급락을 24시간 감시하고, 내 지갑 잔고 변동까지 알려줘요. 커피 한잔 마시는 사이 놓치던 타이밍, 이제 AI 가 잡아줘요.",
  },
  {
    emoji: "🔨",
    title: "경매 정보 수집 비서",
    category: "Auction",
    hook: "낙찰 직전에 찌른다",
    desc: "관심 카테고리의 경매를 여러 사이트에서 동시 감시해요. 마감 임박 · 입찰가 변동 · 새 매물 등록 순간을 놓치지 않고 알려줘, 사람이 24시간 지킬 필요가 없어요.",
  },
  {
    emoji: "⚡",
    title: "번개장터 헌터",
    category: "Used Market",
    hook: "좋은 매물은 가장 빨리 득템",
    desc: "원하는 중고 매물이 뜨면 당신의 비서가 바로 찾아내서 카톡으로 알려드려요. 새벽에 올라온 특급 매물도, 남들보다 먼저 연락 가능한 타이밍을 잡아줘요.",
  },
]
