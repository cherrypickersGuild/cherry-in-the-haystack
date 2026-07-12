# 벤치마킹 — 회원별 Claude API 키 구현 기획서

> 목적: 벤치마크(Workshop bench) 실행에 쓰는 LLM 키를 **공용 `.env`가 아니라 로그인한 회원 본인의
> Claude(Anthropic) API 키**로 사용한다. 키는 DB에 **암호화 저장**, 회원은 **Settings**에서 등록한다.
> 대상 브랜치: **deploy**. 커밋/푸시/배포는 승인 후.

---

## 0. 요약 / 범위

| 항목 | 결정 |
|------|------|
| 키 저장 | `core.app_user`에 **암호화(AES-256-GCM)** 저장. env 아님 |
| 복호화 키 | **Dokploy env `BENCH_KEY_SECRET`** (32바이트) |
| 검증 | 저장 시 **형식만**(`sk-ant-` 등). 실행 시 실패하면 **세분화 에러** |
| 미등록 정책 | **키 없으면 bench 비활성** → "Settings에서 키 등록" 안내. env 폴백 없음 |
| UI | **Logout 왼쪽 Settings(⚙️) 버튼** → 키 등록 모달 |
| 인증 | bench **`/run`·`/compare`** 에 **JWT 인증 추가** (둘 다 LLM 사용) |
| provider | 회원 키 실행은 전역 `BENCH_LLM_PROVIDER`(현재 flock) 무시하고 **Anthropic(claude) 강제** |
| 범위 | API 키 등록 + 그 키로 bench 실행(로컬). **Claude Code 실행 방식은 후속** |

---

## 1. 현행 구조 (as-is)

- **bench 실행**: `POST /api/v1/kaas/bench/run` **및 `/compare`** (둘 다 `callClaude` 사용) — **인증 없음**, 유저 모름
- **LLM 호출**: `bench.service` → `callClaude(input)` (`anthropic.client.ts`) → **공용 싱글턴 + `process.env.ANTHROPIC_API_KEY`**
- **provider**: `BENCH_LLM_PROVIDER` 전역 상수. **현재 `.env`는 `flock`** (claude·flock·openai 지원하나 현재 flock 선택). 회원 Anthropic 키는 **claude 경로로 강제**해야 함 (§4-5)
- **프론트**: `lib/bench-api.ts`의 `fetchBenchSets/compare/run` — **Authorization 헤더 없음** (단 `lib/auth.ts`에 `authHeaders()`, `getAccessToken()` 존재)
- **Logout 버튼**: `components/cherry/consumer-nav.tsx` (cherry-for-everyone 공용 네비)
- **인증 기반**: `AuthGuard('jwt')` + `@Get('me')`처럼 `RequestWithJwtUser.user.id` 사용 패턴 존재

---

## 2. 암호화 설계 (핵심)

### 방식: AES-256-GCM (양방향, 복호화 가능)
- API 키는 실제 Anthropic 호출에 그대로 써야 하므로 **해시 불가 → 대칭 암호화**
- **저장 형식(한 컬럼)**: `base64(iv):base64(authTag):base64(ciphertext)`
- **키(secret)**: `BENCH_KEY_SECRET` = 32바이트. 예: `openssl rand -hex 32` → Dokploy api env
- **암/복호화 위치**: API 서버에서만. **평문 키는 DB·로그·프론트 어디에도 안 남김**

### 위협 모델(무엇을 막나)
- ✅ **DB만 유출**(백업/스냅샷/SQLi) → 암호문이라 사용 불가
- ⚠️ 서버 전체 장악(env+DB) → 복호화 키도 노출되나, Dokploy env 유출 확률 낮다는 전제로 수용

---

## 3. DB 마이그레이션

`apps/docs/staged_mock/bench-member-key-migration.sql` (기존 스타일):
```sql
ALTER TABLE core.app_user
  ADD COLUMN IF NOT EXISTS bench_api_key_enc TEXT NULL;   -- AES-GCM 암호문(iv:tag:cipher)
```
- 마스킹 표시는 **복호화 후 서버에서 마스킹만 반환**하므로 별도 컬럼 불필요
- nullable → 기존 회원 무영향

---

## 4. 백엔드

