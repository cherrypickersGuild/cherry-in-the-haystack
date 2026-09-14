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

---

## ⭐ 작성한 콘텐츠 (2026-08-25 · DB 반영 완료)

> 아래는 **DB 에서 다시 읽어온 실제 저장값**이다. 문서와 DB 가 어긋나지 않게 생성해 적었다.
> 저장 위치 — Overview: `content.concept_page.content_md` · 체리: `handbook.paragraph_concept_link.insight` · References: `content.concept_page.progressive_refs`
> 발행 상태: `is_published = false` (초안) — V5 원문 대조 검수 전이다.

### Overview (3문단)

```
Parameter-efficient fine-tuning adapts a large model by training a small set of new or selected parameters while the original weights stay frozen. One base model can then serve many tasks, because what you ship per task is a few megabytes rather than a new copy of the model.

Why it matters: the memory arithmetic of full fine-tuning rules it out on ordinary hardware. PEFT is what puts adaptation back within reach of a single GPU, and it is why swapping behaviour per customer or per task is an operational decision rather than a capital one.

The shape of the work: add small trainable modules (adapters, soft prompts), select a subset of existing parameters, or re-express the update in low rank (LoRA) — optionally on top of a quantised base (QLoRA). Then decide what you gave up relative to full fine-tuning, and whether fine-tuning was the right tool at all.
```

### 체리 5건

**1. The number that rules out full fine-tuning**  · primary
- 출처: *AI Engineering* › Chapter 7. Finetuning › Parameter-Efficient Finetuning  (원문 734자)
- `chunkId` `019e785e-8a27-7e49-b9c8-6e40ce5a1bf3`
- insight:
  > A 7B model in FP16 needs 14 GB just to hold the weights. Full fine-tuning with Adam adds gradients and optimizer states — 7B × 3 × 2 bytes = 42 GB — for 56 GB before activations are counted. Consumer GPUs carry 12–24 GB. That gap, not elegance, is why parameter-efficient methods exist.

**2. Freezing most layers is not enough**
- 출처: *AI Engineering* › Chapter 7. Finetuning › Parameter-Efficient Finetuning  (원문 583자)
- `chunkId` `019e785e-8a3a-7748-8cec-0a94fbb69784`
- insight:
  > Partial fine-tuning cuts memory but is parameter-inefficient: Houlsby et al. (2019) found that BERT-large needed roughly 25% of its parameters updated to approach full fine-tuning on GLUE. Training fewer layers is not the same as training fewer parameters well — which is the gap the LoRA family targets.

**3. Going below 16 bits**
- 출처: *AI Engineering* › Chapter 7. Finetuning › Quantization  (원문 1175자)
- `chunkId` `019e785e-8a24-74f7-bf69-ad0c462efc7a`
- insight:
  > Serving moved from FP32 to 16-bit and lower: LLM.int8() at 8 bits and QLoRA at 4 bits (Dettmers et al., 2022, 2023), Apple shipping a 2-bit/4-bit mixture averaging 3.5 bits per weight in 2024, NVIDIA's Blackwell adding 4-bit float inference. Below 8 bits the representation itself gets awkward — minifloats like FP8/FP4, or integer formats such as INT8/INT4.

**4. Combining models instead of retraining one**
- 출처: *AI Engineering* › Chapter 7. Finetuning › Model Merging and Multi-Task Finetuning  (원문 544자)
- `chunkId` `019e785e-8a32-78ad-99cf-b9707377eef1`
- insight:
  > Model merging aims for a single model worth more than its parts: if one model answers the first 60% of questions and another the last 60%, the merge might answer 80%. It is an alternative to multi-task fine-tuning that costs no training run at all.

**5. A use case people forget**
- 출처: *AI Engineering* › Chapter 7. Finetuning › Reasons Not to Finetune  (원문 630자)
- `chunkId` `019e785e-8a3d-7351-9e26-131e456cc930`
- insight:
  > Fine-tuning is also a bias-mitigation tool. If a base model keeps giving CEOs male names, fine-tuning on a dataset with many female CEOs pushes back. Garimella et al. (2022) reduced gender bias in BERT-like models by fine-tuning on text authored by women, and racial bias by fine-tuning on African authors — adaptation aimed at the model's defaults rather than at a task.

### References 4단계

| 단계 | 자료 | 링크 | 무엇을 가르치나 |
|---|---|---|---|
| START HERE | AI Engineering — Ch.7 "Finetuning" — Chip Huyen | 소장 도서(URL 없음) | When to fine-tune and when not to, the memory arithmetic behind the decision, and where PEFT and quantization fit. |
| NEXT → | LLM Engineers Handbook — Ch.5 "Supervised Fine-Tuning" | 소장 도서(URL 없음) | Fine-tuning as a pipeline — data filtering, deduplication, decontamination, batch size, packing, optimizers. |
| THEN → | LoRA: Low-Rank Adaptation of Large Language Models — Hu et al., 2021 | [열림](https://arxiv.org/abs/2106.09685) | The method itself: freeze the weights, learn two low-rank matrices. Reports 10,000x fewer trainable parameters and 3x less GPU memory on GPT-3 175B. |
| DEEP DIVE → | Parameter-Efficient Fine-Tuning for Large Models: A Comprehensive Survey | [열림](https://arxiv.org/html/2403.14608v6) | The full landscape in four families — additive, selective, reparameterized, hybrid — with roughly sixty named methods placed in it. |

열리는 링크 **2건** / 4건 — 기준(2건 이상) 충족
