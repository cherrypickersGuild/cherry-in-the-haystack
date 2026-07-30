# Frameworks & SDK — Landscape 자동생성 + 관리자 큐레이션 기획서

작성 시작: 2026-07-29
상태: **초안(검토 1회차 대기)** — 최소 3회 검토, 1회마다 멈춤

---

## 0. 한 줄 요약

Frameworks & SDK 페이지의 Landscape를 **빌딩블락스 데이터에서 자동 생성**(타입별 베스트 5)하고,
**관리자 페이지에서만** 카드별 5개의 항목·순위를 임의 편집할 수 있게 한다.
저장은 **JSON 파일**(DB 미사용). 수정 시각을 표시하고, 언제든 **자동생성으로 리셋** 가능.

---

## 1. 배경 / 확정된 결정

- 기존 `landscape.json`(수동 큐레이션 35개)을 **빌딩블락스 기반 자동 생성**으로 대체.
- 분류 축을 8개 개념분류(Agent/Fine-Tuning/…)에서 **entity_type 8종**으로 변형(데이터 정합).
  - 빌딩블락스엔 Fine-Tuning/RAG/Serving 등 분류 정보가 **없음** → 그대로는 자동화 불가.
- 대표 결정(이 대화):
  1. 저장 = **JSON 파일** (공유 프로덕션 DB 안 씀)
  2. **자동 생성 기본** + 관리자가 특정 항목/순위 **편집 가능**
  3. **최종 수정 시각 표시** + **자동생성 리셋** 지원
  4. 편집은 **관리자 페이지**에서 (Frameworks 페이지 인라인 아님)

---

## 2. 카테고리(8종) 및 자동 랭킹

### 2-1. 카테고리 = entity_type 8종

| 카드 | entity_type | 풀(링크有) | 스타보유 |
|---|---|---|---|
| Framework | `framework` | 82 | 27 |
| Server | `server` | 222 | 136 |
| Platform | `platform` | 84 | 5 |
| Product | `product` | 84 | 7 |
| Tool | `tool` | 47 | 3 |
| Library | `library` | 19 | 1 |
| Client SDK | `client_sdk` | 19 | 0 |
| Spec & Registry | `spec` + `registry` | 14 | 1 |

**확정**: 위 8카드(Product 포함, Spec+Registry 병합). 표시 순서는 볼륨순 권장(Server·Platform·Product·Framework·…) — 확정 시 조정.

### 2-2. 자동 랭킹(복합 점수) — 카드당 상위 5

⚠️ **검토 3회차 정정**: 서빙본 `entities.json` 항목 필드는 `{n,s,v,u,i,d,vf}` 뿐. `corroboration_count`는 **없다**(레지스트리에만 있으나 그 파일은 현재 삭제 상태). 그래서 **서빙본에 실제 있는 신호만**으로 정렬:

```
정렬 = ① s(github stars, desc, null=최하)
      → ② 벤더 권위: v(vendor)가 유명/공식(정규식 매칭) 가점 — 서빙본 1161개 중 170개 매칭
      → ③ vf(verified) = 1 우선
      → ④ d(설명) 길이 desc
      → ⑤ 원본순(안정적 tie-break)
```

- ①이 강한 카드(Framework·Server)는 사실상 스타순.
- ①이 없는 카드는 ②③④로 "그럴듯한" 5개. **완벽한 '베스트' 보장은 약함** → 그래서 관리자 편집(§4)이 존재.
- corroboration 기반 랭킹을 원하면 레지스트리 복원이 선행돼야 함(현재 범위 밖).

### 2-3. 항목 데이터 출처 + 식별자

- 표시 정보는 **서빙본에서 그대로**: `n`(name)·`d`(desc)·`u`(url)·`s`(stars)·`i`(icon slug)·`vf`(verified)·`v`(vendor). entity_type은 group의 `t`.
- **식별자(entityKey) 정정**: 서빙본에 `entity_key`가 없다. 후보 유일성 검증 결과 —
  - `url` 984/1161 (**중복**, 부적합), `icon` 1161/1161(유일하나 해시=불안정), **`type|name` 1161/1161 유일·안정** → **식별자 = `"<entity_type>|<name>"`** (예: `framework|LangGraph`).
- 아이콘 이미지: 기존 `/building-blocks/icons/<i>.png`(프론트 정적) 그대로 참조.
- **URL 필터**: `isUsableUrl`(http/https) 통과분만 후보에 포함(현 Building Blocks 로직과 동일).

---

## 3. 데이터 파일 구조 (JSON, DB 미사용) — **단일 파일**

### 3-0. 소스: 빌딩블락스 JSON

- **현재 단계(본 기획서 범위)**: 자동 생성은 현재 위치의 빌딩블락스 JSON(`apps/web/public/building-blocks/entities.json`)을 **입력으로 읽기만** 함.
- **후속(→ 보완기획서)**: 빌딩블락스 JSON을 **백엔드로 이전**하고, **수동 업로드 시 갱신 비트(flag) 생성 → 자동 리프레시**. 이 두 가지는 나중에 하므로 [보완기획서](보완기획서/frameworks-landscape-보완기획서.md)에 분리 기록.
- 따라서 본 기획서의 재생성 트리거는 **관리자 수동(버튼/스크립트)** 만 다룬다(§5).

