# Google 로그인 구현 기획서

> 목적: 기존 이메일 매직링크 로그인을 유지한 채 **"Google로 로그인"(Google Identity Services)** 을 추가하고,
> 프론트 로그인 화면은 이메일 입력 UI를 제거하고 **구글 버튼만** 노출한다.
> 대상 브랜치: **deploy** (배포). 커밋/푸시는 사용자 승인 후에만.

---

## 0. 요약 / 범위

| 구분 | 내용 |
|------|------|
| **유지** | 매직링크 백엔드(`signin`/`login`) — 코드 그대로, 삭제 안 함 |
| **추가(백엔드)** | `POST /app-user/google-login` — 구글 ID토큰 검증 → find-or-create → 기존 JWT 발급 |
| **변경(프론트)** | `app/start/login` 이메일 UI 제거 → "Google로 로그인" 버튼 |
| **DB** | `core.app_user`에 `google_sub`, `avatar_url` 컬럼 추가 |
| **Client ID** | `846409000652-5265k3mub14e62beu6og98h83vul2s99.apps.googleusercontent.com` |

**부수효과**: Resend 도메인 검증 문제와 무관하게 로그인 가능(구글이 이메일 인증 대행).

---

## 1. 현행 구조 (as-is)

### 백엔드
- 컨트롤러: `apps/api/src/modules/app_user/app-user.controller.ts`
  `@Controller('app-user')` → `signup / signin / login / refresh / logout / me`
- 서비스: `apps/api/src/modules/app_user/app-user-auth.service.ts`
  - `signin(dto, req)`: email로 유저 find-or-create → 매직토큰 생성 → Resend 발송
  - `login(dto, req, res)`: 매직토큰 검증 → `issueTokens(user)` → `setRefreshCookie(res, refreshToken)` → `{ accessToken, user: toLoginUserDto(user) }`
  - 재사용 가능한 헬퍼: **`issueTokens(user)`**, **`setRefreshCookie(res, rt)`**, **`getActiveUserByEmail(email)`**, **`toLoginUserDto(user)`**, `redisService`(refresh 저장), `knex`
- JWT/쿠키 인프라: `@nestjs/jwt`, `passport-jwt`, refresh는 Redis 저장 + 쿠키

### 프론트
- `apps/web/app/start/login/page.tsx`
  - 이메일 입력 → `POST /api/app-user/signin` (매직링크 발송)
  - URL의 토큰으로 `POST /api/app-user/login` → `data.accessToken` → `setAccessToken(...)` → next 경로로 이동
  - `API_URL`, `setAccessToken`(auth store), `localStorage("cherry_login_next")`

### DB (`core.app_user`)
- 있음: `id, email(NOT NULL, unique), name, subscription_tier, role, timezone, is_active, magic_token_*, last_login_at, …`
- **없음: `google_sub`, `avatar_url`**

---

## 2. 변경 설계 (to-be)

### 구글 로그인 흐름
```
[프론트] "Google로 로그인" 클릭 (Google Identity Services)
   → 구글 팝업/원탭 → credential(ID 토큰, JWT) 획득
   → POST /api/app-user/google-login { idToken }
[백엔드] googleLogin(idToken, req, res)
   ① google-auth-library로 검증 (audience = GOOGLE_CLIENT_ID)
   ② payload에서 email, name, picture, sub(구글 고유ID), email_verified 추출
   ③ find-or-create:
        - google_sub로 조회 → 있으면 그 유저
        - 없으면 email로 조회 → 있으면 google_sub/avatar 백필
        - 그래도 없으면 신규 INSERT (email, name, avatar_url, google_sub, 기본 tier/role)
   ④ last_login_at 갱신
   ⑤ issueTokens(user) + setRefreshCookie(res, rt)   ← 기존 로직 재사용
   → { accessToken, user }  (login과 동일 응답)
[프론트] data.accessToken → setAccessToken → next 이동  (기존 login 성공 처리 재사용)
```

---

## 3. DB 마이그레이션

`apps/api` 마이그레이션 규칙에 맞춰 파일 1개 추가. 내용:
```sql
ALTER TABLE core.app_user
  ADD COLUMN IF NOT EXISTS google_sub  VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS avatar_url  VARCHAR(1000) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_user_google_sub
  ON core.app_user (google_sub) WHERE google_sub IS NOT NULL;
```
- `google_sub`: 구글 계정 고유 ID(sub). partial unique(중복 방지, null 허용).
- `avatar_url`: 프로필 사진 URL.
- 기존 매직링크 유저(google_sub NULL)에 영향 없음.

---

## 4. 백엔드 상세

### 4-1. 의존성
```
apps/api: npm i google-auth-library
```

### 4-2. env
```
# apps/api/.env  (+ 배포 env)
GOOGLE_CLIENT_ID=846409000652-5265k3mub14e62beu6og98h83vul2s99.apps.googleusercontent.com
```

### 4-3. DTO
- `input-dto/google-login.dto.ts` (zod): `{ idToken: string(min1) }`

### 4-4. 서비스: `app-user-auth.service.ts`에 `googleLogin` 추가
```
async googleLogin(dto, req, res): Promise<LoginResponseDto> {
  1. OAuth2Client(GOOGLE_CLIENT_ID).verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })
     - 실패 시 UnauthorizedException('Invalid Google token')
  2. payload = ticket.getPayload();  email, sub, name, picture, email_verified
     - email 없거나 email_verified=false → Unauthorized
  3. user = await findOrCreateGoogleUser({ googleSub: sub, email, name, avatar: picture })
  4. knex update last_login_at, updated_at (그리고 신규 백필 시 google_sub/avatar_url)
  5. tokens = await this.issueTokens(user); this.setRefreshCookie(res, tokens.refreshToken)
  6. return { accessToken: tokens.accessToken, user: this.toLoginUserDto(user) }
}
```
- `findOrCreateGoogleUser`: 위 §2 ③ 순서(google_sub → email → INSERT). 신규 INSERT 시 기존 signin의 유저 생성 로직/기본값(subscription_tier, role, timezone) 재사용.

