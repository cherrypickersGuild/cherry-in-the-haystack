# Cherry Arena / Workshop / Follow — 검수표

**최종 업데이트:** 2026-04-23 (초기 생성)

> 매 작업 시작/완료 시 이 파일을 업데이트할 것.
> 테스트 결과는 **PASS / FAIL / SKIP** 으로 기록.
> 검수/컨펌은 사용자(기획자) 확인 후 `O` 체크.

---

## Day 0 — 사전 확인

| # | 항목 | 담당 | 시작 | 완료 | 결과 | 비고 |
|---|---|---|---|---|---|---|
| 0-1 | git status / 미커밋 워킹트리 확인 | AI | 04-23 | 04-23 | PASS | arena_plan/ untracked, 본 세션 작업 전 정상 |
| 0-2 | 배포 API 200 응답 | AI | 04-23 | 04-23 | PASS | `curl https://api.solteti.site/api/v1/kaas/a2a/agents` |
| 0-3 | DB 포트 15432 LISTEN 중 | AI | 04-23 | 04-23 | PASS | SSH 터널 (이전 세션) |
| 0-4 | A2A agents 목록에 테스트 에이전트 2개 존재 | AI | 04-23 | 04-23 | PASS | claude_test_for_a2a + claude_linux_test (이전 세션) |
| 0-5 | 테스트 에이전트 id + api_key 확보 | 사용자 | 04-23 | 04-23 | PASS | 이전 세션에서 확보 |
| 0-6 | `apps/web` pnpm dev 정상 | AI | 04-23 | 04-23 | PASS | localhost:3000 응답 200 |
| 0-7 | Dashboard 모달 탭 구조 파악 | AI | 04-23 | 04-23 | PASS | 기존 탭 4개 (dashboard/curation/concept-page/template) |

---

## Day 1 — Workshop 탭 (Epic 8, 퍼블리싱)

### Story 8.1 — 5-슬롯 장착 UI

| # | 항목 | 시작 | 완료 | 테스트 | 검수 | 컨펌 | 비고 |
|---|---|---|---|---|---|---|---|
| 8.1-a | `workshop-mock.ts` 작성 | 04-23 | 04-23 | PASS | | | 타입/Mock 6개/SLOT_META 포함 |
| 8.1-b | `kaas-workshop-panel.tsx` 생성 | 04-23 | 04-23 | PASS | | | 5 슬롯 + Inventory + 드래그드롭 + 필터 + Register 토글 |
| 8.1-c | Dashboard 모달에 Workshop 탭 추가 | 04-23 | 04-23 | PASS | | | tabs 배열 + activeTab 타입 확장 + content 렌더 |
| 8.1-d | page.tsx onTabChange 분기 추가 | 04-23 | 04-23 | PASS | | | dashboardTab 타입 + Console currentPage |
| 8.1-T1 | 탭 가시 | 04-23 | | | | | 사용자 확인 필요 |
| 8.1-T2 | 패널 렌더 (5 슬롯 + Inventory 6) | 04-23 | | | | | 사용자 확인 필요 |
| 8.1-T3 | 드래그 장착 | 04-23 | | | | | 사용자 확인 필요 |
| 8.1-T4 | 해제 (× 버튼) | 04-23 | | | | | 사용자 확인 필요 |
| 8.1-T5 | 타입 검증 (accept 외 거부) | 04-23 | | | | | equip() 에 검증 로직 포함, 시각적 피드백 (빨간 border + pulse) |
| 8.1-T6 | localStorage 유지 | 04-23 | | | | | `cherry_workshop_state_v1` 키 |
| 8.1-T7 | Cherry Console currentPage | 04-23 | | | | | "Dashboard › Workshop" 분기 추가됨 |
| 8.1-D1 | TypeScript 에러 없음 | 04-23 | 04-23 | PASS | | | 신규 파일 tsc 통과, 기존 에러는 내 변경 이전 것 |
| 8.1-D2 | dev 서버 응답 | 04-23 | 04-23 | PASS | | | localhost:3000 200 |

