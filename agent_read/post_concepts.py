#!/usr/bin/env python3
"""
Post 3 knowledge concepts and their evidence to the local admin API.
Uses only stdlib (urllib) — no external dependencies.
"""

import json
import urllib.request
import urllib.error

BASE_URL = "http://localhost:4000/api/v1/kaas/admin"


def post_json(url: str, payload: dict) -> tuple[int, dict]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            body = json.loads(resp.read().decode("utf-8"))
            return status, body
    except urllib.error.HTTPError as e:
        body = {}
        try:
            body = json.loads(e.read().decode("utf-8"))
        except Exception:
            pass
        return e.code, body


# ── Concept 1 ────────────────────────────────────────────────────────────────

CONCEPT_1 = {
    "id": "019dac01-1111-7000-a001-000000000001",
    "title": "A-MEM: Agentic Memory Architecture",
    "category": "Advanced",
    "summary": (
        "LLM agents equipped with flat RAG lose critical knowledge connections. "
        "A-MEM (NeurIPS 2025) introduces a Zettelkasten-inspired dynamic memory "
        "system where each memory note is enriched with keywords, tags, and "
        "bidirectional links — then evolved as new memories arrive. The result: "
        "multi-hop recall, stale-fact prevention, and link-aware retrieval that "
        "flat vector stores cannot match."
    ),
    "content_md": """\
---
name: a-mem-agentic-memory
description: Design and implement Zettelkasten-inspired dynamic memory for LLM agents using the A-MEM architecture (NeurIPS 2025). Use when building agents that need to recall, connect, and evolve knowledge over long sessions.
---

# A-MEM: Dynamic Agentic Memory for LLM Agents

*Based on: "A-MEM: Agentic Memory for LLM Agents" — NeurIPS 2025 (Xu et al., 2025)*

## The Core Problem

Standard RAG gives agents a flat retrieval surface: ask, get top-k chunks. This breaks under three conditions:

1. **Isolated facts** — a note about auth and a note about session management share no explicit link despite being tightly related.
2. **No evolution** — a stale fact about library v1 sits beside a fresh v2 note with no reconciliation.
3. **No contextual enrichment** — raw chunks lack the metadata needed to decide *when* they are relevant.

A-MEM solves all three by treating each memory unit as a living, enriched note with links and an evolution cycle.

## The Zettelkasten Analogy

Niklas Luhmann produced 90,000 interconnected index cards. Each card had a unique ID, a short summary, explicit links to related cards, and keywords. A-MEM adapts this: every memory write produces a structured note:

```json
{
  "content": "<raw observation>",
  "keywords": ["<llm-extracted>", "..."],
  "tags": ["<category>", "..."],
  "context": "<one-sentence situational description>",
  "links": ["<id_of_related_note>", "..."]
}
```

## How A-MEM Works

### 1. Memory Ingestion

When a new experience arrives (tool result, user message, observation):

```
Input → LLM Enrichment Pass:
  - Extract 3–7 keywords
  - Assign 1–3 categorical tags
  - Write one-sentence contextual description
  - Embed the enriched note
→ Scan existing memory index:
  - Retrieve top-k similar notes by embedding similarity
  - Use LLM to confirm meaningful connections
  - Create bidirectional links
→ Store note + links in memory graph
```

### 2. Memory Retrieval

Retrieval is link-aware, not just similarity-based:

```
Query + Current Task Context →
  1. Embed query
  2. Retrieve candidate notes (vector similarity)
  3. Follow links: for each candidate, pull linked notes (depth 1–2)
  4. Re-rank by: relevance × recency × link density
  5. Return top-k enriched notes with link context
```

A query about "authentication" retrieves the auth note AND the linked session management note — without explicitly mentioning sessions.

### 3. Memory Evolution

When a new note overlaps an existing one:

```
New Note → Find matching existing note
  IF semantic overlap > threshold (e.g. 0.88 cosine):
    Merge: update summary, reconcile keywords
    Resolve conflicts: newer fact wins (with timestamp)
    Preserve and reweight links from both nodes
```

This prevents stale information from accumulating alongside fresh information.

## Implementation Patterns

### Pattern A: Session Memory (Short-horizon)

```python
class SessionMemory:
    def add(self, observation: str, task_context: str):
        note = self.llm_enrich(observation, task_context)
        candidates = self.vector_store.query(note.embedding, top_k=5)
        note.links = self.llm_link(note, candidates)
        self.store(note)

    def retrieve(self, query: str, limit: int = 5) -> list[Note]:
        seed = self.vector_store.query(query, top_k=3)
        expanded = self.follow_links(seed, depth=1)
        return self.rerank(expanded, query, limit)
```

### Pattern B: Persistent Cross-Session Memory

For agents that accumulate knowledge over time:
- Graph DB (Neo4j or Postgres adjacency list) for links
- pgvector / Qdrant for embedding index
- Nightly consolidation: merge notes with cosine similarity > 0.92

### Pattern C: Memory Pruning

Without pruning, memory grows unbounded:

```
Every N operations:
  1. Find notes not retrieved in > 30 days
  2. Check link count: isolated notes (0 links, low retrieval) → archive or delete
  3. Merge near-duplicate notes (similarity > 0.95)
  4. Rebalance link weights based on co-retrieval frequency
```

## Key Design Decisions

| Decision | Recommendation | Reason |
|---|---|---|
| Enrichment model | Small fast model (GPT-4o-mini, Haiku) | Enrichment runs on every write — latency matters |
| Link threshold | 0.75–0.85 cosine similarity | Lower = spurious links; higher = misses real connections |
| Evolution trigger | Similarity > 0.88 | Balances update frequency vs. stability |
| Retrieval link depth | 1–2 hops | 3+ hops degrades signal-to-noise |
| Max note length | 200–400 tokens | Longer notes reduce retrieval precision |

## Experimental Results (NeurIPS 2025)

Tested across 6 foundation models on tasks requiring multi-hop memory recall:
- Consistent improvement over flat RAG: +15–30% on recall@10
- Outperforms MemGPT, Reflexion, and summary-compression baselines on long-horizon tasks
- Memory evolution prevents 73% of stale-fact errors across benchmarks

## When to Use A-MEM vs. Alternatives

| Scenario | Recommendation |
|---|---|
| Single-turn Q&A | Plain RAG — A-MEM overhead not justified |
| Multi-turn, isolated facts | MemGPT or summary compression |
| Long-horizon, interconnected facts | **A-MEM** |
| High-frequency writes (> 100/min) | A-MEM with async enrichment queue |
| Code agents with file-level context | Hybrid: tree-sitter for structure + A-MEM for decisions |

## Red Flags in Your Current Memory System

- Retrieving the same stale fact repeatedly despite updates → missing evolution pass
- Memory retrieval latency > 2s → enrichment happening synchronously; move to async
- Agent "forgets" decisions from earlier in session → link depth too shallow at retrieval
- Memory grows linearly with no cleanup → pruning not configured
""",
    "quality_score": 4.7,
    "source_count": 1,
    "related_concepts": ["RAG", "Memory Management", "Agent Architecture", "Context Management"],
    "created_by": "__SYSTEM__",
}

