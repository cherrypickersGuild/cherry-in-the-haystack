# Building Blocks 데이터 서빙 — 구현 기획서

> **작성일**: 2026-07-22 · **상태**: 기획(검토 대기, 미구현)
> **목적**: Building Blocks의 데이터(JSON)와 아이콘을 **프론트 `public/`에서 백엔드 서빙으로 이전**해, 데이터 갱신 시 **재배포 없이** 반영되게 한다.
> **정책**: `apps/docs/agent_read/agent-policy.md` 준수 — 코드 수정·커밋은 사용자 허락 후. 기획서는 **최소 3회 검토, 1회마다 멈춤**.

---

## 0. 배경 — 왜 옮기는가

### 0-1. 현재 상태 (동작은 함)
```
apps/web/public/building-blocks/entities.json   296KB  ← git 커밋됨
apps/web/public/building-blocks/icons/*.png     962개 · 8.7MB  ← git 커밋됨
        ↓ 브라우저가 same-origin fetch
nd-building-blocks-page.tsx
```

### 0-2. 문제
| 문제 | 내용 |
|------|------|
| **데이터 갱신 = 코드 재배포** | 크롤러가 주 단위로 도는데, 그때마다 커밋 → push → **Dokploy web Redeploy** 필요 |
| **수명주기 불일치** | 데이터와 코드는 바뀌는 주기가 다른데 한 덩어리로 묶여 있음 |
| **git 비대** | 이미지 8.7MB가 저장소에. 이미지는 diff가 안 되어 **바뀔 때마다 전체가 히스토리에 누적** |
| **web 빌드 부담** | Next.js 재빌드는 api 재시작보다 오래 걸림 |

### 0-3. 목표
```
데이터 갱신 → api 볼륨의 파일 교체 → 끝 (배포 없음)
```

### 0-4. ⚠️ 이건 "DB로 옮기자"가 아니다
확정된 원칙을 유지한다:

| 데이터 | 저장 방식 | 이유 |
|--------|----------|------|
| **기사** | **DB** | 본문 보관, 개인화·점수·주간 리뷰(쓰기 발생) |
| **기술 사이트 수집(Building Blocks)** | **JSON 파일** | 외부에서 통째로 제공받는 읽기 전용 데이터 |

→ **형식은 JSON 그대로**, 바뀌는 건 **"어디서 서빙하느냐"** 뿐이다. DB 스키마·ORM 불필요.

---

## 1. 목표 구조

```
[제공자] entity_registry.json  (아이콘 URL 포함 요청 예정 — §5)
      ↓ 재생성 스크립트 (신규)
   entities.json + icons/*.png
      ↓ 배치 (배포 아님)
[api 서버] 볼륨  /data/building-blocks/
      ↓ 정적 서빙
   GET /api/static/building-blocks/entities.json
   GET /api/static/building-blocks/icons/<slug>.png
      ↓ fetch (cross-origin)
[web] nd-building-blocks-page.tsx
```

**핵심**: 파일을 **Docker 이미지 밖(볼륨)**에 둔다. 이미지 안에 넣으면 결국 api 재배포가 필요해 문제가 그대로다.

---

## 2. 구현 범위

### 2-1. 백엔드 (`apps/api`)

**추가 패키지 불필요** — `@nestjs/platform-express`가 이미 있어 `useStaticAssets`로 처리 가능. (`@nestjs/serve-static` 안 써도 됨)

`main.ts`에 정적 서빙 추가:
```ts
// 경로는 env로 주입 (로컬/배포 다름)
const dataRoot = process.env.STATIC_DATA_DIR ?? join(process.cwd(), 'data')
app.useStaticAssets(dataRoot, {
  prefix: '/api/static/',
  maxAge: '1h',       // 캐시 (§4-2)
  fallthrough: false, // 없는 파일은 404
})
```

- **경로**: `/api/static/building-blocks/...` (전역 prefix `api` 뒤에 붙음)
- **env 신규**: `STATIC_DATA_DIR` (로컬 `./data`, 배포 `/data`)

