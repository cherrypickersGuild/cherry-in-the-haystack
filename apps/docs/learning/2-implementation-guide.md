# Learning 구현 — 구현 가이드 (레이아웃 + 단계)

> **2026-08-19 개정 — 역순(화면·콘텐츠 우선 → DB 역주입) 기준으로 Phase 재작성.** 방향·조건은 `1-work-guidelines.md` §0.
> 레이아웃은 **Concept Reader(`concept-reader-page.tsx`) 화면을 정본**으로 삼는다(재발명 금지).

---

## 1. 레이아웃 정본 — Concept Reader 화면 분해

**전체: 2열 구조**(`flex lg:flex-row`). 왼쪽 = 리딩 컬럼(max 700px), 오른쪽 = 사이드 패널(280px, 모바일에선 아래로).

### 1-A. 왼쪽 리딩 컬럼 (개념 본문 = 4섹션)
| 요소 | UI (현재 코드) | **JSON 필드(정본)** |
|---|---|---|
| 섹션 배지 | `Basics`/`Advanced` violet pill | `section` |
| 제목 + `Buy on Market` 버튼 | H1 개념명 + cherry 버튼(→ KaaS 마켓) | `title` · `slug` |
| 메타 행 | Updated · N sources · verified · N min read | `meta.*` |
| **01 Overview** | 산문 3문단(`prose`) | `overview.definition` · `.whyItMatters` · `.context` |
| **02 Cherries** | 카드 리스트(🍒 source + body, cherry 좌측 보더) | `cherries[]` |
| **03 Child Concepts** | 2열 카드 그리드(관계 배지[색] + label + desc) | `childConcepts[]` |
| **04 Progressive References** | 타임라인(START HERE/NEXT/THEN/DEEP DIVE) | `references[]` |

### 1-B. 오른쪽 사이드 패널
| 카드 | UI | 데이터 |
|---|---|---|
| **Learning Roadmap** | SVG(현재 개념 + Prerequisites + Advanced) + 범례 | `childConcepts[]`의 relation으로 생성 |
| **New in Digest** | 관련 신규 항목 | ND 매칭 — **후순위(Phase 6)** |
| **Knowledge Team** | 기여자 아바타 | `meta.contributors` |

---

## 2. ⭐ 콘텐츠 JSON 스키마 (역순의 핵심 산출물)

**위치**: `apps/web/public/learning/concepts/<slug>.json` + 목록 `apps/web/public/learning/index.json`
**원칙**: 모든 필드가 `1-work-guidelines.md` §0-B의 목적지를 갖는다. 컴포넌트 하드코딩 금지(C1).

```jsonc
{
  "slug": "rag",
  "section": "BASICS",                    // BASICS | ADVANCED
  "title": "Retrieval-Augmented Generation (RAG)",   // 페이지 H1 (PRD 문구)
  "menuLabel": "RAG",                     // 사이드바 라벨
  "uiTopicId": "rag-systems",             // sidebar.tsx / page.tsx 의 id
  "ontology": {
    "node": "RAG",                        // 기존 302개 중 대응 노드. 없으면 null(신규) — C3
    "status": "existing",                 // existing | new | renamed
    "parents": ["AugmentationTechnique"]  // 역주입 시 rdfs:subClassOf 대상
  },
  "meta": { "updated": "2026-08-19", "readingMinutes": 8,
            "verified": false, "contributors": [] },

  "overview": {
    "definition": "…",        // → llm:description
    "whyItMatters": "…",
    "context": "…"
  },

  "cherries": [                            // ② — 출처 필수(C4)
    { "source": "AI Engineering",          // → handbook.book.title
      "author": "Chip Huyen",
      "locator": "Ch.6",                   // 챕터/페이지
      "chunkId": null,                     // handbook.paragraph_chunk.id (알면 기입)
      "insight": "…" }                     // MECE 한 조각
  ],

  "childConcepts": [                       // ③
    { "label": "Hybrid Search",
      "ontologyNode": "HybridRetrieval",   // 기존 노드 매핑 — C3
      "relation": "SUBTOPIC",              // SUBTOPIC|PREREQUISITE|EXTENDS|RELATED|CONTRADICTS
      "why": "…" }                         // 관계 이유(PRD 요구)
  ],

  "references": [                          // ④
    { "order": 1, "stage": "START HERE",
      "title": "…", "url": "…",
      "teaches": "…",                      // 무엇을 배우나
      "addsOverPrevious": "…" }            // 앞 자료 대비 추가 가치(MECE)
  ]
}
```

> **관계 5종을 JSON엔 적고, 역주입 시 축약한다.** GraphDB엔 지금 `rdfs:subClassOf`만 있으므로 Phase 4에선 SUBTOPIC→`subClassOf`로만 심고, 나머지는 Phase 5에서 서술어를 추가해 복원한다. (사람이 판단한 정보를 버리지 않기 위해 JSON에는 처음부터 5종을 남긴다.)