### 3-1. 단일 파일 `frameworks-landscape.json` (auto + override 통합)

두 파일로 나누지 않는다. **한 파일에 자동생성분과 관리자 편집분을 함께** 두고, 카드마다 `source` 로 구분.

```json
{
  "generatedAt": "2026-07-29T12:00:00Z",     // 마지막 자동 재생성 시각
  "categories": [
    {
      "key": "framework",                      // 카드 식별키(고정)
      "label": "Framework",
      "types": ["framework"],                  // 이 카드가 끌어오는 entity_type(들)
      "source": "auto",                        // "auto" | "admin"
      "updatedAt": "2026-07-29T12:00:00Z",
      "updatedBy": null,                       // admin일 때 편집자
      "items": [
        { "entityKey": "framework|LangGraph", "name": "LangGraph", "desc": "...",
          "url": "...", "stars": 37951, "icon": "08f6…", "verified": true, "vendor": "langchain-ai" },
        ... (최대 5)
      ]
    },
    {
      "key": "spec_registry", "label": "Spec & Registry",
      "types": ["spec", "registry"],           // ← 병합 카드는 복수 타입
      "source": "admin",
      "updatedAt": "2026-07-29T15:20:00Z",
      "updatedBy": "admin@cherry",
      "items": [ ... 관리자가 고른 5개, 순서대로 ... ]
    }
  ]
}
```

- `items`에 **표시 데이터까지 함께** 저장 → 파일만 봐도 내용 확인 가능(대표 요청: 확인 쉬움). `entityKey`는 식별·재조회용.
- 한 파일이라 자동 갱신과 관리자 편집이 **같은 곳**에서 관리됨.

### 3-2. 병합/보존 규칙 = **재생성이 병합 방식(핵심)**

두 파일 없이도 안전한 이유: **재생성이 `source`를 존중**한다.

- 재생성(§5) 시 카드별로:
  - `source: "auto"` → 빌딩블락스에서 top5 **다시 계산 + 표시데이터 갱신**(덮어씀).
  - `source: "admin"` → **선택·순서 유지**, 단 각 `entityKey`의 표시데이터(name/desc/stars/icon)는 빌딩블락스 최신값으로 **재조회만** 갱신(선택은 안 건드림).
- 즉 자동 갱신을 돌려도 **관리자 편집은 절대 안 날아감**. 표시데이터만 최신화.
- 관리자 카드의 `entityKey`가 빌딩블락스에서 사라졌으면 그 항목만 제거 + 로그. **5개 미만이 돼도 자동으로 채우지 않고 그대로 둔다(확정).**

### 3-3. 파일 위치 / 서빙 (A안 확정) — 저장 폴더 권장

