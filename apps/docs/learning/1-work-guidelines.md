# Learning 구현 — 작업 지침 (배경·목표·범위·의사결정)

> 기준일: **2026-08-19 개정** (최초 2026-08-16) · 대상 브랜치 `deploy`
> Learning(개념 학습: Concept Reader + Basics + Advanced) 구현 기획 폴더. 번호식 3종: 본 문서(지침) · `2-implementation-guide.md`(레이아웃·단계) · `3-checklist-table.md`(검증). 실측 자료: `개념온톨로지-GraphDB-조사.md`(이 폴더, **§7이 2026-08-19 실구동 결과**).
> 상위 정본: `docs/PRD/product-scope.md` §1·§2(4섹션·파이프라인·승격) · `docs/PRD/functional-requirements.md`(Concept/Evidence Layer) · `docs/architecture/handbook-ddl-{redesign,revision}-proposal.md`(Evidence/handbook 스키마). 지도: `base-data/기획문서-참조지도-ND-Learning.md` §3.

---

## 0. ⭐ 방향 결정 (2026-08-19) — **역순으로 간다**

**결정: 화면·콘텐츠를 먼저 완성해 퍼블리싱하고, 그 결과를 근거로 GraphDB·handbook을 채운다.**

```
[기존 계획 · 정방향]  DB(온톨로지·evidence) → Writer Agent 합성 → 화면 렌더
[개정 · 역순]         화면 + 콘텐츠(JSON 정본) → 퍼블리싱 → 역주입 → DB(온톨로지·evidence)
```

**왜 바꿨나 (근거는 전부 실측 — 조사문서 §7):**

1. **정방향이 물리적으로 막혀 있다.** 최초 계획의 Phase 0 핵심 질문("합성 콘텐츠 발행 계층이 있나?")의 답이 **없다**로 확인됐다. `handbook.concept`·`concept_alias`·`paragraph_concept_link`·`topic`·`subtopic` 전부 **0행**이라 ② Cherries를 만들 재료가 DB에 연결돼 있지 않고, ④ Progressive References는 저장소 자체가 없다.
2. **지금 온톨로지는 "학습 커리큘럼"이 아니라 "책에서 뽑은 기술 분류"다.** 1단계 11개가 `ModelComponent`(84) · `ApplicationDomain`(32) 같은 축이라 사람이 배우는 순서가 아니다. PRD가 요구하는 **MECE 학습 경로**는 사람 판단에서 나오고, 그 판단은 화면·콘텐츠를 만들며 구체화된다.
3. **PRD와 충돌하지 않는다.** FR-4.4(Evolving Taxonomy: 새 카테고리를 구조 변경 없이 추가) · 승격 플로우(개념이 Advanced→Basics 이동)가 이미 taxonomy 변동을 전제한다.

### 0-A. ⚠️ 역순이 성립하기 위한 조건 5가지 (안 지키면 "두 번 작업"이 된다)

| # | 조건 | 안 지키면 |
|---|---|---|
| **C1** | 콘텐츠를 **컴포넌트에 하드코딩하지 않는다.** ND에서 검증된 `public/<group>/*.json` 패턴을 쓴다. | 이관 때 사람이 JSX에서 손으로 다시 옮겨야 함 |
| **C2** | JSON **필드마다 "심을 목적지"를 미리 정한다**(§0-B 표). | 나중에 DB 컬럼·트리플로 매핑이 안 됨 |
| **C3** | 각 개념에 **`ontologyNode`**(기존 302개 중 대응 노드 id, 없으면 `null`=신규)를 단다. | 같은 개념이 다른 이름으로 중복 노드 생성 |
| **C4** | **출처를 반드시 함께 적는다**(책·챕터·페이지 또는 URL). | PRD가 내건 Cherries 가치("문헌이 실제로 말하는 것") 훼손 + evidence 승격 불가 |
| **C5** | **단일 정본 + 전환 시점 명시** — 이관 완료 시 JSON 폐기하고 API로 전환. | JSON과 DB가 동시에 정본이 되어 서로 어긋남 |
| **C6** | ⭐ **화면 하나가 확정될 때마다 갭(diff) 문서를 반드시 남긴다.** 갭 문서 없이는 그 개념을 완료 처리하지 않는다(`3-checklist-table.md`의 게이트로 강제). | 무엇을 보완해야 하는지가 사람 머릿속에만 남아 사라짐 — **본 프로젝트의 목표 ②가 통째로 증발** |

