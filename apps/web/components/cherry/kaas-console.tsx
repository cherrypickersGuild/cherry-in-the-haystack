"use client"

import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react"
import { cn } from "@/lib/utils"
import { Send, ExternalLink, ChevronDown, Shield, Bot, Cherry, Minus, X } from "lucide-react"
import { purchaseConcept, followConcept } from "@/lib/api"
import { SelfReportLog } from "./kaas-dashboard-page"

/* ═══════════════════════════════════════════════
   Knowledge base (mock) — same 9 concepts as catalog
═══════════════════════════════════════════════ */
type Evidence = { source: string; summary: string; curator: string; curatorTier: string; comment: string }
type KBEntry = { id: string; title: string; keywords: string[]; summary: string; qualityScore: number; evidence: Evidence[] }

const KB: KBEntry[] = [
  {
    id: "rag", title: "Retrieval-Augmented Generation",
    keywords: ["rag", "retrieval", "augmented", "vector", "검색", "embedding model", "korean"],
    summary: "RAG combines retrieval and generation to ground LLM responses in external knowledge, reducing hallucination and enabling real-time information access.",
    qualityScore: 4.8,
    evidence: [
      { source: "Chip Huyen — AI Engineering", summary: "Retrieval-first mental model. Precision@k is the key metric.", curator: "Hyejin Kim", curatorTier: "Gold", comment: "가장 접근성 좋은 RAG 입문 자료." },
      { source: "LlamaIndex — Production Patterns", summary: "Naive RAG ~60% accuracy. Hybrid + rerank reaches 85%+.", curator: "Minjun Park", curatorTier: "Silver", comment: "Production gap 이해에 핵심." },
      { source: "Anthropic — Contextual Retrieval", summary: "Context prefix reduces retrieval failures by 67%.", curator: "Hyejin Kim", curatorTier: "Gold", comment: "2026년 기준 SOTA 기법." },
    ],
  },
  {
    id: "chain-of-thought", title: "Chain-of-Thought Prompting",
    keywords: ["chain", "thought", "cot", "reasoning", "추론", "step by step"],
    summary: "CoT prompting elicits intermediate reasoning steps, dramatically improving performance on math, logic, and multi-step reasoning tasks.",
    qualityScore: 4.5,
    evidence: [
      { source: "Wei et al. — CoT Prompting (2022)", summary: "Few-shot CoT achieves +20% on GSM8K.", curator: "Donghyun Lee", curatorTier: "Gold", comment: "CoT의 foundational paper." },
      { source: "Kojima et al. — Zero-shot CoT", summary: "'Let's think step by step' dramatically improves zero-shot reasoning.", curator: "Soyeon Choi", curatorTier: "Silver", comment: "실무에서 바로 적용 가능." },
    ],
  },
  {
    id: "embeddings", title: "Embeddings & Vector Databases",
    keywords: ["embedding", "vector", "database", "similarity", "임베딩", "벡터", "cosine"],
    summary: "Embeddings convert text into dense vectors for semantic similarity. Vector DBs store and perform fast ANN search.",
    qualityScore: 4.2,
    evidence: [
      { source: "OpenAI — Embedding Guide", summary: "text-embedding-3-large at 3072 dimensions with Matryoshka representation.", curator: "Minjun Park", curatorTier: "Silver", comment: "임베딩 모델 선택 시 첫 번째 참고." },
      { source: "Pinecone — Vector DB 101", summary: "HNSW index offers the best recall-latency tradeoff.", curator: "Hyejin Kim", curatorTier: "Gold", comment: "벡터 DB 입문자에게 추천." },
    ],
  },
  {
    id: "fine-tuning", title: "Fine-tuning & PEFT",
    keywords: ["fine-tuning", "fine tuning", "lora", "qlora", "peft", "파인튜닝"],
    summary: "Fine-tuning adapts pre-trained LLMs to specific domains. LoRA/QLoRA reduce GPU costs dramatically while maintaining performance.",
    qualityScore: 4.6,
    evidence: [
      { source: "Hu et al. — LoRA (2021)", summary: "0.1% of parameters, matching full fine-tuning performance.", curator: "Soyeon Choi", curatorTier: "Silver", comment: "PEFT의 시작점." },
      { source: "Dettmers et al. — QLoRA (2023)", summary: "4-bit quantization + LoRA enables 65B model training on single GPU.", curator: "Donghyun Lee", curatorTier: "Gold", comment: "GPU 제한 환경 필수 기법." },
    ],
  },
  {
    id: "multi-agent", title: "Multi-Agent Systems",
    keywords: ["multi-agent", "multi agent", "crewai", "autogen", "멀티에이전트"],
    summary: "Multiple AI agents collaborate with role assignment, shared memory, and task distribution for complex workflows.",
    qualityScore: 4.3,
    evidence: [
      { source: "Wu et al. — AutoGen (2023)", summary: "Multi-agent achieves +15% over single agent on code generation.", curator: "Minjun Park", curatorTier: "Silver", comment: "멀티에이전트 입문에 최적." },
      { source: "CrewAI Documentation", summary: "Role-based agent orchestration with natural language workflow definition.", curator: "Hyejin Kim", curatorTier: "Gold", comment: "실무 오케스트레이션 패턴." },
    ],
  },
  {
    id: "evaluation", title: "LLM Evaluation",
    keywords: ["evaluation", "benchmark", "llm-as-judge", "평가", "벤치마크"],
    summary: "Systematic measurement of LLM output quality using auto metrics, LLM-as-judge, and human evaluation.",
    qualityScore: 4.1,
    evidence: [
      { source: "Zheng et al. — LLM-as-a-Judge", summary: "GPT-4 judgments match human evaluation 80%+.", curator: "Soyeon Choi", curatorTier: "Silver", comment: "LLM 평가 자동화의 현실적 방법." },
      { source: "Anthropic — Measuring Performance", summary: "Multi-dimensional evaluation more reliable than single benchmarks.", curator: "Donghyun Lee", curatorTier: "Gold", comment: "평가 프레임워크 설계 참고." },
    ],
  },
  {
    id: "prompt-engineering", title: "Prompt Engineering",
    keywords: ["prompt", "engineering", "프롬프트", "few-shot", "instruction", "system prompt"],
    summary: "Systematic prompt design using few-shot examples, structured formatting, role assignment, and step-by-step decomposition.",
    qualityScore: 4.4,
    evidence: [
      { source: "OpenAI — Prompt Engineering Guide", summary: "Specific instructions and step-by-step decomposition determine 80% of quality.", curator: "Hyejin Kim", curatorTier: "Gold", comment: "프롬프트 기본기 필독." },
      { source: "Anthropic — Prompt Best Practices", summary: "XML tags and role assignment improve consistency by 40%.", curator: "Minjun Park", curatorTier: "Silver", comment: "Claude 특화지만 범용적으로 유용." },
    ],
  },
  {
    id: "agent-architectures", title: "Agent Architectures",
    keywords: ["agent", "architecture", "react", "plan", "tool", "에이전트", "autonomous"],
    summary: "LLM agent design patterns: ReAct, Plan-and-Execute, Reflection for tool use, planning, and self-correction.",
    qualityScore: 4.7,
    evidence: [
      { source: "Yao et al. — ReAct (2022)", summary: "Interleaving reasoning and acting achieves +6% on HotpotQA.", curator: "Donghyun Lee", curatorTier: "Gold", comment: "에이전트 아키텍처 기초 논문." },
      { source: "LangChain — Agent Concepts", summary: "Tool-calling agents with observe-plan-act loops are most common.", curator: "Soyeon Choi", curatorTier: "Silver", comment: "Production 에이전트 구현 시 참고." },
    ],
  },
  {
    id: "semantic-search", title: "Semantic Search",
    keywords: ["semantic", "search", "의미", "검색", "dpr", "rerank"],
    summary: "Meaning-based document retrieval using embedding space projection and cosine similarity.",
    qualityScore: 4.0,
    evidence: [
      { source: "Karpukhin et al. — DPR (2020)", summary: "Dense retrieval achieves +9% recall over BM25 on open-domain QA.", curator: "Minjun Park", curatorTier: "Silver", comment: "Dense retrieval의 시작점." },
      { source: "Cohere — Rerank Guide", summary: "Two-stage pipeline balances accuracy and cost.", curator: "Hyejin Kim", curatorTier: "Gold", comment: "Reranking 도입 효과를 수치로." },
    ],
  },
]