### 4-5. 컨트롤러: `app-user.controller.ts`
```
@Post('google-login')
@ApiOperation({ summary: 'Login with Google ID token' })
async googleLogin(@Body(new ZodValidationPipe(GoogleLoginDto.schema)) dto,
                  @Req() req, @Res({ passthrough:true }) res): Promise<LoginResponseDto> {
  return this.appUserService.googleLogin(dto, req, res);
}
```
- 매직링크 라우트(signin/login)는 그대로 둔다.

---

## 5. 프론트 상세

### 5-1. env
```
# apps/web/.env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=846409000652-5265k3mub14e62beu6og98h83vul2s99.apps.googleusercontent.com
```

### 5-2. `app/start/login/page.tsx`
- **제거**: 이메일 입력폼 + `signin` 호출 UI (코드는 참고용으로 주석/삭제)
- **유지**: URL 토큰 → `login` 처리(매직링크 백엔드가 살아있으니 남겨도 무방) OR 정리
- **추가**: Google Identity Services 버튼
  - `https://accounts.google.com/gsi/client` 스크립트 로드
  - `google.accounts.id.initialize({ client_id, callback })`
  - 버튼 렌더(`renderButton`) 또는 One Tap
  - callback(resp): `resp.credential`(ID토큰) → `POST /api/app-user/google-login { idToken }`
  - 성공: `data.accessToken` → `setAccessToken(...)` → next 이동 (기존 로직 재사용)

### 5-3. 두 로그인 페이지 확인
- `app/start/login/page.tsx` (활성, /start/login) — 주 대상
- `app/login/page.tsx` — 사용 여부 확인 후 동일 처리 or 리다이렉트

---

## 6. 단계별 구현 순서 (체크포인트)

| 단계 | 작업 | 검증(통과 기준) |
|------|------|-----------------|
| **P1** | DB 마이그레이션 파일 작성 + 적용 | `core.app_user`에 google_sub/avatar_url 존재 |
| **P2** | `google-auth-library` 설치 + `GOOGLE_CLIENT_ID` env | 빌드 OK, 패키지 설치됨 |
| **P3** | `GoogleLoginDto` + 서비스 `googleLogin` + `findOrCreateGoogleUser` | 단위 로직 컴파일 OK |
| **P4** | 컨트롤러 `POST /app-user/google-login` | Swagger에 라우트 노출 |
| **P5** | (백엔드 단독 검증) 유효 ID토큰으로 호출 → accessToken + 유저 생성 확인 | DB에 유저 생성, 200 응답 |
| **P6** | 프론트 GIS 버튼 추가 + `google-login` 연동 | 버튼 클릭 → 로그인 성공 |
| **P7** | 이메일 UI 제거 | 화면에 구글 버튼만 |
| **P8** | 개발(localhost:3000)에서 end-to-end | 구글 로그인 → next 이동 → /me 정상 |

> 각 단계 후 멈추고 확인 → 다음 단계. P5(백엔드 단독)까지 되면 절반 완료.

---

## 7. 테스트 계획
- **신규 유저**: 처음 구글 로그인 → `core.app_user`에 INSERT(email/name/avatar/google_sub) 확인
- **기존 이메일 유저**: 같은 email의 매직링크 유저가 구글 로그인 → google_sub 백필, 중복 생성 X
- **재로그인**: 두 번째 로그인 → last_login_at 갱신, 새 유저 안 생김
- **잘못된 토큰**: 위조/만료 idToken → 401
- **email_verified=false**: 거부

## 8. 리스크 / 주의
- **audience 검증 필수** — `verifyIdToken({ audience: GOOGLE_CLIENT_ID })` 안 하면 다른 앱 토큰 수용 위험
- **origins 등록** — Google Console 승인 origin에 `localhost:3000`, `cherryinthehaystack.com` 둘 다 있어야 버튼 동작
- **배포 env** — `GOOGLE_CLIENT_ID`(백), `NEXT_PUBLIC_GOOGLE_CLIENT_ID`(프론트) 양쪽 배포 컨테이너에 설정
- **google_sub unique** — 동일 구글계정 중복 INSERT 방지(partial unique index)
- 커밋/푸시는 사용자 승인 후

## 9. 롤백
- 프론트: 이메일 UI 복구(기존 코드 유지 시 주석 해제)
- 백엔드: `google-login` 라우트/서비스 제거 — 매직링크는 손 안 댔으므로 그대로 동작
- DB: 컬럼은 nullable이라 남겨둬도 무해(롤백 시 DROP 가능)

---

## 10. 대상 파일 요약
| 파일 | 변경 |
|------|------|
| `apps/api/db/migrations/<new>.sql` | google_sub/avatar_url 추가 |
| `apps/api/src/modules/app_user/input-dto/google-login.dto.ts` | 신규 DTO |
| `apps/api/src/modules/app_user/app-user-auth.service.ts` | `googleLogin` + `findOrCreateGoogleUser` |
| `apps/api/src/modules/app_user/app-user.controller.ts` | `POST google-login` |
| `apps/api/.env` (+배포) | `GOOGLE_CLIENT_ID` |
| `apps/web/app/start/login/page.tsx` | 이메일 UI 제거 + 구글 버튼 |
| `apps/web/app/login/page.tsx` | 확인 후 동일 처리 |
| `apps/web/.env` (+배포) | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` |
