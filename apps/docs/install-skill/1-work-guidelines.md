# Install Skill — 작업 지침서

**프로젝트 단계:** Workshop 빌드를 실제 Claude Code 에이전트로 배포(install) + 보고(report) 파이프라인
**선행 조건:** `apps/docs/equip/` Phase 2 완료 (Workshop 7-슬롯 빌드 + 벤치 measurement 작동 확인)
**시작일:** 2026-04-24
**포지셔닝:** "조립한 기술(Workshop build)이 진짜로 내 Claude Code 에이전트에 파일로 심어지고, 에이전트가 그걸 읽어서 보고한다"

---

## 0. 이 문서의 역할

이 폴더 `apps/docs/install-skill/` 는 **Install Skill 기능 구현 작업 도크**. bench / equip 와 같은 4-파일 구조.

| 파일 | 용도 |
|---|---|
| `1-work-guidelines.md` | 규칙 + 스펙 + 재활용/신규 구분 (지금 이 파일) |
| `2-implementation-guide.md` | Day 0~N 단계별 구현 가이드 |
| `3-checklist-table.md` | 항목별 시작/완료/테스트/검수 체크 |
| `4-progress-log.md` | 세션별 작업 로그 |

---

## 1. 커뮤니케이션 규칙
- AI는 수정 전 무엇을 왜 먼저 설명, 코드만 작성 금지
- 사용자 허락 후 Edit/Write/Bash/git 진행
- 각 STEP 말미에 **기대 결과** 명시 — 다르면 중단하고 보고
- 코드 탐색은 자유

## 2. 담당 범례
- **사용자** — 최종 승인, 에이전트 실행 검증, MCP 연결 테스트
- **AI** — 코드 작성/실행 (허락 후)
- **사용자+AI** — 정보 제공 → 반영

---

## 3. 목표와 스코프

### 3-1. 엔드 투 엔드 사용자 시나리오
1. 사용자가 Workshop에서 Build A/B/C 중 하나를 조립 (7 슬롯)
2. Connect 페이지(/start/connect) 에서 Build를 선택 → **"Install to {agent}"** 클릭
3. 백엔드가 빌드 정의를 받아 각 카드를 파일로 직렬화
4. WebSocket을 통해 에이전트 프로세스로 `save_skill_request` 전송 → 에이전트가 `~/.claude/skills/cherry-p-<short>/SKILL.md` (또는 `cherry-s-*`, `cherry-build-meta`) 로 저장. `<short>` 는 `inv-p-`/`inv-s-` prefix strip 후 나머지 (§4-1 중요 2)
5. 에이전트가 `save_skill_ack` 로 회신 (request_id + 저장 경로 + 바이트 수)
6. 설치 완료 후 웹은 자동으로 `fetchAgentSelfReport` 재호출 → 에이전트가 실제 `~/.claude/skills/` 스캔하여 `local_skills` 반환
7. 웹 페이지 **사이드 패널** 에 설치 로그 + 에이전트 확인 결과 표시

### 3-2. 핵심 설계 원칙
- **재활용 우선** — 이미 `save_skill_request` / `submit_self_report` / `scanSavedSkills` / `isAgentConnected` 이 구축돼 있음. 래퍼로 묶음
- **localStorage 유지** — Workshop 상태는 기존 `cherry_workshop_state_v9` 그대로. 백엔드 Workshop 테이블 신설 **안** 함
- **빌드 단위 atomic 설치** — 부분 실패 허용 (예: 스킬 2/3 성공도 정상 응답). 실패한 것만 side panel 에 ✗ 표시
- **Side panel, not modal** — 본페이지 Diff 모달처럼 전체 화면 덮지 않음. Connect 페이지 우측 200~280px 영역에 sticky
- **중복 요청 = Promise 공유** — agentId 별 in-flight Promise 를 Map 에 보관. 같은 agent 로 새 요청이 들어오면 진행중 Promise 를 **그대로 반환**(resolve 시 2 호출자 모두 동일 응답 수신). 409 Conflict 는 쓰지 **않음** — 사용자가 2번 클릭해도 결과는 1번 실행
- **덮어쓰기 안전 순서** — 신규 SKILL.md 전체 save 성공 **이후** 기존 고아 cherry-* 디렉토리 삭제. 실패 시 기존 스킬 유지

