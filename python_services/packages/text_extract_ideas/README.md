# PDF Knowledge Extractor

PDF 문서에서 지식을 자동으로 추출하는 LLM 기반 파이프라인입니다.

## 주요 기능

- **TOC 기반 챕터 감지**: PDF 내장 목차를 활용한 정확한 챕터 분할
- **하이브리드 청킹**: 규칙 기반 + LLM 기반 결합으로 의미적 문단 분할
- **핵심 개념 추출**: 각 문단에서 주요 개념을 자동 추출
- **섹션 메타데이터**: 계층적 섹션 경로 추적 (챕터 > 섹션)
- **PostgreSQL 저장**: 구조화된 데이터베이스 저장

## 아키텍처

```
PDF → 전체 텍스트 추출 → 챕터 감지 → 텍스트 정규화 → 하이브리드 청킹 → DB 저장
      (PyMuPDF)     (TOC 기반)  (하이픈 연결,  (규칙+LLM 분할,
                               테이블 제거)   개념 추출 통합)
```

### 데이터 구조

```
Book: "AI Engineering"
├── Chapter 1: "Introduction to LLMs"
│   ├── Paragraph 0
│   │   └── section_path: "Chapter 1 > Introduction to LLMs"
│   │   └── KeyIdea: "Large Language Model"
│   ├── Paragraph 1
│   │   └── section_path: "Chapter 1 > The Rise of AI Engineering"
│   │   └── KeyIdea: "Transformer"
│   └── ...
├── Chapter 2: "Prompt Engineering"
│   └── ...
└── ...
```

## 설치

### 요구사항

- Python 3.10+
- PostgreSQL 12+
- Google Cloud 프로젝트 (Vertex AI 활성화)


## 환경 설정

`.env.example`을 복사하여 `.env` 파일을 생성하고 값을 설정합니다:

```bash
cp .env.example .env
```

### Google Cloud 인증 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에서 서비스 계정 생성
2. Vertex AI API 권한 부여
3. JSON 키 파일 다운로드
4. 프로젝트 루트에 키 파일 배치 (예: `your-project-xxxxxx.json`)
5. 환경 변수 설정:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="your-project-xxxxxx.json"
```

또는 `.env` 파일에 추가:

```env
GOOGLE_APPLICATION_CREDENTIALS=your-project-xxxxxx.json
```

### 필수 환경 변수

```env
# Google Cloud / Vertex AI
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1

# 모델 설정
VERTEX_AI_MODEL=gemini-2.5-flash

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

### 선택 환경 변수

```env
# LangSmith (선택 - 디버깅/모니터링용)
LANGSMITH_API_KEY=your-langsmith-api-key
LANGSMITH_PROJECT=your-project-name
```

## 사용법

### SSH 터널 설정 (원격 DB 사용 시)

```bash
# SSH 터널 생성 (백그라운드)
ssh -N -L 5433:localhost:5432 user@your-server-ip

# 터널 확인
lsof -nP -iTCP:5433 -sTCP:LISTEN

# 터널 종료
ps aux | grep "ssh -N -L 5433"
kill <PID>
```

### 데이터베이스 마이그레이션

```bash
# 테이블 생성 (초기 설정)
python -c "from src.db.connection import init_db; init_db()"

# 또는 Alembic 사용
alembic upgrade head
```

### 파이프라인 실행

```bash
# 기본 실행
python run_pipeline.py

# PDF 파일 지정
python run_pipeline.py path/to/your.pdf

# 모델 버전 지정
python run_pipeline.py path/to/your.pdf gemini-2.5-flash
```

### 데이터 조회

```python
from src.db.connection import get_session
from src.db.models import Book, Chapter, ParagraphChunk, KeyIdea

session = get_session()
try:
    # 책 목록 조회
    books = session.query(Book).all()
    for book in books:
        print(f"ID: {book.id}, Title: {book.title}")

    # 특정 책의 챕터 조회
    chapters = session.query(Chapter).filter_by(book_id=1).all()

    # 핵심 아이디어 조회
    ideas = session.query(KeyIdea).filter_by(book_id=1).all()
finally:
    session.close()
```

## 프로젝트 구조

```
pdf_knowledge_extractor/
├── src/
│   ├── db/              # 데이터베이스 모델 및 작업
│   │   ├── models.py    # SQLAlchemy 모델
│   │   └── operations.py
│   ├── model/           # LLM 통합
│   │   └── llm.py       # Vertex AI 클라이언트
│   ├── prompts/         # LLM 프롬프트
│   │   └── semantic_chunking.py
│   ├── utils/           # 유틸리티
│   │   ├── config.py    # 설정 관리
│   │   ├── logger.py    # 로깅
│   │   └── pdf/         # PDF 처리
│   │       ├── parser.py
│   │       ├── hierarchy_detector.py
│   │       └── text_normalizer.py
│   └── workflow/        # LangGraph 워크플로우
│       ├── workflow.py  # 메인 워크플로우
│       ├── state.py     # 상태 정의
│       └── nodes/       # 워크플로우 노드
├── tests/               # 테스트
├── docs/                # 문서
│   └── ARCHITECTURE_DECISIONS.md
├── run_pipeline.py      # 실행 스크립트
├── requirements.txt     # 의존성
└── alembic/             # DB 마이그레이션
```

## 기술 스택

- **LLM**: Google Vertex AI (Gemini)
- **오케스트레이션**: LangChain, LangGraph
- **PDF 처리**: PyMuPDF
- **데이터베이스**: PostgreSQL, SQLAlchemy
- **마이그레이션**: Alembic

### 핵심 결정 요약

| 결정 | 이유 |
|------|------|
| 페이지 → 챕터 기반 전환 | 페이지 경계 문제 해결, 컨텍스트 유지 |
| TOC 우선 감지 | PDF 내장 메타데이터가 가장 신뢰성 높음 |
| 하이브리드 청킹 | 규칙(효율) + LLM(정확도) 장점 결합 |
| 청킹+추출 통합 | API 호출 78% 감소, 의미 일관성 |

