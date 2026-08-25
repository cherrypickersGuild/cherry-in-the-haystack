# 8. `AdversarialEvaluation` — 개념 설계 (신설 근거)

| | |
|---|---|
| 대상 메뉴 | `adversarial-eval` / "Adversarial Evaluation" |
| 1차 매핑 | `RedTeaming` — **임시로 붙인 것** |
| 판정 | ❌ **다른 개념이다. 신설한다.** |
| 조사일 | 2026-08-25 (2차) · 관련: `6-adversarial-evaluation.md`(주제 조사) |

---

## 0. 왜 이 문서가 따로 있나

1차 기획에서 나는 "둘이 90% 겹치니 신설하지 말자(D3-B)"고 했다. **근거가 없는 판단이었고, 내 자료조사가 정반대를 말하고 있었다.** `6-adversarial-evaluation.md` §2 에 이미 표까지 만들어 두 개념을 구분해 놓았다.

그 결과 `RedTeaming` 이라는 개념에 **"Adversarial Evaluation" 이라는 다른 개념의 이름을 붙이는** 상태가 됐다.

2차 조사에서 전용 논문 4편을 원문으로 확인했고, 다른 개념이라는 것이 분명해졌다.

---

## 1. 두 개념이 어떻게 다른가 — 원문 근거

### 1-A. 방법론이 다르다 ✅ *원문 확인*

*An End-to-End Overview of Red Teaming for Large Language Models* (ACL TrustNLP 2025)

```
Safety Evaluation / Benchmarking   고정된 테스트셋 · 미리 정한 기준으로 잰다
Red Teaming                        적응적·적대적으로 새 실패 모드를 찾아낸다
```

레드티밍 파이프라인 5단계를 제시하는데, **평가는 그중 한 단계**다.
```
Problem Formulation → Strategy Selection → Execution → Evaluation & Documentation → Remediation
```
평가 구성요소: **attack success metrics · severity · coverage · reproducibility**

> 즉 레드티밍은 활동 전체이고, 그 안에 "재는" 단계가 있다. 그 단계를 표준화한 것이 adversarial evaluation 이다.

### 1-B. 레드티밍은 측정을 대체하지 못한다 ✅ *원문 확인*

*Red Teaming AI Red Teaming* (arXiv:2507.05538)

원문은 레드티밍을 **"a team exercise" · "critical thinking methodology"** 로 규정하고, 던지는 질문이 다르다고 본다.

> *"What did we do, or not do, that could lead to failure under real-world conditions?"*

그리고 명시적으로 — 레드티밍은 성능 지표를 재는 **형식 테스트 체계(TEVV)와 짝을 이뤄야 하며, 그것을 대체하지 않는다.**

이 논문의 비판도 함께 기록해 둔다.
```
· 모델 수준 취약점에만 집중하고 사회기술적 시스템을 놓친다
· 합의된 범위·구조가 없어 "실질적 위험 완화보다 전시성 활동"이 되기도 한다
· 이미 만들어진 시스템을 나중에 시험한다 — 원래 취지(사전·선제)와 어긋난다
· 배포 전 어떤 테스트도 모든 문제를 예견할 수 없다
```

### 1-C. ⭐ 측정 쪽에는 고유한 난제가 있다 ✅ *원문 확인*

*Comparison requires valid measurement: Rethinking attack success rate comparisons in AI red teaming* (arXiv:2601.18076 · Chouldechova, Cooper 외)

**핵심 주장**
> *"conclusions drawn about relative system safety or attack method efficacy via AI red teaming are often not supported by evidence provided by attack success rate (ASR) comparisons."*

**왜 무효가 되나 — 두 가지**
```
① 개념적으로 비교 불가          "Top-1 (of 392)" 와 "one-shot" 을 비교하는 식.
                                 2년 생존율과 3년 생존율을 나란히 놓는 것과 같다
② 측정 타당도 실패              · 유해 프롬프트가 정작 명시된 정책을 위반하지 않는다 (content validity)
                                 · 심판 시스템의 참양성률이 대상 시스템마다 다르다
```

**유효한 비교의 2부 충족조건**
```
개념적 정합성   비교하려는 모집단 파라미터가 비교할 만한 것이어야 한다
측정 타당도     측정치가 재려는 것을 실제로 재야 한다
```

**측정이론 틀**
```
systematized concept   성공을 규정하는 형식적 위협 모델
operationalization     실제로 쓴 심판과 프롬프트
                       → 둘 사이의 체계적 간극이 문제의 원인
```

> ⭐ **이 논문이 신설 근거로 결정적이다.** "재는 것"에 고유한 이론적 문제가 있다는 것 자체가, 그것이 "찾는 것"과 별개의 활동임을 보여준다.

