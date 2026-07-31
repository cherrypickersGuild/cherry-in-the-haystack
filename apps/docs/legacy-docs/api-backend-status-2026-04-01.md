# API 백엔드 개발 목적/현황/진척 (기준일: 2026-04-01)

## 1) 개발 목적
- 범위: `apps/api` 백엔드만 우선 개발.
- 기준 스키마: `apps/docs/ddl-v1.1.sql`의 `core.app_user` 중심 인증 모델.
- 핵심 방향:
- `role-feature` 샘플 구조에서 벗어나 DDL 기준(`core.app_user.role`)으로 재정렬.
- 이메일 기반의 간단한 로그인 플로우를 먼저 구축.
- 샘플 코드 스타일(`input-dto`, `output-dto`, `entity` 분리)은 유지.

## 2) 현재 구현 상태
### 2-1. 모듈 구조
- 신규 모듈 위치: `src/modules/app_user`
- 하위 구조:
- `entity/`
- `input-dto/`
- `output-dto/`
- `app-user.controller.ts`
- `app-user.service.ts`
- `app-user-auth.service.ts`
- `app-user.module.ts`

### 2-2. 구현 완료된 기능
- 회원가입: `POST /api/app-user/signup`
- 로그인 토큰 발급(signin): `POST /api/app-user/signin`
- 로그인 토큰 교환(login): `POST /api/app-user/login`
- 액세스 토큰 재발급(refresh): `POST /api/app-user/refresh`
- 로그아웃(logout): `POST /api/app-user/logout`
- 내 정보 조회(me): `GET /api/app-user/me`

### 2-3. 인증/토큰 동작 요약
- `signin`:
- 1회용 로그인 토큰 생성.
- `magic_token_hash`, `magic_token_expires_at`, `magic_token_last_ip`, `magic_token_last_user_agent` 업데이트.
- 현재는 개발 편의상 토큰을 응답으로 반환.
- `login`:
- 입력 토큰 SHA-256 해시 검증(`timingSafeEqual` 사용).
- 성공 시 `last_login_at` 갱신, 기존 매직 토큰 소비 처리.
- JWT access/refresh 발급.
- refresh 토큰은 Redis 저장 + httpOnly 쿠키(`cherryRefreshToken`) 설정.
- `refresh`:
- 쿠키/바디 refresh 토큰 검증 후 토큰 재발급(회전).
- `logout`:
- Redis refresh 토큰 무효화 + 쿠키 삭제.

### 2-4. 권한 모델 반영 상태
- JWT 전략이 `core.app_user`를 조회하도록 전환됨.
- `request.user.role`은 `core.app_user.role` 값을 사용.
- 기존 `role-feature` 조인 의존 없이 동작.

## 3) 진척도 평가
- P1(인증 기초) 기준:
- 설계/스캐폴딩: 완료
- API 엔드포인트 구현: 완료
- DDL(`core.app_user`) 반영: 완료
- 이메일 발송 연동: 미완료(개발용 응답 반환 상태)
- E2E/통합 테스트: 미완료
- 운영 하드닝(로그/레이트리밋/감사): 미완료

## 4) 현재 이슈/리스크
- 타입체크/빌드에서 본 작업과 무관한 기존 오류 1건 존재:
- 파일: `src/common/base-query/upsert/bulk-upsert.executor.ts:102`
- 내용: `db.raw(sql, bindings)`의 `bindings` 타입 불일치(`unknown[]`).
- 영향: 전체 타입체크/빌드 파이프라인에서 실패 가능.

## 5) 결정 필요 사항
- `signup`에서 role 입력 허용 여부:
- 현재는 `GENERAL` 고정.
- `signin` 토큰 전달 방식:
- 현재는 응답 반환(개발 편의).
- 실제 운영은 이메일 발송(매직링크/코드) 연동 필요.
- refresh 정책:
- 쿠키 이름/경로/바디 fallback 정책을 현재값으로 확정할지 결정 필요.

## 6) 다음 작업 제안
- 이메일 발송 어댑터 연결 후 `signin` 응답에서 토큰 비노출 처리.
- `app_user` 인증 E2E 테스트 작성(`signup -> signin -> login -> refresh -> logout -> me`).
- API 에러 스펙(코드/메시지) 고정 및 문서화.
- 기존 공용 타입 오류(`bulk-upsert.executor.ts`) 정리 후 CI 빌드 안정화.
