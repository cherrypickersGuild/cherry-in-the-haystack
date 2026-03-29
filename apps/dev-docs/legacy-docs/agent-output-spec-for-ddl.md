# Cherry 에이전트 출력 명세 (DDL 화면/기사 생성 기준)

## 0. 문서 목적
- 기준: `docs/ddl-v1.0.sql` (PostgreSQL `cherry_platform`)
- 목표:
  - 지금 이미 생산되는 JSON과 아직 미생산 JSON을 명확히 구분
  - 화면 렌더링/기사 생성에 필요한 에이전트 출력 계약(JSON Contract) 확정
  - 에이전트 개발자에게 “무엇을 어떤 형식으로 생성해야 하는지” 전달 가능한 수준으로 정리

---

## 1. 소스 오브 트루스(권위 체계)

## 1.1 DB 스키마 권위
- 화면 데이터 구조의 최종 권위는 `docs/ddl-v1.0.sql`.
- 특히 화면용 JSON 필드의 구조 예시는 DDL 주석에 명시되어 있음.

## 1.2 카테고리 권위
- **카테고리는 ENUM이 아니라 마스터 테이블**이다.
  - `category_group` (대분류)
  - `category` (소분류, `group_id` FK)
  - `side_category` (보조 분류)
- 즉, 카테고리의 “정답 목록”은 코드 하드코딩이 아니라 DB 마스터 데이터여야 한다.
- DDL의 `Model Release / Research / ...` 같은 값은 `news_agent` 프롬프트의 임시 분류이며, DB 권위 값이 아님.

## 1.3 상태 ENUM 권위
- 아래 값은 DDL에서 고정:
  - `ai_status_enum`: `PENDING | SUCCESS | FAILED`
  - `run_kind_enum`: `SOURCE_FETCH | ARTICLE_AI_PROCESS | STAT_SNAPSHOT_BUILD | NEWSLETTER_GENERATION | EMAIL_SENDING`
  - `run_status_enum`: `SUCCESS | FAILED | RUNNING`
  - 뉴스레터/수신자 관련 ENUM 다수

---

## 2. 현재 상태: 생산됨 vs 미생산

## 2.1 이미 생산되는 것 (코드 확인됨)
- Writer Agent 결과 JSON 파일
  - `dev/apps/agent/writer_agent/outputs/*.json`
  - 필드: `summary`, `why_it_matters`, `evidence`, `related_concepts`, `references`, `updates`, `patch_notes`
- News Agent 결과 JSON 파일
  - `dev/apps/agent/news_agent/outputs/news_agent_output_*.json`
  - 필드: `title`, `summary`, `importance_score`, `category`, `newsletter_fit`, `tags`, `company` 등
- Ontology 파이프라인 JSONL/JSON
  - `output_with_concepts.jsonl`, `staging_concepts.json`, checkpoint JSON
- PDF extractor의 기존 프로토타입 DB write
  - `books`, `paragraph_chunks`, `key_ideas` 등

### 2.1.1 생산 산출물 -> DDL 컬럼 즉시 할당표

#### A) Writer Agent (`summary`, `why_it_matters`, `evidence`, `related_concepts`, `references`, `updates`, `patch_notes`)
- `summary` -> `company_article_ai_state.ai_summary` (`TEXT`, 출처: `dev/apps/agent/writer_agent/run_writer_agent.py`)
- `why_it_matters` -> `company_article_ai_state.ai_snippets_json.why_it_matters` (`JSONB object` 내부 `string`, 출처: `dev/apps/agent/writer_agent/run_writer_agent.py`)
- `evidence` + `references` -> `company_article_ai_state.ai_evidence_json` (`JSONB object`, 출처: `dev/apps/agent/writer_agent/run_writer_agent.py`)
- `related_concepts` ->
  - `company_article_ai_state.ai_entities_json.concepts` (`JSONB object` 내부 `array<string>`, 출처: `dev/apps/agent/writer_agent/run_writer_agent.py`)
  - `company_article_ai_state.ai_structured_extraction_json.related_concepts` (`JSONB object` 내부 `array<string>`, 출처: `dev/apps/agent/writer_agent/run_writer_agent.py`)
