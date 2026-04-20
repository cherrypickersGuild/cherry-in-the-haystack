# API 백엔드 / 프론트엔드 전체 현황 (기준일: 2026-04-20)

> 이전 문서: `api-backend-status-2026-04-13.md`
> 변경 범위: **`kaas/` 모듈 전체 신규 추가** (BuidlHack2026 해커톤 주 제품). 프론트엔드에 KaaS 페이지들(dashboard / catalog / admin / console) 추가, MCP 에이전트 패키지(`apps/agent-package/`) 및 온체인 컨트랙트(`apps/contracts/`) 별도 워크스페이스 분리, Concept Page Publish 워크플로우 신규.

---

## 1) 모듈 구조 전체

### 1-1. 백엔드 (`apps/api/src/`)

```
modules/
├── app_user/               ✅ 인증 (기존)
├── pipeline/               ✅ 시스템 파이프라인 (기존)
├── pipeline_user/          ✅ 유저 파이프라인 (기존)
├── agent_comm/             ✅ 에이전트 통신 (기존)
├── prompt_template/        ✅ 프롬프트 템플릿 CRUD (기존)
├── patch_notes/            ✅ 패치노트 + 케이스스터디 (기존)
├── stats/                  ✅ 통계 집계 (기존)
├── schedule/               ✅ 스케줄러 (기존)
│
└── kaas/                   ✅ Knowledge-as-a-Service (신규, 해커톤 주 제품)
    ├── entity/
    │   └── kaas-agent.entity.ts
    ├── input-dto/
    │   ├── compare.dto.ts
    │   ├── create-concept.dto.ts          ← Concept Page Publish 용
    │   ├── create-evidence.dto.ts
    │   ├── deposit.dto.ts
    │   ├── follow.dto.ts
    │   ├── purchase.dto.ts
    │   ├── register-agent.dto.ts
    │   ├── update-concept.dto.ts
    │   └── update-evidence.dto.ts
    ├── output-dto/
    ├── types/
    │   └── kaas.types.ts
    ├── chain-adapter/                      ← 체인 추상화 (ENV: CHAIN_ADAPTER)
    │   ├── interface.ts                    (IChainAdapter + KarmaTier)
    │   ├── mock-adapter.ts                 (로컬 테스트)
    │   ├── status-adapter.ts               (Status Network Sepolia — 프로비넌스/크레딧/리워드)
    │   ├── status-adapter.spec.ts
    │   ├── near-adapter.ts                 (NEAR Testnet)
    │   ├── shared-adapter.ts
    │   └── index.ts
    ├── kaas-admin.controller.ts            (/v1/kaas/admin — Concept/Evidence CRUD)
    ├── kaas-agent.controller.ts            (/v1/kaas/agents — 에이전트 등록/관리)
    ├── kaas-agent.service.ts
    ├── kaas-agent-daemon.service.ts        ⚠️ 레거시 (서버 내부 WS 데몬, MCP 패키지로 대체됨. KAAS_AGENT_API_KEY 미설정 시 자동 비활성)
    ├── kaas-catalog.controller.ts          (/v1/kaas/catalog — 개념 조회)
    ├── kaas-compare.controller.ts          (/v1/kaas/catalog/compare)
    ├── kaas-credit.controller.ts           (/v1/kaas/credits)
    ├── kaas-credit.service.ts              (+ chainAdapter 주입, Ledger, depositDbOnly)
    ├── kaas-credit.service.spec.ts
    ├── kaas-curator-reward.controller.ts   (/v1/kaas/rewards)
    ├── kaas-curator-reward.service.ts      (pending → withdraw 분리)
    ├── kaas-knowledge.service.ts           (concept/evidence CRUD + SALE 할인 계산)
    ├── kaas-knowledge.service.spec.ts
    ├── kaas-llm.controller.ts              (/v1/kaas/llm — deprecated, query.controller로 통합)
    ├── kaas-mcp.controller.ts              (/v1/kaas/mcp — MCP 등록/세션/chat/elicit)
    ├── kaas-provenance.service.ts          (구매 해시 온체인 기록)
    ├── kaas-query.controller.ts            (/v1/kaas — purchase/follow/llm/chat/self-report)
    ├── kaas-ws.gateway.ts                  (Socket.IO: submit_self_report, broadcast)
    └── kaas.module.ts

common/
├── base-query/
│   └── upsert/
│       └── bulk-upsert.executor.ts   ⚠️ 타입 오류 존재 (line 102) — 기존 이슈 유지
├── basic-module/
├── basic-service/
├── constants/
├── decorators/
│   └── roles.decorator.ts
├── role-jwt.strategy.ts
└── role.ts

middleware/
├── agent-api-key.guard.ts
├── roles.guard.ts
└── zod-validation.pipe.ts
```

