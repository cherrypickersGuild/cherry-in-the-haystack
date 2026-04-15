# Technology Stack

> **Principle:** Use battle-tested open-source packages wherever possible. Build only what's unique to Cherry.

---

## Python Backend (Primary)

### Web Framework & API
| Package | Version | Purpose | Why this package |
|---------|---------|---------|------------------|
| **FastAPI** | >=0.104.0 | REST API backend | Auto-generated OpenAPI docs, async/await, type validation via Pydantic |
| **Uvicorn** | >=0.24.0 | ASGI server | Lightning-fast, production-ready async server |
| **Pydantic** | >=2.0.0 | Data validation | Schema validation, settings management, JSON serialization |

### Task Scheduling & Queues
| Package | Version | Purpose | Why this package |
|---------|---------|---------|------------------|
| **Celery** | latest | Distributed task queue | Python-native, mature, proven at scale, supports retries/scheduling |
| **Redis** | latest | Message broker & cache | Fast in-memory store, Celery's default broker |
| **Flower** | latest | Celery monitoring (optional) | Web UI for inspecting task state, worker health |

### Database & ORM
| Package | Version | Purpose | Why this package |
|---------|---------|---------|------------------|
| **SQLAlchemy** | >=2.0 | ORM & core | Industry standard, async support, migrations via Alembic |
| **psycopg** | >=3.0 | PostgreSQL driver | Modern async driver, faster than psycopg2 |
| **pgvector** | extension | Vector similarity | Built-in Postgres extension, no separate vector DB needed |
| **RDFlib** | latest | GraphDB/RDF client | SPARQL queries, RDF serialization for concept layer |

### Content Extraction & Processing
| Package | Version | Purpose | Why this package |
|---------|---------|---------|------------------|
| **feedparser** | latest | RSS/Atom feed parsing | Handles malformed feeds, encodings, date parsing |
| **newspaper3k** | latest | Article text extraction | Full-text extraction from HTML, removes ads/navigation |
| **PyMuPDF (fitz)** | latest | PDF parsing | Fast, accurate text extraction, preserves layout |
| **unstructured** | latest | Document ingestion | Unified API for PDF, HTML, DOCX, images (OCR) |
| **python-docx** | latest | Word document parsing | For .docx sources |

### AI/LLM Integration
| Package | Version | Purpose | Why this package |
|---------|---------|---------|------------------|
| **z.ai** | latest | LLM API | Primary LLM provider for all operations |
| **langchain** | >=0.3 | LLM orchestration | Prompt templates, chains, agents, document loaders |
| **tiktoken** | latest | Token counting | Accurate token estimation for cost tracking |

### Embeddings & Vector Operations
| Package | Version | Purpose | Why this package |
|---------|---------|---------|------------------|
| **sentence-transformers** | >=5.2.0 | Embedding models | Pre-trained models for semantic similarity |
| **numpy** | >=1.24.0 | Numerical operations | Fast array ops for similarity calculations |

### External Integrations
| Package | Version | Purpose | Why this package |
|---------|---------|---------|------------------|
| **notion-client** | latest | Notion API | Official Python client for Notion integration |
| **httpx** | latest | Async HTTP client | Modern async HTTP for API calls |
| **requests** | latest | Sync HTTP client | Fallback for simple API calls |

### Utilities
| Package | Version | Purpose | Why this package |
|---------|---------|---------|------------------|
| **loguru** | >=0.7.0 | Logging | Simple, powerful logging with rotation |
| **python-dotenv** | latest | Environment variables | Load .env files for config |
| **pytz** | latest | Timezone handling | Timezone-aware datetimes for scheduling |
| **validators** | latest | Input validation | URL, email, string validation |

---

## TypeScript Frontend (UI Layer Only)

### Framework & Core
| Package | Purpose | Why this package |
|---------|---------|------------------|
| **Next.js** (App Router) | React framework | SSR/SSG for SEO, API routes, file-based routing |
| **React** | UI library | Component-based UI, hooks, ecosystem |
| **TypeScript** | Type safety | Catch errors at compile time |

### HTTP & Data Fetching
| Package | Purpose | Why this package |
|---------|---------|------------------|
| **axios** or **fetch** | API client | Call FastAPI backend |
| **@tanstack/react-query** | Data fetching | Caching, retries, background updates |

