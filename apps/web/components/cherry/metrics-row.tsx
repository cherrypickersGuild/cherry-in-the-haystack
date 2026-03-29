import { cn } from "@/lib/utils"

type MetricCard = {
  value: string
  valueColor?: string
  label: string
  delta?: string
  deltaColor?: string
  deltaPrefix?: string
}

const METRICS: MetricCard[] = [
  {
    value: "23",
    valueColor: "#1A1626",
    label: "Items This Week",
    delta: "+4 vs last week",
    deltaColor: "#2D7A5E",
  },
  {
    value: "5",
    valueColor: "#C94B6E",
    label: "Top Score Items",
    delta: "Score ★★★★★",
    deltaColor: "#C94B6E",
  },
  {
    value: "4",
    valueColor: "#7B5EA7",
    label: "Categories",
    delta: "Cross-domain",
    deltaColor: "#9E97B3",
  },
  {
    value: "3",
    valueColor: "#2D7A5E",
    label: "New Frameworks",
    delta: "↑ trending",
    deltaColor: "#2D7A5E",
  },
]

function MetricCard({ card }: { card: MetricCard }) {
  return (
    <div
      className={cn(
        "flex-1 min-w-0 bg-card border border-border rounded-[12px] px-5 py-4 shadow-card",
        "transition-all duration-150 hover:shadow-card-hover"
      )}
    >
      <p
        className="text-[32px] font-extrabold leading-none mb-1.5 tabular-nums"
        style={{ color: card.valueColor }}
      >
        {card.value}
      </p>
      <p className="text-[12px] text-text-muted font-medium mb-1.5">
        {card.label}
      </p>
      {card.delta && (
        <p
          className="text-[12px] font-semibold"
          style={{ color: card.deltaColor }}
        >
          {card.delta}
        </p>
      )}
    </div>
  )
}

export function MetricsRow() {
  return (
    <div className="flex gap-3 w-full" role="list" aria-label="Weekly metrics">
      {METRICS.map((card) => (
        <MetricCard key={card.label} card={card} />
      ))}
    </div>
  )
}
