# Agent Communication API 명세서

> 작성일: 2026-04-12  
> Base URL: `https://api.solteti.site`  
> 대상: 에이전트 개발자

---

## 인증

모든 엔드포인트에 **API Key** 헤더 필수.

```
X-Api-Key: c63be...
```

> 전체 키값은 별도로 전달됩니다.

---

## 1. 기사 삽입

### `POST /api/agent/insert-article`

크롤링한 기사를 DB에 삽입한다. URL 중복이면 기존 ID를 반환하고 삽입하지 않는다. 소스(`source_name`)가 없으면 자동 생성된다.

### Request Body

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `title` | string | ✅ | 기사 제목 (max 500) |
| `url` | string (URL) | ✅ | 기사 원문 URL (max 1000) |
| `content_raw` | string | ✅ | 기사 본문 전문 |
| `published_at` | string (ISO 8601) | ✅ | 발행일시 (예: `2026-04-12T09:00:00Z`) |
| `source_name` | string | ✅ | 출처 이름 (max 200, 없으면 자동 생성) |
| `source_type` | enum | ❌ | 기본값 `RSS`. 가능한 값: `RSS` `TWITTER` `LINKEDIN` `YOUTUBE` `REDDIT` `KAKAO` `WEBSITE` `CUSTOM` |
| `language` | string | ❌ | 언어 코드 (예: `en`, `ko`) |
| `author` | string | ❌ | 저자 (max 255) |

```json
{
  "title": "LangChain v0.3 Adds Multi-Modal RAG Pipeline with Vision Support",
  "url": "https://blog.langchain.dev/langchain-v03-multi-modal-rag",
  "content_raw": "LangChain v0.3 introduces a multi-modal RAG pipeline that supports image and text retrieval in a unified chain...",
  "published_at": "2026-04-12T14:00:00Z",
  "source_name": "LangChain Blog",
  "source_type": "RSS",
  "language": "en",
  "author": "Harrison Chase"
}
```

### Response `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string (UUID) | 기사 ID (`article_raw.id`) |
| `created` | boolean | `true` = 신규 삽입, `false` = URL 중복으로 기존 반환 |

```json
{ "id": "0195f300-1001-7000-b000-000000000001", "created": true }
```

---

## 2. 평가 패키지 요청

### `GET /api/agent/ask-evaluation`

에이전트가 평가를 수행하기 위해 필요한 모든 정보를 한 번에 반환한다.  
- **prompts**: 사용할 프롬프트 템플릿 및 버전
- **catalog**: 분류 기준이 되는 페이지 → 카테고리 → 엔터티 계층 구조
- **items**: 평가 대기 중인 기사 목록 (`idempotency_key` 포함)

### Query Parameters

| 파라미터 | 필수 | 설명 |
|----------|------|------|
| `type` | ✅ | 템플릿 타입. `ARTICLE_AI` 또는 `NEWSLETTER` |
| `version_tags` | ✅ | 버전 태그. 단일(`A`) 또는 쉼표 구분 복수(`A,B`) |

```
GET /api/agent/ask-evaluation?type=ARTICLE_AI&version_tags=A
```

### Response `200 OK`

