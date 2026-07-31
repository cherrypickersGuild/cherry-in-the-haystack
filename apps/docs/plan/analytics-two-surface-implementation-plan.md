# 서피스별 분석(Analytics) 구현 기획서

> **작성일**: 2026-07-13 · **대상 브랜치**: `deploy` · **상태**: 기획(검토용, 미구현)
> **목적**: 두 서피스(개발자 앱 `/`, 컨슈머 앱 `/start/*`)를 **각각** 조사하는 분석 기능 도입. 발주자 요구 = "회원들에 대한 통계 + 어느 경로로 들어왔는가".
> **정책**: 바로 구현하지 않는다. 이 문서를 여러 번 검토(실제 코드 대조)한 뒤 구현 착수.

---

## 0. 배경 / 핵심 판단

- 현재 분석 도구: `@vercel/analytics` 의존성만 존재(실사용 흔적 미미), **GA4·동의배너 없음**.
- 확인된 공백: `core.app_user`에 **서피스(진입 경로) 컬럼이 없음**. 매직링크(`SigninDto.from: 'main'|'start'`)엔 신호가 있으나 **저장 안 함**. **구글 로그인은 서피스 신호 자체가 없음**(`GoogleLoginDto`는 `idToken`만, 프론트 버튼도 `{idToken}`만 전송).
- **"회원 통계"와 "구글 분석(GA4)"은 서로 다른 도구가 필요** — 두 층으로 나눠 구현한다.

| 층 | 도구 | 담당 | 서피스 구분 방식 |
|----|------|------|-----------------|
| **A. 회원 비즈니스 지표** | 자체 stats API (Postgres) | 정확한 회원 수·활성·크레딧·구매 | `app_user.signup_surface` 컬럼 `GROUP BY` |
| **B. 행동·퍼널** | GA4 (프로퍼티 1개) | 유입·페이지 흐름·단계별 이탈 | 이벤트 `surface` 파라미터 + `content_group` |

> 원칙: **거래·정산성 수치는 A(자체 DB)가 진실**. GA4는 익명 행동·퍼널 전용. GA4로 회원 정산 수치를 내지 않는다(샘플링·차단으로 부정확).

---

## 1. 서피스 정의

| 서피스 코드 | 경로 | 대상 | 핵심 전환 |
|------------|------|------|-----------|
| `main` (developer) | `/`, `/template/*` (사이드바: catalog/dashboard/console/arena/patch-notes…) | 개발자·큐레이터 | concept 구매, 에이전트 대시보드 |
| `start` (consumer) | `/start/*` (workshop/connect/shop) | 일반 사용자 | 빌드 조립 → 벤치 → MCP 설치 → 샵 구매 |

- 판정 규칙(단일 소스): **경로가 `/start`로 시작 → `start`, 그 외 → `main`.** 프론트/GA/백엔드 모두 이 규칙을 공유.

---

## 2. Part A — 자체 회원 통계 (DB + API)

### A-1. DB 스키마 변경 (`core.app_user`)

신규 컬럼(마이그레이션 파일: `apps/docs/staged_mock/user-surface-migration.sql` 신규):

| 컬럼 | 타입 | 의미 |
|------|------|------|
| `signup_surface` | `TEXT` (`'main'\|'start'`, nullable) | **가입(최초 진입) 서피스** — 한번 정해지면 고정 |
| `last_surface` | `TEXT` (`'main'\|'start'`, nullable) | 마지막 로그인 서피스 — 로그인마다 갱신 |
| `signup_method` | `TEXT` (`'google'\|'magic'`, nullable) | 가입 방식(구글/매직링크) — `google_sub`로 추론 가능하나 명시 저장 |

```sql
-- user-surface-migration.sql (스케치)
ALTER TABLE core.app_user ADD COLUMN IF NOT EXISTS signup_surface TEXT NULL;
ALTER TABLE core.app_user ADD COLUMN IF NOT EXISTS last_surface   TEXT NULL;
ALTER TABLE core.app_user ADD COLUMN IF NOT EXISTS signup_method  TEXT NULL;
-- 조회 최적화(집계용). 값 도메인은 앱 레벨에서 강제('main'|'start').
CREATE INDEX IF NOT EXISTS idx_app_user_signup_surface ON core.app_user (signup_surface);
```

- ⚠️ **로컬·프로덕션 같은 DB 공유** → 마이그레이션은 사용자가 직접 1회 적용. 기존 회원은 `signup_surface = NULL`(=미상)으로 남고, 이후 활동 시 `last_surface`부터 채워짐. 필요 시 과거 `last_login`/데이터로 백필은 별도 판단.
- `AppUserEntity`(`entity/app-user.entity.ts`)에도 3개 필드 추가.

### A-2. 백엔드 — 서피스 신호 배선

