# 소스 관리 — 구현서

> 2026-09-14 · 기획 `1-work-guidelines.md` · 검수표 `3-checklist-table.md`
> 화면 정본은 목업 `mockups/source-registry-mockup.html`

---

## 0. 이 문서가 답하는 것

**"무엇을, 어디에, 어떤 순서로 만드나."** 그것만 적는다.

| 궁금한 것 | 볼 곳 |
|---|---|
| 화면이 어떻게 생겼나 · 어떻게 동작하나 | **목업** |
| DB 표·칼럼 | 기획 §4 (SQL 전문) |
| 왜 그렇게 정했나 | 기획 §6 (D1~D10) |
| 무엇을 안 만드나 | 기획 §7 |

**초기 구현이다.** 노션에 있다고 다 옮기지 않는다 — 기획 §0 의 넷(표 고르기 · 행 보기 · 행 추가 · 칸/칼럼 고치기)만.

---

## 1. 순서와 멈춤 지점

```
1 DB 칸 만들기 → 2 노션 자료 넣기 → 3 관리자 페이지 전환 → 4 표 보기·고치기 → 5 행·칼럼 추가 → 6 수집 연결
      ↑                    ↑
   사용자 실행         한 번에 넣고 눈으로 확인
```

| 단계 | 끝나면 무엇이 보이나 |
|---|---|
| **1. DB** | 표 3개가 생긴다 |
| **2. 이관** | 노션 489행이 DB 에 들어간다 (화면은 아직 없다) |
| **3. 전환** | 관리자가 **모달이 아니라 페이지**로 열리고 탭이 한글이다 |
| **4. 표** | `소스 관리` 탭에서 11개 표를 고르고 칸을 고친다 |
| **5. 추가** | 행과 칼럼을 늘린다 |
| **6. 연결** | 행을 수집 대상으로 켜면 `content.source` 에 행이 생긴다 |

**3까지 가면 "노션 대신 여기서 본다"가 된다.** 4~5 가 "노션 대신 여기서 고친다"이고, 6 은 투고 기획이 미뤄 둔 숙제를 닫는 단계다.

---

## 2. 1단계 — DB (🛑 사용자 실행)

SQL 전문은 **기획 §4**. 표 3개 + 인덱스 2개이고, **기존 표는 하나도 안 고친다.**

```
⓪ ALTER TYPE … ADD VALUE 'SUBSTACK'   ← 이것만 실행하고 커밋 (D11)
① 표 3개 + 인덱스 2개                  ← 커밋된 다음에
```

⓪을 ①과 한 트랜잭션에 묶으면 안 된다. 새 enum 값은 추가한 그 트랜잭션 안에서 쓸 수 없다.

`content.source` 에 손대지 않는 것이 핵심이다(D6). 수집기(`config_loader.py`)가 그 표를 읽는다.

> **검수표 1**

---

## 3. 2단계 — 노션 자료 넣기

`scripts/source-registry/` 에 세 개를 만든다. 온톨로지 이관 때와 같은 모양이다.

```
plan.cjs        표 11개와 칼럼 정의 (CSV 머리줄 → source_field). precheck·import·verify 가 이 파일만 본다
precheck.cjs    🔵 읽기 전용. 넣기 전에 어긋나는 것을 찾는다
import-csv.cjs  🔴 쓰기 · 단일 트랜잭션 · 재실행 안전(--confirm 필요)
verify.cjs      🔵 넣은 뒤 CSV 와 DB 를 대조
```

| | |
|---|---|
| **파일은 `_all.csv`** | 표마다 파일이 두 벌이다. 아카이브는 9칼럼 vs 33칼럼으로 갈린다(기획 §5) |
| **값을 고치지 않는다** | CSV 값을 그대로 `cells` 에 넣는다(D9). 분류 통일·중복 정리는 **화면에서** 한다 |
| **칼럼 이름** | 머리줄을 그대로 못 쓴다 — 규칙과 대응표는 **기획 §5**. `plan.cjs` 에 그 표를 넣는다 |
| **칼럼 종류 정하기** | 머리줄 이름으로 정한다 — `URL`·`Substack`·`Linkedin` 등은 `url`, `Cherry Category` 는 `multi`, `Reviewer Notes`·`Comment` 는 `long`, 나머지는 `text` |
| **분류 선택지** | `multi` 칼럼의 `options` 에 **앱 메뉴 id 를 기본으로 깔아 둔다**(기획 §5). 노션 값 중 그 밖의 것도 선택지로 같이 넣는다 |
| **`origin`** | 전부 `NOTION` 으로 넣는다. 나중에 유저 투고(`USER`)·자동 발굴(`DISCOVERED`)과 구분된다 |

> **검수표 2**

---

## 4. 3단계 — 관리자 페이지를 전체 페이지로

### 4-1. 모달을 걷어낸다

지금은 `app/page.tsx` 에서 모달로 뜬다(`fixed inset-0` · `max-w-[1200px]`). 개발자 앱은 상태 기반이므로(지침 §7 🟠) **메뉴처럼 들어가는 화면**으로 바꾼다.

| 고칠 곳 | 무엇 |
|---|---|
| `app/page.tsx` | 모달 블록 삭제 · `showDashboard` 상태 삭제 · `switch` 에 `case "admin"` 추가 |
| `app/page.tsx` (버튼 2곳) | `setShowDashboard(true)` → `setActiveNav("admin")` |
| `components/cherry/sidebar.tsx` | `ADMIN` 섹션에 `관리자` 한 줄 (관리자에게만) |

### 4-2. 탭을 한글로

