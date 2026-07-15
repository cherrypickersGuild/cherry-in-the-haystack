"use client"

import {
  ND_DOCS,
  getNDItem,
  getNDGroup,
  type NDDocCode,
  type NDConflict,
} from "@/lib/nd-taxonomy"

/**
 * 기획페이지 (Spec Page)
 *
 * 아직 실제 콘텐츠가 없는 신규 메뉴에, 목업(apps/docs/mockups/sidebar-mockup.html)의
 * 우측 패널을 **디자인 그대로** 렌더한다. (앱 기존 토큰이 아니라 목업 CSS 값을 그대로 사용)
 *
 * 데이터는 lib/nd-taxonomy.ts 하나에서만 온다.
 */

/* ── 목업 CSS 변수 그대로 ── */
const C = {
  cherry: "#C94B6E",
  cherrySoft: "#FDF0F3",
  cherryBorder: "#F2C4CE",
  label: "#9E97B3",
  line: "#E4E1EE",
  panel: "#FFFFFF",
  ink: "#3A3646",
  new: "#2E8B6F",
  warn: "#C7791B",
  koText: "#6E6A78",
  says: "#5A5568",
  rowBg: "#FBFAF9",
} as const

/* 근거 문서 칩 — 목업 .dchip / .d-cat / .d-prd / .d-ia */
const DOC_STYLE: Record<NDDocCode, { bg: string; color: string; border: string }> = {
  cat: { bg: "#E7F4EF", color: "#2E8B6F", border: "#CDE8DE" },
  prd: { bg: "#EAF0FB", color: "#3A6EA5", border: "#D3E0F3" },
  ia: { bg: "#FBF0DE", color: "#B07A1E", border: "#F0DFBF" },
}

function DocChip({ code }: { code: NDDocCode }) {
  const s = DOC_STYLE[code]
  const doc = ND_DOCS[code]
  return (
    <span
      title={doc.title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 10.5,
        fontWeight: 700,
        borderRadius: 5,
        padding: "2px 7px",
        margin: "0 4px 4px 0",
        border: `1px solid ${s.border}`,
        backgroundColor: s.bg,
        color: s.color,
        overflowWrap: "break-word",
        maxWidth: "100%",
      }}
    >
      {doc.label}
    </span>
  )
}

/* 목업 .row / .row .k / .row .v */
function Row({ k, children, last }: { k: React.ReactNode; children: React.ReactNode; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "9px 0",
        borderBottom: last ? "none" : `1px dashed ${C.line}`,
        fontSize: 13.5,
      }}
    >
      <div style={{ width: 110, flexShrink: 0, color: C.label, fontWeight: 600 }}>{k}</div>
      <div style={{ flex: 1, minWidth: 0, color: C.ink, overflowWrap: "break-word" }}>{children}</div>
    </div>
  )
}

