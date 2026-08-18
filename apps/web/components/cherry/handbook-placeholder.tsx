"use client"

import { BookOpen, Clock, Bell } from "lucide-react"

/* ─────────────────────────────────────────────
   Topic metadata
───────────────────────────────────────────── */
const TOPIC_META: Record<string, { title: string; section: "BASICS" | "ADVANCED"; description: string }> = {
  // ───────── BASICS (6 topics) ─────────
  // PRD `docs/PRD/product-scope.md` §1 Basics 에 명시된 토픽만. 제목은 PRD 문구 기준.
  "prompting-reasoning": {
    title: "Prompting Techniques & Patterns",
    section: "BASICS",
    description: "Prompt design principles, few-shot / zero-shot prompting, chain-of-thought, self-consistency, structured output prompting, and prompt templates & versioning."
  },
  "rag-systems": {
    title: "Retrieval-Augmented Generation (RAG)",
    section: "BASICS",
    description: "Chunking strategies, retrieval algorithms, RAG pipelines, and RAG evaluation."
  },
  "fine-tuning": {
    title: "Fine-tuning Strategies",
    section: "BASICS",
    description: "Supervised fine-tuning, instruction tuning, training data preparation, and deciding when to fine-tune versus prompt or retrieve."
  },
  "agents-reasoning": {
    title: "Agent Architectures",
    section: "BASICS",
    description: "Reflex agents, ReAct agents, planner–executor agents, query decomposition agents, reflection agents, and deep research agents."
  },
  "embeddings": {
    title: "Embeddings & Vector Databases",
    section: "BASICS",
    description: "Embedding models and vector representations, vector database indexing, similarity search, and choosing embeddings per task."
  },
  "evaluation-systems": {
    title: "Evaluation Methodologies",
    section: "BASICS",
    description: "Evaluation pipelines (offline/online), evaluation metrics, A/B testing, LLM-as-a-judge, continuous evaluation loops, human feedback, qualitative evaluation (vibe checks), safety & robustness evaluation, and benchmark vs real-world gap."
  },

  // ───────── ADVANCED (6 topics) ─────────
  // PRD `docs/PRD/product-scope.md` §2 Advanced 에 명시된 토픽만.
  "chain-of-thought": {
    title: "Advanced Prompting",
    section: "ADVANCED",
    description: "Chain-of-thought and step-by-step reasoning, self-consistency, tree-of-thought, and constitutional AI."
  },
  "multi-hop-rag": {
    title: "Multi-hop RAG & Hybrid Search",
    section: "ADVANCED",
    description: "Iterative retrieval, query decomposition, hybrid dense + sparse search, multi-step reasoning over documents, and complex QA pipelines."
  },
  "peft-lora": {
    title: "PEFT / LoRA / QLoRA",
    section: "ADVANCED",
    description: "Parameter-efficient fine-tuning, low-rank adaptation, quantized training, and efficient model customization."
  },
  "agent-topologies": {
    title: "Multi-Agent Orchestration",
    section: "ADVANCED",
    description: "Multi-agent topologies, parallel execution, sequential chains, graph-based workflows, and coordination between agents."
  },
  "custom-embeddings": {
    title: "Custom Embedding Models",
    section: "ADVANCED",
    description: "Training domain-specific embeddings, contrastive learning, and optimizing retrieval for specialized use cases."
  },
  "adversarial-eval": {
    title: "Adversarial Evaluation & Benchmarking",
    section: "ADVANCED",
    description: "Red-teaming, jailbreak testing, robustness evaluation, and stress-testing LLM systems."
  },
}

