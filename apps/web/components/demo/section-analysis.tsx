"use client"

/**
 * 섹션 5 — 콘텐츠 분석.
 * 키워드 언급 추이 + 섹터 트리맵(실제 CategoryTreemap 비주얼 언어).
 */

import { Treemap, ResponsiveContainer } from "recharts"
import { DemoFrame, FONT_ROUNDED } from "./shared"

const KEYWORDS = [
  { word: "agent orchestration", count: 148, delta: 62, trend: [20, 26, 31, 44, 58, 74, 92] },
  { word: "context engineering", count: 121, delta: 48, trend: [8, 12, 19, 27, 38, 52, 71] },
  { word: "RAG evaluation", count: 96, delta: 12, trend: [40, 42, 45, 47, 46, 49, 51] },
  { word: "small models", count: 88, delta: 35, trend: [12, 15, 21, 30, 41, 49, 60] },
  { word: "tool use", count: 74, delta: -8, trend: [34, 36, 33, 31, 30, 28, 27] },
  { word: "fine-tuning", count: 61, delta: -14, trend: [38, 36, 34, 30, 28, 25, 23] },
  { word: "guardrails", count: 54, delta: 22, trend: [10, 11, 14, 18, 24, 29, 34] },
  { word: "long context", count: 47, delta: 5, trend: [16, 17, 18, 18, 19, 21, 22] },
]

/** buzz-treemap PAGE_STYLE 그대로 (데모 서브셋) */
const SECTOR_STYLE: Record<string, { color: string; bgLight: string; bgMid: string }> = {
  MODEL_UPDATES:    { color: "#7B5EA7", bgLight: "#F7F2FC", bgMid: "#E4D7F0" },
  FRAMEWORKS:       { color: "#2D7A5E", bgLight: "#F0FAF5", bgMid: "#CFE9DC" },
  PAPER_BENCHMARK:  { color: "#C94B6E", bgLight: "#FDF3F6", bgMid: "#F5D3DD" },
  CASE_STUDIES:     { color: "#3D3652", bgLight: "#F5F3F9", bgMid: "#D9D3E5" },
  REGULATIONS:      { color: "#6B6480", bgLight: "#F7F6F9", bgMid: "#D9D5E2" },
  BIG_TECH_TRENDS:  { color: "#4A4358", bgLight: "#F5F3F7", bgMid: "#D0CBD9" },
}

const TREEMAP_DATA = [
  { label: "MODEL_UPDATES", percent: 24 },
  { label: "FRAMEWORKS", percent: 19 },
  { label: "PAPER_BENCHMARK", percent: 16 },
  { label: "CASE_STUDIES", percent: 14 },
  { label: "BIG_TECH_TRENDS", percent: 14 },
  { label: "REGULATIONS", percent: 13 },
]

function prettyLabel(raw: string) {
  return raw.toLowerCase().split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

/** 앱의 CustomizedContent 타일을 간소화해 재현 */
function TreemapTile(props: any) {
  const { x, y, width, height, label, percent, rank } = props
  if (!width || !height || !label) return null
  const style = SECTOR_STYLE[label as string] ?? SECTOR_STYLE.REGULATIONS
  const minDim = Math.min(width, height)
  const labelSize = rank === 0 ? Math.max(13, Math.min(20, minDim * 0.13)) : Math.max(11, Math.min(17, minDim * 0.13))
  const showLabel = width > 36 && height > 30
  const showPct = width > 30 && height > 26
  const padX = Math.max(12, Math.min(24, width * 0.1))
  const padY = Math.max(14, Math.min(24, height * 0.12))
  const gradId = `demo2-grad-${label}`
  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={style.bgLight} />
          <stop offset="100%" stopColor={style.bgMid} />
        </linearGradient>
      </defs>
      <rect
        x={x + 3} y={y + 3}
        width={Math.max(0, width - 6)} height={Math.max(0, height - 6)}
        rx={10} ry={10}
        fill={`url(#${gradId})`}
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={1}
      />
      {(showLabel || showPct) && (
        <foreignObject
          x={x + padX} y={y + padY}
          width={Math.max(0, width - padX * 2)}
          height={Math.max(0, height - padY * 2)}
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              width: "100%", height: "100%",
              display: "flex", flexDirection: "column", justifyContent: "space-between",
              color: style.color, fontFamily: FONT_ROUNDED,
              overflow: "hidden", wordBreak: "break-word", overflowWrap: "anywhere", lineHeight: 1.15,
            }}
          >
            {showLabel && <div style={{ fontSize: labelSize, fontWeight: 700 }}>{prettyLabel(label)}</div>}
            {showPct && <div style={{ fontSize: labelSize - 1, fontWeight: 700, opacity: rank === 0 ? 1 : 0.8 }}>{percent}%</div>}
          </div>
        </foreignObject>
      )}
    </g>
  )
}

