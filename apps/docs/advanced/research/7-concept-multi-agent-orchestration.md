# 7. `MultiAgentOrchestration` — 개념 설계 (신설 근거)

| | |
|---|---|
| 대상 메뉴 | `agent-topologies` / "Multi-agent Orchestration" |
| 1차 매핑 | `MultiAgentSystem` — **임시로 붙인 것** |
| 판정 | ❌ **다른 개념이다. 신설한다.** |
| 조사일 | 2026-08-25 (2차) · 관련: `4-multi-agent-orchestration.md`(주제 조사) |

---

## 0. 왜 이 문서가 따로 있나

1차 기획에서 나는 "`MultiAgentSystem` 이 있으니 신설하지 말고 거기 붙이자"고 판단했다. **그 판단이 내 자료조사와 어긋났다.** `4-multi-agent-orchestration.md` §5 에 이미 이렇게 적어놓고도 무시했다.

> *System*은 구조, *Orchestration*은 통제 방식이라 미묘하게 다르다

2차 조사에서 **전용 논문을 찾아 원문으로 확인**했고, 다른 개념이라는 것이 분명해졌다.

---

## 1. 두 개념이 어떻게 다른가 — 원문 근거

### 1-A. 오케스트레이션은 "계층"이다 ✅ *원문 확인*

*The Orchestration of Multi-Agent Systems: Architectures, Protocols, and Enterprise Adoption* (arXiv:2601.13671)

오케스트레이션을 **에이전트 위에 얹히는 조율 계층**으로 정의하고, 그 계층이 네 가지를 통합한다고 본다.

```
① Planning              무엇을 어떤 순서로
② Policy enforcement    무엇이 허용되는가
③ State management      공유 상태를 누가 갖는가
④ Quality operations    결과를 어떻게 보증하는가
```

원문 표현으로는 *"orchestration logic, governance frameworks, and observability mechanisms collectively sustain system coherence, transparency, and accountability."*

**즉 MultiAgentSystem = 에이전트들의 집합과 구조, Orchestration = 그 집합을 굴리는 통제 계층.**

### 1-B. 구조와 오케스트레이션을 분리해서 정의한 논문 ✅ *원문 확인*

*Multi-Agent Coordination Adaptation via Structure-Guided Orchestration* (MACA, arXiv:2605.25746)

두 가지를 **형식적으로 분리**한다.

```
Structure (𝒢)      에이전트가 노드, 허용된 상호작용이 엣지인 방향 그래프
                   — 정보 흐름의 가능 범위를 제한한다
Orchestration (𝒯)  상태-행동 결정의 순서열
                   — 어떤 에이전트를 부를지, 정보를 어디로 보낼지, 언제 끝낼지
```

> ⭐ **이 논문 하나가 신설 근거로 결정적이다.** 구조(=MultiAgentSystem)와 오케스트레이션(=우리가 만들 개념)을 서로 다른 수학적 대상으로 놓는다.

**오케스트레이션 고유의 실패 모드**도 이 논문이 짚는다.
```
structure-centric   구조를 미리 고정 → 상태가 변해도 적응 못 함
orchestration-centric  명시적 상호작용 모델 없이 굴림 → 조율 분산이 커지고 role drift 발생
```

### 1-C. 통신 프로토콜은 오케스트레이션 계층의 문제다 ✅ *원문 확인*

*A Survey of Agent Interoperability Protocols* (arXiv:2505.02279) — MCP · ACP · A2A · ANP

| 프로토콜 | 통신 모델 | 하는 일 |
|---|---|---|
| **MCP** (Anthropic, 2024-11) | JSON-RPC 클라이언트–서버 | 도구 호출·컨텍스트 주입. Tools · Resources · Prompts · Sampling 4종 |
| **ACP** | 중앙 레지스트리 경유 브로커 | MIME 타입 메시지·비동기 스트리밍 |
| **A2A** (Google, 2025-04) | 피어 투 피어 | **Agent Card**(JSON 능력 명세)로 발견·위임 |
| **ANP** | 탈중앙 | DID + JSON-LD, 런타임 프로토콜 협상 |