### 1-2. 프론트엔드 (`apps/web/`)

```
app/
├── page.tsx                ✅ 홈 라우팅 + 사이드바 네비게이션 (max-w-[1440px] 래퍼 추가)
├── login/page.tsx          ✅ 이메일 로그인
├── template/edit/page.tsx  ✅ 프롬프트 템플릿 편집 (기존)
└── layout.tsx

components/cherry/
├── buzz-treemap.tsx               ✅ 트리맵 (배지 absolute 포지션 / 완전 불투명 / borderRadius 수정)
├── concept-reader-page.tsx        ✅ 개념 리더 (마켓 링크 연결)
├── handbook-placeholder.tsx
├── kaas-admin-page.tsx            ✅ 큐레이터/관리자 패널 (Dashboard / Knowledge Curation / Prompt Templates / ConceptPagePublishPanel 신규 / Privacy Mode 토글)
├── kaas-catalog-page.tsx          ✅ Knowledge Market (SALE 코너 탭 / NEAR Agent Market 배지)
├── kaas-console.tsx               ✅ Cherry Console (CLI 히스토리 / 말풍선 / 예시 Q&A / 매뉴얼 다중 로딩)
├── kaas-dashboard-page.tsx        ✅ 에이전트 대시보드 (Wallet + Ledger 탭 / Karma Stats / 에이전트 등록 / Windows/Mac 토글)
├── metrics-row.tsx
├── mobile-sidebar.tsx
├── nd-case-studies-page.tsx
├── nd-frameworks-page.tsx
├── nd-model-updates-page.tsx
├── nd-placeholder-page.tsx
├── page-header.tsx
├── patch-notes-page.tsx
├── sidebar.tsx                    ✅ AGENT SHOP + Basics/Advanced 접기/펼치기 + localStorage
└── top-items-list.tsx

lib/
├── api.ts                         ✅ authHeaders 헬퍼 + kaas API 함수 전부 추가 (concepts CRUD / credits ledger / rewards withdraw / karma / ws-chat 등)
└── utils.ts

public/
├── cherry-agent.js                ← 번들된 MCP 에이전트 (apps/agent-package 에서 esbuild)
├── cherry-kaas.sh                 ← Mac/Linux 래퍼
├── cherry-kaas.bat                ← Windows 래퍼
└── cherry-manuals/
    ├── kaas-dashboard.md
    ├── kaas-catalog.md            (← Knowledge Market 리네이밍 반영)
    └── ...
```

### 1-3. 외부 워크스페이스 (신규)

```
apps/
├── agent-package/                 ← npm 배포용 MCP 에이전트 (독립 패키지)
│   ├── bin/agent.js
│   ├── lib/mcp-tools.js            (6개 도구: search_catalog, get_concept, purchase_concept, follow_concept, compare_knowledge, generate_self_report)
│   ├── lib/ws-client.js
│   └── dist/cherry-agent.js        (esbuild 번들)
│
└── contracts/                     ← Hardhat 프로젝트
    ├── contracts/CherryCredit.sol  (Status Sepolia 배포)
    ├── scripts/set-authorized-server.ts
    └── scripts/check-hoodi-rln.ts
```

