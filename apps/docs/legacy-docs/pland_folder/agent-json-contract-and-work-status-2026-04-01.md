# Agent JSON Raw 적재 계약/업무 현황 (기준일: 2026-04-01, Contract v0.3)

## 0. 목적
- 에이전트는 `content.user_article_ai_state.agent_json_raw` 중심으로만 기록한다.
- 백엔드 워커가 `agent_json_raw`를 파싱해 각 컬럼(`ai_summary`, `ai_score`, JSONB 컬럼들)으로 분리 반영한다.
- 본 문서는 확정 규칙, JSON 포맷, DB 반영 방식, 진행상황을 한 번에 정리한다.

## 1. 운영 모델 (확정)
- 에이전트 쓰기:
- `user_article_ai_state`에 기본 식별 컬럼 + `agent_json_raw`만 쓰기.
- 분리 컬럼(`ai_summary`, `ai_score`, `ai_classification_json`, `ai_tags_json`, `ai_snippets_json`, `ai_evidence_json`, `ai_structured_extraction_json`)은 에이전트가 직접 채우지 않는다.
- `ai_entities_json`은 deprecated로 두고 backend에서 항상 `NULL` 유지한다.
- 백엔드 처리:
- `agent_json_raw`를 검증/파싱 후 분리 컬럼을 `UPDATE`.
- 처리 성공 시 `ai_status='SUCCESS'`, 실패 시 `ai_status='FAILED'`.

## 2. 스키마 반영 상태
- 반영 파일:
- `docs/architecture/ddl-v1.1.sql`
- `apps/docs/ddl-v1.1.sql`
- 반영 내용:
- `content.user_article_ai_state.agent_json_raw JSONB NULL` 추가
- `chk_user_article_ai_state_agent_raw_is_object` 제약 추가
- `idx_user_article_ai_state_agent_raw` GIN 인덱스 추가
- `content.entity_category` 추가 (page별 중간 카테고리 사전)
- `content.tracked_entity_placement` 추가 (엔터티의 page/category 정본 매핑)

## 3. 핵심 도메인 규칙 (확정)
- 대표 엔터티 사전: `content.tracked_entity` 전역 테이블
- 기사 분류 3단계:
- 최상위: `representative_entity_page`
- 중간: `representative_entity_category_id` + `representative_entity_category_name`
- 최하위: `representative_entity_name` (`tracked_entity.name`과 정합성 필요)
- 사이드 카테고리: `user_article_state.side_category_id` 단일 1개
- `ai_score`: 1~5 정수
- 유지 필드: `ai_classification_json.candidates`, `ai_classification_json.decision_reason`
- 제외 필드: `patch_notes_hint`
- 키워드 승급: 수동, 미승급 키워드는 `ai_tags_json`의 `kind=KEYWORD`로 저장

## 4. 에이전트 입력 JSON 포맷 (agent_json_raw)
```json
{
  "idempotency_key": "uas:{lower(user_article_state_id)}",
  "version": "0.3",
  "representative_entity": {
    "id": "{tracked_entity_id_or_null}",
    "page": "MODEL UPDATES",
    "category_id": "{entity_category_id_or_null}",
    "category_name": "OpenAI Family",
    "name": "GPT-5.4"
  },
  "ai_summary": "string",
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
    "decision_reason": "string"
  },
  "ai_tags_json": [
    { "kind": "TAG", "value": "gpt" },
    { "kind": "TAG", "value": "release" },
    {
      "kind": "KEYWORD",
      "value": "context window routing",
      "frequency": 7,
      "confidence": 0.81
    }
  ],
  "ai_snippets_json": {
    "why_it_matters": "string",
    "key_points": ["string"],
    "risk_notes": ["string"]
  },
  "ai_evidence_json": {
    "evidence_items": [
      {
        "kind": "quote",
        "text": "string",
        "url": "https://...",
        "source_name": "string",
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
  },
  "meta": {
    "prompt_template_version_id": "{prompt_template_version_id_or_null}",
    "run_log_id": "{run_log_id_or_null}"
  }
}
```

## 5. 에이전트 DB 쓰기 규칙
- 에이전트는 아래 컬럼만 직접 작성:
- `id`
- `user_id`
- `user_article_state_id`
- `ai_status` (`PENDING` 권장)
- `agent_json_raw`
- `ai_model_name` (선택)
- `ai_processed_at` (선택)
- `prompt_template_version_id` (선택)
- `run_log_id` (선택)
- 전제: `user_article_state_id`에 해당하는 `content.user_article_state` row가 먼저 존재해야 한다(FK 제약).

