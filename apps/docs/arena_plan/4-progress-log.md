# Cherry Arena / Workshop / Follow — 진행 로그

> 매 대화 종료 시 반드시 아래 형식으로 기록할 것.
> 세션 번호는 순차, 날짜는 KST 기준.

---

## 기록 템플릿

```
### 세션 N: [한 줄 제목]

**일시:** 2026-MM-DD (요일)
**작업 범위:** Story X.Y ~ Z.W
**상태:** 진행 중 / 완료

**작업 내용:**
- 무엇을 했는지 (구현/수정/테스트)
- 왜 그렇게 했는지 (결정 배경)

**변경 파일:**
- `경로/파일명.확장자` (신규 / 수정 / 삭제)

**테스트 결과:**
- 통과: X.Y-T1, X.Y-T2
- 실패: X.Y-T3 (이유)
- 건너뜀: X.Y-T4 (이유)

**이슈 / 의사결정:**
- 사용자와 합의한 내용
- 기획서에 없던 결정
- 다음 세션에 이어가야 할 것

**다음 세션 할 일:**
- [ ] Story X.Y
- [ ] 버그 수정: ...
```

---

## 세션 0: 기획서 작성 (메타)

**일시:** 2026-04-23 (목)
**작업 범위:** `apps/docs/arena_plan/` 폴더 및 4 파일 신규 작성
**상태:** 완료

**작업 내용:**
- `apps/docs/arena/planning-artifacts/` 의 PRD / Epics / Architecture / Product Brief 에 Phase 2 Addendum 추가 (FR37~58, Epic 8/9/10, 데이터 모델, 포지셔닝)
- Phase 2 구현용 작업 도크 `apps/docs/arena_plan/` 신규 생성
- `1-work-guidelines.md` — 지침 + 참조 맵 + 스코프 규칙
- `2-implementation-guide.md` — Day 0~4 단계별 구현 가이드 (Story 8.1 ~ 10.6)
- `3-checklist-table.md` — 전 Story 항목별 PASS/FAIL/검수/컨펌 체크리스트
- `4-progress-log.md` — 본 로그 파일 (템플릿 포함)

**왜:**
- 사용자 요청: "apps > docs > arena_plan 디렉토리에 KaaS_plan 참고해서 단계별 구현 기획서 만들어줘"
- "단계별로 따라하기만 해도 완벽하게 제작되어야 하고, 테스트 검수목록 포함"
- 작업 시작 전 기획 단계 명확화가 목적

**변경 파일:**
- `apps/docs/arena/planning-artifacts/prd.md` (수정 — Phase 2 Addendum)
- `apps/docs/arena/planning-artifacts/epics.md` (수정 — Epic 8/9/10)
- `apps/docs/arena/planning-artifacts/architecture.md` (수정 — 데이터 모델)
- `apps/docs/arena/planning-artifacts/product-brief-cherry-kaas.md` (수정 — 포지셔닝)
- `apps/docs/arena_plan/1-work-guidelines.md` (신규)
- `apps/docs/arena_plan/2-implementation-guide.md` (신규)
- `apps/docs/arena_plan/3-checklist-table.md` (신규)
- `apps/docs/arena_plan/4-progress-log.md` (신규, 이 파일)

**이슈 / 의사결정:**
- Workshop 슬롯 구성: **2 시스템(Identity/Gear) + 3 스킬(Skill A/B/C)** 로 결정 (사용자 최종 확인 필요)
- Arena 카테고리: **RAG / Agents / Reasoning** 3개 + Hot This Week + Overall Champion
- 스코프: Workshop/Arena 는 **퍼블리싱만**, Special Agent Follow (Epic 10) 가 **풀스택 핵심**
- 역할 분리: "팔로우 중 등록 불가 (FOLLOWER_CANNOT_REGISTER)" + "복제본 등록 불가 (ANTI_CLONE_BLOCKED, Jaccard ≥ 0.8)"
- `.gitignore` 에 `apps/docs/arena_plan/` 추가 필요 — 사용자 확인 대기 중 (arena 폴더처럼 공개 전 상태 유지)

