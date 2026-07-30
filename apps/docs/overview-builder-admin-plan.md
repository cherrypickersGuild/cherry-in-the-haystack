# Overview Builder — 관리자 페이지 기획서

작성 시작: 2026-07-29
상태: **초안(검토 1회차 대기)** — 최소 3회 검토, 1회마다 멈춤
연관: [frameworks-landscape-admin-curation-plan.md](frameworks-landscape-admin-curation-plan.md) (같은 뼈대 재사용)

---

## 0. 한 줄 요약

Newly Discovered **Overview 페이지**(App Store 편집형: Hero·스포트라이트·Just Added·테마 블록)를
**관리자 페이지에서 구성**한다. 각 슬롯은 building-blocks JSON에서 **검색해 선택**하고,
자리마다 **추천 1개**가 먼저 떠 클릭 한 번으로 채울 수 있다.
저장은 **JSON 파일**(DB 미사용), 자동 기본 + 관리자 오버라이드 **병합**, **수정 시각·자동 리셋** 지원.
→ Frameworks 관리자 큐레이션과 **동일 인프라**(DATA_DIR·파일 기반·ADMIN API)를 재사용한다.

---

## 1. 현재 Overview 구조 (구성 슬롯)

파일: `apps/web/components/cherry/nd-overview-page.tsx` — 지금은 building-blocks JSON에서 **자동**으로 채움.

| 슬롯 | 개수 | 현재 자동 선정 기준 |
|---|---|---|
| **Hero 캐러셀** | 5 | skill[0]·mcp[0]·agent[0]·skill[1]·prompt[0] (분야 섞기) |
| **Worth a Look**(스포트라이트) | 2 | skill 스타 3·4위 |
| **Just Added** | 6 | skill 스타 5~10위 |
| **블록1: Pick an MCP Server** | 배너 2 + 행 4 | mcp 스타순 |
| **블록2: Build Your Agent** | 배너 2 + 행 4 | agent 스타순 |

- 항목 슬롯 총 **약 21개** + 섹션 제목/부제 텍스트.
- 데이터 소스 = Frameworks Best와 **같은** building-blocks `entities.json`.
- 항목 필드: `{ n(name), s(stars), v(vendor), u(url), i(icon), d(desc), vf(verified) }` + topic·type.

---

## 2. 확정/기본 결정 (미결은 §9)

- 저장 = **JSON 파일**(공유 프로덕션 DB 안 씀). Frameworks와 동일.
- 자동 생성 기본 + 관리자 **슬롯별 오버라이드**. 자동 갱신 시 admin 슬롯은 보존(병합).
- **추천은 자리마다 1개**(단일 제안) → 수락 or 검색 교체.
- **최종 수정 시각 표시 + 자동 리셋** 지원.
- 편집은 **관리자 페이지**에서.
- 식별자 = **`entityKey = "<entity_type>|<name>"`** (building-blocks 서빙본에 entity_key 없음 → 이 조합이 1,161개 유일, Frameworks와 동일 규칙).

---

## 3. 데이터 파일 구조 (단일 파일, DB 미사용)

파일: `DATA_DIR/overview/overview-config.json` (Frameworks와 같은 데이터 루트·영속 볼륨)

```json
{
  "page": "overview",
  "generatedAt": "2026-07-29T12:00:00Z",
  "title":    { "source": "auto", "updatedAt": "...", "updatedBy": null,
                "heading": "Newly Discovered", "subheading": "Editor's Choice" },
  "hero":      { "source": "auto", "updatedAt": "...", "updatedBy": null, "items": ["skill|Superpowers", "... 5개"] },
  "spotlight": { "source": "auto", "updatedAt": "...", "updatedBy": null, "label": "Worth a Look", "sub": "Standouts this week", "items": ["... 2개"] },
  "justAdded": { "source": "auto", "updatedAt": "...", "updatedBy": null, "label": "Just Added", "sub": "Most recent updates", "items": ["... 6개"] },
  "blocks": [
    { "key": "mcp",   "source": "auto", "updatedAt": "...", "updatedBy": null,
      "title": "Pick an MCP Server", "banner": ["... 2개"], "rows": ["... 4개"] },
    { "key": "agent", "source": "auto", "updatedAt": "...", "updatedBy": null,
      "title": "Build Your Agent",   "banner": ["... 2개"], "rows": ["... 4개"] }
  ]
}
```