> **C4 보충**: 재료는 이미 있다. `handbook.paragraph_chunk`에 4권 **3,054조각**(AI Engineering 935 · Building Applications with AI Agents 1,248 · LLM Engineers Handbook 776 · Reflexion 95)이 적재돼 있다. 여기서 인용하면 Phase 4에서 `paragraph_concept_link`로 바로 연결된다.

### 0-B. 필드 → 목적지 매핑 (C2의 실체)

| 화면/JSON 필드 | 최종 목적지 |
|---|---|
| `overview.definition` | GraphDB `llm:description` |
| `childConcepts[].ontologyNode` + `.relation` | GraphDB 트리플 (`rdfs:subClassOf` / 향후 `llm:prerequisite`·`llm:extends`) |
| `cherries[].source` · `.locator` · `.chunkId` | `handbook.book` · `paragraph_chunk` · `paragraph_concept_link` |
| `references[]` | `content.concept_page.progressive_refs` |
| `slug` · `title` | `content.concept_page.concept_slug` · `concept_name` |

---

## 1. 배경

- Learning은 ND(뉴스 큐레이션)와 성격이 다르다 — **책·강의에서 뽑은 "개념(concept)"** 을 4섹션 포맷으로 정리해 보여준다.
- **개념 페이지 4섹션(PRD §1 정본)**: ① Overview ② Cherries(문헌 MECE 요약) ③ Child Concepts(관련개념) ④ Progressive References(MECE 학습경로).
- **PRD의 콘텐츠 파이프라인**: `Curated Sources → Evidence Layer(handbook) → Ontology(GraphDB) → Writer Agent 합성 → 개념 페이지 발행`. → **본 개정은 이 파이프라인을 폐기하지 않고, 착수 순서만 뒤집는다**(먼저 사람이 만든 결과로 Evidence/Ontology를 시드하고, 이후 파이프라인이 이어받는다).

## 2. 현재 상태 (2026-08-19 실측)

| 부분 | 상태 |
|---|---|
| Concept Reader (`concept-reader-page.tsx`) | 4섹션 **화면 완성**(2열: 왼쪽 리딩 4섹션 + 오른쪽 패널), 단 **데이터 하드코딩**(`CHERRIES`/`CHILD_CONCEPTS`/`REFERENCES` 상수, `READER_CONCEPT_ID="rag"`). |
| Basics(6)·Advanced(6) 토픽 | `HandbookPlaceholder`("Handbook In Progress") — 제목/설명만. **개념 페이지 화면을 안 씀.** |
| **GraphDB** | ✅ **로컬 기동·검증 완료**(조사문서 §7-2). `docker compose up -d graphdb` → 302개 로드 → 트리플 1,220 → 백엔드 SPARQL 정상 응답. **호스팅 서버는 존재하지 않음**(작성자 확인) — 리포 TTL이 곧 자산. |
| **handbook(Evidence)** | ❌ **개념·링크 0행.** 원문 청크 3,054개만 적재. `POST /writer-agent/input`은 어떤 토픽이든 **빈 결과**. |
| **발행 계층** | ❌ **없음.** `content.concept_page`가 4섹션과 맞는 스키마지만 1행은 **KaaS 마켓용**. |
| 화면 기획 문서 | ⚠️ 전용 문서 없음 → **`concept-reader-page.tsx` 코드를 화면 정본으로 확정**(§4-1). |

## 3. 목표 (두 개 — 동등하다)

> ⚠️ 목표 ②는 부산물이 아니라 **본 작업의 주된 산출물**이다. 화면을 만드는 행위가 곧 온톨로지를 설계하는 행위다.

**① 화면·콘텐츠 퍼블리싱** — Basics 6개(이후 Advanced 6개) 토픽을 4섹션 개념 페이지로 실제 콘텐츠와 함께 퍼블리싱한다. 데이터는 JSON을 정본으로 둔다.

**② GraphDB 보완 명세서 산출** — 그 과정에서 "어떤 개념을 신설하고 / 어떤 이름을 맞추고 / 어떤 관계를 추가해야 하는지"를 **개념 1개당 1장의 갭 문서**로 남긴다. 12개가 쌓인 누적 요약이 Phase 4 역주입의 입력이 된다.