### Story 8.2 — Inventory 필터

| # | 항목 | 시작 | 완료 | 테스트 | 검수 | 컨펌 | 비고 |
|---|---|---|---|---|---|---|---|
| 8.2-a | InventoryFilter 컴포넌트 | | | | | | |
| 8.2-b | 호버 툴팁 | | | | | | |
| 8.2-T1 | All 필터 | | | | | | 6개 |
| 8.2-T2 | SKILL 필터 | | | | | | 3개 |
| 8.2-T3 | MCP 필터 | | | | | | 2개 |
| 8.2-T4 | MEMORY 필터 | | | | | | 1개 |
| 8.2-T5 | followed 소스 배지 | | | | | | "via @..." |
| 8.2-T6 | 호버 툴팁 정보 | | | | | | |

### Story 8.3 — Market 등록 토글 + 가드

| # | 항목 | 시작 | 완료 | 테스트 | 검수 | 컨펌 | 비고 |
|---|---|---|---|---|---|---|---|
| 8.3-a | RegisterToggle 컴포넌트 | | | | | | |
| 8.3-b | Mock 디버그 전환 버튼 | | | | | | 데모용 |
| 8.3-T1 | 기본 상태 (OFF, 활성) | | | | | | |
| 8.3-T2 | 토글 ON → localStorage 반영 | | | | | | |
| 8.3-T3 | 팔로우 중 가드 | | | | | | disabled + 툴팁 |
| 8.3-T4 | 복제 가드 | | | | | | similarity ≥0.8 |
| 8.3-T5 | Market 반영 (Day 3 완료 후 재확인) | | | | | | |

**Day 1 완료 체크**

| # | 항목 | 완료일 |
|---|---|---|
| Day 1-D1 | Story 8.1~8.3 전부 PASS | |
| Day 1-D2 | 빌드 에러 없음 (`npx next build`) | |
| Day 1-D3 | 커밋 `feat: Story 8.1-8.3` | |

---

## Day 2 — Arena 페이지 (Epic 9, 퍼블리싱)

### Story 9.1 — 스캐폴딩 + 사이드바

| # | 항목 | 시작 | 완료 | 테스트 | 검수 | 컨펌 | 비고 |
|---|---|---|---|---|---|---|---|
| 9.1-a | `arena-mock.ts` 작성 | | | | | | |
| 9.1-b | `kaas-arena-page.tsx` 기본 컴포넌트 | | | | | | |
| 9.1-c | 사이드바 Arena 항목 추가 | | | | | | desktop + mobile |
| 9.1-d | page.tsx `case "kaas-arena"` | | | | | | |
| 9.1-T1 | 사이드바 항목 렌더 | | | | | | |
| 9.1-T2 | 클릭 라우팅 | | | | | | |
| 9.1-T3 | 모바일 사이드바 | | | | | | |
| 9.1-T4 | 네트워크 의존성 0 | | | | | | DevTools Network |

### Story 9.2 — Hot This Week

| # | 항목 | 시작 | 완료 | 테스트 | 검수 | 컨펌 | 비고 |
|---|---|---|---|---|---|---|---|
| 9.2-a | HotSection 컴포넌트 | | | | | | |
| 9.2-b | CTA 임시 동작 | | | | | | alert 또는 콘솔 |
| 9.2-T1 | 배너 카드 렌더 | | | | | | |
| 9.2-T2 | 배지 + 카피 | | | | | | |
| 9.2-T3 | CTA 버튼 2개 | | | | | | View Diff / Follow |

### Story 9.3 — Champion + 카테고리 + Top 10

