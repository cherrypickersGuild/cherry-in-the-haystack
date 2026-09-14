# 소스 관리 — 노션 이관 · 기획

> 2026-09-14 · 브랜치 `deploy` · 목업 `mockups/source-registry-mockup.html`
> 앞선 기능: `../source-submission/`(유저 투고) — **이 기획이 그 기능의 "다음 범위"를 흡수한다**

---

## 0. 무엇을 만드나

**노션에서 하던 소스 관리를 웹사이트로 통째로 옮긴다. 노션은 더 이상 쓰지 않는다.**

노션에서 실제로 하던 일은 넷뿐이다.

```
① 표를 고른다 (서브스택 · 트위터 · 링크드인 …)
② 행을 본다
③ 행을 추가한다
④ 칸(셀)을 고치고, 필요하면 칼럼을 새로 만든다
```

이 넷만 옮긴다. 보드·캘린더 뷰, 필터 빌더, 관계형, 수식, 댓글, 템플릿은 **안 가져온다.**

### 설계 3원칙 — 적용 결과 (지침 §2 S1 게이트)

| | |
|---|---|
| **① 좁은 스코프 — 무엇을 뺐나** | 노션 기능 중 위 넷만. 뷰·필터·수식·관계형·권한·이력을 뺐다. 자동 수집 로직도 안 건드린다 — **표를 관리하는 화면 하나**가 전부다 |
| **② 어디를 단순화했나** | 칼럼이 표마다 다르므로 **DB 칼럼을 표마다 만들지 않는다.** 표·칼럼을 데이터로 정의하고 값은 한 칸(JSON)에 담는다. 그래서 칼럼을 늘려도 **마이그레이션이 없다** |
| **③ 동작을 어떻게 눈으로 보나** | 노션 CSV를 넣으면 화면에 그대로 뜨는가 · 칸을 고치면 새로고침해도 남는가 · 칼럼을 추가하면 모든 행에 생기는가 · 수집 대상으로 켜면 `content.source` 에 행이 생기는가 |

**미루기가 정당한 범위** — 이 화면은 **관리자만** 쓴다(외부 입력 아님). 그래서 이력·복구·동시편집 충돌 처리는 미룬다. 대신 **잘못 지울 수 없게** 소프트 삭제만 넣는다.

---

## 1. 지금 상태 (실측 · 2026-09-14)

| | |
|---|---|
| 노션 내보내기 | **11개 표 · 489행** · URL 있는 463 · 중복 제거 **고유 451개** |
| 가장 큰 것 | 서브스택 운영 94 · **발굴 후보 110**(109건이 SUBSTACK) · 트위터 140 · 링크드인 62 |
| `content.source` | **20행**뿐 (RSS 14 · WEBSITE 4 · CUSTOM 2) — 노션과 사실상 무관하게 돌고 있었다 |
| `source_type_enum` | `RSS·TWITTER·LINKEDIN·YOUTUBE·REDDIT·KAKAO·WEBSITE·CUSTOM` — **`SUBSTACK` 이 없다** |
| 🔴 노션 동기화 | `news_collector/sync_sources.py` 가 있으나 **`NOTION_*` 환경변수가 없고 부르는 곳도 없다.** 이미 죽은 코드다 |

**그래서 덮어쓸 주체가 없다.** 투고 기획(`../source-submission/` §5-C)의 ⚠️ "Notion 동기화가 같은 행을 덮는다" 경고는 **무효**가 된다.

---

## 2. 관리자 페이지를 전체 페이지로 바꾼다

지금 관리자 화면은 **모달**이다(`app/page.tsx` · `max-w-[1200px] h-[90vh]`). 표를 다루기엔 좁다.

```
지금   화면 위에 겹쳐 뜨는 창          폭 1200px 고정 · 바깥을 누르면 닫힘
바꿈   사이드바 옆 본문을 통째로 사용   폭 제한 없음 · 메뉴처럼 들어가고 나옴
```

개발자 앱은 URL 라우트가 아니라 **상태 기반**이므로(지침 §7 🟠), 모달을 없애고 `activeNav` 분기 하나를 추가한다.

### 상단 탭은 한글로

| 지금 | 바꿈 |
|---|---|
| Dashboard | **대시보드** |
| Knowledge Curation | **지식 큐레이팅** |
| Concept Page | **개념 페이지** |
| Prompt Templates | **프롬프트 템플릿** |
| Overview Builder | **오버뷰 편집** |
| Submissions | **투고 검토** |
| — | **소스 관리** ← 이번에 만드는 것 |

---

## 3. 화면 — 노션처럼 보이게

