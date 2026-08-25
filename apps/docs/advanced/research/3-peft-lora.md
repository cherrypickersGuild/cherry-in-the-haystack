# 3. PEFT / LoRA / QLoRA — 자료조사

| | |
|---|---|
| 사이드바 | `peft-lora` / 라벨 "PEFT / LoRA / QLoRA" |
| 현재 매핑 | `ParameterEfficientFinetuning` |
| 매핑 상태 | ⚠️ **개념은 맞으나 구조가 어긋남** — LoRA가 PEFT 밑에 없다 |
| 조사일 | 2026-08-25 |

---

## 0. 왜 이게 문제인가

온톨로지에서 **LoRA가 PEFT의 하위가 아니라 형제**로 되어 있다.

```
Finetuning
 ├─ LoRA                          ← PEFT 밑에 있어야 맞다
 │   └─ QuantizedLoRA
 ├─ ParameterEfficientFinetuning  ← 하위 0개
 ├─ InstructionTuning
 ├─ SupervisedFinetuning
 ├─ TaskSpecificFinetuning
 └─ TransferLearning
```

그래서 PEFT 페이지를 열면 **하위 개념이 하나도 안 나오고**, 검색어에도 `LoRA`·`QLoRA`가 안 들어가 후보 문단이 **0건**으로 나온다. 실제로는 책에 LoRA 16건·QLoRA 14건이 있는데도 그렇다.

**개념을 새로 만들 필요는 없다. 관계 1건만 옮기면 된다.**

---

## 1. 이게 무슨 주제인가

모델 전체를 다시 학습시키지 않고, **아주 작은 부품만 학습시켜 모델을 특정 용도에 맞추는** 기법군이다.

650억 파라미터 모델을 전부 학습시키려면 GPU 수십 장이 필요하지만, QLoRA는 **48GB GPU 한 장**으로 해낸다. 이 격차가 이 주제의 존재 이유다.

---

## 2. 학계 표준 분류 — PEFT Survey (arXiv:2403.14608)

가장 널리 인용되는 분류다. **4개 대분류**로 나눈다.

### ① Additive PEFT — 새 파라미터를 "덧붙인다"

| 하위 | 방법 |
|---|---|
| **Adapters** | Serial Adapter · AdapterFusion · Parallel Adapter (PA) · CIAT · CoDA · KronA |
| **Soft Prompt** | **Prefix-tuning** · P-tuning v2 · APT · **Prompt-tuning** · XPrompt · IDPG · LPT · SPT · APrompt · SPoT · TPT · InfoPrompt · PTP · DePT · SMoP · IPT |
| 기타 | (IA)³ · SSF · IPA |

### ② Selective PEFT — 기존 파라미터 중 "일부만" 고른다

| 하위 | 방법 |
|---|---|
| Unstructured Masking | Diff pruning · PaFi · FishMask · Fish-Dip · LT-SFT · SAM · Child-tuning |
| Structured Masking | FAR · **BitFit** · S-BitFit · Xattn Tuning · SPT |

### ③ Reparameterized PEFT — 저차원으로 "다시 표현한다" ⭐

| 하위 | 방법 |
|---|---|
| 저랭크 분해 | Intrinsic SAID · Compacter |
| **LoRA 계열** | **LoRA** · DyLoRA · **AdaLoRA** · SoRA · Laplace-LoRA · LoRA Dropout · LoRA+ · MoSLoRA · LoRAHub · MOELoRA · HiWi · VeRA · **DoRA** |

### ④ Hybrid PEFT — 위를 "섞는다"

```
UniPELT · S4 · MAM Adapter · LLM-Adapters · NOAH · AUTOPEFT
```

> **이 분류가 중요한 이유**: 우리 메뉴 이름이 "PEFT / LoRA / QLoRA"인데, 학계 기준으로 **LoRA는 ③ Reparameterized의 한 갈래**이고 **QLoRA는 LoRA의 변종**이다. 즉 메뉴 이름 자체가 이미 계층을 담고 있다.

---

## 3. 대표 원전