- `updates` -> `company_article_ai_state.ai_structured_extraction_json.content_updates.updates` (`JSONB object` 내부 `array<object>`, 출처: `dev/apps/agent/writer_agent/run_writer_agent.py`)
- `patch_notes` -> `company_article_ai_state.ai_structured_extraction_json.content_updates.change_notes` (`JSONB object` 내부 `array<string>`, 출처: `dev/apps/agent/writer_agent/run_writer_agent.py`)

주의:
- Writer의 `patch_notes`는 DDL Patchnotes(미읽음 집계)와 다른 개념이다.
- 이름 충돌 방지를 위해 내부 명칭은 `change_notes` 권장.

#### B) News Agent (`title`, `summary`, `importance_score`, `category`, `newsletter_fit`, `tags`, `company`)
- `summary` -> `company_article_ai_state.ai_summary` (`TEXT`, 출처: `dev/apps/agent/news_agent/code/run_news_agent.py`)
- `importance_score(1~5)` -> `company_article_ai_state.ai_score(0~100)` 변환 (`NUMERIC(12,4)`, 출처: `dev/apps/agent/news_agent/code/run_news_agent.py`)
  - 권장: `ai_score = importance_score * 20`
- `category` -> `company_article_ai_state.ai_classification_json` (`JSONB object`, resolver를 통해 `category_group_code`, `category_code` 정규화, 출처: `dev/apps/agent/news_agent/code/run_news_agent.py`)
- `tags` -> `company_article_ai_state.ai_tags_json` (`JSONB array<string>`, 출처: `dev/apps/agent/news_agent/code/run_news_agent.py`)
- `company` -> `company_article_ai_state.ai_entities_json.companies` (`JSONB object` 내부 `array<string>`, 출처: `dev/apps/agent/news_agent/code/run_news_agent.py`)
- `newsletter_fit` -> `company_article_ai_state.ai_structured_extraction_json.newsletter_fit` (`JSONB object` 내부 `boolean`, 출처: `dev/apps/agent/news_agent/code/run_news_agent.py`)

#### C) Ontology 파이프라인 (`output_with_concepts.jsonl`, `staging_concepts.json`, checkpoint)
- `matched_concept_ids` -> `company_article_ai_state.ai_structured_extraction_json.related_concepts` 보강 (`JSONB object` 내부 `array<string>`, 출처: `dev/packages/ontology/src/scripts/assign_ontology_concept_to_chunk.py`, `dev/packages/ontology/src/pipeline/document_ontology_mapper.py`)
- `concept`/`section`/`chunk_text` 계열 -> `ai_structured_extraction_json.topic_map` 또는 `ai_evidence_json.ontology_mapping_trace`로 보관 (`JSONB object`, 출처: `dev/packages/ontology/src/scripts/assign_ontology_concept_to_chunk.py`)
- 직접 `cherry_platform` 테이블 write는 현재 없음(변환/적재 레이어 필요)

#### D) PDF extractor (`books`, `paragraph_chunks`, `key_ideas`)
- `paragraph_chunks`/`key_ideas`는 기사 AI가 근거 생성 시 참조 소스로 사용 가능
- DDL 직접 매핑 대상이라기보다, `ai_evidence_json.paragraph_evidence` 생성의 upstream 데이터 소스 (`JSONB object` 내부 `array<object>`, 출처: `dev/packages/pdf_knowledge_extractor/src/db/models.py`, `dev/packages/pdf_knowledge_extractor/src/workflow/nodes/process_section.py`)
- 직접 `company_article_ai_state` write는 현재 없음

## 2.2 아직 미생산(DDL 직접 적재 기준)
- `cherry_platform`의 아래 핵심 테이블로 직접 적재하는 코드 부재:
  - `company_article_ai_state`
  - `patchnote_daily_stat_snapshot`
  - `highlight_weekly_stat_snapshot`
  - `model_update_daily_snapshot`
  - `model_update_weekly_stat_snapshot`
