# 에이전트 JSON/DB 저장 포맷 정리 (DDL 기준)

## 목적
- 기준 스키마: `docs/ddl-v1.1.sql` (`cherry_platform`)
- 목표: 현재 코드에서 **에이전트가 실제 생성/저장하는 JSON**과 **DB write 형태**를 추출하고, DDL 컬럼과 매핑

---

## 1) 핵심 결론 (중요)
- 현재 저장소에는 `company_article_ai_state`, `highlight_weekly_stat_snapshot` 등 `cherry_platform` 테이블로 직접 `INSERT/UPDATE`하는 코드가 없다.
- 현재 에이전트 결과는 주로 **파일(JSON/JSONL)** 또는 **기존 프로토타입 DB(books/paragraph_chunks/key_ideas 등)** 에 저장된다.
- 즉, `docs/ddl-v1.1.sql`은 설계 기준이고, 실제 적재 파이프라인은 아직 연결 전 단계다.

---

## 2) DDL 기준 주요 JSON 컬럼 요약

`docs/ddl-v1.1.sql`에서 에이전트 결과와 직접 관련이 큰 JSON 컬럼:

- `company_article_ai_state`
  - `ai_classification_json` (object)
  - `ai_tags_json` (array)
  - `ai_entities_json` (object)
  - `ai_snippets_json` (object)
  - `ai_evidence_json` (object)
  - `ai_structured_extraction_json` (object)
- `patchnote_daily_stat_snapshot`
  - `areas_changed_json` (array)
- `highlight_weekly_stat_snapshot`
  - `covered_topics_json` (array)
  - `new_keywords_json` (array)
  - `trending_keywords_json` (array)
  - `treemap_distribution_json` (array)
- `model_update_daily_snapshot`
  - `benchmark_metric_json` (object)
  - `co_mentioned_terms_json` (array)
- `model_update_weekly_stat_snapshot`
  - `lanked_category_json` (array)
  - `rising_star_json` (object)

---

## 3) 현재 에이전트별 JSON 출력 계약(Contract)

## 3.1 Writer Agent (`dev/apps/agent/writer_agent/run_writer_agent.py`)

### A. 에이전트 내부 출력 계약
- `OntologyJudge` 기대 출력:
```json
{
  "concepts": ["..."],
  "notes": "..."
}
```

- `EvidenceSummarizer` 기대 출력:
```json
{
  "key_concepts": ["..."],
  "bullets": ["..."]
}
```

- `CherryWriter` 기대 출력:
```json
{
  "summary": "...",
  "why_it_matters": "...",
  "references": [],
  "updates": [],
  "patch_notes": []
}
```

### B. 최종 파일 저장 JSON (실제 write)
- 저장 위치: `dev/apps/agent/writer_agent/outputs/{topic}_{timestamp}.json`
- 실제 스키마:
```json
{
  "topic": "RAG evaluation",
  "summary": "...",
  "why_it_matters": "...",
  "evidence": [
    {
      "chunk_id": 114,
      "body_text": "...",
      "page_number": null,
      "paragraph_index": 2,
      "chapter_id": 21,
      "section_id": null,
      "book_id": 2,
      "book_title": "AI Engineering",
      "book_author": "Chip Huyen;"
    }
  ],
  "related_concepts": ["..."],
  "references": [
    {
      "source": "AI Engineering",
      "author": "Chip Huyen;",
      "snippets": [
        {
          "chunk_id": 114,
          "excerpt": "..."
        }
      ]
    }
  ],
  "updates": [
    {
      "title": "...",
      "body": "..."
    }
  ],
  "patch_notes": ["..."]
}
```

### C. 프론트 변환 JSON (실제 write)
- 생성 스크립트: `format_for_frontend.py`, `build_front_preview.py`
- 출력 파일:
  - `*_page.json`
  - `*_patch.json`

- `*_page.json`:
```json
{
  "topic": "...",
  "summary": "...",
  "why_it_matters": "...",
  "evidence_cards": [
    {
      "title": "...",
      "excerpt": "...",
      "source": {
        "book_title": "...",
        "book_author": "...",
        "page_number": null,
        "chapter_id": 1,
        "section_id": 2,
        "chunk_id": 10
      }
    }
  ],
  "related_cards": [{"label": "..."}],
  "reference_cards": [
    {
      "source": "...",
      "author": "...",
      "snippets": [{"chunk_id": 1, "excerpt": "..."}]
    }
  ]
}
```

- `*_patch.json`:
```json
{
  "topic": "...",
  "updates": [{"title": "...", "body": "..."}],
  "patch_notes": ["..."]
}
```

