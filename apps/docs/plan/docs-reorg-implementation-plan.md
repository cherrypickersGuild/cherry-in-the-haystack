# 문서·하네스 재편 기획서 (docs reorg + harness adoption) — 2026-08-01

> **목적**: cherry의 흩어진 문서/하네스를 aiqops 방식(**2폴더 인수인계 척추** + **S0~S6 하네스**)으로 정리한다.
> **정책**: `apps/docs/agent_read/agent-policy.md`(현행) 준수 — 변경·삭제·이동은 사용자 허락 후, 커밋은 지시 시. 이 기획서는 검토용이며, 각 Phase는 게이트에서 멈춘다.
> **상태**: 검토 대기(1회차). 승인 전 실제 파일 이동/삭제/생성 없음.

---

## 1. 배경 (왜)

- cherry 문서 관리가 좋지 않다:
  - **진입점(AGENTS.md)이 없어** 새 에이전트가 규약을 자동으로 못 읽는다. 사용자가 매번 "agent_read 읽어"라고 지시해야 함.
  - `agent_read/`에 **정책 + 백엔드현황 + 프론트현황 + 옛 work-log + 스펙 + html이 뒤섞여** 있다.
  - **자료조사·방법론·기획서(`*-plan.md`)가 최상위에 흩어져** 있고, 빈 폴더(`무제 폴더`)·빈 파일(`to-do.txt`)·`.DS_Store`가 방치되어 있다.
- 자매 프로젝트 `aiqops`(`/Users/soma/IdeaProjects/aiqops`)는 이미 정돈된 구조를 갖는다:
  - `docs/agent-read/` = 하네스(안 변하는 규칙): `에이전트-작업지침.md`(S0~S6·게이트·강화·지시-데이터 경계·검토 렌즈·조기관측) + `강화로그.md`(실패의 영구화 기록).
  - `docs/base-data/` = 현재 상태: 인수인계서 · 자료조사 · 현황조사.
  - 루트 `AGENTS.md`의 "agent-index" 블록이 `docs/agent-read/`를 진입점으로 가리킴.

## 2. 목표 (무엇을)

1. cherry `apps/docs/`를 **agent-read(하네스) + base-data(현재 상태)** 2폴더 척추로 재편한다.
2. **aiqops 하네스(S0~S6 방법론)를 도입**하되, aiqops 고유 규칙(크래시엔진·vLLM·GitLab MR)을 **cherry 고유 규칙**으로 교체·보강한다.
3. 루트 **`AGENTS.md` 진입점**을 신설해 하네스가 자동 로딩되게 한다.
4. **빈 것/쓰레기는 삭제**, **오래된 것은 `archive/`로 이동**(삭제 아님).

## 3. 결정사항 (사용자 승인 완료 — 2026-08-01)

| # | 결정 | 값 |
|---|---|---|
| D1 | agent-read 폴더 이름 | **`agent-read`**(하이픈)로 통일. `agent_read`(언더스코어) → 리네임. 참조 경로 동반 갱신. |
| D2 | 삭제 강도 | **빈 것/쓰레기 삭제 + 오래된 것 아카이브**. 실제 삭제는 빈 폴더·빈 파일·`.DS_Store`만. 나머지는 `base-data/archive/`로 이동. |
| D3 | 진행 방식 | **정식 기획서 먼저**(이 문서) → 검토 → Phase별 실행(각 게이트 정지). |
| D4 | feature 폴더 관례 | cherry 기존 **`1-work-guidelines/2-implementation-guide/3-checklist-table/4-progress-log`** 번호식 유지(aiqops의 `-지침/-구현서/-검수표`로 이관하지 않음). 하네스 §0에 이 관례를 문서화. |
| D5 | 하네스 문서 언어 | 한국어(두 프로젝트 공통). |

## 4. 목표 구조 (After)