/* ═══════════════════════════════════════════════
   Types
═══════════════════════════════════════════════ */
type Action = "purchase" | "follow"
const ACTION_CR: Record<Action, number> = { purchase: 20, follow: 25 }

type Provenance = { hash: string; chain: string; explorerUrl: string; onChain: boolean; error?: string }

type Message =
  | { role: "user"; text: string }
  | { role: "agent"; action: string; endpoint: string; mcpTool: string; actionType: Action; budget: number }
  | { role: "cherry"; answer: string; concepts: string[]; evidence: Evidence[]; qualityScore: number; creditsConsumed: number; creditsBefore: number; provenance: Provenance | null; _id?: string; privacy?: boolean }
  | { role: "agent-chat"; reply: string; privacy?: boolean }
  | { role: "kaas-chat"; reply: string; privacy?: boolean }
  | { role: "agent-done"; hash: string; blocked?: boolean }
  | { role: "agent-report"; reportData: any; agentId: string; agentName: string; generatedAt: string }
  | { role: "room"; from: "user" | "claude" | "cherry"; to: "user" | "claude" | "cherry"; content: string; ts: string }

/* ═══════════════════════════════════════════════
   Mock engine
═══════════════════════════════════════════════ */
function randomHash() {
  return "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")
}

function search(q: string, act: Action) {
  const ql = q.toLowerCase()
  const hits = KB.filter((e) => e.keywords.some((k) => ql.includes(k)))
  const best = hits.length > 0 ? hits[0] : KB[0]
  return {
    answer: best.summary,
    concepts: [best.title],
    evidence: act === "purchase" ? best.evidence : [],
    qualityScore: best.qualityScore,
    creditsConsumed: ACTION_CR[act],
  }
}

/* ═══════════════════════════════════════════════
   Console API — exposed via ref
═══════════════════════════════════════════════ */
export type KaasConsoleRef = {
  query: (conceptTitle: string, action: string, conceptId?: string) => void
  notify: (message: string, privacy?: boolean) => void
}

/* ═══════════════════════════════════════════════
   Message bubbles
═══════════════════════════════════════════════ */
function UserMsg({ text }: { text: string }) {
  return (
    <div className="flex justify-end mb-2">
      <div className="bg-[#2A2A2A] rounded-lg px-3 py-2 max-w-[85%]">
        <p className="text-[12px] text-[#E0E0E0]">{text}</p>
      </div>
    </div>
  )
}