### D. DB write 형태
- Writer Agent는 현재 `cherry_platform`에 쓰지 않는다.
- `query_evidence_db()`로 기존 `public.paragraph_chunks`, `public.books`를 조회만 한다.

---

## 3.2 News Agent (`dev/apps/agent/news_agent/code/run_news_agent.py`)

### A. 단계별 에이전트 JSON 계약
- `analyst`:
```json
{
  "summary": "...",
  "category": "Model Release",
  "company": "OpenAI",
  "tags": ["LLM", "RAG"]
}
```

- `scorer`:
```json
{
  "importance_score": 5,
  "rationale": "..."
}
```

- `editor`:
```json
{
  "newsletter_fit": true,
  "newsletter_edit": "...",
  "edit_notes": "..."
}
```

- `qa` 최종 아이템 스키마:
```json
{
  "title": "...",
  "summary": "...",
  "importance_score": 5,
  "category": "Model Release",
  "newsletter_fit": true,
  "newsletter_edit": "...",
  "rationale": "...",
  "tags": ["..."],
  "company": "..."
}
```

### B. 파이프라인 최종 write JSON
- 저장 위치: `dev/apps/agent/news_agent/outputs/news_agent_output_{timestamp}.json`
- 스키마:
```json
{
  "generated_at": "2026-03-19T00:00:00Z",
  "count": 10,
  "items": [
    {
      "title": "...",
      "summary": "...",
      "importance_score": 4,
      "category": "Research",
      "newsletter_fit": false,
      "newsletter_edit": "...",
      "rationale": "...",
      "tags": ["..."],
      "company": "..."
    }
  ]
}
```

### C. 뉴스레터 초안 JSON
- `run_newsletter_draft()` 기대 출력:
```json
{
  "title": "...",
  "tldr": ["..."],
  "sections": [
    {
      "heading": "...",
      "body": "..."
    }
  ],
  "closing": "..."
}
```

### D. 프롬프트 설정 JSON (실제 write)
- `prompts.json`:
```json
{
  "analyst": "...",
  "scorer": "...",
  "editor": "...",
  "qa": "..."
}
```

- `newsletter_prompts.json`:
```json
{
  "draft": "..."
}
```

### E. DB write 형태
- News Agent도 현재 `cherry_platform` DB에 직접 쓰지 않는다.
- JSON 파일 생성 + FastAPI/Web API 응답 중심.

---

## 3.3 Ontology 파이프라인 (`dev/packages/ontology`)

이 영역은 뉴스/라이터와 별도로, 개념 매핑용 JSONL/JSON을 생성한다.

### A. 입력 JSONL 계약 (`assign_ontology_concept_to_chunk.py`)
필수 필드:
```json
{
  "concept": "LoRA",
  "section_id": 2,
  "section_title": "Fine-tuning",
  "chunk_text": "..."
}
```

### B. 출력 JSONL (`output_with_concepts.jsonl`) 한 줄 스키마
```json
{
  "concept": "...",
  "section_id": 2,
  "section_title": "...",
  "source": "section_2",
  "chunk_text": "...",
  "matched_concept_ids": ["FineTuning", "LoRA"],
  "is_new": false
}
```

### C. 스테이징 JSON (`staging_concepts.json`)
```json
{
  "staged_concepts": [
    {
      "concept_id": "NewConcept",
      "label": "New Concept",
      "description": "...",
      "original_keywords": ["..."],
      "parent_assignment_reason": "...",
      "parent_candidates": [
        {
          "concept": "ParentConcept",
          "score": 0.92
        }
      ]
    }
  ],
  "last_updated": "2026-03-19T12:34:56.000000"
}
```

### D. 체크포인트 JSON
```json
{
  "processed_index": 120,
  "results": [],
  "staging_concepts": [],
  "checkpoint_timestamp": "2026-03-19T12:34:56.000000",
  "total_concepts": 120
}
```

### E. 커밋 백업 JSON (`graphdb_dump.json`)
```json
[
  {
    "concept_id": "RAG",
    "label": "Retrieval-Augmented Generation",
    "parent": "LLMConcept",
    "description": "..."
  }
]
```

### F. DB write 형태
- SQLite(`new_concepts.db`) + GraphDB + VectorDB에 write.
- `cherry_platform` 테이블과는 별개 저장소.

---

## 3.4 PDF Knowledge Extractor (`dev/packages/pdf_knowledge_extractor`)

### A. LLM 구조화 출력 스키마
- `ExtractedIdea`:
```json
{
  "concept": "Transformer"
}
```

### B. DB write 형태
- PostgreSQL 프로토타입 스키마(`books`, `chapters`, `sections`, `paragraph_chunks`, `key_ideas`)에 저장.
- `cherry_platform` 스키마와 별개.

