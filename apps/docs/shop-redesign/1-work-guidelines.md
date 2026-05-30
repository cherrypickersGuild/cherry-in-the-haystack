# Shop Redesign — Work Guidelines

> 작성: 2026-04-25 (v3)
> 범위: `/start/shop` 소비자 마켓플레이스 재구성
> 선행: `install-skill/` 4문서 (InstallBuildService 재사용)

---

## 1. 목적

- **현재 문제**: Shop 이 밋밋한 단일 그리드. 카드 종류 구분 없음. 구매해도 Workshop 슬롯과 매핑 안 됨.
- **목표 1**: 일반인이 "내 AI 뭐 시킬까?" → **도메인별 완성품(세트)** 한 번 클릭으로 설치.
- **목표 2**: 빌더는 **컴포넌트 탭**에서 재료 탐색 → Workshop 으로 이동해 직접 조립.
- **목표 3**: **구매 = 진짜 설치**. 기존 `InstallBuildService` 재사용 + 크레딧 차감 + 실패 시 전액 환불.

---

## 2. UX — 2대탭 구조

### 2-1. Shop 최상단

```
┌─────────────────────────────────────────────────┐
│  🎁 By Domain   │   🧩 By Component              │
└─────────────────────────────────────────────────┘
```

- **By Domain** = 구매 탭 (소비자 메인)
- **By Component** = 카탈로그 탭 (교육/네비게이션, 구매 없음)

### 2-2. By Domain 탭 (구매)

서브탭:
```
[ALL] [🛍 Shopping] [💹 Quant] [📚 Research] [📜 Policy]
```

- SetTag 매핑: `hunter → Shopping`, `quant → Quant`, `grounded → Research`, `policy → Policy`
- `ALL` = 4개 세트 그리드, 도메인 탭 = 해당 세트 hero 1개

**세트 hero 카드**:
```
┌─────────────────────────────────┐
│ 🎁 Quant AI                      │
│ Multi-asset crypto analyst       │
│ [P][M][S×3][O][M]  6/7 slots     │ ← Workshop TYPE_THEME 공유
│ ⋆⋆⋆⋆⋆ 4.6                       │
│ [Buy set — 90 cr]  [Details →]  │
└─────────────────────────────────┘
```

- 슬롯 배지 = Workshop 동일 색·아이콘
- 세트마다 슬롯 수 **가변** (Hunter 는 3, Quant/Grounded 는 6-7 등)
- Buy 클릭 → PurchaseModal (set mode)
- Details 클릭 → 세트 상세 모달

### 2-3. 세트 상세 모달

```
┌──────────────────────────────────┐
│ Quant AI — Set contents          │
│ ────────────────────────         │
│ [PROMPT] Quantitative Analyst    │
│   Multi-asset analyst role       │
│                                   │
│ [MCP] Crypto Price                │
│   CoinGecko price fetch           │
│                                   │
│ [SKILL] JSON Strict · Decomp ·   │
│   Citation                        │
│                                   │
│ [ORCH] Plan-and-Execute           │
│ [MEM]  Short-term                 │
│ ────────────────────────         │
│ [Buy complete set — 90 cr]       │
└──────────────────────────────────┘
```

- 정보만 표시, **개별 Buy 버튼 없음**
- 하단 CTA 하나만: 세트 일괄 구매

### 2-4. By Component 탭

서브탭:
```
[PROMPT] [MCP] [SKILL] [ORCH] [MEM]
```

- Workshop 인벤토리 (`mockInventory`) 그대로 필터링
- 카드 = 읽기 전용, 가격 표시 없음
- 카드 클릭 → 컴포넌트 상세 모달:
  ```
  [PROMPT] Quantitative Analyst
  ──────────────────
  Multi-asset analyst — compares crypto…
  Domain: 💹 Quant
  [Equip in Workshop →]
  ```
- Equip in Workshop → `/start/workshop` 이동 (카드 focus 파라미터는 이번 스코프 밖, 단순 페이지 이동만)

---

## 3. 데이터 모델 — 서버가 단일 진실

### 3-1. **서버가 Shop 세트 정의의 source of truth** (결정 D8)

