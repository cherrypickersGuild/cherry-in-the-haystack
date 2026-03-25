# 생산됨 vs 미생산 + 즉시 할당표 (분리본)

## 2. 현재 상태: 생산됨 vs 미생산

## 2.1 이미 생산되는 것 (코드 확인됨)
- Writer Agent 결과 JSON 파일  
  `dev/apps/agent/writer_agent/outputs/*.json` (1번 참조)  
  필드: `summary`, `why_it_matters`, `evidence`, `related_concepts`, `references`, `updates`, `patch_notes`

- News Agent 결과 JSON 파일  
  `dev/apps/agent/news_agent/outputs/news_agent_output_*.json` (2번 참조)  
  필드: `title`, `summary`, `importance_score`, `category`, `newsletter_fit`, `tags`, `company` 등

- PDF extractor의 기존 프로토타입 DB write  
  `books`, `paragraph_chunks`, `key_ideas` 등 (3번 참조, 4번 참조)

## 2.1.1 생산 산출물 -> DDL 컬럼 즉시 할당표

### A) Writer Agent (`summary`, `why_it_matters`, `evidence`, `related_concepts`, `references`, `updates`, `patch_notes`)
- `updates`: 이번 생성/수정에서 반영된 변경 항목 목록(제목+본문)
- `patch_notes`(권장 내부명: `change_notes`): 변경사항을 짧게 요약한 한줄 노트 목록
- `summary` -> `company_article_ai_state.ai_summary` (`TEXT`, 1번 참조)
- `why_it_matters` -> `company_article_ai_state.ai_snippets_json.why_it_matters` (`JSONB object` 내부 `string`, 1번 참조)
- `evidence + references` -> `company_article_ai_state.ai_evidence_json` (`JSONB object`, 1번 참조)
- `related_concepts` ->
  - `company_article_ai_state.ai_entities_json.concepts` (`JSONB object` 내부 `array<string>`, 1번 참조)
  - `company_article_ai_state.ai_structured_extraction_json.related_concepts` (`JSONB object` 내부 `array<string>`, 1번 참조)
- `updates` -> `company_article_ai_state.ai_structured_extraction_json.content_updates.updates` (`JSONB object` 내부 `array<object>`, 1번 참조)
- `patch_notes` -> `company_article_ai_state.ai_structured_extraction_json.content_updates.change_notes` (`JSONB object` 내부 `array<string>`, 1번 참조)

주의:
- Writer의 `patch_notes`는 DDL Patchnotes(미읽음 집계)와 다른 개념이다.
- 이름 충돌 방지를 위해 내부 명칭은 `change_notes` 권장.

### B) News Agent (`title`, `summary`, `importance_score`, `category`, `newsletter_fit`, `tags`, `company`)
- `summary` -> `company_article_ai_state.ai_summary` (`TEXT`, 2번 참조)
- `importance_score(1~5)` -> `company_article_ai_state.ai_score(0~100)` 변환 (`NUMERIC(12,4)`, 2번 참조)
- 권장 변환식: `ai_score = importance_score * 20`
- `category` -> `company_article_ai_state.ai_classification_json` (`JSONB object`, resolver를 통해 `category_group_code`, `category_code` 정규화, 2번 참조)
- `tags` -> `company_article_ai_state.ai_tags_json` (`JSONB array<string>`, 2번 참조)
- `company` -> `company_article_ai_state.ai_entities_json.companies` (`JSONB object` 내부 `array<string>`, 2번 참조)
- `newsletter_fit` -> `company_article_ai_state.ai_structured_extraction_json.newsletter_fit` (`JSONB object` 내부 `boolean`, 2번 참조)

### C) PDF extractor (`books`, `paragraph_chunks`, `key_ideas`)
- `paragraph_chunks/key_ideas`는 기사 AI가 근거 생성 시 참조 소스로 사용 가능
- DDL 직접 매핑 대상이라기보다, `ai_evidence_json.paragraph_evidence` 생성의 upstream 데이터 소스  
  (`JSONB object` 내부 `array<object>`, 3번 참조, 4번 참조)