---

## 2) 엔드포인트 전체 목록

### 2-1. 기존 엔드포인트 (요약만)

- `app-user` (인증): signup / signin / login / refresh / logout / me
- `pipeline`: ingest / ingest-bulk / pregen-ai-state / parse-agent-json
- `pipeline_user`: ingest
- `agent_comm` (AgentApiKey): insert-article / ask-evaluation / finish-evaluation
- `prompt_template`: list / by-type / versions / create / patch / delete / add-new-versions / versions CRUD / activate
- `patch-notes`: 최근 7일 / case-studies / :id/read
- `stats`: model-updates-rank{build,} / frameworks-rank{build,} / frameworks / landing{build,} / landing/articles
- `schedule`: run-pipeline / run-daily-stats

> 위 엔드포인트 상세는 `api-backend-status-2026-04-13.md` 참조. 본 문서에서는 **신규 `kaas/` 엔드포인트만** 서술.

### 2-2. kaas — Admin (큐레이터/관리자) `/v1/kaas/admin`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET    | `/concepts` | 개념 목록 (`?created_by=` 필터. `__ADMIN__`이면 전체, userId면 자기 것만) |
| GET    | `/concepts/:id` | 개념 상세 (`content_md` + evidence 배열) |
| POST   | `/concepts` | 개념 생성 (JWT userId → `created_by` 자동 저장) |
| PATCH  | `/concepts/:id` | 개념 수정 |
| DELETE | `/concepts/:id/hide` | 숨김 (is_active=false, 복구 가능) |
| POST   | `/concepts/:id/show` | 숨김 해제 |
| DELETE | `/concepts/:id` | 소프트 딜리트 (`revoked_at` 기록) |
| POST   | `/concepts/:conceptId/evidence` | Evidence 추가 |
| PATCH  | `/concepts/:conceptId/evidence/:evidenceId` | Evidence 수정 |
| DELETE | `/concepts/:conceptId/evidence/:evidenceId` | Evidence 삭제 |

> **Concept Page Publish 워크플로우 (2026-04-20 신규)**: 프론트 `ConceptPagePublishPanel`이 위 엔드포인트들로 4단계(메타/Cherries/Progressive References/Content) 편집 → 최종 publish 시 `kaas.concept.content_md`를 `content.concept_page`로 복사.

### 2-3. kaas — Agent `/v1/kaas/agents`

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET    | `/me` | api_key | MCP 에이전트 자기 조회 (JWT 불필요) |
| POST   | `/register` | JWT | 에이전트 등록 → API Key 발급 + **welcome 200cr 자동 지급** (`depositDbOnly`) |
| GET    | `/` | JWT | 내 에이전트 목록 |
| DELETE | `/:id` | JWT | 에이전트 삭제 (소유권 검증) |
| PATCH  | `/:id/model` | JWT | LLM 모델 변경 (소유권 검증) |
| GET    | `/:id/karma` | JWT | Status Network 온체인 Karma 읽기 (live, 프론트 sessionStorage TTL 5분) |

### 2-4. kaas — Catalog `/v1/kaas/catalog`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET    | `/` | 개념 목록 (`?q=`, `?category=`) — SALE/Karma 할인가 포함 |
| GET    | `/:conceptId` | 개념 상세 |
| POST   | `/compare` | 에이전트 knowledge vs 마켓 gap 분석 (`✓/⟳/✕`) |

### 2-5. kaas — Credits `/v1/kaas/credits`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET    | `/balance` | 잔액 (`?api_key=` 필수) |
| POST   | `/deposit` | 충전 + `chainAdapter.depositCredit()` → tx_hash DB 기록 |
| GET    | `/history` | 구매/팔로우 이력 |
| GET    | `/ledger` | 크레딧 원장 (Deposit/Consume + tx 링크) |

