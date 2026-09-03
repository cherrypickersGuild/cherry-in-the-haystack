"use client"

/**
 * 섹션 3 — 학습 목표 (엑셀 → 컨셉트 리더 전체).
 * 좌: 팀 시트 (개념/깊이/소스/상태). 행 클릭 → 우: 그 컨셉트의 페이지 전체.
 * 게시 상태 행은 실제 Concept Reader 4섹션 구조(Overview → Cherries →
 * Child Concepts → Progressive References)를 그대로 보여준다.
 */

import { useState } from "react"
import { DemoFrame } from "./shared"

/* ── 시트 데이터 ── */

const OBJECTIVE_ROWS = [
  { id: "rag", concept: "Retrieval-Augmented Generation", depth: "Basics", sources: 12, status: "published" },
  { id: "embed", concept: "Embeddings & Vector DBs", depth: "Basics", sources: 15, status: "published" },
  { id: "cot", concept: "Chain-of-Thought Prompting", depth: "Advanced", sources: 8, status: "published" },
  { id: "orch", concept: "Agent Orchestration", depth: "Advanced", sources: 7, status: "generating" },
  { id: "eval", concept: "LLM Evaluation", depth: "Basics", sources: 9, status: "review" },
  { id: "mem", concept: "Memory Architectures", depth: "Advanced", sources: 0, status: "backlog" },
]

const OBJECTIVE_STATUS: Record<string, { label: string; bg: string; fg: string; border: string }> = {
  published:  { label: "페이지 발행됨",   bg: "#EFF7F3", fg: "#2D7A5E", border: "#A8D4C0" },
  review:     { label: "지식팀 리뷰 중",  bg: "#FDF6EE", fg: "#D4854A", border: "#F0D8B0" },
  generating: { label: "Writer Agent …",  bg: "#F3EFFA", fg: "#7B5EA7", border: "#C7B8E8" },
  backlog:    { label: "백로그",          bg: "#F2F0F7", fg: "#9E97B3", border: "#E4E1EE" },
}

/* ── 컨셉트 리더 콘텐츠 (RAG 페이지 전체 — 실제 앱 데이터 기반) ── */

const CHERRIES = [
  {
    source: "Building LLMs from Scratch — Sebastian Raschka",
    body: "RAG는 추론 시점 솔루션으로 프레이밍된다: 지식을 가중치에 넣는 대신 컨텍스트를 동적으로 공급. 지식 컷오프 문제와 검색 품질이 출력 품질을 지배하는 이유를 설명한다.",
  },
  {
    source: "Chip Huyen — AI Engineering",
    body: "RAG를 생성보다 검색 문제로 먼저 본다. 핵심 지표는 precision@k. 운영 RAG에서는 모델 선택보다 청킹 전략이 더 큰 영향을 준다.",
  },
  {
    source: "LlamaIndex Documentation — Production Patterns",
    body: "운영 격차를 다룬다: 청킹, 메타데이터 필터, 하이브리드 검색, 리랭킹. 나이브 RAG는 검색 정확도 ~60%에 그치고, 운영용은 하이브리드+리랭크로 85%+에 도달해야 한다.",
  },
]

const CHILD_CONCEPTS = [
  { type: "SUBTOPIC", label: "Vector Databases", desc: "임베딩을 저장하고 유사도 검색", color: "#7B5EA7" },
  { type: "SUBTOPIC", label: "Hybrid Search", desc: "dense 벡터 + sparse BM25 결합", color: "#7B5EA7" },
  { type: "PREREQUISITE", label: "Embeddings", desc: "텍스트 → 밀집 벡터 표현", color: "#9E97B3" },
  { type: "EXTENDS", label: "Reranking", desc: "검색 후 재점수 매기기", color: "#2D7A5E" },
  { type: "RELATED", label: "Chunking Strategies", desc: "검색용 문서 분할 방법", color: "#D4854A" },
  { type: "EXTENDS", label: "Contextual Retrieval", desc: "청크마다 컨텍스트 접두어 추가", color: "#2D7A5E" },
]

const REFERENCES = [
  {
    label: "START HERE",
    labelColor: "#C94B6E",
    borderColor: "#C94B6E",
    title: "Chip Huyen — AI Engineering, Chapter 6",
    learn: "가장 폭넓고 접근하기 쉬운 개관. 검색 우선 사고방식. 첫 RAG 참고서로.",
    adds: "기초 사고 모델",
  },
  {
    label: "NEXT →",
    labelColor: "#9E97B3",
    borderColor: "#E4E1EE",
    title: "LlamaIndex Documentation — Production RAG Patterns",
    learn: "운영 깊이: 청킹, 하이브리드 검색, 리랭킹. 실습 중심.",
    adds: "운영 격차 지식",
  },
  {
    label: "THEN →",
    labelColor: "#9E97B3",
    borderColor: "#E4E1EE",
    title: "Anthropic Cookbook — Contextual Retrieval",
    learn: "컨텍스트 접두어를 추가하는 SOTA 기법. 검색 실패 −67%.",
    adds: "최신 SOTA 기법",
  },
  {
    label: "DEEP DIVE →",
    labelColor: "#9E97B3",
    borderColor: "#E4E1EE",
    title: "ColBERT: Late Interaction 검색",
    learn: "커스텀 검색기 구현을 위한 연구 기반. 지연 상호작용의 학術 토대.",
    adds: "연구 수준 깊이",
    faded: true,
  },
]