**다음 세션 할 일:**
- [ ] (사용자 확정 대기) Workshop 슬롯 구성 · Arena 카테고리 · Clone threshold · snapshot 정책
- [ ] `.gitignore` 에 `arena_plan` 추가 여부 결정
- [ ] Day 0 사전 확인 7개 체크 실행
- [ ] Story 8.1 Workshop 5-슬롯 UI 구현 착수

---

<!-- 여기부터 실제 구현 세션 append -->

## 세션 1: Day 0 + Story 8.1 (Workshop 5-슬롯 퍼블리싱)

**일시:** 2026-04-23 (목)
**작업 범위:** Day 0 사전 확인 7건 + Day 1 Story 8.1 (a,b,c,d)
**상태:** 코드 구현 완료, **사용자 UI 확인 대기**

**작업 내용:**
- Day 0 사전 확인: 7개 항목 전부 PASS (레포 상태, 배포 API 200, DB 터널, A2A 에이전트 2개, dev 서버 응답)
- Story 8.1-a: `workshop-mock.ts` 신규 작성. 타입(InventoryItem/SlotKey/WorkshopState) + SLOT_META 5개 + mockInventory 6개(skill 3, mcp 2, memory 1) + localStorage key
- Story 8.1-b: `kaas-workshop-panel.tsx` 신규 작성. 좌측 5 슬롯(Identity/Gear/SkillA/SkillB/SkillC), 우측 Inventory 그리드, 드래그드롭, 슬롯 타입 제약(accept 배열) 검증 + 거부 시 시각적 피드백(pulse), 필터 4종(All/Skill/MCP/Memory), Register 토글 + 가드(isFollowingAny / cloneSimilarity), 디버그 패널(mock 상태 전환), localStorage persist
- Story 8.1-c: `kaas-dashboard-page.tsx` 에 Workshop 탭 통합. activeTab 타입 확장, tabs 배열 삽입(Knowledge Curation 뒤, admin-only 앞), content 렌더 블록 추가, import 추가
- Story 8.1-d: `apps/web/app/page.tsx` 에 dashboardTab 타입 확장 + Cherry Console currentPage 분기에 "Dashboard › Workshop" 추가

**변경 파일:**
- `apps/web/lib/workshop-mock.ts` (신규, 117줄)
- `apps/web/components/cherry/kaas-workshop-panel.tsx` (신규, 268줄)
- `apps/web/components/cherry/kaas-dashboard-page.tsx` (수정 — import + activeTab 타입 + tabs 배열 + content 렌더 4곳)
- `apps/web/app/page.tsx` (수정 — dashboardTab 타입 + currentPage 분기)

**테스트 결과:**
- ✅ TypeScript 컴파일: 신규 파일 에러 없음 (기존 kaas-admin/dashboard 의 사전 에러는 내 변경 이전 것으로 확인)
- ✅ Dev 서버: localhost:3000 응답 200 유지
- ⏳ UI 검증 T1~T7: 사용자 확인 필요

**이슈 / 의사결정:**
- 슬롯 accept 타입: Identity=skill, Gear=mcp, Skill A/B/C=skill+memory 혼합으로 설정
- 거부 피드백: 빨간 border + `animate-pulse` 600ms (toast 없이 즉시 피드백)
- 디버그 패널은 `<details>` 로 접어두어 데모 시 필요시 펼쳐 쓰도록
- TypeBadge 색상: skill(골드), mcp(녹색), memory(보라)

**다음 세션 할 일:**
- [ ] **사용자 UI 검증**: Dashboard → Workshop 탭 클릭 → 5 슬롯 + Inventory 6개 표시 / 드래그드롭 / 타입 거부 / Register 토글 / localStorage / Cherry Console currentPage
- [ ] Story 8.2 (Inventory 호버 툴팁 — 선택적, 핵심은 이미 8.1 에서 커버됨)
- [ ] Story 8.3 (Register 토글 + 가드 — 이미 8.1 에서 구현됨, 재확인 및 테스트 항목만 마무리)
- [ ] **확인 후 Story 9 (Arena 페이지) 로 진행**

---

## 세션 2: Story 8.1 재설계 — 에이전트 실행 Flow 로 전환

**일시:** 2026-04-23 (목, 저녁)
**작업 범위:** Story 8.1 전면 재작업 (사용자 피드백 반영)
**상태:** 코드 재구현 완료, **사용자 UI 확인 대기**

