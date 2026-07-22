# 벤치마크 API 키 72시간 자동 만료 — 구현 기획서

> **작성일**: 2026-07-23 · **상태**: 기획(검토 대기, 미구현)
> **목적**: 회원이 등록한 Claude(Anthropic) API 키를 **등록 시점부터 72시간 뒤 자동 삭제**한다.
> **정책**: `apps/docs/agent_read/agent-policy.md` 준수 — 코드 수정·커밋은 사용자 허락 후. 기획서는 **최소 3회 검토, 1회마다 멈춤**.

---

## 0. 배경 — 현재 문제

### 0-1. 지금 상태 (코드 확인 완료)
`core.app_user` 에 컬럼이 **하나뿐**이다.
```
bench_api_key_enc: string | null   ← 이것이 전부. 만료 관련 필드 없음
```

| 동작 | 현재 |
|------|------|
| 등록 `setBenchKey` | 암호화 저장. **만료 시각 기록 안 함** |
| 조회 `getDecryptedBenchKey` | 복호화만. **날짜 검사 없음** |
| 삭제 `deleteBenchKey` | `null` 처리. **사용자가 직접 지워야만** 사라짐 |

→ **한 번 등록하면 무기한 유지**된다.

### 0-2. 왜 고쳐야 하나
| 위험 | 내용 |
|------|------|
| 🔴 **과금 노출** | 회원 본인 Anthropic 계정으로 과금되는 구조. 잊고 방치된 키로 계속 청구될 수 있음 |
| 🔴 **유출 시 피해 지속** | DB 유출 시 만료가 없어 무기한 악용 가능 |
| 🟠 **폐기 키 잔존** | 사용자가 Anthropic 콘솔에서 revoke 해도 우리 DB엔 남아 401만 반복 |
| 🟠 **최소 보관 원칙 위반** | 벤치마크는 일회성 성격인데 자격증명을 영구 보관 |

### 0-3. 확정된 정책
- **기준**: **등록 시점**부터 고정 **72시간**. (사용해도 연장되지 않음)
- **이유**: 벤치마크는 한 번 돌려보는 용도라 오래 보관할 이유가 없고, 규칙이 단순해야 사용자가 예측 가능하다.
- **안내 문구 필수**: 등록 전·후 모두 만료를 명시한다.
- **D1 확정** — **기존 등록 키(1건)는 즉시 만료**. 마이그레이션에서 함께 비운다(§1-1).

### 0-4. 1회차 검토로 확인된 사실 (실제 코드 대조)

| 전제 | 확인 결과 |
|------|-----------|
| 키 복호화 경로가 하나뿐인가 | ✅ **`getDecryptedBenchKey` 단일 경로**. 여기만 막으면 100% 차단 |
| `null` 반환 시 에러 흐름 | ✅ `bench.controller.ts` `requireBenchKey`가 이미 `NO_BENCH_KEY` 던짐 → **추가 작업 불필요** |
| 크론 인프라 | ✅ `@nestjs/schedule` 설치·구동 중 → **새 패키지 불필요** |
| 상태 조회 경로 | ✅ `getBenchKeyStatus` 단일 경로(컨트롤러 1곳) |
| ⚠️ 계층 구조 | `app-user.service.ts`(**파사드**) → `app-user-auth.service.ts`(구현). **두 곳 다 고쳐야 함** |

**3회차 검토 — 구현 정확성 (실제 코드 대조)**

| 항목 | 확인 결과 |
|------|-----------|
| **동일 선례 존재** | ✅ `magic_token_expires_at` 이 **완전히 같은 구조**. `toDate()` 헬퍼도 이미 있음 → **그 패턴을 그대로 따른다** |
| 만료 판정 위치 | **읽을 때(②)는 앱에서** `expiresAt.getTime() < Date.now()` (매직토큰 선례). **크론(③)은 DB `NOW()`** — 청소용이라 초 단위 차이 무해. 저장도 앱 기준 `new Date()+72h` 로 통일 |
| `expiresAt` 직렬화 | **ISO 8601 문자열**(`toISOString()`)로 고정 — 프론트가 남은 시간 계산에 사용 |
| lazy delete 동시성 | ✅ 동시 요청이 와도 `= null` 은 **멱등** → 락 불필요 |
| 삭제 실패 시 | ⚠️ UPDATE 실패해도 **반드시 `null` 반환**. 삭제 실패가 "키 사용 허용"이 되면 안 됨 |

**2회차 검토 — 보안·엣지케이스 (실제 코드 대조)**