- 즉 “에이전트 출력 JSON → DDL 테이블 적재” 변환 레이어가 아직 없음.

## 2.3 개념 충돌 주의: `patch_notes` 이름 충돌
- 현재 `writer_agent`의 `patch_notes`는 “문서/토픽 변경 설명 텍스트”다.
- DDL의 Patchnotes는 `patchnote_cursor_state.last_visited_at` 기반 “미읽음 catch-up 집계 화면”이다.
- 둘은 다른 개념이다.

권장:
- `writer_agent.patch_notes` -> `change_notes` 또는 `content_update_notes`로 용어 변경
- DDL Patchnotes는 기존 명칭 유지 (`patchnote_daily_stat_snapshot`, `patchnote_cursor_state`)

---

## 3. 화면/기사 생성을 위한 필수 출력 계약 (신규 요구)

아래 계약은 에이전트가 최소로 충족해야 하는 출력 스펙이다.

## 3.1 Article AI Contract (`company_article_ai_state` 적재용)

### 3.1.1 목적
- 기사 1건 단위로 요약/분류/태그/근거/구조화 추출 결과를 저장
- Weekly Highlight, Model Updates의 원재료 제공

### 3.1.2 필수 출력(JSON)
```json
{
  "ai_status": "SUCCESS",
  "ai_summary": "string",
  "ai_score_100": 0.0,
  "ai_classification_json": {
    "category_group_code": "MODEL",
    "category_code": "OPENAI",
    "confidence": 0.92,
    "reason": "string"
  },
  "ai_tags_json": ["string"],
  "ai_entities_json": {
    "companies": ["OpenAI"],
    "models": ["GPT-5"],
    "products": ["Responses API"],
    "people": []
  },
  "ai_snippets_json": {
    "key_claims": ["string"],
    "numbers": ["MMLU 89.1"],
    "quotes": ["string"]
  },
  "ai_evidence_json": {
    "sources": [
      {
        "url": "https://...",
        "title": "string",
        "evidence_snippets": ["string"]
      }
    ]
  },
  "ai_structured_extraction_json": {
    "topics": ["RAG evaluation"],
    "keywords": ["RAG", "benchmark"],
    "benchmark_metrics": {
      "GPQA": 92.4,
      "MMLU": 89.1
    },
    "co_mentioned_terms": ["GPT-5", "GPT-OSS"],
    "side_category_codes": ["REGULATION"]
  },
  "ai_model_name": "string",
  "ai_processed_at": "2026-03-19T00:00:00Z"
}
```

### 3.1.3 DB 제약 반영 규칙
- `ai_score`는 DDL상 `0~100` 체크.  
  현재 `importance_score(1~5)` 사용 시 반드시 변환:
  - 권장: `ai_score = importance_score * 20`
- JSON 타입 제약:
  - `ai_classification_json`: object
  - `ai_tags_json`: array
  - `ai_entities_json`: object
  - `ai_snippets_json`: object
  - `ai_evidence_json`: object
  - `ai_structured_extraction_json`: object

### 3.1.4 Writer Agent 필드 -> DDL JSONB 컬럼 할당 규칙

Writer Agent 출력:
- `summary`
- `why_it_matters`
- `evidence`
- `related_concepts`
- `references`
- `updates`
- `patch_notes`

할당 원칙(요청하신 대로 `summary` 제외한 나머지 중심):

1. `why_it_matters` -> `ai_snippets_json`
- 저장 권장:
```json
{
  "why_it_matters": "string",
  "key_claims": ["..."],
  "numbers": [],
  "quotes": []
}
```
- 이유: 짧은 근거/핵심 논점 스니펫 계층에 가장 자연스럽다.

2. `evidence` + `references` -> `ai_evidence_json`
- 저장 권장:
```json
{
  "paragraph_evidence": [
    {
      "chunk_id": 114,
      "book_title": "AI Engineering",
      "book_author": "Chip Huyen;",
      "chapter_id": 21,
      "section_id": null,
      "excerpt": "..."
    }
  ],
  "source_references": [
    {
      "source": "AI Engineering",
      "author": "Chip Huyen;",
      "snippets": [
        {"chunk_id": 114, "excerpt": "..."}
      ]
    }
  ]
}
```
- 이유: 출처/근거를 재구성 가능한 형태로 보관.

