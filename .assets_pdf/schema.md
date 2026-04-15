

# 🍒 Cherry Platform v1.10 데이터베이스 아키텍처 및 스키마 설계서

## 1. 전체 설계 철학 및 아키텍처 컨셉 (Core Architecture Philosophy)

Cherry Platform v1.10의 데이터베이스 스키마는 전통적인 RDBMS의 정규화 관념을 넘어, **프론트엔드 렌더링 최적화**와 **대용량 데이터의 O(1) 조회**를 목표로 설계되었습니다. 본 스키마의 핵심 아키텍처 컨셉은 다음과 같습니다.

### 1.1. 화면명과 테이블명의 완벽한 일치 (UI-Driven Snapshot)

본 시스템은 "화면을 그리기 위해 여러 테이블을 JOIN하여 실시간으로 계산한다"는 레거시 방식을 철저히 배제합니다. 대신, **화면 이름과 1:1로 매핑되는 전용 스냅샷 테이블**을 두어 화면 조립을 극도로 단순화했습니다.

* **Patchnotes 화면** → `patchnote_daily_stat_snapshot` 테이블 사용
* **Weekly Highlight 화면** → `highlight_weekly_stat_snapshot` 테이블 사용
* **Model Updates 화면** → `model_update_weekly_stat_snapshot` 테이블 사용

### 1.2. JOIN 없는 O(1) 화면 렌더링 (No-JOIN UI Rendering)

화면명과 일치하는 스냅샷 테이블(`..._stat_snapshot`) 내부에는 프론트엔드가 요구하는 트리맵(Treemap), 급상승 키워드(Trending Keywords), 랭킹 지표(Ranking Metric) 등이 이미 `JSONB` 형태로 완벽하게 조립되어 있습니다.
사용자가 대시보드 탭을 클릭할 때, 백엔드는 수많은 기사 원장이나 AI 상태 테이블을 `JOIN`하거나 `GROUP BY` 하지 않습니다. 오직 해당 주차(Week)나 일자(Date)의 스냅샷 레코드 단 1건만을 `SELECT`하여 즉시 반환(O(1) 시간 복잡도)합니다. 이는 트래픽 폭주 시에도 DB의 부하를 원천 차단하는 가장 강력한 장점입니다.

### 1.3. 데이터 수명 주기(Lifecycle) 4단계 완벽 분리

데이터의 성격과 변경 빈도에 따라 계층을 완벽히 분리하여 책임 소재를 명확히 했습니다.

1. **수집 원장 (Raw):** 전 세계에서 수집된 불변의 원본 데이터 (`article_raw`)
2. **테넌트 관점 (Tenant State):** 동일한 기사라도 고객사별로 언제 발견했고(`discovered_at`), 어떻게 평가하는지 분리 (`company_article_state`)
3. **AI 파생 (AI Processed):** LLM 연산을 통해 추출된 구조화 데이터 캐싱 (`company_article_ai_state`)
4. **화면 결과물 (Stat Snapshot):** 백그라운드 배치가 위 3단계를 종합하여 미리 만들어둔 화면용 완성본 (`..._stat_snapshot`)

### 1.4. category_group → category 1:N 구조와 보조 축 분리

기존의 복잡한 다대다(N:M) 카테고리 관계를 청산하고, **대표 분류(1:N)**와 **보조 분류(side_category)**를 분리했습니다.

* **대표 분류:** 통계 연산과 트리맵, Model Updates 순위 집계의 절대적 기준 (`category_group` 1 → N `category`).
* **보조 분류:** "Case Studies"나 "Regulation" 같이 메인 통계를 오염시키지 않으면서 특정 기사들을 묶어 보여주기 위한 유연한 축 (`side_category`).

---

## 2. 공통 설계 규칙 (Common Design Rules)

모든 테이블은 다음의 물리적/논리적 설계 규칙을 엄격히 따릅니다.

* **UUID v7 기반 PK/FK:** 데이터베이스가 아닌 애플리케이션 단에서 순차적 속성을 가진 UUID v7을 생성하여 삽입합니다. 이는 B-Tree 인덱스의 Page Split을 최소화하여 INSERT 성능을 극대화합니다.
* **Soft Delete 적용:** 마스터성 데이터 및 설정 데이터(`company`, `user_account`, `category` 등)는 `DELETE` 쿼리를 사용하지 않고 `revoked_at` 컬럼에 타임스탬프를 기록하여 논리적으로 삭제합니다.
* **updated_at 자동 갱신:** PostgreSQL의 `BEFORE UPDATE` 트리거와 공통 함수(`set_updated_at()`)를 사용하여 애플리케이션의 개입 없이 DB 레벨에서 수정 시간을 무결하게 보장합니다.
* **PostgreSQL ENUM Type:** 상태값은 `VARCHAR`가 아닌 `CREATE TYPE ... AS ENUM`을 사용하여 스토리지 용량을 절약하고 값의 무결성을 보장합니다.

---

## 3. 테이블 상세 명세서 및 아키텍트 해설

### [PART 1] 회사 / 사용자 / 수신자

#### 3.1. `company`

멀티테넌트(Multi-Tenant) 아키텍처의 최상위 기준점입니다. 모든 통계, 기사 상태, 뉴스레터는 이 테이블의 `id`를 기준으로 완벽히 격리됩니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 고객사 고유 식별자. UUID v7을 사용하여 B-Tree 인덱스 파편화 방지. |
| **code** | VARCHAR(50) | NO |  | 시스템 접근 및 URL 라우팅용 식별 코드 (예: `coxwave`). |
| **name** | VARCHAR(200) | NO |  | 고객사 공식 명칭. |
| **timezone** | VARCHAR(50) | NO | `'Asia/Seoul'` | 주간 통계 배치 작업 시 `week_start`의 기준이 되는 타임존. |
| **is_active** | BOOLEAN | NO | `TRUE` | 고객사 활성 상태. False 시 모든 데이터 수집 및 배치 대상에서 제외됨. |
| **schedule_weekday** | SMALLINT | YES | `NULL` | 뉴스레터 정기 발간 요일. 0(일요일)부터 6(토요일)까지 허용(CHECK 제약). |
| **schedule_time_kst** | TIME | YES | `NULL` | KST 기준 실제 뉴스레터 발간 스케줄 시간. |
| **reply_to_email** | VARCHAR(255) | YES | `NULL` | 발송된 뉴스레터에 독자가 회신할 경우 수신할 이메일 주소. |
| **reply_to_name** | VARCHAR(100) | YES | `NULL` | 이메일 클라이언트에 표시될 회신자 이름. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` | 레코드 최초 생성 일시. |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` | 정보 최종 수정 일시 (트리거 자동 갱신). |
| **revoked_at** | TIMESTAMPTZ | YES | `NULL` | 삭제/계약 해지된 고객사를 물리 삭제하지 않고 시간을 기록. |

> 💡 **아키텍트의 시선 (보조 설명):**
> 고객사마다 월요일 00시의 기준이 다릅니다(한국 vs 미국). `timezone` 컬럼은 단순 표기용이 아니라, `highlight_weekly_stat_snapshot`을 생성하는 배치 서버가 "이 회사의 이번 주는 언제부터 언제까지인가?"를 정확히 계산하는 절대적인 잣대가 됩니다.