서베이는 **4단계 도입 순서**를 제시한다: MCP → ACP → A2A → ANP.

**이것들은 에이전트가 "무엇인가"가 아니라 "어떻게 서로 부르는가"의 문제다** — 즉 오케스트레이션 계층.

---

## 2. 경계 정의 (한 문장 · 원칙 1)

> **MultiAgentSystem 은 에이전트들의 집합과 구조. MultiAgentOrchestration 은 그 위의 통제 계층 — planning · policy · state · quality.**

이 정의면 겹치지 않는다. 형제가 아니라 **상하 관계**이므로 `SUBTOPIC` 으로 붙인다.

---

## 3. 온톨로지 현황 — 붙일 자리

```
AgentArchitecture
 └─ MultiAgentSystem                     ← 1차 메뉴가 가리키던 곳
     ├─ Coordinator (SUBTOPIC·우리가 1차에 붙임)
     ├─ MultiAgentCollaboration (RELATED·우리)
     ├─ PlannerExecutorAgent (RELATED·우리)
     └─ WorkflowAutomation (RELATED·우리)

떠 있는 조율 부품 (AgentComponent 밑)
  Coordinator · Planner · Executor
```

⚠️ **1차에서 붙인 4건 중 3건은 사실 오케스트레이션의 부품**이다. `Coordinator`·`WorkflowAutomation`·`MultiAgentCollaboration` 은 "에이전트 집합"이 아니라 "굴리는 방식"에 속한다.

**설계**
```
MultiAgentOrchestration  --SUBTOPIC-->  MultiAgentSystem

하위 (5개)
  Coordinator              SUBTOPIC   ← MultiAgentSystem 에서 이동
  Planner                  SUBTOPIC   ← arXiv:2601.13671 의 planning
  Executor                 SUBTOPIC
  WorkflowAutomation       RELATED    ← 이동
  MultiAgentCollaboration  RELATED    ← 이동
```
이동은 **해제(revoked_at) + 재삽입**이다. 지우지 않는다.

**별칭**: `Agent Orchestration`(SYNONYM) · `orchestrator`(VARIANT — 책이 쓰는 표현)

---

## 4. 우리 DB 에 있는 재료 — **269건**

```
   131  workflow
    73  Building Applications with AI Agents › Ch.8 From One Agent to Many   ← 본거지
    60  coordinat*        60  multiagent        54  orchestrat*
    24  routing|router    13  state management  10  supervisor
     9  actor-critic       8  swarm              7  delegat*
     5  Temporal/durable execution               3  manager coordination
     1  hand-off           1  parsimony
```

**장별 분포**
```
  73  Building Apps › Ch.8  From One Agent to Many
  25  Building Apps › Ch.3  User Experience Design for Agentic Systems
  23  Building Apps › Ch.12 Protecting Agentic Systems
  19  Building Apps › Ch.1  Introduction to Agents
  16  Building Apps › Ch.11 Improvement Loops
  13  Building Apps › Ch.2  Designing Agent Systems
```

Ch.8 의 절 구성이 그대로 체리 축이 된다.
```
Multiagent Scenarios · Manager Coordination · Principles for Adding Agents
Actor-Critic Approaches · Orchestration and Workflow Engines
```

⭐ **재료가 6개 항목 중 가장 풍부하다.** 외부 자료 없이도 체리 5~7개를 MECE 로 채울 수 있다.

---

## 5. 체리 축 제안 (6축)

