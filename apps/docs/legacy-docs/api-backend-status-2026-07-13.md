# API 백엔드 / 프론트엔드 전체 현황 (기준일: 2026-07-13)

> **이전 문서**: `api-backend-status-2026-04-20.md`
> **대상 브랜치**: `deploy` (Dokploy 수동 배포 반영 브랜치)
> **변경 범위 요약**: 04-20(해커톤 KaaS) 이후 약 3개월. 핵심 델타는 ①**컨슈머 플로우 `cherry-for-everyone` 신설**(`/start/*` — 랜딩·워크샵·인스톨·샵), ②**벤치마크 모듈 신규**(`modules/bench`, 회원별 Claude 키), ③**Writer/GraphDB 에이전트 모듈 신규**(`modules/writer_agent`), ④**에이전트 상호운용 프로토콜**(A2A JSON-RPC / IBM ACP), ⑤**Shop·FLock/Agentverse 마켓 연동**, ⑥**Google 로그인 + 회원 키 암호화 저장**, ⑦**express-rate-limit 도입**, ⑧**NEAR 컨트랙트 워크스페이스**(`apps/contracts-near`) 추가.
>
> ⚠️ 이 문서는 `deploy` 브랜치 기준. **기사 분류/크롤러(browser-agent) 작업은 별개 `feature/browser-agent` 브랜치**에 있어 여기엔 소스가 없다(현재 `deploy`엔 `.pyc`만 잔존). 그쪽 진행은 `apps/docs/handoff/handoff-2026-07-13.md` 참조.

---

## 0) 04-20 대비 한눈에 보는 델타

| 영역 | 04-20 상태 | 07-13 현재 |
|------|-----------|-----------|
| 백엔드 top 모듈 | app_user/pipeline/…/kaas | **+ `writer_agent`, `bench`** (app.module에 등록) |
| kaas 컨트롤러 | admin/agent/catalog/compare/credit/reward/mcp/query/ws | **+ a2a, acp, shop, agent-trade, install-build, flock-export** |
| app_user | signup/signin/login/refresh/logout/me | **+ google-login, bench-key(PUT/GET/DELETE)** |
| 인증 | JWT + 매직링크(이메일 미연동) | **+ Google ID 토큰 로그인** / 매직링크 유지(Resend, 도메인 검증 실패로 실전 미발송) |
| 프론트 | 개발자 앱(사이드바 KaaS) | **+ 컨슈머 `/start/*` 전체 플로우**(워크샵·벤치·인스톨·샵) |
| 에이전트 패키지 MCP 도구 | 6개 | **12개**(A2A 3 + 벤치툴 3 추가) |
| 온체인 | Status Sepolia + NEAR testnet(계정만) | **+ `apps/contracts-near` NEAR-SDK-JS 포팅(wasm 빌드 완료)** |
| Rate limit | 없음 | **express-rate-limit(글로벌/인증/구매 3티어)** |
| 회원 LLM 키 | 없음(공용 .env) | **AES-256-GCM 암호화로 `app_user.bench_api_key_enc` 저장** |

---

## 1) 모듈 구조 전체

### 1-1. 백엔드 (`apps/api/src/`)