| 파일 | 변경 |
|------|------|
| `input-dto/google-login.dto.ts` | `from: z.enum(['main','start']).optional()` 추가 (매직링크 `SigninDto`와 동일 형태) |
| `components/auth/google-login-button.tsx` (web) | `surface` prop 받아 body에 `from` 포함 전송. 두 로그인 페이지가 각자 값 전달(`/login`→`main`, `/start/login`→`start`) 또는 `usePathname`으로 자동 판정 |
| `app-user-auth.service.ts` `findOrCreateGoogleUser` | **신규 생성 시** `signup_surface=from`, `signup_method='google'` 저장. **기존/모든 로그인 시** `last_surface=from` 갱신 |
| `app-user-auth.service.ts` `signin`/`login`(매직링크) | 이미 있는 `dto.from`을 유저 생성/로그인 시 `signup_surface`(최초만)·`last_surface`·`signup_method='magic'`에 반영 |

> 매직링크는 `from`이 이미 흐르고 있으니 **저장 배선만** 추가. 구글은 DTO·프론트·서비스 3곳 보강 필요.

### A-3. 회원 통계 API (신규, `modules/stats` 패턴 미러)

- 위치: `modules/stats`에 서비스 추가(예: `member-stats.service.ts`) 또는 별도 `modules/admin_stats`. **어드민 전용**(`AuthGuard('jwt')` + `role==='ADMIN'` / RolesGuard).
- 엔드포인트(초안):

| 메서드 | 경로 | 파라미터 | 반환 |
|--------|------|---------|------|
| GET | `/api/stats/members/summary` | `?surface=main\|start\|all` | 누적/신규 가입, 활성(DAU/WAU/MAU), 구글:매직 비율 |
| GET | `/api/stats/members/by-surface` | `?range=` | 서피스별 가입 수·활성·리텐션 나란히 비교 |
| GET | `/api/stats/members/funnel` | `?surface=`, `?range=` | 서피스별 전환 퍼널(아래 지표) |
| GET | `/api/stats/members/timeseries` | `?metric=`, `?surface=` | 일자별 시계열 |

- 서피스별 퍼널 지표(자체 DB 조인 — 정확):
  - **main**: 가입 → catalog 조회(있으면) → concept 구매(구매 테이블) → 에이전트 등록(`kaas.agent`)
  - **start**: 가입 → 워크샵 빌드 저장 → 벤치 실행 → 에이전트 등록 → MCP 설치 성공(`install-build`) → 샵 구매(크레딧 원장)
  - 근거 테이블: `core.app_user`(가입/서피스), 크레딧 원장(구매/충전), `kaas.agent`(등록), `kaas.agent_task`, 구매 delivery.

### A-4. 어드민 대시보드 UI

- 개발자 앱(`/`)에 이미 `role==='ADMIN'` 게이팅 존재 → 사이드바에 "Analytics" 섹션 추가, 위 API 소비.
- 서피스 토글(main/start/전체) + 시계열 차트(recharts 이미 사용) + 퍼널 바.

---

## 3. Part B — GA4 행동 분석

### B-1. 구조: 프로퍼티 1개 + `surface` 차원 (2벌로 쪼개지 말 것)

- 하나의 GA4 프로퍼티, 모든 이벤트에 `surface: 'main'|'start'` 파라미터 + GA4 `content_group=surface`.
- 이유: 서피스별 분리 리포트 + **cross-surface 이동(consumer↔developer)** 을 한 곳에서 추적. 로그인(`user_id`) 공유로 여정 연속성 유지.
- 등록: **커스텀 디멘션 `surface`**(이벤트 범위), **`user_id`**(로그인 회원 id, 아래 규칙).

### B-2. Next.js 통합

| 항목 | 설계 |
|------|------|
| 스크립트 | `app/layout.tsx`에 `next/script`로 gtag 삽입(`NEXT_PUBLIC_GA_ID`). 없으면 미주입 |
| 페이지뷰 | SPA 라우팅이라 자동 집계 안 됨 → `usePathname` 변화 감지 래퍼(`components/analytics/ga-provider.tsx`)에서 수동 `page_view` |
| 서피스 자동주입 | 래퍼가 pathname(`/start` 접두)로 `surface` 판정 → 모든 이벤트에 자동 부착(개별 태깅 부담 X) |
| user_id | 로그인 상태에서 회원 id(원본 아님, 아래) 설정; 로그아웃 시 해제 |

### B-3. 이벤트 스키마 (서피스별 퍼널)

공통 파라미터: `surface`, (로그인 시)`user_id`.

**main (developer)**
| 이벤트 | 시점 |
|--------|------|
| `sign_up` / `login` (`method: google\|magic`) | 가입/로그인 |
| `catalog_view` / `concept_view` (`concept_id`) | 마켓 탐색 |
| `concept_purchase` (`concept_id`, `credits`) | 구매 |
| `console_query` | Cherry Console 사용 |

