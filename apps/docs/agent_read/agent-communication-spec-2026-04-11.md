# 에이전트 통신 기획서 — Hook 방식

> 작성일: 2026-04-11  
> 관련 스펙: agent-column-write-spec-2026-04-07.md

---

## 1. 개요

백엔드와 AI 에이전트가 **서로를 직접 호출하는 양방향 웹훅(Hook)** 구조.  
각 서버에 훅 수신 엔드포인트를 1개씩 추가하여 통신.

---

## 2. 통신 구조

```
┌──────────────────────────────────┐
│       NestJS Backend (:4000)     │
│                                  │
│  POST /to-backend/finish-evaluation  ◄──┐
│                                  │     │
└────────────┬─────────────────────┘     │
             │                           │
             │  POST /to-agent/table-ready│
             ▼                           │
┌──────────────────────────────────┐     │
│       Python AI Agent (:5000)    │     │
│                                  │     │
│  POST /to-agent/table-ready  ◄───┘     │
│                                  │     │
│  → LLM 처리 완료 후 ────────────────────┘
└──────────────────────────────────┘
```

---

## 3. 전체 흐름

```
[Step 1]  크론 or 수동 트리거
          POST /api/pipeline/pregen-ai-state
          → user_article_ai_state 생성 (ai_status = 'PENDING')

[Step 2]  백엔드 → 에이전트 훅
          POST /to-agent/table-ready
          ← 에이전트: 202 Accepted (즉시 응답, 비동기 처리 시작)

[Step 3]  에이전트 내부
          GET /api/pipeline/agent/jobs?limit=5
          → 백엔드에서 PENDING 목록 수신
          → LLM 처리 (30~60초/건)

[Step 4]  에이전트 → 백엔드 훅
          POST /to-backend/finish-evaluation
          → agent_json_raw 결과 전송

[Step 5]  백엔드 내부
          agent_json_raw 저장 → ai_status 복원
          → 다음 크론에서 parse-agent-json 실행 → SUCCESS/FAILED
```

---

## 4. 엔드포인트 명세

### 4-1. `POST /to-agent/table-ready`

| 항목 | 내용 |
|------|------|
| 호출 주체 | NestJS 백엔드 |
| 수신 주체 | Python AI Agent |
| 목적 | "처리할 레코드 준비 완료" 신호 |
| 인증 | `X-Hook-Secret` 헤더 |

**Request Body**
```json
{
  "triggered_at": "2026-04-11T10:00:00Z",
  "pending_count": 12
}
```

**Response**
```json
HTTP 202 Accepted
{ "status": "accepted" }
```

> 에이전트는 즉시 202를 반환하고, 내부적으로 비동기 처리 시작

---

### 4-2. `POST /to-backend/finish-evaluation`

| 항목 | 내용 |
|------|------|
| 호출 주체 | Python AI Agent |
| 수신 주체 | NestJS 백엔드 |
| 목적 | LLM 평가 완료 결과 전달 |
| 인증 | `X-Hook-Secret` 헤더 |

**Request Body**
```json
{
  "items": [
    {
      "id": "uuid-of-ai-state-row",
      "idempotency_key": "uas:xxx",
      "version": "0.3",
      "representative_entity": {
        "id": "uuid",
        "page": "MODELS",
        "category_id": 1,
        "category_name": "LLM",
        "name": "GPT-5"
      },
      "ai_summary": "한 줄 요약",
      "ai_score": 4,
      "ai_classification_json": {},
      "ai_tags_json": [],
      "ai_snippets_json": {},
      "ai_evidence_json": {},
      "ai_structured_extraction_json": {},
      "side_category_code": "CASE_STUDY"
    }
  ],
  "evaluated_at": "2026-04-11T10:05:30Z"
}
```

**Response**
```json
HTTP 200 OK
{ "saved": 5, "ignored": 0 }
```

---

### 4-3. `GET /api/pipeline/agent/jobs` *(에이전트가 훅 수신 후 호출)*

| 항목 | 내용 |
|------|------|
| 호출 주체 | Python AI Agent |
| 수신 주체 | NestJS 백엔드 |
| 목적 | PENDING 레코드 목록 수신 및 클레임 |
| 인증 | `X-Hook-Secret` 헤더 |

**Response**
```json
{
  "items": [
    { "id": "uuid", "title": "제목", "content": "본문..." }
  ]
}
```

> 호출 시 내부적으로 `PENDING → IN_PROGRESS` 상태 전환 (`FOR UPDATE SKIP LOCKED`)

---

## 5. 인증

| 항목 | 내용 |
|------|------|
| 방식 | 공유 시크릿 헤더 |
| 헤더명 | `X-Hook-Secret` |
| 환경변수 | `HOOK_SHARED_SECRET` (백엔드·에이전트 동일 값 사용) |
| 검증 실패 시 | 401 Unauthorized 반환 |

---

## 6. 에러 처리 및 재시도

| 상황 | 처리 방법 |
|------|-----------|
| `POST /to-agent/table-ready` 실패 | 백엔드 로그 기록, 다음 크론(20분 후) 재시도 |
| `POST /to-backend/finish-evaluation` 실패 | 에이전트 3회 재시도 (1s → 5s → 30s) |
| 에이전트 처리 중 크래시 | `IN_PROGRESS` 15분 초과 시 크론이 `PENDING`으로 복구 |
| 중복 훅 수신 | `WHERE agent_json_raw IS NULL` 조건으로 멱등성 보장 |

---

## 7. 상태 흐름

```
PENDING
  │  ← GET /api/pipeline/agent/jobs (에이전트 클레임)
  ▼
IN_PROGRESS
  │  ← POST /to-backend/finish-evaluation 수신 완료
  ▼
PENDING  (agent_json_raw 기록됨)
  │  ← 크론: parse-agent-json 실행
  ▼
SUCCESS / FAILED
```

---

## 8. 환경변수 목록

| 변수명 | 위치 | 설명 |
|--------|------|------|
| `HOOK_SHARED_SECRET` | 백엔드 + 에이전트 | 훅 인증 공유 시크릿 (32자 이상 권장) |
| `AGENT_BASE_URL` | 백엔드 | 에이전트 서버 주소 (예: `http://agent:5000`) |
| `BACKEND_BASE_URL` | 에이전트 | 백엔드 서버 주소 (예: `http://api:4000`) |

---

## 9. 구현 체크리스트

### 백엔드 (NestJS)
- [ ] `POST /to-backend/finish-evaluation` 엔드포인트 추가
- [ ] `GET /api/pipeline/agent/jobs` 엔드포인트 추가 (PENDING 클레임 쿼리)
- [ ] pregen 완료 후 `POST /to-agent/table-ready` 호출 로직 추가
- [ ] `X-Hook-Secret` 검증 가드 추가
- [ ] stale `IN_PROGRESS` 복구 로직 (크론에 추가)

### 에이전트 (Python)
- [ ] `POST /to-agent/table-ready` 수신 엔드포인트 추가
- [ ] 수신 후 jobs 조회 → LLM 처리 → finish-evaluation 호출 루프 구현
- [ ] `X-Hook-Secret` 헤더 검증 추가
- [ ] finish-evaluation 재시도 로직 (3회, 지수 백오프)

### DB 마이그레이션
- [ ] `ai_status` enum에 `IN_PROGRESS` 추가
- [ ] `user_article_ai_state.claimed_at TIMESTAMPTZ` 컬럼 추가
