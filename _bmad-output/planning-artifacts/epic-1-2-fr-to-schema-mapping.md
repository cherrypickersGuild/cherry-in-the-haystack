# Epic 1+2: Functional Requirements → Schema Mapping

**작성일:** 2026-04-07
**목적:** Epic 1+2 기능 요구사항을 DDL v1.1 스키마에 매핑하여 데이터 흐름과 갭 식별

---

## 📊 매핑 레전드

| 기호 | 의미 |
|------|------|
| ✅ | 스키마에 테이블/컬럼 존재, 사용 가능 |
| ⚠️ | 스키마에 있지만 명확하지 않거나 개선 필요 |
| ❌ | 스키마에 없음 - 추가 필요 |
| 🔄 | 기존 데이터 변환 필요 |

---

## 📋 Epic 1: Discover Curated Content (Universal)

### FR-1.1: Multi-Source Content Collection

| 기능 요구사항 | 스키마 매핑 | 상태 | 비고 |
|-------------|-----------|------|------|
| 다양한 소스에서 콘텐츠 수집 (Twitter, Discord, GitHub, papers, blogs, RSS) | `content.source` 테이블 | ✅ | `type` 컬럼: RSS, TWITTER, LINKEDIN, YOUTUBE, REDDIT, KAKAO, WEBSITE, CUSTOM |
| 소스 메타데이터 보존 (URL, 날짜, 작성자, 플랫폼) | `content.article_raw` | ✅ | `url`, `published_at`, `author`, `source_id`, `fetched_at` |
| 10개 이상 소스 설정 | `content.source.is_active` | ✅ | N/A |
| 24시간 내 새 콘텐츠 발견 | `content.article_raw.fetched_at` | ✅ | 쿼리 가능 |
| 소스 우선순위/카테고리 설정 | `content.source_meta_json` | ✅ | JSONB로 유연 설정 가능 |
| 소스 활성/비활성 토글 | `content.source.is_active` | ✅ | N/A |
| 소스 건강 모니터링 | `content.source.last_fetched_at`, `last_success_at`, `is_healthy` | ✅ | N/A |

**데이터 흐름:**
```
외부 소스 → content.source(설정) → content.article_raw(수집된 기사)
```

---

### FR-1.2: Intelligent Deduplication

| 기능 요구사항 | 스키마 매핑 | 상태 | 비고 |
|-------------|-----------|------|------|
| 콘텐츠 수준 중복 제거 (정확/유사 일치) | `content.article_raw.url_hash`, `guid_hash`, `normalized_url_hash`, `canonical_url_hash`, `content_hash` | ✅ | 여러 해시로 다양한 중복 탐지 |
| 청크 수준 중복 제거 (문단 유사도) | `handbook.paragraph_chunk.paragraph_hash`, `simhash64` | ✅ | LSH(SimHash64)로 유사 문단 탐지 |
| 95%+ 정확도 | - | 🔄 | 애플리케이션 로직으로 구현 필요 |
| 병합된 중복의 원본 소스 보존 | `content.article_raw.representative_key` | ✅ | 대표 키로 원본 추적 |
| AI 점수 매기기 전 중복 제거 | `content.article_raw` → `content.user_article_ai_state` | ✅ | 순서: raw → dedup → AI 처리 |

**데이터 흐름:**
```
article_raw(중복 체크) → 중복 제거 → user_article_ai_state(AI 점수)
```

---

### FR-2.1: AI-Powered Content Scoring

| 기능 요구사항 | 스키마 매핑 | 상태 | 비고 |
|-------------|-----------|------|------|
| AI 에이전트로 콘텐츠 평가 (1-5 점수) | `content.user_article_ai_state.ai_score` | ✅ | SMALLINT, 1-5 제약조건 있음 |
| 5점 = 최상위 콘텐츠 | `content.user_article_ai_state.ai_score = 5` | ✅ | N/A |
| 5분 내 점수 완료 | `content.user_article_ai_state.ai_processed_at` | ✅ | 타임스탬프로 모니터링 |
| 패턴 기반 학습으로 점수 개선 | `core.run_log` (이력) | ✅ | 과거 실행 로그로 학습 가능 |
| AI 점수 기준 (관련성, 깊이, 참신성, 실용성) | `content.user_article_ai_state.ai_summary`, `ai_classification_json` | ✅ | JSONB로 유연 저장 |