- 직접 `company_article_ai_state` write는 현재 없음

## 2.2 아직 미생산(DDL 직접 적재 기준, 컬럼 단위)

현재는 “직접 INSERT/UPDATE 코드”가 없고, 아래는 컬럼별 입력 소스를 `n번 JSON (항목명)` 형식으로 표시한다.

표기:
- `n번 JSON (항목명)`: 해당 JSON 산출물에서 직접 매핑 가능
- `집계 생성`: JSON 단일 필드가 아니라 DB/기간 집계로 계산
- `규칙 필요`: 카테고리 정규화/가중치 공식 등 별도 규칙 정의 필요
- 공통: 현재 `cherry_platform` 직접 적재 코드는 미연결

### 2.2.1 `company_article_ai_state`
- `id`, `company_id`, `company_article_state_id`: 운영키/조인키(집계 생성)
- `ai_status`: 규칙값(`SUCCESS/FAILED`) (규칙 필요)
- `ai_summary`: `1번 JSON (summary)` 또는 `2번 JSON (summary)`
- `ai_score`: `2번 JSON (importance_score)` -> 0~100 변환(규칙 필요)
- `ai_classification_json`: `2번 JSON (category)` + resolver 정규화(규칙 필요)
- `ai_tags_json`: `2번 JSON (tags)`
- `ai_entities_json`: `1번 JSON (related_concepts)`, `2번 JSON (company)`
- `ai_snippets_json`: `1번 JSON (why_it_matters)`
- `ai_evidence_json`: `1번 JSON (evidence, references)`
- `ai_structured_extraction_json`: `1번 JSON (updates, patch_notes)`, `2번 JSON (newsletter_fit)`
- `prompt_template_version_id`: 별도 템플릿 추적 연결 필요(규칙 필요)
- `run_log_id`: 별도 run_log 연결 필요(규칙 필요)
- `ai_model_name`: 실행 모델명(env/SDK) (집계 생성)
- `ai_processed_at`: 실행시각 (집계 생성)
- `created_at`, `updated_at`: DB 기본값/트리거

### 2.2.2 `patchnote_daily_stat_snapshot`
- `id`, `company_id`, `stat_date`: 집계 생성
- `new_article_count`: 집계 생성(`company_article_state.discovered_at` 기준)
- `new_high_impact_count`: 집계 생성(`is_high_impact` 기준)
- `areas_changed_json`: 집계 생성(카테고리 그룹별 건수)
- `created_at`, `updated_at`: DB 기본값/트리거

### 2.2.3 `highlight_weekly_stat_snapshot`
- `id`, `company_id`, `week_start`, `week_end`: 집계 생성
- `items_this_week`: 집계 생성(주간 기사 수)
- `items_delta_vs_last_week`: 집계 생성(전주 비교)
- `topics_covered_count`: `1번 JSON (related_concepts)` 기반 집계 또는 별도 topics 추출(규칙 필요)
- `covered_topics_json`: `1번 JSON (related_concepts)` 기반 생성(규칙 필요)
- `new_keywords_count`: `2번 JSON (tags)` 기반 생성(규칙 필요)
- `new_keywords_mom_rate`: `2번 JSON (tags)` 기간 비교(집계 생성)
- `new_keywords_json`: `2번 JSON (tags)` 기반 생성
- `trending_keywords_json`: `2번 JSON (tags)` 트렌드 계산(규칙 필요)
- `score_5_items_count`: `2번 JSON (importance_score)` 변환 후 집계 또는 `ai_score` 집계
- `treemap_distribution_json`: `ai_classification_json(category_group)` 집계 생성
- `created_at`, `updated_at`: DB 기본값/트리거

