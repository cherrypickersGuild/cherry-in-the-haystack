"use client"

import { cn } from "@/lib/utils"

/* ─────────────────────────────────────────────
   Cherries data
───────────────────────────────────────────── */
const CHERRIES = [
  {
    source: "Building LLMs from Scratch — Sebastian Raschka",
    body: "RAG is framed as an inference-time solution: rather than encoding knowledge into weights, you supply context dynamically. Raschka walks through why this matters for knowledge cutoff and how retrieval quality dominates output quality.",
  },
  {
    source: "Chip Huyen — AI Engineering",
    body: "Frames RAG as a retrieval problem first, generation second. Emphasizes precision@k as the primary metric. Chunking strategy has more impact than model choice for most production RAG systems.",
  },
  {
    source: "LlamaIndex Documentation — Production Patterns",
    body: "Covers the operational gap: chunking, metadata filtering, hybrid search, reranking. The default naive RAG has ~60% retrieval accuracy; production needs hybrid + rerank to reach 85%+.",
  },
]

/* ─────────────────────────────────────────────
   Child concepts data
───────────────────────────────────────────── */
const CHILD_CONCEPTS = [
  { type: "SUBTOPIC", label: "Vector Databases", desc: "Stores and retrieves embeddings for similarity search", color: "#7B5EA7" },
  { type: "SUBTOPIC", label: "Hybrid Search", desc: "Combines dense vector + sparse BM25 retrieval", color: "#7B5EA7" },
  { type: "PREREQUISITE", label: "Embeddings", desc: "Text → dense vector representation", color: "#9E97B3" },
  { type: "EXTENDS", label: "Reranking", desc: "Post-retrieval re-scoring for relevance", color: "#2D7A5E" },
  { type: "RELATED", label: "Chunking Strategies", desc: "How to split documents for retrieval", color: "#D4854A" },
  { type: "EXTENDS", label: "Contextual Retrieval", desc: "Adds context prefix before embedding each chunk", color: "#2D7A5E" },
]

/* ─────────────────────────────────────────────
   References data
───────────────────────────────────────────── */
const REFERENCES = [
  {
    label: "START HERE",
    labelColor: "#C94B6E",
    borderColor: "#C94B6E",
    title: "Chip Huyen — AI Engineering, Chapter 6",
    learn: "Broadest accessible overview. Retrieval-first mental model. Use as your first RAG reference.",
    adds: "Foundational mental model",
  },
  {
    label: "NEXT →",
    labelColor: "#9E97B3",
    borderColor: "#E4E1EE",
    title: "LlamaIndex Documentation — Production RAG Patterns",
    learn: "Operational depth: chunking, hybrid search, reranking. Hands-on.",
    adds: "Production gap knowledge",
  },
  {
    label: "THEN →",
    labelColor: "#9E97B3",
    borderColor: "#E4E1EE",
    title: "Anthropic Cookbook — Contextual Retrieval",
    learn: "State-of-the-art technique adding context prefix. -67% retrieval failures.",
    adds: "Latest SOTA technique",
  },
  {
    label: "DEEP DIVE →",
    labelColor: "#9E97B3",
    borderColor: "#E4E1EE",
    title: "ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction",
    learn: "Academic foundation for late interaction retrieval. For building custom retrievers.",
    adds: "Research-level depth",
    faded: true,
  },
]

