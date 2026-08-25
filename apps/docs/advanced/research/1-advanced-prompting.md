# 1. Advanced Prompting — 자료조사

| | |
|---|---|
| 사이드바 | `chain-of-thought` / 라벨 "Advanced Prompting" |
| 현재 매핑 | `AdvancedPrompting` |
| 매핑 상태 | ✅ **정확히 일치** — 6개 중 유일하게 온톨로지에 이름이 그대로 있다 |
| 조사일 | 2026-08-25 |

---

## 1. 이게 무슨 주제인가

기본 프롬프트(지시문 + 예시)를 넘어서, **모델이 답에 이르는 과정 자체를 설계하는** 기법군이다. 핵심 구분선은 "무엇을 물어보나"가 아니라 **"어떻게 생각하게 하나"** 다.

세 가지 축으로 갈린다.
- **추론을 드러내게 한다** — 중간 단계를 쓰게 만든다 (CoT 계열)
- **문제를 쪼갠다** — 하위 질문으로 분해한다 (Decomposition 계열)
- **여러 번 시도해 고른다** — 다양한 경로를 만들어 합의하거나 스스로 고친다 (Ensembling · Self-Criticism 계열)

---

## 2. 학계 표준 분류 — The Prompt Report (2024)

이 분야의 사실상 표준 분류다. 메릴랜드대·OpenAI·스탠퍼드·마이크로소프트 연구자 32명이 논문 **1,565편**을 PRISMA 방법론으로 검토해 만들었다.

- 텍스트 프롬프팅 기법 **58개** (대분류 **5개**)
- 멀티모달 기법 **40개**
- 표준 용어 **33개**

**5개 대분류** (논문 §2.2 — 원문 확인)

| 분류 | 정의 | 대표 기법 |
|---|---|---|
| **In-Context Learning (ICL)** | 예시로 유도한다. **Zero-Shot 기법은 이 안의 하위 분류**(§2.2.1.3)다 | Few-Shot · Exemplar Selection · KNN Prompting · Role/Emotion/Style Prompting |
| **Thought Generation** | 추론 과정을 말하게 한다 | Chain-of-Thought · Zero-Shot CoT · Analogical Prompting |
| **Decomposition** | 복잡한 문제를 하위 질문으로 쪼갠다 | Least-to-Most · Decomposed Prompting · Plan-and-Solve · Program-of-Thoughts |
| **Ensembling** | 여러 경로를 만들어 합친다 | Self-Consistency · DiVeRSe · Max Mutual Information |
| **Self-Criticism** | 스스로 비평하고 고친다 | Self-Refine · Reflexion · Chain-of-Verification · Self-Calibration |

> ⚠️ **정정 이력**: 2차 검토 전에는 이 표를 "6개 대분류(Zero-Shot 포함)"로 적었다. **논문 원문(arXiv:2406.06608v6 §2.2)을 직접 확인한 결과 대분류는 5개이고 Zero-Shot 은 ICL 하위(§2.2.1.3)**였다. 블로그 요약을 그대로 옮긴 것이 원인이었다.

> ⚠️ **벤치마크 결과 — 조건을 반드시 붙여야 하는 주장**
> 논문의 사례 연구는 **MMLU · GPT-3.5-turbo** 한 조건에서 수행됐다. 그 조건에서 **Few-Shot CoT 가 가장 효과적**이었고, **Self-Consistency 는 Zero-Shot 은 개선했으나 Few-Shot 에서는 이득이 미미**했으며, **Zero-Shot CoT 가 단순 Zero-Shot 보다 못한** 결과도 나왔다(저자들이 추가 조사가 필요하다고 적음).
> 이를 "Self-Consistency 는 효과가 없다"로 일반화하면 **틀린 주장이 된다.** 체리로 쓸 때 조건(벤치마크·모델)을 반드시 함께 적는다.

---

## 3. 대표 원전

| 기법 | 논문 | 연도 |
|---|---|---|
| Chain-of-Thought | Wei et al., *Chain-of-Thought Prompting Elicits Reasoning in Large Language Models* | 2022 |
| Self-Consistency | Wang et al., *Self-Consistency Improves Chain of Thought Reasoning in Language Models* | 2022 |
| Least-to-Most | Zhou et al., *Least-to-Most Prompting Enables Complex Reasoning in Large Language Models* | 2022 |
| ReAct | Yao et al., *ReAct: Synergizing Reasoning and Acting in Language Models* | 2022 |
| Tree of Thoughts | Yao et al., *Tree of Thoughts: Deliberate Problem Solving with Large Language Models* | 2023 |
| 분류 체계 | Schulhoff et al., *The Prompt Report: A Systematic Survey of Prompting Techniques* (arXiv:2406.06608) | 2024 |

---

## 4. 하위 개념 후보 (차일드 컨셉)

**이미 온톨로지에 있는 것 — 11개가 `AdvancedPrompting` 밑에 붙어 있다**

```
ChainOfThought · TreeOfThoughts · ProgramOfThoughts · PlanAndSolve
SelfConsistency · SelfRefine · SelfAsk · Reflexion
ReAct · PAL · PromptChaining
```

**온톨로지에 있으나 다른 곳에 붙어 있는 것**

```
FewShot · ZeroShot        →  현재 AdvancedPrompting 하위가 아님
Critic                    →  Self-Criticism 계열인데 별도 위치
PromptCaching             →  운영 최적화라 성격이 다름
```