### 2.2.4 `model_update_daily_snapshot`
- `id`, `company_id`, `stat_date`, `category_group_id`, `category_id`: `2번 JSON (category)` + 일자 기준 집계 생성
- `article_count`: 집계 생성(일별 카테고리 건수)
- `high_impact_count`: 집계 생성(고임팩트 건수)
- `score_sum`, `score_avg`: `2번 JSON (importance_score)` 변환 후 집계 생성
- `weighted_score`: 가중치 공식 정의 후 집계 생성(규칙 필요)
- `benchmark_metric_json`: 현재 고정 원천 JSON 없음(규칙 필요/추출기 필요)
- `co_mentioned_terms_json`: `2번 JSON (tags)` 또는 `1번 JSON (related_concepts)` 기반 생성(규칙 필요)
- `created_at`, `updated_at`: DB 기본값/트리거

### 2.2.5 `model_update_weekly_stat_snapshot`
- `id`, `company_id`, `week_start`, `week_end`, `category_group_id`: 집계 생성
- `items_count`: 집계 생성(주간 건수)
- `tracked_company_count`: `2번 JSON (company)` 기반 집계 또는 정의 규칙 필요
- `ranking_metric_label`: 정책값(예: `GPQA Benchmark`) (규칙 필요)
- `lanked_category_json`: Daily 스냅샷 기반 주간 랭킹 집계 생성
- `rising_star_json`: 최근 7일 vs 이전 7일 증감 집계 생성
- `created_at`: DB 기본값

정리:
- 대부분 컬럼은 `1번 JSON`, `2번 JSON`, 또는 집계 생성으로 채울 수 있음.
- 실제 부족한 것은 정규화 규칙/집계 공식/적재 코드(ETL)이다.

## 2.3 참고: Ontology 파이프라인(현재는 참고용)
- 관련 산출물:
  - `output_with_concepts.jsonl`
  - `staging_concepts.json`
  - checkpoint JSON
- 성격:
  - 개념 매칭/지식구조 실험 및 검토용 산출물
  - 현재 문서의 “즉시 DDL 적재 범위”에서는 제외
- 운영 원칙:
  - 온톨로지가 확정되기 전까지는 선택적 참고 데이터로 취급
  - 필요 시 추후 변환/백필 배치로 `company_article_ai_state`에 반영

---

## 포맷

### A. 타입 표기 포맷
- `TEXT`
- `NUMERIC(12,4)`
- `JSONB object`
- `JSONB array<string>`
- `JSONB object 내부 boolean`

### B. 참조 표기 포맷
- 본문: `(n번 참조)`
- 하단: `n번 참조: <절대 경로>`

---

## 참조 목록
- 1번 참조: `D:/intellij project/cherry-in-the-haystack/dev/apps/agent/writer_agent/run_writer_agent.py`
  - 이 JSON은 무엇인가: 기사 1건을 깊게 가공한 Writer 결과 JSON(요약/근거/변경내역).
  - 어디에 쓰는가: `company_article_ai_state`의 `ai_summary`, `ai_snippets_json`, `ai_evidence_json`, `ai_structured_extraction_json` 매핑 원천.
  - 실제 데이터 형식(출력 JSON):
```json
{
  "topic": "string",
  "summary": "string",
  "why_it_matters": "string",
  "evidence": [
    {
      "chunk_id": 0,
      "body_text": "string",
      "page_number": 0,
      "paragraph_index": 0,
      "chapter_id": 0,
      "section_id": 0,
      "book_id": 0,
      "book_title": "string",
      "book_author": "string"
    }
  ],
  "related_concepts": ["string"],
  "references": [
    {
      "source": "string",
      "author": "string",
      "snippets": [{"chunk_id": 0, "excerpt": "string"}]
    }
  ],
  "updates": [{"title": "string", "body": "string"}],
  "patch_notes": ["string"]
}
```

- 2번 참조: `D:/intellij project/cherry-in-the-haystack/dev/apps/agent/news_agent/code/run_news_agent.py`
  - 파이프라인 출력 JSON은 무엇인가: 여러 기사에 대한 분류/점수/뉴스레터 적합성 판정 배치 결과.
  - 파이프라인 출력 JSON 용도: `company_article_ai_state`의 `ai_summary`, `ai_score`, `ai_classification_json`, `ai_tags_json`, `ai_entities_json` 원천.
  - 실제 데이터 형식(파이프라인 출력 JSON):
