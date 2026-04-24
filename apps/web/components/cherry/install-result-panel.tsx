"use client"

/**
 * InstallResultPanel — compact side panel showing the last install result
 * (installed / skipped / failed) + the agent's current `local_skills` list.
 *
 * Shown to the right of the Connect page on desktop (lg+), stacked below
 * the Install Skill card on mobile. See
 * `apps/docs/install-skill/1-work-guidelines.md §7`.
 */

import { useState } from "react"
import type { InstallBuildResponse } from "@/lib/bench-api"

interface Props {
  agentName?: string
  lastResult: InstallBuildResponse | null
  running: boolean
  error: string | null
}

export function InstallResultPanel({
  agentName,
  lastResult,
  running,
  error,
}: Props) {
  return (
    <aside
      className="rounded-[16px] p-4 space-y-4"
      style={{
        backgroundColor: "#FDFBF5",
        border: "1px solid #E9D1A6",
        boxShadow: "0 2px 12px rgba(107,79,42,0.06)",
      }}
    >
      <header className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: running ? "#B12A17" : "#9A7C55" }} />
        <h3 className="text-[12px] font-black uppercase tracking-[0.18em] text-[#3A2A1C]">
          Install Log
        </h3>
        {running && (
          <span className="ml-auto text-[10px] font-bold text-[#B12A17] animate-pulse">
            ⌛ installing…
          </span>
        )}
      </header>

      {/* Empty state */}
      {!running && !lastResult && !error && (
        <p className="text-[11px] text-[#9A7C55] italic leading-relaxed">
          Pick a build above and click Install to see the log here.
        </p>
      )}

      {/* Error state */}
      {error && (
        <div
          className="rounded-lg px-3 py-2 text-[11px]"
          style={{ backgroundColor: "#FBE8E3", border: "1px solid #F2C7BE", color: "#C8301E" }}
        >
          <span className="font-bold">Install failed.</span>
          <p className="mt-0.5 break-words">{error}</p>
        </div>
      )}

      {/* Install breakdown */}
      {lastResult && (
        <div className="space-y-3">
          {/* Top summary — saved vs failed. skipped 은 의도된 동작이라 숨김. */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <Stat
              label="files saved"
              value={lastResult.installed.length + (lastResult.meta_written ? 1 : 0)}
              color="#2D7A5E"
            />
            <Stat
              label="failed"
              value={lastResult.failed.length}
              color={lastResult.failed.length > 0 ? "#C8301E" : "#9A7C55"}
            />
          </div>

          {/* Installed list */}
          {lastResult.installed.length > 0 && (
            <Section title="Installed">
              {lastResult.installed.map((item) => (
                <Row
                  key={item.saved_path}
                  icon="✓"
                  iconColor="#2D7A5E"
                  primary={item.dir}
                  secondary={`${item.slot} · ${item.size_bytes}B`}
                  tooltip={item.saved_path}
                />
              ))}
              {lastResult.meta_written && (
                <Row
                  icon="✓"
                  iconColor="#2D7A5E"
                  primary="cherry-build-meta"
                  secondary="_meta"
                  tooltip="~/.claude/skills/cherry-build-meta/SKILL.md"
                />
              )}
            </Section>
          )}


          {/* Failed list */}
          {lastResult.failed.length > 0 && (
            <Section title="Failed">
              {lastResult.failed.map((item, i) => (
                <Row
                  key={`${item.slot}-${i}`}
                  icon="✗"
                  iconColor="#C8301E"
                  primary={item.card_id}
                  secondary={item.slot}
                  tooltip={item.error}
                />
              ))}
            </Section>
          )}

          {/* Orphans removed */}
          {lastResult.orphans_removed.length > 0 && (
            <Section title="Cleaned up" subtle>
              {lastResult.orphans_removed.map((dir) => (
                <Row
                  key={dir}
                  icon="🗑"
                  iconColor="#9A7C55"
                  primary={dir}
                  secondary="removed"
                />
              ))}
            </Section>
          )}

          {/* How to activate — BMad-style mode trigger + copy-ready prompt */}
          {lastResult.warnings.length > 0 && (
            <div
              className="rounded-xl p-3 space-y-2"
              style={{
                backgroundColor: "#FFF8E8",
                border: "1.5px solid #E9C967",
              }}
            >
              <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#8B6C2A]">
                How to activate
              </p>
              {lastResult.warnings.map((w, i) => (
                <p
                  key={i}
                  className="text-[11px] text-[#3A2A1C] leading-relaxed"
                >
                  {w.includes('"') ? formatWithCode(w) : w}
                </p>
              ))}

              {lastResult.activation_prompt && (
                <CopyablePrompt text={lastResult.activation_prompt} />
              )}
            </div>
          )}

          {/* Agent's current skills (from install response) */}
          {lastResult.local_skills_after.length > 0 && (
            <Section title={`On agent${agentName ? ` · ${agentName}` : ""} (from response)`}>
              {lastResult.local_skills_after.map((item) => (
                <Row
                  key={item.dir}
                  icon="🤖"
                  iconColor="#3A2A1C"
                  primary={item.dir}
                  secondary={`${(item.sizeBytes ?? 0)}B`}
                  tooltip={`mtime: ${item.mtime ?? "unknown"}`}
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </aside>
  )
}

/** Copy-to-clipboard block — click → feedback tooltip for 1.5s. */
function CopyablePrompt({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div
      className="rounded-lg p-2.5 mt-1"
      style={{ backgroundColor: "#FDFBF5", border: "1px solid #E9C967" }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8B6C2A]">
          ✨ Paste into Claude Code
        </span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(text).catch(() => {})
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-[#3A2A1C] text-[#FDFBF5] hover:bg-[#6B4F2A] transition-colors"
        >
          {copied ? "✓ Copied" : "📋 Copy"}
        </button>
      </div>
      <pre className="text-[10px] font-mono text-[#3A2A1C] whitespace-pre-wrap break-words leading-relaxed">
        {text}
      </pre>
    </div>
  )
}

/** Render a warning string, wrapping `"quoted phrases"` in code-style spans. */
function formatWithCode(text: string): React.ReactNode {
  const parts = text.split(/("[^"]+")/g)
  return parts.map((p, i) => {
    if (/^".+"$/.test(p)) {
      const inner = p.slice(1, -1)
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded font-mono text-[10px]"
          style={{ backgroundColor: "#FDFBF5", border: "1px solid #E9C967", color: "#6B4F2A" }}
        >
          {inner}
        </code>
      )
    }
    return <span key={i}>{p}</span>
  })
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-md px-2 py-1.5"
      style={{ backgroundColor: "#FBF6ED", border: "1px solid #F0E7D4" }}
    >
      <div className="text-[16px] font-black tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-[#9A7C55]">{label}</div>
    </div>
  )
}

function Section({ title, subtle, children }: { title: string; subtle?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p
        className="text-[9px] font-bold uppercase tracking-[0.15em] mb-1"
        style={{ color: subtle ? "#9A7C55" : "#6B4F2A" }}
      >
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({
  icon,
  iconColor,
  primary,
  secondary,
  tooltip,
}: {
  icon: string
  iconColor: string
  primary: string
  secondary?: string
  tooltip?: string
}) {
  return (
    <div
      className="flex items-center gap-2 text-[11px] px-2 py-1 rounded hover:bg-[#FBF6ED] transition-colors"
      title={tooltip}
    >
      <span className="flex-shrink-0" style={{ color: iconColor }}>
        {icon}
      </span>
      <span className="font-mono text-[#3A2A1C] truncate flex-1">{primary}</span>
      {secondary && (
        <span className="text-[10px] text-[#9A7C55] flex-shrink-0">{secondary}</span>
      )}
    </div>
  )
}
