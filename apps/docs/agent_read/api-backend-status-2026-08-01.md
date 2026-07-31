# API 백엔드 현황 (기준일: 2026-08-01)

> `apps/api`(NestJS) 백엔드 현황. **전체 모듈 구조·엔드포인트의 정본은 `api-backend-status-2026-07-13.md`** — 이 세션(08-01)엔 **백엔드 신규 모듈·엔드포인트가 없다.** 델타는 **랜드스케이프 서빙 화이트리스트 확장 + 생성 스크립트**뿐. 프론트 현황은 `frontend-status-2026-08-01.md`.

---

## 0) 07-13 대비 델타 (백엔드)

| 구분 | 변경 | 위치 |
|---|---|---|
| **랜드스케이프 페이지 화이트리스트 확장** | `LANDSCAPE_PAGES`에 `case-studies`·`domain-applications`·`product-discovery`·`model-updates`·`benchmarks-datasets` 추가(기존 `frameworks`·`prompting`에 더해 총 7) | `src/modules/frameworks_landscape/frameworks-landscape.service.ts` |
| **랜드스케이프 생성 스크립트** | Cases용 수정 + Research용 신규 | `scripts/generate-cases-landscape.cjs`, `scripts/generate-research-landscape.cjs` |
| **생성물(런타임 데이터)** | 페이지별 `<page>-landscape.json` | `storage/<page>/` (DATA_DIR) |

> 그 외 백엔드(app-user·bench·kaas·writer_agent·chain adapter 등)는 **07-13 문서와 동일, 변경 없음.**

---

## 1) 랜드스케이프 모듈 (이 세션의 유일한 백엔드 변경점)

### 1-1. 서빙 경로
- 엔드포인트: **`GET /api/<page>/landscape`** — 공개(인증 없음). `<page>`는 `LANDSCAPE_PAGES` 화이트리스트에 있어야 함(경로 조작 방지 `isLandscapePage`).
- 파일: `DATA_DIR/<page>/<page>-landscape.json` 을 읽어 그대로 반환.
- `DATA_DIR` = `process.env.DATA_DIR || <repo>/apps/api/storage`.
- 프론트: `nd-landscape.tsx`의 `LandscapeSection`·`RisingStar`가 `${NEXT_PUBLIC_API_URL}/api/<page>/landscape` 로 호출.

### 1-2. `LANDSCAPE_PAGES` (현재)
```
frameworks · prompting · case-studies · domain-applications · product-discovery · model-updates · benchmarks-datasets
```
- Engineering(frameworks·prompting): 빌딩블락스 자동생성 랜드스케이프.
- Cases(case-studies는 실제로는 기사형이라 랜드스케이프 미사용; domain-applications·product-discovery만 도메인형으로 사용).
- Research(model-updates·benchmarks-datasets): 도메인형 랜드스케이프.
- **papers·discourse 6분류는 기사형이라 랜드스케이프 없음** → 화이트리스트에 없음(프론트가 정적 JSON 직접 사용).

### 1-3. 랜드스케이프 JSON 스키마 (생성물)
```jsonc
{ "page","generatedAt","source",
  "categories": [ { "key","label","color":{c,bg},"icon",
    "items": [ { "name","desc","detail","url","stars":null,"emoji","meta" } ] } ] }
```
- `stars`는 null(도메인형엔 스타 없음) → 프론트 RisingStar가 대표 1개 featured로 폴백.

### 1-4. 생성 스크립트 (배포 후 실행 필요)
- `scripts/generate-cases-landscape.cjs` — `apps/web/public/cases/entities.json` + `pages.json`(domainMap) 읽어, **kind==='domain'만**, 상위 8 도메인 × best 5 → `storage/<cat>/<cat>-landscape.json`. `Other` 폴백 버킷 제외.
- `scripts/generate-research-landscape.cjs` — `research/entities.json` 읽어 model-updates(기관별)·benchmarks-datasets(카테고리별) 랜드스케이프. **kind==='domain'만**.
- 실행: `node apps/api/scripts/generate-*.cjs` (DATA_DIR env 존중).

---

## 2) ⚠️ 배포 / 환경 (랜드스케이프 관련)

- **`DATA_DIR`**: 프로덕션에선 **영속 볼륨**으로 매핑해야 랜드스케이프 JSON이 유지된다. 미설정 시 기본 `apps/api/storage`(컨테이너 재배포 시 소실 위험).
- **Dockerfile**: runner 스테이지에서 `storage/`가 이미지에 포함되는지 확인(`COPY apps/api/storage ./apps/api/storage`). 없으면 배포본에 랜드스케이프 JSON이 없어 API가 빈 응답/404.
- **배포 후 생성 스크립트 실행**으로 최신 랜드스케이프 반영(entities.json이 바뀌었으면 필수).
- 이 외 랜드스케이프 데이터는 **프론트 정적 JSON**(`public/<group>/*.json`)이라 백엔드 무관.

---

## 3) DB / 기타

- **DB 스키마·마이그레이션 변경 없음**(이 세션). staged_mock 신규 없음.
- 🔴 로컬·프로덕션 Supabase PG 공유 · `BENCH_KEY_SECRET` 불변 — 07-13/agent-policy와 동일.
- 구 Model Updates DB 순위 API(`/api/stats/model-updates-rank`, patch-notes)는 **여전히 존재**하나, 프론트 Model Updates 페이지는 이제 이걸 안 쓰고 **정적 랜드스케이프 + HF 순위 JSON**을 쓴다(frontend-status 참조). 삭제하지 않았음.

---

## 4) 참고 문서
- 전체 백엔드 구조·엔드포인트: `api-backend-status-2026-07-13.md`
- 프론트 현황: `frontend-status-2026-08-01.md`
- 콘텐츠 수집·재현: `../콘텐츠-수집-분류-페이지구성-방법론.md` + `../자료조사-*.md`
