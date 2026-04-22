# Cherry Arena / Workshop / Special Agent Follow — 작업 지침서

**프로젝트 단계:** Cherry KaaS Phase 2 (A2A 이후 확장)
**시작일:** 2026-04-23
**범위:** 3개 기능 추가 — Workshop (대시보드 공방), Arena (분야별 순위 페이지), Special Agent Follow (상대 에이전트 팔로우)
**해커톤 포지셔닝:** "Follow top agents for continuous curation" — 지속적 큐레이션 구독 모델

---

## 0. 이 문서의 역할

이 폴더 `apps/docs/arena_plan/` 는 **Phase 2 구현을 위한 작업 도크**다.
- 기획 문서는 `apps/docs/arena/planning-artifacts/` (PRD / epics / architecture 의 Addendum 섹션)
- 구현 가이드·체크리스트·로그는 **이 폴더** (arena_plan)

KaaS_plan 과 동일한 4-파일 구조를 따른다:
| 파일 | 용도 |
|---|---|
| `1-work-guidelines.md` | 규칙 + 참조 맵 (지금 이 파일) |
| `2-implementation-guide.md` | 단계별 구현 가이드 — 따라하면 완성 |
| `3-checklist-table.md` | 항목별 시작/완료/테스트/검수 체크 |
| `4-progress-log.md` | 세션별 작업 기록 |

---

## 1. 커뮤니케이션 규칙

### 1-1. 설명 의무
- **사용자에게 알릴 때** — 무엇을 왜 하는지 먼저, 단계는 그 다음
- **AI가 진행할 때** — 지금 무엇을 왜 하는지 먼저 설명 후 실행. 설명 없이 코드부터 작성하지 않음
- **전문 용어** — 처음 등장 시 한 줄로 뜻 설명

### 1-2. 코드 수정 허가 규칙 (메모리 준수)
- **탐색 자유** — Read / Grep / Glob 는 언제든
- **수정 허락 필수** — Edit / Write / Bash(상태 변경) / git 은 사용자 승인 후
- **기획 먼저** — 큰 기능은 기획 → 검토 → 승인 → 구현 순서. 본 폴더가 그 기획 단계

---

## 2. 매 작업 시 필수 동작

1. **작업 시작 전** — `3-checklist-table.md` 에서 해당 Story 의 "시작" 컬럼에 날짜 기입
2. **작업 진행 중** — `2-implementation-guide.md` 의 해당 Story 를 그대로 따라 구현
3. **작업 완료 후** — 해당 Story 의 테스트 섹션 전부 실행 → 결과를 체크리스트에 `PASS / FAIL / SKIP` 로 기록
4. **대화 종료 시** — `4-progress-log.md` 에 세션 번호 + 작업 내용 + 변경 파일 + 이슈 3줄 이상 기록

---

## 3. 스코프 규칙 (Phase 2 핵심)

> **반드시 지킬 것.** Phase 2 의 3개 기능은 스코프가 다르다.

| 기능 | 구현 범위 | 이유 |
|---|---|---|
| **Workshop** (Epic 8) | **퍼블리싱만** — UI mock, localStorage/로컬 state | 해커톤 시연용. 실제 에이전트의 slot-equip 영속화는 Phase 3 |
| **Arena** (Epic 9) | **퍼블리싱만** — `arena-mock.ts` 정적 데이터 | 실제 매치메이커 / Elo 계산 / Judge LLM 은 해커톤 밖 |
| **Special Agent Follow** (Epic 10) | **풀스택** — DB 스키마, API, WS, UI 전부 | 이게 해커톤 핵심 데모 포인트 |

### 퍼블리싱 스코프에서 하면 안 되는 것
- Workshop 슬롯 장착 상태를 서버로 저장하지 말 것 (클라이언트 state 유지)
- Arena 랭킹을 서버 API 로 제공하지 말 것 (`arena-mock.ts` 에서 직접 import)
- 단, 위 mock 데이터의 **구조**는 실제 스키마와 일치하게 작성 (나중에 API 붙일 때 컴포넌트 수정 최소화)

### 풀스택 스코프에서 반드시 할 것 (Epic 10)
- `kaas.agent_follow` 테이블 생성 + 실행
- Follow API 6개 구현 (POST, DELETE, GET × 2, PATCH listing, 확장된 listActiveAgents)
- Follow 버튼 → 실제 DB 저장 + 실제 skill 배송 (WS `save_skill_request`)
- 역할 분리 / 복제 방지 가드 (서버 + 클라이언트 이중 검증)

---

## 4. 작업 순서 원칙

> 반드시 이 순서. 건너뛰면 종속성 꼬임.