```
┌ 표 목록 ─────┐┌ 표 ────────────────────────────────────────────┐
│ 서브스택  94 ││  이름        주소         분류      담당  상태   │
│ 발굴 후보 110││  ────────────────────────────────────────────  │
│ 트위터   140 ││  Dwarkesh…   dwarkesh…   인사이트   HK   중단   │
│ 링크드인  62 ││  Marily Nika marily.sub… 워크플로…  —    미정   │
│ 유튜브    15 ││  + 행 추가                                      │
│ …            ││                                    [+ 칼럼]    │
└──────────────┘└────────────────────────────────────────────────┘
```

| | |
|---|---|
| **왼쪽** | 표 목록. 노션의 데이터베이스 하나 = 여기 한 줄. 건수를 같이 보여준다 |
| **오른쪽** | 표. **칸을 누르면 그 자리에서 고친다**(노션과 같게). 밖을 누르면 저장 |
| **행 추가** | 표 맨 아래 `+ 행 추가` 한 줄 |
| **칼럼 추가·이름 바꾸기** | 오른쪽 위 `+ 칼럼`. 이름은 머리줄에 마우스를 올리면 나오는 `⋯` 에서 바꾼다 — 아이콘을 늘어놓지 않는다 |
| **행 열기** | 행 왼쪽 `⤢` 를 누르면 오른쪽에 상세가 열린다(칼럼이 많을 때) |
| **지우기** | 행 상세의 `이 행 삭제` — 확인 모달이 한 번 뜬다. **칼럼은 지울 수 없다**(D10) |

칼럼 종류는 **여섯 개만** 둔다 — `글자 · 주소 · 여러 줄 · 선택 · 다중 선택 · 날짜`. 노션의 수식·관계형·롤업은 없다.

---

## 4. DB 보충 — 칼럼을 늘려도 마이그레이션이 없게

노션은 표마다 칼럼이 다르고(3~33개), 앞으로도 는다. 표마다 DB 칼럼을 만들면 **칼럼 하나 추가할 때마다 운영 DB 마이그레이션**이 필요하다. 그래서 **표·칼럼을 데이터로 정의**한다.

```
content.source_table    표 정의      key · label · url_field · sort
content.source_field    칼럼 정의    table_id · key · label · kind · options · sort
content.source_row      행           table_id · cells · source_id · origin · created_by · revoked_at
```

```sql
-- ⓪ 서브스택 종류 추가 (D11) — **따로 실행하고 커밋한다.**
--    새 enum 값은 추가한 그 트랜잭션 안에서 쓸 수 없다 (PostgreSQL).
ALTER TYPE content.source_type_enum ADD VALUE 'SUBSTACK' AFTER 'RSS';

-- ① 표 정의
CREATE TABLE content.source_table (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         varchar(40)  NOT NULL UNIQUE,     -- substack · twitter …
  label       varchar(60)  NOT NULL,            -- 서브스택 · 트위터 …
  url_field   varchar(40),                       -- 이 표의 "대표 주소" 칼럼. 수집 켤 때 url_handle 이 된다
  sort        integer      NOT NULL DEFAULT 0,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  revoked_at  timestamptz
);

-- ② 칼럼 정의 — 칼럼을 늘려도 여기 행이 늘 뿐, 마이그레이션이 없다
CREATE TABLE content.source_field (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id    uuid NOT NULL REFERENCES content.source_table(id),
  key         varchar(40) NOT NULL,
  label       varchar(60) NOT NULL,
  kind        varchar(10) NOT NULL,             -- text·url·long·select·multi·date (D4)
  options     jsonb,                            -- select·multi 의 선택지
  sort        integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,
  UNIQUE (table_id, key)
);

-- ③ 행 — 값은 전부 cells 에 담는다
CREATE TABLE content.source_row (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id    uuid  NOT NULL REFERENCES content.source_table(id),
  cells       jsonb NOT NULL DEFAULT '{}'::jsonb,   -- 값은 전부 여기. `values` 는 SQL 구문과 헷갈려 쓰지 않는다
  source_id   uuid REFERENCES content.source(id),   -- 수집 대상으로 켜면 채워진다
  origin      varchar(12) NOT NULL DEFAULT 'NOTION',-- NOTION · USER · DISCOVERED
  created_by  uuid REFERENCES core.app_user(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz                            -- 소프트 삭제 (D10)
);

CREATE INDEX ix_source_row_table ON content.source_row (table_id) WHERE revoked_at IS NULL;
CREATE INDEX ix_source_row_source ON content.source_row (source_id) WHERE source_id IS NOT NULL;
```

| 무엇 | 어디에 |
|---|---|
| 표가 몇 개고 이름이 뭔지 | `source_table` |
| 그 표에 칼럼이 뭐가 있는지 | `source_field` |
| 각 행의 값 | `source_row.cells` — `{"name":"Dwarkesh","url":"…","category":["insights-opinions"]}` |
| 실제 수집 대상인지 | `source_row.source_id` → `content.source` |