```
app.module.ts imports:
  AppUserModule, PipelineModule, PipelineUserModule, AppScheduleModule,
  PatchNotesModule, StatsModule, PromptTemplateModule, AgentCommModule,
  KaasModule, WriterAgentModule ← NEW, BenchModule ← NEW

modules/
├── app_user/                ✅ 인증 (+google-login.dto, +bench-key.dto, entity에 google_sub/avatar_url/bench_api_key_enc 컬럼)
├── pipeline/ pipeline_user/  ✅ 파이프라인 (기존)
├── agent_comm/              ✅ 에이전트 통신 (기존, AgentApiKey)
├── prompt_template/         ✅ 프롬프트 템플릿 (기존)
├── patch_notes/ stats/ schedule/  ✅ (기존)
│
├── kaas/                    ✅ 해커톤 주 제품 (확장됨)
│   ├── (기존) admin/agent/catalog/compare/credit/curator-reward/knowledge/llm(deprecated)/mcp/provenance/query/ws.gateway
│   ├── kaas-a2a.controller.ts / kaas-a2a.service.ts   ← NEW  A2A JSON-RPC 2.0 (agent↔agent)
│   ├── kaas-acp.controller.ts                          ← NEW  IBM/BeeAI ACP REST (같은 a2a 서비스 위 facade)
│   ├── install-build.controller.ts / .service.ts       ← NEW  워크샵 빌드를 Claude Code 에이전트에 설치
│   ├── chain-adapter/ (status/near/mock/shared)        ✅ 체인 추상화 (기존)
│   ├── flock/                                           ← NEW  외부 마켓 export
│   │   ├── flock-export.controller.ts (v1/kaas/flock)
│   │   ├── flock-export.service.ts        (flockx.io)
│   │   ├── agentverse-export.service.ts   (fetch.ai Agentverse)
│   │   ├── flock-bundle.service.ts        (수동 업로드 번들)
│   │   └── flock-marketplace-export.service.ts  ⚠️ 미등록(403, proxy_admin 권한 대기)
│   ├── shop/                                            ← NEW  컨슈머 스토어프론트
│   │   ├── shop.controller.ts (v1/kaas/shop)
│   │   ├── agent-trade.controller.ts (v1/kaas/shop/agents)
│   │   ├── buy-set.service.ts / agent-trade.service.ts
│   │   ├── shop-sets.registry.ts   (web/lib/workshop-mock.ts 미러)
│   │   └── skill-classifier.ts
│   ├── kaas-agent-daemon.service.ts  ⚠️ 레거시(MCP 패키지로 대체, KAAS_AGENT_API_KEY 미설정 시 비활성)
│   └── kaas.module.ts
│
├── writer_agent/           ✅ NEW — 뉴스레터 작성 에이전트 데이터 공급 (AgentApiKeyGuard)
│   ├── writer-agent.controller.ts  (POST /writer-agent/input, GET /writer-agent/related-concepts)
│   ├── writer-agent.service.ts     (handbook v2 스키마 raw SQL — concept + concept_alias 매칭)
│   ├── graph-concept.service.ts    (GraphDB SPARQL — 부모/자식 관련 개념)
│   └── entity/ input-dto/ (+specs)
│
└── bench/                  ✅ NEW — 워크샵 Before/After 벤치마크 (회원 Claude 키)
    ├── bench.controller.ts   (v1/kaas/bench — sets/compare/run + tools/*)
    ├── bench.service.ts      (baseline vs enhanced, ground-truth, 평가)
    ├── anthropic.client.ts   (claude/openai/flock 디스패처 + tool-use 루프)
    ├── flock.client.ts / openai.client.ts
    ├── orchestration/plan-execute.ts
    ├── cards/ (card-registry, compose-runtime, serialize → SKILL.md)
    ├── sets/set-definitions.ts  (set-2-hunter/3-policy/4-quant/6-grounded)
    ├── evaluators/ (set별 + llm-judge)
    ├── tools/ (catalog/coingecko/marketplace + registry)
    ├── seed/ (karma-v2.md, marketplace.seed.json)
    └── day8-rehearsal.ts / smoke-eval.ts / smoke-test.ts (독립 스크립트, Nest provider 아님)

common/
├── base-query/upsert/bulk-upsert.executor.ts   ⚠️ line 102 타입오류 (04-13부터 지속)
├── basic-module/ (AuthModule, RoleJwtStrategy)  ← bench/writer가 AuthModule 재사용
└── role-jwt.strategy.ts / role.ts / decorators/

middleware/
├── agent-api-key.guard.ts        (x-api-key == AGENT_API_KEY)
├── feature-permission.guard.ts / feature-response.interceptor.ts
├── logging.interceptor.ts / zod-response.interceptor.ts (main.ts 전역 등록)
├── optional-jwt-auth.guard.ts.ts ⚠️ 파일명 확장자 이중(.ts.ts) — 정리 대상
├── roles.guard.ts / zod-validation.pipe.ts
```

**전역 설정 (`main.ts`)**: `dotenv override:true`로 `.env` 선주입(빈 셸 오버라이드 방지) → 전역 prefix `api` → CORS(`CORS_ORIGINS` 필수, `X-Api-Key`/`X-Admin-Impersonation` 허용) → **express-rate-limit** → 전역 인터셉터(Logging/ZodResponse) → Swagger `api/docs` → `PORT ?? 4000`.

**`utils/crypto.ts` (NEW)**: AES-256-GCM(12B IV). 키 = env `BENCH_KEY_SECRET`(64 hex 검증). `encryptSecret`→`iv:tag:cipher`(base64), `decryptSecret`, `maskKey`(`sk-ant-…AB12`).