### 3-3. 비목표 (명시적 제외)
- 빌드 버전 관리 / 롤백 — 덮어쓰기 only. 이전 설치는 자동 제거
- 다중 에이전트 동시 설치 — 한 번에 한 에이전트만
- 서버 측 빌드 registry — 설치 기록은 `localStorage` + 에이전트 `~/.claude/skills/` 만이 source of truth
- **MCP 도구 실제 주입** — 이번 스코프에서 `inv-m-*` 카드는 **ID 기록만**. 에이전트 측 실제 tool 활성화는 기존 `claude mcp add cherry-kaas` 명령(Connect 페이지 1번 단계)이 이미 담당. install-build 와 MCP tool 연결은 독립적 — install-build 실행이 Claude Code 의 MCP 설정을 건드리지 않음
- **Claude Code 핫 리로드** — SKILL.md 를 `~/.claude/skills/` 에 저장해도 **현재 세션에 즉시 반영되진 않음** (잠정). 사용자는 설치 후 `claude` 를 한 번 종료/재실행해야 함. **단, Day 0 STEP 0.4 수동 검증 결과가 "재시작 불필요" 라면 §3-3 이 항목, §6 `warnings` 기본값, §7 side panel 경고 모두 재작성**
- **Workshop localStorage v8 이하 migration** — 구 버전 state 를 새 스키마로 자동 변환 안 함. 최신 코드는 `v9` 키만 읽어 초기화 — 옛 사용자는 Workshop 재방문 시 빈 상태로 시작 (허용)

---

## 4. 카드 → 파일 직렬화 규칙

### 4-1. 슬롯별 변환 방식

| 슬롯 | 카드 타입 | 변환 방식 | 출력 |
|---|---|---|---|
| prompt | `PromptCardImpl` | systemPrompt 전체를 body 로 | `~/.claude/skills/cherry-p-<short>/SKILL.md` |
| mcp | `McpCardImpl` | **파일 생성 안 함** — tool 활성화는 `claude mcp add` 가 담당 (이 스코프 밖). ID 는 build-meta 기록용으로만 유지 | — |
| skillA/B/C | `SkillCardImpl` | promptSuffix 를 body 로 | `~/.claude/skills/cherry-s-<short>/SKILL.md` × 최대 3 |
| orchestration | `OrchestrationCardImpl` | build-meta SKILL.md 에 `orchId` 기록 | (메타 파일 참고) |
| memory | `MemoryCardImpl` | build-meta SKILL.md 에 `mode` + `maxIterations` 기록 | (메타 파일 참고) |
| _meta_ | (합성) | 위 3개 슬롯을 포함한 빌드 요약 | `~/.claude/skills/cherry-build-meta/SKILL.md` |

**중요 1**: 메타 파일도 `SKILL.md` 확장자 사용. 에이전트의 `scanSavedSkills()` 가 `SKILL.md` 만 스캔하기 때문. JSON 파일로 저장하면 self-report 에 누락됨.

**중요 2 — 디렉토리 이름 변환 규칙**:
| 카드 id | `<short>` | dir 최종 |
|---|---|---|
| `inv-p-oracle` | `oracle` | `cherry-p-oracle` |
| `inv-p-quant` | `quant` | `cherry-p-quant` |
| `inv-s-json-strict` | `json-strict` | `cherry-s-json-strict` |
| `inv-s-decomp` | `decomp` | `cherry-s-decomp` |

변환 규칙: `short = cardId.replace(/^inv-[pms]-/, '')`. 이중 prefix 방지 + filesystem-safe (영문/숫자/하이픈만). 메타는 단일 dir `cherry-build-meta` 고정.

**중요 3 — 메타 덮어쓰기 동작**: `cherry-build-meta/SKILL.md` 는 한 agent 당 1개만 존재. Build A → B 재설치 시 B 메타가 A 메타를 덮어씀. 이전 설치 내역은 남기지 않음 (이 스코프 의도).

### 4-2. SKILL.md 포맷 — Claude Code 호환

