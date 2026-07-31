# 단계별 컬럼 작성 주체 명세 (기준일: 2026-04-07)

## 전체 흐름

```
[Stage 0] 외부 수집기: 중복 체크
[Stage 1] 외부 수집기: article_raw INSERT
[Stage 2] 백엔드:      user_article_state INSERT
[Stage 3] 백엔드:      user_article_ai_state 프리생성 (PENDING)
            ↓ 에이전트 호출 시 프롬프트 컨텍스트 주입
            │  - user_article_state_id
            │  - user_id
            │  - article 내용 (title, url, content_raw 등)
            │  - allowed_entities 후보 목록
            ↓
[Stage 4] 에이전트:    agent_json_raw UPDATE
[Stage 5] 백엔드 워커: 분리 컬럼 UPDATE + 상태 전이
```

---

## Stage 0 — 외부 수집기: 중복 체크 (백엔드 외부)

**주체:** RSS 수집기 / 크롤러 (백엔드가 아님)

| 컬럼 | 방법 |
|---|---|
| `representative_key_hash` | 1순위 — UNIQUE 제약, 충돌 시 INSERT 스킵 |
| `guid_hash` | RSS GUID 기반 체크 |
| `url_hash` | 원본 URL 체크 |
| `normalized_url_hash` | 정규화 URL 체크 |
| `canonical_url_hash` | canonical URL 체크 |
| `content_hash` | 내용 해시 체크 (동일 내용 다른 URL 감지) |

> **핵심:** `representative_key`가 유일 기준. 나머지는 보조.
> INSERT 시 `ON CONFLICT (representative_key_hash) DO NOTHING` 패턴 사용.

---

## Stage 1 — 외부 수집기: `content.article_raw` INSERT

**주체:** RSS 수집기 / 크롤러

| 컬럼 | 필수 여부 | 설명 |
|---|---|---|
| `id` | 필수 | UUID v7 생성 |
| `source_id` | 필수 | FK → content.source |
| `title` | 필수 | 기사 제목 |
| `url` | 필수 | 원본 URL |
| `representative_key` | 필수 | 중복 기준 키 (보통 `url` 또는 `guid`) |
| `published_at` | 필수 | 발행 시각 |
| `guid` | 선택 | RSS GUID |
| `normalized_url` | 선택 | 정규화 URL |
| `canonical_url` | 선택 | canonical URL |
| `content_raw` | 선택 | HTML 원문 |
| `external_storage_key` | 선택 | S3 등 외부 저장 키 |
| `language` | 선택 | 언어 코드 |
| `author` | 선택 | 저자 |
| `image_url` | 선택 | 썸네일 URL |
| `storage_state` | 자동 | DEFAULT `'ACTIVE'` |
| `fetched_at` | 자동 | DEFAULT now() |
| `created_at` / `updated_at` | 자동 | DEFAULT now() |

> `url_hash`, `guid_hash`, `normalized_url_hash`, `canonical_url_hash`, `representative_key_hash`는 GENERATED 컬럼 — DB가 자동 계산.

---

## Stage 2 — 백엔드: `content.user_article_state` INSERT

**주체:** 백엔드

| 컬럼 | 필수 여부 | 설명 |
|---|---|---|
| `id` | 필수 | UUID v7 |
| `user_id` | 필수 | FK → core.app_user |
| `article_raw_id` | 필수 | FK → content.article_raw |
| `representative_entity_id` | 선택 | 초기 엔터티 매핑 (없으면 NULL) |
| `side_category_id` | 선택 | 보조 카테고리 |
| `discovered_at` | 선택 | DEFAULT now() |
| `meta_json` | 선택 | 기타 메타 |
| `is_high_impact` | 자동 | DEFAULT false |
| `is_hidden` | 자동 | DEFAULT false |
| `impact_score` | 자동 | DEFAULT 0 |
| `created_at` / `updated_at` | 자동 | DEFAULT now() |

---

## Stage 3 — 백엔드: `content.user_article_ai_state` 프리생성

**주체:** 백엔드 (에이전트 호출 전 반드시 먼저 생성)