| # | 항목 | 시작 | 완료 | 테스트 | 검수 | 컨펌 | 비고 |
|---|---|---|---|---|---|---|---|
| 9.3-a | ChampionSection | | | | | | |
| 9.3-b | CategoryTabs | | | | | | RAG/Agents/Reasoning |
| 9.3-c | Leaderboard (Top 10) | | | | | | |
| 9.3-T1 | Champion 렌더 | | | | | | |
| 9.3-T2 | 탭 3개 | | | | | | |
| 9.3-T3 | 탭 전환 데이터 교체 | | | | | | |
| 9.3-T4 | 🥇🥈🥉 이모지 | | | | | | |
| 9.3-T5 | 행 호버 반응 | | | | | | |

### Story 9.4 — Recent Matches

| # | 항목 | 시작 | 완료 | 테스트 | 검수 | 컨펌 | 비고 |
|---|---|---|---|---|---|---|---|
| 9.4-a | RecentMatchesFeed | | | | | | |
| 9.4-b | (선택) 주기 셔플 | | | | | | |
| 9.4-T1 | 5~10개 매치 렌더 | | | | | | |
| 9.4-T2 | 상대 시간 표시 | | | | | | |
| 9.4-T3 | 카테고리 배지 | | | | | | |
| 9.4-T4 | Cherry Console 스타일 통일 | | | | | | |

**Day 2 완료 체크**

| # | 항목 | 완료일 |
|---|---|---|
| Day 2-D1 | Story 9.1~9.4 전부 PASS | |
| Day 2-D2 | 빌드 에러 없음 | |
| Day 2-D3 | 커밋 `feat: Story 9.1-9.4 — Arena publishing` | |

---

## Day 3 — Special Agent Follow (Epic 10, 풀스택 핵심)

### Story 10.1 — 스키마 + API

| # | 항목 | 시작 | 완료 | 테스트 | 검수 | 컨펌 | 비고 |
|---|---|---|---|---|---|---|---|
| 10.1-a | SQL 마이그레이션 파일 작성 | | | | | | `kaas-agent-follow-migration.sql` |
| 10.1-b | DB 에 SQL 실행 (**사용자 DBeaver**) | | | | | | AI 직접 실행 불가 (pg_hba) |
| 10.1-c | `kaas-follow.controller.ts` (4 endpoints) | | | | | | follow/unfollow/follows/followers |
| 10.1-d | `kaas-follow.service.ts` | | | | | | follow/unfollow/list/toggleListing |
| 10.1-e | **KaasAgentController 에 PATCH :id/listing 추가** | | | | | | `/v1/kaas/agents/:id/listing` |
| 10.1-f | Module 등록 (controllers/providers) | | | | | | |
| 10.1-g | `listActiveAgents` 확장 (listed + 집계) | | | | | | skills_count/followers_count |
| 10.1-h | `follow()` 에서 `kaas.concept` lookup (content_md 조회) | | | | | | save_skill_request 실제 배송 |
| **Swagger/curl 테스트** | | | | | | | |
| 10.1-T1 | DB 테이블 존재 | | | | | | `\d kaas.agent_follow` |
| 10.1-T2 | DB 컬럼 추가 확인 | | | | | | `is_listed_on_market` |
| 10.1-T3 | Swagger 섹션 노출 | | | | | | "A2A — Follow" |
| 10.1-T4 | POST /follow 성공 | | | | | | 200 + followId |
| 10.1-T5 | 자기자신 follow | | | | | | 400 |
| 10.1-T6 | 미등록 타겟 follow | | | | | | 403 |
| 10.1-T7 | 중복 follow (재활성화) | | | | | | unfollowed_at=null 갱신 |
| 10.1-T8 | GET /follows | | | | | | 배열 |
| 10.1-T9 | DELETE /follow/:id | | | | | | unfollowed_at 기록 |
| 10.1-T10 | Listing 가드 FOLLOWER_CANNOT_REGISTER | | | | | | 409 |
| 10.1-T11 | Listing 가드 ANTI_CLONE_BLOCKED | | | | | | 409 |
| 10.1-T12 | agents?listed=true 필터 | | | | | | |

