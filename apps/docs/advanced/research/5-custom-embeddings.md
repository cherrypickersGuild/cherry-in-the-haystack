# 5. Custom Embeddings — 자료조사

| | |
|---|---|
| 사이드바 | `custom-embeddings` / 라벨 "Custom Embeddings" |
| 현재 매핑 | `Embedding` |
| 매핑 상태 | ❌ **틀렸다** — Basics의 "Embeddings"와 **같은 개념**을 가리킨다 |
| 조사일 | 2026-08-25 |

---

## 0. 왜 이게 문제인가

```
Basics   embeddings          →  Embedding
Advanced custom-embeddings   →  Embedding   ← 똑같다
```

두 메뉴가 **같은 페이지를 연다.** 리서처 JSON 검증에서도 경고(V9)로 잡힌다.
온톨로지에 `CustomEmbedding` 같은 개념이 없어서 상위 개념에 붙인 것이다.

---

## 1. 이게 무슨 주제인가

**남이 만든 범용 임베딩 모델을 내 도메인에 맞게 다시 학습시키는 것**이다.

범용 모델(OpenAI·E5·BGE 등)은 일반 문장은 잘 다루지만, **법률·의료·사내 문서처럼 좁은 도메인에서는 미묘한 차이를 놓친다.** 조사한 논문의 표현으로는, E5 같은 강한 모델도 도메인 특유의 뉘앙스를 놓쳐 중요한 문서의 표현이 열등해진다.

Basics의 "Embeddings"가 **임베딩이 무엇인가**라면, 여기는 **내 것으로 만드는 법**이다.

---

## 2. 학계·업계 표준 기법

### 2-A. 학습 방법

| 기법 | 내용 |
|---|---|
| **Contrastive fine-tuning** | 맞는 쌍은 가깝게, 틀린 쌍은 멀게. 임베딩 튜닝의 기본 골격 |
| **In-batch negatives** | 배치 안의 다른 샘플을 자동으로 오답으로 씀 |
| **Hard negative mining** ⭐ | **의미상 가깝지만 실제로는 틀린** 것을 오답으로 씀. **품질을 가르는 가장 큰 요인** |
| **Cross-encoder distillation** | 정확하지만 느린 cross-encoder를 교사로 삼아 빠른 bi-encoder에 지식 전달. ✅*원문확인* arXiv:2505.19274 는 한 발 더 나아가 **"fine-tuning using the conventional InfoNCE contrastive loss often reduces effectiveness in state-of-the-art models"** 라고 보고한다 — **최신 모델에서는 대조학습이 오히려 성능을 떨어뜨릴 수 있고, listwise distillation 이 더 일관되게 개선**된다 |
| **Adapter 기반 도메인 적응** | 전체 재학습 없이 어댑터만 (arXiv:2307.03104) |

### 2-B. ⚠️ Hard negative 의 함정 — 이 주제의 핵심 반전

조사에서 나온 가장 중요한 발견이다.

> **질의와 가장 유사한 문단의 약 70%가 사실은 정답으로 라벨링돼야 할 것들이었다.**
>
> ⚠️ **출처 정정(원문 확인)**: 이 수치의 **원 출처는 Qu et al. 2020, MS-Marco 데이터셋 실험**이다. NV-Retriever(arXiv:2407.15831)는 이를 **인용**하며 자기 기법의 동기로 삼는다. 체리에 쓸 때 **NV-Retriever 의 발견이라고 적으면 잘못된 귀속**이 된다.

즉 **"가장 비슷한 걸 오답으로 쓰면" 대부분 진짜 정답을 오답으로 가르치게 된다.** 이걸 false negative 문제라 한다.

해법 두 가지가 나왔다.
- **Positive-aware mining** — 정답 유사도 점수를 고려해 false negative를 걸러냄 (NV-Retriever)
- **Semi-hard negatives** — 너무 가까운 것 말고 **적당히 가까운 것**을 씀. 너무 가까우면 노이즈가 되어 성능이 오히려 떨어진다

### 2-C. Matryoshka Representation Learning (MRL) ✅ *원문 확인*

**하나의 벡터를 앞에서부터 잘라 써도 성능이 크게 안 떨어지도록** 학습하는 방법이다. 원문 표현으로는 *"encoding information at different granularities"*.