### 4-1. env
```
BENCH_KEY_SECRET=<openssl rand -hex 32 결과>   # apps/api/.env + Dokploy api env (복호화 키)
BENCH_MEMBER_MODEL=claude-haiku-4-5            # (선택) 회원 키 실행 시 쓸 Claude 모델 기본값
```
> 회원 키 실행은 전역 `BENCH_LLM_PROVIDER`(현재 flock)를 무시하고 claude로 가므로, flock용 `BENCH_MODEL`이 아닌 **Claude 모델**을 써야 함.

### 4-2. 암호화 유틸 `apps/api/src/utils/crypto.ts`
```
encryptSecret(plain): string
  // aes-256-gcm
  // key  = Buffer.from(BENCH_KEY_SECRET, 'hex')  → 32바이트 (secret은 64 hex chars = openssl rand -hex 32)
  // iv   = randomBytes(12)  (GCM 권장 12바이트)
  // 반환 = base64(iv):base64(authTag):base64(ciphertext)
decryptSecret(enc): string     // 위 형식 파싱 → 복호화
maskKey(plain): string         // 'sk-ant-…AB12' 형태
```
- `BENCH_KEY_SECRET` 없거나 길이 이상 → 서버 부팅/저장 시 명확히 에러 (평문 저장 절대 금지)

### 4-3. 회원 키 엔드포인트 (`app-user`, JWT 인증)
| 라우트 | 동작 |
|--------|------|
| `PUT /app-user/bench-key` | body `{ apiKey }` → **형식 검증**(`sk-ant-` 시작·길이) → 암호화 → 저장. 반환 `{ hasKey:true, masked }` |
| `DELETE /app-user/bench-key` | `bench_api_key_enc = NULL` |
| `GET /app-user/bench-key` | `{ hasKey, masked }` (복호화→마스킹만 반환, 원문 절대 X) |
- 서비스: `AppUserAuthService`에 `setBenchKey/getBenchKeyStatus/deleteBenchKey`. `@Get('me')`와 동일한 JWT 유저 컨텍스트 사용.

### 4-4. bench 실행에 인증 + 회원 키 주입

**대상 라우트 (검토 확정): `/run` **과** `/compare` 둘 다 LLM(`callClaude`) 사용** → 둘 다 인증+회원키 필요.
`@Get('sets')`는 LLM 미사용 → 인증 불필요. bench 활성화 게이팅은 프론트 hasKey로.

**⚠️⚠️ 가드는 반드시 라우트별로 (2차 검토 치명):**
- bench 컨트롤러엔 **무인증 MCP tool 라우트**(`tools/search-marketplace`, `tools/search-cherry-docs`, `tools/get-crypto-price`)가 있음 — Claude Code 에이전트용
- **`@Controller` 레벨에 가드 붙이면 이 tool 라우트가 다 깨짐** → **`@Post('run')`·`@Post('compare')`에만 개별 `@UseGuards(AuthGuard('jwt'))`**

**모듈 배선 (이거 안 하면 안 됨):**
- `AuthGuard('jwt')` 전략은 `common/basic-module/auth.module.ts`(RoleJwtStrategy) → **`BenchModule`이 `AuthModule` import**
- 키 로드·복호화는 `BenchService`(의존성 0)로 불가 → **`BenchModule`이 `AppUserModule` import**
  - `AppUserModule`은 이미 **`AppUserService`(facade)만 export** → 키 로드 메서드 `getDecryptedBenchKey(userId)`를 **`AppUserService`에 추가**(내부에서 AuthService+복호화 위임). AppUserAuthService 새로 export 불필요
  - `BenchController`에 `AppUserService` 주입
- `RequestWithJwtUser` 타입은 app-user.controller **로컬 정의**(export 안 됨) → bench에선 **인라인 재정의**(또는 common으로 추출)

**컨트롤러 흐름 (run·compare 공통):**
```
@UseGuards(AuthGuard('jwt'))
run/compare(req, body):
  userId = (req as RequestWithJwtUser).user.id        // app-user.controller와 동일 패턴
  apiKey = await appUserAuth.getDecryptedBenchKey(userId)  // enc 없으면 내부에서 null
  if !apiKey → 400 { error: 'NO_BENCH_KEY' }          // 프론트: 등록 안내
  return bench.run/compare(..., apiKey)
```
- `bench.service`에 apiKey 스레딩: `run(taskId, build, apiKey)`(직접 callClaude :164/:171) + `compare(setId, apiKey)` + **private 공유 헬퍼 `runBaseline(set, apiKey)`·`runEnhanced(set, apiKey)`**(:246/:261, compare가 이걸 씀)까지 전부 전달

