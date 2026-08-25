# 6. Adversarial Evaluation — 자료조사

| | |
|---|---|
| 사이드바 | `adversarial-eval` / 라벨 "Adversarial Evaluation" |
| 현재 매핑 | `RedTeaming` |
| 매핑 상태 | ⚠️ **개념은 있으나 위치가 어긋남** — 평가가 아니라 정렬(Alignment) 밑에 있다 |
| 조사일 | 2026-08-25 |

---

## 0. 왜 이게 문제인가

```
SafetyAndAlignment
 └─ AlignmentMethod
     ├─ PreferenceAlignment
     ├─ RedTeaming          ← Advanced 메뉴가 가리킴
     ├─ SafetyAlignment
     └─ ValueAlignment
```

메뉴는 **"평가"**인데 개념은 **"안전 조치"** 밑에 있다. `EvaluationMetric`(Basics 메뉴)과 연결이 전혀 없다.

---

## 1. 이게 무슨 주제인가

**일부러 공격해서 모델이 어디서 무너지는지 재는 것**이다.

일반 평가는 "정상 입력에 얼마나 잘하나"를 잰다. 여기는 **"적대적 입력에 얼마나 안 무너지나"**를 잰다. 다른 축이다.

---

## 2. Red Teaming 과 Adversarial Evaluation 은 같은가 — ⚠️ 중요

조사 결과 **완전히 같지는 않다.** 목적은 같지만 강조점이 다르다.

| | Red Teaming | Adversarial Evaluation |
|---|---|---|
| 성격 | **찾는 활동** (탐색) | **재는 활동** (측정) |
| 방식 | 사람이 창의적으로 공격을 궁리하거나 자동 에이전트가 탐색 | 표준화된 벤치마크로 점수를 냄 |
| 산출 | 취약점 목록 | 공격 성공률(ASR) 등 지표 |
| 한계 | 탐색 공간이 커서 자원 소모가 큼 | 벤치마크에 없는 공격은 못 잡음 |

실무에서는 **red teaming으로 찾고 → 벤치마크로 잰다.** 순환 관계다.

> 이 구분 자체가 좋은 체리 주제다. 온톨로지에서 `RedTeaming`을 그대로 쓸지, `AdversarialEvaluation`을 따로 둘지 판단의 근거이기도 하다.

---

## 3. 학계 표준 — 벤치마크와 프레임워크

| 이름 | 내용 |
|---|---|
| **HarmBench** | 자동 red teaming 표준 평가 프레임워크. **12편 논문의 18개 기법 × 33개 LLM(오픈 24 · 클로즈드 9) × 유해행동 510건** 비교 (원문 확인) |
| **JailbreakBench** | 공개 로버스트니스 벤치마크. 정책 위반 행동 **100개** 큐레이션 + 표준 위협모델·채점 |
| **StrongREJECT** | 유해 프롬프트 데이터셋 + **사람 수준 일치도**의 자동 평가기 |
| **AdvBench** | 초기 표준 적대적 예제 벤치마크 |
| **JALMBench** | 음성(Audio) LM 대상 jailbreak 벤치마크 (ICLR 2026) |
| **MultiBreak** | 다중 턴 jailbreak 벤치마크 |
| **CLEAR-Bias · LlamaGuard** | 구조화된 분류체계 + 자동 채점 |

**평가 방식 4종**: 사람 라벨링 · 규칙 기반 분류기 · 신경망 분류기 · **LLM-as-a-judge**

---

## 4. 공격 기법 분류

HarmBench가 비교한 기법들이다.