| 컬럼 | 필수 여부 | 값 |
|---|---|---|
| `id` | 필수 | UUID v7 |
| `user_id` | 필수 | user_article_state의 user_id 동일 |
| `user_article_state_id` | 필수 | FK → content.user_article_state |
| `ai_status` | 필수 | `'PENDING'` |
| `prompt_template_version_id` | 선택 | 사용할 프롬프트 버전 |
| `run_log_id` | 선택 | 실행 로그 ID |

```sql
INSERT INTO content.user_article_ai_state (id, user_id, user_article_state_id, ai_status)
VALUES (:id, :user_id, :user_article_state_id, 'PENDING')
ON CONFLICT (user_article_state_id) DO NOTHING;
```

> 나머지 컬럼은 모두 NULL. 에이전트가 채울 것들을 미리 넣지 않는다.

### 에이전트 호출 시 프롬프트 컨텍스트 주입

프리생성 직후 백엔드가 에이전트를 호출한다. 에이전트는 DB를 직접 조회하거나 FK를 추적하지 않는다.
백엔드가 아래 두 단계로 데이터를 모아 프롬프트에 담아 전달한다.

#### 프롬프트 템플릿 선택

트리거/잡 큐에서 `user_article_state_id` 하나를 받아 아래 데이터를 모아 프롬프트에 추가한다.

- **기사 내용**: `user_article_state` → `article_raw` JOIN → `title`, `url`, `content_raw`, `published_at`
- **식별자**: `user_article_state_id`, `user_id` (UPDATE 조건 + idempotency_key 생성용)
- **allowed_entities**: `전체 활성 엔터티 목록` (`id`, `page`, `category_id`, `category_name`, `name`)

---

## Stage 4 — 에이전트: `agent_json_raw` UPDATE

**주체:** AI 에이전트

### 직접 작성 허용 컬럼

| 컬럼 | 필수 여부 | 설명 |
|---|---|---|
| `agent_json_raw` | **필수** | JSON 계약 v0.3 형식 전체 |
| `ai_model_name` | 선택 | 예: `claude-sonnet-4-6` |
| `ai_processed_at` | 선택 | 처리 완료 시각 |
| `prompt_template_version_id` | 선택 | 프리생성 시 미설정인 경우에만 |
| `run_log_id` | 선택 | 프리생성 시 미설정인 경우에만 |

### 작성 금지 컬럼 (백엔드 전용)

`representative_entity_id`, `representative_entity_page`, `representative_entity_category_id`, `representative_entity_category_name`, `representative_entity_name`, `ai_summary`, `ai_score`, `ai_classification_json`, `ai_tags_json`, `ai_snippets_json`, `ai_evidence_json`, `ai_structured_extraction_json`, `ai_status`

### `agent_json_raw` 필수 키 (하나라도 누락 시 거부)

```
idempotency_key                          → "uas:{lower(user_article_state_id)}"
version                                  → "0.3"
representative_entity.id                 → tracked_entity.id 또는 null
representative_entity.page               → entity_page_enum 값
representative_entity.category_id
representative_entity.category_name
representative_entity.name
ai_summary                               → 한 줄 요약 문자열
ai_score                                 → 1~5 정수
ai_classification_json.final_path
ai_classification_json.candidates        → 빈 배열도 허용
ai_classification_json.decision_reason
side_category_code                       → "CASE_STUDY" | "APPLIED_RESEARCH" | null
ai_tags_json                             → 배열 (TAG / KEYWORD 구분)
ai_snippets_json.why_it_matters
ai_snippets_json.key_points              → 배열
ai_snippets_json.risk_notes              → 배열
ai_evidence_json.evidence_items          → 배열
ai_structured_extraction_json.source
ai_structured_extraction_json.review
```

### `agent_json_raw` 샘플