```
apps/docs/
  agent-read/                      ← 하네스만 (안 변하는 규칙)
     에이전트-작업지침.md          ─ cherry판 하네스 (aiqops S0~S6 뼈대 + cherry 고유 §7)
     강화로그.md                   ─ 실패의 영구화 기록 (시드 포함)
  base-data/                       ← 현재 상태
     handoff-2026-08-01.md         ─ 최신 인수인계 (구 handoff/ 에서 이동)
     자료조사-Cases.md · 자료조사-Research.md · 자료조사-Discourse.md
     콘텐츠-수집-분류-페이지구성-방법론.md
     api-backend-status-2026-08-01.md · frontend-status-2026-08-01.md
     로컬실행.md                    ─ 로컬 실행 가이드 (현행 유용)
     archive/                      ─ 오래된 것 (삭제 아님)
        api-backend-status-2026-04-*.md · -07-13.md
        handoff-2026-04-*.md
        work-log-2026-04-*.md · *.html
        legacy-docs/ · pland_folder/
  plan/                            ← 기획서·수정기획서
     docs-reorg-implementation-plan.md (이 문서)
     analytics-two-surface-... · bench-key-72h-... · building-blocks-... · cases-data-...
     frameworks-landscape-... · frontend-ia-... · frontend-menu-... · overview-builder-... · cherry-kaas-screens-...
     보완기획서/frameworks-landscape-보완기획서.md
     (스펙류: a2a-implementation-plan-2026-04-19.md · agent-communication-spec · prompt-template-editor-spec · agent-api-spec · agent-column-write-spec)
  <feature>/                       ← 그대로 유지 (D4)
     KaaS_plan/ · arena_plan/ · bench/ · equip/ · shop-redesign/ · install-skill/ · agent-trade/
  (자산 — 그대로)                   ← mockups/ · seed_data/ · staged_mock/ · KaaS/ · publish/
  (삭제)                            ← 무제 폴더/(빈) · to-do.txt(빈) · arena/(.DS_Store뿐) · 전체 .DS_Store

/AGENTS.md                         ← 신설: 진입점, agent-index 블록이 apps/docs/agent-read/ 를 가리킴
```

## 5. Phase별 실행 계획

> 각 Phase 끝에서 **게이트** 정지(§3 게이트 규약). "진행" 전까지 다음 Phase 시작 안 함.
> 파일 이동은 가능한 `git mv`로 이력 보존(브랜치 `deploy`, 커밋은 사용자 지시 시).

### Phase 1 — base-data 신설 + 현재상태 이동
- `apps/docs/base-data/` 생성.
- 이동: `handoff/handoff-2026-08-01.md`, `자료조사-*.md`(3), `콘텐츠-...-방법론.md`, `agent_read/api-backend-status-2026-08-01.md`, `agent_read/frontend-status-2026-08-01.md`, `로컬실행.md` → `base-data/`.
- **[게이트]** 이동 목록 확인 · 링크 깨짐 없는지(다음 Phase 6에서 일괄 갱신 예정 명시).

### Phase 2 — agent-read 재편 (D1 리네임 + 하네스 작성)
- `git mv apps/docs/agent_read apps/docs/agent-read`.
- 하네스 밖 파일은 이 시점까지 이미 이동/아카이브(Phase 1·5). agent-read에는 **하네스만** 남긴다.
- **`agent-read/에이전트-작업지침.md` 작성** — aiqops `에이전트-작업지침.md`를 뼈대로:
  - **유지(방법론)**: §0 산출물 위치 규약(cherry 구조로), §1 운영계약, §2 단계 S0~S6, §3 게이트, §4 강화규약, §5 권한규약, §6 배포중심, §8 검수표 포맷, §9 참고문서(포인터), §10 지시-데이터 경계, §11 S3 검토 렌즈, §12 S0.5 조기관측.
  - **교체(§7 cherry 고유)**: §8에 상세.
  - 현행 `agent-policy.md`의 좋은 규칙(§1-6 원본 재현·의도 먼저 설명, §2 커뮤니케이션, §6 🔴주의표)을 해당 절에 흡수.
- **`agent-read/강화로그.md` 작성** — §9 시드 참조.
- 구 `agent-policy.md`는 내용 흡수 확인 후 제거(또는 한 줄 리다이렉트). **[게이트]에서 결정.**
- **[게이트]** 새 작업지침 초안 리뷰(빠진 규칙 없나) · agent-policy 처리 방식.