**`mcp-server.ts`**: Nest와 별도 stdio MCP 프로세스(`cherry-kaas`). 벤치 툴 impl 재사용(마켓/시세). `KAAS_WS_URL`(기본 `https://solteti.site`) `/kaas` 소켓 자동접속. WS 이벤트: `save_skill_request`(`~/.claude/skills/cherry-*/SKILL.md` 기록), `delete_skill_request`(경로/이름 정규식 가드), `request_self_report`, `room_message`(MCP sampling).

### 1-2. 프론트엔드 (`apps/web/`) — 두 서피스로 분리

```
app/
├── layout.tsx / globals.css / page.tsx      ✅ 개발자 앱(사이드바: highlight/patch/frameworks/model-updates/case-studies/catalog/arena/dashboard/console)
├── login/page.tsx                            ✅ 개발자 로그인 (Google + 매직링크 fallback, cherry_login_next 리다이렉트)
├── template/edit/page.tsx                    ✅ 프롬프트 템플릿 편집
└── start/                                    ← NEW  컨슈머 "cherry-for-everyone"
    ├── layout.tsx                            (ConsumerNav + cream 배경 + footer)
    ├── page.tsx                              (랜딩: "게임 캐릭터처럼 AI 조립")
    ├── login/page.tsx                        (Google 로그인, 성공→?next 기본 /start)
    ├── workshop/page.tsx                     (KaasWorkshopPanel 7슬롯 조립 + Before/After 벤치마크 러너)
    ├── connect/page.tsx                      (Install Skill: 에이전트 등록/MCP add 커맨드/설치/라이브 검증/export)
    └── shop/page.tsx                         (Shop: By Domain / By Component / By Agent 탭)

components/
├── auth/google-login-button.tsx             ← NEW (GIS 로드, idToken→/api/app-user/google-login)
├── cherry/  (기존 buzz-treemap/concept-reader/kaas-admin/catalog/console/dashboard/sidebar 등 유지)
│   ├── consumer-nav.tsx                      ← NEW  /start 상단 네비 + Settings 버튼
│   ├── settings-modal.tsx                    ← NEW  회원 Claude 키 등록/삭제 + 이메일 표시 (bench-key:change 이벤트)
│   ├── kaas-workshop-panel.tsx              ← NEW  카드 조립 코어(7슬롯/5타입, drag&drop)
│   ├── kaas-arena-page.tsx                  ← NEW  아레나 리더보드(퍼블리싱용 mock)
│   ├── shop-by-{domain,component,agent}.tsx / purchase-modal / shop-set-*  ← NEW  샵
│   ├── export-{flockx,agentverse,flock-bundle}-modal.tsx  ← NEW  외부 마켓 export
│   ├── assembly-blocks / showcase-visuals / cherry-bao / start-flow-nav / slot-badge-bar / jigsaw-connector / live-proof-card / install-result-panel / card-source-modal  ← NEW
└── ui/  (shadcn 세트 ~70개), theme-provider.tsx

lib/
├── api.ts        ✅ KaaS 클라이언트(1000+줄): 에이전트/karma/credits/purchase(chain·preSignedTx·privacyMode)/shop/export/self-report/admin CRUD
├── auth.ts       ← NEW  토큰 중앙관리(get/set/clear, authHeaders, decodeToken, tryRefresh, fetchWithAuth 401→refresh→retry, useAuthTick)
├── bench-api.ts  ← NEW  bench-key CRUD + runBenchWithBuild(/api/v1/kaas/bench/run) + installBuild + 메트릭 델타
├── workshop-mock.ts ← NEW  7 SlotKey/5 SkillType/SetTag/WORKSHOP_STORAGE_KEY/AgentBuild
├── arena-mock.ts ← NEW  아레나 mock
├── near-connector.ts ← NEW  NEAR 지갑(@hot-labs/near-connect, 1-yocto provenance)
└── utils.ts

public/
├── cherry-agent.js (~44k줄 esbuild 번들) / cherry-kaas.sh / cherry-kaas.bat
├── cherry-manuals/ (_index.json + 페이지별 md — Cherry Console 컨텍스트 주입)
└── logos/ (anthropic/google/openai/… SVG)

Dockerfile: ARG NEXT_PUBLIC_API_URL, ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID(← NEW, 빌드타임), NEXT_DEPLOYMENT_ID(skew protection)
package.json: Next 16.2 / React 19.2 / + socket.io-client / + @hot-labs/near-connect / Tailwind v4
```