```json
{
  "idempotency_key": "uas:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "version": "0.3",
  "representative_entity": {
    "id": "0195f300-1001-7000-b000-000000000002",
    "page": "CASE_STUDIES",
    "category_id": "0195f300-2001-7000-a000-000000000022",
    "category_name": "Anthropic",
    "name": "Claude 3.7 Sonnet"
  },
  "ai_summary": "Law firm deploys Claude 3.7 for contract analysis with 90% accuracy.",
  "ai_score": 4,
  "ai_classification_json": {
    "final_path": {
      "page": "CASE_STUDIES",
      "category_name": "Anthropic",
      "entity_name": "Claude 3.7 Sonnet"
    },
    "candidates": [
      {
        "page": "CASE_STUDIES",
        "category_name": "Anthropic",
        "entity_name": "Claude 3.7 Sonnet",
        "confidence": 0.92
      }
    ],
    "decision_reason": "article describes real-world deployment of Claude 3.7"
  },
  "side_category_code": "CASE_STUDY",
  "ai_tags_json": [
    { "kind": "TAG", "value": "claude-3.7-sonnet" },
    { "kind": "TAG", "value": "anthropic" },
    { "kind": "KEYWORD", "value": "case_studies", "frequency": 6, "confidence": 0.88 }
  ],
  "ai_snippets_json": {
    "why_it_matters": "Shows Claude effectiveness for complex document understanding.",
    "key_points": ["90% accuracy on contract analysis", "Production deployment validated"],
    "risk_notes": ["Results may vary across legal domains"]
  },
  "ai_evidence_json": {
    "evidence_items": [
      {
        "kind": "quote",
        "text": "Law firm deploys Claude 3.7 for contract analysis with 90% accuracy.",
        "url": "https://example.com/article-52",
        "source_name": "Tech Blog",
        "published_at": "2026-04-01T09:00:00+00:00"
      }
    ]
  },
  "ai_structured_extraction_json": {
    "source": { "name": "Tech Blog", "type": "RSS" },
    "review": { "type": "Case Study", "reviewer": null, "comment": null }
  }
}
```

> `side_category_code` 허용값: `"CASE_STUDY"` | `"APPLIED_RESEARCH"` | `null`
> 해당 없으면 `null`. 백엔드 워커가 이 값으로 `content.side_category` 테이블 조회 → `user_article_state.side_category_id` 세팅.

---

## Stage 5 — 백엔드 워커: 분리 컬럼 UPDATE + 상태 전이

**주체:** 백엔드 파서 워커

`agent_json_raw` 파싱 후 아래 컬럼 UPDATE:

| 컬럼 | 소스 |
|---|---|
| `representative_entity_id` | `agent_json_raw.representative_entity.id` 검증 후 |
| `representative_entity_page` | id 정본 기준 |
| `representative_entity_category_id` | id 정본 기준 |
| `representative_entity_category_name` | id 정본 기준 |
| `representative_entity_name` | id 정본 기준 (`tracked_entity.name` 동기화) |
| `ai_summary` | `agent_json_raw.ai_summary` |
| `ai_score` | `agent_json_raw.ai_score` |
| `ai_classification_json` | `agent_json_raw.ai_classification_json` |
| `ai_tags_json` | `agent_json_raw.ai_tags_json` |
| `ai_entities_json` | 항상 `NULL` (deprecated) |
| `ai_snippets_json` | `agent_json_raw.ai_snippets_json` |
| `ai_evidence_json` | `agent_json_raw.ai_evidence_json` |
| `ai_structured_extraction_json` | `agent_json_raw.ai_structured_extraction_json` |
| `ai_status` | 성공 → `'SUCCESS'` / 실패 → `'FAILED'` |

### 엔터티 검증 규칙
1. `id` 있음 → `tracked_entity`에서 정본 조회, page/category/name 불일치 시 → `FAILED`
2. `id = null` → `name` 정확일치 1건만 허용, 0건/복수건 → `FAILED` + 수동수정 대상

---

## 진행 현황

| 항목 | 상태 |
|---|---|
| DDL (agent_json_raw 컬럼/제약/인덱스) | 완료 |
| JSON 계약 v0.3 정의 | 완료 |
| 에이전트 역할 분리 정책 | 확정 |
| **백엔드 파서/분리 반영 워커** | **진행 중** |
| 실패 재처리 정책 코드화 | 미결 |