| # | 축 | 재료 |
|---|---|---|
| C1 | 왜 하나로는 안 되나 — 전문화가 선택 오류를 줄인다 | Ch.8 *Multiagent Scenarios* |
| C2 | 누가 결정하나 — manager coordination 의 득실 | Ch.8 *Manager Coordination* (중앙집중은 협상 비용을 없애지만 관리자가 병목) |
| C3 | **에이전트를 늘리는 비용 — parsimony 원칙** | Ch.8 *Principles for Adding Agents* |
| C4 | 서로 비평하게 하기 — actor-critic | Ch.8 *Actor-Critic Approaches* |
| C5 | 죽지 않는 실행 — 상태·재시도·복구 | Ch.8 *Orchestration and Workflow Engines* (Temporal 의 durable execution) |
| C6 | **구조를 고정하면 적응 못 하고, 안 고정하면 role drift** | 외부 · MACA arXiv:2605.25746 |

C1~C5 는 책만으로 가능하다. C6 만 외부다.

---

## 6. References 제안

| 단계 | 자료 | 링크 |
|---|---|---|
| START HERE | *Building Applications with AI Agents* Ch.8 "From One Agent to Many" (소장 · 127문단) | ✗ 소장 |
| NEXT → | 같은 책 Ch.5 "Orchestration" (소장) | ✗ 소장 |
| THEN → | A Survey of Agent Interoperability Protocols — MCP·ACP·A2A·ANP (arXiv:2505.02279) | ✅ |
| DEEP DIVE → | The Orchestration of Multi-Agent Systems (arXiv:2601.13671) | ✅ |

열리는 링크 2개 — 기준 충족.

---

## 7. 검토 — 이 신설이 틀릴 수 있는 지점

| # | 의심 | 확인 결과 |
|---|---|---|
| Q1 | 그냥 `MultiAgentSystem` 을 쓰면 안 되나? | ❌ MACA 가 구조와 오케스트레이션을 **다른 대상으로 형식화**한다. 같은 것이라면 그럴 이유가 없다 |
| Q2 | 하위가 3개 이상 나오나? | ✅ 5개 (Coordinator·Planner·Executor·WorkflowAutomation·MultiAgentCollaboration) |
| Q3 | 1차에서 붙인 관계를 옮기면 `MultiAgentSystem` 이 빈약해지지 않나? | 하위 2개(PlannerExecutorAgent · MultiAgentOrchestration)로 준다. **메뉴 페이지가 아니므로 3개 기준을 적용하지 않는다** |
| Q4 | `Planner`·`Executor` 는 `AgentComponent` 밑에도 있는데 중복 아닌가? | 다중 상위는 이 온톨로지에서 이미 흔하다(예: `Coordinator`). 관계 타입이 다르므로 순환도 아니다 |
| Q5 | 책 재료가 특정 장에 몰려 있지 않나? | Ch.8 이 73/269 로 27%. Advanced Prompting 의 Reflexion 편중(45/83=54%)보다 낫다 |
| Q6 | 이름을 `AgentOrchestration` 으로 할까? | ❌ 메뉴가 "Multi-agent Orchestration" 이다. 메뉴에 맞춘다. `Agent Orchestration` 은 별칭으로 넣는다 |

---

## 출처

- ✅ [The Orchestration of Multi-Agent Systems: Architectures, Protocols, and Enterprise Adoption (arXiv:2601.13671)](https://arxiv.org/abs/2601.13671) — **원문 확인**
- ✅ [Multi-Agent Coordination Adaptation via Structure-Guided Orchestration (arXiv:2605.25746)](https://arxiv.org/html/2605.25746v1) — **원문 확인**
- ✅ [A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP (arXiv:2505.02279)](https://arxiv.org/html/2505.02279v1) — **원문 확인**
- ✅ [Multi-Agent Collaboration Mechanisms: A Survey of LLMs (arXiv:2501.06322)](https://arxiv.org/abs/2501.06322) — 1차 조사분, 원문 확인
- ✅ [A Taxonomy of Hierarchical Multi-Agent Systems (arXiv:2508.12683)](https://arxiv.org/abs/2508.12683) — 1차 조사분, 원문 확인