- Shop 세트 목록을 서버에 정의 (`apps/api/src/modules/kaas/shop/shop-sets.registry.ts`)
- 프론트는 `GET /v1/kaas/shop/sets` 로 받아서 렌더
- **장점**:
  - 프론트-서버 중복 제거 (`equippedForDomain` 공유 문제 해소)
  - Workshop `buildForSet` 과도 서버 한 곳에서만 관리
  - 가격 계산도 서버에서 일관 수행

### 3-2. `ShopSet` 데이터 구조 (API 응답)

```typescript
interface ShopSet {
  id: string                  // "set-quant"
  domain: "hunter" | "quant" | "grounded" | "policy"
  title: string               // "Quant AI"
  subtitle: string            // "Multi-asset crypto analyst"
  icon: string                // "💹"
  equipped: AgentBuildInput   // prompt/mcp/skillA/skillB/skillC/orchestration/memory
  slotCount: number           // 실제 채워진 슬롯 수 (3~7)
  priceBundled: number        // 서버 계산 (tier 기반)
  components: ShopSetComponent[]  // 상세 모달용
}

interface ShopSetComponent {
  slot: "prompt" | "mcp" | "skillA" | "skillB" | "skillC" | "orchestration" | "memory"
  cardId: string              // "inv-p-quant"
  title: string               // "Quantitative Analyst"
  summary: string             // 한 줄 설명
}
```

### 3-3. 가격 정책 (tier 기반, 균형 유지)

| 슬롯 수 | 가격 | 비고 |
|--------|------|------|
| 3 | 60 cr | Hunter 같은 경량 세트 |
| 4-5 | 90 cr | 중형 |
| 6-7 | 120 cr | Quant/Grounded 같은 풀세트 |

- 균일 tier 로 Hunter(3)와 Quant(7)의 가격 차이 완화
- 번들 할인은 이미 tier 가격에 반영 (낱개 합 대비 약 15-20% 저렴)

### 3-4. 컴포넌트는 DB 불필요

- By Component 탭 = 읽기 전용, 서버 호출 없음
- `mockInventory` 그대로 사용 (프론트에서 필터)

### 3-5. Knowledge concepts 처리 (D2)

- Shop 에서 **완전 제외**
- 기존 `KaasCatalogPage` 는 메인 사이트 (`/`) 에서만 유지

---

## 4. 구매 플로우 — Install Skill 재사용

### 4-1. 신규 엔드포인트

`POST /api/v1/kaas/sets/buy-and-install`

```json
{
  "set_id": "set-quant",
  "api_key": "ck_live_...",
  "chain": "status"
}
```

### 4-2. 서버 순서

1. `resolveShopSet(set_id)` → 없으면 404
2. `kaasAgentService.findByApiKey(api_key)` → 없으면 401
3. `ws.isAgentConnected(agent.id)` → 아니면 409
4. `credits.balance(api_key) < priceBundled` → 402
5. 트랜잭션:
   - **5a. 크레딧 차감** `credits.deduct(api_key, priceBundled)`
   - **5b. Provenance 기록** (세트 단위 tx 1건, `concept_id: set_id`)
     - Provenance 테이블 `concept_id` FK 제약 문제 대응: Phase 0 에서 DB 스키마 확인. 필요 시 `concepts` 테이블에 `set-*` seed row 추가 or FK 완화
   - **5c. Install 실행** `installBuildService.install(agent.user_id, agent.id, { build_id: set_id, build_name: title, equipped })`
6. **실패 처리**:
   - 전체 실패 → `credits.refund(api_key, priceBundled)` 호출 (없으면 Phase 2 에서 새로 구현) → 500 반환
   - **부분 실패 (일부 컴포넌트만 설치)** → **전액 환불** (간단·사용자 친화적) → 207 Multi-Status + `partial: true` 응답
7. 응답:
```json
{
  "installed": [...],
  "skipped": [...],
  "failed": [...],
  "credits_consumed": 90,
  "credits_after": 410,
  "provenance": { "hash": "0x…", "chain": "status", "explorer_url": "…", "on_chain": true },
  "activation_prompt": "cherry quant 로 ...",
  "partial": false
}
```

### 4-3. 프론트 플로우

```
[Shop By Domain] Buy set
  ↓
PurchaseModal open (mode="set")
  Cherry default → sleeping → celebrate/confused
  ↓
성공 시 window.dispatchEvent("kaas-purchase-complete")
  ↓
Shop catalog Compare 재실행 → 세트 카드 OWNED 뱃지
에이전트 self-report 자동 갱신
```

