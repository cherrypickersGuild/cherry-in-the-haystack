# Install Skill — 진행 로그

시작일: 2026-04-24
작성 규칙: 각 세션 말미에 날짜 + 수행 Step + 결과 + 다음 세션 예정 작업 기록.

---

## 2026-04-24 (Day 0) · 기획 문서 작성

**담당**: AI (사용자 지시)

### 작업
- `apps/docs/install-skill/` 폴더 생성
- 4개 문서 초안 작성:
  - `1-work-guidelines.md` — 재활용/신규 구분, API 스펙, 파일 포맷, 타임라인
  - `2-implementation-guide.md` — Day 0~7 Step-by-step
  - `3-checklist-table.md` — 진행 상태 트래킹 표
  - `4-progress-log.md` — 이 파일

### 현재 전제 사항 (변경되면 문서 업데이트 필요)
- **재활용 가능 확인됨** (Explore agent 조사):
  - `save_skill_request` → `save_skill_ack` WebSocket 흐름 ([kaas-ws.gateway.ts:266-313](apps/api/src/modules/kaas/kaas-ws.gateway.ts:266))
  - `scanSavedSkills()` 에이전트 측 디렉토리 스캔 ([mcp-server.ts:36-60](apps/api/src/mcp-server.ts:36))
  - `fetchAgentSelfReport` 클라이언트 헬퍼 ([api.ts:508](apps/web/lib/api.ts:508))
  - Workshop localStorage `cherry_workshop_state_v9`
- **신규 필요**:
  - `cardToSkillFile` 직렬화
  - `POST /v1/kaas/agents/:id/install-build` 엔드포인트
  - `<InstallResultPanel>` side panel UI

### 스코프 결정
- 포함: prompt/skill 카드의 `~/.claude/skills/cherry-*/SKILL.md` 저장, build-meta.json 기록, 에이전트 self-report 재호출, side panel 표시
- 배제: 빌드 버전 관리, 다중 에이전트 동시 설치, 서버 측 빌드 registry

### 다음 세션
- 사용자가 `1-work-guidelines.md` 를 읽고 §3-3 비목표 리스트 포함 전체 스코프 동의 확인
- 동의 후 Day 1 STEP 1.1 (`serialize.ts` 신규) 착수

### 커밋
*(아직 없음 — 문서 초안만 생성)*

---

## 2026-04-24 (Day 0.5) · 기획 자체 검수 및 17건 이슈 반영

**담당**: AI (사용자 지시 "점검 수정해")

### 도출된 17 건 이슈
Day 0 초안 직후 꼼꼼 검토 → 🔴 5 · 🟡 5 · 🟢 7 개 이슈 도출. 사용자 승인 후 전부 문서 반영.

### 반영 요약
**1-work-guidelines.md**:
- §3-2: "중복 요청 차단" + "덮어쓰기 안전 순서" 원칙 추가
- §3-3: "MCP 도구 실제 주입 — 이 스코프 밖" 명시, "Claude Code 핫 리로드 불가" 전제 추가
- §4-1: `mcp` 슬롯 설명 재작성, `_meta` 행 추가, SKILL.md 확장자 강제 이유 기록
- §4-2: frontmatter 를 `name` + `description` 2 필드로 축소, custom 메타는 주석 블록에
- §4-3: build-meta 도 SKILL.md 포맷으로 변경 (scanSavedSkills 호환)
- §5: `isAgentConnected` + BMad SKILL.md precedent 추가
- §6: URL prefix `/api/v1/...` 명시, 에러코드 6개로 확장 (400/403/404/409/500/504)
- §8: 테스트 시나리오 4건 → 8건 확장 (중복클릭, 7슬롯, 세션재로드, 빈빌드)
- §11 신규: Observability & 로그 prefix 규약
- §12 신규: 17건 이슈 반영 기록 테이블

**2-implementation-guide.md**:
- Day 0 STEP 0.2: grep 키워드 5개로 확장 (`isAgentConnected` 추가)
- Day 0 STEP 0.3: empty localStorage 케이스 기대 결과 명시
- Day 0 STEP 0.4 신규: Claude Code `/skills` 핫 리로드 수동 검증
- Day 2 STEP 2.1: 4 게이트 (lock / 소유권 / 연결 / 빈빌드) + limited parallel 3 + atomic 고아 정리 순서 코드 예시 전면 재작성
- Day 2 STEP 2.3: curl 에 Bearer 헤더 추가, 미연결/중복 클릭 기대 결과 추가
- Day 5 STEP 5.2: 순서 "save → cleanup" 명시, 실패 경로 테스트 추가

**3-checklist-table.md**:
- Day 0: 4번 항목 추가 (Claude Code 핫 리로드 확인)
- Day 6 시나리오: 4건 → 11건으로 확장 (중복클릭 / 7슬롯 / 세션재로드 / 빈빌드 / frontmatter / 새로고침 / 403)
- 파일 하단 "Day 0 검수 반영 완료" 테이블 추가 (17 건 → 반영 위치 매핑)

**4-progress-log.md**:
- 이 엔트리 자체