| 항목 | 확인 결과 |
|------|-----------|
| 키를 로그에 찍는 곳 | ✅ **없음**. `logger.*`·`console.*` 어디에도 `apiKey` 출력 없음 → 기존 코드가 이미 안전 |
| 벤치 실행 중 만료 | ✅ **문제없음**. `requireBenchKey` 는 **실행 시작 시 1회만** 호출(`bench.controller.ts` 130·192행). 이후 호출은 `max_tokens 1024`·툴 반복 최대 5회로 **수 초~수십 초**. 경계에 걸려도 이미 꺼낸 키로 그 실행만 완료되고 중간에 끊기지 않음 |
| 탈퇴/비활성 사용자 | 🟡 **현재는 발생 안 함** — 탈퇴 엔드포인트·상태 변경 코드가 **존재하지 않음**. 다만 크론이 사용자 상태를 조건에 넣지 않도록 설계(§1-3) |
| `updated_at` 부작용 | 🟡 크론이 갱신하면 "정보 수정됨"으로 오인 → 크론은 건드리지 않음(§1-3) |

---

## 1. 설계 — 3중 방어

크론 하나만 두면 **크론이 죽었을 때 만료된 키가 계속 쓰인다.** 세 겹으로 간다.

```
① DB에 만료 시각 저장        → 근거(단일 진실)
② 읽을 때 만료 검사 + 즉시 삭제 → 안전장치 (가장 중요)
③ 크론으로 주기적 청소        → 물리적 정리
```

### 1-1. ① DB — 만료 시각 컬럼
마이그레이션: `apps/docs/staged_mock/bench-key-expiry-migration.sql` (신규)
```sql
ALTER TABLE core.app_user
  ADD COLUMN IF NOT EXISTS bench_api_key_expires_at TIMESTAMPTZ NULL;

-- D1 확정: 기존 등록 키(1건)는 즉시 만료 = 지금 비운다.
-- 이렇게 하면 'expires_at 이 NULL 인 유효 키'라는 예외 상태가 아예 없어져 로직이 단순해진다.
UPDATE core.app_user
   SET bench_api_key_enc = NULL,
       bench_api_key_expires_at = NULL,
       updated_at = NOW()
 WHERE bench_api_key_enc IS NOT NULL;

-- 청소 크론용
CREATE INDEX IF NOT EXISTS idx_app_user_bench_key_expires
  ON core.app_user (bench_api_key_expires_at)
  WHERE bench_api_key_enc IS NOT NULL;
```
- 등록 시 `now() + 72h` 기록
- 삭제 시 `bench_api_key_enc` 와 **함께 `null`**
- `AppUserEntity` 에도 필드 추가

> ⚠️ **`expires_at` 이 `NULL` 인데 키가 있는 경우** — 위 UPDATE 로 현재는 존재하지 않지만,
> 수동 INSERT 등으로 생길 수 있다. 코드는 **`NULL` = 만료로 간주(거부)** 한다.
> 만료 시각을 알 수 없는 자격증명은 신뢰할 수 없기 때문이다. (fail-safe)

### 1-2. ② 읽을 때 검사 (핵심 안전장치)
`getDecryptedBenchKey(userId)` 에서:
```
만료됐으면 → DB에서 즉시 삭제(lazy delete) → null 반환
```
- **크론이 안 돌아도 만료된 키는 절대 사용되지 않는다.**
- bench 컨트롤러는 `null` 을 이미 `NO_BENCH_KEY` 로 처리하므로 **기존 에러 흐름 그대로** 탄다.
- `getBenchKeyStatus` 도 동일하게 만료를 반영(만료면 `hasKey: false`).

### 1-3. ③ 크론 — 주기적 청소
**기존 인프라 재사용**: `@nestjs/schedule` 이 이미 설치·구동 중(`AppScheduleModule`, `ingestion-schedule.service.ts` 에 `@Cron` 사용 중). **새 패키지 불필요.**

```ts
@Cron(CronExpression.EVERY_HOUR)
async purgeExpiredBenchKeys() {
  // bench_api_key_enc IS NOT NULL AND bench_api_key_expires_at < now()
  //   → bench_api_key_enc = null, bench_api_key_expires_at = null
  // 삭제 건수만 로그 (키 값은 절대 로그 금지)
}
```
- 최대 **1시간 내** 물리 삭제

#### ⚠️ 크론은 **사용자 상태를 조건에 넣지 않는다** (2회차 검토 반영)

`getDecryptedBenchKey` 는 `getActiveUserById` 를 거치므로 **`is_active = true AND revoked_at IS NULL`** 인 사용자만 조회된다.
따라서 비활성 사용자의 키는 ②(읽을 때 삭제)가 **영원히 실행되지 않는다.**

