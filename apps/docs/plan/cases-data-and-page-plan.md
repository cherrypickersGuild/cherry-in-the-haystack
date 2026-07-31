# Cases — 데이터 수집 + 페이지 기획서

작성 시작: 2026-07-31
상태: **초안(검토 1회차 대기)** — 최소 3회 검토, 1회마다 멈춤
연관: [frameworks-landscape-admin-curation-plan.md](frameworks-landscape-admin-curation-plan.md) · [overview-builder-admin-plan.md](overview-builder-admin-plan.md) (같은 뼈대 재사용)

---

## 0. 한 줄 요약

빌딩블락 JSON과 **유사한 형식**으로 **Cases(실사용 사례) 데이터 ~500건**을 수집해 JSON으로 서빙하고,
Frameworks Best / Prompting Best와 **같은 화면 뼈대**(카드 → 상세 모달 → 실제 링크, 자동 생성 + 관리자 큐레이션)로 Cases 페이지를 구성한다.
현재 published된 case-studies 페이지는 **링크가 없어 폐기**하고 새로 만든다.

---

## 1. 배경 / 현재 프론트

- Cases 그룹 = 3 카테고리 (Cherry Category 260530 기준, 3문서 합의):
  - **Domain Applications** — 도메인별 AI 활용 솔루션/워크플로/짧은 뉴스. 예) 콘텐츠 제작·학교·정신건강.
  - **Case Studies** — 도메인 특화 유스케이스·ROI·도입 전략·성공/실패·컨퍼런스 발표. 예) 배민 text-to-SQL.
  - **Product Discovery** — AI로 실생활 문제를 푸는 솔루션 모음(개발자 도구 제외). 예) 이력서 빌더·의료 영상 스크리너.
- **현 case-studies 페이지(`nd-case-studies-page.tsx`)는 DB(fetchCaseStudies) 기반이고 실제 링크가 없음 → 이번 기획에서 무시/폐기.** 회사 태그(OpenAI/Google/…) UI 구조만 참고.
- Cases는 그룹에 **⭐우선순위(star:true)** 로 표시돼 있음.

---

## 2. 빌딩블락과의 차이 (수집·랭킹이 다름)

| | 빌딩블락 | Cases |
|---|---|---|
| 대상 | 도구(GitHub 저장소·MCP·스킬) | **실사용 사례·도입기·솔루션**(내러티브) |
| 소스 밀집도 | awesome-list/GitHub 밀집 | 벤더 고객사례·블로그·컨퍼런스에 분산(단, 인덱스 있음) |
| 랭킹 신호 | GitHub 스타 | **스타 없음** → 최신성·출처권위·verified로 대체 |
| 링크 | repo/사이트 | **원문 사례 URL(필수)** — 현 페이지의 "링크 없음" 문제 해결 |

---

## 3. 데이터 모델 (빌딩블락 형식 미러링, ~500건)

파일: `public/cases/entities.json` (또는 백엔드 서빙 — §6). 빌딩블락 `topic` 자리에 **`category`(3종) + `domain`**.

```json
{
  "total": 500,
  "generatedAt": "2026-07-31",
  "items": [
    {
      "id": "case-2026-0001",
      "category": "case-studies",          // case-studies | domain-applications | product-discovery
      "domain": "healthcare",              // 의료·금융·교육·리테일·제조·법률·마케팅·고객지원 …
      "name": "배민 Text-to-SQL 도입",
      "company": "우아한형제들",            // 주체(회사/기관/개인). 없으면 null
      "description": "무엇을·어떻게 풀었는지 1~2문장",
      "outcome": "정량 결과/ROI (있으면, 없으면 null)",
      "source_type": "engineering-blog",   // vendor-case | conference | blog | news | paper
      "url": "https://…",                  // 원문(필수, http/https)
      "date": "2025-11-01",                // 발행/발표일(있으면)
      "verified": true                     // URL·내용 확인 여부
    }
  ]
}
```