- **API 서빙 확정.** `apps/api`가 `frameworks-landscape.json`을 **쓰기 가능·영속 경로**에서 읽고/쓰고 API로 제공. DB 안 씀.
- **권장 저장 위치(대표 질문 #4)** — 환경변수로 데이터 루트를 두고, 배포 시 **영속 볼륨**에 매핑:
  ```
  DATA_DIR (env)   # 개발 기본값: apps/api/storage   # 프로덕션: Dokploy 영속 볼륨(예: /data)
    └ frameworks/
        └ frameworks-landscape.json      ← 관리자 편집 대상(영속 필수)
    └ building-blocks/                    ← (후속) 업로드된 소스 저장 위치
        └ entities.json
  ```
  - 핵심: `frameworks-landscape.json`은 **재배포해도 유지되는 경로**여야 함. Dokploy에서 `DATA_DIR`을 **퍼시스턴트 볼륨**으로 마운트(예: 컨테이너 `/data` ↔ 호스트 볼륨). 코드에 하드코딩하지 말고 env로.
  - 프론트 `public/`에 두면 재배포 시 편집분 소실 → **부적합**(그래서 API+볼륨).
- Frameworks 페이지: 정적 `public` → **API GET**으로 전환.

---

## 4. 관리자 편집 (관리자 페이지)

### 4-1. 진입/권한

- ADMIN만. 프론트 `decodeToken(token)?.role === "ADMIN"`(기존), 백엔드 `@Roles(Role.ADMIN)`(기존 RolesGuard).
- 위치: 기존 관리자 화면(`kaas-admin-page.tsx` 패턴) 옆에 "Frameworks Landscape" 섹션 추가.

### 4-2. 편집 UX

- 카드(타입) 선택 → 좌: 현재 선택된 5개(드래그로 순위 변경, 제거), 우: **그 타입 풀 목록**(검색·정렬) 에서 추가.
- 저장 → 그 카드 `source:"admin"` + `items`(선택 5개) + `updatedAt`/`updatedBy` 기록.
- **"자동으로 리셋"** 버튼 → 그 카드를 `source:"auto"`로 되돌리고 **즉시 재계산**해 top5로 채움(다음 재생성까지 기다리지 않음).
- 카드별 **최종 수정 시각** 표시("자동 · generatedAt" 또는 "관리자 수정 · updatedAt").

### 4-3. 백엔드 API (예시)

| 메서드 | 경로 | 권한 | 동작 |
|---|---|---|---|
| GET | `/api/frameworks/landscape` | 공개 | 병합 결과(카드별 5개 + source/updatedAt) |
| GET | `/api/admin/frameworks/pool?type=framework` | ADMIN | 편집용 풀 목록 |
| PUT | `/api/admin/frameworks/landscape/:type` | ADMIN | 그 카드 override 저장(entityKeys 순서) |
| DELETE | `/api/admin/frameworks/landscape/:type` | ADMIN | override 삭제(자동 리셋) |
| POST | `/api/admin/frameworks/regenerate` | ADMIN | 자동 베이스 재생성 트리거(선택) |

---

## 5. 자동 생성/재생성 (병합 방식)

- 입력: 백엔드가 소유한 빌딩블락스 소스(§3-0).
- 처리(재생성 = 병합, §3-2):
  1. 파일 로드. 없으면 전 카드 auto로 신규 생성.
  2. `source:"auto"` 카드 → 8타입 필터 + §2-2 복합정렬 top5로 **재계산**.
  3. `source:"admin"` 카드 → 선택 유지, `entityKey`별 표시데이터만 최신 **재조회**.
  4. `generatedAt` 갱신 후 저장.
- 트리거(본 기획서 범위):
  - 관리자 `regenerate` 버튼(수동) 또는 스크립트.
  - (크론 아님 — 갱신 빈도 낮음)
- **후속(→ 보완기획서)**: 빌딩블락스 **수동 업로드 시 갱신 비트 생성 → 자동 재생성**. 여기선 안 다룸.

---

## 6. 프론트 반영

- Frameworks 페이지 Landscape: `/frameworks/landscape.json`(정적) → **API GET**으로 전환.
- 카드/모달 UI는 **현재 것 그대로**(이미 landscape.json 스키마 기반). 필드 매핑만 API 응답에 맞춤.
- (선택) 페이지 상단 or 카드에 "관리자 수정" 배지는 노출 안 함(내부 정보). 관리자 화면에서만 수정 시각 표시.

---

## 7. 결정 로그 (전부 확정)

1. 파일 서빙 = **API(A)**. 파일 구성 = **단일 파일**.
2. 카드 = **8종(Product 포함, Spec+Registry 병합)** 확정.
3. 관리자 카드 5개 미만 → **그대로 둔다(자동 안 채움)** 확정.
4. 저장 경로 = **env `DATA_DIR` + Dokploy 영속 볼륨**(§3-3). 실제 볼륨 매핑은 배포 시 설정.
5. 빌딩블락스 백엔드 이전 + 업로드-비트 자동갱신 = **후속** → [보완기획서](보완기획서/frameworks-landscape-보완기획서.md).
6. Building Blocks 페이지 API 통일 = **후속**(보완기획서).

### 검토 3회차에서 정정된 사항 (데이터 실검증)
- 랭킹 신호: `corroboration_count` 서빙본에 **없음** → 정렬은 **stars → vendor권위 → verified → 설명길이 → 원본순**(§2-2).
- 식별자: `entity_key` 서빙본에 없음, url은 중복(984/1161) → **`type|name`(1161/1161 유일)** 사용(§2-3).
- 스키마: 병합 카드(Spec & Registry) 때문에 카드 필드를 `type`(단수) → **`key` + `types[]`**로 변경(§3-1).
- 리셋: override 삭제 시 **즉시 재계산**(§4-2).
- 레지스트리 파일(`entity_registry.json`) 현재 작업트리에서 삭제 상태 — **이번 범위는 서빙본만 쓰므로 무관**(corroboration 랭킹 원할 때만 복원 필요).

---

## 8. 단계(구현 순서, 각 단계 후 멈춤·검토)

- P1: 자동 생성 스크립트 → `auto.json` (화면 영향 없음, 안전)
- P2: 백엔드 GET 병합 API + 프론트 전환(오버라이드 없이 auto만)
- P3: 관리자 PUT/DELETE + 관리자 편집 UI
- P4: 최종 수정 시각·리셋·검증

---

## 검토 로그

- 1회차: 초안 — 자동+관리자 2계층, 2파일안, API vs static 미결.
- 2회차: 대표 결정 반영 — **단일 파일**(병합 재생성), 빌딩블락 백엔드이전·업로드비트 → 보완기획서 분리, API 확정.
- 3회차(데이터 실검증): 랭킹 신호/식별자/스키마 정정 — corroboration 제거, 식별자 `type|name`, 카드 `key`+`types[]`, 리셋 즉시 재계산. **미결 없음, 구현 착수 가능.**