### 2-2. ⚠️ CORS — 반드시 확인 (가장 큰 리스크)

**지금은 same-origin**(`localhost:3000/building-blocks/...`)이라 CORS가 없었다.
옮기면 **cross-origin**(`api.solteti.site` → `cherryinthehaystack.com`)이 된다.

| 대상 | CORS 필요? | 비고 |
|------|-----------|------|
| `entities.json` (**fetch**) | ✅ **필요** | 실패 시 데이터가 안 뜸 |
| 아이콘 (`<img src>`) | ❌ 불필요 | 이미지 태그는 CORS 무관 |

현재 `main.ts`는 `CORS_ORIGINS` env 기반 화이트리스트 + `credentials: true`.
→ **프론트 도메인이 `CORS_ORIGINS`에 이미 들어있는지 확인**해야 한다. 들어있다면 추가 작업 없음.

### 2-3. 프론트 (`apps/web`)

`nd-building-blocks-page.tsx` **두 곳만** 수정:

```ts
// 1) 데이터
fetch("/building-blocks/entities.json")
  → fetch(`${API_URL}/api/static/building-blocks/entities.json`)

// 2) 아이콘 (2군데: EntityCard)
src={`/building-blocks/icons/${e.i}.png`}
  → src={`${API_URL}/api/static/building-blocks/icons/${e.i}.png`}
```

- `API_URL`은 `lib/auth.ts`에 이미 export 되어 있음 (`NEXT_PUBLIC_API_URL`)
- **렌더링 로직·디자인은 그대로** — 데이터 모양이 안 바뀌므로

### 2-4. 재생성 스크립트 (신규)

`apps/docs/seed_data/build-entities.mjs` (위치 협의 필요)

하는 일:
1. `entity_registry.json` 읽기
2. **아이콘 수집 — 없는 것만** (기존 962개는 건너뜀)
   - 제공자가 `icon_url`을 주면 **그걸 우선 사용** (§5)
   - 없으면 현행 추측 방식(GitHub 아바타 / favicon)
3. `entities.json` 재생성 (필드 정리·그룹핑·정렬)
4. **리포트**: 신규 N건 · 아이콘 실패 M건 · 총계

> 지금은 이 스크립트가 없다. 제가 일회성으로 `/tmp`에서 돌리고 버려서, 원본이 갱신되면 아무도 재생성할 수 없는 상태다. **이 기획의 필수 산출물.**

### 2-5. 파일 이전

```
apps/web/public/building-blocks/  →  (api 볼륨) /data/building-blocks/
```
- git에서 **제거** (8.7MB 회수)
- 원본 `apps/docs/seed_data/entity_registry.json`은 **저장소에 유지** → 언제든 재생성 가능(백업 역할)

### 2-6. 배포 설정 (사용자 직접)

Dokploy api 앱에 **볼륨 마운트** 추가:
```
호스트 경로 → 컨테이너 /data
env: STATIC_DATA_DIR=/data
```

---

## 3. 검토 필요 / 미결정

| # | 항목 | 선택지 |
|---|------|--------|
| D1 | **URL 경로** | `/api/static/building-blocks/*` vs `/api/v1/building-blocks/*` |
| D2 | **스크립트 위치·언어** | `apps/docs/seed_data/*.mjs` (Node) vs `python_services` (Python) |
| D3 | **파일 배치 방법** | 수동 복사(scp) vs 업로드 API vs 크롤러가 직접 씀 |
| D4 | **이전 시점** | 지금 / 제공자 `icon_url` 협의 끝난 뒤 한 번에 |
| D5 | **entities.json도 옮길지** | 아이콘만 옮기고 JSON은 프론트 유지도 가능(296KB 텍스트라 부담 적음) |

---

## 4. 리스크