| 기법 | 논문 | 발표 | 핵심 |
|---|---|---|---|
| **LoRA** | Hu et al., *LoRA: Low-Rank Adaptation of Large Language Models* (arXiv:2106.09685) | 2021 · ⚠️ ICLR 2022 로 널리 인용되나 **arXiv 메타데이터에 학회 표기 없음** | ✅*원문확인* 원 가중치는 얼리고 저랭크 행렬만 학습. **GPT-3 175B 기준 학습 파라미터 10,000배 감소 · GPU 메모리 3배 감소**, 품질은 전체 파인튜닝과 동등하거나 더 나음 |
| **QLoRA** | Dettmers et al., *QLoRA: Efficient Finetuning of Quantized LLMs* (arXiv:2305.14314) | 2023 · arXiv comments 에 "Extended NeurIPS submission" | ✅*원문확인* **65B 를 48GB GPU 한 장에서** 파인튜닝하면서 16비트 성능 유지. 세 가지 기법 — **NF4**(정규분포 가중치에 정보이론적으로 최적인 4비트 데이터타입) · **double quantization**(양자화 상수까지 양자화) · **paged optimizers**(메모리 스파이크 관리). 산출 모델 Guanaco 는 **단일 GPU 24시간 학습으로 ChatGPT 성능의 99.3%** |
| **DoRA** | Liu et al., *DoRA: Weight-Decomposed Low-Rank Adaptation* (arXiv:2402.09353) | 2024 | 가중치를 크기·방향으로 분해, 방향에만 LoRA |
| Prefix-Tuning | Li & Liang | 2021 | 입력 앞에 학습 가능한 접두 토큰 |
| Adapter | Houlsby et al. | 2019 | 각 층에 작은 모듈 삽입 |
| 분류 체계 | *Parameter-Efficient Fine-Tuning for Large Models: A Comprehensive Survey* (arXiv:2403.14608) | 2024 | 위 4분류 |
| LoRA 전용 서베이 | *A Survey on LoRA of Large Language Models* (arXiv:2407.11046) | 2024 | LoRA 변종 총정리 |

---

## 4. 하위 개념 후보 (차일드 컨셉)

**이미 온톨로지에 있음 — 위치만 옮기면 됨**

```
LoRA               →  Finetuning 밑 → ParameterEfficientFinetuning 밑으로
QuantizedLoRA      →  이미 LoRA 밑 (그대로 두면 됨)
```

옮긴 뒤 모습:
```
Finetuning
 └─ ParameterEfficientFinetuning
     └─ LoRA
         └─ QuantizedLoRA
```

**신설 후보 (학계 4분류를 반영하려면)**

```
AdapterTuning        ① Additive — Adapter 계열
PrefixTuning         ① Additive — Soft Prompt 계열
SelectivePEFT        ② Selective (BitFit 등)
DoRA                 ③ Reparameterized — LoRA 변종
```

⚠️ 다만 4분류를 그대로 옮기면 **하위가 학술적으로 무거워진다.** 실무에서 실제로 쓰이는 건 LoRA·QLoRA·Adapter 정도다. **얼마나 깊이 갈지는 결정 사항.**

---

## 5. 인접 개념과의 경계

| 인접 | 경계 |
|---|---|
| `Finetuning` (Basics) | **Basics = 파인튜닝이 무엇이고 언제 하나.** **Advanced = 전체를 안 건드리고 하는 법.** 깔끔하게 갈린다 |
| `Quantization` | QLoRA는 양자화 + LoRA다. `Int4Quantization`·`Int8Quantization`이 온톨로지에 이미 있다 → **`QuantizedLoRA`와 RELATED로 이어야** |
| `RAG` | 책에도 나오는 고전 논쟁 — "파인튜닝할까 RAG 할까". 온톨로지에 `Finetuning --RELATED--> RAG`가 이미 있다 |
| `EfficientInference` | PEFT는 **학습** 쪽, EfficientInference는 **추론** 쪽. 다른 단계 |

---