#### 3.2. `user_account`

대시보드에 접근하여 시스템을 관리하는 고객사 소속 직원 계정입니다. 패스워드 없이 매직링크(Magic Link) 방식으로만 인증합니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 사용자 고유 식별자. |
| **company_id** (FK) | UUID | NO |  | 소속 고객사 식별자. 데이터 조회 시 무조건 함께 검증되어야 하는 테넌트 키. |
| **email** | VARCHAR(255) | NO |  | 로그인 식별자 및 매직링크 발송 목적지. |
| **role** | user_role_enum | NO | `'GENERAL'` | 시스템 권한 제어 목적 (`ADMIN`, `MANAGER`, `GENERAL`). |
| **is_active** | BOOLEAN | NO | `TRUE` | 퇴사자 등의 접근을 즉시 차단하기 위한 활성 상태 플래그. |
| **last_login_at** | TIMESTAMPTZ | YES | `NULL` | 보안 감사용 최종 로그인 성공 시간. |
| **magic_token_hash** | BYTEA | YES | `NULL` | 이메일로 발송된 원문 토큰은 버리고, 오직 단방향 해시(32 bytes)만 저장하여 DB 탈취를 방어. |
| **magic_token_expires_at** | TIMESTAMPTZ | YES | `NULL` | 발급된 매직링크의 유효 만료 기한. |
| **magic_token_consumed_at** | TIMESTAMPTZ | YES | `NULL` | 재사용(Replay Attack) 방지를 위해 토큰이 실제 사용된 시간을 기록. |
| **magic_token_last_ip** | INET | YES | `NULL` | 인증을 시도한 IP 주소 (이상 접근 탐지용). |
| **magic_token_last_user_agent** | TEXT | YES | `NULL` | 접속 기기 및 브라우저 정보 추적. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **revoked_at** | TIMESTAMPTZ | YES | `NULL` | 퇴사 등 계정 논리 삭제 처리. |

> 💡 **아키텍트의 시선 (보조 설명):**
> `magic_token_hash` 길이를 32바이트로 강제하는 CHECK 제약이 DB 단에 걸려 있습니다. 백엔드 개발자가 실수로 해싱되지 않은 원문 텍스트나 이상한 값을 DB에 넣는 대참사를 엔진 레벨에서 원천 봉쇄하는 견고한 보안 설계입니다.

#### 3.3. `recipient`