**반드시 지킬 것**: frontmatter 는 `name` + `description` **2 필드만**. 기존 `apps/api/src/mcp-server.ts:288-295` 가 쓰는 포맷과 동일. 추가 custom 필드는 `<!-- -->` 주석 형태로 body 상단에 넣음 (Claude Code 파서가 무시, 우리 툴은 파싱 가능).

```markdown
---
name: Market Oracle
description: "Crypto market analyst prompt — cites prices with timestamp, never guesses."
---

<!-- cherry-workshop
card_id: inv-p-oracle
slot: prompt
set_tags: [oracle]
build_id: build-a
installed_at: 2026-04-24T06:30:00Z
-->

You are a crypto market analyst. Always cite current prices with a timestamp and source name. Never guess — if you do not have a tool result, say so.
```

- `name`: 카드 title (예: "Market Oracle")
- `description`: 카드 summary 1줄 (`InventoryItem.summary` 그대로)
- 주석 블록: 우리 내부 메타. 에이전트가 skill 을 읽을 때 Claude Code 는 frontmatter + body 만 해석, 주석은 문자 그대로 컨텍스트에 포함되지만 무해

### 4-3. build-meta SKILL.md — 동일 포맷으로 메타만 기록

```markdown
---
name: Build meta
description: "Workshop build installed 2026-04-24 · Build A · 5 slots equipped."
---

<!-- cherry-workshop build-meta
build_id: build-a
build_name: Build A
agent_id: clx...
installed_at: 2026-04-24T06:30:00Z
slots:
  prompt: inv-p-oracle
  mcp: inv-m-crypto
  skillA: inv-s-decomp
  skillB: null
  skillC: null
  orchestration: inv-o-plan-execute
  memory: inv-me-short
orchestration_id: plan-execute
memory_mode: short
memory_max_iterations: 5
-->

This skill file records which Workshop build was installed to this agent. Not a functional skill — metadata only.
```

**이유**: meta.json 은 `scanSavedSkills` 가 무시(확장자 필터 `SKILL.md` only). 메타도 SKILL.md 로 저장해야 self-report `local_skills.items` 에 포함되어 사용자가 "빌드 맞게 설치됐다" 는 증거로 읽을 수 있음.

### 4-4. save_skill_request payload — 기존 gateway shape 재사용

기존 `SaveSkillRequestPayload` ([kaas-ws.gateway.ts:376-382](apps/api/src/modules/kaas/kaas-ws.gateway.ts:376)):
```ts
{
  request_id: string,
  concept_id: string,
  title: string,
  summary: string,
  content_md: string,
  target_dir: string,
  target_file: string,
}
```

install-build 는 **이 shape 그대로** 사용. `concept_id` 는 synthetic value 채움:
- prompt 카드: `concept_id = "cherry-workshop-<cardId>"` (예: `cherry-workshop-inv-p-oracle`)
- skill 카드: 동일 패턴
- meta SKILL.md: `concept_id = "cherry-workshop-meta-<buildId>-<agentIdShort>"`

→ gateway 쪽 수정 **0**. 기존 save_skill 저장 DB record (`kaas.purchase_delivery`) 에도 synthetic concept_id 로 기록됨. 필요시 `concept_id` 가 `cherry-workshop-` 로 시작하는 record 는 delivery 조회에서 필터링 (현재 스코프 아님).

---

## 5. 재활용 ∙ 신규 인벤토리

