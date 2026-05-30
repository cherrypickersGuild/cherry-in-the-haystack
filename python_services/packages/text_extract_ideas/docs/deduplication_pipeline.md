# 중복제거 파이프라인 (Deduplication Pipeline)

## 개요

PDF에서 추출한 문단(청크)과 아이디어의 중복을 탐지하여 불필요한 LLM 호출과 DB 저장을 방지합니다.

### 핵심 설계

- **LangGraph 노드에 통합**: `process_section` 노드 내부에서 청킹 → 중복체크 → 아이디어추출 → 저장을 일괄 처리
- **다단계 중복제거**: SHA256 → SimHash → 임베딩 → 아이디어 텍스트 매칭
- **비용 최적화**: 해시 중복이면 LLM 호출 자체를 스킵

---

## 파이프라인 구조

### LangGraph 워크플로우

```
extract_text → detect_structure → create_book → process_section (loop) → finalize
                                                      │
                                                      ▼
                                              [각 청크마다]
                                         _check_chunk_duplicate
                                                │
                                    ┌───────────┴───────────┐
                                    ▼                       ▼
                               (중복) skip              (신규) _extract_idea
                                                            │
                                                            ▼
                                                   _check_idea_duplicate
                                                            │
                                                ┌───────────┴───────────┐
                                                ▼                       ▼
                                           (중복) skip              (신규) _save_to_db
```

### 중복체크 흐름

```
청크 텍스트
    │
    ▼
1단계: SHA256 해시 정확 매칭 (무료, 즉시)
    │ (일치) → 중복으로 스킵
    ▼
[enable_semantic_dedup=True 시]
    │
    ├─ 2단계: SimHash 퍼지 매칭 (무료, 즉시)
    │     │ (유사) → 중복으로 스킵
    │     ▼
    └─ 3단계: 임베딩 의미적 매칭 (API 비용, ~200ms)
          │ (유사도 >= threshold) → 중복으로 스킵
          ▼
4단계: LLM 아이디어 추출
    │
    ▼
5단계: concept 문자열 매칭 (무료, DB 쿼리)
    │ (일치) → 중복으로 스킵
    ▼
6단계: DB 저장 + 임베딩 저장 (enable_semantic_dedup=True 시)
```

**중요**: `enable_semantic_dedup=True`일 때 새 청크 저장 시 임베딩도 함께 생성하여 `paragraph_embeddings` 테이블에 저장합니다. 이렇게 해야 다음 청크 처리 시 임베딩 기반 중복 체크가 작동합니다.

---

## 파일 구조

### 핵심 파일

```
src/
├── workflow/
│   ├── workflow.py              # LangGraph 워크플로우 정의
│   └── nodes/
│       └── process_section.py   # 섹션 처리 + 중복제거 통합
│
├── dedup/
│   ├── hash_utils.py            # SHA256, SimHash 해시 계산
│   ├── embedding_utils.py       # OpenAI 임베딩 생성
│   └── dedup_service.py         # DeduplicationService 클래스
│
└── db/
    └── models.py                # paragraph_hash, simhash64 필드

scripts/
    └── generate_embeddings.py   # 배치 임베딩 생성 CLI
```

### process_section.py 내부 함수

| 함수 | 역할 |
|------|------|
| `_chunk_section()` | 섹션 텍스트 → 문단 분할 + 해시 계산 |
| `_check_chunk_duplicate()` | SHA256 + SimHash + 임베딩 중복 체크 |
| `_extract_idea()` | LLM으로 아이디어 추출 |
| `_check_idea_duplicate()` | concept 문자열 중복 체크 |
| `_save_to_db()` | 청크 + 아이디어 + 임베딩 DB 저장 |

---

## 중복제거 단계별 설명

### 1단계: SHA256 해시 (정확 매칭)

```python
# src/dedup/hash_utils.py
def compute_paragraph_hash(text: str) -> str:
    normalized = normalize_text(text)
    return hashlib.sha256(normalized.encode()).hexdigest()
```

- 텍스트 정규화 후 SHA256 해시 생성
- 완전히 동일한 텍스트만 중복으로 판단
- **비용**: 무료, 즉시 (μs)
- **항상 실행**

### 2단계: SimHash (퍼지 매칭)

```python
# src/dedup/hash_utils.py
def compute_simhash64(text: str) -> int:
    # 64비트 SimHash 생성

def hamming_distance(hash1: int, hash2: int) -> int:
    # 해밍 거리 계산 (비트 차이 수)
```

- 글자가 약간 다른 유사 텍스트 탐지
- 해밍 거리 6 이하면 중복으로 판단
- **비용**: 무료, 즉시 (μs)
- **enable_semantic_dedup=True 시 실행**

**예시:**
```
"Transformer는 attention을 사용한다"
"Transformer는 attention을 활용한다"
→ 해밍 거리 작음 → 중복
```

### 3단계: 임베딩 (의미적 매칭)