- **슬롯 단위로 `source`**(auto|admin). 텍스트(title/label/sub)도 각 슬롯이 보유 → **슬롯 편집(항목이든 텍스트든) 시 그 슬롯 전체가 admin**이 됨(항목·텍스트 함께 고정). 텍스트만 따로 auto 유지하는 분리는 안 함(단순화).
- **⚠️ 검토 2회차 정정 — 표시데이터까지 저장(entityKey만 저장 아님).** Frameworks landscape와 동일하게 각 항목을 아래 형태로 **해석해서** 저장 → 프론트가 building-blocks를 따로 안 읽어도 됨(자체 완결). 재생성 시 표시데이터만 최신 재조회.
  ```json
  { "entityKey":"skill|Superpowers", "name":"Superpowers", "desc":"...", "url":"...",
    "stars":254842, "icon":"<slug>", "topic":"Skill", "type":"skill" }
  ```
  (Overview는 `meta = topic · type` 라벨과 아이콘 `icon`이 필요하므로 **topic·type·icon 필수 포함**.)
- 파일 하나에 자동분+편집분 함께(Frameworks 결정과 동일 — 확인 쉬움).

### 병합/보존 규칙 (재생성)

- building-blocks 갱신 → 재생성(병합):
  - `source:"auto"` 슬롯 → 추천 로직으로 **재계산**(entityKey·텍스트 갱신).
  - `source:"admin"` 슬롯 → **선택·순서·텍스트 유지**, 각 entityKey의 표시데이터만 최신 재조회.
- admin 슬롯의 entityKey가 소멸하면 그 항목만 제거 + 로그. 개수 미달이면 **그대로 둔다**(자동 안 채움 — Frameworks와 동일).
- **중복 제거는 생성 시점 best-effort.** auto 슬롯끼리는 현행처럼 slice 오프셋으로 겹치지 않지만, **admin이 고른 항목이 다른 auto 슬롯과 겹칠 수 있음** → 편집 UI에서 "이미 다른 슬롯에 있음" 경고만 표시(강제 차단 안 함).

---

## 4. 추천 방식 — "자리마다 하나씩"

- 각 슬롯의 **각 자리**에 자동 로직이 뽑은 **추천 1개**를 제시.
- 관리자는 자리별로 `추천: <항목> [적용]` 을 수락하거나, 검색해서 다른 항목으로 교체.
- 추천 로직(현행 유지 권장):
  - **Hero**: 분야 섞기(skill·mcp·agent·prompt 스타 1위들) — 한쪽 쏠림 방지.
  - **Spotlight / Just Added**: skill 스타순 다음 순위.
  - **블록**: 해당 토픽(mcp/agent) 스타순.
- 이미 상위 슬롯에 쓰인 항목은 추천에서 **중복 제외**(같은 게 여러 자리에 안 뜨게).

---

## 5. 백엔드 API (Frameworks 인프라 재사용)

`landscape` 모듈의 `DATA_DIR`·파일 읽기/쓰기 헬퍼를 공유. Overview는 형태가 달라 전용 라우트.

| 메서드 | 경로 | 권한 | 동작 |
|---|---|---|---|
| GET | `/api/overview/config` | 공개 | 병합 결과(슬롯별 **해석된 항목** + source/updatedAt) |
| PUT | `/api/overview/slot/:slot` | ADMIN | 그 슬롯 오버라이드 저장(**해석된 항목**·텍스트) |
| DELETE | `/api/overview/slot/:slot` | ADMIN | 그 슬롯 자동 리셋(즉시 재계산) |
| POST | `/api/overview/regenerate` | ADMIN | 자동 슬롯 재생성 트리거(선택) |