**사용자 피드백:**
1. Workshop 탭 위치 → Dashboard 바로 다음 (Knowledge Curation 앞)
2. "Gear" 표현은 에이전트 프로그래밍에 없음 → MCP/Tools 로 수정
3. 단순 나열이 아닌 실행 Flow 로 시각화 필요
4. Foundation Model 은 **풀다운** (슬롯 X)
5. Orchestration 타입 추가

**작업 내용:**
- `workshop-mock.ts` 재작성:
  - `SkillType` = `prompt | mcp | skill | orchestration | memory` (5 타입)
  - 7 슬롯: Prompt / MCP / Skill A/B/C / Orchestration / Memory (각 slot 에 `flowStep` 속성 1~5 부여)
  - `LLM_OPTIONS` 8개 모델 프리셋 (Claude 3종 / OpenAI 2종 / Gemini / Llama / NEAR TEE) + `DEFAULT_LLM_MODEL`
  - `mockInventory` 17개로 확장 (prompt 3, mcp 3, skill 5, orch 3, memory 3) + `summary` 필드
  - `source` 에 `"builtin"` 추가 (시스템 내장)
  - `SKILL_TYPE_ORDER` export (필터 버튼 순서)
  - localStorage 키 v2 (`cherry_workshop_state_v2`) — 이전 v1 스키마와 호환 안 됨
- `kaas-workshop-panel.tsx` 전면 재작성:
  - 좌측: **Agent 카드 (이름/ID + Foundation Model 풀다운)** + **Flow 다이어그램** + Register 카드 3블록
  - Flow: ① Prompt ↓ ② MCP ↓ ③ [Skill A][Skill B][Skill C] (3 수평) ↓↓↓ ④ Orchestration ↓ ⑤ Memory
  - StepBadge 컴포넌트 — 검정 원 + 흰 번호 ①~⑤
  - FlowArrow 컴포넌트 — 단일/3중 화살표 (Skill 3개에서 내려오는 수렴 표현)
  - FlowSlot 컴포넌트 — compact 모드 (Skill 3개는 작게) + hideStepLabel 옵션
  - TYPE_THEME 객체로 5 타입 각각 배경/테두리/텍스트/뱃지 색상 분리
  - 우측: Inventory 카드 (좌측 border 컬러로 타입 시각화) + 6-way 필터 (All / PROMPT / MCP / SKILL / ORCH / MEM)
  - LLM 풀다운 변경 시 state.llmModel 업데이트 (localStorage persist)
- `kaas-dashboard-page.tsx`: tabs 배열에서 Workshop 을 Knowledge Curation 앞으로 이동 (= Dashboard 직후)

**변경 파일:**
- `apps/web/lib/workshop-mock.ts` (재작성, 234줄)
- `apps/web/components/cherry/kaas-workshop-panel.tsx` (재작성, 412줄)
- `apps/web/components/cherry/kaas-dashboard-page.tsx` (tabs 순서 1줄 swap)

**테스트 결과:**
- ✅ TypeScript 컴파일: 신규/수정 파일 에러 없음
- ✅ Dev 서버 localhost:3000 응답 200
- ⏳ UI 검증: 사용자 확인 필요

**이슈 / 의사결정:**
- LLM Model 은 슬롯 밖 풀다운 — 실제 에이전트 구성에서 Model 변경은 전체 재시작 수준이므로 드래그드롭 자산보다 설정값 UX 가 적절
- Skill 슬롯 3개는 hideStepLabel=true + compact=true → 수평 배치 시 공간 절약 + 번호 뱃지는 공통 "③" 하나만 상단에 표시
- localStorage 키 v1 → v2 (스키마 breaking change — 이전 세션 장착 상태는 초기화됨)
- Flow 화살표: Skill 3개 → Orchestration 수렴 부분은 3개 화살표로 시각적 병렬성 강조

**다음 세션 할 일:**
- [ ] **사용자 UI 검증** — 특히 Flow 가독성, Skill 3 수평 배치 비율, LLM 풀다운 크기
- [ ] 피드백 반영 후 Story 9 (Arena 페이지) 진행