| 계열 | 기법 | 설명 |
|---|---|---|
| **White-box 최적화** | **GCG** (Greedy Coordinate Gradient) · GCG-Multi · GCG-Transfer | ✅*원문확인* **greedy + gradient 탐색의 조합**으로 접미사를 자동 생성. Vicuna-7B/13B 에서 학습한 접미사가 **ChatGPT·Bard·Claude·LLaMA-2-Chat·Pythia·Falcon 으로 전이**됐다. Zou et al., arXiv:2307.15043 |
| | PEZ · GBDA · UAT · AutoPrompt | 토큰 최적화 계열 |
| **Black-box 반복** | **PAIR** = *Prompt Automatic Iterative Refinement* | 공격자 LLM이 후보 프롬프트를 만들고 → 심판 모델이 성공 여부를 판정 → 그 피드백으로 공격자가 다시 다듬는다. **20회 미만 질의**로 탈옥에 이르는 경우가 많다. Chao et al., *Jailbreaking Black Box LLMs in Twenty Queries* (arXiv:2310.08419) |
| | **TAP** (Tree of Attacks with Pruning) | 트리 탐색으로 공격 프롬프트 생성 (arXiv:2312.02119) |
| **진화 알고리즘** | **AutoDAN** | ✅*원문확인* **계층적 유전 알고리즘**(hierarchical genetic algorithm). GCG 계열의 약점인 **의미 없는 토큰열 → perplexity 검사로 탐지됨** 을 겨냥해, **의미가 통하는** 프롬프트를 만든다. ICLR 2024, arXiv:2310.04451 |
| **설득 기반** | **PAP** | 설득 기법 적용 |
| **사람** | Human Jailbreaks | 사람이 직접 만든 탈옥 프롬프트 |
| **기준선** | Direct Request | 그냥 물어보기 |

**최근 연구**: Auto-RT(자동 전략 탐색) · CHASE(RL 기반 red-blue 팀) · AutoRed(자유형 프롬프트 생성) · Red-Bandit(bandit 기반 LoRA 전문가)

---

## 5. 조사에서 나온 핵심 사실 — 체리 소재

**① 모델 크기와 로버스트니스는 무관하다** ✅ *원문 확인*
> HarmBench 원문: **"we find no correlation between robustness and model size within model families in our results."**
> 7B~70B, 6개 모델 계열에 걸친 결과이며, 저자들은 차이를 **파라미터 수가 아니라 학습 절차·데이터**에서 찾는다.
> ⚠️ 조건: **모델 계열 *내부*(within model families)**에서의 무상관이다. 계열을 넘나드는 비교로 확대 해석하면 안 된다.

**② 어떤 방어도 모든 공격을 막지 못한다**
> 가장 강한 5개 red teaming 기법이 **각각 사각지대를 갖는다.** 모든 공격을 막아내는 모델은 없었다.

**③ 다중 턴이 훨씬 강력하다** ✅ *원문 확인 · ⚠️ 수치 정정됨*

> ⚠️ **2차 검토 정정**: 이전 판에 적었던 `다중 턴 7.89~88.30% vs 단일 턴 2.19~64.91%` 는 **원문에 없는 수치**였다(검색 요약을 그대로 옮긴 것). 원문(MultiBreak, arXiv:2605.01687)의 실제 보고값은 아래와 같다.

```
피해 모델 5종 기준 (Table 2)
  ASR@1    26.6% ~ 83.3%
  ASR@5    66.5% ~ 95.7%
  ASR@10   77.9% ~ 96.8%

단일 턴 대비 (Figure 7)
  단일 턴 ASR 이 가장 낮았던 범주에서, 6턴 대화로 확장하자 최대 +44.8%p 개선
```
평가 규모: 유해 의도 **2,665건** · 다중 턴 프롬프트 **10,389개** · 안전 범주 **26개**
피해 모델: DeepSeek-R1-7B · Qwen3-8B · LLaMA3.1-8B · Gemini-2.5-flash-lite · GPT-4.1-mini
심판: LLaMA Guard · GPT-4o-mini

**④ 적응형 공격자는 사실상 100%를 뚫는다** ✅ *원문 확인*

