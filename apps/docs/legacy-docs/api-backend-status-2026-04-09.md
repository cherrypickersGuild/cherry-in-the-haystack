# API 백엔드 / 프론트엔드 전체 현황 (기준일: 2026-04-09)

> 이전 문서: `api-backend-status-2026-04-01.md`  
> 변경 범위: 신규 모듈 다수 추가(pipeline, stats, schedule, patch_notes), 프론트엔드 섹션 신규 기재

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
│   ├── agent-json-parser.service.ts
│   ├── agent-dispatch.service.ts
│   └── pipeline.controller.ts
│
├── pipeline_user/          ✅ 유저 파이프라인 (완성)
│   ├── entity/
│   ├── input-dto/
│   ├── user-article-ingestion.service.ts
│   └── pipeline-user.controller.ts
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
├── role-jwt.strategy.ts
└── role.ts
```

### 1-2. 프론트엔드 (`apps/web/`)

```
app/
├── page.tsx                ✅ 홈 (트리맵 + 주간 고영향 뉴스)
├── login/page.tsx          ✅ 로그인 페이지
└── layout.tsx

components/cherry/
├── buzz-treemap.tsx        ✅ 주간 카테고리 트리맵 시각화
├── nd-frameworks-page.tsx  ✅ Newly Discovered - Frameworks 섹션
├── nd-model-updates-page.tsx ✅ Newly Discovered - Model Updates 섹션
├── nd-case-studies-page.tsx  ✅ Newly Discovered - Case Studies 섹션
├── patch-notes-page.tsx    ✅ Patch Notes 페이지
├── concept-reader-page.tsx ✅ Concept Reader (핸드북)
├── top-items-list.tsx      ✅ 상위 아이템 리스트
├── metrics-row.tsx         ✅ 메트릭 행 컴포넌트
├── page-header.tsx         ✅ 페이지 헤더
├── sidebar.tsx             ✅ 사이드바
├── mobile-sidebar.tsx      ✅ 모바일 사이드바
└── handbook-placeholder.tsx

lib/
├── api.ts                  ✅ API 클라이언트
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
[외부 수집기]
  → article_raw INSERT (representative_key_hash 중복 체크)

[pipeline/ingest or ingest-bulk]
  → user_article_state INSERT (시스템 유저 기준)

[pipeline/pregen-ai-state]
  → user_article_ai_state PENDING 레코드 생성

[외부 에이전트 (Python)]
  → agent_json_raw UPDATE (LLM 분석 결과 JSON)

[pipeline/parse-agent-json]
  → agent_json_raw 파싱 → 정규 컬럼 투영 (SUCCESS/FAILED 상태 전이)

[schedule/run-daily-stats (cron or 수동)]
  → stats 테이블 집계 (model-updates-rank, frameworks-rank, landing-stat)
```

---

## 4) staged_mock 데이터 현황

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

## 5) 현재 이슈 / 리스크

| 상태 | 파일 | 내용 |
|------|------|------|
| ⚠️ 미해결 | `common/base-query/upsert/bulk-upsert.executor.ts:102` | `db.raw(sql, bindings)` 타입 불일치 (`unknown[]`) — 빌드 파이프라인 실패 가능 |
| ⚠️ 미완료 | `app_user/app-user-auth.service.ts` | `signin` 토큰을 응답으로 반환 중 — 운영 전 이메일 발송 연동 필요 |
| ⚠️ 없음 | 전체 | E2E / 통합 테스트 미작성 |
| ⚠️ 없음 | `schedule/` | 시스템 엔드포인트 인증 미적용 (IP allowlist 또는 내부 인증 추가 필요) |

---

## 6) 미완료 / 다음 작업 항목

### P1 — 즉시 처리
- [ ] `bulk-upsert.executor.ts:102` 타입 오류 수정 → CI 빌드 안정화
- [ ] 이메일 발송 어댑터 연결 → `signin` 응답에서 토큰 비노출 처리
- [ ] `signup → signin → login → refresh → logout → me` E2E 테스트 작성
- [ ] API 에러 스펙(코드/메시지) 고정 및 문서화

### P2 — 개발 진행
- [ ] 프론트엔드 ↔ 백엔드 API 실제 연결 (현재는 목 데이터)
- [ ] 로그인 플로우 프론트엔드 완성
- [ ] 사용자별 팔로우 기반 개인화 피드
- [ ] 뉴스레터 커스터마이징 페이지 (프롬프트 편집, few-shot 예시)
- [ ] 생성된 뉴스레터 조회 페이지

### P3 — 보완
- [ ] 시스템 엔드포인트 접근 제어 (IP allowlist 또는 내부 인증)
- [ ] 운영 하드닝: 로깅, 레이트 리미팅, 감사 추적
- [ ] 스케줄러 cron 식 환경변수화 (현재 코드 내 하드코딩)
- [ ] 소셜 로그인 (선택)

---

## 7) 결정 필요 사항

- `signup` 시 role 입력 허용 여부 (현재: GENERAL 고정)
- `signin` 토큰 전달 방식 확정 (이메일 방식: 매직링크 vs 6자리 코드)
- refresh 쿠키 이름/경로/바디 fallback 정책 확정
- 시스템 파이프라인 엔드포인트 인증 방식 결정