### 남은 미결 항목
- Day 6 시나리오 6.7 (Claude Code 세션 재로드) 가 (a) 재시작 없이 인식 vs (b) 재시작 필수 — Day 0 STEP 0.4 실제 수행 결과에 따라 UX 경고 메시지 조정 필요
- 17 번째 이슈 (Day 6 fail 액션 기준) 은 TODO 로 남김 — Day 6 진입 전 룰 확정

### 다음 세션
- 사용자 2차 검수 요청 예정

### 커밋
*(아직 없음 — 문서 업데이트만)*

---

## 2026-04-24 (Day 0.6) · 2차 검수 — 15건 추가 반영 + Day 1.5 신설

**담당**: AI (사용자 지시 "한번만 더 검토 꼼꼼하게" → "반영")

### 도출 & 반영된 15건
1차 반영 후 재점검 → 새 15건 발견. 사용자 승인 후 모두 반영.

#### 🔴 Critical (#18~#22)
- **#18** in-flight = **Promise 공유** 모델로 확정. 409 Conflict 삭제
- **#19** `installed[]` 에서 meta 분리. `meta_written: boolean` 별도 필드
- **#20** HTTP 상태 분기 규칙 표 추가 (200 / 207 / 504 / 400 / 403 / 404 / 409 / 500). `classifyResult()` 헬퍼 도입
- **#21** save_skill_request payload = 기존 shape 그대로, `concept_id = "cherry-workshop-<cardId>"` synthetic. gateway 수정 0
- **#22** 디렉토리 이름 변환 규칙: `cardId.replace(/^inv-[pms]-/, '')` → `cherry-p-oracle` 형태. §4-1 "중요 2" 표

#### 🟡 Important (#23~#28)
- **#23** `delete_skill_request` 기존 코드에 **없음** grep 확인. **Day 1.5 신설** (45 min) — gateway `requestDeleteSkill()` + cherry-agent.js 핸들러 + path traversal 방어
- **#24** `run_id` (install 세션) vs `request_id` (개별 save) 역할 분리 표 — §11-2
- **#25** stdio MCP 경로 vs WebSocket 경로 구분 — §5 "install-build 는 WebSocket 경로만" 명시
- **#26** Day 0 STEP 0.4 결과 (a/b) 에 따라 재작성할 문서 위치 명시 — STEP 0.5 신설
- **#27** Day 1 테스트 스타일 = 기존 `compose-runtime.test.ts` `section()`+`ok()` 준수 명시
- **#28** Controller 에 `@UseGuards(JwtAuthGuard)` 필수 + `@CurrentUser()` 로 userId 획득 명시

#### 🟢 Minor (#29~#32)
- **#29** Workshop localStorage v8 이하 migration 안 함 — §3-3 비목표
- **#30** `warnings` 기본값 명시 + 0.4 결과 따라 조건부 — §6
- **#31** `cherry-build-meta` 는 단일 dir, 이전 기록 덮어쓰기 — §4-1 "중요 3"
- **#32** Day 1 duration 60→90 min — §9 타임라인 업데이트

#### #17 해소
Day 6 시나리오 fail 액션 4단계 기준 공식화 (pass/fail-로직/fail-환경/blocker-설계).

### 타임라인 영향
- Day 1.5 (45 min) 신설 → 총 예상 **6.5h → 8.5h**
- Day 0 (30→45 min) 확장 (STEP 0.4 / 0.5 추가)
- Day 1 (60→90 min), Day 6 (60→90 min, 시나리오 4→13)

### 문서 구조 최종
- `1-work-guidelines.md` 섹션: §0~§13 (+§13 검수결과)
- `2-implementation-guide.md` Day: 0 → 1 → **1.5** → 2 → 3 → 4 → 5 → 6 → 7
- `3-checklist-table.md` 시나리오: 4 → 13 (+ fail 액션 기준)
- `4-progress-log.md`: Day 0 / 0.5 / 0.6 누적

### 다음 세션 예정
- 사용자 최종 승인 ("진행" 또는 추가 지시)
- 승인 시 Day 0 STEP 0.1 부터 순차 실행 (재활용 grep → 0.4 수동 검증 → 0.5 조건부 문서 업데이트 → Day 1 착수)

### 커밋
*(아직 없음 — 2차 검수 문서 업데이트만)*

---

## 2026-04-24 (Day 0.7) · 3차 검수 — 6건 내부 정합성 마무리

**담당**: AI (사용자 지시 "마지막으로 점검")

### 도출 & 반영된 6건 (소규모 내부 모순)
#33 §3-1 경로 `cherry-<id>` → `cherry-p-<short>` 구체화
#34 §8-2 "400 대신 200" → 207/504 HTTP 분기로 교체
#35 §8-5 "409 install in progress" 잔존 → 제거 (§3-2 Promise 공유 모델과 일치)
#37 §9 Day 6 "11가지" → "13가지"
#38 §8 시나리오 8→13 확장 (8-9 frontmatter, 8-10 refresh, 8-11 ownership, 8-12 all-timeout, 8-13 disconnect)
#40 §6 "400 invalid card id" 재해석 → 미등록 카드는 `failed[]` (graceful partial failure) 로 확정

