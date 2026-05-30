# 온톨로지 파이프라인 테스트 가이드

## 사전 준비

```bash
# GraphDB 실행 확인
docker ps --filter name=cherry-graphdb

# 안 떠있으면:
docker compose up -d graphdb
```

---

## 1. GraphDB 현재 상태 확인

### 브라우저 (시각적)
- **GraphDB Workbench**: http://localhost:7200
- 왼쪽 메뉴 `Explore` → `Class hierarchy` → 트리 구조 시각화
- 왼쪽 메뉴 `SPARQL` → 쿼리 실행

### SPARQL 쿼리
```bash
# 전체 트리플 수
curl -s http://localhost:7200/repositories/llm-ontology/size

# 클래스 개수
curl -s -X POST http://localhost:7200/repositories/llm-ontology \
  -H "Content-Type: application/sparql-query" \
  -H "Accept: application/json" \
  --data "PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT (COUNT(*) AS ?count) WHERE { ?s a owl:Class . }"

# 전체 클래스 계층 구조
curl -s -X POST http://localhost:7200/repositories/llm-ontology \
  -H "Content-Type: application/sparql-query" \
  -H "Accept: application/json" \
  --data "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX llm: <http://example.org/llm-ontology#>
SELECT ?child ?parent WHERE { ?child rdfs:subClassOf ?parent . } ORDER BY ?parent"
```

---

## 2. GraphDB 초기화 + 기본 온톨로지 재로드

```bash
# 전체 삭제
curl -s -X POST http://localhost:7200/repositories/llm-ontology/statements \
  -H "Content-Type: application/sparql-update" \
  --data "DELETE WHERE { ?s ?p ?o . }"

# 기본 온톨로지 로드 (222개 클래스)
curl -s -X POST http://localhost:7200/repositories/llm-ontology/statements \
  -H "Content-Type: text/turtle" \
  --data-binary "@data/llm_ontology.ttl"

# 확인
curl -s http://localhost:7200/repositories/llm-ontology/size
# → 896 정도 나와야 함
```

---

## 3. 첫 번째 PDF → GraphDB 업로드

### Step A: PDF → JSONL 변환 (text_extract_ideas)

```bash
# 프로젝트 루트에서
.venv/bin/python python_services/packages/text_extract_ideas/run_pipeline.py \
  ".assets_pdf/AI Engineering.pdf"
```

> 이 파이프라인은 PDF에서 챕터/섹션을 추출하고, 각 문단에서 개념(concept)을 뽑아 JSONL 형식으로 변환해.
> 결과는 DB(SQLite `local_dev.db`)의 `key_ideas`, `paragraph_chunks` 테이블에 저장돼.

### Step B: 개념을 온톨로지에 매핑

```bash
# 프로젝트 루트에서
.venv/bin/python python_services/packages/idea_to_graph_ontology/src/scripts/run_ontology_pipeline.py \
  --input python_services/packages/idea_to_graph_ontology/output_with_concepts.jsonl \
  --task-name "AI_Engineering" \
  --source "AI Engineering" \
  --debug
```

> `--debug`를 빼면 진행률만 표시돼.

### Step C: 결과 확인

```bash
# GraphDB Workbench http://localhost:7200 → SPARQL 탭에서:
```

**새로 추가된 클래스 목록:**
```sparql
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX llm: <http://example.org/llm-ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?concept ?label ?parent ?description
WHERE {
  ?concept a owl:Class ;
    rdfs:label ?label ;
    rdfs:subClassOf ?parent .
  OPTIONAL { ?concept llm:description ?description . }
}
ORDER BY ?parent
```

**계층 구조 (트리 뷰):**
```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?child ?parent WHERE {
  ?child rdfs:subClassOf ?parent .
}
```

**TOC 생성 (CLI):**
```bash
.venv/bin/python python_services/packages/idea_to_graph_ontology/src/scripts/run_ontology_pipeline.py --toc-only
```

**Layer 2 로그 (LLM 결정 과정):**
```bash
ls -lt python_services/packages/idea_to_graph_ontology/db/pipeline_logs/ | head -5
cat python_services/packages/idea_to_graph_ontology/db/pipeline_logs/layer2_log_*.json | python3 -m json.tool | head -60
```

---

## 4. 두 번째 PDF → GraphDB (중복 체크 검증)

### Step A: 두 번째 PDF 변환

```bash
.venv/bin/python python_services/packages/text_extract_ideas/run_pipeline.py \
  ".assets_pdf/building-applications-with-ai-agents-designing-and-implementing-multiagent-systems-1_compress.pdf"
```

### Step B: 온톨로지 매핑 (중복 체크 활성화됨)

```bash
.venv/bin/python python_services/packages/idea_to_graph_ontology/src/scripts/run_ontology_pipeline.py \
  --input python_services/packages/idea_to_graph_ontology/output_with_concepts.jsonl \
  --task-name "AI_Agents" \
  --source "Building AI Agents" \
  --debug
```

> 출력에서 `Added`, `Duplicates (exact)`, `Duplicates (near)` 수치를 확인해.
> - `Added`: 새로 추가된 개념
> - `Duplicates (exact)`: GraphDB에 이미 존재해서 스킵
> - `Duplicates (near)`: 벡터 유사도가 너무 높아서 스킵

### Step C: 중복 체크 검증

```bash
# GraphDB Workbench http://localhost:7200 → SPARQL
```

**두 번째 책에서 추가된 개념만 보기:**
```sparql
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX llm: <http://example.org/llm-ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?concept ?label ?parent
WHERE {
  ?concept a owl:Class ;
    rdfs:label ?label ;
    rdfs:subClassOf ?parent .
}
ORDER BY ?parent
```

**시각적 계층 구조 확인** (GraphDB Workbench):
1. `Explore` → `Class hierarchy` → 전체 트리 확인
2. 새로 추가된 노드들이 적절한 parent 아래 있는지 확인
3. 중복 개념이 없는지 확인