**start (consumer)**
| 이벤트 | 시점 |
|--------|------|
| `sign_up` / `login` | 가입/로그인 |
| `workshop_build_saved` (`slot_count`) | 카드 조립 저장 |
| `benchmark_run` (`set_id`, `has_member_key`) | 벤치 실행(회원키 없으면 이탈 신호) |
| `agent_register` (`wallet: evm\|near`) | 에이전트 등록 |
| `install_build_success` | MCP 설치 완료(진짜 활성) |
| `shop_purchase` (`credits`, `chain`) | 샵 구매 |

**cross-surface**: `cross_surface_move` (`from_surface`, `to_surface`) — 한 세션에서 서피스 전환 시.

### B-4. user_id 규칙 (개인정보 최소화)

- GA4 `user_id` = **내부 회원 id(UUID) 또는 그 해시** — **이메일·이름·지갑주소 절대 금지**.
- 이걸로 GA4에서 "로그인 회원의 서피스 간 행동" 코호트 분석 가능.

### B-5. ⚠️ 민감정보 차단 규칙 (필수)

- GA/외부 분석기로 **회원 Anthropic API 키, 지갑주소, 이메일, 매직토큰**을 이벤트·URL 파라미터에 **절대 전송 금지**.
- 코드리뷰 체크리스트 항목화. 이벤트 페이로드 화이트리스트 방식(허용된 키만 전송).

### B-6. 동의 배너 + Consent Mode v2

- 현재 동의 UI 없음. GA4는 쿠키 사용 → 글로벌/EU 대상이면 **동의 배너 + Consent Mode v2** 필요.
- 기본값 = **거부 시 미수집**(개인정보 보호 우선). 동의 전에는 gtag `consent default denied`.

---

## 4. 서피스별로 "무엇을 조사하는가" 요약

| 질문 | 답하는 층 |
|------|-----------|
| start로 들어온 회원 vs main으로 들어온 회원 수/활성도 | A (signup_surface GROUP BY) |
| 컨슈머 퍼널에서 어디서 가장 많이 이탈하나(예: 회원키 등록 장벽) | B (benchmark_run has_member_key 이탈률) + A |
| 개발자 앱 방문자가 컨슈머 앱으로 넘어오나 | B (cross_surface_move, user_id) |
| 서피스별 크레딧 소비·구매 정확 집계 | A (크레딧 원장 조인) |
| 유입 채널(어디서 왔나)·기기·국가 | B (GA4 기본) |

---

## 5. 구현 순서 (제안, 검토 후 확정)

1. **Phase 1 (A 기반)**: DB 마이그레이션(사용자 직접 적용) → 엔티티/DTO/서비스 서피스 배선(구글+매직) → 최소 회원 요약 API.
2. **Phase 2 (A 확장)**: 서피스별 퍼널 API + 어드민 대시보드 UI.
3. **Phase 3 (B)**: GA4 스크립트 + 라우트 페이지뷰 래퍼 + 서피스 자동주입 + 핵심 이벤트.
4. **Phase 4 (B 보강)**: user_id 연동 + 동의 배너/Consent Mode + 민감정보 차단 검증.

> 각 Phase는 사용자 허락 후 착수. 무거운 작업(마이그레이션·빌드·배포)은 사용자가 직접.

---

## 6. 환경변수 추가 (예정)

| 앱 | 변수 | 용도 |
|----|------|------|
| Web(빌드타임) | `NEXT_PUBLIC_GA_ID` | GA4 Measurement ID (`G-XXXX`). 없으면 GA 미주입 |

---

## 7. 미결정 / 검토 필요 (다음 리뷰에서 확정)

1. **발주자 의도**: "마케팅 유입 분석(B 위주)"인가 "회원 비즈니스 지표(A 위주)"인가 — 우선순위 확정 필요.
2. GA4로 갈지, 이미 있는 `@vercel/analytics`로 트래픽만 볼지, 제품 퍼널까지면 PostHog(셀프호스팅=민감정보 통제 유리)로 갈지.
3. 기존 회원(signup_surface NULL) 백필 정책 — 그대로 둘지, 추정 백필할지.
4. 회원 통계 API를 `modules/stats` 확장 vs 신규 `modules/admin_stats` 분리.
5. `utm_*`(유입 채널) 저장까지 A에 포함할지(현재 범위 밖으로 둠).
6. 동의 배너 도입 범위(전 서피스 vs start만).

---

*(이 문서는 검토용 기획서. 실제 코드와 대조해 문제를 잡은 뒤 구현 착수. 관련: `apps/docs/agent_read/api-backend-status-2026-07-13.md`, `apps/docs/handoff/handoff-2026-07-13.md`.)*
