"use client"

import { BookOpen, Clock, Bell } from "lucide-react"

/* ─────────────────────────────────────────────
   Topic metadata
───────────────────────────────────────────── */
const TOPIC_META: Record<string, { title: string; section: "BASICS" | "ADVANCED"; description: string }> = {
  // BASICS
  "prompting": {
    title: "Prompting Techniques",
    section: "BASICS",
    description: "Zero-shot, few-shot, chain-of-thought prompting, prompt templates, and best practices for instruction design."
  },
  "rag": {
    title: "RAG (Retrieval-Augmented Generation)",
    section: "BASICS",
    description: "Document chunking, embedding strategies, vector search, retrieval pipelines, and grounding LLM outputs with external knowledge."
  },
  "fine-tuning": {
    title: "Fine-tuning",
    section: "BASICS",
    description: "Supervised fine-tuning, instruction tuning, data preparation, hyperparameter selection, and evaluation metrics."
  },
  "agent-architectures": {
    title: "Agent Architectures",
    section: "BASICS",
    description: "ReAct, tool-use patterns, planning loops, memory systems, and building autonomous AI agents."
  },
  "embeddings": {
    title: "Embeddings & Vector DBs",
    section: "BASICS",
    description: "Text embeddings, similarity search, vector database selection, indexing strategies, and hybrid search."
  },
  "evaluation": {
    title: "Evaluation",
    section: "BASICS",
    description: "Benchmarks, human evaluation, automated metrics, A/B testing, and measuring LLM performance systematically."
  },
  // ADVANCED
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
  "multi-agent": {
    title: "Multi-agent Systems",
    section: "ADVANCED",
    description: "Agent collaboration, orchestration patterns, communication protocols, and building agent teams."
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
}

/* ─────────────────────────────────────────────
   Handbook Placeholder Page
───────────────────────────────────────────── */
export function HandbookPlaceholder({ topicId }: { topicId: string }) {
  const meta = TOPIC_META[topicId] ?? {
    title: "Coming Soon",
    section: "BASICS" as const,
    description: "This topic is currently being developed."
  }

  return (
    <div style={{ maxWidth: "700px" }}>
        {/* Section badge */}
        <span 
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold mb-3"
          style={{ 
            backgroundColor: meta.section === "BASICS" ? "#F3EFFA" : "#FDF0F3",
            color: meta.section === "BASICS" ? "#7B5EA7" : "#C94B6E"
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

      {/* Coming Soon Card */}
      <div 
        className="rounded-[12px] p-6"
        style={{ 
          backgroundColor: "#F3EFFA", 
          border: "1px solid #C7B8E8"
        }}
      >
        <div className="flex items-start gap-4">
          <div 
            className="w-12 h-12 rounded-[10px] flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "#7B5EA7" }}
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
                style={{ backgroundColor: "#FDF0F3", color: "#C94B6E", border: "1px solid #F2C4CE" }}
              >
                <Clock size={12} />
                Expected Q2 2026
              </div>
              <button 
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium cursor-pointer transition-colors hover:bg-[#E8E3F3]"
                style={{ backgroundColor: "white", color: "#7B5EA7", border: "1px solid #C7B8E8" }}
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