뉴스레터를 정기적으로 수신하는 '외부 독자' 풀(Pool)입니다. 대시보드 관리자인 `user_account`와는 성격이 완전히 다릅니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 수신자 고유 식별자. |
| **company_id** (FK) | UUID | NO |  | 해당 수신자가 구독하는 뉴스레터의 주체(고객사). |
| **email** | VARCHAR(255) | NO |  | 뉴스레터 수신 목적지 이메일. |
| **name** | VARCHAR(100) | YES | `NULL` | 이메일 본문 개인화(Personalization)에 사용될 수신자명. |
| **status** | recipient_status_enum | NO | `'ACTIVE'` | 메일 수신 상태 (`ACTIVE`, `UNSUBSCRIBED`, `BOUNCED`). |
| **subscribed_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` | 구독 시작 일시. |
| **unsubscribed_at** | TIMESTAMPTZ | YES | `NULL` | 수신 거부(Opt-out) 요청을 처리한 일시. 법적 증빙 데이터. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **revoked_at** | TIMESTAMPTZ | YES | `NULL` | 논리 삭제. |

> 💡 **아키텍트의 시선 (보조 설명):**
> `status` 컬럼의 `BOUNCED`는 메일 발송 벤더(AWS SES 등)의 웹훅과 직결되는 핵심 필드입니다. 없는 이메일로 계속 메일을 쏘면 회사의 발송 평판(Reputation)이 깎여 스팸 처리됩니다. 발송 실패 웹훅을 수신하면 즉시 이 상태를 업데이트하여 다음 발송 대상 쿼리에서 자동 제외되도록 설계되었습니다.

---

### [PART 2] category_group / category (1:N) 및 보조 분류

#### 3.4. `category_group`

대시보드 상단의 메인 탭(Tab)이자, Weekly Highlight 화면의 **트리맵(Treemap)** 영역을 구성하는 가장 큰 단위(대분류)입니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 대분류 고유 식별자. |
| **code** | VARCHAR(50) | NO |  | 시스템 논리 처리를 위한 영문/언더바 코드 (예: `FRAMEWORK`). |
| **name** | VARCHAR(100) | NO |  | UI에 직접 노출될 대분류 그룹명. |
| **sort_order** | INT | NO | `0` | UI 렌더링 시 탭이 배치될 정렬 순서. |
| **is_active** | BOOLEAN | NO | `TRUE` | 활성화 여부. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **revoked_at** | TIMESTAMPTZ | YES | `NULL` | 논리 삭제. |

> 💡 **아키텍트의 시선 (보조 설명):**
> 이전 버전의 복잡했던 다대다 매핑을 제거했습니다. 이제 하나의 `category_group` 아래에 여러 `category`가 명확히 종속됩니다. 덕분에 트리맵 분포를 계산할 때 기사가 여러 그룹에 중복 카운팅되는 통계 오염을 막을 수 있습니다.

#### 3.5. `category`

기사의 '주민등록증' 같은 역할을 하는 대표 소분류입니다. **Model Updates 화면의 Major Players 순위 랭킹**은 오직 이 테이블의 단위를 기준으로만 계산됩니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 카테고리 고유 식별자. |
| **group_id** (FK) | UUID | NO |  | 속해 있는 대분류(`category_group`) 식별자. 1:N 관계의 핵심. |
| **code** | VARCHAR(80) | NO |  | 시스템 식별 코드 (예: `OPENAI`, `AGENT`). |
| **name** | VARCHAR(200) | NO |  | 화면에 노출될 카테고리 명칭. |
| **description** | VARCHAR(500) | YES | `NULL` | AI 프롬프트에 제공할 목적으로 작성하는 카테고리 상세 설명. |
| **sort_order** | INT | NO | `0` | 같은 대분류 내에서의 정렬 순서. |
| **is_active** | BOOLEAN | NO | `TRUE` | 활성화 여부. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **revoked_at** | TIMESTAMPTZ | YES | `NULL` | 논리 삭제. |

> 💡 **아키텍트의 시선 (보조 설명):**
> 이 테이블의 데이터는 "OpenAI", "Anthropic", "RAG" 같이 랭킹을 매겨야 하는 구체적인 주체들입니다. 기사가 수집되면 AI는 반드시 이 테이블에 있는 값 중 하나를 기사의 '대표 분류'로 꽂아 넣도록 강제받습니다.

#### 3.6. `side_category`

메인 통계를 오염시키지 않으면서, 기사를 유연하게 묶어서 보여주기 위한 '보조 분류 축'입니다. (예: Case Studies 화면)

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 사이드 카테고리 고유 식별자. |
| **code** | VARCHAR(80) | NO |  | 식별 코드 (예: `CASE_STUDY`, `REGULATION`). |
| **name** | VARCHAR(200) | NO |  | 화면 노출용 이름. |
| **description** | VARCHAR(500) | YES | `NULL` | 보조 분류에 대한 설명. |
| **sort_order** | INT | NO | `0` | UI 정렬 순서. |
| **is_active** | BOOLEAN | NO | `TRUE` | 활성화 여부. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **revoked_at** | TIMESTAMPTZ | YES | `NULL` | 논리 삭제. |

> 💡 **아키텍트의 시선 (보조 설명):**
> v1.10의 히든카드입니다. 기사가 메인 정체성으로는 `MODEL > OPENAI`에 속하면서도, 이 기사가 '유럽의 규제'를 다루고 있다면 `REGULATION`이라는 사이드 카테고리 태그를 추가로 붙일 수 있습니다. 이 덕분에 "최근 규제 동향만 모아보기" 같은 뷰(View)를 만들 때 랭킹 통계가 꼬이지 않습니다.

---

### [PART 3] source / company follow (수집 파이프라인)

#### 3.7. `source`

플랫폼 전체에서 전역으로 관리하는 수집 원천 마스터 데이터입니다. RSS, 웹사이트, 소셜 채널 등이 모두 이곳에 등록됩니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 소스 고유 식별자. |
| **type** | source_type_enum | NO |  | 소스의 종류 (`RSS`, `TWITTER`, `YOUTUBE` 등). |
| **name** | VARCHAR(200) | NO |  | 소스명 (예: `OpenAI Official Blog`). |
| **url_handle** | VARCHAR(1000) | NO |  | 크롤러가 접근할 메인 URL 또는 소셜 핸들명(@). |
| **url_handle_hash** | BYTEA | NO | STORED | `md5(url_handle)` - 빠른 검색 및 유니크 제약 보장용 해시. |
| **external_source_id** | VARCHAR(255) | YES | `NULL` | 외부 플랫폼 API 연동 시 사용하는 고유 식별자. |
| **homepage_url** | VARCHAR(1000) | YES | `NULL` | 해당 출처의 공식 홈페이지 주소. |
| **description** | VARCHAR(1000) | YES | `NULL` | 출처에 대한 간략한 설명. |
| **profile_image_url** | VARCHAR(1000) | YES | `NULL` | UI에 표시할 소스 프로필 이미지 링크. |
| **frequency** | VARCHAR(50) | NO | `'DAILY'` | 크롤러 작동 주기 설정. |
| **language** | VARCHAR(10) | YES | `NULL` | 해당 소스가 주로 발행하는 언어. |
| **country_code** | CHAR(2) | YES | `NULL` | 소스의 국가 코드. |
| **is_active** | BOOLEAN | NO | `TRUE` | 크롤링 동작 여부 스위치. |
| **source_meta_json** | JSONB | YES | `NULL` | 플랫폼별 특수 설정 (API 헤더, 셀렉터 규칙 등). |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **revoked_at** | TIMESTAMPTZ | YES | `NULL` | 논리 삭제. |

> 💡 **아키텍트의 시선 (보조 설명):**
> URL은 길이가 가변적이고 길어 인덱스를 걸면 성능이 저하됩니다. PostgreSQL의 `GENERATED ALWAYS AS ... STORED` 기능을 활용해 레코드가 인서트될 때 자동으로 MD5 해시를 만들어 `url_handle_hash`에 저장합니다. URL 중복 체크 속도를 비약적으로 끌어올리는 우아한 DB 엔진 활용법입니다.

#### 3.8. `company_source_follow_cfg`

모든 고객사가 세상의 모든 뉴스를 볼 필요는 없습니다. 각 고객사가 어떤 `source`를 구독할지, 가중치는 얼마나 줄지 결정하는 맵핑 테이블입니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 구독 설정 고유 식별자. |
| **company_id** (FK) | UUID | NO |  | 구독 주체 (고객사). |
| **source_id** (FK) | UUID | NO |  | 구독 대상 (수집처 원장). |
| **is_following** | BOOLEAN | NO | `TRUE` | 현재 해당 소스를 팔로우하고 있는지 여부. |
| **weight** | NUMERIC(10,2) | NO | `1.00` | 해당 소스에서 수집된 기사에 부여할 점수 가중치. |
| **settings_json** | JSONB | YES | `NULL` | 특정 소스에서 특정 키워드만 수집하게 하는 등 커스텀 필터링 룰. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **revoked_at** | TIMESTAMPTZ | YES | `NULL` | 논리 삭제. |

> 💡 **아키텍트의 시선 (보조 설명):**
> 이 테이블의 `weight` 컬럼이 중요합니다. A회사는 "HuggingFace 블로그"의 글을 아주 중요하게 여겨 가중치를 1.5로 줄 수 있고, B회사는 0.5로 줄 수 있습니다. 똑같은 기사라도 고객사마다 `company_article_state`의 최종 점수가 달라지는 핵심 이유가 됩니다.

---

### [PART 4] prompt template / run log (AI 브레인 및 실행 추적)

#### 3.9. `prompt_template`

기사를 분석(요약, 점수 산정)하거나 뉴스레터를 생성할 때 LLM에게 던지는 프롬프트의 뼈대입니다. HQ(본사 기본형)와 COMPANY(고객사 맞춤형)로 나뉩니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 템플릿 고유 식별자. |
| **company_id** (FK) | UUID | YES | `NULL` | scope가 'COMPANY'일 경우 소유 고객사 식별자. |
| **company_id_key** | UUID | NO | STORED | 유니크 인덱스 생성 시 NULL 무시 문제를 해결하기 위한 보정 키. |
| **scope** | template_scope_enum | NO |  | `HQ` (플랫폼 기본 템플릿) / `COMPANY` (고객사 전용 복제본). |
| **type** | prompt_template_type_enum | NO |  | `ARTICLE_AI` (기사 분석용) / `NEWSLETTER` (이메일 작성용). |
| **code** | VARCHAR(100) | NO |  | 시스템 호출용 식별 코드 (예: `article_ai_default`). |
| **name** | VARCHAR(200) | NO |  | 템플릿의 명칭. |
| **description** | VARCHAR(500) | YES | `NULL` | 템플릿에 대한 설명. |
| **tone_text** | TEXT | NO |  | "전문적이고 날카로운 어조로 작성해라" 같은 AI 지시어. |
| **cloned_from_template_id** | UUID | YES | `NULL` | HQ 템플릿을 복사해서 만든 경우 원본 HQ 템플릿의 ID. |
| **is_active** | BOOLEAN | NO | `TRUE` | 해당 템플릿의 사용 여부. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **revoked_at** | TIMESTAMPTZ | YES | `NULL` | 논리 삭제. |

#### 3.10. `prompt_template_version`

프롬프트 엔지니어링의 핵심입니다. 프롬프트를 수정할 때 덮어쓰지 않고 항상 버전을 생성하여 과거의 평가 결과와 비교/롤백할 수 있게 합니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 버전 고유 식별자. |
| **prompt_template_id**(FK) | UUID | NO |  | 템플릿 본체 식별자. |
| **version_no** | INT | NO |  | 버전 번호 (1, 2, 3 순차 증가). |
| **version_tag** | VARCHAR(20) | YES | `NULL` | `PROD`, `BETA`, `A/B_TEST` 등의 태그. |
| **prompt_text** | TEXT | NO |  | LLM에 전달될 프롬프트 본문. (변수 템플릿 포함) |
| **few_shot_examples** | TEXT | YES | `NULL` | AI 성능 향상을 위해 제공하는 예시 입출력 쌍 데이터. |
| **parameters_json** | JSONB | YES | `NULL` | `temperature`, `top_p`, `max_tokens` 등 모델 호출 파라미터. |
| **change_note** | VARCHAR(500) | YES | `NULL` | 이전 버전 대비 무엇을 수정했는지 남기는 메모. |
| **cloned_from_version_id** | UUID | YES | `NULL` | 복사 생성 시 원본 버전의 식별자. |
| **is_active** | BOOLEAN | NO | `TRUE` | 이 버전을 현재 활성화할 것인지 여부. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **revoked_at** | TIMESTAMPTZ | YES | `NULL` | 논리 삭제. |

#### 3.11. `run_log`

플랫폼 내의 모든 주요 비동기 작업(크롤링, AI 호출, 통계 배치, 이메일 발송)의 실행 이력과 소모 비용을 기록하는 팩트 테이블입니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 실행 로그 고유 식별자. |
| **company_id** (FK) | UUID | YES | `NULL` | 특정 고객사 종속 작업인 경우 기록. |
| **run_kind** | run_kind_enum | NO |  | `SOURCE_FETCH`, `ARTICLE_AI_PROCESS`, `STAT_SNAPSHOT_BUILD` 등. |
| **status** | run_status_enum | NO | `'RUNNING'` | `RUNNING`, `SUCCESS`, `FAILED`. |
| **related_entity_type** | related_entity_type_enum | NO | `'NONE'` | 이 로그가 어떤 엔티티(기사, 뉴스레터 등)를 조작했는지 타입 명시. |
| **related_entity_id** | UUID | YES | `NULL` | 조작된 실제 엔티티의 ID. |
| **prompt_template_version_id** | UUID | YES | `NULL` | AI 작업일 경우 사용한 프롬프트 버전. |
| **model_name** | VARCHAR(100) | YES | `NULL` | 사용된 LLM 모델명 (예: `Claude-3.5-Sonnet`). |
| **input_tokens** | INT | NO | `0` | AI 호출 시 소모된 프롬프트 토큰 양. |
| **output_tokens** | INT | NO | `0` | AI가 생성한 결과 토큰 양. |
| **cost_usd** | NUMERIC(12,6) | YES | `NULL` | API 호출로 발생한 달러 단위 비용 (정산 핵심). |
| **processed_count** | INT | NO | `0` | 배치 작업 시 처리한 전체 레코드 건수. |
| **error_msg** | TEXT | YES | `NULL` | 실패 시 저장되는 에러 스택 트레이스 또는 메시지. |
| **meta_json** | JSONB | YES | `NULL` | 진단 로그, 실행 환경 메타 정보. |
| **started_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` | 작업 시작 시간. |
| **ended_at** | TIMESTAMPTZ | YES | `NULL` | 작업 완료 시간. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |

---

### [PART 5] article_raw / company_article_state / company_article_ai_state

이 시스템의 심장부입니다. 데이터는 하나지만, 고객사별로 바라보는 관점을 분리한 마법이 여기에 있습니다.

#### 3.12. `article_raw`

전 세계 수집처에서 긁어온 단 하나의 '원본 불변' 기사 테이블입니다. 시스템 전체에서 데이터 중복 제거(Dedup)를 담당하는 최전선입니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 원본 기사 고유 식별자. |
| **source_id** (FK) | UUID | NO |  | 기사를 수집한 출처. |
| **title** | VARCHAR(500) | NO |  | 수집된 기사의 원문 제목. |
| **url** | VARCHAR(1000) | NO |  | 원본 웹페이지 주소. |
| **url_hash** | BYTEA | NO | STORED | `md5(url)` 해시값. |
| **guid** | VARCHAR(1000) | YES | `NULL` | RSS/Atom 피드에서 제공하는 고유 식별자. |
| **guid_hash** | BYTEA | YES | STORED | `md5(guid)` 해시값. |
| **normalized_url** | VARCHAR(1000) | YES | `NULL` | UTM 파라미터 등 불필요한 쿼리를 정제한 URL. |
| **normalized_url_hash** | BYTEA | YES | STORED | `md5(normalized_url)` 해시값. |
| **canonical_url** | VARCHAR(1000) | YES | `NULL` | HTML 헤더에 명시된 공식 URL (SEO 표준). |
| **canonical_url_hash** | BYTEA | YES | STORED | `md5(canonical_url)` 해시값. |
| **content_hash** | BYTEA | YES | `NULL` | 기사 본문의 해시값 (내용 완전 동일성 비교용). |
| **published_at** | TIMESTAMPTZ | NO |  | 기사가 세상에 실제로 발행된 시간. |
| **fetched_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` | 우리 시스템 크롤러가 기사를 긁어온 시간. |
| **language** | VARCHAR(10) | YES | `NULL` | 기사의 언어. |
| **author** | VARCHAR(255) | YES | `NULL` | 기고자 또는 작성자 명. |
| **image_url** | VARCHAR(1000) | YES | `NULL` | 기사의 대표 썸네일(og:image) 링크. |
| **content_raw** | TEXT | YES | `NULL` | 수집된 HTML 문서 또는 파싱된 텍스트 전문. |
| **external_storage_key** | VARCHAR(1000) | YES | `NULL` | 본문 용량이 커서 S3 등에 이관했을 경우의 스토리지 키. |
| **storage_state** | storage_state_enum | NO | `'ACTIVE'` | 기사 본문의 수명 주기 관리 (`ACTIVE`, `ARCHIVED`, `DELETED`). |
| **archived_at** | TIMESTAMPTZ | YES | `NULL` | S3 아카이빙으로 이관된 시점. |
| **representative_key** | TEXT | NO |  | **[중복 판별의 절대 기준]** 애플리케이션이 조합하는 대표키. |
| **representative_key_hash** | BYTEA | NO | STORED | `md5(representative_key)` - DB 단의 유니크 제약 조건. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |

> 💡 **아키텍트의 시선 (보조 설명):**
> **완벽한 Dedup(중복 제거) 운영 규칙:** > DB가 알아서 중복을 판단하지 않습니다. 애플리케이션이 수집 단계에서 로직에 따라 우선순위(`GUID` > `normalized_url` > `canonical_url` > `url`)를 매겨 하나의 문자열(예: `CANO:https://abc.com/news/12`)을 `representative_key`에 넣습니다. DB는 이 키의 해시에 걸린 `uq_article_raw_representative_key_hash` 유니크 인덱스로 튕겨낼지 말지만 고속으로 처리합니다.

#### 3.13. `company_article_state`

