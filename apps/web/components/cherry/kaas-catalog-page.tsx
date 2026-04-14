"use client"

import { useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Search, X, GitCompare, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, ChevronDown } from "lucide-react"
import { MOCK_AGENTS } from "./kaas-dashboard-page"
import { fetchCatalog, fetchAgents, compareKnowledge, elicitKnowledge } from "@/lib/api"

/* ─────────────────────────────────────────────
   Mock data — seed-data.json 스펙 기준 3개 개념
───────────────────────────────────────────── */
type Evidence = {
  id: string
  source: string
  summary: string
  curator: string
  curatorTier: string
  comment: string
}

type Concept = {
  id: string
  title: string
  category: string
  summary: string
  qualityScore: number
  sourceCount: number
  updatedAt: string
  relatedConcepts: string[]
  evidence: Evidence[]
}

const MOCK_CONCEPTS: Concept[] = [
  {
    id: "rag",
    title: "Retrieval-Augmented Generation",
    category: "Basics",
    summary: "인퍼런스 시점에 외부 지식을 동적으로 주입하여 LLM 응답의 정확도를 높이는 기법. 벡터 DB 기반 검색과 생성 모델을 결합하여 hallucination을 줄이고 최신 정보를 반영한다.",
    qualityScore: 4.8,
    sourceCount: 12,
    updatedAt: "2026-04-11",
    relatedConcepts: ["Embeddings", "Vector Databases", "Hybrid Search"],
    evidence: [
      { id: "rag-ev-001", source: "Chip Huyen — AI Engineering", summary: "Retrieval-first mental model. Precision@k가 핵심 지표. 청킹 전략이 모델 선택보다 중요하다.", curator: "Hyejin Kim", curatorTier: "Gold", comment: "가장 접근성 좋은 RAG 입문 자료. 실무 적용 시 chunking 섹션 필독." },
      { id: "rag-ev-002", source: "LlamaIndex Docs — Production Patterns", summary: "기본 naive RAG는 검색 정확도 ~60%. Hybrid + rerank로 85%+ 달성 가능.", curator: "Minjun Park", curatorTier: "Silver", comment: "Production gap 이해에 핵심. 수치 기반 비교가 설득력 있음." },
      { id: "rag-ev-003", source: "Anthropic Cookbook — Contextual Retrieval", summary: "Context prefix를 청크에 추가하여 검색 실패율 67% 감소.", curator: "Hyejin Kim", curatorTier: "Gold", comment: "2026년 기준 SOTA 기법. 구현 난이도 낮고 효과 큼." },
    ],
  },
  {
    id: "chain-of-thought",
    title: "Chain-of-Thought Prompting",
    category: "Advanced",
    summary: "LLM이 최종 답변 전에 중간 추론 단계를 명시적으로 생성하도록 유도하는 프롬프팅 기법. 수학, 논리, 다단계 추론 문제에서 성능을 크게 향상시킨다.",
    qualityScore: 4.5,
    sourceCount: 8,
    updatedAt: "2026-04-08",
    relatedConcepts: ["Prompting Techniques", "Self-Consistency", "Tree-of-Thought"],
    evidence: [
      { id: "cot-ev-001", source: "Wei et al. — Chain-of-Thought Prompting (2022)", summary: "few-shot CoT가 GSM8K 벤치마크에서 기존 프롬프팅 대비 +20% 정확도 향상.", curator: "Donghyun Lee", curatorTier: "Gold", comment: "CoT 분야의 foundational paper. 반드시 읽어야 할 논문." },
      { id: "cot-ev-002", source: "Kojima et al. — Zero-shot CoT", summary: "'Let's think step by step' 한 줄 추가만으로 zero-shot 추론 성능이 대폭 향상.", curator: "Soyeon Choi", curatorTier: "Silver", comment: "실무에서 바로 적용 가능한 가장 간단한 CoT 기법." },
    ],
  },
  {
    id: "embeddings",
    title: "Embeddings & Vector Databases",
    category: "Basics",
    summary: "텍스트를 고차원 밀집 벡터로 변환하여 의미적 유사도를 계산하는 기술. 벡터 DB는 이 임베딩을 저장하고 ANN 검색으로 빠르게 유사 문서를 찾는다.",
    qualityScore: 4.2,
    sourceCount: 15,
    updatedAt: "2026-04-12",
    relatedConcepts: ["RAG", "Semantic Search", "Dimensionality Reduction"],
    evidence: [
      { id: "emb-ev-001", source: "OpenAI — Embedding Guide", summary: "text-embedding-3-large 모델은 3072 차원, Matryoshka 표현으로 차원 축소 가능.", curator: "Minjun Park", curatorTier: "Silver", comment: "OpenAI 임베딩 모델 선택 시 첫 번째 참고 자료." },
      { id: "emb-ev-002", source: "Pinecone — Vector Database 101", summary: "HNSW 인덱스가 recall-latency 트레이드오프에서 가장 범용적.", curator: "Hyejin Kim", curatorTier: "Gold", comment: "벡터 DB 입문자에게 추천. 인덱스 비교가 명확." },
      { id: "emb-ev-003", source: "Weaviate Blog — Hybrid Search", summary: "BM25 + 벡터 검색 결합으로 키워드 매칭과 의미 검색의 장점을 동시에 확보.", curator: "Donghyun Lee", curatorTier: "Gold", comment: "Hybrid search 구현 시 필독. 실제 벤치마크 포함." },
    ],
  },
  {
    id: "fine-tuning",
    title: "Fine-tuning & PEFT",
    category: "Basics",
    summary: "사전 학습된 LLM을 특정 도메인/태스크에 맞게 추가 학습하는 기법. LoRA, QLoRA 등 파라미터 효율적 방법으로 GPU 비용을 대폭 줄이면서 전문성을 확보한다.",
    qualityScore: 4.6,
    sourceCount: 10,
    updatedAt: "2026-03-28",
    relatedConcepts: ["LoRA", "QLoRA", "Instruction Tuning"],
    evidence: [
      { id: "ft-ev-001", source: "Hu et al. — LoRA (2021)", summary: "전체 파라미터의 0.1%만 학습하면서 full fine-tuning 대비 동등한 성능 달성.", curator: "Soyeon Choi", curatorTier: "Silver", comment: "PEFT의 시작점. LoRA 원리 이해에 필수." },
      { id: "ft-ev-002", source: "Dettmers et al. — QLoRA (2023)", summary: "4-bit 양자화 + LoRA로 단일 GPU에서 65B 모델 fine-tuning 가능.", curator: "Donghyun Lee", curatorTier: "Gold", comment: "GPU 자원이 제한적인 환경에서 반드시 알아야 할 기법." },
    ],
  },
  {
    id: "multi-agent",
    title: "Multi-Agent Systems",
    category: "Advanced",
    summary: "여러 AI 에이전트가 역할을 분담하고 협력하여 복잡한 태스크를 수행하는 아키텍처. 에이전트 간 통신 프로토콜, 메모리 공유, 태스크 분배가 핵심이다.",
    qualityScore: 4.3,
    sourceCount: 7,
    updatedAt: "2026-04-10",
    relatedConcepts: ["Agent Architectures", "CrewAI", "LangGraph"],
    evidence: [
      { id: "ma-ev-001", source: "Wu et al. — AutoGen (2023)", summary: "대화 기반 멀티에이전트 프레임워크로 코드 생성, 수학 문제 풀이에서 단일 에이전트 대비 +15% 성능.", curator: "Minjun Park", curatorTier: "Silver", comment: "멀티에이전트 입문에 최적. 코드 예시가 풍부." },
      { id: "ma-ev-002", source: "CrewAI Documentation", summary: "역할 기반 에이전트 오케스트레이션으로 복잡한 워크플로우를 자연어로 정의.", curator: "Hyejin Kim", curatorTier: "Gold", comment: "실무 오케스트레이션 패턴 이해에 좋음." },
    ],
  },
  {
    id: "evaluation",
    title: "LLM Evaluation & Benchmarks",
    category: "Basics",
    summary: "LLM 출력의 품질을 체계적으로 측정하는 방법론. 자동 메트릭(BLEU, ROUGE), LLM-as-judge, 인간 평가를 조합하여 정확도, 유용성, 안전성을 평가한다.",
    qualityScore: 4.1,
    sourceCount: 9,
    updatedAt: "2026-04-05",
    relatedConcepts: ["Benchmarks", "LLM-as-Judge", "Red Teaming"],
    evidence: [
      { id: "eval-ev-001", source: "Zheng et al. — Judging LLM-as-a-Judge (2023)", summary: "GPT-4 판정이 인간 평가와 80%+ 일치. 비용 대비 효과적인 평가 방법.", curator: "Soyeon Choi", curatorTier: "Silver", comment: "LLM 평가 자동화의 현실적 방법론." },
      { id: "eval-ev-002", source: "Anthropic — Measuring Model Performance", summary: "다차원 평가(정확도, 유해성, 편향)가 단일 벤치마크보다 신뢰할 수 있다.", curator: "Donghyun Lee", curatorTier: "Gold", comment: "평가 프레임워크 설계 시 참고할 관점." },
    ],
  },
  {
    id: "prompt-engineering",
    title: "Prompt Engineering",
    category: "Basics",
    summary: "LLM에 전달하는 프롬프트를 체계적으로 설계하여 원하는 출력을 이끌어내는 기법. Few-shot, system prompt, 역할 부여 등 다양한 전략을 조합한다.",
    qualityScore: 4.4,
    sourceCount: 11,
    updatedAt: "2026-04-02",
    relatedConcepts: ["Chain-of-Thought", "Few-shot Learning", "System Prompts"],
    evidence: [
      { id: "pe-ev-001", source: "OpenAI — Prompt Engineering Guide", summary: "구체적 지시, 구분자 사용, 단계별 분해가 프롬프트 품질의 80%를 결정한다.", curator: "Hyejin Kim", curatorTier: "Gold", comment: "프롬프트 작성 기본기. 모든 LLM 사용자 필독." },
      { id: "pe-ev-002", source: "Anthropic — Prompt Design Best Practices", summary: "XML 태그와 역할 부여로 Claude의 응답 일관성이 40% 향상.", curator: "Minjun Park", curatorTier: "Silver", comment: "Claude 특화 팁이 많지만 범용적으로도 유용." },
    ],
  },
  {
    id: "agent-architectures",
    title: "Agent Architectures",
    category: "Advanced",
    summary: "LLM 기반 자율 에이전트의 설계 패턴. ReAct, Plan-and-Execute, Reflection 등 다양한 아키텍처로 도구 사용, 계획 수립, 자기 교정을 구현한다.",
    qualityScore: 4.7,
    sourceCount: 8,
    updatedAt: "2026-04-09",
    relatedConcepts: ["Multi-Agent Systems", "Tool Use", "ReAct"],
    evidence: [
      { id: "aa-ev-001", source: "Yao et al. — ReAct (2022)", summary: "추론(Reasoning)과 행동(Acting)을 교차하는 패턴이 HotpotQA에서 기존 대비 +6% 정확도.", curator: "Donghyun Lee", curatorTier: "Gold", comment: "에이전트 아키텍처의 기초 논문. ReAct 패턴 이해 필수." },
      { id: "aa-ev-002", source: "LangChain — Agent Concepts", summary: "Tool-calling 에이전트가 가장 보편적. 계획→실행→관찰→반복 루프가 핵심.", curator: "Soyeon Choi", curatorTier: "Silver", comment: "Production 에이전트 구현 시 가장 참고하기 좋은 문서." },
    ],
  },
  {
    id: "semantic-search",
    title: "Semantic Search",
    category: "Technique",
    summary: "키워드 매칭이 아닌 의미 기반으로 문서를 검색하는 기술. 쿼리와 문서를 같은 임베딩 공간에 투영하여 코사인 유사도로 관련성을 측정한다.",
    qualityScore: 4.0,
    sourceCount: 6,
    updatedAt: "2026-03-15",
    relatedConcepts: ["Embeddings", "RAG", "BM25"],
    evidence: [
      { id: "ss-ev-001", source: "Karpukhin et al. — DPR (2020)", summary: "Dense Passage Retrieval이 BM25 대비 Open-domain QA에서 +9% recall 향상.", curator: "Minjun Park", curatorTier: "Silver", comment: "Dense retrieval의 시작점. BM25 비교가 명확." },
      { id: "ss-ev-002", source: "Cohere — Rerank Guide", summary: "초기 검색 + reranking 2단계 파이프라인이 단일 모델 대비 정확도와 비용 균형을 달성.", curator: "Hyejin Kim", curatorTier: "Gold", comment: "Reranking 도입 효과를 수치로 보여줌. 실무 도입 근거." },
    ],
  },
]