- 에이전트는 아래 분리 컬럼을 직접 작성하지 않음:
- `ai_summary`
- `ai_score`
- `ai_classification_json`
- `ai_tags_json`
- `ai_entities_json` (deprecated, 항상 `NULL`)
- `ai_snippets_json`
- `ai_evidence_json`
- `ai_structured_extraction_json`

## 6. 백엔드 분리 반영 규칙
1. `agent_json_raw` object 검증
2. JSON 키 존재/타입 검증
3. 대표 엔터티 정합성 검증 (`id -> name` 우선순위)
- 백엔드가 에이전트에 `id + page + category_id + category_name + name` 후보 목록을 제공한다.
- `representative_entity.id`가 있으면 해당 `id` 정본(`page/category_id/category_name/name`) 기준으로 판정/저장한다.
- `id` 정본과 에이전트 반환 `page/category_id/category_name/name`이 불일치하면 자동 반영하지 않고 `FAILED` 처리 후 수동수정 대상으로 보낸다.
- `id`가 `null`인 경우에만 `name` 정확일치 매칭을 수행한다(1건만 허용, 0건/복수건은 수동수정).
4. 아래 컬럼 업데이트
- 대표 엔터티 스냅샷 5필드
- `ai_summary`, `ai_score`
- 분리 JSONB 5종 (`ai_classification_json`, `ai_tags_json`, `ai_snippets_json`, `ai_evidence_json`, `ai_structured_extraction_json`)
- `ai_entities_json`은 `NULL`로 유지(deprecated)
5. 상태 전이
- 성공: `ai_status='SUCCESS'`
- 실패: `ai_status='FAILED'` + 오류 로그

## 7. Notion 컬럼 매핑 점검
- Score (1~5): `ai_score`
- Name (글 제목): `content.article_raw.title`
- AI Summary: `ai_summary`
- Why it matters: `ai_snippets_json.why_it_matters`
- URL: `content.article_raw.url`
- Category: `representative_entity_page/category_name/name` + `ai_classification_json.final_path`
- Reviewer: `ai_structured_extraction_json.review.reviewer`
- Type: `ai_structured_extraction_json.review.type`
- Comment: `ai_structured_extraction_json.review.comment`
- Tags: `ai_tags_json`
- Created Time: `user_article_state.discovered_at`
- Source: `ai_structured_extraction_json.source` + `article_raw.source_id` 조인
- Published at: `content.article_raw.published_at`

## 8. 권한 모델
- 에이전트 계정:
- `SELECT`: `content.tracked_entity`, `content.side_category`, `content.article_raw`, `core.prompt_template`, `core.prompt_template_version`
- `INSERT/UPDATE`: `content.user_article_ai_state` (원천 JSON 기록 범위)
- 백엔드 워커 계정:
- `UPDATE`: `content.user_article_ai_state` (분리 컬럼 반영)
- 필요 시 `UPDATE`: `content.user_article_state`

## 9. 업무 진행사항
### 완료
- `agent_json_raw` 컬럼/체크제약/인덱스 DDL 반영 완료
- 에이전트 입력 JSON 포맷 v0.3 정리 완료
- 원천(JSON raw) 저장과 분리(backend) 역할 분리 정책 확정

### 진행 중
- 백엔드 파서/분리 반영 워커 구현
- 실패 재처리 정책(백오프/최대횟수) 코드화

### 미결정
- `agent_json_raw.idempotency_key`를 별도 컬럼으로 승격할지 여부
- 분리 실패 건의 운영 UI(재처리/무시) 제공 방식

## 10. 체크리스트
- [ ] 에이전트는 `agent_json_raw`에만 AI 결과 기록
- [ ] `ai_score` 값은 raw 내부에서 1~5 정수
- [ ] `candidates`, `decision_reason` 포함
- [ ] `ai_tags_json`에 `TAG`/`KEYWORD`를 구분해 기록
- [ ] `patch_notes_hint` 미사용
- [ ] `side_category`는 최종 1개 규칙 유지
- [ ] 백엔드 분리 후 `ai_status`를 최종 상태로 갱신