### 1-D. 무엇을 재느냐도 갈린다 ✅ *원문 확인*

*A red teaming roadmap towards system-level safety* (arXiv:2506.05376)

```
prompt-level    개별 LLM 응답의 취약점
system-level    배포 맥락 · 위협 탐지 · 사용자 관리까지
```
저자들은 **명확한 제품 안전 명세에 대한 테스트가 추상적 사회 편향·윤리 원칙보다 우선**해야 한다고 본다.

---

## 2. 경계 정의 (한 문장 · 원칙 1)

> **AdversarialEvaluation 은 고정된 적대적 테스트셋에 대해 로버스트니스를 측정한다. RedTeaming 은 새 실패 모드를 적응적으로 발굴한다. 발굴이 측정에 입력을 주고, 측정은 아직 발굴되지 않은 것을 볼 수 없다.**

---

## 3. 온톨로지 현황 — 붙일 자리

```
SafetyAndAlignment › AlignmentMethod
 └─ RedTeaming                          ← 1차 메뉴가 가리키던 곳 (안전 조치로 분류됨)
     ├─ Guardrails (RELATED·우리)
     ├─ PromptInjection (RELATED·우리)
     └─ SafetyGuard (RELATED·우리)

LLMConcept › EvaluationMetric            ← Basics 메뉴
 ├─ AutomaticMetric · BenchmarkDataset · Hallucination · HumanEvaluation
 ├─ ModelEvaluation · ModelSelection · ParameterCount · PerformanceMetric
 └─ RedTeaming (RELATED·우리가 1차에 억지로 놓은 다리)
```

⚠️ 1차에서 `RedTeaming --RELATED--> EvaluationMetric` 다리를 놓았는데, **그 자리는 `AdversarialEvaluation` 이 차지하는 게 맞다.** 레드티밍은 정렬 계열에 그대로 두고, 평가 계열에는 평가 개념이 들어가야 한다.

**설계**
```
AdversarialEvaluation  --SUBTOPIC-->  EvaluationMetric

하위 (3개)
  RedTeaming        RELATED   ← 찾는 활동이 테스트 케이스를 공급 (ACL 파이프라인)
  BenchmarkDataset  RELATED   ← HarmBench · JailbreakBench · StrongREJECT
  AutomaticMetric   RELATED   ← ASR 등 자동 지표

해제
  RedTeaming --RELATED--> EvaluationMetric   (AdversarialEvaluation 이 대신한다)
```

**별칭**: `Adversarial Testing`(SYNONYM) · `Safety Evaluation`(SYNONYM)
그리고 1차에 `RedTeaming` 에 잘못 붙인 별칭 **"Adversarial Evaluation" 을 뗀다** — 이제 신설 개념의 정식 이름이다.

---

## 4. 우리 DB 에 있는 재료 — **151건**

```
    68  benchmark          28  judge              26  adversarial
    22  robustness         19  red.?team          11  jailbreak
     7  LLM-as-a-judge      7  MAESTRO|OWASP       4  threat model
     4  stress test         1  ASR
```

**장별 분포**
```
  35  Building Apps › Ch.12 Protecting Agentic Systems   ← 공격·방어
  19  LLM Engineers Handbook › Ch.7 Evaluating LLMs      ← 심판·지표
  19  AI Engineering › Ch.4 Evaluate AI Systems          ← 평가 체계
  10  Building Apps › Ch.9  Validation and Measurement   ← 측정
   8  Building Apps › Ch.2  Designing Agent Systems
   8  Reflexion › (장없음)
```

⭐ **"재는 쪽" 재료가 실제로 있다.** LLM EH Ch.7 + AI Eng Ch.4 + Ch.9 = 48건이 평가·측정 쪽이고, Ch.12 35건이 공격 쪽이다. 두 축이 다 확보된다.

⚠️ `ASR` 은 1건뿐이다. §1-C 의 측정 타당도 논의는 **외부 자료가 필요**하다.

---

## 5. 체리 축 제안 (6축)

| # | 축 | 재료 |
|---|---|---|
| C1 | 일반 평가와 무엇이 다른가 | Building Apps Ch.9 *Validation and Measurement* |
| C2 | 위협을 체계적으로 훑는 법 — MAESTRO 7계층 | Ch.12 *Threat Modeling with MAESTRO* (7건) |
| C3 | 합성 적대 데이터로 스트레스 테스트 | Ch.12 *Red Teaming* — 모델이 이상·잡음·도메인 밖 입력을 만들어 낸다 |
| C4 | 심판을 믿을 수 있나 — LLM-as-a-judge | LLM EH Ch.7 · AI Eng Ch.4 (7건) |
| C5 | **비교가 대개 무효다 — ASR 를 나란히 놓으면 안 되는 이유** | 외부 · arXiv:2601.18076 |
| C6 | **로버스트니스는 모델 크기와 무관** (계열 내부 기준) | 외부 · HarmBench arXiv:2402.04249 |