3. `related_concepts` -> `ai_entities_json` + `ai_structured_extraction_json`
- 1차(엔티티):
```json
{
  "concepts": ["Evaluation", "RAG metrics"],
  "companies": [],
  "models": [],
  "products": [],
  "people": []
}
```
- 2차(구조화):
```json
{
  "topics": ["RAG evaluation"],
  "related_concepts": ["Evaluation", "RAG metrics"],
  "keywords": ["RAG", "evaluation"]
}
```
- 이유: 엔티티 조회와 분석 집계를 동시에 만족.

4. `updates` + `patch_notes` -> `ai_structured_extraction_json`의 `content_updates` 하위
- 저장 권장:
```json
{
  "content_updates": {
    "updates": [
      {"title": "...", "body": "..."}
    ],
    "change_notes": [
      "..."
    ]
  }
}
```
- 중요: 이 `change_notes`는 DDL Patchnotes(미읽음 집계)와 별개.

5. `ai_classification_json`, `ai_tags_json`
- Writer Agent만으로 부족할 수 있으므로 Category Resolver 결과와 병합 권장:
```json
{
  "ai_classification_json": {
    "category_group_code": "MODEL",
    "category_code": "OPENAI",
    "confidence": 0.91,
    "reason": "..."
  },
  "ai_tags_json": ["RAG", "evaluation", "benchmark"]
}
```

6. 권장 최종 통합 예시 (`company_article_ai_state` 1행 기준)
```json
{
  "ai_summary": "...",
  "ai_score": 80,
  "ai_classification_json": {
    "category_group_code": "MODEL",
    "category_code": "OPENAI",
    "confidence": 0.91,
    "reason": "..."
  },
  "ai_tags_json": ["RAG", "evaluation", "benchmark"],
  "ai_entities_json": {
    "concepts": ["Evaluation", "RAG metrics"],
    "companies": [],
    "models": [],
    "products": [],
    "people": []
  },
  "ai_snippets_json": {
    "why_it_matters": "...",
    "key_claims": ["..."],
    "numbers": [],
    "quotes": []
  },
  "ai_evidence_json": {
    "paragraph_evidence": [],
    "source_references": []
  },
  "ai_structured_extraction_json": {
    "topics": ["RAG evaluation"],
    "related_concepts": ["Evaluation", "RAG metrics"],
    "keywords": ["RAG", "evaluation"],
    "benchmark_metrics": {
      "GPQA": 92.4
    },
    "co_mentioned_terms": ["GPT-5", "GPT-OSS"],
    "content_updates": {
      "updates": [],
      "change_notes": []
    },
    "side_category_codes": []
  }
}
```

---

## 3.2 Patchnotes Snapshot Contract (`patchnote_daily_stat_snapshot`, 집계 배치)

### 목적
- Patchnotes 화면의 일별 변경 영역(areas changed) 렌더링
- 핵심은 “유저 읽음 여부(last_visited_at)” + 일자별 기사 집계이며, AI 추론이 아니라 집계 로직이 본질

### 필수 출력(JSON)
```json
{
  "stat_date": "2026-03-19",
  "new_article_count": 12,
  "new_high_impact_count": 3,
  "areas_changed_json": [
    {
      "category_group_id": "uuid",
      "category_group_name": "MODEL",
      "article_count": 5
    }
  ]
}
```

---

## 3.3 Weekly Highlight Snapshot Contract (`highlight_weekly_stat_snapshot`, 집계 배치)

### 목적
- 상단 KPI + 키워드 + 트리맵을 O(1) 조회로 제공
- `company_article_state + company_article_ai_state`를 SQL/코드 집계해 생성하는 것이 정석