- `slot` = `hero | spotlight | justAdded | title | block:mcp | block:agent` 형태(화이트리스트).
- 권한: 기존 `@Roles(Role.ADMIN)` + RolesGuard.
- **⚠️ 검토 2회차 정정 — 검색은 클라이언트 사이드. `GET /pool` 없음.**
  - 관리자 브라우저가 **이미 공개된** `/building-blocks/entities.json`(303KB)을 받아 **브라우저에서 검색**.
  - 선택한 항목을 **해석된 형태로** PUT에 실어 보냄 → **백엔드는 building-blocks를 런타임에 안 읽음**(현재도 안 읽음, 결합도 0 유지).
  - building-blocks를 읽는 건 **생성/재생성 스크립트(오프라인·트리거)뿐** — Frameworks와 동일 구조.

---

## 6. 관리자 편집 UX (관리자 페이지 내 "Overview Builder")

- 슬롯을 실제 페이지 순서대로 나열: Title → Hero(5) → Worth a Look(2) → Just Added(6) → 블록들.
- 각 자리:
  - `추천: <항목>  [적용]` 칩(수락 한 번).
  - **검색창**: 브라우저에 로드한 building-blocks(공개 JSON)를 이름/토픽/타입으로 **클라이언트 검색** → 결과에서 선택.
  - 현재 선택 목록: 드래그로 순서 변경, 제거. 다른 슬롯과 겹치면 경고 표시.
- 슬롯별 **source 배지**("자동" / "관리자 수정 · 날짜") + **자동 리셋** 버튼.
- 상단 전체 **최종 수정 시각**.
- (2차) 실시간 미리보기 — 실제 Overview 레이아웃으로 렌더.

---

## 7. 프론트 반영

- Overview 페이지: `/building-blocks/entities.json` 직접 fetch → **`GET /api/overview/config`** 로 전환.
- Hero/스포트라이트/Just Added/블록 렌더 컴포넌트는 **현재 것 유지**, 데이터 입력만 config 기반으로.
- 표시데이터 조회를 위해 building-blocks 소스는 계속 참조(아이콘 `/building-blocks/icons/<i>.png` 포함).

---

## 8. 결정 로그 (전부 확정 — 추천안)

1. **편집 범위** = 항목 + 섹션 텍스트(제목·부제). **블록 개수 고정 2개**(추가/삭제는 2차).
2. **추천 로직** = 현행 "스타순 + Hero 분야 섞기" 유지.
3. **검색 범위** = building-blocks 전체(1,161) 클라이언트 검색 + 토픽/타입 필터. 블록은 해당 토픽 기본 필터.
4. **관리자 페이지 위치** = 기존 관리자 화면(`kaas-admin-page.tsx`)에 "Overview Builder" 탭.
5. 저장 경로 = `DATA_DIR/overview/overview-config.json`(Dokploy 영속 볼륨).

---

## 9. 단계 (각 단계 후 멈춤·검토)

- P1: **자동 생성 스크립트** → `overview-config.json` (현행 자동 로직을 config로 산출). 화면 영향 없음.
- P2: **백엔드 GET `/api/overview/config`** + 프론트 Overview를 API로 전환(오버라이드 없이 auto만).
- P3: **검색 API + 관리자 Overview Builder UI** + 슬롯 PUT/DELETE(ADMIN).
- P4: **자동 리셋 + 최종 수정 시각 + 추천 칩** 마무리. (미리보기는 선택)

---

## 검토 로그

- 1회차: 초안(구조·데이터·추천·API·단계).
- 2회차(데이터·코드 실검증): 슬롯 개수 확인(Hero5·Spotlight2·JustAdded6·블록 배너2+행4). **정정 3건** —
  ① config에 **표시데이터까지 저장**(entityKey만 X) → 프론트 자체완결(§3). Overview는 topic·type·icon 필수.
  ② **검색은 클라이언트 사이드**(공개 building-blocks), `GET /pool` 삭제, PUT은 해석된 항목 전달 → 백엔드 building-blocks 결합도 0 유지(§5).
  ③ 중복은 생성 시 best-effort + 편집 UI 경고(강제차단 X)(§3·§4).
  남은 미결: §8의 편집범위·추천·검색범위·위치(대표 확정 대기).
- 3회차: §8 4가지 **추천안으로 전부 확정**(항목+텍스트 편집·블록 고정 / 현행 추천로직 / 전체 검색 / 관리자 화면 탭). **미결 없음, 구현 착수.**
