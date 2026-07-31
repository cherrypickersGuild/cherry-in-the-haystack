# API 백엔드 / 프론트엔드 전체 현황 (기준일: 2026-04-13)

> 이전 문서: `api-backend-status-2026-04-09.md`  
> 변경 범위: `agent_comm` 모듈 신규 추가, `prompt_template` 모듈 신규 추가, 프론트엔드 템플릿 편집 페이지 추가, RolesGuard 추가

---

## 1) 모듈 구조 전체

### 1-1. 백엔드 (`apps/api/src/`)

```
modules/
├── app_user/               ✅ 인증 (완성)
│   ├── entity/
│   ├── input-dto/
│   ├── output-dto/
│   ├── app-user.controller.ts
│   ├── app-user.service.ts
│   ├── app-user-auth.service.ts
│   └── app-user.module.ts
│
├── pipeline/               ✅ 시스템 파이프라인 (완성)
│   ├── entity/
│   │   ├── article-raw.entity.ts
│   │   └── user-article-state.entity.ts
│   ├── input-dto/
│   ├── article-ingestion.service.ts
│   ├── ai-state-pregen.service.ts
│   ├── agent-json-parser.service.ts   ← CROSS JOIN LATERAL 패턴으로 업데이트됨
│   ├── agent-dispatch.service.ts      ⚠️ 레거시 (push 방식, 현재 미사용)
│   └── pipeline.controller.ts
│
├── pipeline_user/          ✅ 유저 파이프라인 (완성)
│   ├── entity/
│   ├── input-dto/
│   ├── user-article-ingestion.service.ts
│   └── pipeline-user.controller.ts
│
├── agent_comm/             ✅ 에이전트 통신 (신규, 완성)
│   ├── input-dto/
│   │   ├── insert-article.dto.ts
│   │   └── finish-evaluation.dto.ts
│   ├── agent-comm.controller.ts       ← AgentApiKeyGuard 적용
│   ├── agent-comm.service.ts
│   └── agent-comm.module.ts
│
├── prompt_template/        ✅ 프롬프트 템플릿 CRUD (신규, 완성)
│   ├── input-dto/
│   │   ├── create-template.dto.ts
│   │   ├── update-template.dto.ts
│   │   ├── create-version.dto.ts
│   │   └── update-version.dto.ts
│   ├── prompt-template.controller.ts  ⚠️ ADMIN Guard 주석 처리 (테스트 후 활성화 예정)
│   ├── prompt-template.service.ts
│   └── prompt-template.module.ts
│
├── patch_notes/            ✅ 패치노트 + 케이스스터디 (완성)
│   ├── patch-notes.service.ts
│   ├── case-studies.service.ts
│   └── patch-notes.controller.ts
│
├── stats/                  ✅ 통계 집계 (완성)
│   ├── landing-stat.service.ts
│   ├── frameworks.service.ts
│   ├── frameworks-rank.service.ts
│   ├── model-updates-rank.service.ts
│   └── stats.controller.ts
│
└── schedule/               ✅ 스케줄러 (완성, 환경변수 가드 적용)
    ├── ingestion-schedule.service.ts
    └── schedule.controller.ts

common/
├── base-query/             ✅ 동적 쿼리 빌더 (DSL 파서)
│   └── upsert/
│       └── bulk-upsert.executor.ts   ⚠️ 타입 오류 존재 (line 102)
├── basic-module/           ✅ DB / Redis / Auth / S3 초기화
├── basic-service/          ✅ Redis / S3 / 권한 검증 서비스
├── constants/
├── decorators/
│   └── roles.decorator.ts            ← 신규
├── role-jwt.strategy.ts
└── role.ts

middleware/
├── agent-api-key.guard.ts             ← 신규
├── roles.guard.ts                     ← 신규
└── zod-validation.pipe.ts
```

### 1-2. 프론트엔드 (`apps/web/`)

```
app/
├── page.tsx                ✅ 홈 (트리맵 + 주간 고영향 뉴스, ADMIN Manage 버튼 추가)
├── login/page.tsx          ✅ 로그인 페이지
├── template/
│   └── edit/page.tsx       ✅ 프롬프트 템플릿 편집 (신규)
└── layout.tsx

components/cherry/
├── buzz-treemap.tsx
├── nd-frameworks-page.tsx
├── nd-model-updates-page.tsx
├── nd-case-studies-page.tsx
├── patch-notes-page.tsx
├── concept-reader-page.tsx
├── top-items-list.tsx
├── metrics-row.tsx
├── page-header.tsx
├── sidebar.tsx
├── mobile-sidebar.tsx
└── handbook-placeholder.tsx

lib/
├── api.ts                  ✅ 템플릿 API 함수 추가됨
└── utils.ts
```

---

## 2) 엔드포인트 전체 목록

