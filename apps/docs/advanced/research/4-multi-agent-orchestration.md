# 4. Multi-agent Orchestration — 자료조사

| | |
|---|---|
| 사이드바 | `agent-topologies` / 라벨 "Multi-agent Orchestration" |
| 현재 매핑 | `MultiAgentSystem` |
| 매핑 상태 | ⚠️ **개념은 맞으나 하위가 0개** — 관련 개념이 다른 데 흩어져 있다 |
| 조사일 | 2026-08-25 |

---

## 0. 왜 이게 문제인가

`MultiAgentSystem`은 `AgentArchitecture` 밑에 제대로 있는데 **하위 개념이 하나도 없다.**
그런데 관련 개념들이 온톨로지 여기저기에 떠 있다.

```
MultiAgentCollaboration   →  AgenticTask 밑에 따로
Coordinator               →  별도
Planner · Executor        →  별도
PlannerExecutorAgent      →  AgentArchitecture 밑 (MultiAgentSystem 형제)
```

**신설 없이 연결만 이어도 페이지가 살아난다.**

---

## 1. 이게 무슨 주제인가

에이전트 하나로 안 되는 일을 **여러 에이전트에게 나눠 시키고, 그 흐름을 통제하는 법**이다.

핵심 질문 세 가지.
- **누가 결정하나** — 중앙 관리자인가, 서로 협의인가
- **어떻게 대화하나** — 공유 메모인가, 메시지인가, 인계인가
- **누가 무엇을 맡나** — 역할을 미리 정하나, 실행 중에 정하나

---

## 2. 학계 표준 분류

### 2-A. 5차원 협업 분류 (Multi-Agent Collaboration Mechanisms: A Survey of LLMs) ✅ *원문 확인*

Tran et al., arXiv:2501.06322. **원문에서 확인한 5개 축**이다.

| 축 | 값 |
|---|---|
| **Actors** | 참여하는 에이전트 |
| **Types** | *cooperation · competition · **coopetition*** |
| **Structures** | ***peer-to-peer · centralized · distributed*** |
| **Strategies** | *role-based · model-based* |
| **Coordination Protocols** | (초록에 값이 열거되지 않음) |

> ⭐ **`coopetition`(협력적 경쟁)** 이 별도 값으로 있다는 점이 눈에 띈다. 협력 아니면 경쟁이라는 이분법이 아니다.

### 2-A′. 3위상 + 1적응축 (MDPI 서베이) 🟡 *원문 미확인*

> ⚠️ **이 절은 원문을 못 봤다.** MDPI 원문(`Future Internet` 18(6):326)이 **HTTP 403** 으로 열리지 않아 검색 요약만 봤다. 아래 내용을 체리로 쓰려면 먼저 원문을 확보해야 한다.

**위상 3개 + 적응성 축 1개**로 나눈다고 한다.

| 위상 | 정의 | 대표 |
|---|---|---|
| **Centralized (중앙형)** | 관리자 하나가 전체 상태를 쥐고 배분 | LangGraph supervisor |
| **Decentralized (분산형)** | 에이전트끼리 직접 주고받음 | Swarm · 토론형 |
| **Hierarchical (계층형)** | 관리자 → 중간 감독 → 말단 작업자 트리 | MetaGPT · Magentic-One |

**적응성 축은 위상과 직교한다.**
```
정적(static)              LangGraph supervisor — 라우팅을 손으로 코딩
동적·적응(dynamic)        AutoGen auto-select · Magentic-One 재계획
```

### 2-B. 실무 5패턴 🟡 *업계 블로그 출처 · 학술 근거 아님*

> ⚠️ 아래 표와 §2-C, §3(프레임워크 비교)은 **블로그·업체 문서에서 온 것**이다. 원문 논문이 없다. 체리에 쓸 경우 **"업계에서 통용되는 정리"** 라고 성격을 밝혀야 하며, 학술적 주장처럼 적으면 안 된다.