```json
{
  "generated_at": "ISO-8601 string",
  "count": 0,
  "items": [
    {
      "title": "string",
      "summary": "string",
      "category": "string",
      "company": "string",
      "tags": ["string"],
      "importance_score": 1,
      "rationale": "string",
      "newsletter_fit": false,
      "newsletter_edit": "string"
    }
  ]
}
```
  - 뉴스레터 초안 JSON은 무엇인가: 선택된 기사들을 묶어 사람이 읽는 뉴스레터 본문 형태로 생성한 문서 초안.
  - 뉴스레터 초안 JSON 용도: 발행/편집 워크플로우용 콘텐츠이며, 현재 DDL 즉시 적재 대상은 아님.
  - 실제 데이터 형식(뉴스레터 초안 JSON):
```json
{
  "title": "string",
  "tldr": ["string"],
  "sections": [{"heading": "string", "body": "string"}],
  "closing": "string"
}
```

- 3번 참조: `D:/intellij project/cherry-in-the-haystack/dev/packages/pdf_knowledge_extractor/src/db/models.py`
  - 이 JSON은 무엇인가: PDF 추출 파이프라인이 저장하는 원천 DB 엔터티 스키마 요약.
  - 어디에 쓰는가: Writer의 `evidence/references` 생성을 위한 근거 데이터 소스(직접 `cherry_platform` 적재 아님).
  - 실제 데이터 형식(저장 모델 필드 요약):
```json
{
  "books": {"id": "int", "title": "text", "author": "text"},
  "paragraph_chunks": {
    "id": "int",
    "book_id": "int",
    "chapter_id": "int",
    "section_id": "int",
    "paragraph_index": "int",
    "body_text": "text"
  },
  "key_ideas": {"id": "int", "chunk_id": "int", "book_id": "int", "core_idea_text": "text"}
}
```

- 4번 참조: `D:/intellij project/cherry-in-the-haystack/dev/packages/pdf_knowledge_extractor/src/workflow/nodes/process_section.py`
  - 이 JSON은 무엇인가: 섹션 처리 단계에서 LLM이 뽑는 개념 결과와 DB 저장 단위.
  - 어디에 쓰는가: `paragraph_chunks`, `key_ideas` 적재 및 이후 기사 근거 추출의 업스트림 입력.
  - 실제 데이터 형식(LLM 추출 결과):
```json
{
  "concept": "string"
}
```
  - 실제 데이터 형식(DB 저장 단위):
```json
{
  "paragraph_chunk": {
    "book_id": 0,
    "chapter_id": 0,
    "section_id": 0,
    "paragraph_index": 0,
    "chapter_paragraph_index": 0,
    "body_text": "string"
  },
  "key_idea": {
    "chunk_id": 0,
    "book_id": 0,
    "core_idea_text": "string"
  }
}
```

- 5번 참조: `D:/intellij project/cherry-in-the-haystack/docs/ddl-v1.0.sql`
  - 이 JSON은 무엇인가: `cherry_platform` 스키마에서 요구하는 JSONB 컬럼 타입 계약.
  - 어디에 쓰는가: 에이전트 산출물 적재 시 최종 타깃 포맷 검증 기준.
  - 실제 데이터 형식(핵심 JSONB 컬럼 타입 제약):
```json
{
  "company_article_ai_state": {
    "ai_classification_json": "object",
    "ai_tags_json": "array",
    "ai_entities_json": "object",
    "ai_snippets_json": "object",
    "ai_evidence_json": "object",
    "ai_structured_extraction_json": "object"
  },
  "patchnote_daily_stat_snapshot": {"areas_changed_json": "array"},
  "highlight_weekly_stat_snapshot": {
    "covered_topics_json": "array",
    "new_keywords_json": "array",
    "trending_keywords_json": "array",
    "treemap_distribution_json": "array"
  },
  "model_update_daily_snapshot": {
    "benchmark_metric_json": "object",
    "co_mentioned_terms_json": "array"
  },
  "model_update_weekly_stat_snapshot": {
    "lanked_category_json": "array",
    "rising_star_json": "object"
  }
}
```