### Story 10.2 — Market Special Agents 탭

| # | 항목 | 시작 | 완료 | 테스트 | 검수 | 컨펌 | 비고 |
|---|---|---|---|---|---|---|---|
| 10.2-a | Catalog 페이지 탭 구조 확장 | | | | | | |
| 10.2-b | `SpecialAgentsPanel` 컴포넌트 | | | | | | |
| 10.2-c | SpecialAgentCard 컴포넌트 | | | | | | |
| 10.2-T1 | 탭 가시 | | | | | | Catalog 에 탭 |
| 10.2-T2 | listed 에이전트 카드 리스트 | | | | | | 내 것 제외 |
| 10.2-T3 | Loading 상태 | | | | | | |
| 10.2-T4 | Empty 상태 | | | | | | |
| 10.2-T5 | 카드 디자인 구분 | | | | | | 개념 카드와 다름 |

### Story 10.3 — Diff 모달

| # | 항목 | 시작 | 완료 | 테스트 | 검수 | 컨펌 | 비고 |
|---|---|---|---|---|---|---|---|
| 10.3-a | `diff-utils.ts` computeSkillDiff | | | | | | |
| 10.3-b | `special-agents-diff-modal.tsx` | | | | | | |
| 10.3-T1 | 차집합 정확 | | | | | | set difference |
| 10.3-T2 | Shared 카운트만 표시 | | | | | | 타이틀 숨김 |
| 10.3-T3 | 차집합 0 시 축하 메시지 | | | | | | |
| 10.3-T4 | Viewer 미선택 안내 | | | | | | |
| 10.3-T5 | 각 행 Follow 버튼 | | | | | | |

### Story 10.4 — Follow 버튼 → 배송

| # | 항목 | 시작 | 완료 | 테스트 | 검수 | 컨펌 | 비고 |
|---|---|---|---|---|---|---|---|
| 10.4-a | `followAgent` / `unfollowAgent` API 함수 | | | | | | |
| 10.4-b | DiffModal onFollow 핸들러 | | | | | | |
| 10.4-c | `cherry:inventory-updated` 이벤트 | | | | | | |
| 10.4-d | Workshop 이벤트 리스너 | | | | | | |
| 10.4-T1 | Follow → DB INSERT | | | | | | |
| 10.4-T2 | agent.knowledge 갱신 | | | | | | |
| 10.4-T3 | WS save_skill_request 전송 | | | | | | |
| 10.4-T4 | Workshop Inventory 반영 | | | | | | |
| 10.4-T5 | 토스트 메시지 | | | | | | |
| **E2E 테스트** (Mac ↔ Linux) | | | | | | | |
| 10.4-E1 | Mac 등록 → Linux 에서 카드 발견 | | | | | | |
| 10.4-E2 | Linux 가 Mac Follow | | | | | | |
| 10.4-E3 | Linux Workshop 에 새 skill | | | | | | |
| 10.4-E4 | DB 레코드 확인 | | | | | | |

### Story 10.5 — 역할 분리 / 복제 방지 (클라이언트)

| # | 항목 | 시작 | 완료 | 테스트 | 검수 | 컨펌 | 비고 |
|---|---|---|---|---|---|---|---|
| 10.5-a | Workshop isFollowingAny 실시간 조회 | | | | | | |
| 10.5-b | Register 토글 → PATCH listing 연결 | | | | | | |
| 10.5-c | 에러코드별 토스트 | | | | | | |
| 10.5-T1 | 팔로우 없음 → 등록 성공 | | | | | | |
| 10.5-T2 | 팔로우 후 등록 시도 → 409 | | | | | | |
| 10.5-T3 | 언팔 후 재등록 → 성공 | | | | | | |
| 10.5-T4 | Clone 재등록 → 409 ANTI_CLONE | | | | | | |
| 10.5-T5 | UI disabled 상태 일관성 | | | | | | |

