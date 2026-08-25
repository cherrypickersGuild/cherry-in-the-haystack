# 프론트엔드 현황 (기준일: 2026-08-25)

> `apps/web`(Next.js 16 App Router). **08-16 대비 델타 문서.**
> 안 바뀐 기본 구조(콘텐츠 그룹·JSON 3층·카탈로그·사이드바 멀티오픈·Overview 등)는 `frontend-status-2026-08-16.md` 가 **여전히 유효**하다. 여기선 **바뀐 것만** 정리한다.
> 이번 델타의 핵심: **Learning 12개 토픽이 전부 실제 개념 페이지로 렌더된다.** 08-16 시점의 "12개 전부 `HandbookPlaceholder` 한 컴포넌트" 상태가 끝났고, 내용은 **DB에서 API로 온다.**
> 함께 볼 것: `handoff-2026-08-25.md` · `api-backend-status-2026-08-25.md`

---

## 0) 한 줄 요약 — 무엇이 달라졌나

| | 08-16 | 08-25 |
|---|---|---|
| Learning 12개 토픽 | 전부 `HandbookPlaceholder`("Handbook In Progress") | 전부 **`ConceptReaderPage`** — DB 내용으로 렌더 |
| Concept Reader | RAG 하드코딩 목업(`CHERRIES`/`CHILD_CONCEPTS`/`REFERENCES` 상수) | **API 호출**(`GET /api/learning/concepts/:key`) |
| 하위 개념 클릭 | 없음 | **무한 이동** — 하위 개념 → 그 개념의 자기 페이지 |
| 로드맵 그림 | 없음 | **데이터로 자동 생성**(하드코딩 좌표 없음) |

---

## 1) ⭐ Concept Reader 전면 재작성 (`components/cherry/concept-reader-page.tsx`)

### 1-1. 데이터 소스

```
사이드바 토픽 클릭
  → page.tsx 가 CONCEPT_NODE_BY_TOPIC 로 온톨로지 노드명 조회
  → <ConceptReaderPage slug={노드명} sectionHint={섹션} />
  → fetchLearningConcept(slug)  =  GET /api/learning/concepts/<key>
  → 4구획 렌더
```

- `key` 는 **slug · 온톨로지 노드명 · 별칭** 아무거나 받는다(백엔드가 해석).
- 로딩 중 `doc === null`, 실패 시 `error` 상태. **빈 섹션은 감추지 않고 "비었다"고 정직하게 표시**한다(콘텐츠 미완성을 숨기지 않기 위함).

### 1-2. 4구획 — PRD 구조 그대로

| # | 구획 | 소스 |
|---|---|---|
| 01 | Overview | `content.concept_page` (+ 온톨로지 `description` 폴백) |
| 02 | Cherries | `handbook.paragraph_concept_link.insight` + 출처(책·저자·위치) |
| 03 | Child Concepts | `handbook.concept_relation` |
| 04 | Progressive References | `content.concept_page.progressive_refs` |

### 1-3. 섹션 뱃지 색 — 원래 디자인으로 되돌림

```
BASICS    bg #E3F1E1 / fg #2F7A3A   (초록)
ADVANCED  bg #FDF0F3 / fg #C94B6E   (체리)
```
`handbook-placeholder.tsx` 의 `CARD_PALETTE` 원본과 동일하게 유지한다. **둘을 반드시 다른 색으로 구분**한다.
제목 위 `Learning › Advanced › RedTeaming` 형태의 **브레드크럼은 원래 디자인에 없어서 제거**했다.

### 1-4. ⭐ 로드맵 자동 생성 — 하드코딩 금지

`ConceptRoadmap({ doc })` 이 관계 데이터만 보고 SVG를 그린다. **좌표·칸 크기·줄바꿈이 전부 계산값**이다.

**밴드 구성** (`ROADMAP_BANDS`)

| 밴드 | 관계 타입 | 위치 |
|---|---|---|
| Prerequisites | `PREREQUISITE` | 자기 개념 **위** |
| Go deeper | `SUBTOPIC` · `EXTENDS` | 아래 |
| Related | `RELATED` · `CONTRADICTS` | 아래 |