/* 목업 .cf / .cf-row / .cf-base / .cf-clash */
function ConflictSide({
  kind,
  doc,
  date,
  says,
}: {
  kind: "base" | "clash"
  doc: string
  date: string
  says: string
}) {
  const isBase = kind === "base"
  const accent = isBase ? C.new : C.warn
  const tagBg = isBase ? "#E7F4EF" : "#FBF0DE"
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 5,
        fontSize: 12.5,
        background: C.rowBg,
        border: `1px solid ${C.line}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 8,
        padding: "8px 10px",
      }}
    >
      <span
        style={{
          alignSelf: "flex-start",
          fontSize: 9.5,
          fontWeight: 700,
          borderRadius: 5,
          padding: "2px 6px",
          backgroundColor: tagBg,
          color: accent,
          whiteSpace: "nowrap",
        }}
      >
        {isBase ? "기준·현행" : "갱신 전·충돌"}
      </span>
      <div style={{ minWidth: 0, overflowWrap: "break-word" }}>
        <b style={{ color: C.ink }}>{doc}</b>{" "}
        <em style={{ fontStyle: "normal", color: C.label, fontSize: 11, marginLeft: 2 }}>{date}</em>
        <div style={{ color: C.says, marginTop: 2, lineHeight: 1.45 }}>{says}</div>
      </div>
    </div>
  )
}

function ConflictBlock({ conflict }: { conflict: NDConflict }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.koText }}>{conflict.topic}</div>
      <ConflictSide kind="base" {...conflict.base} />
      <ConflictSide kind="clash" {...conflict.clash} />
    </div>
  )
}

export function NDSpecPage({ id }: { id: string }) {
  const item = getNDItem(id)
  if (!item) return null

  const group = item.group ? getNDGroup(item.group) : undefined
  const crumb = group ? `NEWLY DISCOVERED · ${group.label.toUpperCase()}` : "NEWLY DISCOVERED"

  return (
    <div style={{ maxWidth: 640 }}>
      {/* 목업 .crumb */}
      <div
        style={{
          fontSize: 12,
          color: C.label,
          fontWeight: 600,
          letterSpacing: "0.3px",
          textTransform: "uppercase",
        }}
      >
        {crumb}
      </div>

      {/* 목업 h1 / .ko */}
      <h1 style={{ fontSize: 24, margin: "6px 0 2px", letterSpacing: "-0.4px", fontWeight: 800, color: "#2A2733" }}>
        {item.label}
      </h1>
      <p style={{ fontSize: 15, color: C.koText, margin: "0 0 16px" }}>{item.ko}</p>

      {/* 목업 .card */}
      <div
        style={{
          background: C.panel,
          border: `1px solid ${C.line}`,
          borderRadius: 14,
          padding: "18px 20px",
          boxShadow: "0 1px 2px rgba(20,10,30,.03)",
        }}
      >
        {/* 목업 .ov (개요) */}
        <div
          style={{
            fontSize: 13.5,
            lineHeight: 1.65,
            color: C.ink,
            background: C.cherrySoft,
            border: `1px solid ${C.cherryBorder}`,
            borderRadius: 10,
            padding: "11px 13px",
            marginBottom: 14,
          }}
        >
          <span
            style={{
              display: "inline-block",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.6px",
              color: "#fff",
              background: C.cherry,
              borderRadius: 5,
              padding: "2px 7px",
              marginRight: 8,
              verticalAlign: "middle",
            }}
          >
            개요
          </span>
          {item.desc}
        </div>

        <Row k="한글">{item.ko}</Row>

        <Row k="데이터 태그">
          {item.tag ? (
            /* 목업 .pill */
            <span
              style={{
                display: "inline-block",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 12,
                background: "#F3F1F6",
                border: `1px solid ${C.line}`,
                borderRadius: 6,
                padding: "1px 7px",
                color: C.says,
              }}
            >
              {item.tag}
            </span>
          ) : (
            <span style={{ color: "#B7B3C0" }}>해당 없음(UI 전용)</span>
          )}
        </Row>

        <Row k="그룹">{group ? `${group.label} / ${group.ko}` : "Utility"}</Row>

        <Row k="근거 문서">
          {item.basis.map((c) => (
            <DocChip key={c} code={c} />
          ))}
          {item.conflict && (
            <span style={{ color: C.warn, fontSize: 11 }}>← ⚠️ 아래 충돌 참고</span>
          )}
        </Row>

        <Row k="근거(설명)" last={!item.conflict}>
          {item.note}
        </Row>

        {item.conflict && (
          <Row k={<span style={{ color: C.warn, fontWeight: 600 }}>⚠️ 충돌</span>} last>
            <ConflictBlock conflict={item.conflict} />
          </Row>
        )}
      </div>

      {/* 목업 .note (문서 기준선) */}
      <p style={{ maxWidth: 640, marginTop: 18, fontSize: 12.5, color: "#8A8694", lineHeight: 1.7 }}>
        <b>기준</b>:{" "}
        <span
          style={{
            display: "inline-block",
            fontSize: 11,
            border: "1px solid #CDE8DE",
            borderRadius: 6,
            padding: "1px 7px",
            background: "#E7F4EF",
            color: C.new,
          }}
        >
          현행 PRD ≡ Cherry Category (260530)
        </span>{" "}
        — 두 문서의 카테고리가 현재 <b>완전히 동일</b>(PRD가 Category에 맞춰 갱신됨).{" "}
        <span
          style={{
            display: "inline-block",
            fontSize: 11,
            border: "1px solid #F0DFBF",
            borderRadius: 6,
            padding: "1px 7px",
            background: "#FBF0DE",
            color: C.warn,
          }}
        >
          UI &amp; Information Architecture (260415) · 2026-04-15
        </span>{" "}
        만 갱신 전 버전이라 <b>2건</b>만 다름 → 충돌로 표시: ① Building Blocks 명칭, ② Community 누락.
      </p>
    </div>
  )
}