const CATEGORIES = ["All", ...Array.from(new Set(MOCK_CONCEPTS.map((c) => c.category)))]

/* ─────────────────────────────────────────────
   Category badge styles (기존 Cherry 패턴)
───────────────────────────────────────────── */
const CATEGORY_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  Basics:   { bg: "#F3EFFA", text: "#7B5EA7", border: "#C7B8E8" },
  Advanced: { bg: "#FDF0F3", text: "#C94B6E", border: "#F2C4CE" },
  Technique:{ bg: "#EFF7F3", text: "#2D7A5E", border: "#A8D4C0" },
}
const DEFAULT_BADGE = { bg: "#F2F0F7", text: "#9E97B3", border: "#E4E1EE" }
const getBadge = (cat: string) => CATEGORY_BADGE[cat] ?? DEFAULT_BADGE

/* ─────────────────────────────────────────────
   Stars
───────────────────────────────────────────── */
function Stars({ score, color = "#C94B6E" }: { score: number; color?: string }) {
  const full = Math.floor(score)
  const half = score - full >= 0.5
  return (
    <span className="flex items-center gap-[1px] text-[12px]" style={{ color }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ opacity: i < full ? 1 : i === full && half ? 0.6 : 0.2 }}>
          ★
        </span>
      ))}
      <span className="ml-1 text-[11px] font-semibold" style={{ color: "#3D3652" }}>
        {score.toFixed(1)}
      </span>
    </span>
  )
}