> Andriushchenko et al., *Jailbreaking Leading Safety-Aligned LLMs with Simple Adaptive Attacks* (arXiv:2404.02151, **ICLR 2025**)
> 원문: **"we achieve 100% attack success rate — according to GPT-4 as a judge — on Vicuna-13B, Mistral-7B, Phi-3-Mini, Nemotron-4-340B, Llama-2-Chat-7B/13B/70B, Llama-3-Instruct-8B, Gemma-7B, GPT-3.5, GPT-4o, and R2D2."**

**방법**: 적대적 프롬프트 템플릿 + 접미사에 대한 **random search** 로 목표 토큰("Sure")의 logprob 을 최대화. 재시작 다수.
**Claude 계열**은 logprob 을 공개하지 않으므로 **transfer 또는 prefilling 공격**으로 100% 달성.
**핵심 교훈**: 저자들이 강조하는 것은 성공률이 아니라 **"adaptivity is crucial"** — 모델마다 통하는 템플릿이 다르고, API 특성(Claude 의 prefilling)마다 고유한 취약점이 있다.
⚠️ 조건: 판정자가 **GPT-4 as a judge** 다. 심판이 바뀌면 수치도 바뀐다(위 ⑤와 연결).

**⑤ 심판(judge) 자체가 신뢰할 수 있는가**
> *How Reliable Is Your Jailbreak Judge?* (arXiv:2606.25487) — 자동 ASR 채점기의 보정과 적대적 로버스트니스를 문제 삼는다. **재는 도구를 재는** 층위.

---

## 6. 하위 개념 후보 (차일드 컨셉)

**신설 후보**

```
AdversarialEvaluation    (상위 후보: EvaluationMetric)
JailbreakAttack          공격 계열 묶음
AttackSuccessRate        핵심 지표
AdversarialRobustness    방어 쪽 성질
MultiTurnAttack          위 ③이 근거
```

**이미 있어서 연결하면 되는 것**

```
RedTeaming          현재 AlignmentMethod 밑
PromptInjection     이미 존재 (AdvancedPrompting 인접)
Guardrails · SafetyGuard · SafetyTechnique · SafetyAlignment
BenchmarkDataset · ModelEvaluation · HumanEvaluation · AutomaticMetric
Hallucination
```

⚠️ **관련 개념이 이미 23개나 있다.** 6개 항목 중 재료가 되는 개념이 가장 많다. **신설보다 연결 정리가 더 급하다.**

---

## 7. 인접 개념과의 경계

| 인접 | 경계 |
|---|---|
| `EvaluationMetric` (Basics) | **Basics = 정상 입력에서 얼마나 잘하나.** **Advanced = 적대적 입력에서 얼마나 안 무너지나.** 명확하다 |
| `AlignmentMethod` | RedTeaming은 **정렬을 위한 수단**이면서 **평가 활동**이다. 양쪽에 걸친다 → **RELATED 두 방향이 필요할 수 있다** |
| `PromptInjection` | 공격 기법의 하나. 이미 온톨로지에 있으나 RedTeaming과 연결 없음 |
| `Guardrails` · `SafetyGuard` | **방어** 쪽. 평가와 짝을 이룬다 |
| `Hallucination` | 환각은 적대적 공격이 아닌 **일반 실패 모드**다. 섞으면 안 된다 |

---

## 8. 현재 온톨로지 상태

```
SafetyAndAlignment
 └─ AlignmentMethod
     ├─ PreferenceAlignment
     ├─ RedTeaming              ← Advanced 메뉴
     ├─ SafetyAlignment
     └─ ValueAlignment

LLMConcept
 └─ EvaluationMetric            ← Basics 메뉴
     ├─ AutomaticMetric
     ├─ BenchmarkDataset
     ├─ Hallucination
     ├─ HumanEvaluation
     ├─ ModelEvaluation
     ├─ ModelSelection
     ├─ ParameterCount
     └─ PerformanceMetric

떠 있음: Guardrails · SafetyGuard · SafetyTechnique · PromptInjection · Alignment
```

