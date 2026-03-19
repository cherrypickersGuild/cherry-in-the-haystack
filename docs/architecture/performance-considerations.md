# Performance Considerations

| Concern                       | Target                | Approach                                                                 |
| ----------------------------- | --------------------- | ------------------------------------------------------------------------ |
| Webapp page load              | < 2 seconds           | Next.js SSR/SSG via CDN (AWS CloudFront / Cloudflare)                    |
| GraphDB concept query         | < 500ms               | Index concept_name; cache frequent queries in-process                    |
| pgvector search (top-10)      | < 100ms               | IVFFlat index (lists=100 for ~100K vectors); denormalized text           |
| Notion API                    | Max 3 req/sec         | Rate limiter in `notion-client.ts`; exponential backoff on 429           |
| LLM embedding cost            | Minimize              | Batch 2048 texts/request; cache embeddings                               |
| LLM synthesis cost            | Minimize              | Deduplication runs before concept extraction; cost tracked per paragraph |
| CI/CD build time              | < 10 minutes          | Cache pip/pnpm deps in Actions; parallel CI tasks                        |
| Postgres connections (Python) | Max 20                | psycopg3 connection pool; context manager for release                    |
| Index maintenance             | Sustained performance | Rebuild IVFFlat when row count doubles                                   |

---