C1~C4 는 책만으로 가능하다. C5·C6 이 외부다.

---

## 6. References 제안

| 단계 | 자료 | 링크 |
|---|---|---|
| START HERE | *Building Applications with AI Agents* Ch.12 "Protecting Agentic Systems" (소장 · 134문단) | ✗ 소장 |
| NEXT → | *LLM Engineers Handbook* Ch.7 "Evaluating LLMs" (소장 · 62문단) | ✗ 소장 |
| THEN → | HarmBench (arXiv:2402.04249) | ✅ |
| DEEP DIVE → | Comparison requires valid measurement (arXiv:2601.18076) | ✅ |

열리는 링크 2개 — 기준 충족.
> DEEP DIVE 를 이 논문으로 둔 이유: 앞 세 개가 "재는 법"을 가르친 뒤, 마지막이 **"그 숫자를 비교해도 되는가"** 를 되묻는다. 04 구획의 성격(앞의 것을 뒤집는 것)에 맞는다.

---

## 7. 검토 — 이 신설이 틀릴 수 있는 지점

| # | 의심 | 확인 결과 |
|---|---|---|
| Q1 | 그냥 `RedTeaming` 을 쓰면 안 되나? | ❌ arXiv:2507.05538 이 레드티밍은 형식 테스트(TEVV)의 **대체가 아니라 짝**이라고 명시한다 |
| Q2 | 의미가 90% 겹치지 않나? (1차 판단) | ❌ 근거 없는 주장이었다. 방법론·산출물·한계·이론적 난제가 전부 다르다 |
| Q3 | 하위가 3개 이상 나오나? | ✅ 3개 (RedTeaming · BenchmarkDataset · AutomaticMetric) — **최소선이다** |
| Q4 | `RedTeaming` 이 두 곳(AlignmentMethod · AdversarialEvaluation)에 걸리는데 괜찮나? | ✅ 실제로 양쪽에 걸치는 활동이다. `SUBTOPIC` 은 정렬 쪽 하나, 평가 쪽은 `RELATED` 로 둔다 |
| Q5 | `Hallucination` 도 넣어야 하나? | ❌ `6-adversarial-evaluation.md` §7 에 적었듯 환각은 **적대적 공격이 아니라 일반 실패 모드**다. 섞지 않는다 |
| Q6 | 별칭 `Safety Evaluation` 이 너무 넓지 않나? | ⚠️ 넓다. 다만 ACL 논문이 "Safety Evaluation/Benchmarking" 을 이 뜻으로 쓴다. 검색어로도 유용하다 |
| Q7 | 책 재료가 공격 쪽에 치우치지 않나? | 공격 43 · 평가 48 로 균형이 맞는다 |

---

## 8. ⚠️ 미확인 출처

| 자료 | 상태 |
|---|---|
| Chouldechova & Cooper, *AI Red Teaming Through the Lens of Measurement Theory* | **OpenReview 접근 차단**(브라우저 검증 페이지). 같은 저자의 arXiv:2601.18076 이 같은 내용을 담고 있어 **그쪽을 근거로 쓴다.** 이 논문 자체는 인용하지 않는다 |

---

## 출처

- ✅ [An End-to-End Overview of Red Teaming for Large Language Models (ACL TrustNLP 2025)](https://aclanthology.org/2025.trustnlp-main.23.pdf) — **원문 확인**
- ✅ [Comparison requires valid measurement: Rethinking ASR comparisons in AI red teaming (arXiv:2601.18076)](https://arxiv.org/html/2601.18076v1) — **원문 확인**
- ✅ [Red Teaming AI Red Teaming (arXiv:2507.05538)](https://arxiv.org/html/2507.05538v2) — **원문 확인**
- ✅ [A red teaming roadmap towards system-level safety (arXiv:2506.05376)](https://arxiv.org/abs/2506.05376) — **원문 확인**
- ✅ [HarmBench (arXiv:2402.04249)](https://arxiv.org/html/2402.04249v2) — 1차 조사분, 원문 확인
- 🔴 [AI Red Teaming Through the Lens of Measurement Theory (OpenReview)](https://openreview.net/pdf?id=KEggQCeDUA) — **접근 차단 · 인용하지 않음**