같은 원본 기사라도, 고객사마다 발견 시점, 카테고리 분류, 중요도(점수)가 다릅니다. 이 테이블이 데이터를 회사별 평행우주로 분리합니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 고객사별 기사 상태 고유 식별자. |
| **company_id** (FK) | UUID | NO |  | 대상 고객사 식별자. |
| **article_raw_id** (FK) | UUID | NO |  | 원본 불변 기사(`article_raw`) 식별자. |
| **category_group_id** (FK) | UUID | YES | `NULL` | 해당 기사가 이 고객사에서 속할 **대표 카테고리 대분류**. |
| **category_id** (FK) | UUID | YES | `NULL` | 해당 기사가 이 고객사에서 속할 **대표 카테고리 소분류**. |
| **impact_score** | NUMERIC(12,4) | NO | `0` | 고객사 관점에서의 기사 중요도 (0~100점). |
| **is_high_impact** | BOOLEAN | NO | `FALSE` | 내부 임계치를 넘은 핵심 중요 기사 여부. |
| **is_hidden** | BOOLEAN | NO | `FALSE` | 사용자가 대시보드에서 숨김 처리한 스팸/무의미 기사 여부. |
| **discovered_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` | **[KPI 기준]** 이 고객사의 피드에 기사가 유입/발견된 시각. |
| **meta_json** | JSONB | YES | `NULL` | UI 표시용 부가 정보. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **revoked_at** | TIMESTAMPTZ | YES | `NULL` | **[Soft Delete]** 고객사 관점에서 기사를 휴지통에 버림. |

> 💡 **아키텍트의 시선 (보조 설명):**
> `highlight_weekly_stat_snapshot`의 "Items This Week(이번 주 새로 발견된 기사 수)"를 계산할 때, 기준은 기사의 최초 발행일(`published_at`)이 절대 아닙니다. 크롤러 지연 등으로 화요일에 발행된 기사를 수요일에 가져왔다면 수요일 실적으로 잡혀야 합니다. 따라서 무조건 이 테이블의 **`discovered_at`**을 기준으로 집계합니다.

#### 3.14. `company_article_side_category_map`

기사 하나에 대표 분류 1개 외에도, "규제", "사례 연구" 등 다수의 보조 태그를 달아주기 위한 N:M 연결 테이블입니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 맵핑 고유 식별자. |
| **company_id** (FK) | UUID | NO |  | 격리 기준 고객사. |
| **company_article_state_id**(FK) | UUID | NO |  | 태그를 부여할 고객사 기사 상태 식별자. |
| **side_category_id** (FK) | UUID | NO |  | 부여할 보조 분류 식별자. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **revoked_at** | TIMESTAMPTZ | YES | `NULL` | 태그 부여 해제 시 논리 삭제. |

#### 3.15. `company_article_ai_state`

LLM이 기사 원문을 읽고 요약, 점수 산정, 구조화된 키워드/토픽을 추출해 낸 값비싼 연산 결과물입니다. 주간 KPI(Topics Covered 등)의 원재료 창고입니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | AI 상태 고유 식별자. |
| **company_id** (FK) | UUID | NO |  | 격리 기준 고객사. |
| **company_article_state_id**(FK) | UUID | NO |  | 분석 대상 고객사 기사 상태 (1:1 매핑). |
| **ai_status** | ai_status_enum | NO | `'PENDING'` | 연산 상태 (`PENDING`, `SUCCESS`, `FAILED`). |
| **ai_summary** | TEXT | YES | `NULL` | AI가 생성한 핵심 요약문. |
| **ai_score** | NUMERIC(12,4) | YES | `NULL` | AI가 평가한 원시 품질/중요도 점수. |
| **ai_classification_json** | JSONB | YES | `NULL` | AI가 판단한 카테고리/토픽 정규화 결과. |
| **ai_tags_json** | JSONB | YES | `NULL` | 본문에서 추출된 태그 및 키워드 배열. |
| **ai_entities_json** | JSONB | YES | `NULL` | 등장하는 회사명, 인물, 제품명 등 고유명사 구조체. |
| **ai_snippets_json** | JSONB | YES | `NULL` | 요약을 뒷받침하는 원문 발췌(스니펫) 모음. |
| **ai_evidence_json** | JSONB | YES | `NULL` | AI가 점수나 분류를 내린 논리적 근거 텍스트. |
| **ai_structured_extraction_json** | JSONB | YES | `NULL` | 벤치마크 메트릭(GPQA 등)을 키-값으로 정교하게 뽑아낸 결과. |
| **prompt_template_version_id** | UUID | YES | `NULL` | 생성 당시 사용된 프롬프트 버전 (품질 역추적용). |
| **run_log_id** (FK) | UUID | YES | `NULL` | 실행 로그 포인터 (비용 역추적용). |
| **ai_model_name** | VARCHAR(100) | YES | `NULL` | 사용된 LLM 모델명. |
| **ai_processed_at** | TIMESTAMPTZ | YES | `NULL` | AI 처리가 완료된 시간. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |

> 💡 **아키텍트의 시선 (보조 설명):**
> Weekly Highlight의 KPI인 "Topics Covered(다뤄진 토픽 수)"와 "New Keywords(신규 키워드 수)"는 기사 원문을 다시 읽어서 계산하는 것이 아닙니다. 백그라운드 배치가 이 테이블의 `ai_structured_extraction_json`과 `ai_tags_json` 안에 들어있는 배열들을 가져가 중복을 제거(Set)하고 카운팅하는 방식으로 계산됩니다. 이 컬럼들에는 JSON 배열 검색 최적화를 위해 GIN 인덱스가 걸려 있습니다.

---

### [PART 6] 화면별 상태 및 O(1) 통계 스냅샷

이 아키텍처의 꽃입니다. 복잡한 쿼리를 프론트엔드 호출 시점에 하지 않고, 테이블 자체를 화면과 1:1로 매핑하여 미리 구워놓습니다.

#### 3.16. `patchnote_cursor_state`

Patchnotes 화면에서 고객사가 "어디까지 읽었는지"를 저장하는 책갈피(Cursor)입니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 커서 고유 식별자. |
| **company_id** (FK) | UUID | NO |  | 고객사 (1:1 매핑). |
| **last_visited_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` | 사용자가 Patchnotes 메뉴에 마지막으로 접속한 시각. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |

> 💡 **아키텍트의 시선 (보조 설명):**
> Patchnotes 화면에 들어갈 때 보여줄 기사 목록은 단 한 줄의 조건으로 끝납니다. `company_article_state.discovered_at > patchnote_cursor_state.last_visited_at`. 즉, 마지막 방문 시점 이후에 시스템에 들어온 새 소식만 깔끔하게 노출하는 catch-up 구조입니다.

#### 3.17. `patchnote_daily_stat_snapshot`

Patchnotes 화면 상단에 띄울 일간 요약 통계입니다. 기사가 없는 날은 아예 레코드를 생성하지 않아 공간을 아낍니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 통계 스냅샷 식별자. |
| **company_id** (FK) | UUID | NO |  | 대상 고객사. |
| **stat_date** | DATE | NO |  | 통계 대상 날짜. |
| **new_article_count** | INT | NO |  | 해당 일자에 유입된 총 신규 기사 수. |
| **new_high_impact_count** | INT | NO | `0` | 그중에서 High Impact 태그가 붙은 기사 수. |
| **areas_changed_json** | JSONB | NO |  | 어느 카테고리 영역에 변화가 컸는지 담은 배열 (화면 표시용). |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |

#### 3.18. `highlight_weekly_stat_snapshot`