- 빌딩블락처럼 **`id` + `category` + 표시필드**. 식별자 = `id`(수집시 발번) 또는 `category|slug`.
- **URL 필수** (링크 없는 건 제외 — 현 페이지 문제 해결).
- 스타 없음 → 정렬은 §4.

---

## 4. 수집 (~500건 현실적)

### 4-1. 소스 (밀집 인덱스 조합)
- **벤더 고객사례 인덱스** — OpenAI(수백)·Anthropic·Google Cloud·AWS·Microsoft/Azure·Databricks. 각 수십~수백.
- **큐레이션 컬렉션** — `applied-ml`, Evidently AI "ML system design case studies"(500+), `awesome-production-machine-learning` 등.
- **컨퍼런스·엔지니어링 블로그** — 국내(배민·토스·당근·라인 등) 포함.
- **뉴스** — 도메인별 짧은 AI 활용 소식(Domain Applications용).

### 4-2. 방식 (선택)
- (A) 기존 `python_services/source_discovery` 파이프라인을 **Cases 소스로 재설정**.
- (B) 벤더 인덱스·큐레이션 리스트를 **LLM 추출 에이전트**로 구조화(제목·회사·도메인·요약·URL·날짜).
- (C) 반자동 — 소스별로 추출 후 병합·중복제거·URL 검증.

### 4-3. 랭킹 신호 (스타 대체)
```
정렬 = 최신성(date desc) → 출처권위(vendor/conference > blog > news) → verified → 원문순
```
- "베스트 5" 뽑을 때 신호가 약한 건 감수(관리자 큐레이션으로 보완, §6).

### 4-4. 파일럿 권장
- 먼저 **30~50건 파일럿**으로 스키마·품질 확정 → 500으로 확장.

---

## 5. 페이지 구성 (Frameworks Best 방식 재사용)

- Cases 데이터를 **카드 그리드 → 상세 모달 → 실제 링크** 로 표시(공용 `LandscapeSection` 패턴 재사용).
- 그룹핑 축(미결 §7): **카테고리(3)** 로 카드? 아니면 **도메인** 으로? 아니면 3 카테고리 = 3 페이지?
- 각 카드 안 항목: 회사 태그 + 도메인 + 날짜 + 제목 + 요약 (현 case-studies 카드 UI 참고).
- 항목 클릭 → 모달(상세 + outcome) → **원문 URL 링크**.

---

## 6. 자동 생성 + 관리자 큐레이션 (기존 인프라 재사용)

- Frameworks/Overview와 **동일**: 파일 기반(DB 미사용), 자동 생성 + 관리자 오버라이드 병합, `DATA_DIR`.
- 관리자 페이지에 "Cases Builder" (검색·선택·추천·리셋). 검색은 클라이언트 사이드.
- 백엔드 `GET /api/cases/…`, 관리자 PUT/DELETE(ADMIN). landscape 모듈 헬퍼 공유.

---

## 7. 미결 / 검토 항목

1. **그룹핑 축** — 카테고리(3) vs 도메인 vs 3 페이지 분리. (§5)
2. **범위** — 3 카테고리 전부 vs 우선 Case Studies 하나부터.
3. **언어** — 영어 위주 vs 국내 사례 포함(한국어 소스 크롤 필요).
4. **수집 방식** — A(기존 파이프라인) / B(LLM 추출) / C(반자동).
5. **필드 확정** — outcome·date 결측 허용 범위, source_type 목록.
6. 서빙 = 정적 `public/cases/entities.json` vs 백엔드 API(관리자 편집하려면 API).

---

## 8. 단계 (각 단계 후 멈춤·검토)

- P0: **파일럿 30~50건** 수집 → 스키마·품질 확정.
- P1: 500건 수집 → `entities.json` 산출.
- P2: 백엔드 API + Cases 페이지(카드→모달→링크).
- P3: 관리자 Cases Builder(자동+큐레이션).

---

## 검토 로그

- 1회차: 초안(3카테고리·스키마·수집·페이지·인프라 재사용). 미결 §7 확인 대기.
- 2회차: (대기)
- 3회차: (대기)