/* ── 컴포넌트 ── */

function ConceptReaderFull() {
  return (
    <div>
      {/* 배지 + 제목 */}
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-soft text-violet mb-2">
        Basics
      </span>
      <h3 className="text-[20px] font-extrabold text-text-primary tracking-[-0.5px] leading-[1.2] mb-2">
        Retrieval-Augmented Generation
      </h3>
      <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-text-muted mb-6">
        <span>2026년 2월 20일 업데이트</span>
        <span className="text-border">·</span>
        <span>12개 소스</span>
        <span className="text-border">·</span>
        <span>지식팀 검증완료</span>
        <span className="text-border">·</span>
        <span>8분 읽기</span>
      </div>

      {/* 01 Overview */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-[11px] font-extrabold" style={{ color: "var(--cherry)" }}>01</span>
          <h4 className="text-[14px] font-bold text-text-primary">Overview</h4>
        </div>
        <p className="text-[12.5px] text-text-body leading-relaxed">
          LLM 응답을 추론 시점에 외부 지식으로 grounding 하는 기법. 환각을 줄이고 최신 정보를
          반영할 수 있게 한다. 엔지니어에게 중요한 이유: 파인튜닝 없이 지식을 교체할 수 있는
          가장 비용 효율적인 경로이며, 운영 실패의 대부분이 검색 단계에서 발생하기 때문.
        </p>
      </div>

      {/* 02 Cherries */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-[11px] font-extrabold" style={{ color: "var(--cherry)" }}>02</span>
          <h4 className="text-[14px] font-bold text-text-primary">Cherries</h4>
          <span className="text-[10px] text-text-muted">— 수집된 책·소스가 실제로 말하는 것 (MECE)</span>
        </div>
        <div className="flex flex-col gap-2">
          {CHERRIES.map((c) => (
            <div
              key={c.source}
              className="rounded-[10px] border p-3"
              style={{ borderColor: "#EDEBF2", backgroundColor: "#FBFAF8" }}
            >
              <p className="text-[11px] font-bold mb-1" style={{ color: "#7B5EA7" }}>🍒 {c.source}</p>
              <p className="text-[12px] text-text-body leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 03 Child Concepts */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-[11px] font-extrabold" style={{ color: "var(--cherry)" }}>03</span>
          <h4 className="text-[14px] font-bold text-text-primary">Child Concepts</h4>
          <span className="text-[10px] text-text-muted">— 온톨로지 그래프 연결</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {CHILD_CONCEPTS.map((c) => (
            <div
              key={c.label}
              className="flex items-start gap-2 rounded-[10px] border px-3 py-2"
              style={{ borderColor: "#EDEBF2", backgroundColor: "#FFFFFF" }}
            >
              <span
                className="text-[8px] font-extrabold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                style={{ backgroundColor: `${c.color}1A`, color: c.color }}
              >
                {c.type}
              </span>
              <div className="min-w-0">
                <p className="text-[11.5px] font-bold text-text-primary">{c.label}</p>
                <p className="text-[10px] text-text-muted">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 04 Progressive References */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-[11px] font-extrabold" style={{ color: "var(--cherry)" }}>04</span>
          <h4 className="text-[14px] font-bold text-text-primary">Progressive References</h4>
          <span className="text-[10px] text-text-muted">— MECE 학습 경로</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {REFERENCES.map((r) => (
            <div
              key={r.title}
              className="rounded-[10px] border px-3.5 py-2.5"
              style={{
                borderColor: r.borderColor,
                backgroundColor: "#FFFFFF",
                opacity: r.faded ? 0.6 : 1,
                borderLeft: `3px solid ${r.borderColor}`,
              }}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-extrabold tracking-[0.08em]" style={{ color: r.labelColor }}>
                  {r.label}
                </span>
              </div>
              <p className="text-[12px] font-bold text-text-primary leading-snug">{r.title}</p>
              <p className="text-[11px] text-text-secondary leading-relaxed mt-0.5">{r.learn}</p>
              <p className="text-[10px] mt-1">
                <span className="font-semibold" style={{ color: "#2D7A5E" }}>+ {r.adds}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function LearningObjectivesDemo() {
  const [selected, setSelected] = useState("rag")
  const sel = OBJECTIVE_ROWS.find((r) => r.id === selected)!

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 items-start">
      {/* 엑셀 시트 */}
      <DemoFrame label="팀 시트 — 학습 목표 (Excel)">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr>
                {["컨셉트", "깊이", "소스", "상태"].map((h, i) => (
                  <th
                    key={h}
                    className="text-left font-bold px-2.5 py-1.5 border-b text-[10px] uppercase tracking-[0.6px]"
                    style={{
                      color: "#3D3652",
                      borderColor: "#D5D0E0",
                      backgroundColor: i === 0 ? "#F3EFFA" : "#F9F7F5",
                      borderRight: i < 3 ? "1px solid #EDEBF2" : undefined,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {OBJECTIVE_ROWS.map((r) => {
                const st = OBJECTIVE_STATUS[r.status]
                const isSel = selected === r.id
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r.id)}
                    className="cursor-pointer"
                    style={{ backgroundColor: isSel ? "#FDF0F3" : undefined }}
                  >
                    <td
                      className="px-2.5 py-2 border-b font-medium"
                      style={{ borderColor: "#F2F0F7", borderRight: "1px solid #EDEBF2", color: isSel ? "var(--cherry)" : "#3D3652" }}
                    >
                      {r.concept}
                    </td>
                    <td
                      className="px-2.5 py-2 border-b text-text-muted"
                      style={{ borderColor: "#F2F0F7", borderRight: "1px solid #EDEBF2" }}
                    >
                      {r.depth}
                    </td>
                    <td
                      className="px-2.5 py-2 border-b text-text-muted tabular-nums"
                      style={{ borderColor: "#F2F0F7", borderRight: "1px solid #EDEBF2" }}
                    >
                      {r.sources}
                    </td>
                    <td className="px-2.5 py-2 border-b" style={{ borderColor: "#F2F0F7" }}>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap"
                        style={{ backgroundColor: st.bg, color: st.fg, borderColor: st.border }}
                      >
                        {st.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {/* 시트 크롬 */}
          <div className="flex items-center gap-1 mt-1.5" aria-hidden>
            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#F2F0F7", color: "#9E97B3" }}>
              Sheet1
            </span>
            <span className="text-[9px] px-1.5 py-0.5" style={{ color: "#9E97B3" }}>+</span>
          </div>
        </div>
        <p className="text-[11px] text-text-muted mt-3 leading-relaxed">
          이 시트가 곧 제품 로드맵이다. 행이 채워지면 파이프라인이 따라간다.
        </p>
      </DemoFrame>

      {/* 생성된 페이지 전체 */}
      <DemoFrame label={`생성된 컨셉트 페이지 — ${sel.concept}`}>
        {sel.status === "published" || sel.status === "review" ? (
          selected === "rag" ? <ConceptReaderFull /> : (
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-soft text-violet mb-2">
                {sel.depth}
              </span>
              <h3 className="text-[18px] font-extrabold text-text-primary leading-tight mb-1.5">
                {sel.concept}
              </h3>
              <p className="text-[11px] text-text-muted mb-4">
                {sel.sources}개 소스 · 지식팀 검증 · 8분 읽기
              </p>
              {[
                { n: "01", t: "Overview", d: "정의, 중요성, 실무 맥락" },
                { n: "02", t: "Cherries", d: `수집 ${sel.sources}개 소스의 MECE 인사이트` },
                { n: "03", t: "Child Concepts", d: "온톨로지: 선수·관련·확장 관계" },
                { n: "04", t: "Progressive References", d: "여기서 시작 → 다음 → 심화 학습 경로" },
              ].map((s) => (
                <div
                  key={s.n}
                  className="flex items-start gap-3 rounded-[10px] border p-2.5 mb-2"
                  style={{ borderColor: "#EDEBF2", backgroundColor: "#FBFAF8" }}
                >
                  <span className="text-[11px] font-extrabold" style={{ color: "var(--cherry)" }}>{s.n}</span>
                  <div>
                    <p className="text-[12.5px] font-bold text-text-primary">{s.t}</p>
                    <p className="text-[11px] text-text-muted">{s.d}</p>
                  </div>
                </div>
              ))}
              <p className="text-[10.5px] text-text-muted mt-2">
                ※ 전체 페이지 모습은 RAG 행에서 확인할 수 있어요.
              </p>
            </div>
          )
        ) : sel.status === "generating" ? (
          <div className="py-10 text-center">
            <div
              className="inline-block w-10 h-10 rounded-full border-[3px] animate-spin mb-4"
              style={{ borderColor: "#C7B8E8", borderTopColor: "#7B5EA7" }}
            />
            <p className="text-[13px] font-bold" style={{ color: "#7B5EA7" }}>
              Writer Agent가 합성 중…
            </p>
            <p className="text-[11.5px] text-text-muted mt-1">
              증거 레이어 → 온톨로지 매핑 → 4섹션 초안 생성
            </p>
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="text-[24px] mb-2">🕳</p>
            <p className="text-[13px] font-bold text-text-secondary">아직 시작 전</p>
            <p className="text-[11.5px] text-text-muted mt-1">
              시트에 행만 있는 상태 — 소스가 모이면 파이프라인이 페이지를 채운다.
            </p>
          </div>
        )}
      </DemoFrame>
    </div>
  )
}