function Sparkbars({ points, color }: { points: number[]; color: string }) {
  const max = Math.max(...points, 1)
  return (
    <svg viewBox={`0 0 ${points.length * 6} 14`} height="14" width={points.length * 6} aria-hidden>
      {points.map((p, i) => (
        <rect
          key={i}
          x={i * 6}
          y={14 - (p / max) * 13}
          width="4"
          height={(p / max) * 13 + 0.5}
          rx="1"
          fill={color}
          opacity={0.25 + (i / points.length) * 0.75}
        />
      ))}
    </svg>
  )
}

export function ContentAnalysisDemo() {
  const sorted = [...TREEMAP_DATA].sort((a, b) => b.percent - a.percent)
  const rankMap = new Map(sorted.map((d, i) => [d.label, i]))
  const treemapData = TREEMAP_DATA.map((d) => ({
    name: d.label, size: d.percent, label: d.label, percent: d.percent,
    rank: rankMap.get(d.label) ?? 99,
  }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* 키워드 표 */}
      <DemoFrame label="키워드 언급 — 최근 7주">
        <div className="flex flex-col gap-1">
          {KEYWORDS.map((k) => {
            const up = k.delta >= 0
            return (
              <div
                key={k.word}
                className="flex items-center gap-3 rounded-[10px] px-2.5 py-2 transition-colors hover:bg-[#F9F7F5]"
              >
                <span className="text-[12.5px] font-semibold text-text-primary flex-1 truncate">{k.word}</span>
                <Sparkbars points={k.trend} color={up ? "#2D7A5E" : "#C94B6E"} />
                <span className="text-[12px] font-bold text-text-primary tabular-nums w-[30px] text-right">{k.count}</span>
                <span
                  className="text-[10.5px] font-bold tabular-nums w-[44px] text-right"
                  style={{ color: up ? "#2D7A5E" : "#C94B6E" }}
                >
                  {up ? "↑" : "↓"} {Math.abs(k.delta)}%
                </span>
              </div>
            )
          })}
        </div>
        <p className="text-[11px] text-text-muted mt-3 leading-relaxed">
          수집된 모든 아티클에 대해 엔티티 추출을 돌린 결과 — 엔티티 랭킹과 Trending Momentum
          패널을 만드는 것과 동일한 레지스트리.
        </p>
      </DemoFrame>

      {/* 섹터 트리맵 */}
      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-3 flex items-end justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text-secondary" style={{ fontFamily: FONT_ROUNDED }}>
              버즈 분포
            </p>
            <span className="text-[11px] text-text-muted" style={{ fontFamily: FONT_ROUNDED }}>
              {TREEMAP_DATA.length}개 섹터
            </span>
          </div>
          <div
            className="rounded-2xl border border-border/80 overflow-hidden p-[6px] shadow-card"
            style={{
              background: "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(238,233,248,0.98))",
              height: 240,
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={treemapData}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke="transparent"
                fill="transparent"
                // @ts-ignore — recharts content extra props
                content={<TreemapTile />}
                isAnimationActive={false}
              />
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-[12px] p-4 border" style={{ backgroundColor: "#F3EFFA", borderColor: "#C7B8E8" }}>
          <p className="text-[13px] font-bold mb-1.5 flex items-center gap-1.5" style={{ color: "#7B5EA7" }}>
            <span>📈</span> 트렌드가 태어나는 곳
          </p>
          <p className="text-[12px] text-text-muted leading-relaxed">
            <strong style={{ color: "#7B5EA7" }}>agent orchestration</strong> 언급이 7주간 62% 증가 —
            트위터 스레드가 먼저 시작하고 프레임워크 릴리스 노트가 확인하는 패턴. Cherry는 파도가
            만들어지는 동안 잡아내고, 연결된 컨셉트의 증거 추적을 갱신한다.
          </p>
        </div>
      </div>
    </div>
  )
}