---

## 2-A. ⭐ 갭(diff) 리포트 — **화면 확정 시마다 반드시 생성**

> 이것이 목표 ②의 산출물이다(`1-work-guidelines.md` §3·조건 C6). **갭 문서 없이 완료 처리 금지.**

### 2-A-1. 원리 — 손으로 쓰지 않는다

```
[A] 개념 JSON (사람이 쓴 화면 정본)  +  [B] 라이브 GraphDB (현실)
                       ↓  스크립트가 대조
        [C] 갭 리포트(생성물)  +  [D] 역주입 TTL(Phase 4)
```
- **C와 D가 같은 로직에서 나온다** → 문서와 실행이 구조적으로 어긋날 수 없다.
- 생성물 파일 최상단에 `<!-- 생성물: 직접 수정 금지 -->` 를 박는다.

### 2-A-2. 갭 유형 (7종 + 커버리지)

| 코드 | 무엇 | 보완 방법 |
|---|---|---|
| `MISSING_NODE` | 개념 자체가 GraphDB에 없음 | 노드 신설 |
| `LABEL_ALIAS` | 있는데 이름이 다름 | 별칭 추가(또는 개명) |
| `MISSING_RELATION` | 노드는 둘 다 있는데 연결이 없음 | 트리플 추가 |
| `RELATION_TYPE_GAP` | 관계 종류를 표현 못함(`subClassOf`뿐) | 서술어 확장(Phase 5) |
| `HIERARCHY_MISMATCH` | 상위가 학습 관점과 다름 | 계층 재배치 검토 |
| `WEAK_DESCRIPTION` | 설명 없음/화면에 못 쓸 품질 | 설명 보강 |
| `DATA_QUALITY` | 중복 라벨 등 | 정리 |
| *(지표)* `COVERAGE` | 302개 중 화면이 참조하는 비율 | 다음 개념 선정 근거 |

### 2-A-3. 산출 파일

```
apps/docs/learning/ontology-gap/
├── README.md        갭 유형 정의·생성법  ← 사람이 쓰는 유일한 문서
├── 0-summary.md     12개 누적 + 커버리지  [생성물]
└── <slug>.md        개념 1개당 1장        [생성물]
```
- 스크립트: `scripts/learning/ontology-gap.cjs` (리포 루트)
- 실행: `node scripts/learning/ontology-gap.cjs <slug>` · 전체는 인자 없이

### 2-A-4. ⭐ 완료 정의(DoD) — 개념 1개

아래를 **전부** 만족해야 그 개념이 완료다. 하나라도 빠지면 다음 개념으로 넘어가지 않는다.

1. `public/learning/concepts/<slug>.json` 작성 (4섹션, 출처 전부 기입)
2. 화면에서 렌더 확인 (브라우저 실동작 1회)
3. **`ontology-gap/<slug>.md` 생성**
4. **`ontology-gap/0-summary.md` 재계산**
5. 갭 리포트의 `제안` 검토 → 승인/반려 표시
6. `4-progress-log.md`에 한 줄 기록

### 2-A-5. `제안` 칸 규칙

- 기계가 확실히 아는 것은 **사실**(예: "`Reranking` 없음").
- 그 다음 처리 방향은 **`제안`(미확정)** 으로 적는다(예: "`RAG`의 하위로 신설 제안").
- 사람이 검토해 `승인`/`반려`/`보류`로 표시 → **승인된 것만** Phase 4 역주입 입력이 된다.
- 제안을 사실처럼 적지 않는다.

---

## 3. 단계별 구현 (버티컬 슬라이스 우선)

### Phase 0 — 스키마 확정 & 기존 온톨로지 대조
- §2 JSON 스키마를 확정하고 **Basics 6개의 `ontology.node` 매핑표**를 만든다(조사문서 §7-4의 불일치 해소).
  - 확인된 대응: `rag-systems`→`RAG` · `fine-tuning`→`Finetuning` · `agents-reasoning`→`AgentArchitecture` · `prompting-reasoning`→`PromptEngineering` · `embeddings`→`Embedding` · `evaluation-systems`→`AutomaticMetric`(⚠️ 상위 `EvaluationMetric`이 더 적합 — 검토).
- 갈림길 G1(추론 범위)·G2(매핑 방식) 결정.
- 산출물: 확정 스키마 + 매핑표. **[게이트]**