/* ─────────────────────────────────────────────
   Main Page Component
───────────────────────────────────────────── */
export function ConceptReaderPage() {
  return (
    <div className="flex flex-col -m-4 -mx-4 lg:-m-8 lg:-mx-10">
      {/* 2-column content (left reading + right panel) */}
      <div className="flex flex-col lg:flex-row lg:flex-1 lg:overflow-hidden">
        {/* Center reading column */}
        <main className="flex-1 overflow-y-auto px-5 py-6 lg:px-12 lg:py-10" style={{ maxWidth: "700px" }}>
          {/* Section badge */}
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-soft text-violet mb-3">
            Basics
          </span>

          {/* Title */}
          <h1 className="text-[20px] lg:text-[28px] font-extrabold text-text-primary tracking-[-0.5px] leading-[1.2] mb-4">
            Retrieval-Augmented Generation
          </h1>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-text-muted mb-8">
            <span>Updated Feb 20, 2026</span>
            <span className="text-border">·</span>
            <span>12 sources</span>
            <span className="text-border">·</span>
            <span>Knowledge Team verified</span>
            <span className="text-border">·</span>
            <span>8 min read</span>
          </div>

          {/* Section 01 — Overview */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted whitespace-nowrap">
                01 — Overview
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-4 text-[14px] text-text-body leading-[1.75]">
              <p>
                RAG combines retrieval systems with generative language models to produce factually grounded responses. 
                At inference time, relevant documents are retrieved and fed as additional context — solving hallucination 
                and knowledge cutoff problems without fine-tuning.
              </p>
              <p>
                <strong className="text-text-primary">Choose RAG when:</strong> factual accuracy matters, knowledge changes frequently, 
                or domain-specific knowledge needs to be integrated cheaply without retraining.
              </p>
              <p>
                Core pipeline: Query → Embed → Retrieve top-k chunks → Stuff context → Generate. 
                The hard parts are chunking strategy, retrieval quality, and context window management.
              </p>
            </div>
          </section>

          {/* Section 02 — Cherries */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted whitespace-nowrap">
                02 — Cherries
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <p className="text-[11px] text-text-muted mb-4">
              Key insights from ingested sources — each covers a distinct, non-overlapping aspect of RAG
            </p>

            <div className="space-y-2.5">
              {CHERRIES.map((cherry, i) => (
                <div
                  key={i}
                  className="bg-card border border-border rounded-[8px] p-4"
                  style={{ borderLeftWidth: "3px", borderLeftColor: "#C94B6E" }}
                >
                  <p className="text-[12px] font-bold text-text-primary mb-1.5 flex items-center gap-1.5">
                    <span>🍒</span>
                    {cherry.source}
                  </p>
                  <p className="text-[12px] text-text-muted leading-[1.6]">{cherry.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 03 — Child Concepts */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted whitespace-nowrap">
                03 — Child Concepts
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {CHILD_CONCEPTS.map((concept, i) => (
                <button
                  key={i}
                  className="bg-card border border-border rounded-[8px] p-3 text-left hover:border-cherry transition-colors cursor-pointer"
                >
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: concept.color }}
                  >
                    {concept.type}
                  </span>
                  <p className="text-[13px] font-semibold text-text-primary mt-0.5">{concept.label}</p>
                  <p className="text-[11px] text-text-muted mt-0.5">{concept.desc}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Section 04 — Progressive References */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted whitespace-nowrap">
                04 — Progressive References
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <p className="text-[11px] text-text-muted mb-4">
              MECE learning path — each reference adds what the previous didn't cover
            </p>

            <div className="space-y-4">
              {REFERENCES.map((ref, i) => (
                <div
                  key={i}
                  className={cn("pl-4 relative", ref.faded && "opacity-60")}
                  style={{ borderLeft: `2px solid ${ref.borderColor}` }}
                >
                  {/* Dot */}
                  <div
                    className="absolute left-[-5px] top-0 w-2 h-2 rounded-full"
                    style={{ backgroundColor: ref.borderColor }}
                  />

                  <span
                    className="text-[9px] font-bold uppercase tracking-wide"
                    style={{ color: ref.labelColor }}
                  >
                    {ref.label}
                  </span>
                  <p className="text-[13px] font-bold text-text-primary mt-0.5">{ref.title}</p>
                  <p className="text-[12px] text-text-muted leading-[1.5] mt-1">
                    <strong className="text-text-secondary">What you'll learn:</strong> {ref.learn}
                  </p>
                  <p className="text-[11px] italic text-violet mt-1">Adds: {ref.adds}</p>
                </div>
              ))}
            </div>
          </section>
        </main>

        {/* Right panel */}
        <aside
          className="w-full lg:w-[280px] lg:flex-shrink-0 overflow-y-auto border-t lg:border-t-0 lg:border-l border-border px-4 py-5"
        >
          {/* Learning Path card */}
          <div className="bg-card border border-border rounded-[12px] p-4 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted mb-3">
              Learning Roadmap
            </p>

            {/* SVG diagram */}
            <svg viewBox="0 0 200 220" className="w-full h-auto mb-3">
              {/* Current node: RAG */}
              <rect x="50" y="10" width="100" height="36" rx="8" fill="white" stroke="#C94B6E" strokeWidth="2" />
              <text x="100" y="32" textAnchor="middle" className="text-[11px] font-bold" fill="#C94B6E">RAG</text>
              <text x="100" y="54" textAnchor="middle" className="text-[8px]" fill="#9E97B3">(you are here)</text>

              {/* Arrow down */}
              <line x1="100" y1="46" x2="100" y2="70" stroke="#E4E1EE" strokeWidth="1.5" />
              <polygon points="95,68 105,68 100,76" fill="#E4E1EE" />

              {/* Prerequisites box */}
              <rect x="25" y="80" width="150" height="44" rx="6" fill="#F2F0F7" stroke="#E4E1EE" strokeWidth="1" />
              <text x="100" y="98" textAnchor="middle" className="text-[9px]" fill="#9E97B3">Prerequisites</text>
              <text x="60" y="114" textAnchor="middle" className="text-[10px] font-medium" fill="#6B6480">Embeddings</text>
              <text x="140" y="114" textAnchor="middle" className="text-[10px] font-medium" fill="#6B6480">Vector DBs</text>

              {/* Dashed arrow */}
              <line x1="100" y1="124" x2="100" y2="148" stroke="#E4E1EE" strokeWidth="1.5" strokeDasharray="4" />
              <polygon points="95,146 105,146 100,154" fill="#E4E1EE" />

              {/* Advanced label */}
              <text x="100" y="168" textAnchor="middle" className="text-[8px] font-bold uppercase" fill="#7B5EA7">Advanced</text>

              {/* Advanced boxes */}
              <rect x="15" y="175" width="80" height="28" rx="5" fill="#F3EFFA" stroke="#C7B8E8" strokeWidth="1" />
              <text x="55" y="193" textAnchor="middle" className="text-[9px] font-medium" fill="#7B5EA7">Multi-hop RAG</text>

              <rect x="105" y="175" width="80" height="28" rx="5" fill="#F2F0F7" stroke="#E4E1EE" strokeWidth="1" opacity="0.6" />
              <text x="145" y="193" textAnchor="middle" className="text-[8px]" fill="#9E97B3">PEFT / LoRA</text>
            </svg>

            {/* Legend */}
            <div className="space-y-1 text-[9px] text-text-muted">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm border-2 border-cherry bg-white" />
                <span>Cherry border = Current</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm border-2 border-violet bg-violet-soft" />
                <span>Violet = Advanced</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm border border-border bg-secondary" />
                <span>Gray = Other</span>
              </div>
            </div>
          </div>

          {/* New in Digest card */}
          <div
            className="rounded-[12px] p-3.5 mb-4"
            style={{ backgroundColor: "#FDF0F3", border: "1px solid #F2C4CE" }}
          >
            <p className="text-[10px] font-bold text-cherry mb-1">⚡ New in Digest</p>
            <p className="text-[13px] font-bold text-text-primary mb-1">Contextual Retrieval</p>
            <p className="text-[11px] text-text-muted mb-2">
              Extends RAG · -67% failures · Score ★★★★★
            </p>
            <a href="#" className="text-[11px] font-medium text-cherry hover:underline">
              See in Digest →
            </a>
          </div>

          {/* Contributors card */}
          <div className="bg-card border border-border rounded-[12px] p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted mb-3">
              Knowledge Team
            </p>

            <div className="space-y-2.5">
              {[
                { initials: "KJ", name: "Keanu J.", role: "Lead reviewer" },
                { initials: "SY", name: "Soyeon Y.", role: "Evidence sourcing" },
                { initials: "MH", name: "Min H.", role: "Concept mapping" },
              ].map((contrib, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-text-secondary">
                    {contrib.initials}
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-text-primary">{contrib.name}</p>
                    <p className="text-[10px] text-text-muted">{contrib.role}</p>
                  </div>
                </div>
              ))}
            </div>

            <a href="#" className="block mt-3 text-[11px] font-medium text-cherry hover:underline">
              + 4 contributors
            </a>
          </div>
        </aside>
      </div>
    </div>
  )
}