**`content.source` 는 건드리지 않는다.** 수집기(`config_loader.py`)가 읽는 표라서, 큐레이션 칼럼이 늘어도 수집에 영향이 0이어야 한다. 연결은 `source_id` 한 칸으로만 한다.

### 투고 URL 이 DB 에 반영되는 길 — 여기서 정해진다

투고 기획에서 "다음 범위"로 미뤄 둔 것이 이것이다.

```
유저 투고(승인)  ─┐
                  ├→ content.source_row (표 = 그 플랫폼) → [수집 대상으로 켜기] → content.source
자동 발굴(후보)  ─┘
```

**승인 = 표에 행이 생기는 것**이고, **수집 시작 = `content.source` 에 행이 생기는 것**이다. 둘을 나눈 이유는, 노션에서도 "목록에 있다"와 "실제로 긁는다"가 달랐기 때문이다(서브스택 94건 중 `Follow` 가 `Stopped`·`Not Yet` 인 것이 42건).

수집 대상으로 켤 때 지킬 것은 투고 기획 §5-C 의 ⚠️ 블록 그대로다 — `is_active=false` 로 넣고, `url_handle_hash` 를 채운다.

---

## 5. 이관 — 노션 CSV 를 그대로 넣는다

```
① 표 11개와 칼럼을 CSV 머리줄에서 만든다   ← 파일은 `_all.csv` 쪽을 쓴다
② 행 489개를 cells 에 그대로 넣는다        ← 값을 고치지 않는다
③ 화면에서 눈으로 확인한다
④ 그다음에 정리한다 (분류 통일 · 중복 12건 · URL 없는 26건)
```

**파일은 반드시 `_all.csv` 를 쓴다.** 표마다 파일이 두 벌인데(`_all` = 전체, 다른 하나 = 보기에 보이던 것), 아카이브는 **9칼럼 vs 33칼럼**으로 크게 다르다. 잘못 고르면 칼럼 24개가 통째로 사라진다.

### 칼럼 이름 규칙 — 머리줄을 그대로 쓸 수 없다

노션 머리줄에는 한글·공백·괄호·슬래시가 섞여 있고(`담당자` · `Subscribers (est.)` · `Twitter/X` · `URL (medium)`),
**같은 뜻인데 표기가 흔들린다** — `Why I Follow` · `Why I follow` · `Why I follow `(끝에 공백).

```
① 앞뒤 공백을 떼고 소문자로 바꾼다
② 아래 대응표에 있으면 그 이름을 쓴다      ← 표기 흔들림은 여기서 하나로 모인다
③ 없으면 영숫자만 남기고 나머지는 _ 로 바꾼다
```

| 노션 머리줄 | 칼럼 이름 |
|---|---|
| Name · Website Name | `name` |
| URL | `url` |
| Substack · Linkedin · Youtube · Threads · Reddit · URL (medium) · Website · RSS Feed | **각자 이름 그대로** (`substack` · `linkedin` · …) |
| Cherry Category | `category` |
| Why I Follow / Why I follow / `Why I follow ` | `why_follow` |
| Reviewer Notes · Review Notes | `reviewer_note` |
| Comment | `comment` |
| 담당자 | `owner` |
| Created By | `created_by` |
| Top Audience | `audience` |
| Follow | `follow` |
| Twitter Handle · Twitter/X | `twitter` |
| Subscribers (est.) | `subscribers` |
| Discovered At · Reviewed At · Site Last Updated | `discovered_at` · `reviewed_at` · `site_updated_at` |

⚠️ **플랫폼 이름 칼럼을 `url` 하나로 합치면 안 된다.** 아카이브 표에는
`URL · Website · Substack · LinkedIn · YouTube · Threads` 가 **각각 따로** 있다(한 사람이 여러 곳에 글을 쓴다).
합치면 칼럼 5개가 통째로 사라진다.

대신 **표마다 "대표 주소가 어느 칼럼인지"를 정해 둔다**(`source_table.url_field`).
서브스택 표는 `substack`, 링크드인 표는 `linkedin` 이 대표 주소다. 이 값이 나중에 수집을 켤 때 `url_handle` 이 된다(§4).

**화면에 보이는 이름(label)은 한글로 따로 둔다.** 위는 내부 이름(key)일 뿐이고, `label` 은 `왜 보나` · `담당` 처럼 적는다.

**②에서 값을 손대지 않는 게 중요하다.** 넣으면서 고치면 무엇이 원본이고 무엇이 우리가 바꾼 것인지 알 수 없게 된다. 정리는 화면에서 눈으로 보며 한다.

### 분류(Cherry Category)는 살린다

37종이 있고 그중 **10종만 앱 메뉴 id 와 정확히 맞는다**(`model-updates` · `papers` · `dev-tools` · `insights-opinions` 등). 나머지는 표기가 흔들린다 — `Dev Tools` vs `dev-tools`, `Big Tech 동향` vs `big-tech-trends`.