### 4-4. 검증 = self-report

- Buy 성공 ≠ 설치 완료. 반드시 `local_skills.items` 에서 세트 컴포넌트 확인
- 부분 실패 → PurchaseModal error phase + "환불됐습니다. 재시도하세요" 메시지

---

## 5. 파일 영향 범위

### 신규 (server)
- `apps/api/src/modules/kaas/shop/shop-sets.registry.ts` — Shop 세트 정의 **단일 진실**
- `apps/api/src/modules/kaas/shop/shop.controller.ts` — `GET /shop/sets` + `POST /sets/buy-and-install`
- `apps/api/src/modules/kaas/shop/buy-set.service.ts`
- `apps/api/src/modules/kaas/credits.service.ts` 에 `refund(apiKey, amount)` 추가 (없을 경우)

### 신규 (web)
- `apps/web/components/cherry/shop-set-card.tsx`
- `apps/web/components/cherry/shop-set-detail-modal.tsx`
- `apps/web/components/cherry/shop-component-card.tsx`
- `apps/web/components/cherry/shop-component-detail-modal.tsx`
- `apps/web/components/cherry/shop-subtabs.tsx` — 서브탭 재사용 가능 컴포넌트
- `apps/web/components/cherry/slot-badge-bar.tsx` — 슬롯 배지 바 (TYPE_THEME 사용)

### 수정
- `apps/web/app/start/shop/page.tsx` — 2대탭 라우팅
- `apps/web/components/cherry/purchase-modal.tsx` — `mode: "set" | "component"` prop
- `apps/web/lib/api.ts` — `fetchShopSets()`, `buySet(apiKey, setId, chain)`
- `apps/web/components/cherry/kaas-workshop-panel.tsx` — `TYPE_THEME` export
- `apps/api/src/modules/kaas/kaas.module.ts` — 새 controllers/services 등록

### 제거
- Shop 에서 `KaasCatalogPage` 직접 사용 제거 (메인 사이트 전용)

---

## 6. Workshop과의 일관성

| 항목 | Workshop | Shop By Domain | Shop By Component |
|------|----------|----------------|-------------------|
| 슬롯 색·아이콘 | TYPE_THEME | **동일 (export 재사용)** | **동일** |
| 도메인 매핑 | `setTag` | 서버가 `setTag` 기반 파생 | `setTag` 필터 |
| 풀세트 설치 | Fullset Equip 버튼 | Buy set (구매+설치) | — |
| 개별 카드 | 드래그 장착 | — | Equip in Workshop 링크 (페이지 이동) |
| OWNED 뱃지 | — (슬롯 장착 개념만) | self-report 기반 | — |

---

## 7. 비범위

- 컴포넌트 낱개 구매
- Knowledge concepts (A-MEM/RLoT 등)
- Workshop 활성 빌드 자동 장착
- `?focus=<cardId>` 쿼리 파라미터 Workshop 쪽 처리 (단순 페이지 이동만)
- 세트 커스터마이즈 (Workshop 몫)
- 다국어 (영어 고정)

---

## 8. 결정 기록

| # | 결정 | 이유 |
|---|------|------|
| D1 | 낱개 구매 제외 | 데이터 모델 충돌 회피, 구현 ⅓ 감소 |
| D2 | Knowledge concepts 제거 | Shop 정체성 단순화 |
| D3 | 구매 = InstallBuildService 재사용 | 검증된 플로우, 신규 코드 최소화 |
| D4 | Provenance 세트 단위 tx 1건 | 메인 사이트 purchase 패턴 정합 |
| D5 | Workshop 자동 장착 없음 | 사용자 빌드 덮어쓰기 위험 회피 |
| D6 | tier 기반 가격 (60/90/120) | Hunter-Quant 가격 스펙트럼 완화 |
| D7 | `set-<tag>` id 컨벤션 | SetTag 와 1:1 |
| **D8** | **서버가 Shop 세트 single source of truth** | **프론트-서버 중복 제거, 가격 일관 계산** |
| **D9** | **부분 실패 시 전액 환불 + 207 반환** | **사용자 친화, 구현 단순** |
| **D10** | **Provenance FK 대응: Phase 0 에서 스키마 확인 → 필요 시 `set-*` seed row 추가** | **실제 DB 제약 확인 후 결정** |