### Phase 3 — plan/ 신설 + 기획서·스펙 이동
- `apps/docs/plan/` 생성(이미 이 문서로 생성됨).
- 이동: 최상위 `*-plan.md`(analytics·bench-key·building-blocks·cases-data·frameworks-landscape-admin·frontend-ia·frontend-menu·overview-builder·cherry-kaas-screens), `보완기획서/`.
- 스펙류(`agent-api-spec.md`·`agent-column-write-spec-2026-04-07.md`·`agent_read/a2a-implementation-plan-2026-04-19.md`·`agent_read/agent-communication-spec-2026-04-11.md`·`agent_read/prompt-template-editor-spec-2026-04-11.md`) → `plan/`(현행 참조 있는 것) 또는 `base-data/archive/`(대체됨). **파일별 분류는 [게이트]에서 확정.**
- **[게이트]** 스펙류 plan vs archive 분류 확인.

### Phase 4 — 루트 AGENTS.md 진입점 신설
- `/AGENTS.md` 생성. aiqops 형식의 "agent-index" 블록:
  - 읽는 순서: ① `apps/docs/agent-read/에이전트-작업지침.md` → ② `base-data/`(최신 인수인계는 작업지침 §9 포인터) → ③ `<feature>/`.
  - 문서 지도 표(어느 폴더에 무엇이).
- cherry는 Nx가 아니라 pnpm 모노레포 → aiqops의 Nx 블록은 넣지 않음. cherry 스택(NestJS/Next.js·Dokploy 수동배포)만.
- **[게이트]** AGENTS.md 초안 확인.

### Phase 5 — 삭제 + 아카이브 (D2)
- **삭제(빈 것/쓰레기)**: `무제 폴더/`(0개), `to-do.txt`(0바이트), `arena/`(**빈 하위폴더 3개**[brainstorming·implementation-artifacts·planning-artifacts] + `.DS_Store`만, **실파일 0** — S3 1회차 실측), 전체 `.DS_Store`.
- **아카이브(`base-data/archive/`로 이동)**: `agent-read`의 옛 `work-log-2026-04-*.md`·`cherry_kaas_dev_checklist.html`·`treemap-preview.html`, `api-backend-status-2026-04-*`(01/09/13/20)·`-07-13`, `handoff-2026-04-17.md`·`-04-19-a2a.md`·`-07-13.md`, `legacy-docs/`, `pland_folder/`.
- 삭제 대상은 **이동 전 내용 재확인**(§1-5). `.DS_Store`는 이후 재생성 방지 위해 `apps/docs/.gitignore` 또는 루트 gitignore 항목 제안(별도 게이트).
- **[게이트]** 삭제/아카이브 최종 목록 승인(삭제는 되돌리기 어려움 — 항목별 확인).

### Phase 6 — 참조 갱신 + 검증 (S5)
- `agent_read` → `agent-read` 및 이동된 경로 참조 갱신. **갱신 대상(현행 유지 문서)**:
  - `base-data/handoff-2026-08-01.md`(읽는순서·정본 포인터 2곳)
  - `plan/`의 building-blocks·bench-key·frontend-menu·analytics·frontend-ia 기획서(정책 경로)
  - `arena_plan/1-work-guidelines.md`(A2A/현황/로그 경로 4곳)
- 아카이브로 간 문서 내부의 낡은 경로는 **역사 기록**이라 우선순위 낮음 — 필요 시 일괄 치환(sed)로.
- 검증: `grep -rn "agent_read" apps/docs`(잔여 0 또는 archive 내부만) · `grep -rn "agent-policy" apps/docs`(작업지침으로 대체 확인) · 목표 구조 트리 육안 확인 · AGENTS.md 링크 실재 확인.
- **[게이트]** grep 결과표 + 트리 스냅샷 보고.

## 6. 이동/삭제 매핑 요약표

