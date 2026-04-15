# Technology Stack Details

### Core Technologies

| Layer            | Technology                     | Version                  | Purpose                                                 |
| ---------------- | ------------------------------ | ------------------------ | ------------------------------------------------------- |
| Language         | Python                         | 3.10+                    | Backend API, Celery tasks, AI/LLM operations           |
| Language         | TypeScript                     | 5.9+                     | Frontend UI layer only                                  |
| Web Framework    | Next.js (App Router)           | latest                   | Frontend UI (SSR for SEO)                               |
| API Framework    | FastAPI                        | 0.104+                   | REST API backend                                        |
| Task Queue       | Celery                         | 5.0+                     | Distributed task execution                              |
| Cache/Broker     | Redis                          | 7+                       | Celery broker, result backend, caching                  |
| Evidence Layer   | PostgreSQL                     | 16 (with pgvector)       | Paragraphs, backups, pipeline runs                      |
| Concept Layer    | GraphDB                        | latest                   | Normalized concept ontology, typed relations            |
| Vector Search    | pgvector                       | latest                   | Semantic search on Basics/Advanced only                 |
| LLM Synthesis    | z.ai                           | —                        | Concept extraction + page synthesis                     |
| Embeddings       | sentence-transformers          | 5.2+                     | Local paragraph vectorization                           |
| Review Workspace | Notion                         | API v2                   | Knowledge Team workflow (source of truth)               |
| CI/CD            | GitHub Actions                 | —                        | Build, test, deploy                                     |
| Deployment       | Fly.io / Render / Vercel       | —                        | Webapp and database hosting                             |

### Integration Points

| Integration   | Direction            | Protocol                 | Rate Limits     | Error Handling                           |
| ------------- | -------------------- | ------------------------ | --------------- | ---------------------------------------- |
| Notion API    | Read + Write         | REST (notion-client SDK) | 3 req/sec       | Exponential backoff on 429, retry on 500 |
| z.ai API      | Write (prompts)      | REST (z.ai SDK)          | Tier-dependent  | Retry 2x with exponential backoff      |
| GitHub API    | Write (commits)      | REST (PyGithub)          | 5000 req/hr     | Retry on 422; atomic commits             |
| PostgreSQL    | Read + Write         | psycopg3 (SQLAlchemy)    | Max 20 pool     | Connection retry; dead-letter queue      |
| GraphDB       | Read + Write         | SPARQL/HTTP (RDFlib)     | —               | Retry 3x; sub-500ms target               |
| Redis         | Read + Write         | redis-py                 | —               | Connection pool retry                   |
| AWS S3        | Write (backups)      | boto3                    | —               | Retry; verify upload                     |
| SMTP          | Write (email alerts) | SMTP                     | —               | Retry 3x                                 |

---