/* ─────────────────────────────────────────────
   Relative time
───────────────────────────────────────────── */
function relativeDate(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  return `${days}d ago`
}

/* ─────────────────────────────────────────────
   Concept Card — with compare status badge
───────────────────────────────────────────── */
function ConceptCard({
  concept,
  isSelected,
  onSelect,
  compareStatus,
  owned,
}: {
  concept: Concept
  isSelected: boolean
  onSelect: () => void
  compareStatus: CompareStatus | null
  owned?: boolean
}) {
  const badge = getBadge(concept.category)
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-xl p-4 transition-all duration-150 cursor-pointer",
        "border hover:shadow-sm relative bg-white",
        isSelected
          ? "border-[var(--cherry)] shadow-sm ring-1 ring-[var(--cherry)]/20"
          : "border-[#E4E1EE] hover:border-[#C7B8E8]"
      )}
    >
      {/* Owned badge (ownership-based, always visible) or Compare status badge */}
      {owned ? (
        <span className="absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1 bg-[#EFF7F3] text-[#2D7A5E] border border-[#A8D4C0]">
          ✓ Owned
        </span>
      ) : compareStatus && (
        <span
          className={cn(
            "absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1",
            compareStatus === "up-to-date"
              ? "bg-[#EFF7F3] text-[#2D7A5E] border border-[#A8D4C0]"
              : compareStatus === "outdated"
                ? "bg-[#FDF6EE] text-[#D4854A] border border-[#F0D8B0]"
                : "bg-[#FDF0F3] text-[var(--cherry)] border border-[#F2C4CE]"
          )}
        >
          {compareStatus === "up-to-date" && "✓ Up to date"}
          {compareStatus === "outdated" && <><RefreshCw size={9} /> Update available</>}
          {compareStatus === "gap" && "Gap"}
        </span>
      )}

      {/* Quality + Category */}
      <div className="flex items-center gap-2 mb-2.5">
        <Stars score={concept.qualityScore} />
        <span className="text-[10px] font-semibold" style={{ color: badge.text }}>
          {concept.category}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-[14px] font-bold text-[#1A1626] leading-snug mb-1.5">
        {concept.title}
      </h3>

      {/* Summary — 2 lines */}
      <p className="text-[12px] text-text-muted leading-relaxed line-clamp-2 mb-3">
        {concept.summary}
      </p>

      {/* Footer: sources + updated + gap recommendation */}
      <div className="flex items-center gap-3 text-[11px] text-text-muted">
        <span>
          <span className="font-semibold text-[#3D3652]">{concept.sourceCount}</span> sources
        </span>
        <span className="text-[#E4E1EE]">·</span>
        <span>Updated {relativeDate(concept.updatedAt)}</span>
      </div>
    </button>
  )
}

