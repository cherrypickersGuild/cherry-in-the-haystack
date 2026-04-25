# Agent Trade — QA Checklist (Lean)

> diff + 구매 핵심만 검증.

---

## 핵심

| # | 항목 | 합격 기준 |
|---|------|----------|
| 1 | Shop 진입 | 큰 탭 3개 (`By Domain` / `By Component` / `By Agent`) |
| 2 | By Agent 클릭 | My agent 셀렉터 + 다른 에이전트 카드 그리드 |
| 3 | 자기 자신 제외 | 셀렉터에서 고른 에이전트는 카드에 안 보임 |
| 4 | Compare 클릭 | Diff 모달 열림. 3섹션 (Both / Only Theirs / Only Mine) |
| 5 | 빈 섹션 | "none" 같은 placeholder 표시 |
| 6 | Only Theirs · set Buy | PurchaseModal set 모드 → 구매 성공 → 잔액 차감 + SKILL.md 설치 |
| 7 | Only Theirs · concept Buy | PurchaseModal component 모드 → 동일 |
| 8 | Workshop card 항목 | Buy 버튼 없음. 정보만 |
| 9 | 구매 후 자동 갱신 | `kaas-purchase-complete` 수신 → diff 재호출 → 산 항목 Both 로 이동 |
| 10 | 미연결 에이전트 | self-report 빈 결과 → 모든 항목이 "Only Mine" 으로 보일 수 있음. 에러 안 남 |
| 11 | TS 컴파일 | 0 에러 (기존 미해결 제외) |

---

## 데모 시나리오

준비:
- 두 에이전트 (Mac/Linux) 동시 가동, 각각 다른 SKILL.md 설치

플로우:
1. `/start/shop` → By Agent
2. My agent = Mac
3. Linux 카드 Compare
4. Diff 모달: Both 일부 + Only Linux has 일부 + Only Mac has 일부
5. Only Linux 의 set 하나 Buy → 성공 → Both 로 이동 ✓
6. Only Linux 의 concept 하나 Buy → 성공 → Both 로 이동 ✓
