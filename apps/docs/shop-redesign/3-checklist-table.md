# Shop Redesign — QA Checklist (v3)

> v3 결정 반영: 서버 API source of truth / 전액 환불 / Hunter 가변 슬롯 / `?focus=` 제거

---

## Layout / Navigation

| # | 항목 | 합격 기준 |
|---|------|----------|
| L1 | Shop 진입 | 2대탭 (`By Domain` / `By Component`) 보임. 기본 = By Domain |
| L2 | 2대탭 전환 | 탭 클릭 시 서브탭 + 콘텐츠 교체 |
| L3 | 새로고침 | 기본값(By Domain)으로 복귀 (localStorage 안 씀) |
| L4 | StartFlowNav | Shop 단계 강조 |

---

## By Domain 탭

| # | 항목 | 합격 기준 |
|---|------|----------|
| D1 | 서브탭 라벨 | `ALL / Shopping / Quant / Research / Policy` — setTag 매핑 (hunter→Shopping, quant→Quant, grounded→Research, policy→Policy) |
| D2 | ALL 그리드 | 세트 4개 카드 표시. 서버 `GET /shop/sets` 응답 순서 그대로 |
| D3 | 도메인 서브탭 | 해당 세트 1개만 (hero) |
| D4 | 슬롯 배지 | Workshop TYPE_THEME **완전 동일** (P/M/S/O/M 색·아이콘) |
| D5 | Hunter 세트 슬롯 | `slotCount: 3` (prompt/mcp/memory만) — 3/7 표시 정상 |
| D6 | Quant/Grounded 슬롯 | `slotCount: 6~7` — 6/7 또는 7/7 정상 |
| D7 | 가격 tier | 3슬롯 = 60cr / 4-5 = 90cr / 6-7 = 120cr |
| D8 | [Buy set] 클릭 | PurchaseModal (set mode) 오픈 |
| D9 | [Details →] 클릭 | 세트 상세 모달. 구성 컴포넌트 목록 |
| D10 | 상세 모달 내부 | **개별 Buy 버튼 없음**. 하단 CTA 1개만 |
| D11 | 상세 모달 CTA | `Buy complete set — N cr` → 클릭 시 상세 닫고 PurchaseModal 열림 |

---

## By Component 탭

| # | 항목 | 합격 기준 |
|---|------|----------|
| C1 | 서브탭 | `PROMPT / MCP / SKILL / ORCH / MEM` |
| C2 | 카드 목록 | `mockInventory.filter(type)` 그대로 |
| C3 | 카드 스타일 | TYPE_THEME 일관. **가격 표시 없음**. **Buy 버튼 없음** |
| C4 | 카드 클릭 | 컴포넌트 상세 모달 |
| C5 | 상세 모달 | 제목 + 설명 + 도메인 태그 + `[Equip in Workshop →]` 링크 |
| C6 | Equip 클릭 | `/start/workshop` 이동 (단순 페이지 이동). focus 하이라이트는 미구현 — 정상 |

---

## 세트 구매 (Buy set) — D8

| # | 항목 | 합격 기준 |
|---|------|----------|
| B1 | Modal 오픈 | Cherry default, 세트 제목, 가격, Target AI 드롭다운 |
| B2 | Target AI 선택 | agents 목록 + 크레딧 잔액 표시 |
| B3 | Purchase 클릭 | `POST /shop/buy-and-install` 호출. Cherry sleeping, 로딩 메시지 순환 |
| B4 | 성공 200 | Cherry celebrate. `installed[]` 수 = `slotCount` (meta 제외). `credits_after` 표시 |
| B5 | Transaction 링크 | 서버 반환 `provenance.explorer_url` 클릭 시 새 탭 열림 — **가짜 URL 금지** |
| B6 | 활성화 프롬프트 | 영수증 아래 복사 명령어 (`cherry quant 로 ...`) |
| B7 | `kaas-purchase-complete` dispatch | Shop 복귀 시 세트 카드에 OWNED 오버레이 |

---

## 부분 실패 / 환불 — D9

| # | 항목 | 합격 기준 |
|---|------|----------|
| P1 | 전체 설치 실패 (500) | 서버가 `credits.refund` 호출 → 잔액 복구. PurchaseModal error phase |
| P2 | 부분 실패 (207) | 응답 `partial: true`. 서버가 전액 환불 → `credits_consumed: 0`. PurchaseModal error phase + "일부만 설치됨, 전액 환불" 메시지 |
| P3 | 환불 후 잔액 | API 호출 전 잔액과 정확히 일치 |
| P4 | 환불 로그 | `refund_log` 테이블에 reason 기록 (선택, 서버 구현 시) |