**데이터 흐름:**
```
user_article_state(생성) → user_article_ai_state(AI 처리) → ai_score 저장
```

---

### FR-2.2: Knowledge Team Review Workflow

| 기능 요구사항 | 스키마 매핑 | 상태 | 비고 |
|-------------|-----------|------|------|
| Notion에서 구조화된 주간 검토/승인 프로세스 | 외부 시스템 | 🔄 | Notion 외부, sync 필요 |
| 점수 5 항목 자동 할당 | `content.curated_article.review_status = 'Pending'` | ✅ | 점수 5인 항목 curated_article로 |
| 요약 검증, 점수 조정, 편집 요청 | `content.curated_article.summary`, `score` | ✅ | 수동 업데이트 가능 |
| 주간 검토 주기 (수요일) | `content.curated_article.week_start` | ✅ | 주차별 관리 |
| 온톨로지 그래프 매핑 (LLM 지원) | `content.curated_article.tracked_entity_id` | ✅ | 엔티티 연결 |
| 상태 추적: pending → in_review → finished | `content.curated_article.review_status` | ✅ | Pending, Approved, Rejected, Published |
| 상위 20개 완료 항목 → 뉴스레터 생성 | `content.curated_article` | ✅ | score=5, review_status='Published' 쿼리 |
| 감사 추적 | `content.curated_article.reviewer_user_id`, `updated_at` | ✅ | N/A |

**데이터 흐름:**
```
AI 점수 5인 항목 → curated_article 생성 → Knowledge Team 검토 → review_status 업데이트 → 뉴스레터
```

---

### FR-2.3: Content Value Assessment

| 기능 요구사항 | 스키마 매핑 | 상태 | 비고 |
|-------------|-----------|------|------|
| 청크 수준 (문단) 분석으로 참신성 | `content.user_article_ai_state.ai_snippets_json` | ✅ | 문단별 추출 정보 |
| 기존 콘텐츠와 벡터 DB 비교 | `handbook.paragraph_embedding` | ✅ | pgvector로 유사도 검색 |
| "Unique" 플래그로 진정한 참신 정보 | ❌ | ⚠️ | ai_snippets_json 내에 플래그 추가 필요 |
| 가치 점수 (참신성, 깊이, 실용성, 증거 품질) | `content.user_article_ai_state.ai_score`, `ai_classification_json` | ✅ | N/A |

**데이터 흐름:**
```
user_article_ai_state → 문단 분석 → 벡터 유사도 검색 → 가치 점수 계산
```

---

### FR-5.1: Automated Publication Pipeline

| 기능 요구사항 | 스키마 매핑 | 상태 | 비고 |
|-------------|-----------|------|------|
| 주간 배치: Notion → Cherry app 업데이트 (마크다운) | ❌ | ⚠️ | 마크다운 파일 생성 프로세스 필요 |
| 제로 다운타임 배포 | 인프라 | ✅ | 배포 전략 |
| 롤백 기능 | 인프라 | ✅ | 이전 버전 보존 |

**데이터 흐름:**
```
Notion (Source of Truth) → curated_article → 마크다운 파일 생성 → GitHub → 배포
```

---

### FR-7.1: Content Source Configuration

| 기능 요구사항 | 스키마 매핑 | 상태 | 비고 |
|-------------|-----------|------|------|
| Newly Discovered 모니터링 소스 관리 | `content.source` | ✅ | N/A |
| 설정 파일: 소스 URL, 카테고리 매핑, 폴링 빈도 | `content.source_meta_json` | ✅ | JSONB로 저장 |
| 소스 유형: Twitter, Discord, GitHub, RSS, blogs | `content.source.type` | ✅ | ENUM으로 관리 |
| 소스별 활성/비활성 토글 | `content.source.is_active` | ✅ | N/A |
| 소스 건강 모니터링 (마지막 성공, 에러율) | `content.source.is_healthy`, `last_success_at`, `consecutive_failures` | ✅ | N/A |

---