### app-user (인증)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/app-user/signup` | 회원가입 (role: GENERAL 고정) |
| POST | `/api/app-user/signin` | 매직 토큰 발급 (개발: 응답 반환, 운영: 이메일 발송 필요) |
| POST | `/api/app-user/login` | 매직 토큰 → JWT 교환 |
| POST | `/api/app-user/refresh` | 액세스 토큰 재발급 (쿠키 rotation) |
| POST | `/api/app-user/logout` | 로그아웃 (Redis 무효화) |
| GET  | `/api/app-user/me` | 내 정보 조회 |

### pipeline (시스템 파이프라인)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/pipeline/ingest` | article_raw 1건 → user_article_state 생성 |
| POST | `/api/pipeline/ingest-bulk` | 미처리 article_raw 전체 일괄 생성 |
| POST | `/api/pipeline/pregen-ai-state` | ai_state 없는 항목 → PENDING ai_state 일괄 생성 |
| POST | `/api/pipeline/parse-agent-json` | PENDING ai_state agent_json 파싱 → SUCCESS/FAILED |

### pipeline_user (유저 파이프라인)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/pipeline_user/ingest` | article_raw → 특정 유저 user_article_state 생성 |

### agent_comm (에이전트 통신) — 신규
| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/agent/insert-article` | AgentApiKey | 기사 삽입 (URL 중복 스킵, 소스 자동 생성) |
| GET  | `/api/agent/ask-evaluation` | AgentApiKey | 평가 패키지 요청 (prompts + catalog + items) |
| POST | `/api/agent/finish-evaluation` | AgentApiKey | 평가 결과 저장 (agent_json_raw) |

> `ask-evaluation` 쿼리 파라미터:
> - `type`: `ARTICLE_AI` | `NEWSLETTER`
> - `version_tags`: 쉼표 구분 (예: `A` 또는 `A,B`)

### prompt_template (프롬프트 템플릿) — 신규
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET    | `/api/prompt-templates/list` | 전체 템플릿 목록 (버전 포함) |
| GET    | `/api/prompt-templates/by-type/:type` | 타입별 조회 |
| GET    | `/api/prompt-templates/:code/versions` | 코드 기준 버전 목록 |
| POST   | `/api/prompt-templates/create` | 템플릿 + 초기 버전 A 생성 (트랜잭션) |
| PATCH  | `/api/prompt-templates/:id/patch` | 템플릿 메타 수정 |
| DELETE | `/api/prompt-templates/:id/delete` | 템플릿 소프트 삭제 |
| POST   | `/api/prompt-templates/:id/add-new-versions` | 버전 추가 (B, C, D 자동 태그) |
| PATCH  | `/api/prompt-templates/:id/versions/:versionId/patch` | 버전 수정 |
| PATCH  | `/api/prompt-templates/:id/versions/:versionId/activate` | 활성 버전 지정 |
| DELETE | `/api/prompt-templates/:id/versions/:versionId/delete` | 버전 소프트 삭제 |

### patch-notes
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET  | `/api/patch-notes` | 최근 7일 패치노트 (팔로우 엔터티 기준) |
| GET  | `/api/patch-notes/case-studies` | CASE_STUDIES 전체 아티클 |
| PATCH | `/api/patch-notes/:id/read` | 기사 읽음 처리 |

### stats (통계)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/stats/model-updates-rank/build` | MODEL_UPDATES 순위 집계 |
| GET  | `/api/stats/model-updates-rank` | MODEL_UPDATES 최신 순위 조회 |
| POST | `/api/stats/frameworks-rank/build` | FRAMEWORKS 순위 집계 |
| GET  | `/api/stats/frameworks-rank` | FRAMEWORKS 최신 순위 조회 |
| GET  | `/api/stats/frameworks` | FRAMEWORKS 카테고리 위계 + 라이징스타 + 아티클 |
| POST | `/api/stats/landing/build` | 랜딩 통계 집계 (treemap + momentum) |
| GET  | `/api/stats/landing` | 랜딩 통계 조회 |
| GET  | `/api/stats/landing/articles` | 랜딩 이번주 score 5 기사 |

### schedule (스케줄러)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/schedule/run-pipeline` | 파이프라인 사이클 수동 즉시 실행 |
| POST | `/api/schedule/run-daily-stats` | 일간 통계 집계 수동 즉시 실행 |

> 스케줄러 자동 실행: `SCHEDULER_ENABLED=true` 환경변수 필요 (기본: 비활성)

---

## 3) 데이터 파이프라인 흐름

```
에이전트 크론 (매 :00, :30)
  1. POST /api/agent/insert-article     → article_raw INSERT (URL 중복 스킵)
  2. POST /api/pipeline/ingest-bulk     → user_article_state INSERT
  3. POST /api/pipeline/pregen-ai-state → PENDING ai_state 생성
  4. GET  /api/agent/ask-evaluation     → 프롬프트 + 카탈로그 + 대기 기사 수신
  5. LLM 처리                            → 평가 수행
  6. POST /api/agent/finish-evaluation  → agent_json_raw UPDATE

백엔드 크론 (매 :15, :45)
  7. POST /api/pipeline/parse-agent-json → agent_json_raw 파싱 → SUCCESS/FAILED

일간 통계 크론
  8. POST /api/stats/*/build            → 순위 + 랜딩 통계 집계
```