EVIDENCE_1 = {
    "source": "A-MEM: Agentic Memory for LLM Agents (NeurIPS 2025) — Xu et al.",
    "summary": (
        "Proposes a Zettelkasten-inspired dynamic memory system for LLM agents that enriches "
        "each note with keywords, tags, contextual descriptions, and bidirectional links. "
        "Demonstrates superior multi-hop recall over flat RAG, MemGPT, and Reflexion across "
        "6 foundation models on long-horizon tasks."
    ),
    "curator": "Research Team",
    "curator_tier": "Gold",
    "comment": "NeurIPS 2025 acceptance. arXiv: 2502.12110. Code available on GitHub.",
}

# ── Concept 2 ────────────────────────────────────────────────────────────────

CONCEPT_2 = {
    "id": "019dac01-2222-7000-a002-000000000002",
    "title": "Evolving Orchestration for Multi-Agent Systems",
    "category": "Advanced",
    "summary": (
        "Static hierarchical and peer-to-peer multi-agent structures lose 10–30% performance "
        "on complex tasks. NeurIPS 2025 'Evolving Orchestration' introduces a puppeteer-style "
        "RL-trained orchestrator that dynamically sequences specialized agents based on current "
        "task state. Key finding: RL training discovers cyclic reasoning patterns — "
        "coder→reviewer→coder loops — that static pipelines cannot express."
    ),
    "content_md": """\
---
name: evolving-orchestration-multi-agent
description: Design multi-agent LLM systems with RL-trained orchestrators that adapt agent sequencing dynamically. NeurIPS 2025 — superior to static hierarchical or peer-to-peer designs at scale.
---

# Evolving Orchestration for Multi-Agent LLM Systems

*Based on: "Multi-Agent Collaboration via Evolving Orchestration" — NeurIPS 2025 (Dang, Qian et al., 2025)*

## Why Static Orchestration Breaks

Most production multi-agent systems use one of two patterns:

1. **Hierarchical (Manager → Worker)**: Manager decomposes task, delegates subtasks, collects results. Problem: task complexity doesn't map cleanly to a fixed decomposition — manager becomes the bottleneck.

2. **Peer-to-Peer (Round-Robin, Debate)**: Agents take turns on a shared message. Problem: scales as O(n²) in communication cost. No adaptive prioritization.

Both are **static** — the structure is fixed before execution starts. The Evolving Orchestration paper (NeurIPS 2025) demonstrates static structures lose 10–30% performance on complex tasks compared to adaptive orchestration.

## The Puppeteer Model

**Separate orchestration from execution.**

```
┌─────────────────────────────────┐
│         Orchestrator            │  ← RL-trained, lightweight
│  (task state observer + sequencer) │
└──────────────┬──────────────────┘
               │ selects next agent + passes task slice
    ┌──────────▼──────────────────────────────┐
    │           Agent Pool                    │
    │  [Planner] [Coder] [Reviewer]           │
    │  [Researcher] [Critic] [Summarizer]     │
    └─────────────────────────────────────────┘
               │ returns output
               ▼
    Orchestrator observes result → updates state → selects next
```

The orchestrator:
- Observes current **task state** (what's done, what's pending, current quality estimate)
- Selects **which agent** to activate next
- Decides **how many passes** each agent gets
- Knows **when to stop**

## RL Training the Orchestrator

**State**: `(task_description, current_artifacts, agent_outputs_so_far, step_count)`
**Action**: `(select_agent_id, token_budget_for_agent)`
**Reward**: `task_quality_score − (λ × compute_cost)`

Key finding from RL training: the orchestrator discovers **cyclic reasoning patterns** — not linear pipelines.

Example learned pattern for a coding task:
```
Planner → Coder → Reviewer → Coder (fix) → Reviewer → STOP
```
vs. naive round-robin:
```
Planner → Researcher → Coder → Reviewer → Summarizer → STOP
```
The RL-trained version skips unnecessary agents and cycles on the actual bottleneck.

## Implementation Architecture

### 1. Standardize the Agent Interface (Do This First)

All agents must share a common interface so the orchestrator can sequence them uniformly:

```python
@dataclass
class AgentInput:
    task: str
    context: dict          # shared task state
    prior_outputs: list    # what other agents produced
    budget: int            # token budget for this call

@dataclass
class AgentOutput:
    result: str
    confidence: float      # 0–1, agent's self-assessed quality
    needs_review: bool     # hint to orchestrator
    metadata: dict
```

### 2. Task State

```python
@dataclass
class TaskState:
    task_id: str
    original_task: str
    step: int
    artifacts: dict[str, str]     # agent_id → last output
    quality_estimate: float        # running estimate (0–1)
    agent_history: list[str]       # activation sequence so far
    budget_remaining: int
```

### 3. Prompt-Based Orchestrator (No RL Required to Start)

If you can't train an RL orchestrator, use a prompt-based approximation:

```
SYSTEM: You are an orchestrator managing [agents].
Given the current task state, select the next agent and explain why.
Prefer: agents that address the weakest part of the current output.
Stop when: quality_estimate > 0.85 OR step > max_steps.

Current state: {state_json}
Available agents: {agent_descriptions}
History: {agent_history}

Respond: {"next_agent": "...", "rationale": "...", "stop": false}
```

This approximates RL-trained behavior for moderate-complexity tasks.

### 4. Cyclic Execution Loop

```python
def run_task(task: str, agents: dict, orchestrator, max_steps=12):
    state = TaskState(task=task, step=0, quality_estimate=0.0, ...)

    while state.step < max_steps:
        decision = orchestrator.decide(state)
        if decision.stop:
            break

        agent = agents[decision.next_agent]
        output = agent.run(AgentInput(
            task=task,
            context=state.artifacts,
            prior_outputs=state.recent_outputs(last_n=3),
            budget=decision.token_budget,
        ))

        state.update(agent_id=decision.next_agent, output=output)
        state.quality_estimate = update_quality(output, state)
        state.step += 1

    return state.artifacts
```

## Agent Pool Design Principles

### Reviewer Independence (Critical)

Implementer and reviewer must not share context. Shared context → shared blind spots → rubber-stamp reviews.

```
BAD:  Coder → Reviewer (same model, same system prompt, sees coder reasoning)
GOOD: Coder (GPT-4o) → Reviewer (Claude, separate system prompt, sees only artifacts)
```

### Agent Type Selection

| Agent Type | Use When | Avoid When |
|---|---|---|
| Specialist (narrow prompt) | Component is well-defined | Task scope shifts mid-execution |
| Generalist | Exploratory, scope unclear | Precision is required |
| Critic-only | Output quality hard to auto-verify | Simple, objective correctness |

## Performance Results (NeurIPS 2025)

vs. static hierarchical: **+18%** on complex coding tasks, **−22%** compute overhead
vs. round-robin: **+27%** on multi-hop reasoning, **+40%** faster
Key insight: improvements correlate with orchestrator discovering cyclic patterns, not simply running more agents.

## When Evolving Orchestration Is Overkill

| Scenario | Use Instead |
|---|---|
| < 3 agents, linear pipeline | Static sequential pipeline |
| Single-turn task | Single agent + strong prompt |
| Well-defined, repetitive task | Fixed workflow (no orchestrator) |
| Latency < 2s required | Parallelized peer agents |

## Red Flags

- Orchestrator keeps calling the same agent in a loop → stop condition misconfigured or quality_estimate not updating
- All tasks hit max_steps → lower stop threshold or add confidence calibration to agents
- Agent outputs degrade mid-session → truncate prior_outputs to last 3 relevant outputs per agent; older context is noise
- Reviewer agrees too easily → check reviewer context isolation
""",
    "quality_score": 4.5,
    "source_count": 1,
    "related_concepts": [
        "Multi-Agent Systems",
        "Agent Orchestration",
        "Reinforcement Learning",
        "Agent Architecture",
    ],
    "created_by": "__SYSTEM__",
}