### ✅ 재활용 (설계 그대로)
| 컴포넌트 | 파일 | 이유 |
|---|---|---|
| WebSocket save_skill 흐름 | [kaas-ws.gateway.ts:266-313](apps/api/src/modules/kaas/kaas-ws.gateway.ts:266) | 요청/응답 + request_id 매칭 + timeout 이미 완성. install-build 는 **이 WebSocket 경로만 사용** (stdio 경로 아님) |
| `isAgentConnected(agentId)` | [kaas-ws.gateway.ts:253](apps/api/src/modules/kaas/kaas-ws.gateway.ts:253) | 설치 전 pre-check 로 사용. 미연결이면 즉시 409 반환 (hang 방지) |
| SKILL.md 포맷 참고 | [mcp-server.ts:283-306](apps/api/src/mcp-server.ts:283) | **포맷 참고용만** — 실제 파일 쓰기는 cherry-agent.js 가 수행. 이 stdio 코드는 호출 대상 아님 |
| scanSavedSkills | [mcp-server.ts:36-60](apps/api/src/mcp-server.ts:36) | 에이전트가 디렉토리 스캔 → local_skills 반환. **SKILL.md 파일 유무로 필터**함에 주의 |
| fetchAgentSelfReport | [api.ts:508](apps/web/lib/api.ts:508) | `r.ok && r.report.local_skills` 를 그대로 읽음 |
| Workshop localStorage | [workshop-mock.ts:407](apps/web/lib/workshop-mock.ts:407) `cherry_workshop_state_v9` | 빌드 A/B/C + equipped 이미 저장됨 |
| Connect 페이지 빌드 선택 UI | 이미 구현 (BuildOptionCard) | Shop 토글까지 있음. install() 함수만 교체 |
| 기존 SKILL.md precedent | `_bmad/core/*/SKILL.md` | frontmatter 포맷 확인용 참고 (`name` + `description` 2필드) |

### 🆕 신규 작성 (최소)
| 컴포넌트 | 역할 | 위치 |
|---|---|---|
| `cardToSkillFile(cardId, buildContext)` | CardImpl → `{dir, file, content}` 변환 | `apps/api/src/modules/bench/cards/serialize.ts` |
| `InstallBuildController` | `POST /v1/kaas/agents/:id/install-build` 엔드포인트 | `apps/api/src/modules/kaas/install-build.controller.ts` |
| `InstallBuildService` | 카드별 `requestSaveSkill` 호출 + 결과 집계 | `apps/api/src/modules/kaas/install-build.service.ts` |
| `installBuild(agentId, build)` 클라이언트 함수 | HTTP fetch 래퍼 | `apps/web/lib/api.ts` 말미에 추가 |
| `<InstallResultPanel>` | 설치 로그 + local_skills 요약 side panel | `apps/web/components/cherry/install-result-panel.tsx` |
| Connect 페이지 layout 조정 | 본문 가로 2컬럼 (main + side panel) | `apps/web/app/start/connect/page.tsx` |

### ❌ 손대지 않는 것
- Workshop panel / UI — 그대로
- Bench / Workshop localStorage schema — 그대로 (v9 유지)
- 기존 MCP 도구 (search_catalog, mcpChat, elicitKnowledge 등) — 그대로
- Shop 페이지 — 이번 작업과 무관

---

## 6. API 스펙

### POST `/api/v1/kaas/agents/:agentId/install-build`

**주의**: Nest Controller decorator 는 `@Controller('v1/kaas/agents')` — 전역 prefix `api` 가 자동으로 붙어 최종 URL 은 `/api/v1/kaas/agents/...`.

**인증**: `fetchWithAuth` 의 Bearer token 전파. 서버측 `@UseGuards(JwtAuthGuard)` 필수 — `req.user.id` 로 소유권 검증.

**Request body**:
```ts
{
  build_id: string,            // "build-a" 등
  build_name: string,          // "Build A"
  equipped: {
    prompt: string | null,     // 카드 id
    mcp: string | null,
    skillA: string | null,
    skillB: string | null,
    skillC: string | null,
    orchestration: string | null,
    memory: string | null,
  }
}
```

**Response** (200 / 207):
```ts
{
  installed: Array<{          // regular skill 파일만 (meta 제외)
    slot: "prompt" | "skillA" | "skillB" | "skillC",
    card_id: string,
    dir: string,
    file: "SKILL.md",
    saved_path: string,
    size_bytes: number,
  }>,
  skipped: Array<{            // mcp 슬롯, orchestration/memory (메타로 병합)
    slot: string,
    card_id: string | null,
    reason: string,           // "mcp slot — referenced by id only" / "merged into build-meta"
  }>,
  failed: Array<{
    slot: string,
    card_id: string,
    error: string,
  }>,
  meta_written: boolean,       // build-meta SKILL.md 저장 여부 (installed[] 와 별개)
  orphans_removed: string[],   // 덮어쓰기로 삭제된 cherry-* dir 목록
  local_skills_after: Array<{ dir, hasSkillMd, sizeBytes, mtime }>,  // 에이전트 재스캔 결과
  warnings: string[],          // ["Restart `claude` to load the new build"] 기본. Day 0 STEP 0.4 (b) 시만.
}
```