| 대상 | 처리 | 목적지 |
|---|---|---|
| `agent_read/agent-policy.md` | 흡수 후 재작성 | `agent-read/에이전트-작업지침.md` |
| (신규) | 생성 | `agent-read/강화로그.md` |
| `agent_read/{api-backend-status-2026-08-01, frontend-status-2026-08-01}.md` | 이동 | `base-data/` |
| `handoff/handoff-2026-08-01.md` | 이동 | `base-data/` |
| `자료조사-*.md`(3) · `콘텐츠-...-방법론.md` · `로컬실행.md` | 이동 | `base-data/` |
| 최상위 `*-plan.md`(9) · `보완기획서/` | 이동 | `plan/` |
| 스펙류(agent-api-spec·agent-column-write·a2a·agent-communication·prompt-template) | 이동(게이트에서 분류) | `plan/` 또는 `base-data/archive/` |
| 옛 status(-04-*, -07-13) · 옛 handoff(-04-*, -07-13) · work-log · html · legacy-docs · pland_folder | 아카이브 | `base-data/archive/` |
| `무제 폴더/` · `to-do.txt` · `arena/` · `.DS_Store` | **삭제** | — |
| mockups · seed_data · staged_mock · KaaS · publish · feature 폴더 | 유지 | 제자리 |
| (신규) | 생성 | `/AGENTS.md` |

## 7. 하네스 도입 상세 — aiqops에서 무엇을 가져오나

`agent-read/에이전트-작업지침.md`는 aiqops 동명 문서를 뼈대로 하되:
- **그대로 가져옴(범용 방법론)**: 운영계약 10개(§1), 단계 S0~S6(§2), 게이트 규약(§3), 강화 규약(§4), 권한 규약(§5), 배포중심(§6), 검수표 포맷(§8), 지시-데이터 경계(§10), S3 검토 렌즈 L1~L6+열린검토(§11), S0.5 조기관측(§12).
- **cherry로 각색**: §0 산출물 위치(위 §4 구조), §9 참고문서 포인터(base-data 최신 인수인계 가리킴), 예시(aiqops의 Qwen·IMQA·GitLab 예시는 cherry 맥락으로 바꾸거나 "aiqops 유래 예시"로 표기).

## 8. cherry 고유 §7 (aiqops엔 없는 것 — 채워 넣을 내용)

현행 `agent-policy.md` §6 주의표 + 프로젝트 지식에서 승격:
- 🔴 **로컬·프로덕션이 같은 Supabase PostgreSQL 공유** — 마이그레이션·삭제 극도 주의.
- 🔴 **`BENCH_KEY_SECRET` 변경 절대 금지**(AES-256-GCM 키; 로컬·프로덕션 동일).
- 🔴 **회원 API키·지갑주소·이메일 평문 노출 금지**(로그·응답·GA 어디에도).
- 🟠 **개발자 앱(`/`)은 상태 기반 네비게이션**(URL 라우트 아님) — 새 페이지 = taxonomy + page.tsx case + 컴포넌트.
- 🟠 **bench `tools/*`는 무인증 유지**(MCP 에이전트용) — 컨트롤러 레벨 가드 금지, 라우트별만.
- 🟠 **로그인 페이지 2개**(`/login`·`/start/login`) — 인증 수정 시 둘 다.
- 🟠 **랜드스케이프**: 백엔드 `GET /api/<page>/landscape`, `LANDSCAPE_PAGES` 화이트리스트, `DATA_DIR` 영속 볼륨.
- 🟠 **`NEXT_PUBLIC_*`는 빌드타임** — 바꾸면 web 재빌드.
- 🟠 **콘텐츠 시스템의 핵심 = `kind`(article/domain) 구분** — 틀리면 페이지 형식 어긋남.
- 🟠 **원본 디자인 재현 지시**는 임의 이모지/리스트 대체 금지 — 원본 컴포넌트 먼저 확인.
- 🟡 **기존 무관 tsc 에러**(`kaas-admin-page.tsx`·`kaas-dashboard-page.tsx`·`kaas-credit.service.spec.ts` 등) — 우리 작업과 무관, 무시.
- 배포: **Dokploy 수동**(web/api 각각 Redeploy) — 에이전트가 배포 안 함.

