# 메모: 코드베이스 구조 변경 — TypeScript와 Python 서비스 분리

**수신:** 팀
**발신:** 한결 (Tech Lead)
**날짜:** 2026-04-07
**제목:** 최종 코드베이스 구조 및 FastAPI 서버 생성 계획

---

## 요약

`dev/` 폴더에서의 마이그레이션이 완료되었습니다. 변경된 내용과 다음 단계를 공유합니다.

---

## 새로운 구조

```
cherry-in-the-haystack/
├── apps/                       # TypeScript 앱 (NestJS, Next.js)
│   ├── api/                     # 포트 4000
│   └── web/                     # 포트 3000
├── python_services/             # Python 서비스
│   ├── packages/                # 재사용 가능한 Python 패키지
│   │   ├── agent/
│   │   ├── idea_to_graph_ontology/
│   │   ├── news_collector/
│   │   └── text_extract_ideas/
│   └── api/                     # ← 새로 추가: FastAPI 서버 (포트 8000)
├── docs/
├── _bmad-output/
└── docker-compose.yml
```

---

## 무엇이 변경되었나?

| 변경 전 | 변경 후 | 이유 |
|----------|----------|------|
| `dev/packages/*` | `python_services/packages/*` | Python 코드를 한 곳에 통합 |
| 루트 `pyproject.toml` | 루트 `pyproject.toml` (통합됨) | Python 의존성 관리 단일화 |
| 흩어져 있던 Python deps | 루트에 통합 | 의존성 관리 용이 |
| FastAPI 서버 없음 | `python_services/api/` (추가 예정) | Python API 엔드포인트 통합 |

---

## 왜 이 구조인가?

### 1. TypeScript과 Python은 별개의 세계

**모듈을 공유할 수 없습니다.** 서로 다른 런타임, 서로 다른 의존성 시스템.

- TypeScript → Node.js → pnpm workspaces → `apps/`
- Python → CPython → Poetry → `python_services/`

**통신 방식:** HTTP (TS가 Python을 `fetch`/`axios`로 호출)

### 2. `apps/`는 루트에 유지 (NOT `next_js_webapp/`)

**이유:** pnpm workspace는 `node_modules`가 루트에 있어야 함.

`apps/`를 하위 폴더로 옮기면:
- 워크스페이스 resolution이 깨짐
- 모든 import 경로가 깨짐
- pnpm의 의존성 공유가 작동하지 않음

### 3. `python_services/api/`는 가능함 (`next_js_webapp/`와 다름)

**이유:** Python에는 "workspace" 제약이 없음.

- Import가 유연함 (relative, `sys.path`, `PYTHONPATH`)
- Poetry는 루트 구조를 요구하지 않음
- Python 코드를 모아두면 Docker 빌드가 단순해짐

---

## 포트 할당 (최종)

| 서비스 | 포트 | 기술 |
|---------|------|------|
| 웹 프론트엔드 | 3000 | Next.js |
| 웹 백엔드 (NestJS) | 4000 | TypeScript |
| Python API (FastAPI) | 8000 | Python |
| PostgreSQL | 5432 | - |
| GraphDB | 7200 | - |
| Redis | 6379 | - |

---

## 다음 단계: FastAPI 서버

`python_services/api/`를 생성합니다 — 모든 Python 패키지를 노출하는 단일 FastAPI 서버.

**엔드포인트:**
```
POST /api/v1/pdf/extract          → text_extract_ideas 패키지
POST /api/v1/ontology/extract     → idea_to_graph_ontology 패키지
POST /api/v1/ontology/update      → idea_to_graph_ontology 패키지
POST /api/v1/writer/generate      → agent 패키지
POST /api/v1/news/collect         → news_collector 패키지
GET  /api/v1/health               → 헬스체크
```

**TypeScript 클라이언트**는 `packages/pipeline/src/integrations/python-client.ts`에 생성

---

## 개발 워크플로우

### 서비스 실행하기

```bash
# 터미널 1: NestJS 백엔드
cd apps/api && pnpm dev

# 터미널 2: Next.js 프론트엔드
cd apps/web && pnpm dev

# 터미널 3: FastAPI 서버
cd python_services/api && uvicorn main:app --reload

# 터미널 4: Docker 서비스
docker-compose up
```

### 새 Python 패키지 추가하기

1. `python_services/packages/my_package/`에 패키지 생성
2. `python_services/api/routes/my_package.py`에 라우트 추가
3. `python_services/api/main.py`에 라우트 등록

---

## 문서

- **ADR:** `docs/architecture/code-structure-decision.md` (ADR-010)
- **API 계약:** `_bmad-output/planning-artifacts/epic-1-2-team-integration-plan.md`

---

**질문이 있으면 #engineering에 물어보거나 직접 연락 주세요.**

— 한결
