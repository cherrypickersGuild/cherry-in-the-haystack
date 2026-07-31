# Agent DB Write 가이드 (개발자용) - 2026-04-01

## 0. 범위
- 대상 테이블:
- `content.user_article_state`
- `content.user_article_ai_state`
- 목적:
- 에이전트/백엔드가 각 작업 단계에서 어떤 컬럼을 써야 하는지 고정한다.
- 제외:
- 승급 정책(키워드 -> tracked_entity)은 본 문서 범위에서 제외한다.

## 1. 기본 원칙
- `user_article_ai_state` 행은 백엔드가 먼저 만든다.
- 에이전트는 원칙적으로 `agent_json_raw` 중심으로만 기록한다.
- 분리 컬럼(`ai_summary`, `ai_score`, 각 JSONB)은 백엔드 파서/워커가 기록한다.
- 한 기사(`user_article_state_id`)당 `user_article_ai_state`는 1행만 유지한다.
- 대표 엔터티 선택은 자유입력이 아니라 백엔드가 준 후보 목록 기반으로 수행한다.

## 2. 단계별 작성 주체/컬럼

### 2.1 백엔드: Article State 생성 시
테이블: `content.user_article_state`
- 필수 작성:
- `id`
- `user_id`
- `article_raw_id`
- 선택 작성:
- `representative_entity_id`
- `side_category_id`
- `discovered_at`
- `meta_json`

테이블: `content.user_article_ai_state` (프리생성)
- 필수 작성:
- `id`
- `user_id`
- `user_article_state_id`
- `ai_status` (`PENDING`)
- 선택 작성:
- `prompt_template_version_id`
- `run_log_id`

### 2.2 에이전트: Raw 결과 기록 시
테이블: `content.user_article_ai_state`
- 작성 허용:
- `agent_json_raw`
- `ai_model_name`
- `ai_processed_at`
- (선택) `prompt_template_version_id`
- (선택) `run_log_id`

- 작성 금지(백엔드 전용):
- `representative_entity_id`
- `representative_entity_page`
- `representative_entity_category_id`
- `representative_entity_category_name`
- `representative_entity_name`
- `ai_summary`
- `ai_score`
- `ai_classification_json`
- `ai_tags_json`
- `ai_entities_json` (deprecated, 항상 `NULL`)
- `ai_snippets_json`
- `ai_evidence_json`
- `ai_structured_extraction_json`
- `ai_status` 최종 전이(`SUCCESS/FAILED`)

### 2.3 백엔드: Raw 파싱/분리 반영 시
테이블: `content.user_article_ai_state`
- `agent_json_raw` 파싱 후 아래 컬럼 업데이트:
- `representative_entity_id`
- `representative_entity_page`
- `representative_entity_category_name`
- `representative_entity_name`
- `ai_summary`
- `ai_score`
- `ai_classification_json`
- `ai_tags_json`
- `ai_entities_json` (deprecated, 항상 `NULL`)
- `ai_snippets_json`
- `ai_evidence_json`
- `ai_structured_extraction_json`
- 상태 갱신:
- 성공 시 `ai_status='SUCCESS'`
- 실패 시 `ai_status='FAILED'`

### 2.4 대표 엔터티 선택 규칙 (논의 확정)
- 백엔드가 에이전트에게 후보 목록을 제공한다.
- 후보 항목 형식: `id + page + category_id + category_name + name`
- 에이전트는 최종 선택 결과에 `id`, `page`, `category_id`, `category_name`, `name`을 모두 채워 반환한다.
- 백엔드 판정 우선순위는 `id -> name`이다.

- 상세 처리:
- 1) `id`가 있으면 해당 `id`의 정본(`page/category_id/category_name/name`)을 기준으로 저장한다.
- 2) 에이전트가 보낸 `page/category_id/category_name/name`이 `id` 정본과 다르면 자동 반영하지 않고 `FAILED` + 수동수정 대상으로 보낸다.
- 3) `id`가 `null`일 때만 `name` 매칭을 시도한다.
- 4) `name` 정확일치 1건이면 반영, 0건/복수건이면 자동 반영하지 않고 수동수정 대상으로 보낸다.
- 5) 에이전트는 후보 목록 밖의 임의 `id/page/category_id/category_name/name` 조합을 만들지 않는다.