**이관할 때는 그대로 넣고**, 화면에서 `다중 선택` 칼럼으로 보여준다. 선택지 목록에 앱 메뉴 id 를 기본으로 깔아 두면, 고치는 사람이 자연스럽게 표준 값으로 모은다.

---

## 6. 결정

| # | 항목 | 결정 |
|---|---|---|
| D1 | 관리자 화면 형태 | **전체 페이지.** 모달 제거 |
| D2 | 상단 탭 언어 | **한글** |
| D3 | 노션에서 가져올 기능 | **행 추가 · 셀 수정 · 칼럼 추가/수정** 만 |
| D4 | 칼럼 종류 | 글자 · 주소 · 여러 줄 · 선택 · 다중 선택 · 날짜 **여섯** |
| D5 | 표 구조 | **표·칼럼을 데이터로 정의**하고 값은 JSON. 마이그레이션 없이 칼럼 추가 |
| D6 | `content.source` 변경 | **안 한다.** `source_row.source_id` 로만 잇는다 |
| D7 | 수집 시작 | 표에 행이 있는 것과 **별개.** 켤 때 `is_active=false` + `url_handle_hash` |
| D8 | 노션 동기화 코드 | **폐기**(`sync_sources.py`). 이미 안 돌고 있다 |
| D9 | 이관 시 값 손대기 | **안 한다.** 원본 그대로 넣고 화면에서 정리 |
| D11 | 서브스택 종류 | **enum 에 `SUBSTACK` 을 추가한다.** 가장 큰 덩어리(204건)라 나중에 세고 거르려면 구분이 있어야 한다 |
| D12 | 이관 범위 | **11개 표 전부**(489행) 한 번에. 값을 안 고치고 넣는 것이라 표가 많다고 위험이 커지지 않는다 |
| D13 | 겹치는 12건 | **그대로 둔다.** 기계가 합치면 어느 값을 살릴지 정해야 하고 그 과정에서 값이 사라진다 |
| D14 | 주소 없는 26건 | **그대로 넣는다.** 화면에서 채운다 |
| D15 | 분류 37종 | **원본 그대로 넣고** 선택지에 표준값(앱 메뉴 id)을 같이 깔아 둔다. 고치는 사람이 표준값으로 모이게 |
| D10 | 삭제 | **행만 지운다. 칼럼은 못 지운다** — 칼럼을 지우면 모든 행의 값이 한꺼번에 안 보이게 되는데, 그럴 일이 없다. 행 삭제는 지우기 전에 **한 번 물어보고**, 실제로는 **소프트 삭제**(`revoked_at`)라 되살릴 수 있다 |

---

## 7. 범위

### 하는 것
```
DB        표 3개 신설 (source_table · source_field · source_row)
이관      노션 CSV 11표 489행 적재 스크립트
화면      관리자 전체 페이지 전환 + 탭 한글화 + `소스 관리` 탭 1장
기능      행 추가 · 셀 수정 · 칼럼 추가/이름변경 · 행 소프트 삭제
연결      행 → content.source 로 수집 켜기
```

### 안 하는 것
```
✗ 되살리기 화면                 지운 것은 DB 에 남지만 화면에서 되살리는 기능은 안 만든다
✗ 노션의 뷰(보드·캘린더·갤러리) · 필터/정렬 빌더
✗ 수식 · 관계형 · 롤업 · 댓글 · 템플릿 · 이력
✗ 동시 편집 충돌 처리          관리자 몇 명이라 마지막 저장이 이긴다
✗ content.source 스키마 변경   수집기에 영향을 주지 않기 위해
✗ 자동 발굴 로직 손대기        후보는 지금처럼 들어오고, 검토만 여기서 한다
```

---

## 8. 확인한 사실 (실측)

| # | |
|---|---|
| F1 | 노션 11표 **489행** · 고유 451개 · 여러 표에 겹치는 것 12개 · URL 없는 행 26개 |
| F2 | 서브스택 운영 94행 중 **URL 이 빈 것 11건**, `Follow` 는 `Stopped`(21)·`Not Yet`(21) 뿐 — "돌고 있음" 값이 없다 |
| F3 | 서브스택 URL 은 `*.substack.com` 44 · **자체 도메인 39** — RSS 주소 규칙이 갈린다 |
| F4 | 발굴 후보 110건 중 **`Status=New` 가 109건** — 검토가 밀려 있다 |
| F5 | `content.source` 20행 · `source_type_enum` 에 **`SUBSTACK` 없음** |
| F6 | `sync_sources.py` 는 **환경변수도 호출부도 없다** — 죽은 코드 |
| F7 | 관리자 화면은 `app/page.tsx` 의 **모달**(`max-w-[1200px]`) |
| F8 | 칼럼 수는 표마다 3~33개로 제각각 |