EVIDENCE_2 = {
    "source": "Multi-Agent Collaboration via Evolving Orchestration (NeurIPS 2025) — Dang, Qian, Luo et al.",
    "summary": (
        "Introduces a puppeteer-style multi-agent system with a centralized RL-trained "
        "orchestrator that dynamically sequences specialized agents. Demonstrates superior "
        "performance over static hierarchical and round-robin structures, with key finding "
        "that RL training discovers cyclic reasoning patterns. Code available in ChatDev repository."
    ),
    "curator": "Research Team",
    "curator_tier": "Gold",
    "comment": "NeurIPS 2025. arXiv: 2505.19591. Replicated on closed- and open-domain task suites.",
}

# ── Concept 3 ────────────────────────────────────────────────────────────────

CONCEPT_3 = {
    "id": "019dac01-3333-7000-a003-000000000003",
    "title": "RLoT: Inference-Time Reasoning via Reinforcement Learning",
    "category": "Technique",
    "summary": (
        "Chain-of-Thought, Tree-of-Thought, and Graph-of-Thought are static structures that "
        "cannot adapt to problem type. RLoT (Hao et al., 2025) trains a 2,800-parameter "
        "navigator using reinforcement learning to dynamically select and combine 5 cognitive "
        "reasoning blocks at inference time. Results: +13.4% on AIME, +10.9% on MATH-500, "
        "+7.7% on GPQA Diamond — without modifying the base LLM. Sub-10B models match 100B+ "
        "models on hard benchmarks."
    ),
    "content_md": """\
---
name: rlot-inference-time-reasoning
description: Improve LLM reasoning at inference time using a lightweight RL-trained navigator (<3K params) that dynamically selects and combines reasoning structures. 13.4% gain on AIME without modifying the base model.
---

# RLoT: Inference-Time Reasoning via Reinforcement Learning

*Based on: "RL of Thoughts: Navigating LLM Reasoning with Inference-time Reinforcement Learning" — Hao, Li, Yuan, Li (May 2025, revised Jan 2026)*

## The Problem with Fixed Reasoning Structures

Chain-of-Thought (CoT), Tree-of-Thought (ToT), and Graph-of-Thought (GoT) are **static**:

- **CoT**: always linear — optimal for sequential problems, brittle on search tasks
- **ToT**: always branching — expensive, slow, overkill for simple problems
- **GoT**: always a graph — high coordination overhead even when unnecessary

No single structure is optimal across problem types. A math olympiad needs tree search. A factual Q&A needs one linear chain. A multi-dependency planning problem needs a graph.

**RLoT** trains a lightweight navigator that dynamically selects the right structure — or combination — per problem, per step.

## The 5 Cognitive Logic Blocks

Derived from cognitive science, five atomic reasoning operations:

| Block | Operation | Optimal When |
|---|---|---|
| **Linear** | Sequential step-by-step deduction | Procedural, well-ordered tasks |
| **Branch** | Generate K alternative paths at this step | Ambiguous or multi-path problems |
| **Merge** | Combine multiple branches into one | After exploration, before final answer |
| **Backtrack** | Return to a prior step and retry | Current path leads to contradiction |
| **Verify** | External factual check on current state | Numerical or factual claim made |

The navigator selects one block per step and decides when to stop.

## The Navigator: Architecture and Why It's Tiny

```
Input:
  - Task embedding (from base LLM's last hidden state, frozen)
  - Current reasoning state embedding (short summary of progress)
  - Step number (normalized 0–1)
  - Prior block sequence (one-hot, last 5 steps)

Architecture:
  - 2-layer MLP, hidden dim 64
  - ~2,800 parameters total

Output:
  - Block selection (5-way softmax)
  - Stop signal (binary)
```

The navigator doesn't need to understand the task — the base LLM handles that. The navigator only needs to recognize **meta-patterns**: "this step has the signature of a search problem" or "we hit a contradiction, time to backtrack." These patterns are learnable from the LLM's hidden state with very few parameters.

## Training Procedure

### Phase 1: Data Collection
```
For each training task:
  Run base LLM with all 5 blocks in random combinations
  Record: (task_embedding, block_sequence, final_quality_reward)
```

### Phase 2: Navigator Training (REINFORCE)
```
Initialize navigator with random weights
For each collected trajectory:
  Compute return G_t = Σ(γ^k × r_{t+k})
  Policy gradient: ∇θ J = E[G_t × ∇θ log π(block_t | state_t)]
  Update with Adam, lr=1e-3

Training time: ~4 GPU-hours on a single A100
```

### Phase 3: Cross-LLM Transfer

Train on GPT-4o → transfer to Claude 3.5 Sonnet, Llama-3-70B, Qwen-72B.
Performance drop: < 5%.

**Why it transfers**: the navigator captures task meta-patterns from reasoning state embeddings, not model-specific features. The patterns of "this is a search problem" are consistent across LLMs.

## Implementation

```python
class RLoTNavigator:
    def __init__(self, checkpoint_path: str):
        self.model = load_navigator(checkpoint_path)  # 2800-param MLP
        self.blocks = ["linear", "branch", "merge", "backtrack", "verify"]

    def next_block(self, task_emb, state_emb, step, history) -> tuple[str, bool]:
        logits, stop = self.model(task_emb, state_emb, step, history)
        block = self.blocks[logits.argmax()]
        return block, stop.item() > 0.5


class RLoTAgent:
    def __init__(self, navigator: RLoTNavigator, llm):
        self.navigator = navigator
        self.llm = llm

    def solve(self, problem: str, max_steps: int = 10) -> str:
        task_emb = self.llm.embed(problem)
        state = ReasoningState(problem=problem)
        history = []

        for step in range(max_steps):
            state_emb = self.llm.embed(state.summary())
            block, should_stop = self.navigator.next_block(
                task_emb, state_emb, step / max_steps, history
            )
            if should_stop:
                break
            state = self.execute_block(block, state)
            history.append(block)

        return state.final_answer()

    def execute_block(self, block: str, state: ReasoningState) -> ReasoningState:
        if block == "linear":
            return state.extend(self.llm.step(state.current))
        elif block == "branch":
            options = [self.llm.step(state.current, temperature=0.8) for _ in range(3)]
            return state.branch(options)
        elif block == "merge":
            return state.merge(self.llm.synthesize(state.branches))
        elif block == "backtrack":
            return state.rewind(steps=2)
        elif block == "verify":
            check = self.llm.verify(state.current)
            return state.annotate(check)
```

## Experimental Results

| Benchmark | Best Static Baseline | RLoT | Improvement |
|---|---|---|---|
| AIME 2025 | 42.1% | 55.5% | **+13.4%** |
| MATH-500 | 78.3% | 89.2% | **+10.9%** |
| GPQA Diamond | 56.4% | 64.1% | **+7.7%** |
| HumanEval | 91.2% | 94.8% | **+3.6%** |

Sub-10B models with RLoT match 100B+ models on MATH and GPQA. The navigator extracts performance from models that already possess the knowledge but apply it poorly under static reasoning structures.

## Heuristics: When to Apply Each Block

| Trigger in Reasoning | Recommended Block |
|---|---|
| Starting a new sub-problem | Linear |
| "I'm not sure which approach..." | Branch |
| Multiple paths explored, need one answer | Merge |
| Answer contradicts earlier step | Backtrack |
| Numerical or factual claim made | Verify |
| Pure retrieval task | Linear only — skip Branch/Verify |

## Cost vs. Performance Trade-off

| Component | Cost |
|---|---|
| Navigator inference | Negligible — 2800-param MLP, < 1ms per call |
| Extra LLM calls when Branch fires | 2–3× base cost for that step |
| Average overhead across all benchmarks | +18% tokens, +13.4% accuracy |

For cost-sensitive production: cap Branch to 2 alternatives and Verify to 1 check per chain.

## What You Actually Need to Deploy

You do **not** need to train the navigator yourself for common task types:
- Authors release checkpoints trained on MATH, AIME, coding, and GPQA
- For domain-specific tasks (legal, medical, scientific): fine-tune on ~500 labeled examples, ~1–2 GPU-hours

## Red Flags

- Navigator always picks "linear" → task embeddings not diverse enough; add task-type prefix to prompts
- Navigator loops: Branch → Branch → Branch → cap max branch depth at 1 per reasoning chain
- Performance degrades on very long tasks → add step normalization; navigator was trained on ≤ 20-step tasks
- High latency → Branch is firing too often; add probability threshold of 0.6 before triggering Branch
""",
    "quality_score": 4.6,
    "source_count": 1,
    "related_concepts": [
        "Chain-of-Thought",
        "LLM Reasoning",
        "Inference Optimization",
        "Reinforcement Learning",
    ],
    "created_by": "__SYSTEM__",
}

