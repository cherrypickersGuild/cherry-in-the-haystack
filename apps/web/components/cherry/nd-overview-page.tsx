"use client"

import { useEffect, useRef, useState } from "react"
import { API_URL } from "@/lib/auth"
import { CategoryTreemap } from "@/components/cherry/buzz-treemap"
import { fetchLanding, LandingResponse } from "@/lib/api"

/**
 * Newly Discovered — Overview
 *
 * 앱스토어식 편집형(editorial) 구성. 위계가 아래로 반복된다:
 *   히어로 → 스포트라이트 2 → 목록 → (구분선) → 배너 피처 2 → 목록 → …
 *
 * 데이터: /building-blocks/entities.json (Building Blocks와 동일 소스)
 * 아이콘: /building-blocks/icons/<slug>.png
 * 목업: apps/docs/mockups/overview-mockup.html
 */

/* ── 데이터 타입 (entities.json 스키마) ── */
type Entity = {
  n: string
  s: number | null
  v: string
  u: string
  i: string
  d: string
  vf: 0 | 1
}
type Group = { t: string; c: number; items: Entity[] }
type Topic = { k: string; l: string; total: number; groups: Group[] }
type Payload = { total: number; topics: Topic[] }

/** 화면에 쓸 수 있게 평탄화한 항목 */
type Item = Entity & { topic: string; type: string }

const TYPE_LABEL: Record<string, string> = {
  server: "Server", skill: "Skill", product: "Product", platform: "Platform",
  framework: "Framework", guide: "Guide", technique: "Technique", tool: "Tool",
  marketplace: "Marketplace", library: "Library", dataset: "Dataset",
  client_sdk: "Client SDK", registry: "Registry", spec: "Spec",
  benchmark: "Benchmark", other: "Other",
}

/** 히어로 슬라이드별 [좌측 패널, 우측 비주얼] 그라디언트 */
const HERO_GRADIENTS: [string, string][] = [
  ["linear-gradient(155deg,#3B2159 0%,#5B3D87 45%,#7B5EA7 100%)", "linear-gradient(140deg,#6E4C9B 0%,#8A6BB8 60%,#A98FD0 100%)"],
  ["linear-gradient(155deg,#12325E 0%,#1F4E8C 45%,#3A6EA5 100%)", "linear-gradient(140deg,#2C5E9E 0%,#4B78F0 60%,#7BA0F7 100%)"],
  ["linear-gradient(155deg,#0F3B32 0%,#1C6152 45%,#2E8B6F 100%)", "linear-gradient(140deg,#227A63 0%,#3FA184 60%,#6FBFA5 100%)"],
  ["linear-gradient(155deg,#5C2338 0%,#93374F 45%,#C94B6E 100%)", "linear-gradient(140deg,#A93E5C 0%,#D4657F 60%,#E894A6 100%)"],
  ["linear-gradient(155deg,#5A3011 0%,#96551F 45%,#D4854A 100%)", "linear-gradient(140deg,#B26B2B 0%,#DE9457 60%,#EFB483 100%)"],
]

const BANNER_GRADIENTS = [
  "linear-gradient(140deg,#4B78F0,#7BA0F7)",
  "linear-gradient(140deg,#2E8B6F,#6FBFA5)",
  "linear-gradient(140deg,#7B5EA7,#A98FD0)",
  "linear-gradient(140deg,#D4854A,#EFB483)",
]