**HTTP 상태 분기 규칙**:
| 상태 | 조건 |
|---|---|
| 200 | 모든 파일 성공 (failed=[]) |
| 207 Multi-Status | 일부 실패 + 일부 성공 (failed.length > 0 && installed.length > 0) — 선택적 |
| 400 | equipped shape 불일치 (필드 누락/타입 오류) / 빈 빌드 (모든 슬롯 null) |
| 403 | agent not owned by authenticated user |
| 404 | agent not found |
| 409 | agent not connected (isAgentConnected false) |
| 500 | serialize 내부 예외 (코드 버그 수준) |
| 504 | **전부** timeout (installed=[] && failed.length > 0 && 모든 failed 의 error === "timeout") |

**in-flight lock 은 409 를 발생시키지 않음** — 같은 agentId 의 진행 중 Promise 를 공유함. 클라이언트는 중복 요청 시 첫 응답을 그대로 수신.

**미등록 카드 id 처리** — `equipped.prompt = "inv-x-bogus"` 같은 케이스는 **400 이 아닌** `failed[]` 에 개별 entry 로 기록. 이유: Workshop 에서 유효하게 저장된 빌드가 런타임에 카드 삭제로 미등록이 될 수 있음. 사용자 입력 그대로 reject 하지 않고 부분 실패로 graceful 처리. 결과 HTTP 상태는 위 표 분기에 따라 200/207/504.

**Error cases (에러 메시지 shape)**:
```ts
{ statusCode: number, code: string, message: string }
// 예: { statusCode: 409, code: "AGENT_OFFLINE", message: "Agent not connected. Run 'claude' with the cherry-kaas MCP." }
```

---

## 7. 보고 UX 규칙 (Side Panel)

- **위치**: Connect 페이지 desktop (lg+) 에서 오른쪽 280px sticky. Mobile 에서는 Install 버튼 아래 accordion
- **내용**:
  1. 현재 설치 상태 ("Installed · Build A · 2분 전")
  2. 가장 최근 install 응답 로그 (installed/skipped/failed 각 섹션)
  3. 에이전트의 `local_skills.items` 리스트 — dir 이름만 짧게, full path 는 hover tooltip
- **빈 상태**: "No install yet. Pick a build above and click Install."
- **로딩 상태**: 각 row 에 ⌛ 펄스 → ✓ 또는 ✗ 로 교체
- **배제**: terminal 스타일 모달, 전체화면 overlay, tx hash / explorer 링크 (이번 스코프 아님)

---

## 8. 검증 기준 (Day 6 rehearsal)

### 8-1. Happy path
- [ ] Workshop Build A 에 prompt+mcp+skillA+skillB 4 슬롯 채움
- [ ] Connect 페이지 Install 클릭
- [ ] 에이전트의 `~/.claude/skills/` 에 `cherry-p-*` 1개 + `cherry-s-*` 2개 + `cherry-build-meta` 1개 **= 4 디렉토리** 생성
- [ ] 각 SKILL.md 첫 4줄이 `---\nname: ...\ndescription: ...\n---` 패턴인지 확인
- [ ] side panel 에 "installed: 3 skills + 1 meta" + 파일 경로 표시
- [ ] self-report `local_skills.count >= 4` 반환 + 메타 SKILL.md 도 items 에 포함

### 8-2. 부분 실패
- [ ] 잘못된 카드 id (`inv-x-bogus`) 전달 시 해당 슬롯만 `failed[]` 에 들어가고 나머지는 성공
- [ ] HTTP 상태 **207** (installed 1건 이상 + failed 1건 이상). installed=0 이면 **504**
- [ ] 미등록 card id 는 **400 을 발생시키지 않음** — graceful partial failure