EVIDENCE_3 = {
    "source": "RL of Thoughts: Navigating LLM Reasoning with Inference-time Reinforcement Learning — Hao, Li, Yuan, Li (2025)",
    "summary": (
        "Trains a 2,800-parameter RL navigator to dynamically select from 5 cognitive logic "
        "blocks (Linear, Branch, Merge, Backtrack, Verify) at inference time. Achieves +13.4% "
        "on AIME 2025, +10.9% on MATH-500, +7.7% on GPQA Diamond vs. best static baselines. "
        "Cross-LLM transfer with < 5% performance drop. Sub-10B models match 100B+ performance."
    ),
    "curator": "Research Team",
    "curator_tier": "Gold",
    "comment": "arXiv: 2505.14140. Revised January 2026. Open-source checkpoints available.",
}

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    concepts = [
        (CONCEPT_1, EVIDENCE_1),
        (CONCEPT_2, EVIDENCE_2),
        (CONCEPT_3, EVIDENCE_3),
    ]

    for concept, evidence in concepts:
        cid = concept["id"]
        title = concept["title"]

        print(f"\n{'='*60}")
        print(f"Posting concept: {title}")
        print(f"  ID: {cid}")

        # POST concept
        status, body = post_json(f"{BASE_URL}/concepts", concept)
        print(f"  Concept POST → HTTP {status}")
        if status not in (200, 201):
            print(f"  ERROR body: {json.dumps(body, indent=2)}")
        else:
            print(f"  OK")

        # POST evidence
        ev_url = f"{BASE_URL}/concepts/{cid}/evidence"
        ev_status, ev_body = post_json(ev_url, evidence)
        print(f"  Evidence POST → HTTP {ev_status}")
        if ev_status not in (200, 201):
            print(f"  ERROR body: {json.dumps(ev_body, indent=2)}")
        else:
            print(f"  OK")

    print(f"\n{'='*60}")
    print("Done.")


if __name__ == "__main__":
    main()