### 1-3. 외부 워크스페이스

```
apps/
├── agent-package/    cherry-kaas-agent v1.0.0 — MCP 12개 도구 (기존 6 + A2A 3[send_agent_task/read_agent_inbox/respond_to_task] + 벤치 3[search_marketplace/search_cherry_docs/get_crypto_price])
├── contracts/        Hardhat — CherryCredit.sol(Status Sepolia) + deploy/set-authorized-server/check-hoodi-rln 스크립트
└── contracts-near/   ← NEW  cherry-kaas-near-contract — near-sdk-js 로 CherryCredit 포팅(deposit/consumeCredit/distributeReward/recordProvenance), build/cherry_credit.wasm 완료

python_services/packages/
├── agent/ (writer_agent, news_agent) · text_extract_ideas/ · source_discovery/
├── idea_to_graph_ontology/ (GraphDB 온톨로지 구축) · news_collector/ (Airflow dags/helm/argocd)
└── browser-agent/  ⚠️ deploy 브랜치엔 소스 없음(.pyc 잔존). 크롤러 analyze/generate 서비스는 feature/browser-agent 브랜치.

루트: pnpm workspaces(apps/*, packages/*), turbo 없음. + pyproject.toml/poetry.lock, docker-compose.yml
```

---

## 2) 신규 엔드포인트 (04-20 이후)

> 전역 prefix `api`. 기존 엔드포인트(app-user 기본/pipeline/stats/patch-notes/schedule 등)는 04-20·04-13 문서 참조. 여기선 **신규만**.

### 2-1. app_user `/api/app-user` — 인증 추가분

| 메서드 | 경로 | 가드 | 설명 |
|--------|------|------|------|
| POST | `/google-login` | none | Google ID 토큰 검증(audience=Client ID, email_verified) → google_sub→email 순 find-or-create → JWT 발급 + refresh 쿠키 |
| GET  | `/bench-key` | JWT | 마스킹된 회원 Claude 키 상태 |
| PUT  | `/bench-key` | JWT | 회원 Claude 키 등록/교체 (암호화 저장, `sk-ant-` 접두·min 20 검증) |
| DELETE | `/bench-key` | JWT | 회원 Claude 키 삭제 |

- `findOrCreateGoogleUser`: google_sub 조회 → 없으면 email로 기존 매직링크 유저에 google_sub/avatar 백필 → 없으면 신규(FREE/GENERAL, tz Asia/Seoul).
- 매직링크 메일은 `utils/resend.ts`로 발송(링크는 `dto.from`에 따라 `/login` 또는 `/start/login`). ⚠️ Resend 도메인 검증 실패로 실전 미발송 → 구글 로그인으로 우회.

### 2-2. bench `/api/v1/kaas/bench` — NEW

| 메서드 | 경로 | 가드 | 설명 |
|--------|------|------|------|
| GET  | `/sets` | none | 벤치 세트 목록(UI용 id/name/task/skills) |
| POST | `/compare` | **JWT(라우트별)** | 세트 baseline+enhanced 실행·평가·메트릭. **회원 키 필수** |
| POST | `/run` | **JWT(라우트별)** | 회원의 워크샵 빌드로 실행(baseline=빈 빌드, enhanced=조립 런타임). **회원 키 필수** |
| POST | `/tools/search-marketplace` | none | MCP 에이전트용 시드 마켓 검색(Set2 Hunter) |
| POST | `/tools/search-cherry-docs` | none | MCP 에이전트용 시드 문서(Set3 Policy/Set6 Grounded) |
| POST | `/tools/get-crypto-price` | none | MCP 에이전트용 CoinGecko 시세(Set4 Quant) |

- ⚠️ **가드는 라우트별로만** — `tools/*`는 무인증 유지(MCP 에이전트용). 컨트롤러 레벨 가드 금지.
- **회원 키 흐름**: `requireBenchKey(req)` → `req.user.id` → `appUser.getDecryptedBenchKey`. 없으면 `400 {code:'NO_BENCH_KEY'}`, 유저 없으면 401.
- **에러 코드 매핑**(프론트 분기용): 401→`INVALID_API_KEY`, 429→`RATE_LIMITED`, 402/400→`INSUFFICIENT_CREDITS`, else 500.
- **provider 강제**: 전역 `BENCH_LLM_PROVIDER`(claude/openai/flock, 기본 claude)여도 **회원 apiKey 있으면 flock/openai 라우팅 우회 + per-call `new Anthropic({apiKey})`** → 회원 Anthropic 계정 과금. `memberFields()`가 `{apiKey, model: BENCH_MEMBER_MODEL ?? 'claude-haiku-4-5'}` 주입.