### 8-3. 재설치 (빌드 변경, atomic)
- [ ] Build A 설치 → Build B 설치 → `~/.claude/skills/` 에 Build B 의 스킬만 남아야 함
- [ ] 순서 검증: **신규 save 전부 성공 이후** 고아 삭제. Build B save 중 실패 시 Build A 잔존
- [ ] 응답의 `orphans_removed` 배열에 삭제된 cherry-* dir 이 정확히 기록

### 8-4. 미연결 에이전트
- [ ] WebSocket 미연결 상태에서 Install → **즉시** 409 응답 (30s hang 없음)
- [ ] side panel 에 "Agent offline. Make sure `claude` is running." 표시

### 8-5. 중복 클릭 / 멱등성 (Promise 공유 모델)
- [ ] Install 을 1초 내 2회 연타 → 첫 번째 요청의 응답이 **2 호출자 모두 동일하게** 반환 (Promise 공유)
- [ ] 2번째 호출은 409 를 받지 **않음** (409 사용하지 않음)
- [ ] 서버 로그에 `install-build` 로 시작하는 run 이 1개만 찍힘

### 8-6. 7-슬롯 풀 빌드 성능
- [ ] 모든 슬롯 채운 Build C Install → 종단 간 응답 시간 **< 15 s**
- [ ] 5개 SKILL.md save 가 순차 or 제한적 병렬 (최대 3 concurrent) 로 실행

### 8-7. Claude Code 세션 재로드
- [ ] 에이전트 실행 중 Install → 에이전트 터미널에서 `/skills` 확인 (인식 여부 기록)
- [ ] 인식 안 되면 side panel 에 "Restart `claude` to pick up new skills." 경고 노출 확인
- [ ] `claude` 종료 → 재실행 → 새 skill 목록 확인

### 8-8. 빈 빌드 보호
- [ ] 모든 슬롯 null 인 빌드 Install → 400 + `message: "Build is empty — nothing to install."`

### 8-9. SKILL.md frontmatter 엄격 검증
- [ ] 생성된 모든 SKILL.md 의 처음 4 줄이 정확히 `---\nname: <title>\ndescription: <summary>\n---` 패턴
- [ ] custom 메타 필드가 frontmatter 에 섞이지 않음 (모두 `<!-- -->` 주석 블록 안에 있음)

### 8-10. 브라우저 새로고침 mid-install
- [ ] Install 클릭 직후 F5 → side panel 초기화, 진행중 UI 흔적 없음
- [ ] 서버측 run 은 계속 진행, 응답 결과는 버려짐 (누락 허용)

### 8-11. 에이전트 소유권 가드
- [ ] 다른 유저의 agentId 로 Install 요청 → HTTP 403 + `code: "AGENT_NOT_OWNED"`
- [ ] `@UseGuards(JwtAuthGuard)` + service Gate 2 동시 방어

### 8-12. 전부 timeout (504)
- [ ] 모든 save_skill 이 10s timeout → HTTP 504, installed=[], failed 에 모두 timeout 사유
- [ ] side panel 에 "Agent timed out — check connection" 메시지

### 8-13. save 중 에이전트 disconnect
- [ ] Install 진행 중 `claude` 프로세스 kill → 나머지 save 는 failed[] 에 "socket disconnected"
- [ ] orphans_removed=[] (cleanup 실행 안 함)

---

## 9. 타임라인 & 담당

| Day | 작업 | 담당 | 예상 |
|---|---|---|---|
| Day 0 | 기획 확정 + STEP 0.4 수동 검증 + 재활용 grep | 사용자+AI | 45 min |
| Day 1 | `cardToSkillFile` + `buildMetaSkillFile` + unit test (8 cases) | AI | 90 min |
| **Day 1.5** | **`delete_skill_request` gateway 신규 이벤트 추가 + cherry-agent.js 핸들러** | AI | 45 min |
| Day 2 | `InstallBuildController` (guard 포함) + service + e2e 연결 | AI | 90 min |
| Day 3 | `InstallResultPanel` + Connect layout 조정 | AI | 60 min |
| Day 4 | `install()` 클라이언트 교체 + 엔드 투 엔드 smoke | AI | 30 min |
| Day 5 | 재설치 시 고아 파일 정리 로직 (Day 1.5 의존) | AI | 45 min |
| Day 6 | 13가지 검증 시나리오 rehearsal (§8-1 ~ §8-13) | 사용자+AI | 90 min |
| Day 7 | progress log + README 갱신 + 배포 준비 | AI | 30 min |