원 논문(Kusupati et al., arXiv:2205.13147)의 수치:
```
ImageNet-1K 분류    임베딩 크기 14배 축소하고도 정확도 유지
대규모 검색         ImageNet-1K/4K 에서 실측 14배 속도 향상
롱테일 few-shot     정확도 +2%
추론·배포 시 추가 비용 없음
```
Sentence Transformers에서는 기본 손실(`MultipleNegativesRankingLoss`)을 `MatryoshkaLoss`로 감싸 구현한다.

⚠️ **주의**: 위 14배는 **비전(ImageNet)** 결과다. 텍스트 임베딩에 그대로 옮기면 안 된다.

### 2-D. 평가 — MTEB ✅ *원문 확인 · ⚠️ 수치 정정됨*

> ⚠️ **2차 검토 정정**: 이전 판은 "7개 과제"라고 적었다. 원문(arXiv:2406.01607) 확인 결과 **8개**이며 `Bitext mining` 이 빠져 있었다.

```
Massive Text Embedding Benchmark — 영어 56개 데이터셋 · 8개 과제
  Bitext mining · Classification · Clustering · Pair classification
  Reranking · Retrieval · Semantic Textual Similarity · Summarization
```

**같은 리뷰가 정리한 상위 모델의 학습 기법** ✅ *원문 확인*
```
데이터 쪽   다단계 대조학습 · 품질 필터링 · hard negative mining · instruction 기반 튜닝
손실 쪽     angle optimization(코사인의 그래디언트 소실 대응) · Matryoshka 중첩 표현
            · cross-encoder 교사로부터의 지식 증류
LLM 활용    디코더 전용 모델의 양방향 어텐션 · 합성 데이터 생성 · LoRA
```

---

## 3. 대표 원전

| 주제 | 논문 |
|---|---|
| Hard negative mining | *NV-Retriever: Improving text embedding models with effective hard-negative mining* (arXiv:2407.15831) |
| LLM 기반 임베딩 학습 | *NV-Embed: Improved Techniques for Training LLMs as Generalist Embedding Models* (arXiv:2405.17428) |
| MTEB 상위 기법 리뷰 | *Recent Advances in Text Embedding: A Comprehensive Review of Top-Performing Methods on the MTEB Benchmark* (arXiv:2406.01607) |
| Matryoshka 튜닝 | *Matryoshka-Adaptor: Unsupervised and Supervised Tuning for Smaller Embedding Dimensions* (arXiv:2407.20243) |
| 어댑터 도메인 적응 | *Efficient Domain Adaptation of Sentence Embeddings Using Adapters* (arXiv:2307.03104) |
| Cross-encoder 증류 | *Conventional Contrastive Learning Often Falls Short* (arXiv:2505.19274) |
| 도메인 적용 사례 | *EnterpriseEM: Fine-tuned Embeddings for Enterprise Semantic Search* (arXiv:2406.00010) |
| 생물 도메인 사례 | *Contrastive learning and mixture of experts enables precise vector embeddings in biological databases* (PMC12041245) |

---

## 4. 하위 개념 후보 (차일드 컨셉)

**신설 후보**

```
CustomEmbedding          (상위: Embedding)  — 이 메뉴의 주인공
ContrastiveLearning      학습 골격
HardNegativeMining       품질을 가르는 핵심
MatryoshkaEmbedding      차원 절감
BiEncoder / CrossEncoder 구조 구분
EmbeddingEvaluation      MTEB 등
```

**이미 있어서 연결하면 되는 것**

```
SemanticRepresentation   현재 Embedding 유일 하위
VectorDatabase           RELATED
Chunking                 RELATED
Finetuning               ← CustomEmbedding 과 RELATED 로 이어야 자연스럽다
```

---

## 5. 인접 개념과의 경계

| 인접 | 경계 |
|---|---|
| `Embedding` (Basics) | **Basics = 임베딩이 무엇이고 왜 쓰나.** **Advanced = 내 도메인에 맞게 다시 학습시키는 법.** 명확히 갈린다 |
| `Finetuning` | 임베딩 모델 파인튜닝은 파인튜닝의 한 종류다. **RELATED로 잇는 게 맞다** |
| `RAG` | 검색 품질을 올리는 수단이라 RAG와 강하게 붙어 있다. 온톨로지에 `Embedding --PREREQUISITE--> RAG`가 이미 있다 |
| `Reranking` | Cross-encoder는 리랭킹에도 쓰인다. **겹친다** — cross-encoder를 어디에 둘지 정해야 함 |

---

## 6. 현재 온톨로지 상태

