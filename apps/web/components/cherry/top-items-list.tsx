import { cn } from "@/lib/utils"

type Badge = {
  label: string
  color: "cherry" | "violet" | "green"
}

type NewsCard = {
  badge: Badge
  stars: number
  maxStars?: number
  title: string
  summary: string
  source: string
  date: string
  accentColor: string
}

const CARDS: NewsCard[] = [
  {
    badge: { label: "Models", color: "cherry" },
    stars: 5,
    title:
      "Claude 3.7 Sonnet — Extended Thinking matches o1 on SWE-bench",
    summary:
      "Opt-in via API parameter. Cost parity with Claude 3.5. Significant uplift on multi-step reasoning. Now recommended for agentic coding workflows.",
    source: "Anthropic",
    date: "Feb 25, 2026",
    accentColor: "#C94B6E",
  },
  {
    badge: { label: "Frameworks", color: "violet" },
    stars: 5,
    title:
      "LangGraph 0.3 — Stateful multi-agent workflows with native streaming",
    summary:
      "Persistent state, built-in interrupt/resume, LangSmith integration out of the box. Major improvement over LangChain's sequential chains for complex pipelines.",
    source: "LangChain",
    date: "Feb 24, 2026",
    accentColor: "#7B5EA7",
  },
  {
    badge: { label: "Case Study", color: "green" },
    stars: 4,
    maxStars: 5,
    title:
      "Baemin's text-to-SQL system — 85% accuracy, 3s latency in production",
    summary:
      "Schema-aware prompting + few-shot examples. PostgreSQL with read replicas. Fallback to keyword search at <60% confidence threshold.",
    source: "Woowa Brothers",
    date: "Feb 23, 2026",
    accentColor: "#2D7A5E",
  },
]

const BADGE_STYLES: Record<
  Badge["color"],
  { bg: string; text: string }
> = {
  cherry: { bg: "#FDF0F3", text: "#C94B6E" },
  violet: { bg: "#F3EFFA", text: "#7B5EA7" },
  green: { bg: "#EFF7F3", text: "#2D7A5E" },
}

function StarRating({
  filled,
  total = 5,
  color,
}: {
  filled: number
  total?: number
  color: string
}) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${filled} out of ${total} stars`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="text-[11px] leading-none"
          style={{ color: i < filled ? color : "#E4E1EE" }}
          aria-hidden
        >
          ★
        </span>
      ))}
    </span>
  )
}

function NewsCardItem({ card }: { card: NewsCard }) {
  const badgeStyle = BADGE_STYLES[card.badge.color]

  return (
    <article
      className={cn(
        "bg-card border border-border rounded-[12px] px-5 py-[18px] shadow-card",
        "transition-all duration-200 hover:shadow-card-hover group cursor-pointer",
        "border-l-[3px]"
      )}
      style={{ borderLeftColor: card.accentColor }}
      tabIndex={0}
      role="button"
      aria-label={`Read: ${card.title}`}
    >
      {/* Top row: badge + stars */}
      <div className="flex items-center justify-between mb-2.5">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.6px] px-2.5 py-1 rounded-full"
          style={{ backgroundColor: badgeStyle.bg, color: badgeStyle.text }}
        >
          {card.badge.label}
        </span>
        <StarRating
          filled={card.stars}
          total={card.maxStars ?? 5}
          color={card.accentColor}
        />
      </div>

      {/* Title */}
      <h3 className="text-[16px] font-bold text-[#1A1626] leading-snug mb-2 text-balance group-hover:text-cherry transition-colors">
        {card.title}
      </h3>

      {/* Summary */}
      <p className="text-[14px] text-text-body leading-relaxed mb-3">
        {card.summary}
      </p>

      {/* Meta row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-text-secondary">
            {card.source}
          </span>
          <span className="text-text-muted text-[12px]">·</span>
          <time
            className="text-[12px] text-text-muted"
            dateTime={card.date}
          >
            {card.date}
          </time>
        </div>
        <a
          href="#"
          className="text-[13px] font-semibold transition-colors"
          style={{ color: card.accentColor }}
          tabIndex={-1}
          aria-hidden
        >
          Read more →
        </a>
      </div>
    </article>
  )
}

export function TopItemsList() {
  return (
    <section aria-labelledby="top-picks-heading">
      <p
        id="top-picks-heading"
        className="text-[13px] font-bold uppercase tracking-[0.5px] text-text-secondary mb-3"
      >
        Top Picks This Week
      </p>
      <div className="flex flex-col gap-3">
        {CARDS.map((card) => (
          <NewsCardItem key={card.title} card={card} />
        ))}
      </div>
    </section>
  )
}