- 갭 문서는 **손으로 쓰지 않고 스크립트가 생성**한다(정본 = 개념 JSON + 라이브 GraphDB). 상세: `ontology-gap/README.md`.
- **화면 확정 시마다 생성이 강제**된다(조건 C6 · 체크리스트 게이트).

### 3-A. 갭이 실재한다는 증거 (2026-08-19 실측)
현재 RAG 샘플의 Child Concepts 6개를 로컬 GraphDB(302개)에 조회한 결과 — **6개 전부 그대로는 매칭되지 않았다.**

| 화면에 쓴 이름 | GraphDB | 갭 유형 |
|---|---|---|
| Vector Databases | `Vector Database` | `LABEL_ALIAS` |
| Hybrid Search | `HybridRetrieval` | `LABEL_ALIAS` |
| Embeddings | `Embedding` | `LABEL_ALIAS` |
| Chunking Strategies | `Chunking` | `LABEL_ALIAS` |
| **Reranking** | **없음** | **`MISSING_NODE`** |
| **Contextual Retrieval** | **없음** | **`MISSING_NODE`** |

추가로 `Alignment`·`InferenceOptimization`이 **라벨을 2개씩** 보유(고유 클래스 302 vs 라벨 행 304) → `DATA_QUALITY`.

## 4. 결정 사항 & 남은 갈림길

### 4-1. 결정된 것 (2026-08-19)
1. **방향 = 역순** (§0).
2. **화면 정본 = `concept-reader-page.tsx` 코드.** 외부 "UI & Information Architecture 260415" 와이어프레임은 리포에 없으므로 기다리지 않는다. 레이아웃은 재발명하지 않고 그대로 쓴다.
3. **컴포넌트 통합.** Concept Reader와 Basics/Advanced 토픽이 **하나의 개념 페이지 컴포넌트**를 `slug`로 파라미터화해 공유한다.
4. **Child Concepts 관계는 Phase 1에선 단순화.** 샘플 UI는 5종 배지(SUBTOPIC·PREREQUISITE·EXTENDS·RELATED…)지만 GraphDB엔 `rdfs:subClassOf`만 있다(`llm:related` 1개). **JSON에는 5종을 적되**(사람이 판단 가능하므로) **역주입 시 `subClassOf`로 축약**하고, 관계 확장은 Phase 5.
5. **TTL 정본 = `llm_ontology_augmented.ttl`(302개).** `llm_ontology.ttl`(222개)의 완전한 상위집합임을 확인(누락 0).

### 4-2. 남은 갈림길 (사용자 결정 대기)
| # | 갈림길 | 권고 |
|---|---|---|
| G1 | **추론 범위**: `related-concepts`가 조상·자손 전체를 평면 반환(조사문서 §7-3). ⓐ SPARQL에 `infer=false` 추가(직속만) / ⓑ 깊이별 묶어 렌더 / ⓒ 그대로 | **ⓐ** |
| G2 | **Basics 6개의 온톨로지 매핑**: 라벨이 전부 불일치(§7-4). ⓐ JSON `ontologyNode`로 매핑만 / ⓑ 온톨로지 라벨 자체를 개명 | **ⓐ**(온톨로지 개명은 파급이 큼) |
| G3 | **`config.ts:57` 죽은 IP 하드코딩** 정리 시점 | `.env` 전용으로 걷어내기 |
| G4 | **콘텐츠 작성 주체**: 6개 × 4섹션 분량. 누가 쓰나(팀/AI 초안+사람 검수) | AI 초안 + 사람 검수, 출처 필수(C4) |

## 5. 제약 / 주의

- 🔴 로컬·프로덕션 같은 Supabase DB 공유 — handbook 조회는 **읽기만**, 마이그레이션 극도 주의(작업지침 §7). **Phase 4 역주입은 쓰기 작업이므로 반드시 사용자 승인 후.**
- **지어내지 않기** — 출처 없는 Cherries 금지(C4). 없으면 채우지 말고 상태 표시.
- **UI 토픽 id(12개)는 UI 전용** — `handbook.topic`은 0행이라 아직 정본이 아니다. 매핑은 JSON `ontologyNode`가 담당.
- 변경·커밋은 사용자 허락/지시 후(작업지침 §5).

## 6. 결과물

- Basics 6개 개념 페이지(4섹션, 실제 콘텐츠) + 콘텐츠 JSON(정본) + 역주입 스크립트. 상세 단계는 `2-implementation-guide.md`, 검증은 `3-checklist-table.md`.
