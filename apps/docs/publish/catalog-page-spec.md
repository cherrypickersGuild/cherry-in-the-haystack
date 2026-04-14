# Knowledge Catalog 페이지 퍼블리싱 기획서

**작성일:** 2026-04-13
**근거:** PRD FR4-7, FR37-38 / epics.md Story 5.2, Story 2.5 / architecture.md
**대상 파일:** `apps/web/components/cherry/kaas-catalog-page.tsx`

---

## 1. 페이지 목적

심사위원과 에이전트 빌더가 **Cherry KaaS에 어떤 지식이 있는지** 시각적으로 탐색하는 쇼윈도.
인증 불필요 (Public). 카탈로그를 보고 → 관심 있는 개념을 확인하고 → Query 페이지에서 구매.

---

## 2. 현재 구현의 문제점

| # | 문제 | 근거 |
|---|------|------|
| ~~1~~ | ~~개념 수~~ — 9개 유지 (사용자가 확장함) | — |
| 2 | Evidence에 **큐레이터 코멘트** 누락 | FR10: "curator comments" 필수 |
| 3 | Compare 기능 — 갭 분석 결과를 카드 뱃지로만 표시, **종합 리포트 없음** | FR38: "structured gap report" 반환 |
| 4 | 관련 개념이 **클릭 불가** (정적 태그) | FR7: 관련 개념 조회 가능해야 함 |
| 5 | 모달 내 구매 버튼이 플로팅 콘솔로 **연결 안 됨** | UX 흐름 끊김 |

---

## 3. 수정 기획

### 3-1. 개념 데이터 — 9개 유지

현재 9개 개념 그대로 유지 (사용자가 확장한 것):
RAG, Chain-of-Thought, Embeddings, Fine-tuning, Multi-Agent, Evaluation, Prompt Engineering, Agent Architectures, Semantic Search

카테고리 필터: **All / Basics / Advanced / Technique**

### 3-2. Evidence에 큐레이터 코멘트 추가

각 evidence에 `curator` + `comment` 필드 추가:

```
{
  source: "Chip Huyen — AI Engineering",
  summary: "Retrieval-first mental model...",
  curator: "Hyejin Kim",           // ← 추가
  curatorTier: "Gold",             // ← Karma 티어
  comment: "가장 접근성 좋은 RAG 입문 자료. 실무 적용 시 chunking 섹션 필독."  // ← 추가
}
```

모달에서 evidence 카드 내에 표시:
```
Chip Huyen — AI Engineering
Retrieval-first mental model. Precision@k가 핵심 지표.

💬 Hyejin Kim (Gold) — "가장 접근성 좋은 RAG 입문 자료."
```

### 3-3. 카드 레이아웃 — 3개이므로 1행 3열

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ RAG          │ │ Chain-of-    │ │ Embeddings & │
│              │ │ Thought      │ │ Vector DBs   │
│ Basics       │ │ Advanced     │ │ Basics       │
│ ★4.8 · 12src│ │ ★4.5 · 8src │ │ ★4.2 · 15src │
│ Updated 2d   │ │ Updated 5d   │ │ Updated 1d   │
└──────────────┘ └──────────────┘ └──────────────┘
```

카드 구성 (변경 없음):
- 제목
- 한줄 설명 (2줄 말줄임)
- 메타: 카테고리 색상 텍스트 · ★점수 · N sources · Updated Xd ago
- Compare 활성 시: 우상단 뱃지 (Latest / Update / New)

### 3-4. 모달 개선

```
┌─────────────────────────────────────┐
│ RAG                        Basics  X│
│ ★4.8 · 12 sources · Updated 2d ago │
├─────────────────────────────────────┤
│ [상태 아이콘+텍스트 — Compare 시만] │
│                                     │
│ 인퍼런스 시점에 외부 지식을 동적으로│
│ 주입하여...                         │
│                                     │
│ RELATED                             │
│ [Embeddings] [Vector DBs] [Hybrid]  │
│  ↑ 클릭 가능 — 해당 개념 모달 열림  │
│                                     │
│ EVIDENCE (3)                        │
│ ┌─────────────────────────────────┐ │
│ │ Chip Huyen — AI Engineering     │ │
│ │ Retrieval-first mental model... │ │
│ │                                 │ │
│ │ 💬 Hyejin Kim (Gold)           │ │
│ │ "가장 접근성 좋은 RAG 입문 자료"│ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ LlamaIndex — Production...      │ │
│ │ ...                             │ │
│ │ 💬 Minjun Park (Silver)        │ │
│ │ "Production gap 이해에 핵심"    │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ [Purchase 20cr]        [Follow 5cr/update] │
│  ↑ 클릭 시 플로팅 콘솔 자동 실행    │
└─────────────────────────────────────┘
```

변경 사항:
1. 큐레이터 코멘트 + Karma 티어 표시
2. Related Concepts 클릭 → 해당 개념 모달로 전환 (카탈로그 내 개념이면)
3. 하단 구매/팔로우 버튼 클릭 → 플로팅 콘솔 자동 실행

### 3-5. Agent Knowledge Compare — 갭 리포트 개선

**현재**: 카드 뱃지만 표시
**수정**: Compare 활성 시 카드 그리드 위에 **1줄 요약 바** 표시

```
┌─────────────────────────────────────────────────┐
│ Agent Knowledge Compare 버튼 (기존 유지)         │
│                                                  │
│ ── Compare 활성 시 아래 바 표시 ──               │
│ ┌──────────────────────────────────────────────┐ │
│ │ Agent: RAG (2025-11), Embeddings (2026-04)   │ │
│ │ Result: ✓1 latest · ⟳1 update · 1 new       │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ [카드 그리드 — 뱃지 표시]                        │
└─────────────────────────────────────────────────┘
```

- 에이전트가 제출한 토픽 목록 + 날짜를 한 줄로 보여줌
- 결과 요약 (✓ latest / ⟳ update / new 카운트)
- 카드 뱃지는 기존 유지 (Latest / Update / New)
- 모달 내 상태 메시지도 기존 유지

---

## 4. 구현 체크리스트

- [ ] MOCK_CONCEPTS 9개 유지 (현행 그대로)
- [ ] Evidence 타입에 curator, curatorTier, comment 필드 추가
- [ ] 모달 Evidence 카드에 큐레이터 코멘트 렌더링
- [ ] Related Concepts 태그를 클릭 가능하게 (카탈로그 내 ID 매칭 시 모달 전환)
- [ ] 모달 하단 구매/팔로우 버튼 → onQuery(title, action) 콜백 → 플로팅 콘솔 자동 실행
- [x] My Dashboard 버튼 → 글로벌 헤더(상단 우측)로 이동, 로그인 시에만 표시
- [x] 에이전트 선택 드롭다운 추가 (MOCK_AGENTS 3개, Compare 연동)
- [ ] Compare 활성 시 카드 위에 에이전트 토픽 + 결과 요약 바 추가
- [ ] 카테고리 필터 유지 (All / Basics / Advanced / Technique)

---

## 5. 후속 (API 연결 시)

- MOCK_CONCEPTS → `GET /api/v1/kaas/catalog` fetch
- Compare → `POST /api/v1/kaas/catalog/compare` fetch
- 모달 구매 버튼 → Query 페이지로 router.push + query params