### Phase 1 — RAG 1개 버티컬 슬라이스 (화면 관통)
- `apps/web/public/learning/concepts/rag.json` 작성(4섹션 전부, 출처 포함).
- `concept-reader-page.tsx`를 **`slug` prop + JSON fetch** 기반으로 리팩터 — 하드코딩 상수(`CHERRIES`/`CHILD_CONCEPTS`/`REFERENCES`) 제거. **레이아웃은 그대로**(전/후 스냅샷 대조).
- 사이드바 `RAG` 클릭 → 개념 페이지 렌더까지 **전 계층 관통**.
- **갭 리포트 생성** — `node scripts/learning/ontology-gap.cjs rag` → `ontology-gap/rag.md` + `0-summary.md`. (§2-A-4 DoD)
- **[게이트]** 화면 전/후 대조 + 콘텐츠 품질 리뷰 + **갭 리포트 검토(제안 승인/반려)**.

### Phase 2 — Basics 나머지 5개 콘텐츠
- `prompting-reasoning` · `fine-tuning` · `agents-reasoning` · `embeddings` · `evaluation-systems` JSON 작성.
- 출처는 `handbook.paragraph_chunk`(4권 3,054조각) 우선 인용 — 나중에 `chunkId`로 연결(C4).
- **개념 하나 끝날 때마다 갭 리포트 생성**(§2-A-4 DoD 6단계 전부). 5개를 몰아서 마지막에 한 번 생성하지 않는다.
- **[게이트]** 6개 콘텐츠 품질 리뷰 + **누적 `0-summary.md` 검토** — 이 시점의 요약이 **GraphDB 보완 명세서 초안**이다.

### Phase 3 — 라우팅 통합 & 퍼블리싱
- Basics 6개(그리고 준비되면 Advanced 6개)를 `HandbookPlaceholder` → **개념 페이지 컴포넌트**로 전환(`app/page.tsx` switch).
- Concept Reader 메뉴와 토픽 페이지가 **동일 컴포넌트** 재사용(결정 §4-1-3).
- `handbook-placeholder.tsx`의 죽은 "This Week's Highlight" 링크 정리.
- **[게이트]** 퍼블리싱 승인 → 이 시점의 JSON이 **역주입 기준선**이 된다.

### Phase 4 — ⭐ 역주입 (JSON → GraphDB / handbook)
> 🔴 **쓰기 작업. 반드시 사용자 승인 후. 공유 DB 주의(작업지침 §7).**
- **입력 = `ontology-gap/0-summary.md`의 `승인`된 제안만.** 미검토·반려 항목은 심지 않는다.
- **4-A GraphDB**: JSON → TTL 생성 스크립트. `ontology.status`별 처리 — `existing`은 건너뛰거나 description 갱신, `new`는 노드 신설 + `parents`로 `rdfs:subClassOf` 연결. 로컬 컨테이너에서 먼저 검증 후 반영.
- **4-B handbook**: `cherries[]`의 `source`/`locator`로 `paragraph_chunk`를 역매칭 → `handbook.concept` 시드 + `paragraph_concept_link` 생성. `handbook.topic`/`subtopic`도 Basics/Advanced 기준으로 시드.
- **4-C 발행 계층**: `content.concept_page`에 개념 페이지 발행(`concept_slug`·`content_md`·`related_concepts`·`progressive_refs`). — ⚠️ 이 테이블은 현재 KaaS가 쓰고 있으므로 **네임스페이스 분리 여부 검토 필요.**
- 검증: 역주입 후 `related-concepts` API가 JSON과 **같은 결과**를 내는지 대조.

### Phase 5 — API 전환 & 관계 확장
- 화면 데이터 소스를 JSON → API로 전환. **전환 완료 시 JSON 폐기**(C5).
- `add_relations.py`로 `prerequisite`/`extends`/`related` 서술어 추가 → 5종 배지 복원.

### Phase 6 — (후속)
- 사이드 패널 Digest 매칭 · 승격 플로우(Advanced→Basics, 월 2회차) 반영.

---

## 4. 재사용 / 원칙
- **레이아웃 재발명 금지** — Concept Reader 화면 그대로, 데이터만 교체(전/후 스냅샷 대조로 검증).
- **하드코딩 금지** — 값은 JSON에서(C1). 없으면 상태 표시, 지어내지 않기.
- **출처 없는 Cherries 금지**(C4).
- 각 Phase 끝에 `3-checklist-table.md` 해당 항목 실행 후 다음.

## 5. 로컬 GraphDB 재현 (Phase 4 검증용)
```bash
docker compose up -d graphdb
D=python_services/packages/idea_to_graph_ontology/data
curl -X POST -F "config=@$D/config.ttl" http://localhost:7200/rest/repositories
curl -X POST -H "Content-Type: text/turtle" --data-binary "@$D/llm_ontology_augmented.ttl" \
     http://localhost:7200/repositories/llm-ontology/statements
```
- Workbench http://localhost:7200 (repo `llm-ontology`) · 상세·주의는 조사문서 §7-7.