### 필수 출력(JSON)
```json
{
  "week_start": "2026-03-16",
  "week_end": "2026-03-22",
  "items_this_week": 120,
  "topics_covered_count": 43,
  "new_keywords_count": 57,
  "new_keywords_mom_rate": 18.3,
  "score_5_items_count": 21,
  "covered_topics_json": [
    {"topic": "RAG evaluation", "count": 8}
  ],
  "new_keywords_json": ["QoQ Scaling", "MoE Router"],
  "trending_keywords_json": ["Agentic Workflow", "MCP"],
  "treemap_distribution_json": [
    {
      "category_group_id": "uuid",
      "ratio_percent": 45.5,
      "item_count": 20,
      "category_names": ["OpenAI", "Anthropic"]
    }
  ]
}
```

---

## 3.4 Model Updates Daily Contract (`model_update_daily_snapshot`, 집계 배치)

### 목적
- 주간 Major Players 랭킹 계산의 원천 데이터
- 카테고리/점수/지표를 이미 기사 AI 결과로 확보했다면, 이후는 결정론적 집계 단계

### 필수 출력(JSON)
```json
{
  "stat_date": "2026-03-19",
  "category_group_id": "uuid",
  "category_id": "uuid",
  "article_count": 7,
  "high_impact_count": 3,
  "score_avg": 81.4,
  "weighted_score": 88.9,
  "benchmark_metric_json": {
    "GPQA": 92.4,
    "MMLU": 89.1
  },
  "co_mentioned_terms_json": ["GPT-5", "GPT-5-Codex-Max", "GPT-OSS"]
}
```

---

## 3.5 Model Updates Weekly Contract (`model_update_weekly_stat_snapshot`, 집계 배치)

### 목적
- Major Players + Rising Star 최종 화면 데이터
- 별도 LLM 호출 없이 Daily 스냅샷을 주간 윈도우로 집계해 생성

### 필수 출력(JSON)
```json
{
  "week_start": "2026-03-16",
  "week_end": "2026-03-22",
  "category_group_id": "uuid",
  "items_count": 42,
  "tracked_company_count": 8,
  "ranking_metric_label": "GPQA Benchmark",
  "lanked_category_json": [
    {
      "rank_no": 1,
      "category_id": "uuid",
      "badge_text": "Top",
      "score_value": 95.5,
      "score_label": "95.5 pts",
      "supporting_text": "High impact due to recent releases",
      "is_new_entry": false,
      "movement_value": 1
    }
  ],
  "rising_star_json": {
    "category_id": "uuid",
    "title": "Agentic Workflows",
    "summary": "Rapidly growing interest in autonomous agents.",
    "rating_label": "Hot",
    "trend_rate": 150.0,
    "supporting_points": ["Point 1", "Point 2"]
  }
}
```

---

## 4. 카테고리 설계: 확정된 것 / 확정 안 된 것

## 4.1 확정된 것
- 구조는 확정:
  - `category_group` 1:N `category`
  - 기사 대표 분류는 `company_article_state.category_group_id`, `category_id`
  - 보조 분류는 `company_article_side_category_map` + `side_category`

## 4.2 확정 안 된 것
- 실제 운영 값(코드/이름) 목록은 DDL에 seed로 고정되어 있지 않다.
- DDL 주석에는 예시만 존재 (`FRAMEWORK`, `MODEL`, `TOOLS`, `OPENAI`, `AGENT`, `CASE_STUDY`, `REGULATION` 등).
- 따라서 에이전트는 하드코딩된 문자열을 최종값으로 쓰면 안 되고, **마스터 테이블 조회 기반**으로 출력해야 함.

## 4.3 에이전트 출력 규칙(카테고리)
- 반드시 아래 필드를 같이 반환:
```json
{
  "category_group_code": "MODEL",
  "category_code": "OPENAI",
  "side_category_codes": ["REGULATION"],
  "confidence": 0.91,
  "unmapped": false
}
```
- 매핑 실패 시:
  - `category_group_code = null`, `category_code = null`, `unmapped = true`
  - 이후 수동 보정 큐로 전송

---

## 5. 에이전트 개발자에게 추가로 요구할 것 (Must Have)