| 패턴 | 모양 | 언제 |
|---|---|---|
| **Pipeline (순차)** | A → B → C | 단계가 정해진 작업 |
| **Fan-out (병렬 분산·수집)** | 하나가 여러 개로 뿌리고 모음 | 조사·비교 |
| **Supervisor (감독)** | 관리자가 위임하고 결과 취합 | 가장 흔함 |
| **Hierarchical (계층)** | 관리자 → 감독 → 작업자 | 복잡한 워크플로 |
| **Swarm / Debate** | 동등한 에이전트끼리 | 탐색·비평 |

> 🟡 **실무 관찰(블로그 출처, 미검증)**: "대부분의 프로덕션 시스템은 순차 파이프라인 + 감독 한두 단계이고 완전 자율 스웜은 드물다"는 말이 여러 업계 문서에 반복된다. **다만 이를 뒷받침하는 측정·설문 자료를 찾지 못했다.**
> → **체리로 쓰지 않는 것을 권한다.** 쓴다면 반드시 "업계 통념"으로 표시하고, 근거를 대는 1차 자료를 먼저 찾아야 한다.

### 2-C. 통신 방식 3가지

```
공유 상태 / 블랙보드    모두가 하나의 상태 객체를 읽고 씀
메시지 패싱 / 액터      비동기 메시지로 통신
핸드오프 + 페이로드     대화 이력 일부만 넘기며 제어권 이전
```

### 2-D. 계층형 5차원 분류 (arXiv:2508.12683)

```
① 통제 계층      의사결정 권한을 어떻게 나누나
② 정보 흐름      층 사이 데이터 교환 방식
③ 역할·위임      책임 배분
④ 시간적 계층    층별 시간 스케일
⑤ 통신 구조      메시지 교환 방식
```
전통 기법 연결: **contract-net 프로토콜**(작업 배분) · **계층적 강화학습**

---

## 3. 대표 프레임워크 🟡 *블로그·업체 문서 출처 · 원문 미확인*

| 프레임워크 | 특징 |
|---|---|
| **LangGraph** | 조건부 엣지를 가진 방향 그래프. 장기 실행·상태 유지에 강함. supervisor 패턴 |
| **OpenAI Agents SDK** | 명시적 **handoff**. agents · handoffs · function tools · guardrails 네 부품 |
| **CrewAI** | 역할 기반 crew + process 타입 |
| **AutoGen / AG2** | 대화형 GroupChat |
| **MetaGPT** | 소프트웨어 회사 형태의 **고정 계층** |
| **Magentic-One** | 재계획하는 Orchestrator — 동적 계층형 |
| **DSPy** | 프로그램으로서의 프롬프트 |

---

## 4. 하위 개념 후보 (차일드 컨셉)

**이미 있음 — 연결만 하면 됨**

```
MultiAgentCollaboration   AgenticTask 밑  →  MultiAgentSystem 과 RELATED
Coordinator               별도            →  MultiAgentSystem 하위
Planner · Executor        별도            →  역할 분담의 부품
PlannerExecutorAgent      AgentArchitecture 하위 (형제)
```

**신설 후보 (위상 3개를 반영하려면)**

```
SupervisorPattern      또는 CentralizedOrchestration
HierarchicalAgents     계층형
SwarmPattern           또는 DecentralizedOrchestration
AgentHandoff           제어권 이전 — OpenAI SDK의 핵심 개념
MultiAgentDebate       토론형
```

---

## 5. 인접 개념과의 경계

| 인접 | 경계 |
|---|---|
| `AgentArchitecture` (Basics) | **Basics = 에이전트 하나가 어떻게 생겼나**(LLM + 도구 + 메모리). **Advanced = 여러 개를 어떻게 엮나.** 깔끔하다 |
| `WorkflowAutomation` | 워크플로 자동화와 에이전트 오케스트레이션은 겹친다. 차이는 **누가 다음 단계를 정하나**(코드 vs 모델) |
| `Memory` 계열 | 여러 에이전트가 기억을 공유하는가는 오케스트레이션 문제이기도 하다. `SemanticMemory`·`EpisodicMemory`·`VectorMemory`·`GraphMemory`가 이미 있다 |
| `AdvancedPrompting` | Multi-Agent Debate는 프롬프팅 기법이기도 하다 |