- 에이전트 입력 예시(프롬프트 컨텍스트):
```json
{
  "allowed_entities": [
    {
      "id": "0195f2ce-4a3b-7c96-a42b-2f0dbf4f3003",
      "page": "MODEL UPDATES",
      "category_id": "0195f2ce-5b6d-7d2c-b8d0-1a7d44f64001",
      "category_name": "OpenAI Family",
      "name": "GPT-5.4"
    }
  ]
}
```

## 3. agent_json_raw 포맷 (고정 계약, 필드 생략 금지)
- `agent_json_raw`는 JSON object여야 한다.
- 아래 키는 모두 항상 포함한다. (값이 없으면 `null` 또는 빈 배열 `[]`/빈 객체 `{}` 사용)
- `representative_entity.id`는 `content.tracked_entity.id`를 의미한다.
- 즉, 임의 UUID를 쓰면 안 되고, 매칭된 tracked entity의 실제 PK UUID를 써야 한다.
- tracked entity 미매칭 시에만 `representative_entity.id = null`.

```json
{
  "idempotency_key": "uas:{lower(user_article_state_id)}",
  "version": "0.3",
  "representative_entity": {
    "id": "0195f2ce-4a3b-7c96-a42b-2f0dbf4f3003",
    "page": "MODEL UPDATES",
    "category_id": "0195f2ce-5b6d-7d2c-b8d0-1a7d44f64001",
    "category_name": "OpenAI Family",
    "name": "GPT-5.4"
  },
  "ai_summary": "OpenAI announced GPT-5.4 with stronger coding reliability.",
  "ai_score": 4,
  "ai_classification_json": {
    "final_path": {
      "page": "MODEL UPDATES",
      "category_name": "OpenAI Family",
      "entity_name": "GPT-5.4"
    },
    "candidates": [
      {
        "page": "MODEL UPDATES",
        "category_name": "OpenAI Family",
        "entity_name": "GPT-5.4",
        "confidence": 0.93
      }
    ],
    "decision_reason": "title and source strongly match tracked entity"
  },
  "ai_tags_json": [
    { "kind": "TAG", "value": "gpt-5.4" },
    { "kind": "TAG", "value": "release" },
    {
      "kind": "KEYWORD",
      "value": "context window routing",
      "frequency": 7,
      "confidence": 0.81
    }
  ],
  "ai_snippets_json": {
    "why_it_matters": "Improves production stability for agent pipelines.",
    "key_points": ["model update announced", "benchmark claim included"],
    "risk_notes": ["rollout scope not fully specified"]
  },
  "ai_evidence_json": {
    "evidence_items": [
      {
        "kind": "quote",
        "text": "GPT-5.4 improves coding reliability in production.",
        "url": "https://example.com/openai-gpt-5-4",
        "source_name": "OpenAI Blog",
        "published_at": "2026-03-20T00:00:00Z"
      }
    ]
  },
  "ai_structured_extraction_json": {
    "source": {
      "name": "OpenAI Blog",
      "type": "RSS"
    },
    "review": {
      "type": "Announcement",
      "reviewer": null,
      "comment": null
    }
  }
}
```

### 3.1 필수 키 체크리스트 (누락 금지)
- `idempotency_key`
- `version`
- `representative_entity.id`
- `representative_entity.page`
- `representative_entity.category_id`
- `representative_entity.category_name`
- `representative_entity.name`
- `ai_summary`
- `ai_score`
- `ai_classification_json.final_path`
- `ai_classification_json.candidates`
- `ai_classification_json.decision_reason`
- `ai_tags_json`
- `ai_snippets_json.why_it_matters`
- `ai_snippets_json.key_points`
- `ai_snippets_json.risk_notes`
- `ai_evidence_json.evidence_items`
- `ai_structured_extraction_json.source`
- `ai_structured_extraction_json.review`
### 3.2 `version` 덮어쓰기 규칙 (필수)
- `version`은 `major.minor` 문자열(`0.3`, `0.4` 등)로 기록한다.
- 같은 `idempotency_key`(같은 기사) 기준으로 아래 규칙을 적용한다.
- incoming `version` > stored `version`: 덮어쓰기 허용.
- incoming `version` = stored `version`: 덮어쓰기 허용(최신 `ai_processed_at` 기준 last-write-wins).
- incoming `version` < stored `version`: 거부(하위 버전 역덮어쓰기 금지).