### 2-6. kaas — Rewards `/v1/kaas/rewards`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET    | `/balance` | 큐레이터 리워드 잔액 |
| GET    | `/all` | 전체 리워드 내역 (pending 포함) |
| POST   | `/withdraw` | pending 합산 → `chainAdapter.withdrawReward()` → `withdrawn=true` + tx_hash (구매 시 자동 분배 제거, 수동 인출 전환) |

### 2-7. kaas — MCP `/v1/kaas/mcp`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST   | `/` | MCP 세션 등록 |
| GET    | `/` | 세션 상태 |
| DELETE | `/` | 세션 종료 |
| GET    | `/sessions` | 활성 세션 목록 |
| POST   | `/ws-chat` | WebSocket 기반 chat |
| POST   | `/chat` | HTTP chat |
| POST   | `/elicit` | knowledge elicit |

### 2-8. kaas — Query `/v1/kaas` (루트)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST   | `/purchase` | 개념 구매 — 크레딧 차감 + SALE/Karma 할인 스택 + pending reward 적립 + provenance tx |
| POST   | `/follow` | 구독 — Karma 할인 스택 적용 |
| POST   | `/llm/chat` | Cherry Console용 LLM 프록시 (매뉴얼 다중 로딩 포함) |
| GET    | `/agents/:id/self-report` | 서버가 저장한 최신 self-report |
| POST   | `/agents/:id/knowledge` | 에이전트가 자기 knowledge 제출 (WS `submit_self_report` emit도 이 경로 사용) |
| GET    | `/agents/:id/knowledge-diff` | 📚 Diff (서버 → 에이전트로 report 요청 → 수신 후 gap 계산) |

### 2-9. WebSocket Gateway (`kaas-ws.gateway.ts`)

- 이벤트: `submit_self_report` (에이전트 → 서버), `self_report` (서버 브로드캐스트)
- `handleAgentReport`에서 `triggered_by === 'request'` 인 경우 **브로드캐스트 skip** (HTTP 경로와 중복 방지)
- 프론트 Socket.IO transports: `["polling", "websocket"]` (Docploy 폴링 fallback 포함)
- URL 정규식 수정: `.replace(/\/api.*$/, "")` 제거 (`api.solteti.site`의 `api`가 도메인째 잘리던 버그)

---

## 3) 데이터 파이프라인 흐름 (기존) + KaaS 플로우 (신규)

```
[기존: 에이전트 크론 파이프라인 — 변경 없음]
  1. insert-article → ingest-bulk → pregen-ai-state
  2. ask-evaluation → LLM → finish-evaluation
  3. parse-agent-json (서버 크론 :15, :45)
  4. 일간 stats 집계

[KaaS 플로우]
  A. 유저 signup/login → JWT
  B. 에이전트 register → api_key + welcome 200cr
  C. MCP 설치 (claude mcp add cherry-kaas ...)
  D. 에이전트: search_catalog → get_concept → purchase_concept
       └ 서버: 크레딧 차감 (SALE × Karma 할인 스택) + provenance tx + pending reward
  E. 에이전트: generate_self_report → WS → 프론트 대시보드 업데이트
  F. 대시보드: 📚 Diff → knowledge-diff → gap 분석
  G. 큐레이터: admin panel → Concept Page Publish (4단계)
  H. 큐레이터: rewards/withdraw → 온체인 수동 인출
```

---

## 4) staged_mock 데이터 현황