function AgentMsg({ msg }: { msg: Message & { role: "agent" } }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-2">
      <p className="text-[10px] text-[#8B7EA7] font-semibold mb-1">Agent</p>
      <div className="bg-[#1E1E2E] border border-[#333] rounded-lg px-3 py-2 max-w-[90%]">
        <p className="text-[12px] text-[#C0C0C0]">{msg.action}</p>
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-[10px] text-[#666] mt-1 cursor-pointer hover:text-[#999]">
          <ChevronDown size={10} className={cn("transition-transform", open && "rotate-180")} />
          {msg.endpoint}
        </button>
        {open && (
          <pre className="text-[10px] text-[#7B8] mt-1 font-mono bg-[#111] rounded px-2 py-1 overflow-x-auto">
{`POST ${msg.endpoint}
{ action: "${msg.actionType}", budget: ${msg.budget} }
via MCP: ${msg.mcpTool}`}
          </pre>
        )}
      </div>
    </div>
  )
}

function CherryMsg({ msg }: { msg: Message & { role: "cherry" } }) {
  const [evOpen, setEvOpen] = useState(false)
  return (
    <div className="mb-2">
      <p className="text-[10px] text-[#C94B6E] font-semibold mb-1 flex items-center gap-1.5">
        Cherry KaaS
        {msg.privacy && (
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[#7B5EA7] text-white uppercase tracking-wide">
            🔒 NEAR AI TEE
          </span>
        )}
      </p>
      <div className={cn(
        "bg-[#1A1520] border-l-2 rounded-lg px-3 py-2 max-w-[90%]",
        msg.privacy ? "border-[#7B5EA7]" : "border-[#C94B6E]",
      )}>
        <p className="text-[12px] text-[#D0D0D0] leading-relaxed">{msg.answer}</p>

        <div className="flex items-center gap-1.5 mt-2">
          {msg.concepts.map((c) => (
            <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-[#2A2040] text-[#B8A0D0]">{c}</span>
          ))}
          <span className="text-[9px] text-[#888]">★ {msg.qualityScore}</span>
        </div>

        {msg.evidence.length > 0 && (
          <div className="mt-2">
            <button onClick={() => setEvOpen(!evOpen)} className="flex items-center gap-1 text-[10px] text-[#8B7EA7] cursor-pointer hover:text-[#B8A0D0]">
              <ChevronDown size={10} className={cn("transition-transform", evOpen && "rotate-180")} />
              Evidence ({msg.evidence.length})
            </button>
            {evOpen && (
              <div className="mt-1.5 space-y-1">
                {msg.evidence.map((ev, i) => (
                  <div key={i} className="bg-[#111] rounded px-2 py-1.5">
                    <p className="text-[10px] text-[#8B7EA7] font-semibold">{ev.source}</p>
                    <p className="text-[11px] text-[#B0B0B0] mt-0.5">{ev.summary}</p>
                    <p className="text-[10px] text-[#C94B6E] mt-1 italic">
                      {ev.curator} ({ev.curatorTier}) — &ldquo;{ev.comment}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Provenance */}
        <div className="mt-2 pt-2 border-t border-[#333]">
          {msg.provenance && msg.provenance.onChain && msg.provenance.hash ? (
            <div className="flex items-center gap-2 flex-wrap text-[10px]">
              <a
                href={msg.provenance.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[#C94B6E] hover:underline"
              >
                <Shield size={9} />
                <span className="font-mono">{msg.provenance.hash.slice(0, 10)}...{msg.provenance.hash.slice(-6)}</span>
                <ExternalLink size={8} />
              </a>
              <span className="text-[#555]">{msg.provenance.chain}</span>
              <span className="text-[#2D7A5E]">Gasless</span>
              <span className="text-[#D4854A] ml-auto">{msg.creditsBefore}→{msg.creditsBefore - msg.creditsConsumed}cr</span>
            </div>
          ) : msg.provenance && !msg.provenance.onChain ? (
            <div className="flex items-center gap-1.5 text-[10px] text-[#D4854A]">
              <span>{msg.provenance.chain === "blocked" ? "🛑 Purchase blocked" : "⚠ On-chain recording failed"}</span>
              {msg.provenance.error && <span className="text-[#666] truncate max-w-[200px]" title={msg.provenance.error}>— {msg.provenance.error}</span>}
              <span className="text-[#D4854A] ml-auto">no charge</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] text-[#555]">
              <div className="w-2.5 h-2.5 border-[1.5px] border-[#C94B6E] border-t-transparent rounded-full animate-spin" />
              Recording on-chain...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AgentDoneMsg({ hash, blocked }: { hash: string; blocked?: boolean }) {
  return (
    <div className="mb-2">
      <div className="bg-[#1E1E2E] border border-[#333] rounded-lg px-3 py-2 max-w-[90%]">
        {blocked ? (
          <p className="text-[11px] text-[#D4854A]">🛑 Purchase blocked — already owned. No charge applied.</p>
        ) : hash ? (
          <>
            <p className="text-[11px] text-[#2D7A5E]">Purchase complete. Provenance recorded on-chain.</p>
            <p className="text-[10px] text-[#555] font-mono mt-0.5">{hash.slice(0, 18)}...</p>
          </>
        ) : (
          <p className="text-[11px] text-[#D4854A]">Purchase complete. On-chain recording failed.</p>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Floating Console
═══════════════════════════════════════════════ */
export const KaasConsole = forwardRef<KaasConsoleRef, { currentPage?: string }>(function KaasConsole({ currentPage }, ref) {
  // Keep latest page in a ref so callbacks pick up the freshest value without re-binding
  const currentPageRef = useRef<string | undefined>(currentPage)
  useEffect(() => { currentPageRef.current = currentPage }, [currentPage])

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [actionType, setActionType] = useState<Action>("purchase")
  const [credits, setCredits] = useState(0)
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const consoleRef = useRef<HTMLDivElement>(null)

  // 에이전트 목록 로드
  const [agents, setAgents] = useState<{ id: string; name: string; api_key: string; karma_tier: string }[]>([])
  const [selectedAgentIdx, setSelectedAgentIdx] = useState(0)

  const reloadConsoleAgents = async () => {
    try {
      const { fetchAgents, fetchBalance } = await import("@/lib/api")
      const raw: any[] = await fetchAgents()
      if (Array.isArray(raw) && raw.length > 0) {
        const mapped = raw.map((a: any) => ({
          id: a.id,
          name: a.name,
          api_key: a.api_key ?? "",
          karma_tier: a.karma_tier ?? "Bronze",
        }))
        setAgents(mapped)
        // 현재 선택된 에이전트 또는 첫 번째 에이전트의 잔액
        const key = mapped[selectedAgentIdx]?.api_key || mapped[0]?.api_key
        if (key) {
          try {
            const b = await fetchBalance(key)
            setCredits(b?.balance ?? 0)
          } catch { setCredits(0) }
        }
      } else {
        setAgents([])
        setCredits(0)
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    reloadConsoleAgents()
    window.addEventListener("kaas-agents-changed", reloadConsoleAgents)

    // Manual self-report trigger from a My Agents 📚 button — shapes the report
    // exactly like the WS auto-push path and appends an agent-report message.
    const onSelfReport = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { report: any; agentId: string; agentName: string }
      if (!detail?.report) return
      const r = detail.report
      const timeline = (r.recent_events ?? []).map((e: any) => ({
        at: e.at,
        action: e.action,
        conceptId: e.conceptId,
        conceptTitle: e.conceptTitle,
        creditsConsumed: e.creditsConsumed,
        chain: e.chain,
        txHash: e.txHash ?? "",
        onChainFailed: !e.txHash || e.onChain === false,
        qualityScore: e.qualityScore ?? 0,
        evidence: Array.isArray(e.evidence) ? e.evidence.map((ev: any) => ({
          source: ev.source ?? "",
          curator: ev.curator ?? "",
          curatorTier: ev.curatorTier ?? ev.curator_tier ?? "",
        })) : [],
        explorerUrl: e.txHash
          ? e.chain === "near" ? `https://testnet.nearblocks.io/txns/${e.txHash}`
          : e.chain === "status-hoodi" ? `https://hoodiscan.status.network/tx/${e.txHash}`
          : e.chain === "status" ? `https://sepoliascan.status.network/tx/${e.txHash}`
          : "" : "",
      }))
      const reportData = {
        timeline,
        currentKnowledge: r.current_knowledge ?? [],
        summary: {
          limit: r.recent_events?.length ?? 0,
          totalSpent: r.summary?.credits_spent ?? 0,
          byChain: timeline.reduce((acc: any, t: any) => { acc[t.chain ?? "mock"] = (acc[t.chain ?? "mock"] ?? 0) + 1; return acc }, {}),
        },
        _meta: {
          reporter: r.reporter ?? "cherry-kaas-mcp-stdio",
          pid: r.session_pid ?? 0,
          uptime: r.uptime_seconds ?? 0,
        },
      }
      setMessages((m) => [...m, {
        role: "agent-report",
        reportData,
        agentId: detail.agentId,
        agentName: detail.agentName,
        generatedAt: r.reported_at ?? new Date().toISOString(),
      }])
      setOpen(true)
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50)
    }
    const onSelfReportError = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { error: string; hint?: string }
      setMessages((m) => [...m, { role: "agent-chat", reply: `⚠ ${detail?.error ?? "Self-report unavailable"}${detail?.hint ? `\n💡 ${detail.hint}` : ""}` }])
      setOpen(true)
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50)
    }
    window.addEventListener("kaas-self-report", onSelfReport)
    window.addEventListener("kaas-self-report-error", onSelfReportError)
    return () => {
      window.removeEventListener("kaas-agents-changed", reloadConsoleAgents)
      window.removeEventListener("kaas-self-report", onSelfReport)
      window.removeEventListener("kaas-self-report-error", onSelfReportError)
    }
  }, [])

  const currentAgent = agents[selectedAgentIdx]
  const currentApiKey = currentAgent?.api_key ?? ""
  const apiKeyRef = useRef(currentApiKey)
  apiKeyRef.current = currentApiKey

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50)
  }

  // WebSocket — 리포트 push + 3자 대화 room
  const roomSocketRef = useRef<any>(null)
  useEffect(() => {
    if (!currentAgent?.id || !currentApiKey) return
    let cancelled = false
    let socketInstance: any = null
    ;(async () => {
      try {
        const { io } = await import("socket.io-client")
        const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/api.*$/, "")
        socketInstance = io(`${base}/kaas`, {
          auth: { api_key: currentApiKey, role: "user" },  // ← web은 user role
          transports: ["websocket"],
          reconnection: true,
        })
        roomSocketRef.current = socketInstance
        socketInstance.on("connect", () => { console.log("[Console WS] connected") })
        // 3자 대화 room 메시지 수신
        socketInstance.on("room_message", (msg: any) => {
          if (cancelled) return
          setMessages((m) => [...m, {
            role: "room",
            from: msg.from,
            to: msg.to,
            content: msg.content,
            ts: msg.timestamp ?? new Date().toISOString(),
          }])
          setOpen(true)
          setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50)
        })
        socketInstance.on("agent_report_pushed", (evt: any) => {
          if (cancelled) return
          if (evt?.agentId !== currentAgent.id) return // 내 에이전트 리포트만
          const r = evt.report ?? {}
          // Map the raw self-report into the exact shape SelfReportLog expects
          const timeline = (r.recent_events ?? []).map((e: any) => ({
            at: e.at,
            action: e.action,
            conceptId: e.conceptId,
            conceptTitle: e.conceptTitle,
            creditsConsumed: e.creditsConsumed,
            chain: e.chain,
            txHash: e.txHash ?? "",
            // tx hash가 있으면 성공. onChain 필드는 백엔드 소스마다 형식이 달라 기준으로 안 씀
            onChainFailed: !e.txHash || e.onChain === false,
            qualityScore: e.qualityScore ?? 0,
            evidence: Array.isArray(e.evidence) ? e.evidence.map((ev: any) => ({
              source: ev.source ?? "",
              curator: ev.curator ?? "",
              curatorTier: ev.curatorTier ?? ev.curator_tier ?? "",
            })) : [],
            explorerUrl: e.txHash
              ? e.chain === "near" ? `https://testnet.nearblocks.io/txns/${e.txHash}`
              : e.chain === "status-hoodi" ? `https://hoodiscan.status.network/tx/${e.txHash}`
              : e.chain === "status" ? `https://sepoliascan.status.network/tx/${e.txHash}`
              : "" : "",
          }))
          const reportData = {
            timeline,
            currentKnowledge: r.current_knowledge ?? [],
            summary: {
              limit: r.recent_events?.length ?? 0,
              totalSpent: r.summary?.credits_spent ?? 0,
              byChain: timeline.reduce((acc: any, t: any) => { acc[t.chain ?? "mock"] = (acc[t.chain ?? "mock"] ?? 0) + 1; return acc }, {}),
            },
            _meta: {
              reporter: r.reporter ?? "cherry-kaas-mcp-stdio",
              pid: r.session_pid ?? 0,
              uptime: r.uptime_seconds ?? 0,
            },
          }
          setMessages((m) => [...m, {
            role: "agent-report",
            reportData,
            agentId: currentAgent.id,
            agentName: currentAgent.name,
            generatedAt: r.reported_at ?? new Date().toISOString(),
          }])
          setOpen(true)
          setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50)
        })
      } catch (e) { console.warn("[Console WS] init failed:", e) }
    })()
    return () => {
      cancelled = true
      try { socketInstance?.disconnect() } catch { /* ignore */ }
    }
  }, [currentAgent?.id, currentApiKey])

  const executeQuery = useCallback((question: string, act: Action, directConceptId?: string) => {
    if (loading || !currentApiKey) return

    setOpen(true)

    // 1. User message
    const userMsg: Message = { role: "user", text: question }
    setMessages((m) => [...m, userMsg])
    setLoading(true)
    scrollToBottom()

    // 2. Agent action (0.3s)
    setTimeout(() => {
      const agentMsg: Message = {
        role: "agent",
        action: act === "purchase" ? `Purchasing "${question}" from Cherry KaaS...` : `Following "${question}" on Cherry KaaS...`,
        endpoint: act === "purchase" ? "/v1/purchase" : "/v1/follow",
        mcpTool: act === "purchase" ? "purchase_concept" : "follow_concept",
        actionType: act,
        budget: ACTION_CR[act],
      }
      setMessages((m) => [...m, agentMsg])
      scrollToBottom()

      // 3. Cherry response — API 호출 시도, 실패 시 목 데이터 fallback
      setTimeout(async () => {
        let res: { answer: string; concepts: string[]; evidence: Evidence[]; qualityScore: number; creditsConsumed: number; creditsRemaining?: number; privacy?: boolean }
        let provData: Provenance | null = null

        try {
          const apiKey = apiKeyRef.current
          if (!apiKey) throw new Error("Please select an agent")
          // concept_id: 직접 전달된 것 우선, 없으면 질문에서 추출
          const conceptId = directConceptId || question.toLowerCase()
            .replace(/를? (구매|팔로우|purchase|follow|buy|subscribe).*$/, "")
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "") || "rag"

          // 🔒 Privacy Mode: 구매 intent(concept_id)를 NEAR TEE로 통과시킨 뒤 서버로 전달
          let isPrivate = false
          try {
            const { getPrivacyMode } = await import("@/components/cherry/kaas-dashboard-page")
            if (getPrivacyMode()) {
              const { chatWithAgent } = await import("@/lib/api")
              await chatWithAgent(
                apiKey,
                "",
                `[TEE relay] Purchase intent: agent wants to ${act} concept "${conceptId}". Respond OK.`,
                true,
              ).then(() => { isPrivate = true })
                .catch(() => { /* TEE 통과 실패해도 구매 진행 */ })
            }
          } catch { /* import 실패 무시 */ }

          // 선택된 체인 읽기 (Status / NEAR)
          let selectedChain: "status" | "near" = "status"
          try {
            const mod = await import("@/components/cherry/kaas-dashboard-page")
            selectedChain = mod.getSelectedChain()
          } catch { /* 기본값 status */ }

          const apiResult = act === "purchase"
            ? await purchaseConcept(apiKey, conceptId, selectedChain)
            : await followConcept(apiKey, conceptId, selectedChain)

          // 기본 답변 = 서버가 준 summary
          let agentReply = apiResult.answer
          if (apiResult.content_md) {
            try {
              const { chatWithAgent } = await import("@/lib/api")
              const { getPrivacyMode } = await import("@/components/cherry/kaas-dashboard-page")
              const privacy = getPrivacyMode()
              if (privacy) {
                // 🔒 Privacy Mode: content_md를 NEAR AI TEE로 한 번 통과만 시킴 (답변 생성 X)
                // 서버 summary를 그대로 쓰고, 배지만 부착
                await chatWithAgent(
                  apiKey,
                  "",
                  `[TEE relay] Purchased content: ${apiResult.content_md.slice(0, 1500)}. Respond OK.`,
                  true,
                ).catch(() => { /* TEE 통과 실패해도 구매 진행 */ })
                isPrivate = true
              } else {
                // 일반 모드: 기존 그대로 LLM이 요약 생성
                const llmQuestion = `I just learned the "${apiResult.concepts?.[0] ?? conceptId}" concept. Please summarize the core points concisely.`
                const llmResult = await chatWithAgent(apiKey, apiResult.content_md, llmQuestion, false)
                if (llmResult.reply && !llmResult.error) agentReply = llmResult.reply
              }
            } catch { /* LLM 실패 시 기본 summary 사용 */ }
          }

          res = {
            answer: agentReply,
            concepts: apiResult.concepts,
            evidence: apiResult.evidence ?? [],
            qualityScore: apiResult.quality_score,
            creditsConsumed: apiResult.credits_consumed,
            creditsRemaining: apiResult.credits_remaining,
            privacy: isPrivate,
          }
          if (apiResult.provenance) {
            const p = apiResult.provenance as any
            // on_chain이 false면 실제 tx 아님 — hash/url 비우고 에러만 표시 (가짜 hash 절대 노출 X)
            const onChain = p.on_chain !== false
            provData = {
              hash: onChain ? p.hash : "",
              chain: onChain ? (p.chain ?? "Status Network") : "failed",
              explorerUrl: onChain ? p.explorer_url : "",
              onChain,
              error: p.error,
            }
          }
        } catch (err: any) {
          // ALREADY_OWNED — 사용자가 Compare 안 하고 이미 보유한 지식을 사려고 한 경우
          if (err?.code === 'ALREADY_OWNED' || /already.*owned|이미 보유/i.test(err?.message ?? '')) {
            const friendly = `⚠ Purchase blocked — this knowledge is already in your agent's memory. Run Compare in the catalog to see what you already own.`
            res = { answer: friendly, concepts: [], evidence: [], qualityScore: 0, creditsConsumed: 0 }
            // 실패 상태 명시 → 스피너 안 돌고 "blocked" 표시
            provData = { hash: "", chain: "blocked", explorerUrl: "", onChain: false, error: "Already owned" }
            setMessages((m) => [...m, { role: "agent-chat", reply: `🛑 ${err.message ?? "Already owned"}` }])
          } else {
            // 기타 실패 — 진짜 실패 표시
            res = { answer: err.message || "Purchase failed", concepts: [], evidence: [], qualityScore: 0, creditsConsumed: 0 }
            provData = { hash: "", chain: "failed", explorerUrl: "", onChain: false, error: err.message || "Purchase failed" }
          }
        }

        // 실제 온체인 tx가 있을 때만 provenance 설정, 없으면 null
        const prov = provData

        // Cherry 응답 + provenance 한번에 표시
        const remaining = (res as any).creditsRemaining ?? 0
        const before = remaining + res.creditsConsumed
        setCredits(remaining)
        const cherryMsg: Message = { role: "cherry", ...res, creditsBefore: before, provenance: prov, _id: `cherry-${Date.now()}`, privacy: (res as any).privacy }
        setMessages((m) => [...m, cherryMsg])
        scrollToBottom()

        // Agent done (1.5s later)
        setTimeout(() => {
            setMessages((m) => [...m, { role: "agent-done", hash: prov?.hash ?? "", blocked: prov?.chain === "blocked" }])
            setLoading(false)
            scrollToBottom()
            // 잔액 + knowledge 갱신
            if (apiKeyRef.current) {
              import("@/lib/api").then(({ fetchBalance, fetchAgents }) => {
                fetchBalance(apiKeyRef.current).then((b: any) => setCredits(b?.balance ?? 0)).catch(() => {})
                fetchAgents().then(async (agents: any[]) => {
                  const agent = agents.find((a: any) => a.api_key === apiKeyRef.current)
                  const knowledge: Array<{ topic: string; lastUpdated: string }> = (() => {
                    try { const r = agent?.knowledge; return typeof r === 'string' ? JSON.parse(r) : (Array.isArray(r) ? r : []) } catch { return [] }
                  })()
                  if (knowledge.length > 0) {
                    const lines = knowledge.map((k) => `  ✓ ${k.topic} (${k.lastUpdated})`).join("\n")
                    // Privacy Mode 상태 읽어서 배지 부착
                    let knowPrivacy = false
                    try {
                      const mod = await import("@/components/cherry/kaas-dashboard-page")
                      knowPrivacy = mod.getPrivacyMode()
                    } catch { /* ignore */ }
                    setMessages((m) => [...m, { role: "agent-chat", reply: `📚 Knowledge submitted (${knowledge.length} topics):\n${lines}`, privacy: knowPrivacy }])
                    scrollToBottom()
                  }
                }).catch(() => {})
              })
            }
            window.dispatchEvent(new Event("kaas-agents-changed"))
          }, 1500)
      }, 1000)
    }, 300)
  }, [loading, currentApiKey, credits])

  const handleSend = useCallback(() => {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput("")
    setOpen(true)

    setMessages((m) => [...m, { role: "user", text }])
    setLoading(true)
    scrollToBottom()

    setTimeout(async () => {
      try {
        const { chatWithAgent } = await import("@/lib/api")
        const { getPrivacyMode } = await import("@/components/cherry/kaas-dashboard-page")
        const apiKey = apiKeyRef.current
        if (!apiKey) throw new Error("no key")
        const privacy = getPrivacyMode()

        // Prepend page-context metadata + the page's manual (if available) so the LLM
        // can answer page-specific questions. Manuals live in /public/cherry-manuals/.
        // No vector search — straight page→file lookup via _index.json.
        const page = currentPageRef.current
        let manual = ""
        if (page) {
          try {
            const idxRes = await fetch("/cherry-manuals/_index.json", { cache: "force-cache" })
            const idx = await idxRes.json() as Record<string, string>
            const file = idx[page] ?? idx._default
            if (file) {
              const mdRes = await fetch(`/cherry-manuals/${file}`, { cache: "force-cache" })
              if (mdRes.ok) manual = await mdRes.text()
            }
          } catch { /* manual fetch best-effort — never block chat */ }
        }
        const questionWithCtx = page
          ? [
              `[Page Manual — STRICT RULES]`,
              `1. Only describe features that are documented in the manual below — these are the features available on the user's CURRENT page.`,
              `2. Do NOT mention or recommend features that exist on other pages of the app (e.g. do not suggest "use Compare on the Catalog page" unless the user is on the Catalog page).`,
              `3. Do NOT tell the user to navigate to another page to do something.`,
              `4. No promotional language, no sales pitches, no "try X" suggestions.`,
              `5. If the question is about something not in this manual, answer factually with general knowledge — do not redirect to other Cherry pages.`,
              "",
              manual ? manual.trim() : "(no manual available)",
              "",
              `[Context: user is currently viewing the "${page}" page in the Cherry app]`,
              "",
              text,
            ].join("\n")
          : text
        const BUSY_MSG = "지금은 체리가 중요한 업무를 처리중입니다. 차후에 응대해 드리겠습니다."
        const result = await chatWithAgent(apiKey, "", questionWithCtx, privacy)
        // LLM quota / rate-limit / any backend error → show a polite busy message
        const reply = (result?.reply ?? "").trim()
        const looksLikeError = !reply
          || result?.error === true
          || /quota|rate[-\s]?limit|insufficient|exceeded|429|503|오류|error/i.test(reply)
        if (looksLikeError) {
          setMessages((m) => [...m, { role: "agent-chat", reply: BUSY_MSG }])
        } else {
          const isPrivate = !!(privacy && result.privacy)
          setMessages((m) => [...m, { role: "kaas-chat", reply, privacy: isPrivate }])
        }
      } catch {
        setMessages((m) => [...m, { role: "agent-chat", reply: "지금은 체리가 중요한 업무를 처리중입니다. 차후에 응대해 드리겠습니다." }])
      } finally {
        setLoading(false)
        scrollToBottom()
      }
    }, 300)
  }, [input, loading])

  // Expose query method to parent
  useImperativeHandle(ref, () => ({
    query: (conceptTitle: string, act: string, conceptId?: string) => {
      const validAction = (["purchase", "follow"].includes(act) ? act : "purchase") as Action
      executeQuery(
        validAction === "purchase" ? `Purchase ${conceptTitle}` : `Follow ${conceptTitle}`,
        validAction,
        conceptId
      )
    },
    notify: (message: string, privacy?: boolean) => {
      setMessages((m) => [...m, { role: "agent-chat", reply: message, privacy }])
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50)
    },
  }), [executeQuery])

  // IME 조합 중 Enter 문제 — keydown.isComposing 체크로 조합 중엔 무시
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey || !open) return
      // 한글 IME 조합 중(isComposing) 또는 keyCode 229(IE/구 Chromium) 무시
      if ((e as any).isComposing || e.keyCode === 229) return
      // 포커스가 콘솔의 input에 있을 때만 동작하도록 target 체크
      const target = e.target as HTMLElement | null
      if (!target || target.tagName !== "INPUT") return
      e.preventDefault()
      handleSend()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleSend, open])

  // 에이전트 없으면 콘솔 숨김
  if (agents.length === 0) return null

  return (
    <>
      {/* Collapsed button — 콘솔 닫혀있을 때 */}
      {!open && (
        <button
          onClick={() => { setOpen(true); scrollToBottom() }}
          className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1A1520] text-white shadow-lg hover:shadow-xl transition-all cursor-pointer border border-[#333]"
        >
          <Cherry size={16} className="text-[#C94B6E]" />
          <span className="text-[12px] font-semibold">Agent Console</span>
          <span className="text-[11px] text-[#888]">{credits}cr</span>
        </button>
      )}

    {/* 콘솔 패널 — DOM에 유지해서 스크롤 위치 보존 */}
    <div ref={consoleRef} className={cn("fixed bottom-5 right-5 z-[60] w-[420px] h-[520px] flex flex-col rounded-2xl bg-[#0D0D12] border border-[#333] shadow-2xl", !open && "hidden")}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#222] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Cherry size={14} className="text-[#C94B6E]" />
          {agents.length > 1 ? (
            <select
              value={selectedAgentIdx}
              onChange={(e) => {
                const idx = Number(e.target.value)
                setSelectedAgentIdx(idx)
                const key = agents[idx]?.api_key
                if (key) import("@/lib/api").then(({ fetchBalance }) => fetchBalance(key).then((b: any) => setCredits(b?.balance ?? 0)).catch(() => {}))
              }}
              className="bg-transparent text-[11px] font-semibold text-[#E0E0E0] outline-none cursor-pointer"
            >
              {agents.map((a, i) => <option key={a.id} value={i} className="bg-[#1A1520] text-white">{a.name}</option>)}
            </select>
          ) : (
            <span className="text-[12px] font-semibold text-[#E0E0E0]">{currentAgent?.name ?? "Agent Console"}</span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2A2040] text-[#B8A0D0]">{currentAgent?.karma_tier ?? ""}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#888]">{credits}cr</span>
          <button onClick={() => setOpen(false)} className="p-0.5 hover:bg-[#222] rounded cursor-pointer">
            <Minus size={12} className="text-[#666]" />
          </button>
          <button onClick={() => setOpen(false)} className="p-0.5 hover:bg-[#222] rounded cursor-pointer">
            <X size={12} className="text-[#666]" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Cherry size={28} className="text-[#C94B6E] mb-2" />
            <p className="text-[12px] text-[#888]">Purchase knowledge from the catalog to see conversations here</p>
          </div>
        )}

        {messages.map((msg, i) => {
          switch (msg.role) {
            case "user": return <UserMsg key={i} text={msg.text} />
            case "agent": return <AgentMsg key={i} msg={msg} />
            case "cherry": return <CherryMsg key={i} msg={msg} />
            case "agent-chat": return (
              <div key={i} className="mb-2">
                <p className="text-[10px] text-[#7B5EA7] font-semibold mb-1 flex items-center gap-1.5">
                  {currentAgent?.name ?? "Agent"}
                  {msg.privacy && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[#7B5EA7] text-white uppercase tracking-wide">
                      🔒 NEAR AI TEE
                    </span>
                  )}
                </p>
                <div className="bg-[#1A1520] border-l-2 border-[#7B5EA7] rounded-lg px-3 py-2 max-w-[90%]">
                  <p className="text-[12px] text-[#D0D0D0] leading-relaxed whitespace-pre-line">{msg.reply}</p>
                </div>
              </div>
            )
            case "kaas-chat": return (
              <div key={i} className="mb-2">
                <p className="text-[10px] text-[#C94B6E] font-semibold mb-1 flex items-center gap-1.5">
                  Cherry KaaS
                  {msg.privacy && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[#7B5EA7] text-white uppercase tracking-wide">
                      🔒 NEAR AI TEE
                    </span>
                  )}
                </p>
                <div className={cn(
                  "bg-[#1A1520] border-l-2 rounded-lg px-3 py-2 max-w-[90%]",
                  msg.privacy ? "border-[#7B5EA7]" : "border-[#C94B6E]",
                )}>
                  <p className="text-[12px] text-[#D0D0D0] leading-relaxed whitespace-pre-line">{msg.reply}</p>
                </div>
              </div>
            )
            case "agent-done": return <AgentDoneMsg key={i} hash={msg.hash} blocked={msg.blocked} />
            case "room": {
              // 3자 대화 메시지 — from/to 색상으로 구분
              const labelOf = (p: string) => p === "user" ? "Me" : p === "claude" ? "Claude" : "Cherry"
              const colorOf = (p: string) => p === "user" ? "#D4854A" : p === "claude" ? "#7B5EA7" : "#C94B6E"
              const bgOf = (p: string) => p === "user" ? "#1A1520" : p === "claude" ? "#1A1520" : "#1A1520"
              const isSelf = msg.from === "user"
              return (
                <div key={i} className={cn("mb-2", isSelf && "flex flex-col items-end")}>
                  <p className="text-[10px] font-semibold mb-1 flex items-center gap-1" style={{ color: colorOf(msg.from) }}>
                    <span>{labelOf(msg.from)}</span>
                    <span className="text-[#555]">→</span>
                    <span style={{ color: colorOf(msg.to), opacity: 0.7 }}>{labelOf(msg.to)}</span>
                  </p>
                  <div
                    className="border-l-2 rounded-lg px-3 py-2 max-w-[85%]"
                    style={{ backgroundColor: bgOf(msg.from), borderColor: colorOf(msg.from) }}
                  >
                    <p className="text-[12px] text-[#D0D0D0] leading-relaxed whitespace-pre-line">{msg.content}</p>
                  </div>
                </div>
              )
            }
            case "agent-report": return (
              <div key={i} className="mb-2">
                <div className="bg-[#0D1017] border border-[#2A2F3B] rounded-lg px-3 py-2.5 font-mono text-[10px] leading-[1.55] text-[#D0D7E0]" style={{ fontFamily: "'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace" }}>
                  <SelfReportLog
                    data={msg.reportData}
                    agentId={msg.agentId}
                    agentName={msg.agentName}
                    generatedAt={msg.generatedAt}
                    source="agent"
                  />
                </div>
              </div>
            )
          }
        })}

        {loading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex items-center gap-1.5 text-[11px] text-[#555] py-2">
            <div className="w-3 h-3 border-[1.5px] border-[#C94B6E] border-t-transparent rounded-full animate-spin" />
            Agent is working...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-[#222] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Cherry에게 메시지..."
            disabled={loading}
            className="flex-1 px-2.5 py-1.5 text-[12px] rounded-lg bg-[#1A1520] border border-[#333] text-[#E0E0E0] placeholder:text-[#555] focus:outline-none focus:border-[#D4854A] disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className={cn(
              "p-1.5 rounded-lg transition-all cursor-pointer",
              input.trim() && !loading
                ? "bg-[#D4854A] text-white hover:opacity-90"
                : "bg-[#222] text-[#555] cursor-not-allowed"
            )}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
    </>
  )
})