### Story 10.6 — (선택) 팔로우 업데이트 자동 배송

| # | 항목 | 시작 | 완료 | 테스트 | 검수 | 컨펌 | 비고 |
|---|---|---|---|---|---|---|---|
| 10.6-a | purchase 훅에 follower 배송 추가 | | | | | | |
| 10.6-b | `followed_agent_updated` 이벤트 | | | | | | |
| 10.6-c | 프론트 "pending equip" 배지 | | | | | | |
| 10.6-T1 | 업데이트 이벤트 수신 | | | | | | |
| 10.6-T2 | Inventory 배지 표시 | | | | | | |

**Day 3 완료 체크**

| # | 항목 | 완료일 |
|---|---|---|
| Day 3-D1 | Story 10.1~10.5 전부 PASS | |
| Day 3-D2 | 10.1 Swagger 테스트 12개 PASS | |
| Day 3-D3 | 10.4 E2E 3회 연속 성공 | |
| Day 3-D4 | 빌드 에러 없음 (프론트 + API) | |
| Day 3-D5 | 커밋 `feat: Story 10.1-10.5 — Special Agent Follow` | |

---

## Day 4 — 통합 데모 리허설

| # | 항목 | 시작 | 완료 | 결과 | 비고 |
|---|---|---|---|---|---|
| 4-0a | Mac MCP 프로세스 기동 | | | | `node cherry-agent.js` |
| 4-0b | Linux MCP 프로세스 기동 | | | | ssh 세션 |
| 4-0c | 서버 WS 연결 로그 확인 (양쪽) | | | | `[WS] ✓ connected` |
| 4-0d | 브라우저 2개 (Mac/Linux 에이전트 선택) | | | | 시크릿탭 또는 다른 프로필 |
| 4-1 | E2E 시나리오 1회 | | | | 9 단계 |
| 4-2 | E2E 시나리오 2회 | | | | |
| 4-3 | E2E 시나리오 3회 | | | | 연속 성공 |
| 4-4 | Cherry Console agent_followed 수신 | | | | (선택) |
| 4-5 | 프론트 배포 빌드 | | | | `next build` |
| 4-6 | API 배포 빌드 | | | | `npm run build` |
| 4-7 | 데모 영상 녹화 (2~3분) | | | | |
| 4-8 | README / 제출 자료 업데이트 | | | | |
| 4-9 | 최종 커밋 + 태그 `v0.2.0-phase2` | | | | |

---

## 종합 완료 매트릭스

| 영역 | 기능 | 상태 |
|---|---|---|
| **Workshop** (Epic 8) | 5 슬롯 장착 UI | ⬜ |
| | Inventory 필터 | ⬜ |
| | Market 등록 토글 + 가드 | ⬜ |
| **Arena** (Epic 9) | Hot 배너 | ⬜ |
| | Champion + 카테고리 탭 Top 10 | ⬜ |
| | Recent Matches | ⬜ |
| **Follow** (Epic 10) | 스키마 + API (5 endpoints) | ⬜ |
| | Market Special 탭 | ⬜ |
| | Diff 모달 (차집합) | ⬜ |
| | Follow → DB + 배송 | ⬜ |
| | 역할 분리 / 복제 방지 가드 | ⬜ |
| **통합** | E2E Mac ↔ Linux | ⬜ |
| | 데모 영상 | ⬜ |

---

## 검수 원칙

- **PASS**: 테스트 시나리오대로 동작, 에러 없음
- **FAIL**: 일부/전체 실패 — 해결 후 재검수
- **SKIP**: 시간 부족 또는 환경 제약 — 비고에 이유 기록
- **검수(O)**: 기능/UI 시각 확인 완료
- **컨펌(O)**: 사용자(기획자) 최종 승인