### UI Components
| Package | Purpose | Why this package |
|---------|---------|------------------|
| **Tailwind CSS** | Styling | Utility-first CSS, rapid development |
| **shadcn/ui** or **radix-ui** | Component primitives | Accessible, unstyled components |

---

## Infrastructure & Deployment

### Databases
| Technology | Purpose | Why this package |
|------------|---------|------------------|
| **PostgreSQL 16** | Primary RDBMS | ACID, pgvector, JSONB, proven reliability |
| **GraphDB** (RDF) | Concept ontology | Free open-source, SPARQL, self-hosted |
| **Redis** | Cache & queue | Fast in-memory store, Celery broker |

### Networking
| Technology | Purpose | Why this package |
|------------|---------|------------------|
| **Tailscale** | Secure access | Zero-config VPN, ACLs, no public DB endpoints |

### Deployment
| Technology | Purpose | Why this package |
|------------|---------|------------------|
| **Docker** | Containerization | Consistent environments, easy deployment |
| **docker-compose** | Local dev | Spin up all services locally |
| **GitHub Actions** | CI/CD | Automated testing, deployment on push |

---

## Packages NOT to Build (Use Existing)

| Don't Build | Use Instead |
|-------------|-------------|
| RSS feed parser | `feedparser` |
| Article text extractor | `newspaper3k` |
| PDF parser | `PyMuPDF`, `unstructured` |
| Task scheduler | `Celery` + `Redis` |
| Word doc parser | `python-docx` |
| ORM | `SQLAlchemy` |
| Embedding models | `sentence-transformers` |
| SPARQL client | `SPARQLWrapper`, `RDFlib` |
| Logging | `loguru` |

---

## Cherry-Specific Code (Build These)

| Component | Why Custom |
|-----------|-----------|
| **News scoring pipeline** | Domain-specific logic for AI engineering relevance |
| **Concept extraction** | Custom ontology linking to GraphDB |
| **Writer Agent** | Synthesis logic for 4-section handbook format |
| **Personalization engine** | User-specific filtering and re-ranking |
| **Newsletter Studio** | Enterprise feature with template system |

---

## Python Project Structure

```
python_services/
├── api.py                 # FastAPI application entry point (unified service)
│
├── packages/
│   ├── agent/             # Agent-based packages
│   │   ├── news_agent/    # News processing agents
│   │   └── writer_agent/  # Handbook page synthesis
│   │       ├── test_evidence_db_connection.py
│   │       └── test_graphdb_connection.py
│   │
│   ├── news_collector/    # News ingestion pipeline
│   │   ├── (RSS, Twitter, YouTube, arxiv crawlers)
│   │   └── pyproject.toml
│   │
│   ├── idea_to_graph_ontology/  # Concept extraction → GraphDB
│   │   ├── src/           # LangChain, RDFlib, SPARQLWrapper
│   │   └── pyproject.toml
│   │
│   └── text_extract_ideas/    # PDF/HTML → evidence extraction
│       ├── src/           # PyMuPDF, pipeline logic
│       ├── tests/         # Package tests
│       ├── run_chapters.py
│       ├── run_pipeline.py
│       └── requirements.txt
│
├── scripts/               # Standalone utility scripts
│   ├── setup_evidence_layer.sql
│   ├── setup_graph_db.py
│   └── backup_db.py
│
├── requirements.txt       # Core dependencies
├── pyproject.toml         # Project metadata
└── README.md
```

**Note:** Tests reside within each package directory (e.g., `packages/agent/writer_agent/test_*.py`, `packages/text_extract_ideas/tests/`).

---

## Summary: Python vs. TypeScript Split

| Concern | Python | TypeScript |
|---------|--------|------------|
| **Lines of Code** | ~40% | ~60% |
| **Web Backend** | ❌ | ✅ NestJS (main API) |
| **Python AI Service** | ✅ FastAPI (AI/LLM only) | ❌ |
| **Data Pipeline** | ✅ Celery tasks | ❌ |
| **AI/LLM** | ✅ All LLM ops | ❌ |
| **Database Access** | ✅ SQLAlchemy (Python), Prisma (TS) | ✅ |
| **Task Scheduling** | ✅ Celery + Redis | ❌ |
| **Web UI** | ❌ | ✅ Next.js/React |
| **API Client** | ❌ | ✅ Fetches from NestJS |

**Key Point:** NestJS handles the main web application backend. FastAPI is a specialized Python service called only when AI/LLM or data processing operations are needed.

---

_Last updated: 2026-04-07_
