"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { cn } from "@/lib/utils"
import { Search, X, GitCompare, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, ChevronDown, ExternalLink } from "lucide-react"
import { MOCK_AGENTS } from "./kaas-dashboard-page"
import { fetchCatalog, fetchAgents, fetchAgentSelfReport } from "@/lib/api"

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
  creator?: { name: string; karmaTier: string } | null
  onSale?: boolean
  saleDiscount?: number
}

const MOCK_CONCEPTS: Concept[] = [
  {
    id: "rag",
    title: "Retrieval-Augmented Generation",
    category: "Basics",
    summary: "A technique that dynamically injects external knowledge into LLM responses at inference time to improve accuracy. Combines vector DB search with generative models to reduce hallucination and reflect up-to-date information.",
    qualityScore: 4.8,
    sourceCount: 12,
    updatedAt: "2026-04-11",
    relatedConcepts: ["Embeddings", "Vector Databases", "Hybrid Search"],
    evidence: [
      { id: "rag-ev-001", source: "Chip Huyen — AI Engineering", summary: "Retrieval-first mental model. Precision@k is the key metric. Chunking strategy matters more than model choice.", curator: "Hyejin Kim", curatorTier: "Gold", comment: "가장 접근성 좋은 RAG 입문 자료. 실무 적용 시 chunking 섹션 필독." },
      { id: "rag-ev-002", source: "LlamaIndex Docs — Production Patterns", summary: "Naive RAG reaches only ~60% accuracy. Hybrid + rerank brings it to 85%+.", curator: "Minjun Park", curatorTier: "Silver", comment: "Production gap 이해에 핵심. 수치 기반 비교가 설득력 있음." },
      { id: "rag-ev-003", source: "Anthropic Cookbook — Contextual Retrieval", summary: "Adding a context prefix to chunks reduces retrieval failures by 67%.", curator: "Hyejin Kim", curatorTier: "Gold", comment: "2026년 기준 SOTA 기법. 구현 난이도 낮고 효과 큼." },
    ],
  },
  {
    id: "chain-of-thought",
    title: "Chain-of-Thought Prompting",
    category: "Advanced",
    summary: "A prompting technique that makes LLMs explicitly produce intermediate reasoning steps before the final answer. Greatly improves performance on math, logic, and multi-step reasoning.",
    qualityScore: 4.5,
    sourceCount: 8,
    updatedAt: "2026-04-08",
    relatedConcepts: ["Prompting Techniques", "Self-Consistency", "Tree-of-Thought"],
    evidence: [
      { id: "cot-ev-001", source: "Wei et al. — Chain-of-Thought Prompting (2022)", summary: "Few-shot CoT improves GSM8K accuracy by +20% over baseline prompting.", curator: "Donghyun Lee", curatorTier: "Gold", comment: "CoT 분야의 foundational paper. 반드시 읽어야 할 논문." },
      { id: "cot-ev-002", source: "Kojima et al. — Zero-shot CoT", summary: "Adding the single line 'Let's think step by step' dramatically improves zero-shot reasoning.", curator: "Soyeon Choi", curatorTier: "Silver", comment: "실무에서 바로 적용 가능한 가장 간단한 CoT 기법." },
    ],
  },
  {
    id: "embeddings",
    title: "Embeddings & Vector Databases",
    category: "Basics",
    summary: "A technique that converts text into high-dimensional dense vectors to measure semantic similarity. Vector DBs store these embeddings and use ANN search to find similar documents quickly.",
    qualityScore: 4.2,
    sourceCount: 15,
    updatedAt: "2026-04-12",
    relatedConcepts: ["RAG", "Semantic Search", "Dimensionality Reduction"],
    evidence: [
      { id: "emb-ev-001", source: "OpenAI — Embedding Guide", summary: "text-embedding-3-large uses 3072 dims with Matryoshka representation enabling dimension reduction.", curator: "Minjun Park", curatorTier: "Silver", comment: "OpenAI 임베딩 모델 선택 시 첫 번째 참고 자료." },
      { id: "emb-ev-002", source: "Pinecone — Vector Database 101", summary: "HNSW index offers the most general-purpose recall-latency tradeoff.", curator: "Hyejin Kim", curatorTier: "Gold", comment: "벡터 DB 입문자에게 추천. 인덱스 비교가 명확." },
      { id: "emb-ev-003", source: "Weaviate Blog — Hybrid Search", summary: "Combining BM25 + vector search captures both keyword and semantic search benefits.", curator: "Donghyun Lee", curatorTier: "Gold", comment: "Hybrid search 구현 시 필독. 실제 벤치마크 포함." },
    ],
  },
  {
    id: "fine-tuning",
    title: "Fine-tuning & PEFT",
    category: "Basics",
    summary: "Additional training of pre-trained LLMs for a specific domain or task. Parameter-efficient methods like LoRA and QLoRA cut GPU cost dramatically while preserving expertise.",
    qualityScore: 4.6,
    sourceCount: 10,
    updatedAt: "2026-03-28",
    relatedConcepts: ["LoRA", "QLoRA", "Instruction Tuning"],
    evidence: [
      { id: "ft-ev-001", source: "Hu et al. — LoRA (2021)", summary: "Trains only 0.1% of parameters while matching full fine-tuning performance.", curator: "Soyeon Choi", curatorTier: "Silver", comment: "PEFT의 시작점. LoRA 원리 이해에 필수." },
      { id: "ft-ev-002", source: "Dettmers et al. — QLoRA (2023)", summary: "4-bit quantization + LoRA enables 65B model fine-tuning on a single GPU.", curator: "Donghyun Lee", curatorTier: "Gold", comment: "GPU 자원이 제한적인 환경에서 반드시 알아야 할 기법." },
    ],
  },
  {
    id: "multi-agent",
    title: "Multi-Agent Systems",
    category: "Advanced",
    summary: "Architectures where multiple AI agents divide roles and collaborate on complex tasks. Inter-agent communication protocols, memory sharing, and task distribution are core.",
    qualityScore: 4.3,
    sourceCount: 7,
    updatedAt: "2026-04-10",
    relatedConcepts: ["Agent Architectures", "CrewAI", "LangGraph"],
    evidence: [
      { id: "ma-ev-001", source: "Wu et al. — AutoGen (2023)", summary: "Conversation-based multi-agent framework yielding +15% over single-agent in code generation and math problem solving.", curator: "Minjun Park", curatorTier: "Silver", comment: "멀티에이전트 입문에 최적. 코드 예시가 풍부." },
      { id: "ma-ev-002", source: "CrewAI Documentation", summary: "Role-based agent orchestration that lets you define complex workflows in natural language.", curator: "Hyejin Kim", curatorTier: "Gold", comment: "실무 오케스트레이션 패턴 이해에 좋음." },
    ],
  },
  {
    id: "evaluation",
    title: "LLM Evaluation & Benchmarks",
    category: "Basics",
    summary: "A methodology for systematically measuring LLM output quality. Combines automatic metrics (BLEU, ROUGE), LLM-as-judge, and human evaluation to assess accuracy, usefulness, and safety.",
    qualityScore: 4.1,
    sourceCount: 9,
    updatedAt: "2026-04-05",
    relatedConcepts: ["Benchmarks", "LLM-as-Judge", "Red Teaming"],
    evidence: [
      { id: "eval-ev-001", source: "Zheng et al. — Judging LLM-as-a-Judge (2023)", summary: "GPT-4 judgments agree with human evaluation 80%+. Cost-effective evaluation method.", curator: "Soyeon Choi", curatorTier: "Silver", comment: "LLM 평가 자동화의 현실적 방법론." },
      { id: "eval-ev-002", source: "Anthropic — Measuring Model Performance", summary: "Multi-dimensional evaluation (accuracy, toxicity, bias) is more reliable than a single benchmark.", curator: "Donghyun Lee", curatorTier: "Gold", comment: "평가 프레임워크 설계 시 참고할 관점." },
    ],
  },
  {
    id: "prompt-engineering",
    title: "Prompt Engineering",
    category: "Basics",
    summary: "A technique for systematically designing prompts to elicit desired LLM outputs. Combines strategies like few-shot, system prompts, and role assignment.",
    qualityScore: 4.4,
    sourceCount: 11,
    updatedAt: "2026-04-02",
    relatedConcepts: ["Chain-of-Thought", "Few-shot Learning", "System Prompts"],
    evidence: [
      { id: "pe-ev-001", source: "OpenAI — Prompt Engineering Guide", summary: "Specific instructions, delimiter usage, and step-by-step decomposition determine ~80% of prompt quality.", curator: "Hyejin Kim", curatorTier: "Gold", comment: "프롬프트 작성 기본기. 모든 LLM 사용자 필독." },
      { id: "pe-ev-002", source: "Anthropic — Prompt Design Best Practices", summary: "XML tags and role assignment improve Claude response consistency by ~40%.", curator: "Minjun Park", curatorTier: "Silver", comment: "Claude 특화 팁이 많지만 범용적으로도 유용." },
    ],
  },
  {
    id: "agent-architectures",
    title: "Agent Architectures",
    category: "Advanced",
    summary: "Design patterns for LLM-based autonomous agents. Implements tool use, planning, and self-correction via architectures like ReAct, Plan-and-Execute, and Reflection.",
    qualityScore: 4.7,
    sourceCount: 8,
    updatedAt: "2026-04-09",
    relatedConcepts: ["Multi-Agent Systems", "Tool Use", "ReAct"],
    evidence: [
      { id: "aa-ev-001", source: "Yao et al. — ReAct (2022)", summary: "Interleaving Reasoning and Acting yields +6% accuracy on HotpotQA.", curator: "Donghyun Lee", curatorTier: "Gold", comment: "에이전트 아키텍처의 기초 논문. ReAct 패턴 이해 필수." },
      { id: "aa-ev-002", source: "LangChain — Agent Concepts", summary: "Tool-calling agents are most common. The plan→execute→observe loop is the core.", curator: "Soyeon Choi", curatorTier: "Silver", comment: "Production 에이전트 구현 시 가장 참고하기 좋은 문서." },
    ],
  },
  {
    id: "semantic-search",
    title: "Semantic Search",
    category: "Technique",
    summary: "Searches documents by meaning rather than keyword matching. Projects queries and documents into the same embedding space and measures relevance via cosine similarity.",
    qualityScore: 4.0,
    sourceCount: 6,
    updatedAt: "2026-03-15",
    relatedConcepts: ["Embeddings", "RAG", "BM25"],
    evidence: [
      { id: "ss-ev-001", source: "Karpukhin et al. — DPR (2020)", summary: "Dense Passage Retrieval improves recall by +9% over BM25 on open-domain QA.", curator: "Minjun Park", curatorTier: "Silver", comment: "Dense retrieval의 시작점. BM25 비교가 명확." },
      { id: "ss-ev-002", source: "Cohere — Rerank Guide", summary: "A two-stage pipeline (initial retrieval + reranking) balances accuracy and cost vs. a single model.", curator: "Hyejin Kim", curatorTier: "Gold", comment: "Reranking 도입 효과를 수치로 보여줌. 실무 도입 근거." },
    ],
  },
]

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
  onSale,
}: {
  concept: Concept
  isSelected: boolean
  onSelect: () => void
  compareStatus: CompareStatus | null
  owned?: boolean
  onSale?: boolean
}) {
  const badge = getBadge(concept.category)
  // 세일 카드는 우상단 모서리만 기본 rounded-xl(12px)의 절반인 6px로 — SALE 탭이 시각적으로 더 날카롭게 눈에 띔
  const saleCornerRadius = 6
  return (
    <button
      onClick={onSelect}
      className={cn(
        "transition-all duration-150 cursor-pointer hover:shadow-sm relative",
        isSelected ? "shadow-sm ring-1 ring-[var(--cherry)]/20" : ""
      )}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: 16,
        borderRadius: 6,
        backgroundColor: "#FFFFFF",
        border: `1px solid ${isSelected ? "var(--cherry)" : "#E4E1EE"}`,
        position: "relative",
        ...(onSale ? { borderTopRightRadius: saleCornerRadius } : {}),
      }}
    >
      {/* SALE 코너 탭 — 카드 우상단 모서리에 딱 붙음. 카드의 우상단을 6px로 줄였으므로 탭도 같은 값으로 매칭 */}
      {onSale && (
        <span
          className="absolute top-0 right-0 text-[9px] font-extrabold uppercase bg-[#C94B6E] text-white z-[2]"
          style={{
            padding: "3px 9px",
            borderTopRightRadius: saleCornerRadius,
            borderBottomLeftRadius: saleCornerRadius,
            letterSpacing: "0.1em",
          }}
          title="On sale"
        >
          SALE
        </span>
      )}

      {/* 지식 비교 / 소유 표시 — 우하단. owned/up-to-date는 텍스트만, gap만 뱃지 유지 */}
      {owned ? (
        <span className="absolute bottom-3 right-3 text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 text-[#2D7A5E] z-[2]">
          ✓ Owned
        </span>
      ) : compareStatus === "up-to-date" ? (
        <span className="absolute bottom-3 right-3 text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 text-[#2D7A5E] z-[2]">
          ✓ Up to date
        </span>
      ) : compareStatus === "outdated" ? (
        <span className="absolute bottom-3 right-3 text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 text-[#D4854A] z-[2]">
          <RefreshCw size={10} /> Update available
        </span>
      ) : compareStatus === "gap" ? (
        <span className="absolute bottom-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1 bg-[#FDF0F3] text-[var(--cherry)] border border-[#F2C4CE] z-[2]">
          Gap
        </span>
      ) : null}

      {/* Quality + Category */}
      <div className="flex items-center" style={{ gap: 8, marginBottom: 10 }}>
        <Stars score={concept.qualityScore} />
        <span className="text-[10px] font-semibold" style={{ color: badge.text }}>
          {concept.category}
        </span>
      </div>

      {/* Title */}
      <h3
        className="text-[14px] font-bold text-[#1A1626] leading-snug"
        style={{ marginBottom: 6 }}
      >
        {concept.title}
      </h3>

      {/* Summary — 2 lines */}
      <p
        className="text-[12px] text-text-muted leading-relaxed line-clamp-2"
        style={{ marginBottom: 12 }}
      >
        {concept.summary}
      </p>

      {/* Creator + Karma */}
      {concept.creator && (
        <div
          className="flex items-center text-[10px]"
          style={{ gap: 6, marginBottom: 8 }}
        >
          <span className="text-[#666]">by</span>
          <span className="font-semibold text-[#3D3652]">{concept.creator.name === "__SYSTEM__" ? "Market" : concept.creator.name}</span>
          <span className={cn(
            "text-[9px] font-bold uppercase tracking-wide",
            concept.creator.karmaTier === "Platinum" ? "text-[#7B5EA7]" :
            concept.creator.karmaTier === "Gold" ? "text-[#D4854A]" :
            concept.creator.karmaTier === "Silver" ? "text-[#888]" :
            "text-[#AAA]"
          )}>
            {concept.creator.karmaTier}
          </span>
        </div>
      )}

      {/* Footer: sources + updated + gap recommendation */}
      <div
        className="flex items-center text-[11px] text-text-muted"
        style={{ gap: 12 }}
      >
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
  agentWalletType,
  onSale,
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
  agentWalletType?: "evm" | "near"
  onSale?: boolean
}) {
  // 체인 선택 추적 (Dashboard의 CHAIN_EVENT — dashboard 페이지에서 정의됨)
  const [selectedChainUi, setSelectedChainUi] = useState<"status" | "near">("status")
  useEffect(() => {
    if (typeof window === "undefined") return
    const CHAIN_KEY = "kaas-selected-chain"
    const CHAIN_EVENT = "kaas-selected-chain-changed"
    const read = () => {
      const v = (window.localStorage.getItem(CHAIN_KEY) as "status" | "near") || "status"
      setSelectedChainUi(v)
    }
    read()
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail === "status" || detail === "near") setSelectedChainUi(detail)
    }
    window.addEventListener(CHAIN_EVENT, handler)
    return () => window.removeEventListener(CHAIN_EVENT, handler)
  }, [])

  // NEAR chain ↔ EVM wallet (또는 반대) 조합은 실패 경고
  const chainWalletMismatch =
    !!agentWalletType &&
    ((selectedChainUi === "near" && agentWalletType === "evm") ||
      (selectedChainUi === "status" && agentWalletType === "near"))
  // 세일 할인율은 DB에서 가져옴 (concept.saleDiscount %)
  const saleRate = (concept.saleDiscount ?? 20) / 100
  const purchaseBase = 20
  const followBase = 25
  const purchasePrice = onSale ? Math.round(purchaseBase * (1 - saleRate)) : purchaseBase
  const followPrice = onSale ? Math.round(followBase * (1 - saleRate)) : followBase
  // Block reason priority: already owned > agent not connected
  const blocked = owned || !agentConnected
  const blockReason = owned
    ? "Already in your knowledge — no need to repurchase"
    : !agentConnected
      ? "Agent is not connected"
      : null
  const blockLabel = owned ? "Already Owned" : !agentConnected ? "Agent Not Connected" : ""
  const badge = getBadge(concept.category)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 animate-in fade-in duration-150" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
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
              {concept.creator && (
                <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
                  <span className="text-[#666]">by</span>
                  <span className="font-semibold text-[#3D3652]">{concept.creator.name === "__SYSTEM__" ? "Market" : concept.creator.name}</span>
                  <span className={cn(
                    "text-[9px] font-bold uppercase tracking-wide",
                    concept.creator.karmaTier === "Platinum" ? "text-[#7B5EA7]" :
                    concept.creator.karmaTier === "Gold" ? "text-[#D4854A]" :
                    concept.creator.karmaTier === "Silver" ? "text-[#888]" :
                    "text-[#AAA]"
                  )}>
                    {concept.creator.karmaTier}
                  </span>
                </div>
              )}
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
          {!blocked && chainWalletMismatch && (
            <div className="mb-2 text-[11px] flex items-start gap-1.5 text-[#C97B1A] bg-[#FFF8F0] rounded-lg px-2.5 py-1.5 border border-[#F3D7AB]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C97B1A] mt-1 flex-shrink-0" />
              <span>
                Selected chain is <b>{selectedChainUi === "near" ? "NEAR" : "Status"}</b> but the agent uses a{" "}
                <b>{agentWalletType === "evm" ? "MetaMask" : "NEAR"}</b> wallet. Switch chain (top-right) or use an agent with the matching wallet type.
              </span>
            </div>
          )}
          {onSale && !blocked && (
            <div className="mb-2 flex items-center justify-end gap-1.5 text-[11px] text-[var(--cherry)] font-semibold">
              <span>{concept.saleDiscount ?? 20}% off</span>
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
              {blocked ? blockLabel : (
                <>Purchase{" "}
                  {onSale ? (
                    <>
                      <span className="font-normal line-through text-[#B5AECB] mr-1">{purchaseBase} cr</span>
                      <span className="font-semibold text-[var(--cherry)]">{purchasePrice} cr</span>
                    </>
                  ) : (
                    <span className="font-normal">{purchaseBase} cr</span>
                  )}
                </>
              )}
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
              {blocked ? blockLabel : (
                <>Follow{" "}
                  {onSale ? (
                    <>
                      <span className="font-normal line-through opacity-60 mr-1">{followBase} cr</span>
                      <span className="font-normal opacity-95">{followPrice} cr</span>
                    </>
                  ) : (
                    <span className="font-normal opacity-80">{followBase} cr</span>
                  )}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Compare types
───────────────────────────────────────────── */
type CompareStatus = "up-to-date" | "outdated" | "gap"

type GapResult = {
  upToDate: { conceptId: string; title: string; qualityScore: number }[]
  outdated: { conceptId: string; title: string; agentDate: string; catalogDate: string; newEvidence: number }[]
  gaps: { conceptId: string; title: string; qualityScore: number }[]
  recommendations: { conceptId: string; suggestedDepth: string; estimatedCredits: number; reason: string }[]
}

/* ─────────────────────────────────────────────
   Main: KaaS Catalog Page
───────────────────────────────────────────── */
export function KaasCatalogPage({ onQuery, onCompareResult, initialConceptId, onInitialConceptConsumed }: {
  onQuery?: (title: string, depth: string, conceptId?: string) => void
  onCompareResult?: (result: any) => void
  initialConceptId?: string | null
  onInitialConceptConsumed?: () => void
}) {
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // API에서 카탈로그 로드 (실패 시 MOCK_CONCEPTS fallback)
  const [concepts, setConcepts] = useState<Concept[]>(MOCK_CONCEPTS)

  // initialConceptId 변경 시 1초 후 모달 오픈 (화면 전환 안정화 대기), 일회성 소비
  useEffect(() => {
    if (!initialConceptId) return
    const t = setTimeout(() => {
      setSelectedId(initialConceptId)
      onInitialConceptConsumed?.()
    }, 1000)
    return () => clearTimeout(t)
  }, [initialConceptId, onInitialConceptConsumed])
  const [agents, setAgents] = useState<any[]>([])

  const reloadAgents = async () => {
    // 비로그인 상태에서 fetchAgents → 401 → fetchWithAuth 의 redirectToLogin()
    // 트리거되어 마켓 진입 시 /login 으로 강제이동되는 버그 방지.
    const { getAccessToken } = await import("@/lib/auth")
    if (!getAccessToken()) {
      setAgents([])
      setSelectedAgentId("")
      return
    }
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

  const reloadCatalog = () => {
    fetchCatalog().then((data) => {
      if (Array.isArray(data) && data.length > 0) setConcepts(data)
    }).catch(() => {})
  }

  useEffect(() => {
    reloadCatalog()
    reloadAgents()
    window.addEventListener("kaas-agents-changed", reloadAgents)
    window.addEventListener("kaas-catalog-changed", reloadCatalog)
    return () => {
      window.removeEventListener("kaas-agents-changed", reloadAgents)
      window.removeEventListener("kaas-catalog-changed", reloadCatalog)
    }
  }, [])

  // Agent selection
  const [selectedAgentId, setSelectedAgentId] = useState<string>("")
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false)
  const selectedAgent = agents.find((a: any) => a.id === selectedAgentId) ?? agents[0] ?? null
  const hasAgent = agents.length > 0

  // Compare runs automatically whenever the agent, catalog, or local skill
  // state changes — no user-initiated button. After a purchase the Shop
  // page fires `kaas-purchase-complete` which we also listen for below.
  const [gapResult, setGapResult] = useState<GapResult | null>(null)
  const submitted = true

  // Compare = diff와 동일하게 fetchAgentSelfReport 1회 호출 → local_skills 폴더명(cherry-{uuid})을
  // conceptId로 파싱 → catalog와 교차해 owned/gap 분류.
  // NOTE: diff와 달리 `kaas-self-report` 이벤트는 dispatch 하지 않음 — 콘솔에 보고서 원문이 뜨면 안 됨.
  //       대신 localSkillIds state를 직접 세팅해 카드 OWNED 뱃지만 갱신.
  const runCompare = async (silent: boolean) => {
    if (!selectedAgent) return
    const { fetchAgentSelfReport } = await import("@/lib/api")
    const agentId = (selectedAgent as any).id
    const r: any = await fetchAgentSelfReport(agentId)
    if (!r?.ok || !r?.report) return

    const ownedIds = new Set<string>()
    for (const s of r.report?.local_skills?.items ?? []) {
      if (!s?.hasSkillMd) continue
      const folder = (s.dir ?? "").split(/[\\/]/).filter(Boolean).pop() ?? ""
      if (folder.startsWith("cherry-")) ownedIds.add(folder.slice(7))
    }
    // 동일 이벤트로 OWNED state 갱신 — 자체 handler 가 ownedByAgent 업데이트.
    window.dispatchEvent(new CustomEvent("kaas-self-report", {
      detail: { report: r.report, agentId, agentName: (selectedAgent as any)?.name },
    }))

    const upToDate: Array<{ conceptId: string; title: string; qualityScore: number }> = []
    const gaps: Array<{ conceptId: string; title: string; qualityScore: number }> = []
    for (const c of concepts) {
      const entry = { conceptId: c.id, title: c.title, qualityScore: c.qualityScore }
      if (ownedIds.has(c.id)) upToDate.push(entry)
      else gaps.push(entry)
    }
    gaps.sort((a, b) => b.qualityScore - a.qualityScore)

    const result: any = {
      upToDate,
      outdated: [],
      gaps,
      recommendations: gaps.map((g) => ({
        conceptId: g.conceptId,
        suggestedDepth: g.qualityScore >= 4.5 ? "evidence" : "concept",
        estimatedCredits: g.qualityScore >= 4.5 ? 20 : 10,
        reason: "Not in agent's local skills",
      })),
      agentName: (selectedAgent as any).name,
      source: "local-skills",
    }
    setGapResult(result)
    if (!silent) onCompareResult?.(result)
  }

  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId)
    setAgentDropdownOpen(false)
    setGapResult(null) // new agent → clear stale gaps, next effect re-runs
  }

  // Auto-run Compare on mount + whenever the agent, catalog, or agent's
  // knowledge changes. No user gate — the page always shows a fresh diff.
  useEffect(() => {
    if (!selectedAgent) return
    runCompare(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgent?.id, (selectedAgent as any)?.knowledge, concepts])

  // Re-run Compare after a purchase completes — the Shop page dispatches
  // `kaas-purchase-complete` once the modal flips to success. Refreshes
  // the OWNED badges and the gap summary without a page reload.
  useEffect(() => {
    const onPurchaseComplete = () => {
      if (selectedAgent) runCompare(true)
    }
    window.addEventListener("kaas-purchase-complete", onPurchaseComplete)
    return () => window.removeEventListener("kaas-purchase-complete", onPurchaseComplete)
  }, [selectedAgent])

  // Per-concept compare status (3-way)
  const getCompareStatus = (conceptId: string): CompareStatus | null => {
    if (!gapResult) return null
    if (gapResult.upToDate.some((m) => m.conceptId === conceptId)) return "up-to-date"
    if (gapResult.outdated.some((o) => o.conceptId === conceptId)) return "outdated"
    if (gapResult.gaps.some((g) => g.conceptId === conceptId)) return "gap"
    return null
  }

  // OWNED 는 ONLY 에이전트의 self-report (= ~/.claude/skills/ 실제 파일) 기준.
  // DB 의 구매 기록이나 localStorage 캐시는 "실제로 지금 가지고 있는지" 를 증명
  // 못 한다 (파일이 수동 삭제됐을 수도 있음). 따라서 에이전트가 WS 로 보고한
  // local_skills.items 만 진실로 취급.
  const [ownedByAgent, setOwnedByAgent] = useState<Record<string, Set<string>>>({})

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      const eventAgentId = detail?.agentId
      if (!eventAgentId) return
      const items = detail?.report?.local_skills?.items ?? []
      const ids = new Set<string>()
      for (const s of items) {
        if (!s?.hasSkillMd) continue
        const folder = (s.dir ?? "").split(/[\\/]/).filter(Boolean).pop() ?? ""
        if (folder.startsWith("cherry-")) ids.add(folder.slice(7))
      }
      setOwnedByAgent((prev) => ({ ...prev, [eventAgentId]: ids }))
    }
    window.addEventListener("kaas-self-report", handler)
    return () => window.removeEventListener("kaas-self-report", handler)
  }, [])

  // 페이지에 에이전트가 선택되거나 바뀌면 즉시 self-report 요청 → 최신 상태로 갱신.
  // 성공 시 dashboard 와 동일 패턴으로 "kaas-self-report" 이벤트 디스패치 → 위 리스너가
  // local_skills.items 를 읽어 OWNED 재계산. 실패(연결 끊김 등)면 그냥 빈 상태 유지.
  useEffect(() => {
    const agentId = (selectedAgent as any)?.id
    const agentName = (selectedAgent as any)?.name
    if (!agentId) return
    fetchAgentSelfReport(agentId)
      .then((r: any) => {
        if (r?.ok && r?.report) {
          window.dispatchEvent(new CustomEvent("kaas-self-report", {
            detail: { report: r.report, agentId, agentName },
          }))
        }
      })
      .catch(() => { /* 미연결 — OWNED 빈 상태 */ })
  }, [selectedAgent])

  const ownedConceptIds = useMemo(() => {
    const agentId = (selectedAgent as any)?.id
    if (!agentId) return new Set<string>()
    return ownedByAgent[agentId] ?? new Set<string>()
  }, [selectedAgent, ownedByAgent])

  const isOwned = (conceptId: string) => ownedConceptIds.has(conceptId)

  // SALE 여부는 DB에서 가져옴 (concept.onSale)

  const categories = ["All", "Basic", "Advanced", "Technique"]

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
    <div className="flex flex-col" style={{ gap: 20 }}>
      {/* Header + Compare button */}
      <div className="flex items-start justify-between" style={{ gap: 12 }}>
        <div>
          <div
            className="flex flex-col lg:flex-row lg:items-start"
            style={{ gap: 8, marginBottom: 8 }}
          >
            <h1
              className="font-extrabold text-[#1A1626] leading-none text-[20px] lg:text-[28px]"
              style={{ letterSpacing: "-0.5px" }}
            >
              Knowledge Market
            </h1>
          </div>
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
          <div className="relative"
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setAgentDropdownOpen(false) }}
            tabIndex={-1}
          >
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
                    {selectedAgentId === a.id && <span className="text-[10px] text-[#7B5EA7]">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          ) : (
            <span className="text-[11px] text-[#999]">Register an agent in the Dashboard</span>
          )}
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
          className="w-full pl-9 pr-3 py-2 text-[13px] rounded-md border border-[#E4E1EE] bg-white placeholder:text-text-muted focus:outline-none focus:border-[var(--cherry)] focus:ring-1 focus:ring-[var(--cherry)]/20 transition-colors"
        />
      </div>

      {/* Category filter — tab bar with continuous faint line + active dark segment */}
      <div className="pl-[3px]"><div className="flex items-center gap-5 flex-wrap">
        {categories.map((cat) => {
          const isActive = activeCategory === cat
          return (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setSelectedId(null) }}
              className={cn(
                "relative text-[12px] font-semibold pb-1.5 cursor-pointer transition-colors",
                isActive ? "text-[#1A1626]" : "text-[#9E97B3] hover:text-[#3D3652]"
              )}
            >
              {cat}
              {isActive && (
                <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#1A1626]" />
              )}
            </button>
          )
        })}
      </div></div>

      {/* Cards grid — each card shows compare status after submit.
          grid 유틸 클래스가 청크에서 누락되면 카드들이 inline-block으로 흐르므로
          핵심 layout(display:grid + columns)을 인라인으로 박아 방어. */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        }}
      >
        {filtered.map((c) => (
          <ConceptCard
            key={c.id}
            concept={c}
            isSelected={selectedId === c.id}
            onSelect={() => setSelectedId(selectedId === c.id ? null : c.id)}
            compareStatus={getCompareStatus(c.id)}
            owned={submitted && isOwned(c.id)}
            onSale={!!c.onSale}
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
          owned={submitted && isOwned(selected.id)}
          agentConnected={!!(selectedAgent && (selectedAgent as any).is_active !== false && (selectedAgent as any).api_key)}
          agentWalletType={(() => {
            const w: string = (selectedAgent as any)?.wallet_type ?? (selectedAgent as any)?.walletType ?? ""
            if (w === "evm" || w === "near") return w
            const addr: string = (selectedAgent as any)?.wallet_address ?? (selectedAgent as any)?.walletAddress ?? ""
            return addr.startsWith("0x") ? "evm" : addr ? "near" : undefined
          })()}
          onSale={!!selected.onSale}
          onQuery={(title, depth, conceptId) => {
            onQuery?.(title, depth, conceptId)
          }}
        />
      )}

    </div>
  )
}