**총 예상: 약 8.5 시간**

**Day 1.5 배경**: 2차 검수 #23 에서 `delete_skill_request` 이벤트가 기존 코드에 **없음** 확인. Day 5 에서 고아 정리 때 필요하므로 Day 1 직후에 gateway 측 이벤트 + agent 측 핸들러를 먼저 확보. 구성:
- `kaas-ws.gateway.ts` 에 `requestDeleteSkill(agentId, {request_id, target_dir})` 메서드 + `delete_skill_ack` / `delete_skill_error` 핸들러
- `cherry-agent.js` 에 `delete_skill_request` 수신 → `fs.rmSync(target_dir, {recursive: true})` → ack
- 안전장치: target_dir 이 `~/.claude/skills/cherry-*` 로 시작하는지 검증 (path traversal 방어)

---

## 10. 해커톤 데모 스토리

1. Workshop에서 3 슬롯 빌드를 조립
2. Connect 페이지로 이동 → "Install to claude_linux_test" 클릭
3. 우측 사이드 패널이 실시간으로 "⌛ saving prompt..." → "✓ cherry-p-oracle" → "✓ cherry-s-json-strict" 로 차오름
4. 5초 내 "🤖 Agent confirmed 3 files in ~/.claude/skills/" 노출
5. 터미널에서 `claude` 실행 → 설치된 프롬프트/스킬이 컨텍스트에 자동 로드됨
6. 에이전트에게 태스크 지시 → Workshop 빌드 그대로 동작

> "레고 블록 조립 → 내 에이전트에 실제로 심는다" — 이 한 문장이 데모의 핵심.

---

## 11. Observability & 로깅 규약

### 11-1. nest 로그 prefix
모든 install-build 관련 로그는 다음 prefix 통일:
```
[install-build agent=<agentId-short> build=<buildId>] <message>
```
예:
```
[install-build agent=clx1234 build=build-a] start · slots=4
[install-build agent=clx1234 build=build-a] save-skill prompt cherry-p-oracle → saved 312B in 420ms
[install-build agent=clx1234 build=build-a] save-skill skillA inv-x-bogus → FAILED (unknown card id)
[install-build agent=clx1234 build=build-a] orphans_removed=[cherry-s-decomp, cherry-build-meta] count=2
[install-build agent=clx1234 build=build-a] done · installed=3 failed=1 orphans=2 took=1840ms
```

### 11-2. ID 체계 — run_id vs request_id 구분
두 ID 가 공존함. 용도 분리 엄격히:

| ID | 스코프 | 생성 위치 | 용도 |
|---|---|---|---|
| `run_id` | install-build 세션 1회 | `InstallBuildService.install()` 진입 시 nanoid(8) | 한 install 호출 내 모든 로그/저장 파일의 상관관계 |
| `request_id` | 개별 save_skill 1회 | `KaasWsGateway.requestSaveSkill()` 내부 | 개별 save 요청 ↔ ack 매칭 (gateway 기존 설계) |

로그 prefix 전체 형식:
```
[install-build agent=<short> build=<buildId> run=<run_id>] save-skill prompt (req=<request_id>) cherry-p-oracle → saved 312B in 420ms
```

WebSocket `save_skill_request` payload 에는 **gateway 기존 `request_id` 만** 포함 (추가 필드 안 넣음). install 의 `run_id` 는 **서버 로그 상관관계 전용** — 에이전트 측 전파 불필요.

### 11-3. 메트릭 (추후 확장 고려, 이 스코프 제외)
- install 성공률, 평균 파일 수, 평균 총 시간
- orphan 정리 건수
- 404/409/504 빈도

위 메트릭 수집은 **Day 7 이후** — 기획에 넣은 것은 로그 구조가 metric 으로 추출 가능하도록 의도적 prefix 설계했다는 기록.

---