현재 코드엔 **탈퇴/비활성화 기능이 없어**(엔드포인트 없음, `is_active`·`revoked_at` 을 바꾸는 코드 없음) 실제로 발생하지 않지만,
DB를 직접 수정하는 경우(로컬·프로덕션 공유 환경)나 향후 탈퇴 기능이 생기면 문제가 된다.

→ **크론 WHERE 절에는 `is_active` / `revoked_at` 을 넣지 않는다.**
```sql
WHERE bench_api_key_enc IS NOT NULL
  AND bench_api_key_expires_at < NOW()
```
사용자 상태와 무관하게 **만료된 키는 무조건 지운다.** 추가 비용이 없고, 나중에 탈퇴 기능이 생겨도 자동으로 안전하다.

#### ⚠️ 크론은 `updated_at` 을 갱신하지 않는다
`setBenchKey` 등은 `updated_at` 을 갱신하지만, 크론이 대량 UPDATE 하며 이를 건드리면
**"사용자 정보가 수정됨"으로 오인**될 수 있다. 크론은 **키 관련 컬럼만** 비운다.

#### ⚠️ 크론 서비스를 어디에 둘 것인가 (1회차 검토 반영 — D2 확정)

`AppScheduleModule` 의 `providers` 는 현재 `[IngestionScheduleService]` 뿐이다.
거기에 새 서비스를 넣으면 **`schedule.module.ts` 수정 + `AppUserModule` import** 라는 모듈 간 배선이 새로 생긴다.

→ **`AppUserModule` 안에 두는 것으로 확정.**
`ScheduleModule.forRoot()` 가 이미 전역으로 켜져 있어 **어느 모듈의 provider든 `@Cron` 이 동작**한다.
키를 다루는 로직이 `app_user` 안에 모여 응집도도 높아지고, 모듈 간 의존도 늘지 않는다.

---

## 2. 안내 문구 (필수)

### 2-1. 백엔드 응답 확장
`GET /app-user/bench-key` 응답에 만료 정보 추가:
```ts
{ hasKey: boolean, masked: string | null, expiresAt: string | null }
```
프론트가 남은 시간을 계산해 표시한다.

### 2-2. 프론트 — Settings 모달 (`settings-modal.tsx`)

**현재 문구**
> 벤치마크는 **본인 Claude(Anthropic) API 키**로 실행됩니다. 키는 암호화되어 저장되고…

**추가할 문구 (등록 전 — 안내)**
> 🔒 보안을 위해 **등록 후 72시간(3일)이 지나면 자동으로 삭제**됩니다. 이후 다시 사용하려면 재등록이 필요합니다.

**등록 후 상태 표시**
| 상태 | 표시 |
|------|------|
| 등록됨 | `등록됨 · sk-ant-…AB12` + **`2일 5시간 후 만료`** |
| 만료 임박(24시간 미만) | 같은 표시를 **주의 색(주황)** 으로 |
| 만료됨 | `미등록` + "만료되어 삭제되었습니다. 다시 등록해 주세요." |

**등록 직후 토스트**
> 등록되었습니다. **72시간 후 자동 삭제**됩니다.

> ⚠️ 문구는 **영문/한글 컨벤션**을 따른다. 이 모달은 현재 한국어를 쓰고 있으므로 한국어 유지. (Building Blocks·Overview 등 신규 페이지는 영문 컨벤션이라 서로 다름 — 혼동 주의)

### 2-3. Workshop 페이지
키가 없어 벤치가 비활성일 때 기존 안내에 만료 가능성을 덧붙일지 → §3 D3

---

## 3. 미결정 (검토에서 확정)

| # | 항목 | 선택지 | 비고 |
|---|------|--------|------|
| **D7** | (범위 밖) 탈퇴 기능 생길 때 키 동시 삭제 | 그때 반영 | 지금은 탈퇴 기능 자체가 없음 |

**확정됨 (1회차 검토)**
- ~~D1 기존 키 처리~~ → **즉시 만료**. 마이그레이션에서 함께 비움(§1-1). 기존 키 1건뿐이라 영향 최소.
- ~~D2 크론 위치~~ → **`AppUserModule` 안**. 전역 `ScheduleModule.forRoot()` 덕에 모듈 배선이 안 늘어남(§1-3).
- ~~D6 크론의 `updated_at` 갱신~~ → **갱신하지 않음**. 키 컬럼만 비운다(§1-3).

**확정됨 (3회차 검토 — 권고안 채택)**
- ~~D3 Workshop 안내~~ → **생략**. Settings 모달에서 충분히 안내됨.
- ~~D4 만료 임박 기준~~ → **24시간 미만**이면 주황 강조.
- ~~D5 크론 주기~~ → **1시간**(`EVERY_HOUR`).
- ~~D8 `expiresAt` 형식~~ → **ISO 8601 문자열**.

