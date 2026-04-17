"use client"

import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react"
import { cn } from "@/lib/utils"
import { Send, ExternalLink, ChevronDown, Shield, Bot, Cherry, Minus, X, Trash2 } from "lucide-react"
import { purchaseConcept, followConcept, chatWithAgent } from "@/lib/api"
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
  | { role: "cherry"; answer: string; concepts: string[]; evidence: Evidence[]; qualityScore: number; creditsConsumed: number; creditsBefore: number; provenance: Provenance | null; teeProvenance?: Provenance | null; _id?: string; privacy?: boolean }
  | { role: "agent-chat"; reply: string; privacy?: boolean; provenance?: Provenance | null }
  | { role: "kaas-chat"; reply: string; privacy?: boolean; provenance?: Provenance | null }
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
  notify: (message: string, privacy?: boolean, provenance?: Provenance | null) => void
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
        {msg.privacy && msg.teeProvenance?.onChain && msg.teeProvenance.hash ? (
          <a href={msg.teeProvenance.explorerUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-[#7B5EA7] hover:underline">
            <Shield size={9} />
            <span className="font-mono">{msg.teeProvenance.hash.slice(0, 10)}...{msg.teeProvenance.hash.slice(-6)}</span>
            <ExternalLink size={8} />
          </a>
        ) : msg.privacy && msg.teeProvenance === undefined ? (
          <span className="inline-block w-3 h-3 border-[1.5px] border-[#7B5EA7] border-t-transparent rounded-full animate-spin" />
        ) : null}
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
   Example Q&A — LLM 안 쓰고 바로 답변. 토큰 절약.
   이후 추가 질문엔 이 Q&A도 대화 히스토리로 전달돼 맥락 유지됨.
═══════════════════════════════════════════════ */
const EXAMPLE_ANSWERS: Record<string, string> = {
  "How do I train my agent?":
    "Open the Knowledge Market (sidebar → AGENT SHOP), pick a concept, and Purchase. " +
    "The concept's content is delivered to your agent automatically — no manual training step. " +
    "Use the Dashboard's 📚 Diff to see gaps and decide what to buy next.",
  "How do I sell knowledge?":
    "Open Dashboard → Knowledge Curation. Author a concept (id, title, summary, content_md) and add " +
    "Evidence sources. Every purchase of your concept sends 40% to your wallet. Withdraw from the " +
    "Rewards tab — it settles on-chain in one transaction.",
  "How much discount does Karma tier give?":
    "Higher on-chain Karma tier = bigger discount on every purchase. Bronze (default) 0%, Silver 5%, " +
    "Gold 15%, Platinum 30%. A 20cr concept costs just 14cr for Platinum. Discounts stack with SALE " +
    "promos — Gold + SALE = 32% off.",
  "Where can I see on-chain transactions?":
    "On the Dashboard: Wallet Panel → Ledger tab (deposits & consumes), Rewards tab (withdrawals), " +
    "and the 📚 Diff report Timeline. Each Cherry Console message also has a tx hash link inline. " +
    "Direct explorer: sepoliascan.status.network for Status, testnet.nearblocks.io for NEAR.",
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
  // 최신 messages를 closure 밖에서 참조 (LLM 호출 시 대화 히스토리 전달용)
  const messagesRef = useRef<Message[]>([])
  useEffect(() => { messagesRef.current = messages }, [messages])
  const [input, setInput] = useState("")
  const [actionType, setActionType] = useState<Action>("purchase")
  const [credits, setCredits] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const consoleRef = useRef<HTMLDivElement>(null)

  // 체리 말풍선 문장 풀 — 3종류
  //  1. CASUAL: 단독으로 뜨는 추임새 (후속 없음, 랜덤으로 나옴)
  //  2. TRIGGER: 다음 이벤트로 INFO를 부르는 신호 ("Listen", "Watch this" 등)
  //  3. INFO: TRIGGER 뒤에만 나타남. 랜덤 단독으로는 절대 안 나옴
  //  + Tease 싸이클은 따로 "..." 점만 찍힘 (트리거 없음)
  const CASUAL_PHRASES = [
    // 인사 / 추임새
    "Hey",
    "Hey 👋",
    "Hi there",
    "Miss me? 🍒",
    "Interesting...",
    "Hmm...",
    "Oh?",
    "Yo",
    "Pssst 🤫",
    "Bored?",
    "Eh?",
    "Still here",
    "Not bad, right?",
    "Sooo...",
    "Wanna chat?",
    "👀",
    "Nice.",
    "Okay okay",
    // 농담 (3개) — 가끔 튀어나오면 귀여움
    "Actually, I'm a strawberry 🍓",
    "Actually, forget it",
    "Actually, I've got a cold",  // ← 이게 뜨면 콘솔이 부르르 떨림
  ]
  // 이 문장이 나올 때 콘솔을 shake 애니메이션으로 흔듦
  const SHAKE_PHRASE = "Actually, I've got a cold"
  const TRIGGER_PHRASES = [
    "Listen 👂",
    "Between us",
    "Watch this 👀",
    "One sec",
    "Hot tip 🔥",
    "Heads up",
    "FYI",
    "Quick one",
  ]
  const INFO_PHRASES = [
    "How do agents buy knowledge?",
    "How much can curators earn?",
    "Want to see what your agent learned?",
    "Karma tier = real discount ⚡",
    "Check the on-chain ledger",
  ]
  // 표시는 현재 typedText 로만 — bubbleIdx 는 legacy 참조용으로 남겨둠
  const [bubbleIdx, setBubbleIdx] = useState(0)
  const [bubbleVisible, setBubbleVisible] = useState(false)
  const [typedText, setTypedText] = useState("")
  // Cherry Console 버튼 / 패널 shake — "I've got a cold" 농담 나올 때 부르르
  const [consoleShake, setConsoleShake] = useState(false)
  const lastShakeRef = useRef(0)
  // 대화 삭제 확인 팝오버
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // CLI-style input history (bash readline 스타일: ↑ 과거, ↓ 최근/draft, 중복 생략)
  const HISTORY_KEY = "kaas_console_history"
  const HISTORY_MAX = 100
  const [history, setHistory] = useState<string[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })
  // historyIdx === history.length → 편집 중 (draftRef 사용)
  // historyIdx < history.length → 과거 항목 표시
  const [historyIdx, setHistoryIdx] = useState<number>(history.length)
  const draftRef = useRef<string>("")
  useEffect(() => { setHistoryIdx(history.length) }, [history.length])
  const pushHistory = useCallback((text: string) => {
    setHistory((prev) => {
      const trimmed = text.trim()
      if (!trimmed) return prev
      // 직전 항목과 중복이면 생략 (bash ignoredups)
      if (prev[prev.length - 1] === trimmed) return prev
      const next = [...prev, trimmed].slice(-HISTORY_MAX)
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  // 에이전트 목록 로드
  const [agents, setAgents] = useState<{ id: string; name: string; api_key: string; karma_tier: string; wallet_type: "evm" | "near"; wallet_address: string }[]>([])
  const [selectedAgentIdx, setSelectedAgentIdx] = useState(0)


  const reloadConsoleAgents = async () => {
    try {
      const { fetchAgents, fetchBalance } = await import("@/lib/api")
      const raw: any[] = await fetchAgents()
      if (Array.isArray(raw) && raw.length > 0) {
        const mapped = raw.map((a: any) => {
          const walletAddr: string = a.wallet_address ?? a.walletAddress ?? ""
          // wallet_type 없으면 주소 prefix로 추정 (0x → evm, 그 외 비어있지 않으면 near)
          const walletType: "evm" | "near" =
            a.wallet_type ?? a.walletType ??
            (walletAddr.startsWith("0x") ? "evm" : (walletAddr ? "near" : "evm"))
          return {
            id: a.id,
            name: a.name,
            api_key: a.api_key ?? "",
            karma_tier: a.karma_tier ?? "Bronze",
            wallet_type: walletType,
            wallet_address: walletAddr,
          }
        })
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

  // 말풍선 싸이클 — "..." 과 문장은 절대 같은 등장에 나오지 않음. 완전히 분리된 이벤트.
  //   Tease 싸이클: 점 찍히다가 그냥 사라짐 (Cherry가 말 꺼낼 듯 말다)
  //   Message 싸이클: 문장만 등장 (점 없이)
  //   둘은 번갈아가며 랜덤 섞여서 나옴
  useEffect(() => {
    if (open) {
      setBubbleVisible(false)
      setTypedText("")
      return
    }
    // 이벤트 종류:
    //   1. DOTS  — "..." 만. 후속 없음. (tease)
    //   2. CASUAL — 단문 한 개. 후속 없음.
    //   3. TRIGGER→INFO — 트리거 → 잠깐 쉼 → INFO 문장. 이 둘은 의도적으로 연결됨.
    // 이벤트 간 10초 간격. 이벤트 안에서는 자유.
    const FIRST_DELAY     = 20_000
    const DOT_MS          = 250       // "." 하나당 등장 간격
    const DOTS_HOLD_MS    = 800       // "..." 찍힌 뒤 유지
    const TRIGGER_HOLD_MS = 2_200     // 트리거 문구 유지
    const TRIGGER_GAP_MS  = 1_800     // 트리거 → info 사이 간격 (한 이벤트 내부)
    const MSG_MAX_MS      = 5_000     // 문장 최대 유지
    const MSG_MIN_MS      = 3_000     // 문장 최소 유지
    const GAP_MS          = 60_000    // 이벤트 종료 후 다음 이벤트까지 (1분)

    // 이벤트 타입 확률
    const P_DOTS    = 0.30
    const P_CASUAL  = 0.50
    // P_TRIGGER   = 0.20 (나머지)

    let t1: any, t2: any, t3: any, t4: any
    const clearAll = () => [t1, t2, t3, t4].forEach(clearTimeout)

    // 카테고리별 직전 인덱스 — 연속 중복 방지
    let lastCasualIdx = -1
    let lastTriggerIdx = -1
    let lastInfoIdx = -1
    /** 직전 인덱스와 다른 걸 O(1)로 뽑기. */
    const pickDifferent = <T,>(arr: T[], lastIdx: number): [T, number] => {
      if (arr.length <= 1) return [arr[0], 0]
      const offset = 1 + Math.floor(Math.random() * (arr.length - 1))
      const idx = ((lastIdx < 0 ? 0 : lastIdx) + offset) % arr.length
      return [arr[idx], idx]
    }
    const holdFor = (text: string) =>
      Math.min(MSG_MAX_MS, Math.max(MSG_MIN_MS, text.length * 180))

    const runDots = () => {
      setTypedText("")
      setBubbleVisible(true)
      let dotCount = 0
      const typeDot = () => {
        dotCount += 1
        setTypedText(".".repeat(dotCount))
        if (dotCount < 3) {
          t1 = setTimeout(typeDot, DOT_MS)
        } else {
          t2 = setTimeout(() => {
            setBubbleVisible(false)
            setTypedText("")
            t3 = setTimeout(startCycle, GAP_MS)
          }, DOTS_HOLD_MS)
        }
      }
      t1 = setTimeout(typeDot, DOT_MS)
    }

    const runCasual = () => {
      const [text, idx] = pickDifferent(CASUAL_PHRASES, lastCasualIdx)
      lastCasualIdx = idx
      setTypedText(text)
      setBubbleVisible(true)
      // 감기 농담 → 콘솔 부르르 떨림. 한 번 떨고 나면 60초 cooldown
      if (text === SHAKE_PHRASE) {
        const now = Date.now()
        if (now - lastShakeRef.current >= 60000) {
          lastShakeRef.current = now
          setConsoleShake(false)
          requestAnimationFrame(() => setConsoleShake(true))
          setTimeout(() => setConsoleShake(false), 750)
        }
      }
      t1 = setTimeout(() => {
        setBubbleVisible(false)
        setTypedText("")
        t2 = setTimeout(startCycle, GAP_MS)
      }, holdFor(text))
    }

    const runTriggerInfo = () => {
      const [trigger, tIdx] = pickDifferent(TRIGGER_PHRASES, lastTriggerIdx)
      const [info, iIdx] = pickDifferent(INFO_PHRASES, lastInfoIdx)
      lastTriggerIdx = tIdx
      lastInfoIdx = iIdx
      // 1. 트리거 등장
      setTypedText(trigger)
      setBubbleVisible(true)
      t1 = setTimeout(() => {
        // 2. 말풍선 한 번 사라짐
        setBubbleVisible(false)
        setTypedText("")
        // 3. 짧은 쉼 뒤 info 등장
        t2 = setTimeout(() => {
          setTypedText(info)
          setBubbleVisible(true)
          // 4. info 유지 뒤 사라짐 → 다음 이벤트까지 GAP
          t3 = setTimeout(() => {
            setBubbleVisible(false)
            setTypedText("")
            t4 = setTimeout(startCycle, GAP_MS)
          }, holdFor(info))
        }, TRIGGER_GAP_MS)
      }, TRIGGER_HOLD_MS)
    }

    const startCycle = () => {
      const r = Math.random()
      if (r < P_DOTS) runDots()
      else if (r < P_DOTS + P_CASUAL) runCasual()
      else runTriggerInfo()
    }

    t1 = setTimeout(startCycle, FIRST_DELAY)
    return clearAll
  }, [open])

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
        const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
        socketInstance = io(`${base}/kaas`, {
          auth: { api_key: currentApiKey, role: "user" },  // ← web은 user role
          transports: ["polling", "websocket"],  // polling 먼저 → WebSocket 불가 시 fallback
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

        // 단계별 진행 메시지 (3초 간격)
        const phases = [
          "Connecting to Cherry KaaS…",
          "Verifying agent credentials…",
          "Processing on-chain transaction…",
          "Finalizing purchase…",
        ]
        let phaseIdx = 0
        setLoadingPhase(phases[0])
        const phaseTimer = setInterval(() => {
          phaseIdx++
          if (phaseIdx < phases.length) setLoadingPhase(phases[phaseIdx])
        }, 3000)

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

          // 선택된 체인 읽기 (Status / NEAR)
          let selectedChain: "status" | "near" = "status"
          try {
            const mod = await import("@/components/cherry/kaas-dashboard-page")
            selectedChain = mod.getSelectedChain()
          } catch { /* 기본값 status */ }

          // NEAR + NEAR 지갑 에이전트 → 사용자 지갑이 직접 서명 (provenance self-transfer 1 yoctoNEAR)
          const currentAgent = agents[selectedAgentIdx]
          const agentWalletType = currentAgent?.wallet_type ?? "evm"
          let preSignedTx: string | undefined
          if (selectedChain === "near" && agentWalletType === "near") {
            // NEAR 경로는 유저 서명이 필수 — 실패하면 서버 서명 폴백 금지 (double-sign 방지)
            const { signAndSendNearProvenance } = await import("@/lib/near-connector")
            const { txHash } = await signAndSendNearProvenance(`${act}:${conceptId}`)
            if (!txHash) {
              throw new Error("NEAR wallet signature required but hash not found")
            }
            preSignedTx = txHash
          }

          const apiResult = act === "purchase"
            ? await purchaseConcept(apiKey, conceptId, selectedChain, preSignedTx ? { preSignedTx } : undefined)
            : await followConcept(apiKey, conceptId, selectedChain, preSignedTx ? { preSignedTx } : undefined)

          clearInterval(phaseTimer)

          // 기본 답변 = 서버가 준 summary
          let agentReply = apiResult.answer
          if (apiResult.content_md) {
            try {
              const { chatWithAgent } = await import("@/lib/api")
              const { getPrivacyMode } = await import("@/components/cherry/kaas-dashboard-page")
              const privacy = getPrivacyMode()
              if (!privacy) {
                // 일반 모드: LLM이 요약 생성
                const llmQuestion = `I just learned the "${apiResult.concepts?.[0] ?? conceptId}" concept. Please summarize the core points concisely.`
                const llmResult = await chatWithAgent(apiKey, apiResult.content_md, llmQuestion, false)
                if (llmResult.reply && !llmResult.error) agentReply = llmResult.reply
              }
            } catch { /* LLM 실패 시 기본 summary 사용 */ }
          }

          // privacy 플래그는 TEE 백그라운드 완료 후 업데이트됨
          let privacyMode = false
          try {
            const { getPrivacyMode } = await import("@/components/cherry/kaas-dashboard-page")
            privacyMode = getPrivacyMode()
          } catch {}
          res = {
            answer: agentReply,
            concepts: apiResult.concepts,
            evidence: apiResult.evidence ?? [],
            qualityScore: apiResult.quality_score,
            creditsConsumed: apiResult.credits_consumed,
            creditsRemaining: apiResult.credits_remaining,
            privacy: privacyMode,
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
          clearInterval(phaseTimer)
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

        // Privacy Mode 체크 — 구매 성공(실제 온체인 tx 발생)한 경우에만 TEE 활성화
        let _privacyOn = false
        try { const m = await import("@/components/cherry/kaas-dashboard-page"); _privacyOn = m.getPrivacyMode() } catch {}
        const purchaseSucceeded = !!(prov && prov.onChain)
        const teeActive = _privacyOn && purchaseSucceeded

        // Cherry 응답 즉시 표시
        const remaining = (res as any).creditsRemaining ?? 0
        const before = remaining + res.creditsConsumed
        setCredits(remaining)
        const msgId = `cherry-${Date.now()}`
        const cherryMsg: Message = { role: "cherry", ...res, creditsBefore: before, provenance: prov, _id: msgId, privacy: teeActive }
        setMessages((m) => [...m, cherryMsg])
        scrollToBottom()

        // 🔒 Privacy Mode: TEE relay를 백그라운드 실행 → 완료 시 스피너 → tx 링크로 변환
        if (teeActive) {
          chatWithAgent(apiKeyRef.current, "", `[TEE relay] Purchased content. Respond OK.`, true)
            .then((teeResult: any) => {
              const teeProv = teeResult?.provenance ? {
                hash: teeResult.provenance.hash, chain: teeResult.provenance.chain,
                explorerUrl: teeResult.provenance.explorer_url, onChain: teeResult.provenance.on_chain,
              } as Provenance : null
              setMessages((m) => m.map((msg) =>
                (msg as any)._id === msgId ? { ...msg, privacy: true, teeProvenance: teeProv } : msg
              ))
            })
            .catch(() => {
              // TEE 실패 — 뱃지 유지, 스피너 멈춤 (onChain: false로 링크 대신 빈 상태)
              setMessages((m) => m.map((msg) =>
                (msg as any)._id === msgId ? { ...msg, privacy: true, teeProvenance: { hash: "", chain: "failed", explorerUrl: "", onChain: false } } : msg
              ))
            })
        }

        // Agent done (1.5s later)
        setTimeout(() => {
            setMessages((m) => [...m, { role: "agent-done", hash: prov?.hash ?? "", blocked: prov?.chain === "blocked" }])
            setLoading(false); setLoadingPhase("")
            scrollToBottom()
            // 잔액 + knowledge 갱신
            if (apiKeyRef.current) {
              import("@/lib/api").then(({ fetchBalance, fetchAgents }) => {
                fetchBalance(apiKeyRef.current).then((b: any) => setCredits(b?.balance ?? 0)).catch(() => {})
                fetchAgents().catch(() => {})
              })
            }
            window.dispatchEvent(new Event("kaas-agents-changed"))
          }, 1500)
      }, 1000)
    }, 300)
  }, [loading, currentApiKey, credits])

  // 실제 전송 로직 — 어디서 호출되든 동일. handleSend / 예시 질문 클릭 모두 이걸 사용.
  const sendText = useCallback((rawText: string) => {
    if (!rawText.trim() || loading) return
    const text = rawText.trim()
    pushHistory(text)
    draftRef.current = ""
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

        // 매뉴얼 로딩:
        //   (1) 현재 페이지 매뉴얼을 항상 기본으로 포함
        //   (2) 질문 키워드가 market/curation/agent/prompt 관련이면 그 매뉴얼도 추가 로드
        //   → 다른 페이지 기능에 대한 질문도 맥락 안에서 답변 가능
        const page = currentPageRef.current
        const manualsByFile = new Map<string, string>()
        try {
          const idxRes = await fetch("/cherry-manuals/_index.json", { cache: "force-cache" })
          const idx = await idxRes.json() as Record<string, string>
          const loadFile = async (f: string) => {
            if (manualsByFile.has(f)) return
            try {
              const res = await fetch(`/cherry-manuals/${f}`, { cache: "force-cache" })
              if (res.ok) manualsByFile.set(f, await res.text())
            } catch {}
          }
          // (1) 현재 페이지
          const pageFile = (page && idx[page]) || idx._default
          if (pageFile) await loadFile(pageFile)
          // (2) 주제 키워드 매칭 — 다른 페이지 매뉴얼도 상황에 따라 추가
          // 토픽 매칭은 중복 OK — 하나의 질문이 여러 매뉴얼을 끌어올 수 있음
          const TOPIC_MAP: Array<[RegExp, string]> = [
            // 마켓/구매/가격/할인/Karma 티어 가격 효과 → 가격 테이블이 있는 catalog 매뉴얼
            [/market|catalog|buy|purchase|sell|concept|sale|price|pricing|cost|discount|cheaper|마켓|구매|판매|카탈로그|가격|할인|싸|비싸/i, "kaas-catalog.md"],
            // 큐레이션/수익
            [/curator|curation|author|revenue|earn|reward|withdraw|큐레이터|큐레이션|수익|저자|보상|인출/i, "kaas-knowledge-curation.md"],
            // 에이전트/MCP/지갑/Karma 티어/온체인 tx 조회
            [/agent|train|register|MCP|wallet|dashboard|karma|tier|deposit|ledger|transaction|tx|explorer|on[-\s]?chain|blockscout|on[-\s]?chain\s*record|receipt|에이전트|학습|훈련|등록|지갑|대시보드|카르마|충전|티어|트랜잭션|원장|온체인|거래\s*내역/i, "kaas-dashboard.md"],
            // Karma 언급은 catalog(가격 영향) + dashboard(Karma 설명) 양쪽 다 로드
            [/karma|카르마/i, "kaas-catalog.md"],
            [/prompt|template|프롬프트|템플릿/i, "kaas-prompt-templates.md"],
          ]
          for (const [pattern, mdFile] of TOPIC_MAP) {
            if (pattern.test(text)) await loadFile(mdFile)
          }
        } catch { /* manual fetch best-effort — never block chat */ }

        const manualBlocks = Array.from(manualsByFile.entries()).map(
          ([file, content]) => `### Manual: ${file}\n\n${content.trim()}`
        ).join("\n\n---\n\n")
        // 최근 대화 히스토리 (하드코딩 예시 Q&A 포함) — 맥락 유지용. 최대 6개 메시지.
        const HISTORY_LIMIT = 6
        const historyMsgs = messagesRef.current.slice(-HISTORY_LIMIT - 1, -1) // 방금 추가된 현재 user 메시지 제외
        const historyBlock = historyMsgs
          .map((m) => {
            if (m.role === "user") return `User: ${(m as any).text}`
            if (m.role === "kaas-chat") return `Cherry: ${(m as any).reply}`
            if (m.role === "agent-chat") return `Agent: ${(m as any).reply}`
            return ""
          })
          .filter(Boolean)
          .join("\n")

        const questionWithCtx = manualBlocks
          ? [
              `[Cherry Help — RULES]`,
              `1. Answer based on the manuals below. They describe the features of this app.`,
              `2. The user is currently on the "${page ?? "overview"}" page, but they can ask about any feature — if another manual is included below, it's relevant to their question.`,
              `3. If the feature lives on another page, tell them which page/tab to go to (e.g., "open the Dashboard → Knowledge Curation tab"). This is helpful, not promotional.`,
              `4. No sales language — state facts, not pitches. Do not say "try it now" or "it's amazing".`,
              `5. Keep answers short and concrete. Prefer steps over paragraphs when possible.`,
              `6. Domain-specific meaning:`,
              `   - "Train / teach / learn" an agent = buying knowledge concepts from the Knowledge Market. Purchase auto-delivers content_md to the agent. Self-report / Diff is NOT training — it is diagnostic (shows gaps).`,
              `   - "Sell knowledge / monetize" = becoming a curator via Dashboard → Knowledge Curation. Earn 40% of each purchase.`,
              `   - "Karma tier / discount": higher on-chain Karma tier on Status Network → bigger discount on every Market purchase. Bronze 0% / Silver 5% / Gold 15% / Platinum 30%. Stacks with SALE promo multiplicatively. Default tier is Bronze until the wallet earns Karma on-chain.`,
              `7. If the question is outside these manuals, answer factually with general knowledge.`,
              `8. The user and Cherry may have exchanged earlier messages. If a "[Previous conversation]" block is below, use it for context (e.g., follow-up questions referring to earlier topics).`,
              "",
              manualBlocks,
              "",
              historyBlock ? `[Previous conversation]\n${historyBlock}\n` : "",
              `[New user question]`,
              text,
            ].filter(Boolean).join("\n")
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
          const prov = result.provenance ? { hash: result.provenance.hash, chain: result.provenance.chain, explorerUrl: result.provenance.explorer_url, onChain: result.provenance.on_chain } as Provenance : null
          setMessages((m) => [...m, { role: "kaas-chat", reply, privacy: isPrivate, provenance: prov }])
        }
      } catch {
        setMessages((m) => [...m, { role: "agent-chat", reply: "지금은 체리가 중요한 업무를 처리중입니다. 차후에 응대해 드리겠습니다." }])
      } finally {
        setLoading(false)
        scrollToBottom()
      }
    }, 300)
  }, [loading, pushHistory])

  // input 값으로 전송 (Enter / 전송 버튼)
  const handleSend = useCallback(() => {
    sendText(input)
  }, [input, sendText])

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
    notify: (message: string, privacy?: boolean, provenance?: Provenance | null) => {
      setMessages((m) => [...m, { role: "agent-chat", reply: message, privacy, provenance }])
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
        <>
          {/* 체리가 살짝 말 거는 말풍선
              - 꼬리는 말풍선 가로 정중앙
              - "cr" 제거 후 버튼 폭이 ~150px → Cherry 아이콘 가로 중앙 = 화면 오른쪽 기준 ~150px
              - translateX(50%) 로 오른쪽 앵커를 말풍선의 중앙으로 사용 */}
          <div
            className="fixed z-[60] pointer-events-none transition-all duration-300 ease-out"
            style={{
              bottom: 65,
              right: 150,
              opacity: bubbleVisible ? 1 : 0,
              transform: `translate(50%, ${bubbleVisible ? 0 : 8}px)`,
            }}
            aria-hidden={!bubbleVisible}
          >
            <div className="relative bg-white border border-[#E4E1EE] rounded-2xl shadow-sm px-3.5 py-1 max-w-[260px]">
              <span className="text-[12px] text-[#1A1626] leading-snug whitespace-nowrap">
                {typedText}
              </span>
              {/* 꼬리 — 말풍선 가로 정중앙 */}
              <span
                aria-hidden
                className="absolute -bottom-[6px] w-3 h-3 bg-white border-r border-b border-[#E4E1EE]"
                style={{ left: "50%", transform: "translate(-50%, 0) rotate(45deg)" }}
              />
            </div>
          </div>

          <button
            onClick={() => { setOpen(true); scrollToBottom() }}
            className={cn(
              "fixed bottom-5 right-5 z-[60] flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1A1520] text-white shadow-lg hover:shadow-xl transition-all cursor-pointer border border-[#333]",
              consoleShake && "cherry-shake"
            )}
          >
            <Cherry size={16} className="text-[#C94B6E]" />
            <span className="text-[12px] font-semibold">Cherry Console</span>
          </button>
        </>
      )}

    {/* 콘솔 패널 — DOM에 유지해서 스크롤 위치 보존 */}
    <div ref={consoleRef} className={cn("fixed bottom-5 right-5 z-[60] w-[420px] h-[520px] flex flex-col rounded-2xl bg-[#0D0D12] border border-[#333] shadow-2xl", !open && "hidden", consoleShake && "cherry-shake")}>
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
            <span className="text-[12px] font-semibold text-[#E0E0E0]">{currentAgent?.name ?? "Cherry Console"}</span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2A2040] text-[#B8A0D0]">{currentAgent?.karma_tier ?? ""}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#888]">{credits}cr</span>
          {messages.length > 0 && (
            <div className="relative">
              <button
                onClick={() => { if (!loading) setShowClearConfirm((v) => !v) }}
                className="p-0.5 hover:bg-[#222] rounded cursor-pointer disabled:opacity-40"
                title="Clear conversation"
                disabled={loading}
              >
                <Trash2 size={12} className="text-[#666] hover:text-[#C94B6E]" />
              </button>
              {showClearConfirm && (
                <div
                  className="absolute right-0 top-full mt-1.5 z-[70] bg-[#1A1520] border border-[#333] rounded-lg shadow-xl px-3 py-2 flex items-center gap-2 whitespace-nowrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[11px] text-[#E0E0E0]">Clear all?</span>
                  <button
                    onClick={() => { setMessages([]); setShowClearConfirm(false) }}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#C94B6E] text-white hover:opacity-90 cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="text-[10px] text-[#888] hover:text-[#E0E0E0] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
          <button onClick={() => setOpen(false)} className="p-0.5 hover:bg-[#222] rounded cursor-pointer" title="Minimize">
            <Minus size={12} className="text-[#666]" />
          </button>
          <button onClick={() => setOpen(false)} className="p-0.5 hover:bg-[#222] rounded cursor-pointer" title="Close">
            <X size={12} className="text-[#666]" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-2">
            <Cherry size={28} className="text-[#C94B6E] mb-2" />
            <p className="text-[11px] text-[#888] mb-3">Try one of these</p>
            <div className="flex flex-col gap-1.5 w-full max-w-[300px]">
              {Object.keys(EXAMPLE_ANSWERS).map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setOpen(true)
                    sendText(q)
                  }}
                  disabled={loading}
                  className="text-[11.5px] text-left px-3 py-2 rounded-lg bg-[#1A1520] border border-[#333] text-[#E0E0E0] hover:bg-[#241B2C] hover:border-[#444] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {q}
                </button>
              ))}
            </div>
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
                  {msg.privacy && msg.provenance?.onChain && msg.provenance.hash && (
                    <a href={msg.provenance.explorerUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-[#7B5EA7] hover:underline">
                      <Shield size={9} />
                      <span className="font-mono">{msg.provenance.hash.slice(0, 10)}...{msg.provenance.hash.slice(-6)}</span>
                      <ExternalLink size={8} />
                    </a>
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
                  {msg.privacy && msg.provenance?.onChain && msg.provenance.hash && (
                    <a href={msg.provenance.explorerUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-[#7B5EA7] hover:underline">
                      <Shield size={9} />
                      <span className="font-mono">{msg.provenance.hash.slice(0, 10)}...{msg.provenance.hash.slice(-6)}</span>
                      <ExternalLink size={8} />
                    </a>
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

        {loading && (() => {
          const lastRole = messages[messages.length - 1]?.role
          const waitingForCherry = lastRole === "user" || lastRole === "agent"
          if (!waitingForCherry) return null
          const phase = loadingPhase || (lastRole === "agent" ? "Cherry is processing…" : "Thinking…")
          return (
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#C0B8D0] py-2">
              <div className="w-3 h-3 border-[1.5px] border-[#C94B6E] border-t-transparent rounded-full animate-spin" />
              {phase}
            </div>
          )
        })()}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-[#222] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              // 사용자가 직접 편집하면 draft로 간주 — 히스토리 모드 해제
              if (historyIdx !== history.length) {
                setHistoryIdx(history.length)
              }
              draftRef.current = e.target.value
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                if (history.length === 0) return
                e.preventDefault()
                // 편집 중이었으면 draft 저장
                if (historyIdx === history.length) draftRef.current = input
                const nextIdx = Math.max(0, historyIdx - 1)
                setHistoryIdx(nextIdx)
                setInput(history[nextIdx])
                // 커서를 끝으로
                requestAnimationFrame(() => {
                  const el = e.currentTarget as HTMLInputElement
                  if (el) el.setSelectionRange(el.value.length, el.value.length)
                })
              } else if (e.key === "ArrowDown") {
                if (historyIdx >= history.length) return
                e.preventDefault()
                const nextIdx = historyIdx + 1
                setHistoryIdx(nextIdx)
                setInput(nextIdx === history.length ? draftRef.current : history[nextIdx])
                requestAnimationFrame(() => {
                  const el = e.currentTarget as HTMLInputElement
                  if (el) el.setSelectionRange(el.value.length, el.value.length)
                })
              } else if (e.key === "Enter") {
                // Enter로 submit 시 draft 정리됨(handleSend에서 처리)
                handleSend()
              }
            }}
            placeholder="Cherry에게 메시지... (↑/↓ for history)"
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