## 5.1 Article AI 에이전트
- 요약/점수/카테고리/태그/엔티티/스니펫/근거/구조화 추출을 한 번에 생성
- `ai_score` 0~100 정규화
- `benchmark_metrics`, `co_mentioned_terms`, `topics`, `keywords` 필수 추출

## 5.2 Category Resolver 에이전트
- 입력: 원문 + 요약 + 태그
- 출력: `category_group_code`, `category_code`, `side_category_codes`, confidence
- 룰: DB 마스터에 없는 코드는 반환 금지

## 5.3 Snapshot Builder 에이전트(또는 배치)
- 입력: `company_article_state` + `company_article_ai_state`
- 출력: 4개 스냅샷 테이블 JSON 컬럼 모두 생성
  - Patchnotes Daily
  - Highlight Weekly
  - Model Update Daily
  - Model Update Weekly

### 5.3.1 권장 구현 방식 (중요 정정)
- **권장: 별도 AI 에이전트가 아니라 배치/SQL 집계 작업으로 구현**
- 이유:
  - Patchnotes는 유저 커서(`last_visited_at`)와 날짜/카테고리 집계 문제
  - Highlight/Model Update도 이미 저장된 기사 AI 결과를 합산/정렬하는 문제
  - 재현성/비용/운영 안정성 측면에서 결정론적 집계가 유리

### 5.3.2 언제 AI가 필요한가
- 스냅샷 단계가 아니라 **기사 단위 AI 생성 단계(3.1)** 에서 필요
  - 요약, 태그, 분류, 엔티티, 근거, 지표 추출
- 스냅샷은 해당 결과를 받아 규칙대로 계산해 저장

## 5.4 Newsletter Drafter/Packager
- 현재 draft JSON을 `newsletter_issue`, `newsletter_issue_item_snapshot` 입력 스키마로 변환
- `ai_summary`, `ai_score`, `position`, `is_recommended` 채움

## 5.5 Run Log Writer
- 모든 에이전트 실행에 대해 `run_log` 작성:
  - `run_kind`, `status`, `model_name`, `tokens`, `cost_usd`, `processed_count`, `meta_json`

---

## 6. 권장 API 계약 (에이전트 출력 표준 버전)

에이전트 간 호환성을 위해 다음 payload 이름을 표준으로 사용:
- `article_ai_payload_v1`
- `patchnote_daily_snapshot_payload_v1`
- `highlight_weekly_snapshot_payload_v1`
- `model_update_daily_snapshot_payload_v1`
- `model_update_weekly_snapshot_payload_v1`
- `newsletter_draft_payload_v1`

각 payload는 본 문서 3장의 예시를 최소 필드로 포함해야 한다.

---

## 7. 구현 우선순위 (현실적인 순서)

1. `article_ai_payload_v1` 구현 및 `company_article_ai_state` 적재
2. 카테고리 매핑기(Category Resolver) 구현
3. 스냅샷 배치(SQL 집계) 구현: `highlight_weekly_stat_snapshot` + `patchnote_daily_stat_snapshot`
4. 스냅샷 배치(SQL 집계) 구현: `model_update_daily_snapshot` + `model_update_weekly_stat_snapshot`
5. 뉴스레터 적재(`newsletter_issue_item_snapshot`) 연결
6. `run_log` 전 구간 연결

---

## 8. 최종 체크리스트 (릴리즈 전)
- [ ] 모든 JSON 컬럼이 DDL의 `jsonb_typeof` 제약 충족
- [ ] `ai_score`가 0~100 범위 충족
- [ ] 카테고리 값이 DB 마스터와 1:1 매핑
- [ ] 매핑 실패시 null+보정큐 fallback 동작
- [ ] 스냅샷 4종이 기간/카운트 체크 제약 충족
- [ ] `run_log`에 실행 이력/비용/토큰 기록

---

## 9. 참고
- `docs/ddl-v1.0.sql`
- `docs/agent-json-db-mapping.md`
- `dev/apps/agent/writer_agent/run_writer_agent.py`
- `dev/apps/agent/news_agent/code/run_news_agent.py`