```python
# src/dedup/dedup_service.py
def find_semantic_duplicate(self, text, book_id, cross_book):
    embedding = compute_embedding(text)
    # pgvector 코사인 유사도 검색
    # 유사도 >= threshold → 중복
```

- 의미적으로 유사한 텍스트 탐지
- OpenAI text-embedding-3-small 사용
- pgvector로 코사인 유사도 검색
- **비용**: API 호출 (~$0.00002/1K tokens)
- **enable_semantic_dedup=True 시 실행**

**예시:**
```
"Transformer는 attention 메커니즘을 사용한다"
"Attention mechanism이 Transformer의 핵심이다"
→ 글자 순서 다름 → SimHash ❌
→ 의미 동일 → 임베딩 유사도 높음 ✅
```

### 4단계: 아이디어 추출 (LLM)

```python
# process_section.py
def _extract_idea(chunk_text, hierarchy_path, prev_text, next_text):
    llm = get_default_llm()
    structured_llm = llm.with_structured_output(ExtractedIdea)
    # ...
```

- 중복이 아닌 청크만 LLM 호출
- 컨텍스트(앞뒤 문단, 계층 경로) 포함하여 추출
- **비용**: LLM API 호출

### 5단계: concept 문자열 매칭

```python
# process_section.py
def _check_idea_duplicate(concept: str, book_id: int) -> bool:
    existing = session.query(KeyIdea).filter(
        KeyIdea.core_idea_text == concept,
        KeyIdea.book_id == book_id
    ).first()
    return existing is not None
```

- LLM이 추출한 concept을 DB에서 검색
- 정확히 같은 문자열만 중복으로 판단
- **비용**: 무료 (DB 쿼리)

**왜 문자열 매칭인가?**
- `"Transformer"`와 `"Transformer architecture"`는 다른 개념
- 임베딩으로 비교하면 유사하다고 판단될 수 있음
- 서로 다른 관점을 담고 있으므로 둘 다 저장하는 것이 적절

### 6단계: DB 저장 + 임베딩 생성

```python
# process_section.py
def _save_to_db(chunk, extracted_idea, book_id, ..., enable_semantic_dedup=False):
    # 1. ParagraphChunk 저장 (해시 포함)
    db_chunk = DBParagraphChunk(
        body_text=chunk.text,
        paragraph_hash=chunk.paragraph_hash,
        simhash64=chunk.simhash64,
        ...
    )
    session.add(db_chunk)
    session.flush()

    # 2. 임베딩 생성 및 저장 (enable_semantic_dedup=True 시)
    if enable_semantic_dedup:
        embedding_result = compute_embedding(chunk.text)
        db_embedding = ParagraphEmbedding(
            chunk_id=db_chunk.id,
            embedding=embedding_result.embedding,
            ...
        )
        session.add(db_embedding)

    # 3. KeyIdea 저장
    ...
```

- 새 청크 저장 시 임베딩도 함께 생성
- `paragraph_embeddings` 테이블에 저장
- **비용**: OpenAI API 호출 (~$0.00002/1K tokens)
- 다음 청크 처리 시 임베딩 기반 중복 체크 가능

---

## 사용 방법

### 기본 실행 (SHA256 해시만)

```bash
python run_pipeline.py "book.pdf"
```

출력:
```
→ 시맨틱 중복제거: ❌
```

### 시맨틱 중복제거 활성화 (SimHash + 임베딩)

```python
# run_pipeline.py
result = run_pdf_pipeline(
    pdf_path=pdf_path,
    model_version=model_version,
    enable_semantic_dedup=True,      # SimHash + 임베딩 활성화
    semantic_threshold=0.95,         # 임베딩 유사도 임계값
)
```

출력:
```
→ 시맨틱 중복제거: ✅
```

### 파라미터

| 파라미터 | 기본값 | 설명 |
|---------|--------|------|
| `enable_semantic_dedup` | `False` | SimHash + 임베딩 중복제거 활성화 |
| `semantic_threshold` | `0.95` | 임베딩 코사인 유사도 임계값 |

---

## 통계 출력

```
============================================================
📊 처리 요약
============================================================
총 챕터: 10
총 섹션: 45
완료된 섹션: 45
실패한 섹션: 0
총 문단: 320
추출된 아이디어: 280
────────────────────────────────────────
중복 스킵 상세:
  해시 기반: 15           # SHA256 + SimHash
  임베딩 기반: 8          # OpenAI 임베딩
  아이디어 기반: 17       # concept 문자열 매칭
  총 스킵: 40
============================================================
```

---

## DB 스키마

### paragraph_chunks 테이블

```sql
ALTER TABLE paragraph_chunks ADD COLUMN paragraph_hash VARCHAR(64);
ALTER TABLE paragraph_chunks ADD COLUMN simhash64 BIGINT;
```

### paragraph_embeddings 테이블 (pgvector 필요)