```
Day 0 (사전 확인)
  └ 기존 A2A 인프라 상태 확인 (kaas.agent_task 테이블, WS gateway, MCP 도구)

Day 1 (Workshop 퍼블리싱)
  └ Story 8.1 5-슬롯 UI → 8.2 Inventory 패널 → 8.3 Market 등록 토글

Day 2 (Arena 퍼블리싱)
  └ Story 9.1 스캐폴딩 → 9.2 Hot 카드 → 9.3 카테고리 탭 → 9.4 Recent Matches

Day 3 (Special Agent Follow — 핵심)
  └ Story 10.1 스키마+API → 10.2 Market Special 탭 → 10.3 Diff 모달
    → 10.4 Follow 배송 → 10.5 가드 → (선택) 10.6 업데이트 알림

Day 4 (통합 데모)
  └ E2E 시나리오 리허설 + Cherry Console 연결 확인 + 데모 영상
```

**퍼블리싱 먼저 → 풀스택 나중** 이유:
1. UI 를 그려보면 데이터 모델이 역설계됨 (Workshop slot 구조 확정됨)
2. Workshop 에 Inventory 가 있어야 Follow 의 "어디에 설치될지" 가 보임
3. Arena 에 랭킹이 있어야 Market Special 탭의 "랭킹 배지" 가 의미를 가짐

---

## 5. 코드 작성 규칙

### 5-1. 파일 네이밍 / 위치
- 프론트 신규 컴포넌트: `apps/web/components/cherry/kaas-{feature}-page.tsx`
- 프론트 mock 데이터: `apps/web/lib/{feature}-mock.ts`
- 백엔드 신규 API: `apps/api/src/modules/kaas/kaas-{feature}.controller.ts` / `.service.ts`
- DB 마이그레이션: `apps/docs/staged_mock/kaas-{feature}-migration.sql`
- kebab-case 파일명, PascalCase 컴포넌트/클래스, camelCase 변수

### 5-2. 기존 인프라 재사용 원칙
- **NestJS `KaasModule`** 에 controller/service 등록. 새 모듈 만들지 말 것
- **A2A 재사용**: `KaasWsGateway.pushToAgent()`, `broadcastToConsoles()`, `kaas.agent_task` 테이블
- **Skill 배송**: WS `save_skill_request` (기존 구매 플로우와 동일 경로)
- **에이전트 인증**: `KaasAgentService.authenticate(apiKey)` (A2A 에서 이미 사용)

### 5-3. 커밋 규칙
- Story 단위 커밋: `feat: Story 8.1 — Workshop tab 5-slot UI`
- `apps/docs/arena/` / `apps/docs/arena_plan/` 는 커밋하지 않음 (gitignore 등록)
- force push 금지 (사전 승인 없이)
- 커밋 전 빌드 확인: `cd apps/web && npx next build` 또는 `cd apps/api && npm run build`

### 5-4. 테스트 규칙
- Story 완료 시 해당 Story 의 테스트 체크리스트 **모두** 실행
- 실패 시 다음 Story 로 넘어가지 않음
- 결과는 `3-checklist-table.md` 에 `PASS / FAIL / SKIP` 기록

---

## 6. 참조 문서 맵

| 문서 | 위치 | 용도 |
|---|---|---|
| Phase 2 PRD | `apps/docs/arena/planning-artifacts/prd.md` (Addendum) | FR37~58, NFR14~18 |
| Phase 2 Epics | `apps/docs/arena/planning-artifacts/epics.md` (Addendum) | Epic 8/9/10 스토리 + AC |
| Phase 2 Architecture | `apps/docs/arena/planning-artifacts/architecture.md` (Addendum) | 데이터 모델, API, A2A 재사용 |
| Product Brief (업데이트) | `apps/docs/arena/planning-artifacts/product-brief-cherry-kaas.md` (Addendum) | 포지셔닝 + 차별화 |
| A2A 기획 | `apps/docs/agent_read/a2a-implementation-plan-2026-04-19.md` | A2A 상세 (재사용 참고) |
| A2A 인수인계 | `apps/docs/agent_read/handoff-2026-04-19-a2a.md` | A2A 결정사항 |
| 현 백엔드 상태 | `apps/docs/agent_read/api-backend-status-2026-04-20.md` | kaas 모듈 전체 스냅샷 |
| 최근 작업 로그 | `apps/docs/agent_read/work-log-2026-04-20.md` | 04-13~04-20 커밋 |
| Phase 1 지침 (참고) | `apps/docs/KaaS_plan/1-work-guidelines.md` | KaaS 전체 지침 (블록체인/크레딧) |

---

## 7. 현재 인프라 (2026-04-23 기준)