## 9. 강화로그 시드 (첫 항목들)

현행 `agent-policy.md` §1-6에 이미 기록된 실제 실패를 강화로그 표로 이전:
- `2026-08-01 | "대표아이콘 제대로 수집" 지시에 로고 대신 랜덤 이모지 사용 | S0/원본확인 누락 | 규칙: 원본 재현 지시는 원본 파일(예: nd-model-updates-page.tsx의 RankCard·CATEGORY_LOGOS) 먼저 열어 확인 후 그대로 따른다`
- `2026-08-01 | "원본 순위표" 무시하고 임의 리스트표 생성 → 반복 재작업 | S1/지시 의도 재진술 누락 | 규칙(§1-6): 지시받으면 바로 작업 말고 ①이해한 의도 ②작업 방식 먼저 설명·확인 후 실행`

## 10. 검수표 (완료 기준)

범례: `-` 미착수 · `W` 진행 중 · `T` 통과 · `✅` 검수 완료

| 항목 | 상태 | 메모 |
|---|---|---|
| 10-1 `apps/docs/agent-read/`에 하네스 2문서만 존재 | - | 작업지침 + 강화로그 |
| 10-2 `apps/docs/base-data/`에 최신 인수인계·현황·자료조사·방법론 집결 | - | 사용자 확인 |
| 10-3 `apps/docs/plan/`에 기획서·스펙 집결 | - | |
| 10-4 `/AGENTS.md` 진입점 존재, agent-read 가리킴, 링크 실재 | - | |
| 10-5 빈 폴더·빈 파일·arena·.DS_Store 삭제됨 | - | 사용자 승인 후 |
| 10-6 오래된 문서 `base-data/archive/`로 이동(삭제 아님) | - | 사용자 승인 후 |
| 10-7 현행 유지 문서의 `agent_read`/`agent-policy` 참조 갱신, `grep` 잔여 0(archive 제외) | - | Phase 6 |
| 10-8 feature 폴더·자산(mockups/seed_data/staged_mock) 무변경 | - | |
| 10-9 커밋은 사용자 지시 시에만 | - | 정책 §1-2 |

## 성과 목표 (완료 기준)
- 새 에이전트가 **AGENTS.md 한 곳에서 시작해 agent-read → base-data 순으로** 프로젝트를 자립 파악할 수 있다.
- 규칙(안 변함)과 상태(변함)가 **폴더로 물리 분리**되어, 인수인계 시 base-data만 갱신하면 된다.
- cherry 고유 위험(공유 DB·BENCH_KEY_SECRET·상태 네비 등)이 하네스 §7에 명문화되어 사고를 예방한다.

## 11. 리스크 / 미결정

- **R1 참조 깨짐**: 이동으로 상대경로 링크가 깨질 수 있음 → Phase 6에서 grep 기반 일괄 갱신으로 방어. 아카이브 내부 링크는 역사 기록이라 후순위.
- **R2 삭제 되돌리기**: 삭제는 빈 것/쓰레기로만 한정(D2). 애매하면 아카이브로. 커밋 전이면 `git`으로 복구 가능하나, 미추적 파일 삭제는 복구 불가 → 삭제 게이트에서 항목별 확인.
- **R3 스펙류 분류**(plan vs archive): a2a 등은 arena_plan이 아직 참조 → 분류를 Phase 3 게이트에서 확정.
- **R4 handoff/ 폴더 해체 여부**: 본안은 base-data 평면 이동. 사용자가 `base-data/handoff/` 서브폴더 유지를 원하면 변경 가능(검토 사항).
- **미결정**: 이 프로젝트에서 하네스 도입 후 옛 기획서들도 S0~S6 관례로 재작성할지(범위 밖, 후속).

---

*(검토용 기획서. 실제 코드/문서와 대조해 확정 후 Phase별 착수. 정책상 최소 3회 검토·1회마다 정지. 관련: `apps/docs/agent_read/agent-policy.md`, aiqops `docs/agent-read/에이전트-작업지침.md`.)*