---

## 크레딧 / 체인

| # | 항목 | 합격 기준 |
|---|------|----------|
| K1 | 잔액 부족 | 402 반환. PurchaseModal error. "Not enough credits" |
| K2 | 정확 차감 | 잔액 = 기존 - `priceBundled` (1회) |
| K3 | 에이전트 미연결 | 409. "Agent offline" |
| K4 | 체인 기록 | provenance tx **1건 (세트 단위)**. `on_chain: true` + `explorer_url` 반환 |
| K5 | 체인 실패 (on_chain=false) | 설치는 진행. error 아님. explorer 링크 미표시 |
| K6 | provenance FK | Phase 0 에서 확인. `set-*` seed 있으면 정상, 없으면 제약 완화 상태 |

---

## Workshop 일관성

| # | 항목 | 합격 기준 |
|---|------|----------|
| W1 | 슬롯 배지 | TYPE_THEME **export 후 Shop 재사용**. 색·라벨 100% 동일 |
| W2 | setTag 변경 시 | 서버 `SERVER_INVENTORY_MIRROR` 수정 → Shop 자동 반영 (프론트 변경 불필요) |
| W3 | 세트 구매 후 Workshop | **자동 장착 없음** (D5). 사용자 별도 조립 필요 |
| W4 | 용어 | 모두 "set" / "complete AI" 혼용 금지. 일관되게 "set" 사용 |

---

## 데이터 정합성

| # | 항목 | 합격 기준 |
|---|------|----------|
| I1 | OWNED 소스 | 오직 agent self-report. DB fuzzy match 금지 |
| I2 | 파일 삭제 후 | `~/.claude/skills/cherry-*` 삭제 + Claude Code 재시작 → Shop OWNED 해제 |
| I3 | 다른 에이전트 전환 | 해당 에이전트 기준 OWNED 재계산 |
| I4 | 실제 tx hash | Status Sepolia / NEAR testnet 조회 가능 |
| I5 | 서버 데이터 정합 | `/shop/sets` 응답 = DB seed (있을 경우) + registry 정의가 일치 |

---

## 회귀 / 기타

| # | 항목 | 합격 기준 |
|---|------|----------|
| R1 | 메인 사이트(`/`) | `KaasCatalogPage` 그대로, 영향 없음 |
| R2 | Workshop Install Skill | 변경 없음 (Phase 2 가 `InstallBuildService` 재사용) |
| R3 | Benchmark 탭 | 영향 없음 |
| R4 | TS 컴파일 | 기존 미해결 외 0 에러 |
| R5 | Hydration | SSR/CSR mismatch 경고 없음 |
| R6 | Unauth | Shop 열면 로그인 유도 또는 빈 상태 |
| R7 | No agents | PurchaseModal 에서 "No AI connected" |

---

## 데모 시나리오 (심사자)

1. `/start/shop` → By Domain 탭, 세트 4개
2. Quant AI 카드 `Details →` → 구성 컴포넌트 6개 (slot별)
3. 모달 닫고 `Buy set` 클릭 → PurchaseModal
4. Target AI = 클로드 선택 → Purchase
5. Cherry 로딩 2-4초 → celebrate + 영수증 + Transaction 링크
6. Transaction 링크 클릭 → explorer 새 탭 열림
7. Done → 세트 카드에 OWNED 오버레이
8. Install Skill 탭 → Live proof 에서 `cherry-p-quant`, `cherry-m-crypto`, `cherry-s-*` 등 **slotCount + 1(meta)개** 디렉토리 확인
9. Claude Code `cherry quant 로 Compare BTC ETH SOL` → 정상 동작
10. By Component 탭 → PROMPT 서브탭 → Quantitative Analyst 카드 → Equip in Workshop → `/start/workshop` 이동

---

## Phase별 Exit Criteria

- **Phase 0 exit**: DB FK 확인 결과 기록 / TYPE_THEME export / credits.refund 유무 확정
- **Phase 1 exit**: `GET /shop/sets` curl 테스트 ✓ (4개 세트, slotCount 정확)
- **Phase 2 exit**: `POST /shop/buy-and-install` 성공 + 부분 실패 환불 + 크레딧 차감 정확
- **Phase 3 exit**: L1-L4, D1-D11, C1-C6, B1-B7 전부 ✓
- **Phase 4 exit**: W1-W4, I1-I5, OWNED 뱃지 정상
- **Phase 5 exit**: R1-R7 + 데모 시나리오 end-to-end ✓