### FR-9.1: Vector Storage for Deduplication

| 기능 요구사항 | 스키마 매핑 | 상태 | 비고 |
|-------------|-----------|------|------|
| 모든 고유 콘텐츠 청크 임베딩 저장 | `handbook.paragraph_embedding` | ✅ | vector(1536), pgvector |
| 소스, 카테고리, 날짜, 주제 인덱스 | `handbook.paragraph_embedding.handbook_topic`, 인덱스 | ✅ | N/A |
| 코사인 유사도 임계값으로 중복 탐지 | `vector_cosine_ops` | ✅ | ivfflat 인덱스 사용 |

---

## 📋 Epic 2: Learn Structured Concepts (Universal)

### FR-3.1: Graph Database Two-Layer Architecture

| 기능 요구사항 | 스키마 매핑 | 상태 | 비고 |
|-------------|-----------|------|------|
| **Concept Layer (Stable):** | | | |
| 고유 명사구 노드만 저장 (문장 X, 예시 X) | `content.concept_page` | ✅ | concept_name, concept_slug |
| 모든 소스에서 재사용 가능한 컨셉 | `content.concept_page` | ✅ | 플랫폼 전역 컨셉 |
| 관계 유형: prerequisite, related, subtopic, extends, contradicts | ❌ | ⚠️ | GraphDB (Neptune)에 저장, Postgres엔 없음 |
| Evidence는 Concept 노드에 저장 X (링크만) | `content.concept_page` | ✅ | content_md에 참조 |
| 컨셉 스키마: title, summary, relations, sources, contributors | `content.concept_page` | ✅ | N/A |
| 동적 관계 블록 렌더링 | 애플리케이션 | ✅ | content_md에서 렌더링 |
| **Evidence Layer (High Volume):** | | | |
| 문단/발췌를 별도로 저장 | `handbook.paragraph_chunk` | ✅ | body_text, paragraph_hash |
| 필수 메타데이터: source, location, text, excerpt, comment, tags, linked_concepts | `handbook.paragraph_chunk`, `handbook.paragraph_concept_link` | ✅ | extracted_concept로 연결 |
| Evidence 유형: paraphrase, direct quote, figure reference | `handbook.evidence_metadata.extract_type` | ✅ | N/A |
| 다중 컨셉 링크 (many-to-many) | `handbook.paragraph_concept_link` | ✅ | paragraph_chunk ↔ idea_group |
| Evidence 프리뷰: excerpt + source + comment | 애플리케이션 | ✅ | UI 조합 |
| **성능:** | | | |
| 500ms 이하 그래프 쿼리 | GraphDB | ✅ | Neptune으로 보장 |
| 페이지 생성 중 동시 읽기 지원 | GraphDB | ✅ | N/A |
| 컨셉 → 관련 컨셉 → evidence 체인 효율적 순회 | GraphDB | ✅ | N/A |
| **통합:** | | | |
| Vector DB와 공존 (중복 제거 전용) | `handbook.paragraph_embedding` | ✅ | pgvector와 함께 |
| 그래프 뷰는 컨셉만 표시 (evidence 노드 X) | 애플리케이션 | ✅ | UI에서 필터링 |

**데이터 흐름:**
```
GraphDB (Concept Layer):
concept nodes → relations →

PostgreSQL (Evidence Layer):
paragraph_chunk → paragraph_concept_link → idea_group
paragraph_embedding (pgvector)
```

**⚠️ 중요:** Concept Layer의 relations은 **GraphDB (Neptune)**에 저장, PostgreSQL의 `content.concept_page`는 렌더링된 결과만 저장

---

### FR-3.2: Ontology Extraction & Concept Discovery

| 기능 요구사항 | 스키마 매핑 | 상태 | 비고 |
|-------------|-----------|------|------|
| 월간 배치 작업 (둘째 토요일) | `core.run_log.run_kind = 'NEWLY_DISCOVERED_BUILD'` | ✅ | 스케줄러 관리 |
| Evidence layer에서 새 컨셉 명사구 추출 | `handbook.paragraph_concept_link.extracted_concept` | ✅ | 추출된 컨셉 |
| 단어 수와 빈도 메트릭으로 노이즈 필터링 | ❌ | ⚠️ | 추가 필드나 로직 필요 |
| LLM 지원 컨셉 관계 감지 | GraphDB | ✅ | N/A |
| Knowledge Team 검토용 컨셉 후보 | 애플리케이션 | ✅ | 검토 워크플로우 |
| 승인된 컨셉 Ontology Layer 추가 | `content.concept_page` + GraphDB | ✅ | N/A |
| 새 컨셉 기본값: Advanced 섹션 | `content.concept_page` | ✅ | N/A |