### 2-3. kaas 상호운용/샵/설치/export — NEW

**install-build `/api/v1/kaas/agents`**
| 메서드 | 경로 | 가드 | 설명 |
|--------|------|------|------|
| POST | `/:id/install-build` | JWT | 워크샵 빌드를 연결된 Claude Code 에이전트에 `~/.claude/skills/cherry-<name>/SKILL.md`로 설치(WS `save_skill_request`). 소유권 403 / 미연결 409 / 빈빌드 400 / orphan 정리 |

**a2a `/api/v1/kaas/a2a`** (JSON-RPC 2.0, `x-api-key`)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/` | `tasks/send` \| `tasks/get` \| `tasks/cancel` \| `tasks/respond` |
| GET | `/agents/:id/card` | A2A 에이전트 카드(디스커버리) |
| GET | `/inbox` | 인증 에이전트의 수신 태스크 |
| GET | `/agents` | 활성 에이전트 목록 |

**acp `/api/v1/kaas/acp`** (IBM/BeeAI ACP REST — 위 a2a 서비스 위 facade)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/agents` · `/agents/:name` | 디스커버리 / 매니페스트 |
| POST | `/runs` · `/runs/:id/cancel` · `/runs/:id/messages` | send / cancel / respond (`x-api-key`) |
| GET | `/runs/:id` · `/inbox` | 상태 조회 / 수신함 |

**shop `/api/v1/kaas/shop`** (가드 없음)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/sets` | 샵 세트 번들 목록 |
| GET | `/cards/:id/source` | 카드 원본(read-only) |
| POST | `/buy-and-install` | 세트 구매+설치(크레딧+provenance, 실패 시 환불) |

**agent-trade `/api/v1/kaas/shop/agents`** (가드 없음)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/` (`?exclude_self`) | 다른 활성 에이전트 |
| GET | `/:id/diff?vs_api_key=` | 대상 vs 나 스킬 diff(self-report) |
| POST | `/skills/buy` | 단일 SKILL.md 구매(정액 5cr) |

**flock-export `/api/v1/kaas/flock`** (가드 없음)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/config` · `/agentverse-config` | 서버 키 보유 여부 |
| POST | `/export-build` | flockx.io 퍼블릭 에이전트 등록 |
| POST | `/export-agentverse` | fetch.ai Agentverse 등록 |
| POST | `/flock-bundle` | FLock 수동 업로드 번들 생성 |

### 2-4. writer_agent `/api/writer-agent` — NEW (전체 `AgentApiKeyGuard`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/input` | 토픽 매칭 handbook v2 evidence 패키징(Writer Agent 공급용) |
| GET | `/related-concepts?topic=` | GraphDB 부모/자식 관련 개념(SPARQL, repo `llm-ontology`) |

---

## 3) 컨슈머 플로우 (`/start/*`) — 신규 주력 UX

```
1. 랜딩 /start          → "게임 캐릭터처럼 AI 조립" 소개, 쇼케이스, CTA
2. 워크샵 /start/workshop → KaasWorkshopPanel: 7슬롯(prompt/mcp/skillA-C/orchestration/memory) drag&drop, 빌드 3개까지 localStorage
                          하단 Benchmark: runBenchWithBuild로 실제 Anthropic Before/After, 게이지 애니 + tool-call 트레이스 + system prompt peek
                          (회원 Claude 키 필요 — Settings 모달)
3. 인스톨 /start/connect → 에이전트 등록(EVM/NEAR 지갑) → `claude mcp add cherry-kaas` 커맨드 복사 → self-report 검증
                          → installBuild로 빌드 설치 → socket.io(/kaas) 라이브 증명 → FLock/Agentverse export 모달
4. 샵 /start/shop        → By Domain(세트) / By Component(개별 카드) / By Agent(에이전트간 스킬 거래 5cr), 온체인 provenance
```