### 4-5. `callClaude` 리팩터 (키 인자화 + provider 강제) ⚠️ 검토 핵심

**문제**: 현재 `.env`가 `BENCH_LLM_PROVIDER=flock`이고, `BENCH_PROVIDER`/`DEFAULT_MODEL`은 **모듈 로드 시 전역 상수**로 고정. 클라이언트도 **싱글턴**(`sharedClient`, env 키). 회원 Anthropic 키를 이 전역(flock) 경로에 넣으면 **동작 안 함**. (코드는 claude·flock 둘 다 지원하지만 지금 전역 선택이 flock)

**해결**: 회원 키가 있는 실행은 **전역 provider를 무시하고 강제로 Anthropic(claude) 경로**로:
```
callClaude(input, opts?: { apiKey?: string; provider?: 'claude'|'openai'|'flock'; model?: string })
```
- 회원 키 실행 → `opts = { apiKey: <회원키>, provider: 'claude', model: <Claude 모델> }`
  - `provider='claude'` → Anthropic 경로 강제 (전역 BENCH_PROVIDER=flock 무시)
  - **`new Anthropic({ apiKey })` per-call** (싱글턴 `getClient()` 우회; 키별 캐시 가능)
  - `model`은 Claude 모델 명시 (예: `BENCH_MEMBER_MODEL` env 기본 `claude-haiku-4-5`) — flock용 `DEFAULT_MODEL`을 쓰면 안 됨
- `opts` 없으면 기존 전역 동작(하위호환)

**정리**: 단순 `apiKey` 인자 추가가 아니라, **회원 키 = {Anthropic provider + Claude model + per-call client}** 셋을 함께 강제해야 실제로 회원 계정으로 과금됨.

### 4-6. 실행 에러 세분화 (요구사항)
**기존 bench 컨트롤러 패턴에 맞춤**: `throw new HttpException({ statusCode, code, message }, statusCode)` (프론트는 **`err.code`** 로 분기). `{error,...}` 아님.

| 상황 | throw HttpException |
|------|------|
| 키 미등록 | `{ statusCode:400, code:'NO_BENCH_KEY', message:'Settings에서 Claude API 키를 등록하세요.' }` |
| 401 인증 실패 | `{ statusCode:400, code:'INVALID_API_KEY', message:'API 키가 유효하지 않습니다. Settings에서 확인하세요.' }` |
| 429 | `{ statusCode:429, code:'RATE_LIMITED', message:'요청이 많습니다. 잠시 후 재시도.' }` |
| 크레딧 부족 | `{ statusCode:400, code:'INSUFFICIENT_CREDITS', message:'Anthropic 크레딧이 부족합니다.' }` |
| 기타 | `{ statusCode:500, code:'BENCH_FAILED', message: 상세 }` |
- Anthropic SDK 에러의 `.status`로 분기. `run`(Promise.all baseline/enhanced)·`compare` 모두 이 매핑으로 감쌈.

---

## 5. 프론트

### 5-1. Settings 버튼 (`components/cherry/consumer-nav.tsx`)
- 로그인 상태일 때 **Logout 왼쪽에 ⚙️ Settings 버튼** → Settings 모달 오픈

### 5-2. Settings 모달 (신규 `components/cherry/settings-modal.tsx`)
- **Anthropic API 키 입력**(type=password) + Save / Delete
- 진입 시 `GET /app-user/bench-key`로 `hasKey/masked` 표시 (`sk-ant-…AB12`)
- 저장: `PUT /app-user/bench-key` (+ `authHeaders()`), 형식 오류/성공 토스트
- 원문은 화면에 다시 안 보여줌(마스킹만)

