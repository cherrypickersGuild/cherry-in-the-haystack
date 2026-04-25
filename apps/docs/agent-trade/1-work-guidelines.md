# Agent Trade — Work Guidelines (Lean)

> 작성: 2026-04-25 · v2 lean
> 범위: Shop 에 **By Agent** 탭 추가 → 두 에이전트 지식 **diff** 보이고 → 부족한 항목 **구매**.
> 그 이상 없음.

---

## 1. 핵심 시나리오

1. 사용자가 Shop → By Agent 탭 진입
2. 다른 에이전트 한 명 선택
3. 모달에 "내 에이전트 vs 상대 에이전트" 지식 차이 3섹션 표시
4. 상대만 가진 항목의 [Buy] 클릭 → 기존 PurchaseModal 로 구매
5. 구매 후 diff 자동 갱신 (산 항목이 Both 로 이동)

---

## 2. UX

```
[Shop 큰 탭]
┌─ By Domain ┬ By Component ┬ By Agent ←신규 ┐

[By Agent 탭]
  My agent: [Claude (Mac) ▼]

  Other agents
  ┌──────────────┐  ┌──────────────┐
  │ Bob's Claude │  │ Alice's GPT  │
  │  [Compare →] │  │  [Compare →] │
  └──────────────┘  └──────────────┘

[Compare 클릭 → Modal]
  ─ Both have ─────────────
    · A-MEM
    · Citation Discipline

  ─ Only Bob has (buyable) ─
    🎁 Hunter set       [Buy 60cr]
    📚 RLoT Reasoning   [Buy 30cr]

  ─ Only my agent has ─────
    · Plan-and-Execute
```

- 카드는 미니멀: 이름 + Compare 버튼만
- 모달은 3섹션. Buy 는 "Only Theirs" 에만
- 구매 종류: **set** (set-*) + **concept** (019dac UUID) 두 가지. Workshop card 는 표시만, Buy 비활성

---

## 3. 데이터

- 진실 = **self-report** `local_skills.items[]` (기존 패턴 그대로)
- diff = `cherry-` prefix 떼어낸 슬러그 두 집합의 차집합/교집합
- 슬러그 분류 (구매 가능 여부 결정):
  - `set-*` → set, 가격 = `ShopSet.priceBundled`
  - `019…` UUID → concept, 가격 = `concept.priceCredits ?? 20`
  - 그 외 → 표시만

---

## 4. 신규 API

| Method | Path | 응답 |
|--------|------|------|
| GET | `/v1/kaas/shop/agents?exclude_self=<api_key>` | `[{ id, name }]` |
| GET | `/v1/kaas/shop/agents/:id/diff?vs_api_key=<api_key>` | `{ both, onlyTheirs, onlyMine }` |

각 항목은 `{ slug, kind, title, summary, buyable?: { endpoint, body, price } }`.

구매는 **기존 엔드포인트 재사용** (`/shop/buy-and-install` / `/purchase`).

---

## 5. 신규/수정 파일

### 신규 (server)
- `apps/api/src/modules/kaas/shop/agent-trade.controller.ts`
- `apps/api/src/modules/kaas/shop/agent-trade.service.ts`
- `apps/api/src/modules/kaas/shop/skill-classifier.ts` (슬러그 → kind/buyable)

### 신규 (web)
- `apps/web/components/cherry/shop-by-agent.tsx`
- `apps/web/components/cherry/shop-agent-diff-modal.tsx`
- `lib/api.ts` 에 `fetchShopAgents`, `fetchAgentDiff`

### 수정
- `apps/web/app/start/shop/page.tsx` — 큰 탭 3개로 확장
- `apps/api/src/modules/kaas/kaas.module.ts` — controller/service 등록

---

## 6. 비범위

- 캐시 (매번 self-report 호출, 미연결이면 빈 결과)
- 오프라인 표시 / 마지막 본 시각 / Karma tier 노출
- 카드 단품(inv-*) 구매
- 교환(swap), 협상, 가격 책정
- 에이전트 검색/필터/정렬

---

## 7. 결정 (3개)

| # | 결정 | 이유 |
|---|------|------|
| D1 | self-report 만 진실 | 기존 패턴 일관 |
| D2 | 구매는 set + concept 만 | 카드 단품은 별도 인프라 |
| D3 | 미연결 시 빈 결과 | 캐시/스테일 처리 안 함 |