**데이터 흐름:**
```
paragraph_chunk → LLM 추출 → extracted_concept → Knowledge Team 검토 → concept_page 생성 + GraphDB 추가
```

---

### FR-3.3: Evidence Collection & Study Sessions

| 기능 요구사항 | 스키마 매핑 | 상태 | 비고 |
|-------------|-----------|------|------|
| 수요일 스터디 세션 | `core.run_log` | ✅ | 이력 추적 |
| 검토된 텍스트 Evidence Layer 저장 | `handbook.paragraph_chunk` | ✅ | N/A |
| 메타데이터: source, date, topic, quality | `handbook.paragraph_chunk`, `evidence_metadata` | ✅ | N/A |
| 텍스트 청킹 (효율적 저장/검색) | `handbook.paragraph_chunk` | ✅ | N/A |
| 관련 컨셉 연결 태그 | `handbook.paragraph_concept_link` | ✅ | N/A |
| 스터디 세션 노트 | `handbook.evidence_metadata` | ✅ | JSONB로 유연 저장 |

---

### FR-4.1: MECE Knowledge Organization

| 기능 요구사항 | 스키마 매핑 | 상태 | 비고 |
|-------------|-----------|------|------|
| 3개 섹션: Basics, Advanced, Newly Discovered | 애플리케이션 | ✅ | UI로 분류 |
| 2단계 계층: parent → child | 애플리케이션 | ✅ | UI로 표현 |
| 상호 배타적 (카테고리 중복 X) | `content.entity_category` | ✅ | page별 unique |
| 전체 커버리지 (95%) | ❌ | 🔄 | 측정 메트릭 필요 |
| 진화하는 분류체계 | `content.entity_category.is_active` | ✅ | revoked_at으로 비활성화 |

---

### FR-4.2: Writer Agent for Page Generation

| 기능 요구사항 | 스키마 매핑 | 상태 | 비고 |
|-------------|-----------|------|------|
| **Step 1:** Concept 스키마 쿼리 (Graph DB) | GraphDB | ✅ | N/A |
| **Step 2:** Evidence 스키마 쿼리 | `handbook.paragraph_chunk`, `paragraph_concept_link` | ✅ | N/A |
| **Step 3:** Concept Page UI 구조 따르기 | `content.concept_page.content_md` | ✅ | 마크다운으로 저장 |
| **Step 4:** 페이지 컨텐츠 작성 | `content.concept_page.content_md` | ✅ | N/A |
| Evidence 인용 + 속성 | `handbook.paragraph_chunk` | ✅ | source tracking |
| 동적 관계 블록 (비어있는 섹션 X) | 애플리케이션 | ✅ | 렌더링 로직 |
| Evidence 프리뷰 임베드 (excerpt + source + comment) | `handbook.evidence_metadata` | ✅ | N/A |
| Style guide 따르기 | LLM 프롬프트 | ✅ | prompt_template_version_id |
| 충돌하는 Evidence 플래그 | `handbook.evidence_metadata` | ✅ | JSONB로 플래그 |
| 10분 내 생성 완료 | `core.run_log` | ✅ | 실행 시간 추적 |
| 출력: Concept Page Structure 마크다운 | `content.concept_page.content_md` | ✅ | N/A |

**데이터 흐름:**
```
GraphDB (concept + relations) + handbook.paragraph_chunk (evidence)
→ Writer Agent → concept_page.content_md → concept_changelog
```

---

### FR-4.3: Concept Promotion Flow (Advanced → Basics)

