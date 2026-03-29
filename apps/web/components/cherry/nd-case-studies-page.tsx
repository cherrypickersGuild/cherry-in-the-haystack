"use client"

import { cn } from "@/lib/utils"

/* ─────────────────────────────────────────────
   Star rating component
───────────────────────────────────────────── */
function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-[12px] text-cherry tracking-tight">
      {Array.from({ length: 5 }, (_, i) => (i < rating ? "★" : "☆")).join("")}
    </span>
  )
}

/* ─────────────────────────────────────────────
   Badge component
───────────────────────────────────────────── */
function Badge({ 
  type 
}: { 
  type: "case-study" | "applied-research" | "models" | "frameworks" 
}) {
  const styles = {
    "case-study": { bg: "#EFF7F3", text: "#2D7A5E", border: "#A8D4BF" },
    "applied-research": { bg: "#F3EFFA", text: "#7B5EA7", border: "#C7B8E8" },
    "models": { bg: "#FDF0F3", text: "#C94B6E", border: "#F2C4CE" },
    "frameworks": { bg: "#F3EFFA", text: "#7B5EA7", border: "#C7B8E8" },
  }
  const labels = {
    "case-study": "Case Study",
    "applied-research": "Applied Research",
    "models": "Models",
    "frameworks": "Frameworks",
  }
  const s = styles[type]
  return (
    <span 
      className="inline-flex px-2 py-1 rounded-[10px] text-[10px] font-bold uppercase"
      style={{ backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {labels[type]}
    </span>
  )
}

/* ─────────────────────────────────────────────
   Main Page Component
───────────────────────────────────────────── */
export function NDCaseStudiesPage() {
  return (
    <div className="flex h-full">
      {/* ───────── Main Content ───────── */}
      <div 
        className="flex-1 overflow-y-auto"
        style={{ padding: "28px 32px", maxWidth: 900 }}
      >
        {/* Header row */}
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 
              className="font-extrabold text-text-primary leading-tight"
              style={{ fontSize: "26px", letterSpacing: "-0.3px" }}
            >
              Case Studies
            </h1>
            <p className="text-[13px] text-text-muted mt-1.5">
              6 items · 2 company sources · Week of Feb 24, 2026
            </p>
          </div>
          <button
            className="px-4 py-1.5 rounded-[6px] text-[12px] font-semibold"
            style={{ backgroundColor: "#EFF7F3", color: "#2D7A5E", border: "1px solid #A8D4BF" }}
          >
            Case Studies
          </button>
        </div>

        {/* ───────── Company Group 1: OpenAI ───────── */}
        <div className="mb-8">
          <div 
            className="flex items-center gap-2.5 pb-2 mb-3"
            style={{ borderBottom: "1px solid #E4E1EE" }}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#5ECBA1" }} />
            <span className="text-[13px] font-bold uppercase tracking-[0.5px] text-text-primary">
              OpenAI — Enterprise Deployments
            </span>
            <span className="text-[11px] text-text-muted ml-auto">3 items</span>
          </div>

          {/* Card A */}
          <ArticleCard
            title="Enterprise AI scaling with GPT-4.1 — Netomi case study"
            desc="Multi-tenant deployment handling 50M+ monthly conversations. Key lessons: concurrency limits at scale, model routing by task complexity, enterprise tier pricing for large deployments."
            badge="case-study"
            rating={3}
            source="Netomi Blog"
            date="Feb 24"
          />

          {/* Card B */}
          <ArticleCard
            title="HIPAA-compliant OpenAI for clinical workflows — GPT-5 BAA"
            desc="Business associate agreement now available for healthcare orgs. Use cases: clinical note generation, diagnosis support, prior authorization automation. PHI handling and audit logging overview."
            badge="case-study"
            rating={3}
            source="OpenAI Blog"
            date="Feb 23"
          />

          {/* Card C */}
          <ArticleCard
            title="Voice-first enterprise AI with GPT-5.1 — Tolan deployment"
            desc="Sub-200ms voice response replacing traditional IVR. GPT-5.1 outperforms Whisper+GPT-4 stack on latency. Architecture: streaming ASR → streaming LLM → streaming TTS in single pipeline."
            badge="case-study"
            rating={3}
            source="Tolan Engineering"
            date="Feb 22"
          />
        </div>

        {/* ───────── Company Group 2: Google ───────── */}
        <div className="mb-8">
          <div 
            className="flex items-center gap-2.5 pb-2 mb-3"
            style={{ borderBottom: "1px solid #E4E1EE" }}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#A987D4" }} />
            <span className="text-[13px] font-bold uppercase tracking-[0.5px] text-text-primary">
              Google — Applied AI Research
            </span>
            <span className="text-[11px] text-text-muted ml-auto">3 items</span>
          </div>

          {/* Card D */}
          <ArticleCard
            title="GenAI for weather forecast uncertainty quantification"
            desc="Calibrated probabilistic outputs for numerical weather prediction. Reduces systematic bias in extreme weather. Deployed at national meteorological agencies across 3 countries."
            badge="applied-research"
            rating={3}
            source="Google AI Blog"
            date="Feb 24"
          />

          {/* Card E */}
          <ArticleCard
            title="AutoBNN — automated Bayesian neural networks for time-series"
            desc="Interpretable probabilistic forecasting with automatic architecture search. Outperforms Prophet on M4 benchmark. Uncertainty estimates calibrated — useful for financial and demand forecasting."
            badge="applied-research"
            rating={3}
            source="Google AI Blog"
            date="Feb 23"
          />

          {/* Card F */}
          <ArticleCard
            title="AI-assisted lung cancer screening — NHS trial results"
            desc="Computer-aided detection improving sensitivity in low-dose CT scans by 12%. Deployed across 8 UK NHS hospitals. Radiologist-in-the-loop workflow. Key finding: AI catches early-stage nodules missed on first pass."
            badge="applied-research"
            rating={4}
            source="Google Health"
            date="Feb 22"
          />
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────��────────────────
   Article Card component
───────────────────────────────────────────── */
function ArticleCard({
  title,
  desc,
  badge,
  rating,
  source,
  date,
}: {
  title: string
  desc: string
  badge: "case-study" | "applied-research"
  rating: number
  source: string
  date: string
}) {
  return (
    <div 
      className="bg-white rounded-[10px] p-4 mb-2.5 cursor-pointer transition-all duration-150 hover:bg-[#FAFAFA]"
      style={{ border: "1px solid #E4E1EE", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#7B5EA7"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#E4E1EE"
      }}
    >
      <h3 className="text-[15px] font-semibold text-text-primary leading-[1.4] mb-1.5">
        {title}
      </h3>
      <p className="text-[13px] text-text-muted leading-[1.55] mb-2.5">
        {desc}
      </p>
      <div className="flex items-center gap-2">
        <Badge type={badge} />
        <StarRating rating={rating} />
        <span 
          className="px-2 py-0.5 rounded-[8px] text-[11px] text-text-muted"
          style={{ border: "1px solid #E4E1EE" }}
        >
          {source}
        </span>
        <span className="text-[10px] text-text-muted">{date}</span>
      </div>
    </div>
  )
}