### 5-3. bench 게이팅 (`app/start/workshop/page.tsx`)
- **비로그인 상태는 이미 처리됨** (`if(!token)` → `/start/login?next=/start/workshop`). 우리는 **로그인한 뷰 안에** 아래만 추가:
- 로드시 `hasKey` 확인 (`GET /app-user/bench-key`)
  - **키 없으면**: bench 영역에 **"벤치마크를 쓰려면 Settings에서 Claude API 키를 등록하세요"** + Settings 열기 버튼, 실행 버튼 비활성
  - **키 있으면**: 정상 활성

### 5-4. bench 호출에 인증 + 에러표시 (`lib/bench-api.ts`)
- `run/compare` fetch에 **`...authHeaders()`** 추가
- 응답이 `NO_BENCH_KEY` → 등록 안내 표시
- `INVALID_API_KEY/RATE_LIMITED/…` → 해당 메시지 노출

---

## 6. 단계별 구현 순서

| 단계 | 작업 | 통과 기준 |
|------|------|-----------|
| **P1** | DB 마이그레이션(`bench_api_key_enc`) | 컬럼 존재 |
| **P2** | `crypto.ts` 유틸 + `BENCH_KEY_SECRET` env | 암/복호화 왕복 테스트 OK |
| **P3** | 회원 키 엔드포인트(PUT/GET/DELETE, JWT) | Swagger 노출 + 저장/조회(마스킹) 동작 |
| **P4** | bench 인증 추가 + 키 로드 + `callClaude(apiKey)` + 에러매핑 | 회원 키로 run, 무효키 시 세분화 에러 |
| **P5** | Settings 버튼 + 모달 | 키 저장/삭제 UI 동작 |
| **P6** | bench 게이팅 + auth 헤더 + 에러표시 | 키 없으면 안내, 있으면 실행 |
| **P7** | end-to-end (로컬) | 등록→bench 실행→내 키로 과금 확인 |

---

## 7. 테스트 계획
- **키 등록**: 유효 키 저장 → DB엔 암호문, GET은 마스킹만
- **암호화 왕복**: encrypt→decrypt 원문 일치
- **미등록**: bench 진입 시 안내 표시, run 시 `NO_BENCH_KEY`
- **무효 키**: 잘못된 키로 run → `INVALID_API_KEY` 메시지
- **정상 실행**: 내 키로 baseline/enhanced 응답, 과금은 내 Anthropic 계정
- **삭제**: DELETE 후 다시 비활성

## 8. 보안 체크
- 평문 키: DB/로그/프론트/응답 어디에도 저장·노출 금지 (마스킹만)
- `BENCH_KEY_SECRET`는 Dokploy env에만
- 저장 형식검증으로 명백한 오입력 차단

## 9. 대상 파일
| 파일 | 변경 |
|------|------|
| `apps/docs/staged_mock/bench-member-key-migration.sql` | `bench_api_key_enc` |
| `apps/api/src/utils/crypto.ts` | 암/복호화·마스킹 |
| `apps/api/src/modules/app_user/app-user-auth.service.ts` (+facade, controller, dto) | 키 저장/조회/삭제 |
| `apps/api/src/modules/bench/bench.controller.ts` | `/run`·`/compare`에 JWT 가드 + 키 로드 |
| `apps/api/src/modules/bench/bench.module.ts` | **AuthModule + AppUserModule import** (가드·키서비스) |
| `apps/api/src/modules/app_user/app-user.service.ts` (facade) | `getDecryptedBenchKey(userId)` 추가 (이미 export됨 → 모듈 변경 불필요) |
| `apps/api/src/modules/bench/bench.service.ts` | `run(…, apiKey)` · `compare(…, apiKey)` |
| `apps/api/src/modules/bench/anthropic.client.ts` | `callClaude(input, {apiKey, provider, model})` + 에러매핑 |
| `apps/api/.env` (+Dokploy) | `BENCH_KEY_SECRET` |
| `apps/web/components/cherry/consumer-nav.tsx` | Settings 버튼 |
| `apps/web/components/cherry/settings-modal.tsx` | 키 등록 모달(신규) |
| `apps/web/app/start/workshop/page.tsx` | bench 게이팅 |
| `apps/web/lib/bench-api.ts` | auth 헤더 + 에러표시 |

## 10. 롤백
- 프론트/백엔드 변경 되돌리면 기존 공용 키 방식 복귀 가능 (단 `callClaude`는 apiKey 옵셔널이라 하위호환)
- DB 컬럼 nullable → 남겨도 무해