| 기능 요구사항 | 스키마 매핑 | 상태 | 비고 |
|-------------|-----------|------|------|
| 새 컨셉 기본값 Advanced | 애플리케이션 | ✅ | UI 기본값 |
| 메트릭 기반 평가 (언급, 사용, 안정성) | ❌ | ⚠️ | 추가 테이블이나 로직 필요 |
| 월간 Knowledge Team 검토 (둘째 토요일) | `core.run_log` | ✅ | N/A |
| 승격: Advanced → Basics 페이지 업데이트 | `content.concept_page` | ✅ | content_md 업데이트 |
| 승격 결정 문서화 | `content.concept_changelog` | ✅ | change_summary |

---

### FR-4.4: Evolving Taxonomy Management

| 기능 요구사항 | 스키마 매핑 | 상태 | 비고 |
|-------------|-----------|------|------|
| 새 카테고리 추가 (재구성 X) | `content.entity_category` | ✅ | INSERT만 |
| 콘텐츠 재할당 (분류체계 변경 시) | `content.tracked_entity_placement` | ✅ | revoked_at + 새 플레이스먼트 |
| 카테고리 폐기 + 콘텐츠 마이그레이션 계획 | `content.entity_category.revoked_at` | ✅ | N/A |
| Newly Discovered 카테고리 분기별 검토 | `content.entity_category` | ✅ | 수동 프로세스 |

---

### FR-7.2: Curated Text Management for Basics/Advanced

| 기능 요구사항 | 스키마 매핑 | 상태 | 비고 |
|-------------|-----------|------|------|
| 문서 레지스트리 (메타데이터) | `handbook.book` | ✅ | title, author, source_url, publication_date |
| 추출 파이프라인: PDF → text, web → markdown | `handbook.book.source_type`, `source_path` | ✅ | 외부 추출기 |
| 버전 추적 (업데이트된 소스) | ❌ | ⚠️ | book 테이블에 버전 관리 필요 |
| 소스 우선순위 (canonical vs supplementary) | `handbook.book.handbook_section` | ✅ | 섹션으로 우선순위 구분 |

---

### FR-8.1: Content Correction & Updates

| 기능 요구사항 | 스키마 매핑 | 상태 | 비고 |
|-------------|-----------|------|------|
| 에러 보고 메커니즘 (GitHub issues) | 외부 시스템 | ✅ | N/A |
| 긴급 수정용 Fast-track | `content.concept_page.updated_at` | ✅ | 즉시 업데이트 |
| "Last updated" 날짜 표시 | `content.concept_page.updated_at` | ✅ | N/A |
| 주요 업데이트용 Changelog | `content.concept_changelog` | ✅ | N/A |
| 폐기된 콘텐츠 명확 표시 | `content.concept_page.is_published = FALSE` | ✅ | N/A |

---

## 🔍 Gap Analysis (누락/개선 필요)

| ID | 요구사항 | 현황 | 필요 조치 |
|----|----------|------|-----------|
| G-1 | FR-1.2: 95% 정확도 중복 제거 | ❌ | 애플리케이션 로직 + 테스트 필요 |
| G-2 | FR-2.3: "Unique" 플래그 | ⚠️ | `ai_snippets_json` 내에 추가하거나 별도 컬럼 |
| G-3 | FR-3.1: Concept relations (Postgres) | ❌ | GraphDB에만 있음. 필요시 Postgres에도 복제 |
| G-4 | FR-3.2: 단어 수/빈도 메트릭 | ❌ | `paragraph_chunk`나 별도 테이블에 추가 |
| G-5 | FR-4.1: 95% 커버리지 측정 | ❌ | 메트릭 수집 로직 필요 |
| G-6 | FR-4.3: 컨셉 메트릭 (언급, 사용) | ❌ | 별도 테이블이나 `concept_meta_json` 필요 |
| G-7 | FR-5.1: Notion → 마크다운 파이프라인 | ❌ | TypeScript job으로 구현 필요 |
| G-8 | FR-7.2: 문서 버전 추적 | ⚠️ | `handbook.book`에 version 필드 추가 |

---

## 📊 Epic 1+2 핵심 테이블 요약

### Epic 1 (Discover Curated Content) 핵심 테이블:
1. `content.source` - 소스 설정
2. `content.article_raw` - 수집된 기사
3. `content.user_article_ai_state` - AI 처리 상태
4. `content.curated_article` - Knowledge Team 검토 대상
5. `handbook.paragraph_embedding` - 중복 제거용 벡터