/* 섹션별 카드 색상 팔레트 — BASICS/ADVANCED 동일한 보라 톤 */
const CARD_PALETTE = {
  BASICS: {
    cardBg: "#F3EFFA",
    cardBorder: "#C7B8E8",
    iconBg: "#7B5EA7",
    badgeBg: "#FDF0F3",
    badgeBorder: "#F2C4CE",
    badgeText: "#C94B6E",
    btnText: "#7B5EA7",
    btnBorder: "#C7B8E8",
    btnHoverBg: "#E8E3F3",
    // 상단 "BASICS" 섹션 배지만 초록 — Advanced와 구분
    sectionBadgeBg: "#E3F1E1",
    sectionBadgeText: "#2F7A3A",
  },
  ADVANCED: {
    cardBg: "#F3EFFA",
    cardBorder: "#C7B8E8",
    iconBg: "#7B5EA7",
    badgeBg: "#FDF0F3",
    badgeBorder: "#F2C4CE",
    badgeText: "#C94B6E",
    btnText: "#7B5EA7",
    btnBorder: "#C7B8E8",
    btnHoverBg: "#E8E3F3",
    sectionBadgeBg: "#FDF0F3",
    sectionBadgeText: "#C94B6E",
  },
} as const

/* ─────────────────────────────────────────────
   Handbook Placeholder Page
───────────────────────────────────────────── */
export function HandbookPlaceholder({ topicId }: { topicId: string }) {
  const meta = TOPIC_META[topicId] ?? {
    title: "Coming Soon",
    section: "BASICS" as const,
    description: "This topic is currently being developed."
  }
  const palette = CARD_PALETTE[meta.section]

  return (
    <div style={{ maxWidth: "700px" }}>
        {/* Section badge */}
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold mb-3"
          style={{
            backgroundColor: palette.sectionBadgeBg,
            color: palette.sectionBadgeText,
          }}
        >
          {meta.section}
        </span>

        {/* Title */}
        <h1 
          className="font-extrabold text-text-primary leading-tight mb-3"
          style={{ fontSize: "26px", letterSpacing: "-0.3px" }}
        >
          {meta.title}
        </h1>

      {/* Description */}
      <p className="text-[14px] text-text-secondary leading-relaxed mb-8">
        {meta.description}
      </p>

      {/* Coming Soon Card — 섹션별 색상 (BASICS: 앰버, ADVANCED: 보라) */}
      <div
        className="rounded-[12px] p-6"
        style={{
          backgroundColor: palette.cardBg,
          border: `1px solid ${palette.cardBorder}`
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-[10px] flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: palette.iconBg }}
          >
            <BookOpen size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-[16px] font-bold text-text-primary mb-1">
              Handbook In Progress
            </h2>
            <p className="text-[13px] text-text-secondary leading-relaxed mb-4">
              We are actively writing comprehensive content for this topic. 
              The handbook will include practical examples, code snippets, best practices, 
              and real-world case studies from production AI systems.
            </p>

            {/* Status indicators */}
            <div className="flex flex-wrap gap-3">
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium"
                style={{ backgroundColor: palette.badgeBg, color: palette.badgeText, border: `1px solid ${palette.badgeBorder}` }}
              >
                <Clock size={12} />
                Expected Q2 2026
              </div>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium cursor-pointer transition-colors"
                style={{
                  backgroundColor: "white",
                  color: palette.btnText,
                  border: `1px solid ${palette.btnBorder}`,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = palette.btnHoverBg)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
              >
                <Bell size={12} />
                Notify me when ready
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* What to expect */}
      <div className="mt-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.7px] text-text-muted mb-3">
          What to Expect
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Conceptual Overview", desc: "Clear explanations of core ideas" },
            { label: "Code Examples", desc: "Python snippets you can copy" },
            { label: "Best Practices", desc: "Production-tested patterns" },
            { label: "Case Studies", desc: "Real-world implementations" },
          ].map((item) => (
            <div 
              key={item.label}
              className="rounded-[8px] p-3"
              style={{ backgroundColor: "white", border: "1px solid #E4E1EE" }}
            >
              <p className="text-[12px] font-semibold text-text-primary mb-0.5">{item.label}</p>
              <p className="text-[11px] text-text-muted">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Related resources hint */}
      <p className="text-[12px] text-text-muted mt-8">
          In the meantime, check out <span className="text-cherry font-medium cursor-pointer hover:underline">This Week's Highlight</span> for the latest curated content, 
        or explore <span className="text-violet font-medium cursor-pointer hover:underline">Concept Reader</span> for foundational topics.
        </p>
    </div>
  )
}
