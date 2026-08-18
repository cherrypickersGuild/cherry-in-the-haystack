# 온톨로지 갭 리포트 — 정의와 생성법

> 기준일: 2026-08-19 · 관련: `../1-work-guidelines.md` §3(목표 ②)·조건 C6 · `../2-implementation-guide.md` §2-A
> **이 폴더에서 사람이 쓰는 문서는 이 README 하나뿐이다.** `0-summary.md`와 `<slug>.md`는 **전부 생성물**이며 직접 수정하지 않는다.

---

## 1. 이게 왜 있나

Learning은 **화면·콘텐츠를 먼저 만들고 그 결과로 GraphDB를 채우는 역순**으로 진행한다(`1-work-guidelines.md` §0). 그러면 개념 페이지를 쓰는 과정에서 자연히 **"GraphDB에 이게 없네 / 이름이 다르네 / 이 관계가 빠졌네"** 가 드러난다.

그 발견을 사람 머릿속에 두면 사라진다. **개념 1개당 1장의 갭 문서로 남기는 것이 본 작업의 목표 ②** 이고, 12개가 쌓인 누적 요약이 Phase 4 역주입의 입력이 된다.

## 2. 원리 — 생성물이어야 하는 이유

```
[A] 개념 JSON (사람이 쓴 화면 정본)   [B] 라이브 GraphDB (현실)
                    ↓ 스크립트 대조
      [C] 갭 리포트(이 폴더)     [D] 역주입 TTL (Phase 4)
```

- 손으로 쓰면 JSON을 고칠 때마다 문서가 낡는다. 12개 × 검수 반복이면 **반드시 어긋나고**, 어긋난 명세로 공유 DB를 고치면 사고가 난다.
- **C와 D가 같은 로직에서 나오므로** 문서와 실행이 구조적으로 어긋날 수 없다.

## 3. 갭 유형

| 코드 | 무엇 | 보완 방법 | 실측 예(2026-08-19) |
|---|---|---|---|
| `MISSING_NODE` | 개념 자체가 GraphDB에 없음 | 노드 신설 | `Reranking` · `Contextual Retrieval` |
| `LABEL_ALIAS` | 있는데 이름이 다름 | 별칭 추가(또는 개명) | `Hybrid Search`→`HybridRetrieval` · `Embeddings`→`Embedding` · `Vector Databases`→`Vector Database` · `Chunking Strategies`→`Chunking` |
| `MISSING_RELATION` | 노드는 둘 다 있는데 연결이 없음 | 트리플 추가 | — |
| `RELATION_TYPE_GAP` | 관계 종류를 표현 못함(`rdfs:subClassOf`뿐) | 서술어 확장(Phase 5) | `PREREQUISITE`·`EXTENDS` 전부 |
| `HIERARCHY_MISMATCH` | 상위가 학습 관점과 다름 | 계층 재배치 검토 | `Embedding`의 상위가 `EmbeddingLayer` |
| `WEAK_DESCRIPTION` | 설명 없음/화면에 못 쓸 품질 | 설명 보강 | — |
| `DATA_QUALITY` | 중복 라벨 등 | 정리 | `Alignment`·`InferenceOptimization` 라벨 2개씩 |
| *(지표)* `COVERAGE` | 302개 중 화면이 참조하는 비율 | 다음 개념 선정 근거 | — |

## 4. ⭐ `제안` 칸 규칙 (사실과 판단을 섞지 않는다)

- **사실**: 기계가 확실히 아는 것. 예) "`Reranking` 라벨이 GraphDB에 없음."
- **제안(미확정)**: 그 다음 처리 방향. 예) "`RAG`의 하위로 신설 제안."
- 사람이 검토해 **`승인` / `반려` / `보류`** 로 표시한다.
- **승인된 제안만 Phase 4 역주입 입력이 된다.** 미검토 항목은 심지 않는다.
- 제안을 사실처럼 단정해 적지 않는다.

## 5. 생성

```bash
node scripts/learning/ontology-gap.cjs rag     # 개념 1개
node scripts/learning/ontology-gap.cjs         # 전체 + 0-summary 재계산
```
- 전제: 로컬 GraphDB 기동(`docker compose up -d graphdb` + 온톨로지 로드 — `../개념온톨로지-GraphDB-조사.md` §7-7).
- 대조 시 **`infer=false`**(직속만)를 쓴다 — 갈림길 G1 결정.

## 6. 언제 생성하나 — **화면 하나 = 갭 문서 하나**

개념 하나의 **완료 정의(DoD)**. 하나라도 빠지면 다음 개념으로 넘어가지 않는다.

1. `apps/web/public/learning/concepts/<slug>.json` 작성(4섹션·출처 전부)
2. 화면 렌더 확인(브라우저 실동작 1회)
3. **`<slug>.md` 생성**
4. **`0-summary.md` 재계산**
5. `제안` 검토 → 승인/반려 표시
6. `../4-progress-log.md`에 한 줄 기록

> ⚠️ **여러 개념을 몰아서 마지막에 한 번 생성하지 않는다.** 화면이 확정되는 시점의 갭이 기록되어야 판단 근거가 남는다.

## 7. 파일 규칙

- `0-summary.md` — 12개 누적 롤업 + 커버리지. 생성물.
- `<slug>.md` — 개념 1개당 1장. 생성물. 파일명은 개념 JSON의 `slug`와 일치.
- 모든 생성물 최상단에 `<!-- 생성물: 직접 수정 금지 (scripts/learning/ontology-gap.cjs) -->`.
- 검토 표시(`승인`/`반려`)만은 사람이 남기므로, 스크립트는 **기존 검토 표시를 보존**하고 갭 항목만 갱신한다.