**두 갈래가 완전히 분리돼 있고 사이에 다리가 없다.**

---

## 9. 우리 DB에 있는 재료

**도구 기준 57건** (별칭 등록 + `PromptInjection`·`Guardrails`·`SafetyGuard` 연결 후). 손수 고른 검색어 기준 합집합은 100건.
재료 상태는 **중상**이다.

```
  32  benchmark
  26  adversarial
  25  robustness
  11  prompt injection
   7  LLM-as-a-judge
   5  red team
   3  jailbreak · guardrail
   2  red-teaming
   0  attack success · safety evaluation
```

**MECE 축 제안**: ① 일반 평가와 뭐가 다른가 ② 공격 계열(최적화·반복·진화) ③ 표준 벤치마크 ④ 심판을 믿을 수 있나 ⑤ 크기가 커도 안 안전하다

책 재료로 ①②③⑤는 되고, ④는 얇다.

---

## 10. 판단을 위한 쟁점 (결정하지 않음)

1. **A안 — `AdversarialEvaluation`을 신설**해 `EvaluationMetric` 밑에 두고 `RedTeaming`과 RELATED로 잇는다. 메뉴 의미와 맞다.
2. **B안 — 신설 없이 `RedTeaming --RELATED--> EvaluationMetric` 만 추가**한다. 간단하지만 메뉴 이름과 개념 이름이 계속 다르다.
3. **`PromptInjection`을 어디에 이을 것인가?** 지금 어디에도 안 붙어 있다. 공격 기법으로 이으면 하위가 풍성해진다.
4. **`Guardrails`·`SafetyGuard`를 방어 쪽으로 묶을 것인가?** 평가와 짝이라 페이지에 같이 나오면 좋다.

---

## 출처

- [HarmBench: A Standardized Evaluation Framework for Automated Red Teaming and Robust Refusal (arXiv:2402.04249)](https://arxiv.org/html/2402.04249v2)
- [HarmBench GitHub (Center for AI Safety)](https://github.com/centerforaisafety/HarmBench)
- [JailbreakBench: An Open Robustness Benchmark (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/63092d79154adebd7305dfd498cbff70-Paper-Datasets_and_Benchmarks_Track.pdf)
- [Tree of Attacks: Jailbreaking Black-Box LLMs Automatically (arXiv:2312.02119)](https://arxiv.org/pdf/2312.02119)
- [PAIR — Jailbreaking Black Box Large Language Models in Twenty Queries (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419)
- [GCG — Universal and Transferable Adversarial Attacks on Aligned Language Models (arXiv:2307.15043)](https://arxiv.org/abs/2307.15043)
- [AutoDAN — Generating Stealthy Jailbreak Prompts (arXiv:2310.04451, ICLR 2024)](https://arxiv.org/abs/2310.04451)
- [Jailbreaking Leading Safety-Aligned LLMs with Simple Adaptive Attacks (arXiv:2404.02151, ICLR 2025)](https://arxiv.org/abs/2404.02151)
- [Auto-RT: Automatic Jailbreak Strategy Exploration (arXiv:2501.01830)](https://arxiv.org/html/2501.01830)
- [JALMBench (ICLR 2026)](https://openreview.net/pdf?id=DJkQ236C8B)
- [MultiBreak: Multi-turn Jailbreak Benchmark (arXiv:2605.01687)](https://arxiv.org/html/2605.01687v1)
- [How Reliable Is Your Jailbreak Judge? (arXiv:2606.25487)](https://arxiv.org/pdf/2606.25487)
- [CHASE: Adversarial Red-Blue Teaming for Improving LLM Safety (arXiv:2606.05523)](https://arxiv.org/pdf/2606.05523)
- [Red-Teaming Large Language Models (Hugging Face)](https://huggingface.co/blog/red-teaming)
- [LLM red teaming guide (Promptfoo)](https://www.promptfoo.dev/docs/red-team/)