---

## 4. 리스크

| 심각도 | 항목 | 대응 |
|--------|------|------|
| 🔴 | **로컬·프로덕션 DB 공유** | 마이그레이션이 프로덕션에 즉시 반영됨. **사용자가 직접 1회 적용**, `ADD COLUMN IF NOT EXISTS` 로 안전하게 |
| 🟢 | ~~사용 중 만료~~ | **2회차 검토 결과 실질 위험 없음.** 키는 실행 시작 시 1회만 조회되고 실행은 수 초~수십 초 → 경계에 걸려도 그 실행은 정상 완료 |
| 🟠 | **기존 키 즉시 삭제** | D1 확정에 따라 마이그레이션 시점에 기존 1건이 사라짐 → 해당 사용자는 **재등록 필요** |
| 🟡 | **로그 유출** | 크론·삭제 로그에 **키 값·마스킹값 모두 남기지 않는다.** 건수만 |
| 🟡 | 시간대 | `TIMESTAMPTZ` 사용, 서버 시간 기준 통일 |

---

## 5. 검수표

범례: `-` 미착수 · `W` 진행 중 · `T` 테스트 통과 · `✅` 검수 완료

### Phase 0 — 기획 확정
| 항목 | 상태 | 메모 |
|---|---|---|
| 0-1 기획서 1회차 검토 | - | AI |
| 0-2 기획서 2회차 검토 | - | AI |
| 0-3 기획서 3회차 검토 | - | AI |
| 0-4 D1~D5 확정 | - | **사용자 승인** |

### Phase 1 — DB
| 항목 | 상태 | 메모 |
|---|---|---|
| 1-1 마이그레이션 SQL 작성 | - | AI |
| 1-2 `AppUserEntity` 필드 추가 | - | AI |
| 1-3 마이그레이션 적용 | - | **사용자 직접** (🔴 프로덕션 공유) |

### Phase 2 — 백엔드
| 항목 | 상태 | 메모 |
|---|---|---|
| 2-1 `setBenchKey` — 만료시각 기록 | - | AI |
| 2-2 `getDecryptedBenchKey` — 만료 검사 + 즉시 삭제 | - | AI · **핵심** |
| 2-3 `getBenchKeyStatus` — `expiresAt` 반환 | - | AI |
| 2-3b **파사드 `app-user.service.ts` 반환 타입 동기화** | - | AI · ⚠️ 1회차 발견 |
| 2-4 `deleteBenchKey` — 만료시각 함께 초기화 | - | AI |
| 2-5 크론 청소 서비스 (`AppUserModule` 에 provider 등록) | - | AI |
| 2-5b **크론 WHERE 절에 `is_active`/`revoked_at` 없음 확인** | - | AI · 2회차 발견 |
| 2-5c **크론이 `updated_at` 을 건드리지 않음 확인** | - | AI · 2회차 발견 |
| 2-6 로그에 키 값 없음 확인 | - | AI · 🟡 |

### Phase 3 — 프론트
| 항목 | 상태 | 메모 |
|---|---|---|
| 3-1 `bench-api.ts` — `expiresAt` 타입 반영 | - | AI |
| 3-2 Settings 등록 전 안내 문구 | - | AI |
| 3-3 남은 시간 표시 + 임박 강조 | - | AI |
| 3-4 등록 직후 토스트 | - | AI |

### Phase 4 — 검증
| 항목 | 상태 | 메모 |
|---|---|---|
| 4-1 `npx tsc --noEmit` (api·web) | - | AI |
| 4-2 만료 전/후 동작 확인 | - | AI |
| 4-3 크론 중지 상태에서도 만료 키 차단되는지 | - | AI · **3중 방어 검증** |
| 4-4 커밋 | - | **사용자 지시 시에만** |

## 성과 목표 (완료 기준)
- [ ] 등록 후 **72시간이 지난 키는 어떤 경로로도 사용되지 않는다** (크론이 죽어 있어도)
- [ ] 만료된 키는 **최대 1시간 내 DB에서 물리 삭제**된다
- [ ] 사용자가 **등록 전에 만료 정책을 안다** (안내 문구)
- [ ] 사용자가 **남은 시간을 확인할 수 있다**
- [ ] 로그·응답 어디에도 **키 평문이 남지 않는다**
- [ ] `npx tsc --noEmit` 신규 에러 없음

---

*(검토용. 코드 수정·커밋은 사용자 허락 후. 관련: `agent-policy.md`, `app-user-auth.service.ts`, `settings-modal.tsx`)*
