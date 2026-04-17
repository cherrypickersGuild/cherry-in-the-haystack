"use client"

import { BookOpen, Clock, Bell } from "lucide-react"

/* ─────────────────────────────────────────────
   Topic metadata
───────────────────────────────────────────── */
const TOPIC_META: Record<string, { title: string; section: "BASICS" | "ADVANCED"; description: string }> = {
  // ───────── BASICS (24 topics) ─────────
  "foundations": {
    title: "Foundations of LLM Systems",
    section: "BASICS",
    description: "Transformer architecture, tokenization & vocabulary design, pretraining objectives, fine-tuning, alignment, and inference & decoding."
  },
  "prompting-reasoning": {
    title: "Prompting & Reasoning",
    section: "BASICS",
    description: "Prompt design principles, few-shot / zero-shot prompting, chain-of-thought, self-consistency, structured output prompting, and prompt templates & versioning."
  },
  "model-selection": {
    title: "Model Selection & Benchmarking",
    section: "BASICS",
    description: "Model capability benchmarking, latency vs cost tradeoffs, provider comparison, model families & sizes, and choosing the right model per task."
  },
  "context-engineering": {
    title: "Context Engineering",
    section: "BASICS",
    description: "Context window management, rolling context windows, prompt compression & summarization, retrieval injection strategies, context prioritization, and long context handling."
  },
  "rag-systems": {
    title: "Retrieval-Augmented Systems (RAG)",
    section: "BASICS",
    description: "Embeddings, vector databases, chunking strategies, retrieval algorithms, RAG pipelines, and RAG evaluation."
  },
  "knowledge-systems": {
    title: "Knowledge Systems",
    section: "BASICS",
    description: "Knowledge bases, GraphRAG, knowledge graph construction, semantic triples, dynamic knowledge graphs, and knowledge freshness & updating."
  },
  "memory": {
    title: "Memory Architectures",
    section: "BASICS",
    description: "Short-term memory, long-term memory, semantic memory, episodic memory, experience replay memory, and note-taking systems."
  },
  "agents-reasoning": {
    title: "Agents & Reasoning Systems",
    section: "BASICS",
    description: "Reflex agents, ReAct agents, planner–executor agents, query decomposition agents, reflection agents, and deep research agents."
  },
  "agent-orchestration": {
    title: "Agent Orchestration",
    section: "BASICS",
    description: "Task decomposition, planning strategies, multi-step reasoning flows, execution loops, error handling & retry logic, and human-in-the-loop systems."
  },
  "tool-use": {
    title: "Tool Use & Integration",
    section: "BASICS",
    description: "Tool calling, tool selection, tool parameterization, API integration patterns, and external knowledge access."
  },
  "system-architecture": {
    title: "System Architecture & Infrastructure",
    section: "BASICS",
    description: "LLM APIs & hosting, caching, streaming & batching, queue systems, observability & logging, and deployment patterns."
  },
  "performance-optimization": {
    title: "Performance Optimization",
    section: "BASICS",
    description: "Latency optimization, cost optimization, prompt optimization, model distillation, caching strategies, and throughput scaling."
  },
  "reliability-safety": {
    title: "Reliability & Safety",
    section: "BASICS",
    description: "Guardrails, output validation, hallucination mitigation, fallback systems, monitoring & alerting, and adversarial robustness."
  },
  "data-engineering": {
    title: "Data Engineering for LLMs",
    section: "BASICS",
    description: "Dataset collection, data cleaning & filtering, synthetic data generation, data labeling pipelines, and dataset versioning & quality control."
  },
  "multi-agent-systems": {
    title: "Multi-Agent Systems",
    section: "BASICS",
    description: "Agent communication protocols, role assignment, coordination strategies, conflict resolution, and emergent behavior."
  },
  "applications": {
    title: "Applications & Productization",
    section: "BASICS",
    description: "Chat applications, autonomous systems, knowledge assistants, research agents, and workflow automation."
  },
  "evaluation-systems": {
    title: "Evaluation Systems",
    section: "BASICS",
    description: "Evaluation pipelines (offline/online), evaluation metrics, A/B testing, LLM-as-a-judge, continuous evaluation loops, human feedback, qualitative evaluation (vibe checks), safety & robustness evaluation, and benchmark vs real-world gap."
  },
  "failure-modes": {
    title: "Failure Modes & Debugging",
    section: "BASICS",
    description: "Hallucination taxonomy, retrieval failure modes, tool use failures, agent loop failures, context overflow, cost explosion patterns, and debugging workflows."
  },
  "control-plane": {
    title: "Control Plane & Protocols",
    section: "BASICS",
    description: "Model Context Protocol (MCP), tool interoperability standards, agent capability specs, tool registry systems, and execution control layers."
  },
  "data-flywheel": {
    title: "Data Flywheel & Learning Systems",
    section: "BASICS",
    description: "Data flywheel architecture, production feedback collection, online learning loops, continuous retraining loops, and eval-driven retraining."
  },
  "multimodal": {
    title: "Multimodal Systems",
    section: "BASICS",
    description: "Vision-language models, voice agents, multimodal retrieval, diffusion pipelines, and cross-modal reasoning."
  },
  "codegen-ai-dev": {
    title: "Code Generation & AI-assisted Development",
    section: "BASICS",
    description: "Codegen systems, agent coding systems, auto-debugging, and AI-assisted dev workflow."
  },
  "security-adversarial": {
    title: "Security & Adversarial Systems",
    section: "BASICS",
    description: "Prompt injection, tool injection, data poisoning (RAG), output exploits, and secure execution."
  },
  "human-ai-ux": {
    title: "Human–AI Interaction & UX",
    section: "BASICS",
    description: "Interaction design, trust calibration, explainability, HITL patterns, and cognitive load optimization."
  },

  // ───────── ADVANCED ─────────
  "chain-of-thought": {
    title: "Chain-of-Thought",
    section: "ADVANCED",
    description: "Step-by-step reasoning, self-consistency, tree-of-thought, and advanced reasoning techniques."
  },
  "multi-hop-rag": {
    title: "Multi-hop RAG",
    section: "ADVANCED",
    description: "Iterative retrieval, query decomposition, multi-step reasoning over documents, and complex QA pipelines."
  },
  "peft-lora": {
    title: "PEFT / LoRA / QLoRA",
    section: "ADVANCED",
    description: "Parameter-efficient fine-tuning, low-rank adaptation, quantized training, and efficient model customization."
  },
  "custom-embeddings": {
    title: "Custom Embeddings",
    section: "ADVANCED",
    description: "Training domain-specific embeddings, contrastive learning, and optimizing retrieval for specialized use cases."
  },
  "adversarial-eval": {
    title: "Adversarial Evaluation",
    section: "ADVANCED",
    description: "Red-teaming, jailbreak testing, robustness evaluation, and stress-testing LLM systems."
  },
  "agent-topologies": {
    title: "Agent Topologies",
    section: "ADVANCED",
    description: "Single-agent systems, multi-agent systems, parallel execution, sequential chains, and graph-based workflows."
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