**글자가 칸을 넘지 않게 하는 3단 규칙** — 이게 이 컴포넌트의 핵심이다.

1. `fitText()` — 우선 **칸을 옆으로 넓힌다**
2. 그래도 넘치면 **폰트를 줄인다** (`FS 11 → CHIP_MIN_FS 8`, 자기 개념은 `15 → 10`)
3. 그래도 넘치면 `wrapLabelAt()` 으로 **줄바꿈**
4. 끊는 위치는 `breakPoints()` — **공백 앞뒤 + camelCase 경계**(`HybridRetrieval` → `Hybrid` / `Retrieval`)

> ⚠️ **여기에 좌표나 칸 크기를 하드코딩하지 말 것.** 개념 이름 길이가 제각각이라 하드코딩하면 반드시 글자가 외곽선에 닿는다. 이 규칙은 사용자가 명시적으로 요구한 것이다.

**관계별 색** (`RELATION_COLOR`)
```
SUBTOPIC #7B5EA7 · PREREQUISITE #9E97B3 · EXTENDS #2D7A5E
RELATED  #D4854A · CONTRADICTS  #C94B6E
```

**실선 / 점선**
- **실선** = 그 개념에 발행된 페이지가 있다(`childConcepts[].hasPage === true`)
- **점선** = 아직 페이지가 없다
- 08-16 시점의 "점선 = GraphDB 미등록" 의미는 **더 이상 아니다.** 이관 완료로 305개 전부 DB에 있다.

### 1-5. 페이지 상태 뱃지 (`STATUS_BADGE`)

```
FULL      violet    — 4구획이 다 찼다
OUTLINE   secondary — 일부만
SOON      cherry    — 거의 비었다
```

### 1-6. 제거된 것

- **`🛒 Buy on Market` 버튼** — 아직 기능이 없어서 뺐다. (`onBuyOnMarket` prop 은 시그니처에 남아 있으나 미사용)
- **기여자 표기**: `KNOWLEDGE TEAM` 같은 문구 대신 **닉네임**(`tomatojams` 등)을 쓴다. 인공지능 티를 내지 않는다. 현재 DB에 기여자 0행이라 화면엔 안 나온다.

### 1-7. ⚠️ 한글 금지 원칙

사이트 콘셉트상 **화면에 한글을 임의로 넣지 않는다.** 단, **온톨로지 데이터 자체에 한글이 들어 있으면 그건 그대로 출력**한다. (금지 대상은 "에이전트가 임의로 넣는 한글"이지 데이터가 아니다.)

---

## 2) 라우팅 (`app/page.tsx`)

### 2-1. 토픽 → 온톨로지 노드 매핑

```ts
const CONCEPT_NODE_BY_TOPIC: Record<string, { node: string; section: "BASICS"|"ADVANCED" }> = {
  /* BASICS — PRD product-scope.md §1 */
  "prompting-reasoning": { node: "PromptEngineering",             section: "BASICS" },
  "rag-systems":         { node: "RAG",                           section: "BASICS" },
  "fine-tuning":         { node: "Finetuning",                    section: "BASICS" },
  "agents-reasoning":    { node: "AgentArchitecture",             section: "BASICS" },
  "embeddings":          { node: "Embedding",                     section: "BASICS" },
  "evaluation-systems":  { node: "EvaluationMetric",              section: "BASICS" },
  /* ADVANCED — PRD product-scope.md §2 */
  "chain-of-thought":    { node: "AdvancedPrompting",             section: "ADVANCED" },
  "multi-hop-rag":       { node: "HybridRetrieval",               section: "ADVANCED" },
  "peft-lora":           { node: "ParameterEfficientFinetuning",  section: "ADVANCED" },
  "agent-topologies":    { node: "MultiAgentSystem",              section: "ADVANCED" },
  "custom-embeddings":   { node: "Embedding",                     section: "ADVANCED" },
  "adversarial-eval":    { node: "RedTeaming",                    section: "ADVANCED" },
}
```

### 2-2. 개념 간 무한 이동