`kaas-dashboard-page.tsx` 의 `tabs` 배열 라벨만 바꾼다. **키는 그대로 둔다** — 키를 바꾸면 `app/page.tsx` 의 타입까지 줄줄이 바뀐다.

```
dashboard → 대시보드 · curation → 지식 큐레이팅 · concept-page → 개념 페이지
template → 프롬프트 템플릿 · overview-builder → 오버뷰 편집 · submissions → 투고 검토
+ registry → 소스 관리
```

> **검수표 3**

---

## 5. 4단계 — 표 보기 · 칸 고치기

**목업이 정본이다.**

```
apps/api/src/modules/source_registry/
  source-registry.module.ts
  source-registry.controller.ts     전부 @Roles(Role.ADMIN)
  source-registry.service.ts
apps/web/
  lib/registry-api.ts
  components/cherry/source-registry-panel.tsx
```

| 메서드 | 경로 | 하는 일 |
|---|---|---|
| GET | `/api/admin/registry/tables` | 표 목록 + 행 수 |
| GET | `/api/admin/registry/tables/:key` | 칼럼 정의 + 행 |
| PATCH | `/api/admin/registry/rows/:id` | **칸 하나** 고치기 |

행의 값은 `source_row.cells` 에 들어 있다.

- 칸을 고칠 때 **행 전체를 보내지 않는다.** `{ key, value }` 만 보내고 서버가 `cells` 에 합친다 — 두 사람이 다른 칸을 고쳐도 서로를 지우지 않는다.
- 행이 500개를 넘는 표(트위터 140 정도라 아직 여유)는 나중에 페이지 나누기를 붙인다. 지금은 한 번에 준다.

### 크게 보기

화면 상태 하나(`full`)로 **체리 메뉴·표 목록·탭 줄을 감춘다.** 서버와 무관하다. `Esc` 로 나온다 — 단, **편집 중이면 편집만 닫는다**(목업과 같게).

> **검수표 4**

---

## 6. 5단계 — 행 추가 · 칼럼 추가/수정

| 메서드 | 경로 | |
|---|---|---|
| POST | `/api/admin/registry/tables/:key/rows` | 빈 행 하나 |
| DELETE | `/api/admin/registry/rows/:id` | 행 삭제 — **소프트 삭제**(`revoked_at`)(D10) |
| POST | `/api/admin/registry/tables/:key/fields` | 칼럼 추가 |
| PATCH | `/api/admin/registry/fields/:id` | 이름·선택지 수정 |

- **칼럼을 추가해도 기존 행은 안 건드린다.** 값이 없으면 화면에서 `—` 로 보인다.
- `multi` 칸에서 **새 값을 만들면 그 칼럼의 `options` 에도 쌓는다**(목업과 같게). 다음 사람이 같은 값을 고르게 하려는 장치다.
| DELETE | `/api/admin/registry/fields/:id` | 칼럼 삭제 — 소프트 삭제. **행의 `cells` 는 건드리지 않는다** |

**지우기 전에 한 번 물어본다(D10).** 확인 모달에 무엇이 사라지는지 **이름과 영향**을 적는다 — 목업 그대로.

```
칼럼을 지울까요?   "왜 보나" 칼럼을 지웁니다.
                   이 칼럼에 적어 둔 값이 9행에서 모두 화면에서 사라집니다.   [취소] [칼럼 삭제]
```

**칼럼을 지워도 `cells` 의 값은 남겨 둔다.** 칼럼 정의만 끄면 화면에서 사라지고, 잘못 지웠을 때 정의를 되살리면 값이 그대로 돌아온다.

> **검수표 5**

---

## 7. 6단계 — 수집 연결

```
POST   /api/admin/registry/rows/:id/collect     수집 대상으로 켠다
DELETE /api/admin/registry/rows/:id/collect     끈다 (content.source.is_active = false)
```

**여기서 투고 기획(`../source-submission/` §5-C)이 미뤄 둔 것이 닫힌다.**

| 켤 때 | |
|---|---|
| `content.source` 에 행을 만들고 `source_row.source_id` 에 잇는다 | |
| **`is_active = false` 로 넣는다** | 기본값이 `true` 라 넣자마자 크롤링이 시작된다 |
| **`url_handle`** | 표의 **대표 주소 칼럼**(`source_table.url_field`) 값을 쓴다. 플랫폼 이름 칼럼을 `url` 로 합치지 않았기 때문이다(기획 §5) |
| **`url_handle_hash = md5(url_handle)`** | 이 칼럼으로 기존 행을 찾는다. 비면 행이 둘로 늘어 두 번 긁는다 |
| `type` | 표에 따라 정한다. 서브스택은 **`SUBSTACK`**(D11 · 1단계에서 enum 에 추가해 둔다) |

⚠️ 이미 꺼진 `sync_sources.py`(노션 → DB)는 **폐기**한다(D8). 남겨 두면 언젠가 누가 돌려서 우리 데이터를 덮는다.

> **검수표 6**

---

## 8. 건드리는 기존 파일

| 파일 | 무엇 |
|---|---|
| `apps/api/src/app.module.ts` | 모듈 등록 |
| `apps/web/app/page.tsx` | 모달 삭제 · `case "admin"` · 진입 버튼 2곳 |
| `apps/web/components/cherry/kaas-dashboard-page.tsx` | 탭 라벨 한글 + `소스 관리` 탭 |
| `apps/web/components/cherry/sidebar.tsx` | `관리자` 메뉴 |
| `python_services/packages/news_collector/src/sync_sources.py` | 폐기(D8) |

그 밖의 기존 파일은 건드리지 않는다. **`content.source` 스키마는 그대로 둔다.**