**[핵심 테이블]** 임원진이 보는 Weekly Highlight 대시보드를 통째로 저장한 스냅샷입니다. 이 테이블 조회만으로 페이지 상단의 모든 KPI와 차트가 그려집니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 주간 스냅샷 고유 식별자. |
| **company_id** (FK) | UUID | NO |  | 대상 고객사. |
| **week_start** | DATE | NO |  | 해당 주차의 시작일. |
| **week_end** | DATE | NO |  | 해당 주차의 종료일. |
| **items_this_week** | INT | NO | `0` | **[KPI]** 이번 주 새로 발견(`discovered_at`)된 기사 수. |
| **items_delta_vs_last_week** | INT | NO | `0` | 전주 대비 기사 증감 수. |
| **topics_covered_count** | INT | NO | `0` | **[KPI]** AI가 구조화한 Distinct Topic 의 개수. |
| **covered_topics_json** | JSONB | YES | `NULL` | Topic 리스트 배열. |
| **new_keywords_count** | INT | NO | `0` | **[KPI]** AI 태그 기준 이번 주 처음 등장한 Distinct Keyword 수. |
| **new_keywords_mom_rate** | NUMERIC(12,4) | NO | `0` | 신규 키워드의 전월 대비 증감률(%). 하한선 -100%. |
| **new_keywords_json** | JSONB | YES | `NULL` | 화면에 뿌려질 신규 키워드 배열. |
| **trending_keywords_json** | JSONB | YES | `NULL` | 화면에 뿌려질 급상승 키워드 배열. |
| **score_5_items_count** | INT | NO | `0` | **[KPI]** 상위 버킷(Score 5) 점수를 받은 최상급 기사 개수. |
| **treemap_distribution_json** | JSONB | NO |  | 화면 중앙의 거대한 트리맵 분포 비율을 그리기 위한 JSON 데이터. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |

#### 3.19. `model_update_daily_snapshot`

주간 랭킹(Major Players)을 산정하기 위해 매일매일 각 카테고리(모델/회사)의 성적을 기록해 두는 일일 장부입니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 일간 성적표 식별자. |
| **company_id** (FK) | UUID | NO |  | 대상 고객사. |
| **stat_date** | DATE | NO |  | 대상 날짜. |
| **category_group_id** (FK) | UUID | NO |  | 평가 대상이 속한 대분류. |
| **category_id** (FK) | UUID | NO |  | 평가 대상인 구체적 소분류 (예: OpenAI). |
| **article_count** | INT | NO | `0` | 해당 카테고리로 분류된 일일 기사 수. |
| **high_impact_count** | INT | NO | `0` | 고영향 기사 수. |
| **score_sum** | NUMERIC(14,4) | NO | `0` | AI가 매긴 점수의 총합. |
| **score_avg** | NUMERIC(14,4) | YES | `NULL` | 평균 점수 (기사가 없으면 NULL). |
| **weighted_score** | NUMERIC(14,4) | NO | `0` | 최신성, 소스 가중치 등이 반영된 내부 연산 가중 점수 (랭킹의 실제 척도). |
| **benchmark_metric_json** | JSONB | YES | `NULL` | 기사에서 추출한 "MMLU: 89%" 같은 수치 데이터 보존. |
| **co_mentioned_terms_json** | JSONB | YES | `NULL` | 이 카테고리와 함께 언급된 다른 기술/경쟁사 용어 배열. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |

#### 3.20. `model_update_weekly_stat_snapshot`

**[핵심 테이블]** 일간 성적표(`model_update_daily_snapshot`) 7일 치를 취합하여 Model Updates 화면에 뿌려줄 최종 "이번 주 순위 랭킹표"를 확정 지은 스냅샷입니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 주간 랭킹 스냅샷 식별자. |
| **company_id** (FK) | UUID | NO |  | 대상 고객사. |
| **week_start** | DATE | NO |  | 주간 시작일. |
| **week_end** | DATE | NO |  | 주간 종료일. |
| **category_group_id** (FK) | UUID | NO |  | 랭킹을 매긴 대분류 (예: LLM Models 내에서의 순위). |
| **items_count** | INT | NO | `0` | 랭킹 산정에 사용된 총 기사 수. |
| **tracked_company_count** | INT | NO | `0` | 랭킹에 참전한 총 카테고리(추적 대상) 수. |
| **ranking_metric_label** | VARCHAR(50) | NO |  | 화면에 표시될 랭킹 기준 명칭 (예: `GPQA Benchmark`). |
| **lanked_category_json** | JSONB | NO |  | **[핵심]** 1위부터 끝까지 순위, 점수, 뱃지, 변동폭이 완벽히 조립된 배열. |
| **rising_star_json** | JSONB | YES | `NULL` | **[KPI]** 지난주 대비 상승률이 가장 높은 'Rising Star' 1개를 지정한 JSON 구조체. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` | 이 테이블은 생성 후 갱신이 불필요하므로 `updated_at`이 없습니다. |

> 💡 **아키텍트의 시선 (보조 설명):**
> `lanked_category_json` 컬럼의 오타(ranked가 맞음)는 실제 DDL에 정의된 스펙이므로 그대로 적용합니다. 이 JSON 안에는 순위표 렌더링에 필요한 모든 HTML적 요소(badge_text, supporting_text 등)가 데이터 형태로 조립되어 있어, 백엔드는 이걸 꺼내서 던져주기만 하면 됩니다.

---

### [PART 7] Newsletter / 발송 로그

대시보드 안의 데이터와 통계를 버무려 세상 밖으로(이메일로) 내보내는 출판 시스템입니다.

#### 3.21. `newsletter_issue`

이번 주 발간될 뉴스레터의 '본체(Issue)'입니다. 초안 작성부터 최종 발송 승인까지의 상태 흐름을 관리합니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 이슈 고유 식별자. |
| **company_id** (FK) | UUID | NO |  | 발행 고객사. |
| **issue_week_start** | DATE | NO |  | 이 이슈가 다루는 주간의 시작일. |
| **issue_week_end** | DATE | NO |  | 주간 종료일. |
| **title** | VARCHAR(255) | NO |  | 관리자용 대시보드 표시 제목. |
| **subject** | VARCHAR(255) | YES | `NULL` | 독자가 메일함에서 보게 될 실제 이메일 제목. |
| **status** | newsletter_issue_status_enum | NO | `'DRAFT'` | 뉴스레터 생애주기 (`DRAFT`, `READY`, `SENT`, `FAILED`). |
| **content_html** | TEXT | YES | `NULL` | 에디터가 수정을 마친 최종 발송용 HTML 전문. |
| **content_md** | TEXT | YES | `NULL` | 생성 원본인 마크다운 포맷. |
| **generated_at** | TIMESTAMPTZ | YES | `NULL` | AI가 초안 생성을 마친 시간. |
| **finalized_at** | TIMESTAMPTZ | YES | `NULL` | 에디터(사람)가 내용 검수를 끝내고 승인한 시간. |
| **sent_at** | TIMESTAMPTZ | YES | `NULL` | 시스템이 발송 프로세스를 완료한 시간. |
| **provider** | newsletter_provider_enum | YES | `NULL` | 실제 사용한 발송 벤더 (`SES`, `SENDGRID` 등). |
| **send_status** | newsletter_send_status_enum | NO | `'QUEUED'` | 전체 발송 큐 상태 관리. |
| **recipient_count** | INT | NO | `0` | 발송 타겟으로 잡힌 총 수신자 수. |
| **send_error_message** | TEXT | YES | `NULL` | 플랫폼 시스템 에러 발생 시 기록. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |

#### 3.22. `newsletter_issue_item_snapshot`

이메일은 한 번 날아가면 수정할 수 없습니다. 따라서 원본 기사(`article_raw`)의 제목이 나중에 수정되더라도, **"메일이 발송되던 그 시점의 기사 내용"**을 영구적으로 박제(Snapshot)해 두는 테이블입니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 아이템 스냅샷 식별자. |
| **company_id** (FK) | UUID | NO |  | 고객사 식별자. |
| **newsletter_issue_id** (FK) | UUID | NO |  | 어느 뉴스레터에 포함되었는지 매핑. |
| **company_article_state_id** | UUID | YES | `NULL` | 원본 기사 상태 포인터 (클릭 수 추적 등에 활용). |
| **source_name** | VARCHAR(200) | YES | `NULL` | 당시 소스명 박제. |
| **article_title** | VARCHAR(500) | NO |  | 메일에 삽입된 당시의 기사 제목. |
| **article_url** | VARCHAR(1000) | NO |  | 메일에 삽입된 원문 링크. |
| **article_published_at** | TIMESTAMPTZ | NO |  | 기사 발행 일시. |
| **article_author** | VARCHAR(255) | YES | `NULL` | 기고자 이름 박제. |
| **article_language** | VARCHAR(10) | YES | `NULL` | 언어 박제. |
| **article_image_url** | VARCHAR(1000) | YES | `NULL` | 메일에 포함된 썸네일 이미지 링크. |
| **ai_summary** | TEXT | YES | `NULL` | 메일에 포함된 요약문 박제 (나중에 AI 요약이 수정되어도 메일 기록은 유지). |
| **ai_score** | NUMERIC(12,4) | YES | `NULL` | 발간 당시의 점수 박제. |
| **is_recommended** | BOOLEAN | NO | `FALSE` | "에디터 추천/하이라이트" 기사 지정 여부. |
| **position** | INT | NO | `0` | 메일 내에서 위아래 스크롤 시 보여질 순서. |
| **highlight_text** | TEXT | YES | `NULL` | 강조용 문구 박제. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |

#### 3.23. `newsletter_draft_version`

대시보드 에디터에서 관리자가 뉴스레터를 편집할 때, 뒤로 가기(Undo)와 버전 관리를 지원하기 위한 히스토리 저장소입니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 버전 고유 식별자. |
| **company_id** (FK) | UUID | NO |  | 고객사 식별자. |
| **newsletter_issue_id** (FK) | UUID | NO |  | 편집 중인 뉴스레터 이슈 매핑. |
| **version_no** | INT | NO |  | 1, 2, 3 순으로 증가하는 버전 넘버. |
| **content_html** | TEXT | NO |  | 해당 시점의 HTML 전문 백업. |
| **created_by_user_id** (FK) | UUID | YES | `NULL` | 이 버전을 수정한 관리자(`user_account`) 식별자. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` | 자동 저장 시각. 이력 데이터이므로 `updated_at` 없음. |