### 완료된 것 (재사용 대상)
- **백엔드**: NestJS `kaas/` 모듈 완료 — controllers 9개(admin/agent/catalog/compare/credits/curator-reward/llm/mcp/query) + **a2a 포함**, WS gateway `KaasWsGateway` + `pushToAgent` + `broadcastToConsoles`, chain-adapter (status/near/mock/shared)
- **DB**: `kaas.agent`, `kaas.concept`, `kaas.evidence`, `kaas.query_log`, `kaas.curator_reward`, **`kaas.agent_task` (A2A)**
- **프론트**: `kaas-catalog-page`, `kaas-dashboard-page`, `kaas-admin-page`, `kaas-console`, `buzz-treemap`, `sidebar`
- **MCP 에이전트**: `apps/agent-package/` — 9개 도구 (search/get/purchase/follow/compare/self-report + a2a 3종)
- **A2A**: JSON-RPC 2.0 엔드포인트 `/v1/kaas/a2a`, `tasks/send|get|cancel|respond`, Agent Card, Inbox, 실시간 WS broadcast
- **온체인**: CherryCredit.sol (Status Sepolia), Karma 컨트랙트 읽기, NEAR TEE
- **배포**: 프론트 `https://solteti.site`, API `https://api.solteti.site`, DB Docploy 내부

### Phase 2 에서 새로 만들 것
- **DB**: `kaas.agent_follow` 테이블 + `kaas.agent` 에 `is_listed_on_market`, `listed_at` 컬럼
- **API**: Follow CRUD 5개 + listing PATCH + listActiveAgents 확장
- **프론트**: `kaas-arena-page.tsx` (신규), `special-agents-diff-modal.tsx` (신규), Workshop 탭 in Dashboard, Special Agents 탭 in Catalog
- **Mock 데이터**: `apps/web/lib/arena-mock.ts`, `workshop-mock.ts`, `special-agents-mock.ts`

---

## 8. 진행 흐름 (매 작업 루프)

```
1. 3-checklist-table.md → 다음 미완료 Story 확인
2. 2-implementation-guide.md → 해당 Story 섹션 읽기
3. 사전 조건 확인
4. 구현 단계 순서대로 실행
5. 테스트 체크리스트 전부 수행
6. 3-checklist-table.md → 결과 기록 (PASS/FAIL/SKIP + 날짜)
7. 4-progress-log.md → 세션 기록 append
8. 다음 Story 로 이동
```

**막히면**: 2-implementation-guide.md 의 "디버깅 치트시트" 섹션 참조 → 그래도 안 되면 사용자에게 확인

---

## 9. 환경 & 접근 정보

### 배포 URL
- 프론트: `https://solteti.site`
- API: `https://api.solteti.site`
- Swagger: `https://api.solteti.site/api`

### DB 접근 (로컬)
```bash
# SSH 터널 활성 상태 확인
lsof -i :15432
# 터널 없으면 (사용자에게 확인 필요):
# ssh -i ~/.ssh/cherry.pem -L 15432:db-cherry-board.cluster-...:5432 ubuntu@100.117.80.91 -N
```

### 테스트용 에이전트 (이미 생성됨)
- **Mac (claude_test_for_a2a)**: `8191c6e1-e9c1-4bbb-ab69-51e035fd2df5`
- **Linux (claude_linux_test)**: `f2dc68eb-6844-4e58-ad16-9998e7ab2383`
- api_key 는 대시보드에서 확인 후 환경변수로만 관리 (문서에 기록하지 말 것)

---

## 10. 완료 선언 기준

Phase 2 가 "완료" 로 간주되는 조건:

1. ☐ Workshop 탭에서 5 슬롯 장착/해제 동작 (mock)
2. ☐ Market 등록 토글 — 팔로우 중 disabled 상태 정확히 표시
3. ☐ Arena 페이지 렌더 — Hot/Champion/카테고리탭/Recent matches 4섹션
4. ☐ Market Special Agents 탭에 등록된 에이전트 카드 표시
5. ☐ Diff 모달에서 차집합 정확 표시 + Shared 카운트
6. ☐ Follow 버튼 → DB 저장 + skill 배송 + 인벤토리 즉시 반영
7. ☐ 역할 분리 / 복제 방지 가드 서버+클라 양쪽 작동
8. ☐ 3-checklist-table.md 모든 Story 항목 PASS
9. ☐ Mac ↔ Linux 크로스 에이전트 E2E 데모 1회 성공
10. ☐ Phase 2 통합 Git 커밋 + 태그 (`feat: Phase 2 — Workshop / Arena / Follow`)

**위 10개 중 1~8 은 필수, 9~10 은 시연 전 권장.**
