# news_agent 아키텍처 및 워크플로우 (한글)

## 개요
`news_agent`는 뉴스 기사를 분석하여 구조화된 평가 결과를 생성하고, Solteti DB에 저장하는 AI 에이전트 시스템입니다. FR-2.1 요구사항에 따라 기사 콘텐츠를 분류, 스코어링, 증거 추출하여 최종 JSON을 생성합니다.

## 폴더 구조
```
python_services/packages/agent/news_agent/
├── code/
│   ├── run_news_agent.py              # 메인 실행 파일
│   ├── prompts.json                   # 기본 프롬프트 (카테고리 분류 등)
│   ├── article_assessment_prompts.json # 에이전트별 프롬프트
│   ├── solteti_agent_api.py           # Solteti API 클라이언트
│   ├── article_assessment_contract.py # JSON 스키마 검증
│   ├── solteti_article_test_flow.py   # end-to-end 테스트
│   ├── _debug_pending_items.py        # 디버깅 유틸
│   ├── _submit_finish_test.py         # finish_evaluation 테스트
│   ├── validate_input.py              # 입력 검증
│   ├── fastapi_app.py                 # FastAPI 서버
│   ├── web_app.py                     # 웹 앱
│   ├── DESIGN.md                      # 설계 문서
│   └── .env                           # 환경 변수 (민감 정보)
├── data/                              # 테스트 데이터
└── outputs/                           # 출력 결과
```

## 워크플로우 아키텍처

### 1. 입력 처리
- **입력**: 기사 제목, 본문, URL, 발행일 등
- **검증**: `has_sufficient_article_body()`로 본문 길이 확인 (content_raw ≥ 300자 또는 summary ≥ 120자)
- **전처리**: `build_article_input_from_package()`로 표준화된 입력 포맷 생성

### 2. 에이전트 체인 (4단계)

#### 2.1 entity_classifier (엔티티 분류 에이전트)
**목적**: 기사에서 대표 엔티티를 선택하고 분류
**입력**: 기사 콘텐츠 + allowed_entities 리스트
**출력**:
```json
{
  "representative_entity": {
    "id": "uuid",
    "page": "CASE_STUDIES",
    "category_id": "uuid",
    "category_name": "Anthropic",
    "name": "Claude 3.7 Sonnet"
  },
  "classification_candidates": [...],
  "decision_reason": "string",
  "side_category_code": "MODEL_RELEASE"
}
```
**프롬프트**: `article_assessment_prompts.json`의 "entity_classifier"

#### 2.2 content_scorer (콘텐츠 스코어링 에이전트)
**목적**: 기사 중요도 평가 및 요약 생성
**입력**: 기사 콘텐츠 + entity_classifier 결과
**출력**:
```json
{
  "ai_summary": "1-2문장 요약",
  "ai_score": 1-5,
  "score_breakdown": {
    "relevance": 1-5,
    "depth": 1-5,
    "novelty": 1-5,
    "practicality": 1-5,
    "rationale": "string"
  },
  "ai_snippets_json": {
    "why_it_matters": "string",
    "key_points": ["array"],
    "risk_notes": ["array"]
  }
}
```
**프롬프트**: `article_assessment_prompts.json`의 "content_scorer"

#### 2.3 evidence_extractor (증거 추출 에이전트)
**목적**: 기사에서 증거 기반 태그와 구조화된 정보 추출
**입력**: 기사 콘텐츠 + grounding_chunks
**출력**:
```json
{
  "ai_tags_json": [{"type": "TAG", "value": "string"}],
  "ai_evidence_json": {
    "evidence_items": [{"text": "string", "source": "string"}]
  },
  "ai_structured_extraction_json": {
    "source": {...},
    "review": {...}
  }
}
```
**프롬프트**: `article_assessment_prompts.json`의 "evidence_extractor"

#### 2.4 assessment_qa (최종 QA 에이전트)
**목적**: 모든 중간 결과를 통합하여 최종 계약 준수 JSON 생성
**입력**: 모든 이전 에이전트 결과 + 기사 콘텐츠
**출력**: 최종 `agent_json_raw` (DB 저장용)
```json
{
  "idempotency_key": "uas:uuid",
  "version": "0.3",
  "representative_entity": {...},
  "ai_summary": "string",
  "ai_score": 1-5,
  "ai_classification_json": {...},
  "side_category_code": "MODEL_RELEASE",
  "ai_tags_json": [...],
  "ai_snippets_json": {...},
  "ai_evidence_json": {...},
  "ai_structured_extraction_json": {...}
}
```
**프롬프트**: `article_assessment_prompts.json`의 "assessment_qa"