### 결과
- §8 검증 시나리오 완전성: checklist 6.1~6.13 ↔ §8-1~§8-13 **1:1 매칭**
- HTTP 상태 코드 분기: 200 / 207 / 400 / 403 / 404 / 409 / 500 / 504 모두 명확한 발생 조건
- 400 은 **구조적 불량 + 빈 빌드** 에만 발생. 미등록 카드 / 일부 실패는 failed[] 로 graceful
- 409 는 **연결 안 됨 1 케이스만**. in-flight 는 409 아닌 Promise 공유

### 통계
- 1차 17건 + 2차 15건 + 3차 6건 = **총 38건 검수 반영**
- 문서 버전: v1.3 (기획 확정 준비 완료)

### 커밋
*(아직 없음 — 최종 문서화만)*

---

## 2026-04-24 (Day 1 ~ Day 5) · 코어 구현 완료

**담당**: AI (사용자 "진행" 지시)

### Day 0 — grep 검증 ✅
- `save_skill_request` / `save_skill_ack` / `submit_self_report` / `scanSavedSkills` / `isAgentConnected` 모두 hit
- `delete_skill` 0건 → Day 1.5 신설 확정
- STEP 0.3/0.4 는 사용자 수동 검증 몫 (DB + Claude Code 실행 필요)

### Day 1 — 카드 직렬화 ✅
**파일**: `apps/api/src/modules/bench/cards/serialize.ts` + `serialize.test.ts`
- `cardToSkillFile`, `buildMetaSkillFile`, `collectSkillFiles`, `toSavePayload`
- 카드 메타 (name/description) 는 CARD_METADATA 로 백엔드 내 복제 유지
- 디렉토리 규칙 `inv-p-oracle → cherry-p-oracle` 변환 구현
- **테스트: 11 케이스, 50 assertion 전부 pass**

### Day 1.5 — delete_skill_request 신규 ✅
**수정**: `kaas-ws.gateway.ts` + `mcp-server.ts`
- 게이트웨이: `requestDeleteSkill()` + `DeleteSkillRequestPayload`/`Ack` 타입 + ack 핸들러 + path 정규식 방어
- mcp-server 핸들러: `~/.claude/skills/` root 체크 + `cherry-*` 패턴 체크 이중 방어
- cherry-agent.js 번들 업데이트는 dev 미필요 (ts-node 경로), prod 배포 시 별도 빌드 예정

### Day 2 — Install 엔드포인트 ✅
**파일**: `install-build.service.ts` + `install-build.controller.ts` + `kaas.module.ts`
- Service: 4 gate (lock / ownership / connection / empty) + limited parallel(3) save + 10s timeout + atomic cleanup + self-report refresh
- Controller: `@UseGuards(AuthGuard('jwt'))` + `@AuthUser('id')` + `classifyResult` 로 200/207/504 분기
- `concept_id` synthetic 방식 (`cherry-workshop-<cardId>`) 으로 기존 gateway shape 유지
- **curl smoke 는 Day 6 로 이월** (DB/에이전트 필요)

### Day 3 — Side Panel UI ✅
**파일**: `apps/web/components/cherry/install-result-panel.tsx`
- 3 stat 요약(saved/skipped/failed) + installed/skipped/failed/orphans/agent 섹션
- Empty/loading/error 상태 분기
- `title` tooltip 으로 full path 노출

### Day 4 — 클라이언트 연결 ✅
**수정**: `bench-api.ts` + `app/start/connect/page.tsx`
- `InstallBuildRequest/Response` 타입 + `installBuild()` fetch 래퍼 (207 partial success 허용)
- Connect 페이지: 2-column grid (`lg:grid-cols-[1fr_300px]`), sticky side panel 280px, mobile stack
- InstallSkillSection props 확장 (`installing`, `onStart`, `onComplete`, `onError`)
- install() 가 실제 백엔드 호출 + 결과를 panel 에 반영

### Day 5 — 고아 정리 ✅ (Day 2 에 암시 통합)
InstallBuildService.cleanupOrphans() 가 self-report 로 현재 cherry-* 목록 취득 → keepSet 과 diff → requestDeleteSkill 순차 호출. 실패 건은 로그 경고만, orphans_removed 배열에 성공 건만 반환.

### 빌드/컴파일 검증
- `cd apps/api && npx tsc --noEmit` → install-build/serialize/gateway/mcp-server 파일 **0 error**
- `cd apps/web && npx tsc --noEmit` → install-result-panel/bench-api/connect page **0 error**

### 남은 것
- **Day 6 리허설** (13 시나리오) — DB + Claude Code 연결 필요, 사용자 실행
- **cherry-agent.js 번들 재생성** — prod 배포 시 (dev 는 start-mcp.sh + ts-node)
- **Day 0 STEP 0.4** 수동 검증 → 결과 따라 warnings 문구 조정

### 커밋
*(세션 끝나고 사용자 승인 시 커밋 예정)*

---

## (이후 Day 6~7 세션 로그 추가 예정)