## 12. 기획 자체 검수 결과 (Day 0 pre-flight)

초안 작성 직후 17 건 이슈 도출 → 본 문서에 반영.

**🔴 Critical (반영 완료)**:
1. SKILL.md frontmatter 는 `name` + `description` 2 필드만 — Claude Code 호환
2. meta 파일도 SKILL.md 확장자 사용 — scanSavedSkills 필터 호환
3. MCP 카드 역할 명시 — 실제 tool 활성화는 `claude mcp add` 가 담당, 이 스코프 밖
4. Claude Code 핫 리로드 불가 — 설치 후 `claude` 재시작 필요, 경고 메시지 노출
5. `isAgentConnected` pre-check — hang 방지

**🟡 Important (반영 완료)**:
6. HTTP 경로 prefix `/api/v1/...` — Controller decorator 는 `v1/kaas/...`
7. Timeout 10s/call + 전체 상한 60s
8. 중복 요청 in-flight lock
9. 에이전트 소유권 403 체크
10. 덮어쓰기 순서 — save 성공 → 고아 삭제

**🟢 테스트 추가 (§8 에 반영 완료)**:
11. 중복 클릭 테스트 (§8-5)
12. 7-슬롯 성능 테스트 (§8-6)
13. Claude Code 세션 재로드 테스트 (§8-7)
14. 빈 빌드 보호 (§8-8)
15. 에러 코드 표 완성 (§6 — 400/403/404/409/500/504)
16. Observability 규약 (§11)
17. SKILL.md frontmatter 형식 검증 (§8-1)

---

## 13. 2차 검수 결과 (Day 0 re-flight) — 15건 추가 반영

초안 검수 후 한 번 더 점검 → 15건 도출 → 본 문서 업데이트 완료.

**🔴 Critical**:
18. in-flight lock 정책 = **Promise 공유** (409 사용 안 함) — §3-2 / §6 HTTP 분기 표 정리
19. `installed[]` 는 regular skill 만, meta 는 `meta_written` 분리 — §6 응답 shape 명시
20. HTTP 상태 분기 규칙 (200 / 207 / 504 / 각 에러코드) — §6 표로 명시
21. save_skill_request payload 는 **기존 shape 그대로**, `concept_id` 는 synthetic (`cherry-workshop-<cardId>`) — §4-4 신규
22. 디렉토리 이름 변환 규칙 `cardId.replace(/^inv-[pms]-/, '')` — §4-1 "중요 2" 표

**🟡 Important**:
23. `delete_skill_request` **기존 코드에 없음** 확인 → Day 1.5 신규 이벤트 추가 필요 (타임라인 §9 업데이트 예정)
24. `run_id` vs `request_id` 역할 엄격 구분 — §11-2 표
25. stdio vs WebSocket 경로 구분 — §5 재활용 표 명확화 ("WebSocket 경로만 사용")
26. Day 0 STEP 0.4 결과 (a/b) 에 따라 §3-3/§6/§7 업데이트 지점 명시
27. 테스트 runner = 기존 `compose-runtime.test.ts` 의 `section()` + `ok()` 스타일 — 2-impl Day 1 STEP 1.3 에서 반영
28. Controller 에 `@UseGuards(JwtAuthGuard)` 필수 — §6 "인증" + 2-impl Day 2 STEP 2.2 반영

**🟢 Minor**:
29. localStorage v8 이하 migration 안 함 — §3-3 명시
30. `warnings` 기본값 명시 + Day 0 STEP 0.4 결과에 따라 조건부 — §6 주석
31. `cherry-build-meta` 덮어쓰기 동작 (이전 기록 유실) — §4-1 "중요 3"
32. Day 1 duration 60→90 min — 타임라인 §9 업데이트 예정

**#17 해소 — Day 6 fail 액션 기준** (체크리스트 `3-checklist-table.md` 에 기재):
- pass → 다음 시나리오
- fail (로직 오류) → 즉시 수정, 같은 시나리오 재실행
- fail (환경/데이터 문제) → skip 표시, Day 7 progress log 에 기록
- blocker (설계 결함) → 진행 중단, 사용자 승인 후 기획 개정
