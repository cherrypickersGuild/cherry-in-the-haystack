# Deployment Architecture

### Infrastructure Access

**Tailscale** is used for secure access to all infrastructure resources:

- Database access (PostgreSQL, GraphDB) via Tailscale IP
- Internal services communicate over Tailscale network
- Development and production use the same Tailscale net (tailnet) with ACL separation
- No public endpoints for databases — all access through Tailscale

### Content Publication Pipeline

```
Cron job: weekly-publish.ts (Sunday 00:00 UTC)
  → Notion (fetch approved items)
  → format-dispatcher.ts (markdown generation)
```

### Pipeline Scheduling (Cron)

```
# Example crontab entries
0 0 * * *   cd /app && npx tsx packages/pipeline/src/jobs/notion-backup.ts
0 0 * * 0   cd /app && npx tsx packages/pipeline/src/jobs/weekly-publish.ts
0 */6 * * * cd /app && npx tsx packages/pipeline/src/jobs/news-ingestion.ts
0 10 2 * *  cd /app && python handbook/pipeline/writer_agent/run.py
```

All jobs write results to `pipeline_runs` table. Failures send Slack + email alerts.

### Local Development

```bash
docker-compose up -d   # PostgreSQL 16 + pgvector + GraphDB
```

`docker-compose.yml` services:

- `postgres`: PostgreSQL 16 with pgvector, port 5432
- `graphdb`: GraphDB, port 7200 (UI at http://localhost:7200)

### Backup Strategy

| Layer                   | Method                  | Frequency  | Retention    |
| ----------------------- | ----------------------- | ---------- | ------------ |
| Evidence Layer (RDS)    | Automated RDS snapshots | Daily      | 30 days      |
| Evidence Layer (RDS)    | Point-in-time recovery  | Continuous | 7-day window |
| Concept Layer (GraphDB) | JSON/RDF export → S3    | Weekly     | 60 days      |
| Vector DB (pgvector)    | Included in RDS backups | Daily      | With RDS     |

---