```json
{
  "prompts": {
    "template_id": "019d7dd5-406a-72ca-85e8-f0324841300c",
    "template_name": "기본 아티클 분석",
    "tone_text": "기술적이고 간결하게 요약하라...",
    "versions": [
      {
        "version_id": "019d7dd5-406a-72ca-85e8-f51c67f27ff2",
        "version_tag": "A",
        "prompt_text": "You are an expert AI/ML analyst...\n\n{article_content}",
        "few_shot_examples": "Example 1:\nInput: ...\nOutput: {...}",
        "parameters_json": {
          "temperature": 0.3,
          "top_p": 0.9,
          "max_tokens": 1200
        }
      }
    ]
  },
  "catalog": {
    "pages": [
      {
        "page": "MODEL_UPDATES",
        "categories": [
          {
            "id": "0195f300-2001-7000-a000-000000000001",
            "name": "OpenAI Family",
            "entities": [
              { "id": "0195f300-1001-7000-b000-000000000001", "name": "GPT-5.4" }
            ]
          }
        ]
      },
      {
        "page": "FRAMEWORKS",
        "categories": [ "..." ]
      },
      {
        "page": "CASE_STUDIES",
        "categories": [ "..." ]
      }
    ],
    "side_categories": [
      { "code": "CASE_STUDY", "name": "Case Study" },
      { "code": "APPLIED_RESEARCH", "name": "Applied Research" }
    ]
  },
  "items": [
    {
      "id": "a91f715e-2021-4b79-8122-c8c3b910b845",
      "idempotency_key": "uas:3f78ed67-8e13-4275-8ae9-e7a9da2f88ac",
      "article": {
        "title": "LangChain v0.3 Adds Multi-Modal RAG Pipeline with Vision Support",
        "content": "LangChain v0.3 introduces a multi-modal RAG pipeline...",
        "url": "https://blog.langchain.dev/langchain-v03-multi-modal-rag",
        "published_at": "2026-04-12T14:00:00.000Z",
        "source_name": "LangChain Blog",
        "source_type": "RSS"
      }
    }
  ]
}
```

### catalog 규칙

- 제공 페이지: `MODEL_UPDATES`, `FRAMEWORKS`, `CASE_STUDIES` 3개만
- 동일 엔터티가 여러 페이지에 등장 가능 (예: `Claude 3.7 Sonnet`은 `MODEL_UPDATES`와 `CASE_STUDIES` 모두에 존재)
- 한 페이지 내에서 하나의 엔터티는 반드시 하나의 카테고리에만 속함

---

## 3. 평가 결과 저장

### `POST /api/agent/finish-evaluation`

에이전트가 생성한 평가 결과를 DB에 저장한다. 이후 파싱 파이프라인이 `agent_json_raw`를 정규 컬럼으로 투영한다.

### Request Body

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `results` | array | ✅ | 평가 결과 배열 (최소 1개) |

### `results[]` 오브젝트 형식

> ⚠️ **`idempotency_key`는 `ask-evaluation` items에서 받은 값을 그대로 사용합니다.**  
> ⚠️ **`representative_entity.id`는 필수입니다.** catalog에서 받은 entity `id`를 그대로 사용해야 합니다.  
> id가 누락되거나 잘못된 경우 해당 항목은 `FAILED` 처리됩니다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `idempotency_key` | string | ✅ | `ask-evaluation` items에서 받은 값 그대로 |
| `version` | string | ✅ | 결과 포맷 버전 (현재 `"0.3"`) |
| `representative_entity` | object | ✅ | 대표 엔터티 |
| `representative_entity.id` | string (UUID) | ✅ | catalog에서 받은 entity id |
| `representative_entity.page` | string | ✅ | `MODEL_UPDATES` / `FRAMEWORKS` / `CASE_STUDIES` |
| `representative_entity.category_id` | string (UUID) | ✅ | catalog에서 받은 category id |
| `representative_entity.category_name` | string | ✅ | 카테고리 이름 |
| `representative_entity.name` | string | ✅ | 엔터티 이름 |
| `ai_summary` | string | ✅ | 1-2문장 요약 (한국어) |
| `ai_score` | integer (1-5) | ✅ | 실용적 가치 점수 |
| `side_category_code` | string or null | ✅ | `CASE_STUDY` / `APPLIED_RESEARCH` / `null` |
| `ai_classification_json` | object | ✅ | 분류 경로 및 신뢰도 |
| `ai_tags_json` | array | ✅ | 태그 목록 |
| `ai_snippets_json` | object | ✅ | 요약 스니펫 |
| `ai_evidence_json` | object | ❌ | 근거 출처 |
| `ai_structured_extraction_json` | object | ❌ | 구조화 메타데이터 |