## 4. 제약/검증 체크포인트
- `agent_json_raw`는 object여야 한다.
- `agent_json_raw.idempotency_key`는 `concat('uas:', lower(user_article_state_id::text))`와 같아야 한다.
- `agent_json_raw.version`은 `major.minor` 형식이어야 한다.
- `ai_score`는 최종 저장 시 `1..5` 정수여야 한다.
- `representative_entity.id`가 `null`이 아니면 반드시 `content.tracked_entity.id`로 존재해야 한다.
- `representative_entity.id`가 있을 때는 `id` 정본 기준으로 `page/category_id/category_name/name` 일치 검증을 통과해야 한다.
- `ai_classification_json.candidates`, `ai_tags_json`, `ai_snippets_json.key_points`, `ai_snippets_json.risk_notes`, `ai_evidence_json.evidence_items`는 키를 생략하지 않는다.
- `ai_tags_json[*]`는 object여야 하며, 최소 `kind`, `value` 키를 가진다.
- `ai_tags_json[*].kind`는 `TAG` 또는 `KEYWORD`만 허용한다.
- `kind=KEYWORD` 항목은 `frequency`(정수), `confidence`(0~1)를 같이 기록한다.
- 대표 엔터티 스냅샷 제약:
- `representative_entity_id IS NULL`이면 `page/category_id/category_name/name`도 모두 `NULL`.
- `representative_entity_id IS NOT NULL`이면 `page/category_id/category_name/name` 모두 필수.
- 이름 정합성 트리거:
- `representative_entity_id`가 있으면 `representative_entity_name = tracked_entity.name`.

## 5. 권장 SQL 패턴

### 5.1 백엔드 프리생성
```sql
INSERT INTO content.user_article_ai_state (
    id, user_id, user_article_state_id, ai_status, prompt_template_version_id, run_log_id
)
VALUES (
    :id, :user_id, :user_article_state_id, 'PENDING', :prompt_template_version_id, :run_log_id
)
ON CONFLICT (user_article_state_id)
DO NOTHING;
```

### 5.2 에이전트 raw 업데이트
```sql
UPDATE content.user_article_ai_state
SET
    agent_json_raw = :agent_json_raw,
    ai_model_name = :ai_model_name,
    ai_processed_at = :ai_processed_at
WHERE user_article_state_id = :user_article_state_id
  AND user_id = :user_id;
```
- 실행 전 검증:
- `:idempotency_key`를 `concat('uas:', lower(:user_article_state_id::text))`로 생성하고, `agent_json_raw.idempotency_key`에 같은 값을 넣는다.
- `version` 비교 규칙: 기존 raw `version`보다 낮으면 업데이트 거부.

### 5.3 백엔드 분리 반영 + 성공 처리
```sql
UPDATE content.user_article_ai_state
SET
    representative_entity_id = :representative_entity_id,
    representative_entity_page = :representative_entity_page,
    representative_entity_category_id = :representative_entity_category_id,
    representative_entity_category_name = :representative_entity_category_name,
    representative_entity_name = :representative_entity_name,
    ai_summary = :ai_summary,
    ai_score = :ai_score,
    ai_classification_json = :ai_classification_json,
    ai_tags_json = :ai_tags_json,
    ai_entities_json = NULL,
    ai_snippets_json = :ai_snippets_json,
    ai_evidence_json = :ai_evidence_json,
    ai_structured_extraction_json = :ai_structured_extraction_json,
    ai_status = 'SUCCESS'
WHERE user_article_state_id = :user_article_state_id
  AND user_id = :user_id;
```

## 6. 운영 메모
- 에이전트가 `id/user_id/user_article_state_id`를 직접 생성/삽입하지 않는다(프리생성 전제).
- 에이전트 재시도는 같은 row를 덮어써도 된다.
- 최종 품질/검증 책임은 백엔드 분리 단계에서 가진다.
