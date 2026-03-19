# Technology Stack Details

### Core Technologies

| Layer            | Technology                     | Version                  | Purpose                                                 |
| ---------------- | ------------------------------ | ------------------------ | ------------------------------------------------------- |
| Language         | TypeScript                     | 5.9+                     | Web app, API routes, data pipeline scripts              |
| Language         | Python                         | 3.10+                    | AI/LLM agent modules (concept extraction, Writer Agent) |
| Web Framework    | Next.js (App Router)           | latest                   | Frontend                                                |
| Web Framework    | Nest.js (App Router)           | latest                   | API backend                                             |
| Evidence Layer   | PostgreSQL                     | 16 (RDS db.t3.small)     | Paragraphs, backups, pipeline runs                      |
| Concept Layer    | GraphDB                        | latest                   | Normalized concept ontology, typed relations            |
| Vector Search    | pgvector                       | latest                   | Semantic search on Basics/Advanced only                 |
| LLM Synthesis    | Claude 3.5 Sonnet              | claude-3-5-sonnet-latest | Concept extraction + page synthesis                     |
| LLM Embeddings   | OpenAI text-embedding-3-small  | 1536 dims                | Paragraph vectorization                                 |
| Review Workspace | Notion                         | API v2                   | Knowledge Team workflow (source of truth)               |
| Scheduling       | Cron (system cron / node-cron) | —                        | Pipeline job scheduling                                 |
| CI/CD            | GitHub Actions                 | —                        | Build, test, deploy                                     |
| Deployment       | AWS / Oracle                   | —                        | Webapp and database hosting                             |

### Integration Points

| Integration   | Direction            | Protocol                 | Rate Limits     | Error Handling                           |
| ------------- | -------------------- | ------------------------ | --------------- | ---------------------------------------- |
| Notion API    | Read + Write         | REST (notion-client SDK) | 3 req/sec       | Exponential backoff on 429, retry on 500 |
| Claude API    | Write (prompts)      | REST (anthropic SDK)     | Tier-dependent  | Retry 2x → fallback Gemini Flash         |
| OpenAI API    | Write (embeddings)   | REST (openai SDK)        | Batch: 2048/req | Retry 3x with tenacity                   |
| GitHub API    | Write (commits)      | REST (Octokit)           | 5000 req/hr     | Retry on 422; atomic commits             |
| Amazon RDS    | Read + Write         | psycopg3 / Prisma (SSL)  | Max 20 pool     | Connection retry; dead-letter queue      |
| GraphDB       | Read + Write         | SPARQL/HTTP              | —               | Retry 3x; sub-500ms target               |
| AWS S3        | Write (backups)      | boto3                    | —               | Retry; verify upload                     |
| Slack Webhook | Write (alerts)       | HTTP                     | —               | Fire-and-forget; log failures            |
| SMTP          | Write (email alerts) | SMTP                     | —               | Retry 3x                                 |
| MCP Server    | Read (images)        | MCP protocol             | —               | Retry 3x; log failures                   |

---