```json
{
  "results": [
    {
      "idempotency_key": "uas:3f78ed67-8e13-4275-8ae9-e7a9da2f88ac",
      "version": "0.3",
      "representative_entity": {
        "id": "0195f300-1001-7000-b000-000000000010",
        "page": "FRAMEWORKS",
        "category_id": "0195f300-2001-7000-a000-000000000010",
        "category_name": "Agent",
        "name": "LangChain"
      },
      "ai_summary": "LangChain v0.3이 멀티모달 RAG 파이프라인을 도입하여 이미지와 텍스트를 통합 검색할 수 있게 되었습니다.",
      "ai_score": 4,
      "side_category_code": null,
      "ai_classification_json": {
        "final_path": {
          "page": "FRAMEWORKS",
          "category_name": "Agent",
          "entity_name": "LangChain"
        },
        "candidates": [
          { "page": "FRAMEWORKS", "category_name": "Agent", "entity_name": "LangChain", "confidence": 0.95 },
          { "page": "FRAMEWORKS", "category_name": "RAG", "entity_name": "LangChain", "confidence": 0.40 }
        ],
        "decision_reason": "LangChain core framework update with new RAG component"
      },
      "ai_tags_json": [
        { "kind": "TAG", "value": "langchain" },
        { "kind": "TAG", "value": "multi-modal-rag" },
        { "kind": "TAG", "value": "vision-retriever" },
        { "kind": "KEYWORD", "value": "RAG", "frequency": 8, "confidence": 0.93 },
        { "kind": "KEYWORD", "value": "CLIP", "frequency": 3, "confidence": 0.85 }
      ],
      "ai_snippets_json": {
        "why_it_matters": "LangChain에 멀티모달 RAG가 추가되어 이미지+텍스트 통합 검색 앱 구축이 가능해졌습니다.",
        "key_points": ["VisionRetriever로 CLIP 기반 이미지 임베딩 통합", "멀티모달 QA 태스크에서 35% 성능 향상", "체인 구성 API 간소화 및 네이티브 스트리밍 지원"],
        "risk_notes": ["이미지 임베딩 품질은 CLIP 모델 선택에 따라 달라질 수 있음"]
      },
      "ai_evidence_json": {
        "evidence_items": [
          {
            "kind": "quote",
            "text": "Benchmarks show 35% improvement in multi-modal QA tasks.",
            "url": "https://blog.langchain.dev/langchain-v03-multi-modal-rag",
            "source_name": "LangChain Blog",
            "published_at": "2026-04-12T14:00:00+00:00"
          }
        ]
      },
      "ai_structured_extraction_json": {
        "source": { "name": "LangChain Blog", "type": "RSS" },
        "review": { "type": null, "reviewer": null, "comment": null }
      }
    }
  ]
}
```

### Response `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `saved` | integer | 저장 성공 건수 |
| `skipped` | integer | 스킵 건수 (이미 처리됐거나 PENDING이 아닌 경우) |

```json
{ "saved": 1, "skipped": 0 }
```

---

## 전체 플로우

```
0. POST /api/agent/insert-article    → 수집기가 기사 삽입
         [스케줄러가 user_article_state + ai_state PENDING 생성]

1. GET  /api/agent/ask-evaluation    → prompts + catalog + items 수신
         각 item에 idempotency_key 포함

2.       [에이전트가 각 item을 평가]

3. POST /api/agent/finish-evaluation → 평가 결과 일괄 저장
         idempotency_key를 ask-evaluation에서 받은 그대로 사용
         └─ 파싱 파이프라인이 agent_json_raw → 정규 컬럼 투영
         └─ representative_entity.id 로 entity 검증
         └─ 검증 성공 → ai_status = SUCCESS
         └─ 검증 실패 → ai_status = FAILED
```

---

## 에러 응답

| 상태코드 | 원인 |
|----------|------|
| `401 Unauthorized` | X-Api-Key 누락 또는 잘못됨 |
| `400 Bad Request` | 요청 바디 유효성 검사 실패 |
| `404 Not Found` | 해당 type/version_tags에 맞는 프롬프트 없음 |