---

## 4) agent_comm 설계 결정 사항

| 항목 | 결정 내용 |
|------|-----------|
| 통신 방식 | Pull 기반 (에이전트가 주도적으로 요청) — 웹훅 없음 |
| 인증 | `AgentApiKeyGuard` (X-Agent-Api-Key 헤더) |
| 카탈로그 포맷 | entity ID + name 포함 (agent_json_raw 파서가 ID 또는 name으로 역조회) |
| 멱등성 | `idempotency_key: "uas:{user_article_state_id}"` + `agent_json_raw IS NULL` 조건 |
| A/B 테스트 | `version_tags=A,B` 쿼리 파라미터로 복수 버전 동시 요청 가능 |

---

## 5) staged_mock 데이터 현황

| 파일 | 단계 | 내용 |
|------|------|------|
| `stage-0-foundation.sql` | 기반 | 시스템 유저, 엔터티, 팔로우 관계 |
| `stage-1-article-raw.sql` | 수집 | 기본 article_raw 데이터 |
| `stage-1-extra-new-200.sql` | 수집 | 추가 200건 article_raw |
| `stage-1-frameworks-extra.sql` | 수집 | FRAMEWORKS 카테고리 전용 추가 데이터 |
| `stage-1-model-updates-extra.sql` | 수집 | MODEL_UPDATES 카테고리 추가 데이터 |
| `stage-4-agent-json-raw.sql` | AI 처리 | 기본 agent_json_raw 데이터 |
| `stage-4-extra-new-200.sql` | AI 처리 | 추가 200건 agent_json_raw |
| `rollback-step1-200.sql` | 롤백 | stage-1-extra-new-200 롤백 |
| `rollback-all-mock.sql` | 롤백 | 전체 mock 롤백 |

---

## 6) 현재 이슈 / 리스크

| 상태 | 파일 | 내용 |
|------|------|------|
| ⚠️ 미해결 | `common/base-query/upsert/bulk-upsert.executor.ts:102` | `db.raw(sql, bindings)` 타입 불일치 (`unknown[]`) — 빌드 파이프라인 실패 가능 |
| ⚠️ 미완료 | `app_user/app-user-auth.service.ts` | `signin` 토큰을 응답으로 반환 중 — 운영 전 이메일 발송 연동 필요 |
| ⚠️ 주석 처리 | `prompt_template/prompt-template.controller.ts` | ADMIN RolesGuard 미적용 (테스트 후 활성화 예정) |
| ⚠️ 레거시 | `pipeline/agent-dispatch.service.ts` | push 방식 구 에이전트 디스패처 — 현재 미사용, 정리 필요 |
| ⚠️ 없음 | 전체 | E2E / 통합 테스트 미작성 |
| ⚠️ 없음 | `schedule/` | 시스템 엔드포인트 인증 미적용 (IP allowlist 또는 내부 인증 추가 필요) |

---

## 7) 미완료 / 다음 작업 항목

### P1 — 즉시 처리
- [ ] `bulk-upsert.executor.ts:102` 타입 오류 수정 → CI 빌드 안정화
- [ ] 이메일 발송 어댑터 연결 → `signin` 응답에서 토큰 비노출 처리
- [ ] `prompt_template` 컨트롤러 ADMIN Guard 주석 해제 + 테스트

### P2 — 개발 진행
- [ ] 프론트엔드 ↔ 백엔드 API 실제 연결 (현재는 일부 목 데이터)
- [ ] 로그인 플로우 프론트엔드 완성
- [ ] 사용자별 팔로우 기반 개인화 피드
- [ ] 생성된 뉴스레터 조회 페이지

### P3 — 보완
- [ ] `agent-dispatch.service.ts` 레거시 코드 제거
- [ ] 시스템 엔드포인트 접근 제어 (IP allowlist 또는 내부 인증)
- [ ] `signup → signin → login → refresh → logout → me` E2E 테스트 작성
- [ ] 운영 하드닝: 로깅, 레이트 리미팅, 감사 추적
- [ ] 스케줄러 cron 식 환경변수화 (현재 코드 내 하드코딩)

---

## 8) 결정 필요 사항

- `signup` 시 role 입력 허용 여부 (현재: GENERAL 고정)
- `signin` 토큰 전달 방식 확정 (이메일 방식: 매직링크 vs 6자리 코드)
- refresh 쿠키 이름/경로/바디 fallback 정책 확정
- `agent-dispatch.service.ts` 유지 vs 제거 결정