- 인증: `lib/auth.ts` 중앙화(access=localStorage, refresh=httpOnly 쿠키+Redis, 401→refresh→retry→`/login`).
- 개발자 앱과 컨슈머 앱은 **로그인 페이지 2개**(`/login`→`/`, `/start/login`→`/start`) 유지.

---

## 4) staged_mock — 신규 마이그레이션 (04-20 이후)

| 파일 | 내용 |
|------|------|
| `google-login-migration.sql` | `core.app_user`에 `google_sub`+`avatar_url` + google_sub 부분 unique 인덱스 |
| `bench-member-key-migration.sql` | `core.app_user.bench_api_key_enc TEXT NULL` (AES-256-GCM 회원 키) |
| `kaas-agent-task-migration.sql` | `kaas.agent_task` (A2A/ACP 태스크, 멱등성) |
| `crawler-autogen-migration.sql` | 크롤러 자동생성(`content.crawler_analysis` 등, browser-agent 연계) |
| `handbook-key-idea-absorb-migration.sql` | handbook 핵심 아이디어 흡수 (writer_agent 연계) |
| `public-to-handbook-migration.sql` | public → handbook 스키마 이관 |

> 04-20 이전 목록(stage-0~4, kaas-*, concept-sale-*, user-karma 등)은 이전 문서 참조.

---

## 5) 체인 어댑터 / 온체인

- 기존 Status Sepolia CherryCredit / Hoodi Karma / KarmaTiers 유지(04-20 문서 값 동일).
- **NEW `apps/contracts-near/`**: `near-sdk-js`로 CherryCredit 포팅(`@NearBindgen`, LookupMap credits/rewards/provenance, `@call` deposit/consumeCredit/distributeReward/recordProvenance). `build/cherry_credit.wasm` 빌드 완료, `near deploy` 스크립트 준비. 프론트는 `NEXT_PUBLIC_NEAR_CONTRACT_ID`(기본 `tomatojams.testnet`) + `@hot-labs/near-connect` 지갑.
- purchase/follow는 `chain: status|near|mock` 선택 지원(프론트 `lib/api.ts` preSignedTx/privacyMode).

---

## 6) 현재 이슈 / 리스크

| 상태 | 위치 | 내용 |
|------|------|------|
| ⚠️ 미해결 | `common/base-query/upsert/bulk-upsert.executor.ts:102` | 타입 불일치(04-13부터 지속) |
| ⚠️ 파일명 | `middleware/optional-jwt-auth.guard.ts.ts` | 확장자 이중(.ts.ts) — 정리 필요 |
| ⚠️ 미등록 | `kaas/flock/flock-marketplace-export.service.ts` | 모듈 미와이어, FLock `POST /v1/agents` 403(proxy_admin 권한 대기) |
| ⚠️ 미검증 | bench `/run`·`/compare` end-to-end | 로컬 Settings→키등록→Run 런타임 확인 아직(핸드오프 TODO) |
| ⚠️ 이메일 | 매직링크 발송 | Resend 도메인(`solteti.site`) 검증 failed → 구글 로그인 우회 |
| ⚠️ 레거시 | `kaas-agent-daemon.service.ts`, `kaas-llm.controller.ts`, `pipeline/agent-dispatch.service.ts` | MCP 패키지/통합 컨트롤러로 대체, 정리 대상 |
| ⚠️ 데드코드 | `app/start/workshop/page.tsx` | 미사용 헬퍼(ChipRow/AppliedSlotsBanner/AgentPicker/KarmaStars) |
| ⚠️ 무인증 | `shop/*`, `agent-trade/*`, `flock/*` 라우트 | 크레딧 차감/외부 export가 가드 없음(api_key body 검증에 의존) — 노출 검토 |
| ⚠️ 기존 tsc | `kaas-credit.service.spec.ts`(api), `kaas-admin/dashboard-page.tsx`(web) | 기존부터 있던 무관 에러, 우리 작업과 무관 |
| ⚠️ 테스트 | 전반 | E2E/통합 미작성(bench cards.test, kaas-credit/knowledge, writer/graph spec 등 유닛만) |

---

## 7) 미완료 / 다음 작업

### P1
- [ ] **벤치 회원키 배포·검증**: Dokploy api에 `BENCH_KEY_SECRET`(로컬 .env와 동일) 주입·재배포 → 로그인 → Settings 키 등록 → Workshop Run → 본인 Anthropic 콘솔 과금 확인 + 무효 키 세분화 에러 확인.
- [ ] `bulk-upsert.executor.ts:102` 타입 수정.
- [ ] shop/agent-trade/flock 무인증 라우트 인증·레이트 검토.