```ts
const [conceptSlug, setConceptSlug] = useState<string | null>(null)

const openConcept = (slug: string) => {
  const topic = TOPIC_BY_CONCEPT_NODE[slug]
  if (topic) { setConceptSlug(null); setActiveNav(topic) }   // 메뉴에 있는 개념 → 사이드바 하이라이트까지 맞춤
  else       { setConceptSlug(slug); setActiveNav("concept") } // 메뉴 밖 개념 → 전용 상태로
}
```

- **모달이 아니라 페이지 이동**이다. 무한 연결로 학습하는 구조라서, 하위 개념을 모달로 띄우면 안 된다(사용자 명시 요구).
- `activeNav` 와 별개인 **파라미터 상태**(`conceptSlug`)를 둬서 taxonomy·switch를 늘리지 않고 개념 간을 이동한다. 기존 `marketConceptId` 와 같은 패턴.
- 여전히 **URL 라우트가 아니라 상태 기반**이다(08-16과 동일).

---

## 3) API 클라이언트 (`lib/api.ts`)

- `fetchLearningConcept(key)` 신규 — `GET ${API_URL}/api/learning/concepts/<key>`
- 타입 `ConceptPage` · `ConceptCherry` · `ConceptChild` · `ConceptReference` · `ConceptRelationType` 추가
- ⚠️ **이름 주의**: 이 파일엔 KaaS용 `fetchConcept` 가 이미 있다. 충돌을 피하려고 `fetchLearningConcept` 로 지었다. **`fetchConcept` 로 되돌리지 말 것.**
- `import type` 을 쓴다(isolatedModules).

---

## 4) ⚠️ 알려진 문제 · 정리 대상

| # | 내용 | 조치 |
|---|---|---|
| F1 | `multi-hop-rag`(메뉴 라벨 "Multi-hop RAG") → `HybridRetrieval` 로 매핑 | 이름이 안 맞아 책 검색 매칭 **0건**. 온톨로지에 `MultiHopRAG` 를 만들지, 라벨을 바꿀지 **미결** |
| F2 | `custom-embeddings`(ADVANCED) 와 `embeddings`(BASICS) 가 **같은 노드 `Embedding`** 을 가리킨다 | 두 메뉴가 같은 페이지를 연다. 리서처 JSON 검증에서도 경고로 잡힌다(V9) |
| F3 | `components/cherry/handbook-placeholder.tsx` 가 **어디서도 import되지 않는다** | 고아 컴포넌트. 색 팔레트(`CARD_PALETTE`)만 참조 근거로 남아 있음 — 삭제 여부 미결 |
| F4 | `public/learning/index.json` · `public/learning/concepts/{rag,embeddings}.json` 이 남아 있다 | **DB 이관으로 폐기된 정본.** 화면은 이제 안 읽는다. 삭제 대상 |
| F5 | `highlight` 페이지가 `page.tsx` switch `default:` 폴백으로만 존재 | 08-16부터 이어진 미결. 메뉴 도달 불가 |
| F6 | `onBuyOnMarket` prop 이 사용되지 않는다 | 마켓 기능 붙일 때 재사용 예정 |

**타입체크 상태(2026-08-25 실측)**

```
kaas-admin-page.tsx(265)      TS2345   ← 기존 무관
kaas-dashboard-page.tsx(1155~1164)  TS18047/18048 ×7  ← 기존 무관
```
총 8건, **전부 08-16 문서에 이미 기록된 기존 에러**다. 이번 작업으로 생긴 신규 에러 **0건**.

---

## 5) 확인 방법

```bash
cd apps/api && pnpm start:dev     # :4000
cd apps/web && pnpm dev           # :3000
```

`apps/web/.env.local` 의 `NEXT_PUBLIC_API_URL=http://localhost:4000` 이 있어야 한다.

API 단독 확인:
```bash
curl -s http://localhost:4000/api/learning/concepts/RAG | head -c 500
```

화면 확인: 사이드바 **Learning → Basics → RAG**. 4구획이 다 차 있고 로드맵이 그려지면 정상. 나머지 11개 토픽은 **Overview·Cherries·References가 비어 있는 게 정상**(콘텐츠 미작성).