| 파일 | 단계 | 내용 |
|------|------|------|
| `stage-0-foundation.sql` | 기반 | 시스템 유저 / 엔터티 / 팔로우 |
| `stage-1-article-raw.sql` | 수집 | 기본 article_raw |
| `stage-1-extra-new-200.sql` / `-v2.sql` | 수집 | 추가 200건 |
| `stage-1-extra-100-apr16-18.sql` | 수집 | **신규** — 4/16~18 기간 추가 100건 |
| `stage-1-frameworks-extra.sql` | 수집 | FRAMEWORKS 전용 추가 |
| `stage-1-model-updates-extra.sql` / `-v2.sql` | 수집 | MODEL_UPDATES 추가 |
| `stage-4-agent-json-raw.sql` | AI | 기본 agent_json_raw |
| `stage-4-extra-new-200.sql` / `-v2.sql` | AI | 추가 200건 |
| `stage-4-extra-100-apr16-18.sql` | AI | **신규** — 4/16~18 기간 추가 100건 |
| `stage-4-frameworks-extra.sql` | AI | FRAMEWORKS 전용 |
| `stage-4-model-updates-extra.sql` / `-v2.sql` | AI | MODEL_UPDATES |
| `cleanup-d701-d800.sql` | 정리 | **신규** — d701-d800 범위 클린업 |
| `kaas-tables-v2-schema.sql` | DDL | KaaS 스키마 v2 |
| `kaas-seed-demo-data.sql` | 시드 | KaaS 데모 데이터 |
| `kaas-concept-created-by.sql` | 마이그 | `concept.created_by` 컬럼 추가 (개인화) |
| `kaas-concept-revoked-at.sql` | 마이그 | 소프트 딜리트용 `revoked_at` 컬럼 |
| `kaas-curator-reward-migration.sql` | 마이그 | 큐레이터 리워드 테이블 |
| `kaas-purchase-delivery-migration.sql` | 마이그 | 구매 배송(delivery) 상태 |
| `kaas-translate-to-english.sql` | 마이그 | KaaS 데이터 영문 번역 |
| `concept-on-sale-migration.sql` / `seed-existing-sale.sql` | 마이그 | SALE 프로모션 플래그 |
| `concept-sale-discount-migration.sql` | 마이그 | SALE 할인율 |
| `user-karma-migration.sql` | 마이그 | 유저 Karma 연동 |
| `wallet-type-migration.sql` | 마이그 | 지갑 타입 컬럼 |
| `patch-side-category-to-applied-research.sql` / `rollback-*` | 기타 | 카테고리 패치/롤백 |
| `prompt-template-translate-to-english.sql` | 마이그 | 기존 템플릿 영문 번역 |
| `refresh-landing-stat-2026-04-08.sql` | 일회성 | 랜딩 stat 리프레시 |
| `rollback-step1-200.sql` / `rollback-all-mock.sql` | 롤백 | 기존 롤백 |

---

## 5) 체인 어댑터 / 온체인 설정

| 항목 | 값 |
|------|-----|
| CHAIN_ADAPTER ENV | `status` \| `bnb` \| `near` \| `mock` |
| Status Sepolia CherryCredit | `0x153DAcC25Ad05DcFb1f258c28eb47e48c13e682b` (chainId `1660990954`) |
| Status Hoodi Karma | `0x0700be6f...6c1b` (chainId `374`) — ⚠️ RLN 플랫폼 버그, 제출은 Sepolia로 |
| Status Hoodi KarmaTiers | `0xb8039632...91` |
| NEAR Testnet | `tomatojams.testnet` |
| CherryCredit owner | `0xd4452Aa4...e7C4` (비상용) |
| CherryCredit authorizedServer | `0xdab76820...e130` (스크립트 `set-authorized-server.ts` 로 이관 완료 — tx `0x0e4cf75c...8403`) |
| KarmaTier | onchainTierId 0~10, Legacy 4-tier(Bronze/Silver/Gold/Platinum) 매핑 유지 |

---

## 6) 현재 이슈 / 리스크