---

## 6. 현재 온톨로지 상태

```
LLMConcept
 └─ AgentArchitecture              (Basics 메뉴)
     ├─ LLMAgent
     ├─ MultiAgentSystem           ← Advanced 메뉴. 하위 0개
     ├─ PlannerExecutorAgent
     ├─ ReflexiveAgent
     └─ ToolAugmentedAgent

떠 있는 관련 개념:
  MultiAgentCollaboration (AgenticTask 밑) · Coordinator · Planner · Executor
  ToolUse · ToolInterface · ToolCallAccuracy · WorkflowAutomation
  Memory · MemoryModule · EpisodicMemory · SemanticMemory · VectorMemory
  GraphMemory · ExternalMemory · SensitiveToolBlocking
```

---

## 7. 우리 DB에 있는 재료

**도구 기준 72건** (별칭 `multiagent` 등록 + 하위 개념 연결 후). 손수 고른 검색어 기준 합집합은 118건.
6개 항목 중 **재료가 가장 많다.**

```
  71  multiagent          ← 책이 붙여서 씀
  15  orchestrator
  11  swarm
  10  supervisor
   9  planner
   5  delegation
   2  agent communication
   1  multi-agent · debate
   0  handoff · coordinator
```

⚠️ **검색어를 `multiagent`(붙여쓰기)로 넣어야 한다.** 온톨로지 이름 `MultiAgentSystem`으로는 0건이 나온다. **이것 하나가 0 → 71건을 가른다.**

**MECE 축 제안**: ① 왜 여러 개인가 ② 누가 결정하나(위상 3종) ③ 어떻게 대화하나(통신 3종) ④ 실패 모드(무한 루프·비용 폭증) ⑤ 언제 하나면 충분한가

---

## 8. 판단을 위한 쟁점 (결정하지 않음)

1. **위상 3개(중앙·분산·계층)를 개념으로 신설할 것인가?** 신설하면 하위가 학계 분류와 맞고 MECE가 자연스럽다.
2. **`MultiAgentCollaboration`을 어떻게 이을 것인가?** `AgenticTask` 밑에서 옮길지, RELATED만 추가할지.
3. **`Coordinator`·`Planner`·`Executor`를 `MultiAgentSystem` 하위로 붙일 것인가?** 이들은 **역할**이지 **위상**이 아니라 성격이 다르다.
4. **메뉴 라벨을 온톨로지에 맞출 것인가?** PRD는 "Multi-agent Orchestration", 온톨로지는 "MultiAgentSystem". *System*은 구조, *Orchestration*은 통제 방식이라 미묘하게 다르다.

---

## 출처

- ✅ [Multi-Agent Collaboration Mechanisms: A Survey of LLMs (arXiv:2501.06322)](https://arxiv.org/abs/2501.06322) — **원문 확인**
- 🟡 [LLM-Based Multi-Agent Orchestration: A Survey (MDPI Future Internet 18(6):326)](https://www.mdpi.com/1999-5903/18/6/326) — **HTTP 403, 원문 미확인**
- [A Taxonomy of Hierarchical Multi-Agent Systems (arXiv:2508.12683)](https://arxiv.org/abs/2508.12683)
- [Agent Orchestration Patterns: Swarm vs Mesh vs Hierarchical](https://gurusup.com/blog/agent-orchestration-patterns)
- [Multi-Agent Orchestration: 5 Patterns That Work in 2026](https://www.digitalapplied.com/blog/multi-agent-orchestration-5-patterns-that-work)
- [Multi-Agent Orchestration (LangGraph, OpenAI Agents SDK, AutoGen, Swarm) — HLD Handbook](https://hld.handbook.academy/curriculum/ai-ml-system-design/multi-agent-orchestration/)
- [Literature Review of Multi-Agent Debate for Problem-Solving (arXiv:2506.00066)](https://arxiv.org/pdf/2506.00066)