#### 3.24. `newsletter_send_log`

뉴스레터 전체의 성공 여부가 아니라, **"수신자 개개인에게 메일이 제대로 전달되었는가"**를 증명하는 수신자 단위의 영수증입니다.

| 컬럼명 | 데이터 타입 | Null | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| **id** (PK) | UUID | NO |  | 발송 로그 고유 식별자. |
| **company_id** (FK) | UUID | NO |  | 발송 주체 고객사. |
| **newsletter_issue_id** (FK) | UUID | NO |  | 발송된 뉴스레터. |
| **recipient_id** (FK) | UUID | YES | `NULL` | 타겟팅된 수신자 식별자 (수신자 삭제 시 NULL 허용 설계). |
| **to_email** | VARCHAR(255) | NO |  | 실제 메일이 전송된 목적지 주소. |
| **provider** | newsletter_provider_enum | NO | `'OTHER'` | 발송에 사용된 벤더 인프라. |
| **provider_message_id** | VARCHAR(255) | YES | `NULL` | AWS SES 등이 발송 후 리턴해주는 고유 추적 ID. (오픈율/클릭율 추적의 키값) |
| **status** | newsletter_send_status_enum | NO | `'QUEUED'` | 개별 발송 성공 여부 (`SENT`, `FAILED`). |
| **error_msg** | TEXT | YES | `NULL` | 스팸 차단, 용량 초과 등 하드/소프트 바운스 상세 사유. |
| **queued_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` | 발송 큐에 적재된 시간. |
| **sent_at** | TIMESTAMPTZ | YES | `NULL` | 벤더 서버에서 성공적으로 처리된 시간. |
| **created_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |
| **updated_at** | TIMESTAMPTZ | NO | `CURRENT_TIMESTAMP` |  |

---

## 4. KPI 계산 로직 상세 가이드 (Statistics Calculation Rules)

이 스키마는 화면 데이터를 스냅샷으로 고정하기 때문에, 백그라운드 배치가 KPI를 정확한 수식으로 연산하여 저장하는 것이 핵심입니다. 이 계산 규칙은 백엔드 개발 시 반드시 지켜야 할 바이블입니다.

### 4.1. Items This Week (이번 주 신규 기사 수)

* **의미:** 발행일 기준이 아닌, 해당 고객사 대시보드에 이번 주에 새로 꽂힌 기사의 수입니다.
* **계산 기준:** `company_article_state` 테이블의 **`discovered_at`** 컬럼이 주간 범위(`week_start` ~ `week_end`) 내에 존재하는 레코드 수.
* **저장 위치:** `highlight_weekly_stat_snapshot.items_this_week`

### 4.2. Topics Covered (다뤄진 토픽 수)

* **의미:** DB에 지정된 카테고리 개수가 아니라, AI가 본문을 읽고 추출해 낸 고유 토픽의 개수입니다.
* **계산 기준:** `company_article_ai_state`의 `ai_structured_extraction_json` 배열 내 정규화된 토픽들을 애플리케이션 단에서 Set(중복 제거) 처리한 후 길이를 구합니다.
* **저장 위치:** `highlight_weekly_stat_snapshot.topics_covered_count`

### 4.3. New Keywords & MoM Rate

* **의미:** 이번 주 기사들에서 처음 발견된 신조어나 키워드 수 및 전월 대비 증감률입니다.
* **계산 기준:** `company_article_ai_state.ai_tags_json`에서 추출. 전월 동기 대비 증가분을 계산하며, 하한선은 -100%로 고정합니다.
* **저장 위치:** `highlight_weekly_stat_snapshot.new_keywords_mom_rate`

### 4.4. Score-5 Items (최상위 점수 기사 수)

* **의미:** AI 평가 점수가 시스템 내 최고 등급 버킷(예: 상위 20% 또는 95점 이상)에 속하는 핵심 기사 수.
* **계산 기준:** `company_article_ai_state.ai_score` 값 필터링.
* **저장 위치:** `highlight_weekly_stat_snapshot.score_5_items_count`

### 4.5. Rising Star (급상승 랭킹 선별)

* **의미:** 단순 기사 수가 아니라 가중 점수가 가장 드라마틱하게 폭발한 카테고리 하나를 자동 선정합니다.
* **계산 공식:** `((최근 7일 weighted_score 총합) - (이전 7일 weighted_score 총합)) / (이전 7일 총합) * 100` 의 값이 가장 큰 `category_id`. (단, 분모가 너무 작아 왜곡되는 것을 막기 위한 최소 임계값 정책 필요).
* **저장 위치:** `model_update_weekly_stat_snapshot.rising_star_json` 내부 객체로 생성.

---

## 5. Evidence DB Schema (Reconciled)

> Sourced from `evidenceDBDiagram.png` (ERD) + `docs/architecture/data-architecture.md`.
> Reconciliation decisions (2026-03-18):
> - D1: FK naming follows `data-architecture.md` (`document_id`, `paragraph_id`, `evidence_paragraph_id`)
> - D2: `books` keeps `source_type`, `source_url`, `handbook_section`
> - D3: `paragraph_chunks` keeps all concept-linkage and cost-tracking columns
> - D4: `paragraph_embeddings` keeps `handbook_topic`
> - D5: `evidence_metadata` kept (not in ERD, confirmed intentional)

### `books`
> Logical name in `data-architecture.md`: `documents`

| Column | Type | Notes |
|--------|------|-------|
| id | bigserial | PK |
| title | text | |
| author | text | |
| source_path | text | |
| source_type | varchar(50) | pdf/html/markdown |
| source_url | text | |
| handbook_section | varchar(50) | basics/advanced |
| processing_status | text | pending/processing/completed/failed |
| total_paragraphs | int | |
| paragraphs_processed | int | default 0 |
| llm_tokens_used | int | default 0 |
| llm_cost_cents | numeric(10,4) | default 0 |
| created_at | timestamptz | |

---

### `chapters`
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial | PK |
| document_id | bigint | FK → books.id |
| chapter_number | int | |
| title | text | |
| start_page | int | |
| end_page | int | |
| level | int | default 1 |
| parent_chapter_id | bigint | FK → chapters.id (self-referential) |
| detection_method | varchar(50) | |
| created_at | timestamptz | |

---

### `sections`
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial | PK |
| document_id | bigint | FK → books.id |
| chapter_id | bigint | FK → chapters.id |
| section_number | int | |
| title | text | NOT NULL |
| level | int | default 1 |
| parent_section_id | bigint | FK → sections.id (self-referential) |
| detection_method | varchar(50) | default 'llm' |
| created_at | timestamptz | |

---

### `idea_groups`
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial | PK |
| canonical_idea_text | text | NOT NULL; KEY LINKAGE to GraphDB |
| created_at | timestamptz | |

---

### `paragraph_chunks`
> Logical name in `data-architecture.md`: `evidence_paragraphs`

| Column | Type | Notes |
|--------|------|-------|
| id | bigserial | PK |
| document_id | bigint | FK → books.id |
| chapter_id | bigint | FK → chapters.id |
| section_id | bigint | FK → sections.id |
| page_number | int | |
| paragraph_index | int | |
| chapter_paragraph_index | int | |
| body_text | text | NOT NULL |
| paragraph_hash | text | |
| simhash64 | bigint | |
| idea_group_id | bigint | FK → idea_groups.id |
| extracted_concept | varchar(200) | Denormalized from idea_groups; **CRITICAL: Writer Agent query** |
| extraction_confidence | numeric(3,2) | |
| importance_score | numeric(3,2) | |
| sampling_weight | numeric(3,2) | |
| cluster_id | int | |
| is_representative | boolean | default false |
| llm_tokens_used | int | |
| llm_cost_cents | numeric(10,4) | |
| llm_provider | varchar(50) | |
| created_at | timestamptz | |

---

### `key_ideas`
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial | PK |
| paragraph_id | bigint | FK → paragraph_chunks.id |
| document_id | bigint | FK → books.id |
| core_idea_text | text | NOT NULL |
| idea_group_id | bigint | FK → idea_groups.id |
| created_at | timestamptz | |

---

### `evidence_metadata`
> Not in ERD; confirmed intentional.

| Column | Type | Notes |
|--------|------|-------|
| id | bigserial | PK |
| evidence_paragraph_id | bigint | FK → paragraph_chunks.id |
| extract_type | varchar(50) | core_summary/supporting_detail/counterpoint/example |
| keywords | jsonb | |
| entities | jsonb | |
| handbook_topic | varchar(100) | |
| handbook_subtopic | varchar(100) | |
| judge_originality | numeric(3,2) | |
| judge_depth | numeric(3,2) | |
| judge_technical_accuracy | numeric(3,2) | |

---

### `paragraph_embeddings`
> Logical name in `data-architecture.md`: `document_embeddings`

| Column | Type | Notes |
|--------|------|-------|
| id | bigserial | PK |
| evidence_paragraph_id | bigint | FK → paragraph_chunks.id |
| document_id | bigint | FK → books.id |
| embedding | vector(1536) | OpenAI text-embedding-3-small |
| body_text | text | Denormalized for fast retrieval |
| handbook_topic | varchar(100) | |
| model | text | default 'text-embedding-3-small' |
| embedding_cost_cents | numeric(10,4) | |
| created_at | timestamptz | |

---

### `processing_progress`
| Column | Type | Notes |
|--------|------|-------|
| id | serial | PK |
| document_id | int | FK → books.id |
| chapter_id | bigint | FK → chapters.id |
| page_number | int | |
| processing_unit | varchar(50) | default 'page' (page/chapter) |
| status | varchar(50) | |
| error_message | text | |
| attempt_count | int | |
| last_attempt_at | timestamptz | |
| completed_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `knowledge_verification_contributors`
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial | PK |
| name | text | NOT NULL UNIQUE |
| active | boolean | default true |
| email | text | |
| github_username | text | |
| contributions_count | int | default 0 |
| joined_at | timestamptz | |
| last_contribution_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### Relationships

- `chapters.document_id` → `books.id`
- `chapters.parent_chapter_id` → `chapters.id` *(self-referential)*
- `sections.document_id` → `books.id`
- `sections.chapter_id` → `chapters.id`
- `sections.parent_section_id` → `sections.id` *(self-referential)*
- `paragraph_chunks.document_id` → `books.id`
- `paragraph_chunks.chapter_id` → `chapters.id`
- `paragraph_chunks.section_id` → `sections.id`
- `paragraph_chunks.idea_group_id` → `idea_groups.id`
- `key_ideas.paragraph_id` → `paragraph_chunks.id`
- `key_ideas.document_id` → `books.id`
- `key_ideas.idea_group_id` → `idea_groups.id`
- `evidence_metadata.evidence_paragraph_id` → `paragraph_chunks.id`
- `paragraph_embeddings.evidence_paragraph_id` → `paragraph_chunks.id`
- `paragraph_embeddings.document_id` → `books.id`
- `processing_progress.document_id` → `books.id`
- `processing_progress.chapter_id` → `chapters.id`