---

## 3.5 레거시 AutoGen (`dev/apps/api/src/llm_autogen.py`)

해당 코드는 레거시 멀티에이전트로 JSON을 반환/저장하지만, `cherry_platform` 직접 write는 확인되지 않음.

- `search()` 반환:
```json
[
  {"title": "...", "href": "...", "body": "..."}
]
```

- `scrape()` 반환:
```json
[
  {"href": "...", "body": "..."}
]
```

- `arxiv_search()` 반환:
```json
{
  "paper title": {
    "authors": "...",
    "summary": "...",
    "URL": "..."
  }
}
```

---

## 4) DDL(`company_article_ai_state`) 매핑 가이드

아래는 **현재 News Agent/Writer Agent 출력을 DDL 컬럼으로 적재할 때의 추천 매핑**.

## 4.1 매핑
- `ai_summary` <- `items[].summary`
- `ai_score` <- `items[].importance_score` (변환 필요, 아래 참고)
- `ai_classification_json` <- `{ "category": items[].category, "company": items[].company }`
- `ai_tags_json` <- `items[].tags`
- `ai_entities_json` <- 현재 미생성 (null 또는 추출기 추가)
- `ai_snippets_json` <- 현재 미생성 (null 또는 summary snippet 생성)
- `ai_evidence_json` <- Writer Agent라면 `references/evidence`를 정규화해 저장 가능
- `ai_structured_extraction_json` <- Ontology 매핑 결과(`matched_concept_ids`, topic/metric 등)를 별도 통합 필요

## 4.2 점수 스케일 주의
- 현재 News Agent `importance_score`는 **1~5**
- DDL의 `ai_score`는 `NUMERIC(12,4)` + `0~100` 체크
- 권장 변환:
  - `ai_score = importance_score * 20` (예: 5 -> 100)
  - 또는 원점수 유지 시 컬럼 정책 변경 필요

---

## 5) 스냅샷 테이블(JSON) 생성 상태

DDL의 아래 JSON 컬럼들은 현재 코드에서 생성 로직이 확인되지 않음:
- `patchnote_daily_stat_snapshot.areas_changed_json`
- `highlight_weekly_stat_snapshot.covered_topics_json`
- `highlight_weekly_stat_snapshot.new_keywords_json`
- `highlight_weekly_stat_snapshot.trending_keywords_json`
- `highlight_weekly_stat_snapshot.treemap_distribution_json`
- `model_update_daily_snapshot.benchmark_metric_json`
- `model_update_daily_snapshot.co_mentioned_terms_json`
- `model_update_weekly_stat_snapshot.lanked_category_json`
- `model_update_weekly_stat_snapshot.rising_star_json`

즉, 이 영역은 설계(DDL)만 완료된 상태이며 구현 필요.

---

## 6) “지금 바로 DB에 넣을 수 있는” 최소 정규화 예시

News Agent 결과 item 1건을 `company_article_ai_state`로 변환:

```json
{
  "ai_summary": "OpenAI released ...",
  "ai_score": 80,
  "ai_classification_json": {
    "category": "Model Release",
    "company": "OpenAI"
  },
  "ai_tags_json": ["LLM", "OpenAI", "API"],
  "ai_entities_json": {},
  "ai_snippets_json": {},
  "ai_evidence_json": {},
  "ai_structured_extraction_json": {
    "newsletter_fit": true,
    "newsletter_edit": "..."
  }
}
```

---

## 7) 참고 파일
- `docs/ddl-v1.1.sql`
- `dev/apps/agent/writer_agent/run_writer_agent.py`
- `dev/apps/agent/writer_agent/format_for_frontend.py`
- `dev/apps/agent/writer_agent/build_front_preview.py`
- `dev/apps/agent/writer_agent/outputs/RAG_evaluation_20260117_174555.json`
- `dev/apps/agent/news_agent/code/run_news_agent.py`
- `dev/apps/agent/news_agent/code/fastapi_app.py`
- `dev/apps/agent/news_agent/code/web_app.py`
- `dev/apps/agent/news_agent/code/prompts.json`
- `dev/apps/agent/news_agent/code/newsletter_prompts.json`
- `dev/packages/ontology/src/scripts/assign_ontology_concept_to_chunk.py`
- `dev/packages/ontology/src/pipeline/staging_manager.py`
- `dev/packages/ontology/src/scripts/commit_ontology_assignment.py`
- `dev/packages/pdf_knowledge_extractor/src/model/schemas.py`
- `dev/packages/pdf_knowledge_extractor/src/workflow/nodes/process_section.py`

