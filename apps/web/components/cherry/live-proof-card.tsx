"use client"

/**
 * LiveProofCard — second verification channel.
 *
 * Separate from InstallResultPanel (which shows what the server thinks was
 * installed). This card shows what the AGENT itself reports when the user
 * asks Claude Code to run `generate_self_report` via natural language.
 *
 * Two independent proofs ↔ if they agree, the install is truly verified.
 */

import type { LocalSkillItem } from "@/lib/bench-api"

interface LiveReport {
  items: LocalSkillItem[]
  receivedAt: string
}

interface Props {
  agentName?: string
  liveReport: LiveReport | null
}

export function LiveProofCard({ agentName, liveReport }: Props) {
  return (
    <div
      className="rounded-[20px] p-5 lg:p-6"
      style={{
        backgroundColor: liveReport ? "#EFF7F3" : "#FBF6ED",
        border: `1px solid ${liveReport ? "#B8D8C4" : "#E9D1A6"}`,
        boxShadow: "0 4px 20px rgba(107,79,42,0.06)",
      }}
    >
      <header className="flex items-center gap-2 mb-3">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: liveReport ? "#2D7A5E" : "#9A7C55" }}
        />
        <h3
          className="text-[14px] font-extrabold"
          style={{ color: liveReport ? "#2D7A5E" : "#3A2A1C" }}
        >
          Live proof from Claude Code
        </h3>
        {liveReport && (
          <span className="ml-auto text-[10px] font-bold text-[#2D7A5E]">
            ✓ received {timeAgo(liveReport.receivedAt)}
          </span>
        )}
      </header>

      {liveReport ? (
        <>
          <p className="text-[11px] text-[#6B4F2A] mb-3">
            {agentName ?? "Agent"} reported{" "}
            <span className="font-semibold">{liveReport.items.length} skill {liveReport.items.length === 1 ? "directory" : "directories"}</span>{" "}
            on its own. Independent proof, separate from the server response.
          </p>
          <div className="space-y-1">
            {liveReport.items.map((item) => (
              <div
                key={item.dir}
                className="flex items-center gap-2 text-[11px] px-2 py-1 rounded bg-white/60"
                title={`mtime: ${item.mtime ?? "unknown"}`}
              >
                <span style={{ color: "#2D7A5E" }}>✓</span>
                <span className="font-mono text-[#3A2A1C] truncate flex-1">
                  {item.dir}
                </span>
                <span className="text-[10px] text-[#9A7C55]">{item.sizeBytes}B</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-[12px] text-[#6B4F2A] leading-relaxed">
          <p className="mb-2">
            An independent proof channel, separate from the server response.
            Ask Claude Code in plain language:
          </p>
          <pre
            className="rounded-lg px-3 py-2 font-mono text-[11px] mb-2 whitespace-pre-wrap"
            style={{ backgroundColor: "#FDFBF5", border: "1px solid #E9D1A6" }}
          >
            Report my installed cherry skills to the server
          </pre>
          <p className="italic text-[11px] text-[#9A7C55]">
            → When Claude calls <code className="px-1 rounded bg-[#FDFBF5] text-[10px]">generate_self_report</code>,
            the result appears here in real time.
          </p>
        </div>
      )}
    </div>
  )
}

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 5) return "just now"
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  return `${Math.floor(sec / 3600)}h ago`
}