| 심각도 | 항목 | 대응 |
|--------|------|------|
| 🔴 | **CORS 미설정 시 데이터 안 뜸** | 배포 전 `CORS_ORIGINS`에 프론트 도메인 확인 (§2-2) |
| 🟠 | **볼륨 미설정 시 404** | 볼륨 없으면 파일이 없어 전부 404. 배포 순서: 볼륨 설정 → 파일 배치 → 코드 배포 |
| 🟠 | **아이콘 962개 왕복 지연** | 캐시 헤더 필수(`maxAge`). 같은 도메인이 아니라 DNS/TLS 핸드셰이크가 추가됨 |
| 🟡 | **백업** | git에서 빠지므로 볼륨이 날아가면 소실 → 원본 JSON이 저장소에 있으니 재생성 가능 |
| 🟡 | **로컬 개발 불편** | 로컬에서도 api를 띄워야 아이콘이 보임 (지금은 web만 띄워도 됨) |

---

## 5. 연계 — 제공자에게 아이콘 요청 (별건, 권장)

현재 아이콘은 **우리가 추측해서 수집**한다. 한계:
- GitHub은 **저장소가 아닌 소유자 아바타** → `microsoft/*`는 전부 같은 로고
- favicon에 **기본 지구본 아이콘**이 섞임 (실측 확인됨)
- 62건 실패 → 첫 글자 아바타

수집하는 쪽은 이미 그 페이지를 열고 있으므로 정확한 로고를 뽑을 수 있다. 요청 스펙:
```json
{
  "icon_url": "https://example.com/logo.png",
  "icon_source": "og:image | apple-touch-icon | favicon | github-avatar | none"
}
```
정사각형·최소 128px 권장. → 스크립트가 `icon_url` 우선 사용하도록 만든다(§2-4).

---

## 6. 검수표

범례: `-` 미착수 · `W` 진행 중 · `T` 테스트 통과 · `✅` 검수 완료

### Phase 0 — 기획 확정
| 항목 | 상태 | 메모 |
|---|---|---|
| 0-1 기획서 1회차 검토 | - | AI |
| 0-2 기획서 2회차 검토 | - | AI |
| 0-3 기획서 3회차 검토 | - | AI |
| 0-4 D1~D5 확정 | - | **사용자 승인** |

### Phase 1 — 재생성 스크립트
| 항목 | 상태 | 메모 |
|---|---|---|
| 1-1 `build-entities.mjs` 작성 | - | AI |
| 1-2 아이콘 증분 수집(기존 건너뜀) 확인 | - | AI |
| 1-3 기존 962개와 동일 결과 재현 | - | AI 검증 |

### Phase 2 — 백엔드
| 항목 | 상태 | 메모 |
|---|---|---|
| 2-1 `main.ts` 정적 서빙 + `STATIC_DATA_DIR` | - | AI |
| 2-2 **CORS 확인** (`CORS_ORIGINS`에 프론트 도메인) | - | AI · 🔴 |
| 2-3 로컬에서 JSON·아이콘 200 응답 | - | AI |

### Phase 3 — 프론트 전환
| 항목 | 상태 | 메모 |
|---|---|---|
| 3-1 fetch·img 경로를 API_URL로 | - | AI |
| 3-2 화면 동일 확인 (아이콘 로드 실패 0) | - | AI |
| 3-3 `public/building-blocks/` git에서 제거 | - | **사용자 승인** |

### Phase 4 — 배포
| 항목 | 상태 | 메모 |
|---|---|---|
| 4-1 Dokploy 볼륨 + env 설정 | - | **사용자 직접** |
| 4-2 파일 배치 | - | **사용자 직접** |
| 4-3 배포 후 확인 | - | **사용자 직접** |

## 성과 목표 (완료 기준)
- [ ] **데이터 갱신 시 재배포 불필요** — 파일 교체만으로 반영
- [ ] 화면·디자인 **변화 없음** (아이콘 로드 실패 0)
- [ ] git에서 이미지 8.7MB 제거
- [ ] 원본 JSON만 있으면 **누구나 재생성 가능**(스크립트 존재)
- [ ] `npx tsc --noEmit` 신규 에러 없음

---

*(검토용. 코드 수정·커밋은 사용자 허락 후. 관련: `agent-policy.md`, `nd-building-blocks-page.tsx`)*