```
EmbeddingLayer
 └─ Embedding                     ← Basics·Advanced 두 메뉴가 모두 가리킴
     ├─ SemanticRepresentation
     ├─ Chunking (RELATED)
     └─ VectorDatabase (RELATED)
     (Embedding --PREREQUISITE--> RAG)

관련:
  TokenEmbedding · PositionEmbedding · EncoderOnly · EncoderDecoder
  Tokenization · SemanticMemory · VectorMemory
```

⚠️ **`Embedding` 하위가 사실상 1개(SemanticRepresentation)뿐이다.** 자리가 넉넉해서 신설해도 겹칠 걱정이 적다.

---

## 7. 우리 DB에 있는 재료

🔴 **도구 기준 1건.** 6개 항목 중 압도적으로 부족하며, **소장 도서만으로는 이 페이지를 만들 수 없다.**

**주제에 실제로 맞는 문단을 따로 찾아본 결과 (2차 검토)**
```
   0  contrastive (아무 형태)           ← 대조학습이 책에 한 번도 안 나온다
   0  domain-specific + embedding
   1  hard negative / negative sampling
   1  MTEB
   2  train* + embedding model 동시
   9  fine-tune* + embedding 동시       ← 사실상 이게 전부
   9  sentence-transformer
```
`fine-tune*+embedding` 9건의 위치: LLM EH Ch.4(3) · AI Eng Ch.7(2) · LLM EH Ch.1(2) · Building Apps Ch.11(1)

**손수 고른 넉넉한 검색어로는 27건**이 나오지만, 그 내역은 아래처럼 **주제와 무관한 일반 용어**가 대부분이다.

```
  11  embedding model
   7  dimension
   7  cosine similarity
   3  cross-encoder
   1  bi-encoder
   1  MTEB
   0  contrastive · hard negative · sentence transformer · matryoshka
   0  fine-tune the embedding
```

**핵심 개념(contrastive learning · hard negative mining · Matryoshka)이 책에 아예 없다.** Multi-hop RAG와 함께 **외부 자료가 반드시 필요한 항목**이다.

---

## 8. 판단을 위한 쟁점 (결정하지 않음)

1. **`CustomEmbedding`을 신설할 것인가?** 안 하면 Basics와 계속 같은 페이지다. 신설이 가장 자연스러운 해결이다.
2. **아니면 이 메뉴를 없앨 것인가?** PRD가 정한 6개 중 하나라 뺄 수 없다면 신설이 유일한 길이다.
3. **하위를 어디까지 만들 것인가?** `HardNegativeMining` 하나만으로도 좋은 체리 주제가 나온다(70% false negative 반전).
4. **Cross-encoder를 어디에 둘 것인가?** 임베딩 밑인가, `Reranking` 밑인가.
5. **외부 자료를 넣을 것인가?** NV-Retriever·MTEB 리뷰 논문이 1순위. `handbook.book.source_type`의 `WEB_URL`로 **스키마 변경 없이** 가능하다.

---

## 출처

- [NV-Retriever: Improving text embedding models with effective hard-negative mining (arXiv:2407.15831)](https://arxiv.org/html/2407.15831v1)
- [NV-Embed: Improved Techniques for Training LLMs as Generalist Embedding Models (arXiv:2405.17428)](https://arxiv.org/pdf/2405.17428)
- [Recent Advances in Text Embedding: Top-Performing Methods on MTEB (arXiv:2406.01607)](https://arxiv.org/html/2406.01607v1)
- [Matryoshka-Adaptor (arXiv:2407.20243)](https://arxiv.org/pdf/2407.20243)
- [Efficient Domain Adaptation of Sentence Embeddings Using Adapters (arXiv:2307.03104)](https://arxiv.org/pdf/2307.03104)
- [Conventional Contrastive Learning Often Falls Short (arXiv:2505.19274)](https://arxiv.org/pdf/2505.19274)
- [EnterpriseEM: Fine-tuned Embeddings for Enterprise Semantic Search (arXiv:2406.00010)](https://arxiv.org/pdf/2406.00010)
- [Contrastive learning and mixture of experts in biological databases (PMC12041245)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12041245/)
- [Matryoshka Representation Learning 원 논문 (arXiv:2205.13147)](https://arxiv.org/abs/2205.13147)
- [Fine-Tuning Embedding Models with Matryoshka Representation Learning](https://medium.com/@diegoprayudha1/fine-tuning-embedding-models-with-matryoshka-representation-learning-de7d4680b011)
- [The Best Open-Source Embedding Models in 2026 (BentoML)](https://www.bentoml.com/blog/a-guide-to-open-source-embedding-models)