### P2
- [ ] 기사 분류 구현(별개 `feature/browser-agent` 브랜치, 미착수) — 크롤러 analyze/generate는 동작, classify만 남음. Qwen/Claude provider 선택.
- [ ] 레거시 정리(daemon/llm-controller/agent-dispatch, `.ts.ts` 파일명).
- [ ] FLock 마켓 정식 등록(proxy_admin 권한 확보 시 flock-marketplace-export 와이어).

### P3
- [ ] 조립식 에이전트 → 회사 로컬 Qwen LLM 큰 그림(회원키가 그 일부).
- [ ] NEAR 컨트랙트 실배포·연동 검증.
- [ ] npm 패키지 정식 배포(현재 번들 다운로드 방식).
- [ ] 온톨로지/그래프 확장(`idea_to_graph_ontology`, writer_agent GraphDB 연계).

---

## 8) 배포 / 환경

| 항목 | 값 |
|------|-----|
| 배포 | **Dokploy 수동**(web/api 각각 Redeploy). GitHub Actions 자동배포 워크플로는 삭제됨 |
| 프론트 | `https://cherryinthehaystack.com` (구 `solteti.site`) |
| API | `https://api.solteti.site` |
| DB | Supabase PostgreSQL — **로컬·프로덕션 같은 DB 공유**(주의) |
| Redis(로컬) | 포트 **16379**(`config.ts` 하드코딩) · staging/prod 6379 |
| 스키마 | `kaas.*`, `content.*`, `core.*`, handbook v2 |
| MCP 번들 재빌드 | `cd apps/agent-package && npx esbuild bin/agent.js --bundle --platform=node --target=node18 --outfile=dist/cherry-agent.js --external:bufferutil --external:utf-8-validate && cp dist/cherry-agent.js ../web/public/cherry-agent.js` |

### ⚠️ Dokploy 추가 환경변수 (미반영 시 넣을 것)

**API(런타임)**
| 변수 | 값/비고 |
|------|--------|
| `GOOGLE_CLIENT_ID` | `846409000652-5265k3mub14e62beu6og98h83vul2s99.apps.googleusercontent.com` |
| `BENCH_KEY_SECRET` | 64 hex. **로컬 `apps/api/.env`와 반드시 동일 + 절대 변경 금지**(같은 DB → 키 다르면 기존 등록 키 복호화 불가) |
| `BENCH_MEMBER_MODEL` | `claude-haiku-4-5`(선택) |
| `BENCH_LLM_PROVIDER` | 전역 기본(claude/openai/flock) — 회원 키 있으면 무시됨 |
| `AGENT_API_KEY` | writer_agent/agent_comm 게이트(x-api-key) |
| `GRAPHDB_URL` / `GRAPHDB_REPO` | 기본 `http://100.102.45.81:7200` / `llm-ontology` |

**Web(빌드타임 — 재빌드 필수)**
| 변수 | 값 |
|------|-----|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | 위 Client ID (NEXT_PUBLIC_*은 번들에 박힘 → web 재빌드 필요) |
| `NEXT_PUBLIC_API_URL` | API 주소 |
| `NEXT_PUBLIC_NEAR_CONTRACT_ID` | (Docker ARG 미전달, 코드 기본 `tomatojams.testnet`) |

---

## 9) 참고 문서

| 문서 | 경로 |
|------|------|
| 세션 인수인계(최신) | `apps/docs/handoff/handoff-2026-07-13.md` |
| 이전 백엔드 현황 | `apps/docs/agent_read/api-backend-status-2026-04-20.md` (그 이전: -04-13, -04-09, -04-01) |
| 벤치 회원키 기획서 | `apps/docs/bench-member-key-implementation-plan.md` |
| 구글 로그인 마이그 | `apps/docs/staged_mock/google-login-migration.sql` |
| 기사 분류 기획(별 브랜치) | `feature/browser-agent`의 `python_services/packages/browser-agent/docs/{classification-redesign,category-strategy,llm-provider-plan}.md` |
| A2A 구현 기획 | `apps/docs/agent_read/a2a-implementation-plan-2026-04-19.md` |

---

*(2026-07-13 기준. `deploy` 브랜치. 이후 변경은 git log + `apps/docs/handoff/` 최신 문서 함께 참조.)*