const fmtStars = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`)
const iconSrc = (slug: string) => `/building-blocks/icons/${slug}.png`
const isUsableUrl = (u: string) => /^https?:\/\//i.test(u)
const meta = (it: Item) => `${it.topic} · ${TYPE_LABEL[it.type] ?? it.type}`

/* 아이콘 — 파일이 없으면 조용히 숨긴다 */
function Icon({ slug, className, style }: { slug: string; className?: string; style?: React.CSSProperties }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img src={iconSrc(slug)} alt="" loading="lazy" className={className} style={style} onError={() => setFailed(true)} />
  )
}

/* 가는 꺾쇠 — stroke 1.5 */
function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
    </svg>
  )
}

/* ── 히어로 캐러셀 (가로 스크롤 + 스냅) ── */
const HERO_INTERVAL_MS = 10_000

function HeroCarousel({ items }: { items: Item[] }) {
  const n = items.length
  const [active, setActive] = useState(0) // 실제 인덱스(인디케이터용)
  const [paused, setPaused] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const jumpingRef = useRef(false) // 클론→실제 순간이동 중엔 onScroll 무시
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* 무한 순환: 양끝에 클론을 둔다 → [마지막 클론, ...실제, 첫 클론].
     실제 슬라이드는 rawIndex 1..n. 끝을 넘어가면 옆에서 슬라이드로 들어오고(클론),
     스크롤이 멈춘 뒤 동일하게 생긴 실제 슬라이드로 순간 이동해 이음매를 없앤다. */
  const loop = n > 1
  const slides = loop ? [items[n - 1], ...items, items[0]] : items

  const rawToReal = (raw: number) => (!loop ? 0 : raw <= 0 ? n - 1 : raw >= n + 1 ? 0 : raw - 1)
  const rawIndex = () => {
    const el = trackRef.current
    return el && el.clientWidth ? Math.round(el.scrollLeft / el.clientWidth) : loop ? 1 : 0
  }
  const goRaw = (raw: number, smooth = true) => {
    const el = trackRef.current
    if (el) el.scrollTo({ left: raw * el.clientWidth, behavior: smooth ? "smooth" : "auto" })
  }
  const next = () => goRaw(rawIndex() + 1)
  const prev = () => goRaw(rawIndex() - 1)
  const goToReal = (i: number) => goRaw(loop ? i + 1 : i)

  // 마운트 시 첫 실제 슬라이드(rawIndex 1)로 위치. 레이아웃 준비 안 됐으면 다음 프레임 재시도.
  useEffect(() => {
    if (!loop) return
    const el = trackRef.current
    if (!el) return
    const place = () => {
      if (el.clientWidth === 0) { requestAnimationFrame(place); return }
      jumpingRef.current = true
      el.scrollLeft = el.clientWidth
      requestAnimationFrame(() => { jumpingRef.current = false })
    }
    place()
  }, [loop])

  // 스크롤이 멈춘 뒤 클론 위에 있으면 실제 슬라이드로 순간 이동(이음매 제거)
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (jumpingRef.current) return
    const el = e.currentTarget
    setActive(rawToReal(Math.round(el.scrollLeft / el.clientWidth)))
    if (!loop) return
    if (idleRef.current) clearTimeout(idleRef.current)
    idleRef.current = setTimeout(() => {
      const raw = Math.round(el.scrollLeft / el.clientWidth)
      if (raw !== 0 && raw !== n + 1) return
      jumpingRef.current = true
      el.scrollLeft = (raw === 0 ? n : 1) * el.clientWidth
      requestAnimationFrame(() => { jumpingRef.current = false })
    }, 130)
  }

  /* 자동 재생 — 10초마다 다음 장(순환). hover/백그라운드/동작줄이기면 멈춤.
     trackRef만 참조해 DOM 스크롤 위치 기준으로 전진 → 클론+onScroll 리셋이 순환 처리. */
  useEffect(() => {
    if (n <= 1 || paused) return
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    const id = setInterval(() => {
      if (document.hidden) return
      const el = trackRef.current
      if (!el || !el.clientWidth) return
      const raw = Math.round(el.scrollLeft / el.clientWidth)
      el.scrollTo({ left: (raw + 1) * el.clientWidth, behavior: "smooth" })
    }, HERO_INTERVAL_MS)
    return () => clearInterval(id)
  }, [n, paused])

  return (
    <div
      className="group/hero relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* 좌우 화살표 — 가늘게, hover 시 드러남. 양끝에서도 항상 표시(순환 이동) */}
      <button
        type="button"
        aria-label="Previous"
        onClick={prev}
        className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 opacity-0 transition-opacity duration-200 group-hover/hero:opacity-100"
        style={{ background: "rgba(255,255,255,.18)", backdropFilter: "blur(8px)" }}
      >
        <Chevron dir="left" />
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={next}
        className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 opacity-0 transition-opacity duration-200 group-hover/hero:opacity-100"
        style={{ background: "rgba(255,255,255,.18)", backdropFilter: "blur(8px)" }}
      >
        <Chevron dir="right" />
      </button>

      <div
        ref={trackRef}
        onScroll={onScroll}
        className="hero-track flex snap-x snap-mandatory overflow-x-auto"
        style={{ gap: 16, scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <style>{`.hero-track::-webkit-scrollbar{display:none}`}</style>
        {slides.map((h, idx) => {
          // 그라디언트는 실제 인덱스 기준(클론도 원본 색 그대로)
          const gi = loop ? (idx - 1 + n) % n : idx
          return (
          <a
            key={idx}
            href={h.u}
            target="_blank"
            rel="noopener noreferrer"
            className="relative grid w-full flex-shrink-0 snap-start overflow-hidden rounded-[20px] no-underline"
            style={{
              gridTemplateColumns: "minmax(280px, 42%) 1fr",
              minHeight: 300,
              color: "#fff",
              boxShadow: "0 10px 34px rgba(45,20,70,.18)",
            }}
          >
            <div className="flex flex-col p-[30px_32px]" style={{ background: HERO_GRADIENTS[gi % HERO_GRADIENTS.length][0] }}>
              <div className="text-[11.5px] font-extrabold uppercase tracking-[1.2px] opacity-70">Pick of the week</div>
              <h3 className="mt-3 text-[34px] font-extrabold leading-[1.12] tracking-[-0.8px]">{h.n}</h3>
              <p className="mt-3 max-w-[34ch] text-[14px] leading-[1.6] opacity-[.86]">{h.d}</p>
              <div className="mt-auto flex items-center gap-3 pt-5 text-[12px] opacity-[.85]">
                {h.s ? (
                  <span
                    className="rounded-[20px] px-[11px] py-1 font-bold"
                    style={{ background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.22)" }}
                  >
                    ★ {fmtStars(h.s)}
                  </span>
                ) : null}
                <span>{meta(h)}</span>
                <span className="ml-auto">Learn more →</span>
              </div>
            </div>
            <div
              className="relative flex items-center justify-center overflow-hidden"
              style={{ background: HERO_GRADIENTS[gi % HERO_GRADIENTS.length][1] }}
            >
              <span
                className="absolute rounded-full"
                style={{ inset: "-30% -10% auto auto", width: 340, height: 340, background: "radial-gradient(circle,rgba(255,255,255,.28),transparent 62%)" }}
              />
              <span className="absolute h-[120px] w-[120px] rounded-[28px]" style={{ background: "rgba(255,255,255,.13)", transform: "translate(-140px,-46px) rotate(-12deg)" }} />
              <span className="absolute h-[120px] w-[120px] rounded-[28px]" style={{ background: "rgba(255,255,255,.13)", transform: "translate(132px,54px) rotate(10deg)" }} />
              <span
                className="relative z-[1] flex h-[150px] w-[150px] items-center justify-center rounded-[34px] bg-white"
                style={{ boxShadow: "0 22px 50px rgba(30,10,55,.4)", transform: "rotate(-4deg)" }}
              >
                <Icon slug={h.i} className="h-full w-full object-contain p-[22px]" />
              </span>
            </div>
          </a>
          )
        })}
      </div>

      {/* 인디케이터 */}
      <div className="mt-[14px] flex justify-center gap-[6px]">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => goToReal(i)}
            className="cursor-pointer border-0 p-0 transition-all"
            style={{
              width: i === active ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i === active ? "#7B5EA7" : "#D8D3E3",
            }}
          />
        ))}
      </div>
    </div>
  )
}

/* ── 섹션 헤더 ── */
function SectionHead({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-[14px] mt-[52px] flex items-baseline gap-[10px]">
      <h2 className="m-0 text-[19px] font-extrabold tracking-[-0.3px] text-[#1A1626]">{title}</h2>
      {desc && <span className="text-[12.5px] text-[#9E97B3]">{desc}</span>}
    </div>
  )
}

/* ── 목록 (2열) ── */
function ItemRows({ items }: { items: Item[] }) {
  return (
    <div className="grid gap-x-[34px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
      {items.map((x) => (
        <a
          key={x.i + x.n}
          href={x.u}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-[13px] border-b py-[13px] no-underline"
          style={{ borderColor: "#EFEDF3", color: "inherit" }}
        >
          <span
            className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center overflow-hidden rounded-[13px] border bg-white"
            style={{ borderColor: "#E4E1EE" }}
          >
            <Icon slug={x.i} className="h-full w-full object-contain p-[9px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-bold text-[#1A1626] transition-colors group-hover:text-[#7B5EA7]">
              {x.n}
            </span>
            <span className="mt-[2px] block text-[11.5px] text-[#9E97B3]">{meta(x)}</span>
          </span>
          {x.s ? <span className="flex-shrink-0 text-[11.5px] font-bold text-[#C7791B]">★ {fmtStars(x.s)}</span> : null}
        </a>
      ))}
    </div>
  )
}

/* ── 배너 피처 2개 ── */
function BannerFeatures({ items, gradientOffset = 0 }: { items: Item[]; gradientOffset?: number }) {
  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
      {items.map((x, i) => (
        <a key={x.i + x.n} href={x.u} target="_blank" rel="noopener noreferrer" className="block no-underline" style={{ color: "inherit" }}>
          <div
            className="relative flex h-[190px] items-center justify-center overflow-hidden rounded-[16px] transition-transform duration-150 hover:-translate-y-[2px]"
            style={{ background: BANNER_GRADIENTS[(gradientOffset + i) % BANNER_GRADIENTS.length] }}
          >
            <span
              className="absolute rounded-full"
              style={{
                inset: "auto -12% -46% auto", width: 250, height: 250,
                background: "radial-gradient(circle,rgba(255,255,255,.32),transparent 64%)",
              }}
            />
            <span
              className="relative z-[1] flex h-[104px] w-[104px] items-center justify-center rounded-[26px] bg-white"
              style={{ boxShadow: "0 14px 34px rgba(25,10,45,.28)" }}
            >
              <Icon slug={x.i} className="h-full w-full object-contain p-[17px]" />
            </span>
          </div>
          <span className="mt-[14px] block text-[11px] font-extrabold uppercase tracking-[0.8px] text-[#9E97B3]">{meta(x)}</span>
          <h4 className="mt-[5px] text-[19px] font-extrabold tracking-[-0.35px] text-[#1A1626]">{x.n}</h4>
          <p
            className="mt-[5px] text-[13px] leading-[1.5] text-[#5A5568]"
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {x.d}
          </p>
        </a>
      ))}
    </div>
  )
}

/* ── 페이지 ── */
/* ── Overview 구성 API 타입 (백엔드 overview-config.service.ts와 일치) ── */
type CfgItem = {
  entityKey: string; name: string; desc: string; url: string
  stars: number | null; icon: string | null; topic: string; type: string
}
type OverviewConfig = {
  title: { heading: string; subheading: string }
  hero: { items: CfgItem[] }
  spotlight: { label: string; sub: string; items: CfgItem[] }
  justAdded: { label: string; sub: string; items: CfgItem[] }
  blocks: Array<{ key: string; title: string; banner: CfgItem[]; rows: CfgItem[] }>
}
/** config 항목 → 화면 Item 형태로 매핑 */
const toItem = (c: CfgItem): Item => ({
  n: c.name, s: c.stars, v: "", u: c.url, i: c.icon ?? "", d: c.desc, vf: 0,
  topic: c.topic, type: c.type,
})

export function NDOverviewPage() {
  const [cfg, setCfg] = useState<OverviewConfig | null>(null)
  const [error, setError] = useState(false)
  // Buzz Distribution 트리맵 데이터(Digest에서 이관). 실패해도 트리맵은 STATIC 폴백으로 렌더.
  const [landing, setLanding] = useState<LandingResponse | null>(null)

  useEffect(() => {
    fetchLanding().then(setLanding).catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`${API_URL}/api/overview/config`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .then((d: OverviewConfig) => {
        if (!d?.hero?.items?.length) setError(true)
        else setCfg(d)
      })
      .catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <div style={{ maxWidth: 720 }}>
        <h1 className="mb-2 text-[30px] font-extrabold text-[#1A1626]">Newly Discovered</h1>
        <p className="text-[13.5px] text-[#6E6A78]">Failed to load data.</p>
      </div>
    )
  }
  if (!cfg) return <p className="text-[13px] text-[#9E97B3]">Loading…</p>

  const heroes = cfg.hero.items.map(toItem)
  const spotlight = cfg.spotlight.items.map(toItem)

  return (
    <div>
      <h1 className="m-0 mb-[3px] text-[30px] font-extrabold tracking-[-0.6px] text-[#1A1626]">{cfg.title.heading}</h1>
      <p className="mb-6 mt-0 text-[14px] text-[#6E6A78]">{cfg.title.subheading}</p>

      {/* HERO — 5개 가로 스크롤 */}
      <HeroCarousel items={heroes} />

      {/* 스포트라이트 */}
      <SectionHead title={cfg.spotlight.label} desc={cfg.spotlight.sub} />
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        {spotlight.map((x) => (
          <a
            key={x.i + x.n}
            href={x.u}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-5 rounded-[18px] p-[24px_26px] no-underline transition-transform duration-150 hover:-translate-y-[2px]"
            style={{ background: "#F2F0F7", color: "inherit" }}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-extrabold uppercase tracking-[0.8px] text-[#9E97B3]">{meta(x)}</span>
              <h4 className="mt-[7px] text-[21px] font-extrabold leading-[1.2] tracking-[-0.4px] text-[#1A1626]">{x.n}</h4>
              <p
                className="mt-[9px] text-[12.5px] leading-[1.55] text-[#5A5568]"
                style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
              >
                {x.d}
              </p>
            </span>
            <span
              className="flex h-[112px] w-[112px] flex-shrink-0 items-center justify-center rounded-full bg-white"
              style={{ boxShadow: "0 6px 18px rgba(40,20,70,.13)" }}
            >
              <Icon slug={x.i} className="h-full w-full object-contain p-6" />
            </span>
          </a>
        ))}
      </div>

      {/* 새로 추가됨 */}
      <SectionHead title={cfg.justAdded.label} desc={cfg.justAdded.sub} />
      <ItemRows items={cfg.justAdded.items.map(toItem)} />

      {/* Buzz Distribution — Digest에서 이관. Hero·Worth a Look·Just Added 다음 위치 */}
      <SectionHead title="Buzz Distribution" desc="This week's activity by category" />
      <CategoryTreemap items={landing?.treemap} showHeader={false} />

      {/* 아래로 반복되는 블록 (배너 있는 블록만 배너 렌더) */}
      {cfg.blocks.map((b, i) => (
        <div key={b.key}>
          <SectionHead title={b.title} />
          {b.banner.length > 0 && (
            <>
              <BannerFeatures items={b.banner.map(toItem)} gradientOffset={i * 2} />
              <div className="h-[26px]" />
            </>
          )}
          <ItemRows items={b.rows.map(toItem)} />
        </div>
      ))}

      <div className="h-10" />
    </div>
  )
}
