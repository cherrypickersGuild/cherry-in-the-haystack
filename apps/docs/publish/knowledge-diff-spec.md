# 지식 Diff & 버전 관리 기획서 (Post-Hackathon)

**작성일:** 2026-04-14
**우선순위:** Phase 2 (해커톤 이후)
**근거:** 기획자 요구사항 — 에이전트가 구매/업데이트 시 변경 내역을 확인할 수 있어야 함

---

## 1. 배경

에이전트가 Cherry에서 지식을 구매하면:
- 처음 구매: content_md 전체를 받음
- 팔로우 중 업데이트: 새 content_md를 받음

**문제:** 업데이트 시 "뭐가 바뀌었는지" 모름. 전체를 다시 읽어야 함.

**기획자 요구:** git diff처럼 이전 버전과 현재 버전의 차이를 보여주는 기능.

---

## 2. 필요한 기능

### 2-1. 에이전트 로컬 파일 관리
- 구매 시 content_md를 로컬 파일로 저장 (예: `cherry-knowledge/rag.md`)
- 구매 목록 파일 유지 (예: `cherry-knowledge/inventory.json`)
- 업데이트 시 기존 파일 덮어쓰기 + diff 생성

### 2-2. 지식 버전 이력
- concept가 업데이트될 때마다 이전 버전을 보존
- 에이전트가 "내가 마지막으로 받은 버전" 이후 변경사항만 요청 가능

### 2-3. Diff 표현
- 마크다운 diff (추가/삭제/변경된 섹션)
- 새로 추가된 evidence
- 변경된 quality_score, source_count

---

## 3. DB 설계 (추후 추가)

### kaas.concept_version (신규 테이블)

```sql
CREATE TABLE kaas.concept_version (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id VARCHAR(100) NOT NULL REFERENCES kaas.concept(id),
  version_no INTEGER NOT NULL,
  content_md TEXT,
  summary TEXT,
  quality_score NUMERIC(3,1),
  source_count INTEGER,
  change_note TEXT,             -- "Context prefix 기법 추가, evidence 1건 신규"
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_kaas_concept_version ON kaas.concept_version (concept_id, version_no);
```

### kaas.agent_knowledge (에이전트별 보유 지식 버전 추적)

```sql
CREATE TABLE kaas.agent_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES kaas.agent(id),
  concept_id VARCHAR(100) NOT NULL REFERENCES kaas.concept(id),
  acquired_version INTEGER NOT NULL,  -- 구매 시점의 version_no
  acquired_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(agent_id, concept_id)
);
```

---

## 4. API 설계 (추후 추가)

### GET /api/v1/kaas/concepts/:id/versions
- 개념의 버전 이력 조회
- 응답: `[{ version_no, change_note, created_at }, ...]`

### GET /api/v1/kaas/concepts/:id/diff?since_version=3
- 특정 버전 이후 변경 내역
- 응답: `{ added_sections: [...], removed_sections: [...], changed_evidence: [...], change_note }`

### MCP Tool: get_knowledge_diff
```
Tool: get_knowledge_diff
Input: { concept_id: "rag", since_version: 3 }
Output: { diff_md: "...", new_evidence: [...], change_note: "..." }
```

---

## 5. 에이전트 로컬 파일 구조 (권장)

```
cherry-knowledge/
├── inventory.json          # 구매 목록 + 버전 추적
│   [{ "concept_id": "rag", "version": 5, "acquired_at": "2026-04-14" }]
├── rag.md                  # RAG 지식 본문
├── chain-of-thought.md     # CoT 지식 본문
└── .diff/                  # 업데이트 diff 이력
    ├── rag-v4-to-v5.diff
    └── chain-of-thought-v2-to-v3.diff
```

---

## 6. 구현 순서 (Phase 2)

1. kaas.concept에 version_no 컬럼 추가
2. kaas.concept_version 테이블 생성
3. concept 업데이트 시 이전 버전을 concept_version에 자동 복사
4. kaas.agent_knowledge 테이블로 에이전트별 보유 버전 추적
5. diff API 구현 (text-diff 라이브러리 활용)
6. MCP Tool: get_knowledge_diff 추가
7. 프론트엔드: 업데이트 알림 + diff 뷰어

---

## 7. 현재 구조와의 호환성

- 현재 `kaas.concept.updated_at`이 이미 있으므로, 버전 추가 시 하위 호환 가능
- `kaas.concept.content_md`는 항상 최신 버전 유지, 이전 버전은 concept_version에 보존
- 에이전트 제출 형식 `{ topic, lastUpdated }`도 `{ topic, lastUpdated, version }`으로 확장 가능