| 상태 | 파일 | 내용 |
|------|------|------|
| ⚠️ 미해결 | `common/base-query/upsert/bulk-upsert.executor.ts:102` | 타입 불일치 (기존 이슈, -04-13에서 지속) |
| ⚠️ 미완료 | `app_user/app-user-auth.service.ts` | signin 토큰 응답 반환 (이메일 발송 미연동) |
| ⚠️ 주석 처리 | `prompt_template/prompt-template.controller.ts` | ADMIN RolesGuard 주석 상태 유지 |
| ⚠️ 레거시 | `pipeline/agent-dispatch.service.ts` | push 방식 구 디스패처 (미사용) |
| ⚠️ 레거시 | `kaas/kaas-agent-daemon.service.ts` | 서버 내부 WS 데몬, MCP 패키지로 대체됨 — `KAAS_AGENT_API_KEY` 미설정 시 자동 비활성 |
| ⚠️ 레거시 | `kaas/kaas-llm.controller.ts` | `kaas-query.controller`의 `POST /llm/chat`으로 통합됨 |
| ⚠️ 임시 | 프론트 Withdraw 버튼 | "Not yet" 메시지 (API `POST /rewards/withdraw`는 구현 완료, 연결만 안 됨) |
| ⚠️ 표시 지연 | Compare 직후 카드 ✓ 숫자 | 프론트 `selectedAgent.knowledge` 갱신 타이밍, 새로고침하면 정상 |
| ⚠️ Hoodi RLN | Status Network 플랫폼 버그 | Kelly 공식 발표, 제출은 Sepolia 로 해도 qualifying criteria 영향 없음 (`check-hoodi-rln.ts` 스크립트 있음) |
| ⚠️ 없음 | 전체 | E2E / 통합 테스트 미작성 (kaas-credit/knowledge 유닛만 존재) |
| ⚠️ 없음 | `schedule/` | 시스템 엔드포인트 인증 미적용 |

---

## 7) 미완료 / 다음 작업 항목

### P1 — 즉시 처리
- [ ] `bulk-upsert.executor.ts:102` 타입 오류 수정
- [ ] 이메일 발송 어댑터 연결 → signin 토큰 비노출
- [ ] `prompt_template` ADMIN Guard 활성화
- [ ] Withdraw 프론트 연결 (API는 존재)

### P2 — 해커톤 스코프
- [ ] Concept Page Publish 연동 검증 (04-20 신규 기능, e2e 확인 필요)
- [ ] `onboarding-tour-plan.md` 기반 말풍선 투어 구현
- [ ] Compare 새로고침 없이 카드 갱신

### P3 — 해커톤 스코프 밖
- [ ] 온톨로지/그래프 구축
- [ ] Hoodi 재배포 (Status Network RLN 버그 해소 대기)
- [ ] npm 패키지 정식 배포 (2FA 문제 → 현재는 번들 다운로드 방식 대체)
- [ ] 뉴스레터 스튜디오 API
- [ ] 레거시 정리: `agent-dispatch.service.ts`, `kaas-agent-daemon.service.ts`, `kaas-llm.controller.ts`

---

## 8) 배포 / 환경

| 항목 | 값 |
|------|-----|
| 프론트 | `https://solteti.site` |
| API | `https://api.solteti.site` |
| DB (로컬) | `127.0.0.1:15432` (Docploy 내부) |
| 스키마 | `kaas.*`, `content.*`, `core.*` |
| MCP 번들 위치 | `apps/web/public/cherry-agent.js` (1.7MB, esbuild) |
| MCP 번들 재빌드 | `cd apps/agent-package && npx esbuild bin/agent.js --bundle --platform=node --target=node18 --outfile=dist/cherry-agent.js --external:bufferutil --external:utf-8-validate && cp dist/cherry-agent.js ../web/public/cherry-agent.js` |

---

## 9) 참고 문서

| 문서 | 경로 |
|------|------|
| 세션 인수인계 (이전) | `apps/docs/agent_read/handoff-2026-04-17.md` |
| 에이전트 패키지 기획서 | `apps/docs/KaaS/cherry-kaas-agent-package.md` |
| 에이전트 개인화 기획서 | `apps/docs/KaaS/agent-personalization.md` |
| Onboarding Tour 기획서 | `apps/docs/KaaS/onboarding-tour-plan.md` (신규, 미구현) |
| NEAR Agent Market 문서 | `apps/docs/KaaS/NEAR-agent-market.md` |
| BMAD 산출물 | `apps/docs/arena/` (gitignore — 공개 전) |