## 6. 현재 온톨로지 상태

```
TrainingParadigm
 └─ Finetuning                          (Basics 메뉴)
     ├─ InstructionTuning
     ├─ LoRA                        ⚠️ 여기 있으면 안 됨
     │   └─ QuantizedLoRA
     ├─ ParameterEfficientFinetuning ⚠️ 하위 0개  (Advanced 메뉴)
     ├─ SupervisedFinetuning
     ├─ TaskSpecificFinetuning
     └─ TransferLearning

관련 개념 (별도 위치):
  Quantization · Int4Quantization · Int8Quantization · Distillation · EfficientInference
```

---

## 7. 우리 DB에 있는 재료

**도구 기준 26건** (관계 이동 + 별칭 `QLoRA`·`PEFT` 등록 후). 손수 고른 검색어 기준 합집합은 56건.
6개 항목 중 **재료 상태가 중간**이다.

```
  20  quantization
  16  LoRA
  14  QLoRA
   8  PEFT
   7  parameter-efficient
   7  adapter
   5  4-bit
   4  full fine-tuning
   2  catastrophic forgetting
   1  prompt tuning
   0  prefix tuning
```

**후보 문단 수 실측** — 검색어를 어디까지 넣느냐로 갈린다.

```
① 노드명만 (현재)                              0건
② + LoRA·QuantizedLoRA (관계 이동 시)         16건
③ + 별칭 QLoRA·PEFT                           26건
④ + parameter-efficient·adapter               35건
```

관계 1건을 옮기면 **0 → 16건**, 여기에 별칭(`QLoRA`·`PEFT`)까지 넣으면 **26건**이 된다. ⚠️ **`QuantizedLoRA`는 책에서 "QLoRA"로 쓰이므로, 관계 이동만으로는 QLoRA 14건이 안 잡힌다. 별칭 등록이 함께 필요하다.** 체리 5~7개에는 충분하다.

**MECE 축 제안**: ① 왜 필요한가(비용) ② 어떻게 작동하나(저랭크) ③ QLoRA의 양자화 ④ 전체 파인튜닝 대비 손실 ⑤ 언제 쓰면 안 되나 — 마지막 축은 `catastrophic forgetting` 2건이 재료다.

---

## 8. 판단을 위한 쟁점 (결정하지 않음)

1. **`LoRA`를 PEFT 밑으로 옮길 것인가?** — 학계 기준으로는 명백히 맞다. ⚠️ 다만 **Fine-tuning(Basics) 페이지에서 LoRA가 직접 하위로 안 보이고 한 단계 아래로 내려간다.**
2. **몇 단계까지 만들 것인가?** 4분류 전부(Additive/Selective/Reparameterized/Hybrid)를 넣을지, LoRA 계열만 둘지.
3. **`DoRA`를 추가할 것인가?** LoRA 후속으로 자주 인용된다.
4. **`QuantizedLoRA`와 `Int4Quantization`을 RELATED로 이을 것인가?** QLoRA의 핵심이 4비트 양자화다.

---

## 출처

- [Parameter-Efficient Fine-Tuning for Large Models: A Comprehensive Survey (arXiv:2403.14608)](https://arxiv.org/html/2403.14608v6)
- [A Survey on LoRA of Large Language Models (arXiv:2407.11046)](https://arxiv.org/pdf/2407.11046)
- [DoRA: Weight-Decomposed Low-Rank Adaptation (arXiv:2402.09353)](https://arxiv.org/pdf/2402.09353)
- [Parameter Efficient Fine Tuning — Adapters, LoRA, QLoRA 해설](https://medium.com/aimonks/parameter-efficient-fine-tuning-075954d1db51)
- [LLM Fine-Tuning on a Budget (RunPod)](https://www.runpod.io/articles/guides/llm-fine-tuning-on-a-budget-top-faqs-on-adapters-lora-and-other-parameter-efficient-methods)
- [KnowLA: Enhancing Parameter-efficient Finetuning (arXiv:2403.14950)](https://arxiv.org/pdf/2403.14950)