### 3. DB 저장
- **API 호출**: `finish_evaluation()`으로 Solteti API에 결과 전송
- **응답**: `{"saved": 1, "skipped": 0}` (성공 시)
- **저장 위치**: Solteti DB의 `content.user_article_ai_state` 테이블

## 입출력 정의사항

### 입력 스키마
```json
{
  "user_article_state_id": "uuid",
  "version": "0.3",
  "article": {
    "title": "string",
    "url": "string",
    "content_raw": "string (≥300자 권장)",
    "published_at": "2026-04-01T09:00:00+00:00"
  },
  "allowed_entities": [
    {
      "id": "uuid",
      "page": "CASE_STUDIES",
      "category_id": "uuid",
      "category_name": "Anthropic",
      "name": "Claude 3.7 Sonnet"
    }
  ]
}
```

### 출력 스키마 (agent_json_raw)
- `idempotency_key`: 고유 식별자 (`uas:uuid` 형식)
- `version`: 스키마 버전
- `representative_entity`: 선택된 대표 엔티티
- `ai_summary`: AI 생성 요약
- `ai_score`: 1-5 점수
- `ai_classification_json`: 분류 정보
- `side_category_code`: 부차 카테고리 코드
- `ai_tags_json`: 태그 배열
- `ai_snippets_json`: 스니펫 정보
- `ai_evidence_json`: 증거 정보
- `ai_structured_extraction_json`: 구조화된 추출 정보

## 조정 가능한 사항 및 방법

### 1. 카테고리 분류 (prompts.json)
**위치**: `code/prompts.json`의 "analyst" 프롬프트
**조정 방법**:
- 각 카테고리별 예시 추가/수정
- 키워드 힌트 강화 (예: "released", "announced" → Model Release)
**예시**:
```json
"analyst": "Choose a category from:\n- Model Release: 'Claude 5.4 released', 'new version'\n- Research: 'arXiv paper', 'algorithm breakthrough'"
```

### 2. 에이전트 프롬프트 (article_assessment_prompts.json)
**조정 방법**:
- 각 에이전트별 프롬프트 수정
- 출력 형식 변경 (JSON 키 추가/제거)
- 평가 기준 조정 (점수 범위, 태그 유형 등)

### 3. 검증 규칙 (article_assessment_contract.py)
**조정 방법**:
- 필수 필드 추가/제거
- 데이터 타입 검증 강화
- 값 범위 제한

### 4. 본문 길이 임계값 (run_news_agent.py)
**위치**: `has_sufficient_article_body()` 함수
**현재**: `content_raw ≥ 300` 또는 `summary ≥ 120`
**조정**: 상수 값 변경

### 5. 엔티티 선택 로직 (run_news_agent.py)
**위치**: `resolve_representative_entity()` 함수
**조정**: 우선순위 알고리즘 수정

## DB 테스트 방법

### 1. 환경 설정
```bash
# .env 파일 생성
OPENAI_API_KEY=your_key
OPENAI_MODEL=model_select
AGENT_API_KEY=your_solteti_key
SOLTETI_AGENT_API_BASE_URL=https://api.solteti.site/api/agent
DATABASE_URL=postgresql://user:pass@host:port/db
```

### 2. 단일 기사 테스트
```bash
cd python_services/packages/agent/news_agent/code
python run_news_agent.py --input-file test_input.json --output-file result.json
```

### 3. End-to-End 테스트 (DB까지)
```bash
# 기사 삽입 → 평가 요청 → 로컬 처리 → DB 저장
python solteti_article_test_flow.py --payload-file data/insert_article_test_payloads.json --submit-results
```

### 4. 결과 확인
- **로컬 출력**: `outputs/` 폴더의 JSON 파일
- **DB 저장 확인**: Solteti API의 `ask_evaluation`으로 pending 상태 확인
- **완료 확인**: `finish_evaluation` 응답의 `saved: 1`

## 주요 파일 설명

### run_news_agent.py
- 메인 워크플로우 실행
- 4개 에이전트 체인 관리
- DB 연결 및 API 호출

### solteti_agent_api.py
- Solteti API 클라이언트
- `insert_article()`, `ask_evaluation()`, `finish_evaluation()` 함수

### solteti_article_test_flow.py
- 완전한 end-to-end 테스트
- 기사 삽입부터 DB 저장까지 자동화

### article_assessment_contract.py
- 최종 JSON 스키마 검증
- 계약 준수 여부 확인

## 주의사항
- 모든 AI 출력은 영어로 생성됨
- `content_raw`가 없는 경우 `content` 필드로 폴백
- DB 저장 전 모든 검증 통과해야 함
- `idempotency_key`로 중복 방지