/* ─────────────────────────────────────────────
   Detail Panel
───────────────────────────────────────────── */
function DetailModal({
  concept,
  onClose,
  compareStatus,
  recommendation,
  onNavigate,
  onQuery,
  allConcepts,
  disabled,
  owned,
  agentConnected,
}: {
  concept: Concept
  onClose: () => void
  compareStatus: CompareStatus | null
  recommendation?: { suggestedDepth: string; estimatedCredits: number; reason: string }
  onNavigate: (conceptId: string) => void
  onQuery: (conceptTitle: string, depth: string, conceptId?: string) => void
  allConcepts: Concept[]
  disabled?: boolean
  owned?: boolean
  agentConnected?: boolean
}) {
  // 구매/팔로우 차단 사유 우선순위: 이미 보유 > 에이전트 미연결
  const blocked = owned || !agentConnected
  const blockReason = owned
    ? "이미 보유한 지식입니다 — 재구매 불필요"
    : !agentConnected
      ? "에이전트가 연결되지 않았습니다"
      : null
  const blockLabel = owned ? "Already Owned" : !agentConnected ? "Agent Not Connected" : ""
  const badge = getBadge(concept.category)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 animate-in fade-in duration-150" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar — title + close */}
        <div className="sticky top-0 bg-white z-10 px-6 pt-5 pb-3 border-b border-[#F2F0F7]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-[17px] font-bold text-[#1A1626] leading-snug">
                  {concept.title}
                </h2>
                <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: badge.text }}>
                  {concept.category}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Stars score={concept.qualityScore} />
                <span className="text-[11px] text-text-muted">
                  {concept.sourceCount} sources · Updated {relativeDate(concept.updatedAt)}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0 -mt-0.5"
            >
              <X size={16} className="text-text-muted" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {/* Compare status — icon + text only */}
          {compareStatus === "up-to-date" && (
            <p className="text-[12px] text-[#2D7A5E] mb-4">
              <CheckCircle2 size={13} className="inline -mt-0.5 mr-1" />
              <span className="font-semibold">Up to date</span> — Your agent has the latest version.
            </p>
          )}
          {compareStatus === "outdated" && (
            <p className="text-[12px] text-[#D4854A] mb-4">
              <RefreshCw size={13} className="inline -mt-0.5 mr-1" />
              <span className="font-semibold">Update available</span> — {recommendation?.reason ?? "Newer evidence exists"}.
            </p>
          )}
          {compareStatus === "gap" && (
            <p className="text-[12px] text-[var(--cherry)] mb-4">
              <AlertCircle size={13} className="inline -mt-0.5 mr-1" />
              <span className="font-semibold">Gap</span> — Your agent doesn&apos;t have this knowledge.
            </p>
          )}

          {/* Summary */}
          <p className="text-[13px] text-[#3D3652] leading-relaxed mb-5">
            {concept.summary}
          </p>

          {/* Related Concepts */}
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted mb-2">
              Related Concepts
            </p>
            <div className="flex flex-wrap gap-1.5">
              {concept.relatedConcepts.map((rc) => {
                const linked = allConcepts.find((c) => c.title === rc || c.id === rc.toLowerCase().replace(/\s+/g, "-"))
                return linked ? (
                  <button
                    key={rc}
                    onClick={() => onNavigate(linked.id)}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#F9F7F5] text-[#7B5EA7] border border-[#C7B8E8] cursor-pointer hover:bg-[#F3EFFA] transition-colors"
                  >
                    {rc}
                  </button>
                ) : (
                  <span
                    key={rc}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#F9F7F5] text-[#6B727E] border border-[#E4E1EE]"
                  >
                    {rc}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Evidence */}
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted mb-2">
              Evidence ({concept.evidence.length})
            </p>
            <div className="space-y-2">
              {concept.evidence.map((ev) => (
                <div key={ev.id} className="rounded-lg border border-[#E4E1EE] p-3">
                  <p className="text-[11px] font-semibold text-[#7B5EA7] mb-1">{ev.source}</p>
                  <p className="text-[12px] text-[#3D3652] leading-relaxed">{ev.summary}</p>
                  <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-[#F2F0F7]">
                    <span className="text-[10px] text-text-muted leading-relaxed">
                      <span className="font-semibold text-[#3D3652]">{ev.curator}</span>
                      <span className="ml-1 text-[9px] px-1.5 py-[1px] rounded-full bg-[#F3EFFA] text-[#7B5EA7] border border-[#C7B8E8]">{ev.curatorTier}</span>
                      <span className="ml-1.5 italic">&ldquo;{ev.comment}&rdquo;</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer — Purchase / Follow */}
        <div className="sticky bottom-0 bg-white border-t border-[#F2F0F7] px-6 py-3">
          {blockReason && (
            <div className={cn(
              "mb-2 text-[11px] flex items-center gap-1.5",
              owned ? "text-[#2D7A5E]" : "text-[#D4854A]",
            )}>
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                owned ? "bg-[#2D7A5E]" : "bg-[#D4854A]",
              )} />
              {blockReason}
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              disabled={blocked}
              onClick={() => { if (blocked) return; onClose(); setTimeout(() => onQuery(concept.title, "purchase", concept.id), 100) }}
              className={cn(
                "text-[12px] font-medium px-4 py-1.5 rounded-lg border transition-all",
                blocked
                  ? "border-[#E4E1EE] text-[#B5AECB] bg-[#F9F7F5] cursor-not-allowed"
                  : "border-[#E4E1EE] text-[#3D3652] hover:border-[var(--cherry)] hover:text-[var(--cherry)] cursor-pointer",
              )}
            >
              {blocked ? blockLabel : <>Purchase <span className="font-normal">20 cr</span></>}
            </button>
            <button
              disabled={blocked}
              onClick={() => { if (blocked) return; onClose(); setTimeout(() => onQuery(concept.title, "follow", concept.id), 100) }}
              className={cn(
                "text-[12px] font-semibold px-4 py-1.5 rounded-lg transition-all",
                blocked
                  ? "bg-[#E4E1EE] text-[#9E97B3] cursor-not-allowed"
                  : "bg-[var(--cherry)] text-white hover:opacity-90 cursor-pointer",
              )}
            >
              {blocked ? blockLabel : <>Follow <span className="font-normal opacity-80">25 cr</span></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Compare — gap analysis logic (mock)
───────────────────────────────────────────── */
type CompareStatus = "up-to-date" | "outdated" | "gap"

type AgentKnowledge = { topic: string; lastUpdated: string }

type GapResult = {
  upToDate: { conceptId: string; qualityScore: number }[]
  outdated: { conceptId: string; title: string; agentDate: string; catalogDate: string; newEvidence: number }[]
  gaps: { conceptId: string; title: string; qualityScore: number }[]
  recommendations: { conceptId: string; suggestedDepth: string; estimatedCredits: number; reason: string }[]
}

function analyzeGaps(agentKnowledge: AgentKnowledge[]): GapResult {
  const upToDate: GapResult["upToDate"] = []
  const outdated: GapResult["outdated"] = []
  const gaps: GapResult["gaps"] = []

  for (const concept of MOCK_CONCEPTS) {
    const titleLower = concept.title.toLowerCase()
    const idLower = concept.id.toLowerCase()
    const match = agentKnowledge.find(
      (k) =>
        titleLower.includes(k.topic.toLowerCase()) ||
        idLower.includes(k.topic.toLowerCase()) ||
        k.topic.toLowerCase().includes(idLower) ||
        k.topic.toLowerCase().includes(titleLower.split(" ")[0])
    )

    if (match) {
      const agentTime = new Date(match.lastUpdated).getTime()
      const catalogTime = new Date(concept.updatedAt).getTime()

      if (agentTime >= catalogTime) {
        upToDate.push({ conceptId: concept.id, qualityScore: concept.qualityScore })
      } else {
        const daysBehind = Math.floor((catalogTime - agentTime) / 86400000)
        outdated.push({
          conceptId: concept.id,
          title: concept.title,
          agentDate: match.lastUpdated,
          catalogDate: concept.updatedAt,
          newEvidence: Math.min(concept.evidence.length, Math.max(1, Math.ceil(daysBehind / 30))),
        })
      }
    } else {
      gaps.push({
        conceptId: concept.id,
        title: concept.title,
        qualityScore: concept.qualityScore,
      })
    }
  }

  gaps.sort((a, b) => b.qualityScore - a.qualityScore)

  const recommendations: GapResult["recommendations"] = [
    ...outdated.map((o) => ({
      conceptId: o.conceptId,
      suggestedDepth: "summary" as const,
      estimatedCredits: 5,
      reason: `${o.newEvidence} new evidence since your last update`,
    })),
    ...gaps.map((g) => ({
      conceptId: g.conceptId,
      suggestedDepth: g.qualityScore >= 4.5 ? "evidence" : "concept",
      estimatedCredits: g.qualityScore >= 4.5 ? 20 : 10,
      reason: "Not in agent's knowledge base",
    })),
  ]

  return { upToDate, outdated, gaps, recommendations }
}

/* ─────────────────────────────────────────────
   Compare Panel
───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   Main: KaaS Catalog Page
───────────────────────────────────────────── */
export function KaasCatalogPage({ onQuery, onCompareResult }: {
  onQuery?: (title: string, depth: string, conceptId?: string) => void
  onCompareResult?: (result: any) => void
}) {
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // API에서 카탈로그 로드 (실패 시 MOCK_CONCEPTS fallback)
  const [concepts, setConcepts] = useState<Concept[]>(MOCK_CONCEPTS)
  const [agents, setAgents] = useState<any[]>([])

  const reloadAgents = () => {
    fetchAgents().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setAgents(data)
        if (!selectedAgentId || !data.find((a: any) => a.id === selectedAgentId)) setSelectedAgentId(data[0].id)
      } else {
        setAgents([])
        setSelectedAgentId("")
      }
    }).catch((e) => console.error("fetchAgents:", e))
  }

  useEffect(() => {
    fetchCatalog().then((data) => {
      if (Array.isArray(data) && data.length > 0) setConcepts(data)
    }).catch(() => {})
    reloadAgents()
    window.addEventListener("kaas-agents-changed", reloadAgents)
    return () => window.removeEventListener("kaas-agents-changed", reloadAgents)
  }, [])

  // Agent selection
  const [selectedAgentId, setSelectedAgentId] = useState<string>("")
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false)
  const selectedAgent = agents.find((a: any) => a.id === selectedAgentId) ?? agents[0] ?? null
  const hasAgent = agents.length > 0

  // Compare state — based on selected agent's knowledge
  const [submitted, setSubmitted] = useState(false)
  const [gapResult, setGapResult] = useState<GapResult | null>(null)

  const handleSubmit = () => {
    if (!selectedAgent) return
    const knowledge = (selectedAgent as any).knowledge ?? []
    setSubmitted(true)
    const handleResult = (result: any) => {
      setGapResult(result)
      onCompareResult?.(result)
    }
    elicitKnowledge((selectedAgent as any).id)
      .then(handleResult)
      .catch(() =>
        compareKnowledge(knowledge.map((k: any) => ({ topic: k.topic, lastUpdated: k.lastUpdated })))
          .then(handleResult)
          .catch(() => handleResult(analyzeGaps(knowledge.map((k: any) => ({ topic: k.topic, lastUpdated: k.lastUpdated })))))
      )
  }

  const handleReset = () => {
    setSubmitted(false)
    setGapResult(null)
  }

  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId)
    setAgentDropdownOpen(false)
    // Reset compare when agent changes
    setSubmitted(false)
    setGapResult(null)
  }

  // Per-concept compare status (3-way)
  const getCompareStatus = (conceptId: string): CompareStatus | null => {
    if (!gapResult) return null
    if (gapResult.upToDate.some((m) => m.conceptId === conceptId)) return "up-to-date"
    if (gapResult.outdated.some((o) => o.conceptId === conceptId)) return "outdated"
    if (gapResult.gaps.some((g) => g.conceptId === conceptId)) return "gap"
    return null
  }

  // 선택된 에이전트가 이미 보유한 지식인지 확인 (Compare 실행 여부와 무관하게 동작)
  const ownedConceptIds = useMemo(() => {
    const knowledge: Array<{ topic: string }> = (() => {
      const raw = (selectedAgent as any)?.knowledge
      try { return typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []) } catch { return [] }
    })()
    const owned = new Set<string>()
    for (const c of concepts) {
      const titleLower = c.title.toLowerCase()
      const idLower = c.id.toLowerCase()
      const match = knowledge.find((k) =>
        titleLower.includes(k.topic.toLowerCase()) ||
        idLower.includes(k.topic.toLowerCase()) ||
        k.topic.toLowerCase().includes(idLower) ||
        k.topic.toLowerCase().includes(titleLower.split(" ")[0])
      )
      if (match) owned.add(c.id)
    }
    return owned
  }, [selectedAgent, concepts])

  const isOwned = (conceptId: string) => ownedConceptIds.has(conceptId)

  const categories = ["All", ...Array.from(new Set(concepts.map((c) => c.category)))]

  const filtered = concepts.filter((c) => {
    const matchCategory = activeCategory === "All" || c.category === activeCategory
    const matchQuery =
      query === "" ||
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.summary.toLowerCase().includes(query.toLowerCase())
    return matchCategory && matchQuery
  })

  const selected = filtered.find((c) => c.id === selectedId) ?? null

  return (
    <div className="flex flex-col gap-5">
      {/* Header + Compare button */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1
            className="font-extrabold text-[#1A1626] leading-none mb-2 text-[20px] lg:text-[28px]"
            style={{ letterSpacing: "-0.5px" }}
          >
            Knowledge Catalog
          </h1>
          <p className="text-[13px] text-text-muted">
            Browse curated AI concepts · {filtered.length} concept{filtered.length !== 1 ? "s" : ""}
            {gapResult && (
              <span className="ml-2 text-[11px]">
                <span className="text-[#2D7A5E] font-semibold">✓ {gapResult.upToDate.length}</span>
                {gapResult.outdated.length > 0 && (
                  <span className="text-[#D4854A] font-semibold ml-1.5">⟳ {gapResult.outdated.length}</span>
                )}
                {gapResult.gaps.length > 0 && (
                  <span className="text-[var(--cherry)] font-semibold ml-1.5">✕ {gapResult.gaps.length}</span>
                )}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {/* Agent selector */}
          {hasAgent && selectedAgent ? (
          <div className="relative">
            <button
              onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-[#E4E1EE] text-[#3D3652] hover:border-[#C7B8E8] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>{selectedAgent.icon ?? "🤖"}</span>
              <span>{selectedAgent.name}</span>
              <ChevronDown size={12} className={cn("text-[#6B727E] transition-transform", agentDropdownOpen && "rotate-180")} />
            </button>
            {agentDropdownOpen && (
              <div className="absolute top-full mt-1 left-0 bg-white rounded-lg border border-[#E4E1EE] shadow-lg z-20 min-w-[180px]">
                {agents.map((a: any) => (
                  <button
                    key={a.id}
                    onClick={() => handleAgentChange(a.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-[12px] hover:bg-[#F9F7F5] cursor-pointer first:rounded-t-lg last:rounded-b-lg flex items-center gap-2",
                      a.id === selectedAgentId && "bg-[#F9F7F5] font-semibold"
                    )}
                  >
                    <span>{a.icon}</span>
                    <span className="flex-1">{a.name}</span>
                    <span className="text-[10px] text-[#6B727E]">{a.credits}cr</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          ) : (
            <span className="text-[11px] text-[#999]">Dashboard에서 에이전트를 등록하세요</span>
          )}

          <button
            disabled={false}
            onClick={submitted ? handleReset : handleSubmit}
            className={cn(
              "text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex-shrink-0 flex items-center gap-1.5",
              submitted
                ? "bg-[var(--cherry)] text-white border-[var(--cherry)] hover:opacity-90"
                : "border-[var(--cherry)] text-[var(--cherry)] hover:bg-[#FDF0F3]"
            )}
          >
            <GitCompare size={13} className={cn("transition-transform duration-500", submitted && "animate-spin")} style={submitted ? { animation: "spin 2s linear infinite" } : undefined} />
            Compare
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search concepts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-[13px] rounded-lg border border-[#E4E1EE] bg-white placeholder:text-text-muted focus:outline-none focus:border-[var(--cherry)] focus:ring-1 focus:ring-[var(--cherry)]/20 transition-colors"
        />
      </div>

      {/* Category filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map((cat) => {
          const isActive = activeCategory === cat
          const badge = cat === "All" ? DEFAULT_BADGE : getBadge(cat)
          return (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setSelectedId(null) }}
              className={cn(
                "text-[11px] font-semibold px-3 py-1 rounded-full border transition-all cursor-pointer",
                isActive
                  ? "bg-[#1A1626] text-white border-[#1A1626]"
                  : "bg-white border-[#E4E1EE] hover:border-[#C7B8E8]"
              )}
              style={isActive ? undefined : { color: badge.text }}
            >
              {cat}
            </button>
          )
        })}
      </div>

      {/* Cards grid — each card shows compare status after submit */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((c) => (
          <ConceptCard
            key={c.id}
            concept={c}
            isSelected={selectedId === c.id}
            onSelect={() => setSelectedId(selectedId === c.id ? null : c.id)}
            compareStatus={getCompareStatus(c.id)}
            owned={isOwned(c.id)}
          />
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[14px] text-text-muted">No concepts found</p>
          <button
            onClick={() => { setQuery(""); setActiveCategory("All") }}
            className="text-[13px] text-[var(--cherry)] font-medium mt-2 cursor-pointer hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <DetailModal
          concept={selected}
          onClose={() => setSelectedId(null)}
          compareStatus={getCompareStatus(selected.id)}
          recommendation={gapResult?.recommendations.find((r) => r.conceptId === selected.id)}
          onNavigate={(id) => setSelectedId(id)}
          allConcepts={concepts}
          disabled={false}
          owned={isOwned(selected.id)}
          agentConnected={!!(selectedAgent && (selectedAgent as any).is_active !== false && (selectedAgent as any).api_key)}
          onQuery={(title, depth, conceptId) => {
            onQuery?.(title, depth, conceptId)
          }}
        />
      )}

    </div>
  )
}