### Epic 2 (Learn Structured Concepts) 핵심 테이블:
1. `content.concept_page` - 공개 컨셉 문서
2. `content.concept_changelog` - 컨셉 변경 이력
3. `handbook.book` - 소스 문서 메타데이터
4. `handbook.chapter` - 문서 장 구조
5. `handbook.section` - 문서 절 구조
6. `handbook.paragraph_chunk` - 청크된 텍스트 (Evidence)
7. `handbook.paragraph_concept_link` - 컨셉 연결
8. `handbook.evidence_metadata` - Evidence 메타데이터
9. `handbook.paragraph_embedding` - 벡터 임베딩
10. **GraphDB (Neptune)** - Concept Layer (relations)

---

## 🔄 주요 데이터 흐름 다이어그램

```
[EPIC 1: DISCOVER CURATED CONTENT]
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  External Sources                                               │
│  (Twitter, Discord, GitHub, RSS, blogs, papers)                │
│        ↓                                                         │
│  content.source (설정 관리)                                     │
│        ↓                                                         │
│  content.article_raw (수집, 중복 체크)                          │
│        ↓                                                         │
│  Deduplication (url_hash, content_hash)                         │
│        ↓                                                         │
│  content.user_article_state (생성)                              │
│        ↓                                                         │
│  content.user_article_ai_state (AI 점수, 분석)                  │
│        ↓                                                         │
│  Score = 5? → YES → content.curated_article                     │
│                    ↓                                             │
│            Knowledge Team Review (Notion)                        │
│                    ↓                                             │
│            review_status = 'Published'                           │
│                    ↓                                             │
│            Weekly Newsletter / Web Publishing                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

[EPIC 2: LEARN STRUCTURED CONCEPTS]
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  PDF / Web Sources                                               │
│  (Books, Papers, Documentation)                                 │
│        ↓                                                         │
│  handbook.book (메타데이터)                                     │
│        ↓                                                         │
│  PDF Extraction Pipeline (Python)                               │
│        ↓                                                         │
│  handbook.chapter / section (구조)                              │
│        ↓                                                         │
│  handbook.paragraph_chunk (청킹)                                │
│        ↓                                                         │
│  ┌──────────────────────┐                                       │
│  │                      │                                       │
│  ↓                      ↓                                       │
│ paragraph_embedding    paragraph_concept_link                   │
│ (pgvector)             (컨셉 연결)                              │
│  │                      │                                       │
│  └──────────────────────┘                                       │
│        ↓                                                         │
│  Ontology Extraction (LLM)                                      │
│        ↓                                                         │
│  ┌────────────────────────────────────┐                         │
│  │                                     │                         │
│  ↓                                     ↓                         │
│ GraphDB (Neptune)             content.concept_page               │
│ - Concept nodes                (Postgres)                         │
│ - Relations                    - content_md (generated)           │
│ - Evidence links               - concept_name, slug              │
│  │                               - is_published                   │
│  │                                                                │
│  ↓                                                                │
│ Writer Agent (LLM)                                                │
│  ↓                                                                │
│ concept_page.content_md (마크다운 생성)                           │
│  ↓                                                                │
│ concept_changelog (이력)                                          │
│  ↓                                                                │
│ Web Display (Four-section format)                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ 다음 단계 (Tech Lead)

### 즉시 할 일:
1. [ ] **Gap 해결:** G-2, G-4, G-6, G-8 마이그레이션 스크립트 작성
2. [ ] **API 계약:** 위 테이블 기반으로 Python ↔ TS API 명세 작성
3. [ ] **데이터 흐름 검증:** 각 흐름별 테스트 케이스 작성

### Epic 1+2 시작 회의 전 준비:
1. [ ] 이 매핑 문서 팀과 공유
2. [ ] Gap 분석에 대한 해결 방안 제시
3. [ ] 각 팀원별 작업 범위를 위 테이블 기반으로 명확화

---

**마지막 업데이트:** 2026-04-07
**버전:** 1.0
**상태:** Tech Lead 검토 필요