```sql
CREATE TABLE paragraph_embeddings (
    id SERIAL PRIMARY KEY,
    chunk_id INTEGER REFERENCES paragraph_chunks(id) UNIQUE,
    book_id INTEGER REFERENCES books(id),
    embedding vector(1536),
    model_name VARCHAR(100) DEFAULT 'text-embedding-3-small'
);

-- 인덱스
CREATE INDEX ON paragraph_embeddings
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## 비용 분석

### 중복제거 방식별 비교

| 방식 | 속도 | 비용 | 탐지 범위 |
|-----|------|------|----------|
| SHA256 | 즉시 (μs) | 무료 | 완전 동일 |
| SimHash | 즉시 (μs) | 무료 | 글자 변형 |
| 임베딩 | ~200ms | $0.00002/1K tokens | 의미적 유사 |
| concept 매칭 | 즉시 | 무료 (DB) | 정확히 동일 |

### 왜 다단계로 처리하는가?

**100개 청크 처리 시:**
- 임베딩만: 100 API 호출 → ~20초, ~$0.004
- 해시 + 임베딩: 해시에서 80개 스킵 → 20 API 호출 → ~4초, ~$0.0008

→ **해시 = 무료 1차 필터, 임베딩 = 정밀 2차 필터**

---

## 코드 흐름 요약

```python
# process_section.py

def _check_chunk_duplicate(chunk, book_id, enable_semantic_dedup, semantic_threshold):
    # 1. SHA256 해시 정확 매칭 (항상)
    existing = session.query(DBParagraphChunk).filter(
        DBParagraphChunk.paragraph_hash == chunk.paragraph_hash
    ).first()
    if existing:
        return True

    # 2-3. SimHash + 임베딩 (enable_semantic_dedup=True 시)
    if enable_semantic_dedup:
        dedup_service = DeduplicationService(session, enable_semantic=True)

        # SimHash 퍼지 매칭
        fuzzy_matches = dedup_service.find_fuzzy_duplicates(chunk.simhash64, book_id)
        if fuzzy_matches:
            return True

        # 임베딩 의미적 매칭
        semantic_match = dedup_service.find_semantic_duplicate(chunk.text, book_id)
        if semantic_match:
            return True

    return False


def _process_chunk(chunk, book_id, ...):
    # 1. 청크 중복 체크 (먼저!)
    if _check_chunk_duplicate(chunk, book_id, enable_semantic_dedup):
        return {"is_chunk_duplicate": True}  # LLM 호출 스킵

    # 2. LLM 아이디어 추출
    extracted_idea = _extract_idea(chunk_text, ...)

    # 3. 아이디어 중복 체크
    concept = get_concept_from_idea(extracted_idea)
    if _check_idea_duplicate(concept, book_id):
        return {"is_idea_duplicate": True}

    # 4. DB 저장
    _save_to_db(chunk, extracted_idea, book_id, ...)
    return {"saved": True}
```

---

## 테스트

```bash
# 가상환경 활성화
source venv/bin/activate

# 파이프라인 실행
python run_pipeline.py "tests/Reflexion.pdf" gemini-2.5-flash
```

### 중복제거 확인 방법

1. 같은 PDF를 두 번 실행
2. 두 번째 실행 시 `해시 기반` 스킵 수가 증가하면 정상 작동

---

## scripts/generate_embeddings.py 용도

### 실시간 vs 배치 임베딩 생성

| 시나리오 | 임베딩 생성 방식 |
|---------|-----------------|
| **새 PDF 처리** | `_save_to_db()`에서 실시간 생성 |
| **기존 데이터** | `generate_embeddings.py`로 배치 생성 |

### generate_embeddings.py가 필요한 경우

1. **기존 데이터 마이그레이션**: 이전에 `enable_semantic_dedup=False`로 처리한 청크들
2. **임베딩 모델 변경**: `text-embedding-3-small` → 다른 모델로 교체 시
3. **임베딩 재생성**: 기존 임베딩 삭제 후 다시 생성

### 결론

```
새 데이터 → _save_to_db()에서 실시간 생성 (enable_semantic_dedup=True)
기존 데이터 → scripts/generate_embeddings.py로 배치 생성
```

`enable_semantic_dedup=True`로 처음부터 실행하면 `generate_embeddings.py`를 별도로 실행할 필요 없음.
단, 기존 데이터가 있거나 일괄 재생성이 필요할 때를 위해 스크립트는 유지.

---

## 구현 상태

| 기능 | 상태 | 파일 |
|------|------|------|
| SHA256 해시 | ✅ 완료 | `hash_utils.py` |
| SimHash 퍼지 매칭 | ✅ 완료 | `hash_utils.py`, `dedup_service.py` |
| 임베딩 의미적 매칭 | ✅ 완료 | `embedding_utils.py`, `dedup_service.py` |
| 청크 중복 체크 | ✅ 완료 | `process_section.py` |
| 아이디어 중복 체크 | ✅ 완료 | `process_section.py` |
| LangGraph 통합 | ✅ 완료 | `workflow.py` |
| 배치 임베딩 생성 | ✅ 완료 | `generate_embeddings.py` |