**없는 것 (추가 후보)**

```
LeastToMost               Decomposition 계열의 원전급 기법인데 없음
ChainOfVerification       Self-Criticism 계열
DecomposedPrompting       Decomposition 계열
AnalogicalPrompting       Thought Generation 계열
```

---

## 5. 인접 개념과의 경계

| 인접 개념 | 경계 |
|---|---|
| `PromptEngineering` (Basics) | **Basics = 프롬프트를 잘 쓰는 법**(지시·예시·템플릿). **Advanced = 추론 과정을 설계하는 법.** 지금 온톨로지도 `PromptEngineering`과 `AdvancedPrompting`이 형제로 `PromptingTechnique` 밑에 나란히 있어 이 구분과 맞는다 |
| `AgentArchitecture` (Basics) | ReAct·Reflexion은 **프롬프팅 기법이자 에이전트 패턴**이다. 겹친다. 온톨로지에도 `ReflexiveAgent`가 `AgentArchitecture` 밑에 따로 있다 → **중복 정리 필요** |
| `MultiAgentSystem` | 여러 모델이 토론하는 기법(Multi-Agent Debate)은 프롬프팅인가 에이전트인가 — 경계 모호 |

---

## 6. 현재 온톨로지 상태

```
PromptingTechnique
 ├─ BasicPrompting
 ├─ PromptEngineering          ← Basics 메뉴가 가리킴
 │   └─ ExampleSelection · InstructionOptimization · Prompt · TemplateDesign
 └─ AdvancedPrompting          ← Advanced 메뉴가 가리킴
     └─ ChainOfThought · TreeOfThoughts · ProgramOfThoughts · PlanAndSolve
        SelfConsistency · SelfRefine · SelfAsk · Reflexion · ReAct · PAL · PromptChaining
```

**구조가 이미 좋다.** 6개 중 손댈 것이 가장 적다.

---

## 7. 우리 DB에 있는 재료

**도구 기준(노드명+별칭+하위 개념명) 83건.** 그중 45건이 `Reflexion` 하나에서 나오므로 **실질 38건**이다.

(아래는 손으로 고른 넉넉한 검색어 기준 개별 건수 — 합집합 126건. 각 수치는 실측이나, 도구가 자동으로 모아주는 양은 위쪽이다.)

```
  63  Reflexion          ← ⚠️ 아래 주 참고
  26  ReAct
  17  system prompt
  15  in-context learning
  12  few-shot
  10  chain-of-thought
   8  zero-shot
   7  CoT
   4  prompt template
   3  self-critique · decomposition
   2  chain of thought
   1  self-consistency
```

> ⚠️ **`Reflexion` 63건의 출처를 확인했다.** `handbook.book` 에 "Reflexion" 이라는 도서 행이 있으나 **본문이 적재돼 있지 않다**(장 0개 · 문단 0건). 63건은 전부 다른 책이 Reflexion을 **언급한** 것이다 — 주로 *Building Applications with AI Agents* Ch.11 Improvement Loops · Ch.7 Learning in Agentic Systems.

**장별 분포 (실측)**

```
  14  Building Applications with AI Agents / Ch.11 Improvement Loops
  12  AI Engineering / Ch.5 Prompt Engineering          ← 이 주제의 본거지
  10  Building Applications with AI Agents / Ch.7 Learning in Agentic Systems
   4  AI Engineering / Ch.9 Inference Optimization
   3  Building Applications with AI Agents / Ch.1 · Ch.5
```

⚠️ **분포가 치우쳐 있다.** 본거지인 *AI Engineering* Ch.5는 78문단 중 12건만 걸린다. Self-Consistency·ToT 쪽은 매우 얇다(1건 이하). **체리 5~7개를 MECE로 짜려면 일부 축은 외부 자료가 필요하다.**

---

## 8. 판단을 위한 쟁점 (결정하지 않음)

1. **`FewShot`·`ZeroShot`을 `AdvancedPrompting` 밑으로 옮길까?** The Prompt Report는 둘 다 대분류에 넣었다. 다만 우리 Basics(`PromptEngineering`)에 더 어울릴 수도 있다.
2. **`LeastToMost`를 추가할까?** Decomposition 계열의 원전인데 빠져 있다. 추가하면 하위가 6개 대분류를 고르게 덮는다.
3. **ReAct 중복을 어떻게 정리할까?** `AdvancedPrompting > ReAct`와 `AgentArchitecture > ReflexiveAgent`가 같은 것을 가리킨다.
4. **체리 재료 부족을 어떻게 메울까?** 외부 논문을 `handbook.book`에 `WEB_URL` 타입으로 넣을 수 있다(스키마는 이미 지원).

---

## 출처

- [The Prompt Report: A Systematic Survey of Prompting Techniques (arXiv:2406.06608)](https://arxiv.org/html/2406.06608)
- [The Prompt Report — Insights (learnprompting.org)](https://learnprompting.org/blog/the_prompt_report)
- [Towards Better Chain-of-Thought Prompting Strategies: A Survey (arXiv:2310.04959)](https://arxiv.org/pdf/2310.04959)
- [Advancing Reasoning in Large Language Models (arXiv:2502.03671)](https://arxiv.org/pdf/2502.03671)
- [Self-Consistency Improves Chain of Thought Reasoning in Language Models](https://www.researchgate.net/publication/359390115_Self-Consistency_Improves_Chain_of_Thought_Reasoning_in_Language_Models)
