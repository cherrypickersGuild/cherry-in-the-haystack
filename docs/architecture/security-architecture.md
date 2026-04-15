# Security Architecture

- **Infrastructure Access:** Tailscale for all secure infrastructure access (DBs, services, internal tools)
- **All credentials:** Environment variables only. Never hardcoded. Never committed. `.env.example` shows required keys with placeholder values.
- **Database:** RDS in private VPC subnet; connections use `sslmode=require`; accessed via Tailscale
- **GraphDB:** Self-hosted; restrict network access to application server IPs only; accessed via Tailscale
- **GitHub PAT (handbook-bot):** Scoped to `repo:write` only; rotate quarterly; store in GitHub Secrets
- **Notion API token:** Scoped to specific database IDs only
- **No user authentication in current epics** — pipeline system only. User auth is Phase 2.
- **FastAPI security:** Enable CORS for Next.js origin only; validate all Pydantic schemas; rate limit public endpoints

**Required environment variables (`.env.example`):**

```bash
# =============================================================================
# Python Services (FastAPI + Celery)
# =============================================================================

# Database (SQLAlchemy connection string)
DATABASE_URL=postgresql+psycopg://user:pass@host:5432/cherry?sslmode=require

# GraphDB (SPARQL endpoint)
GRAPH_DB_URL=http://localhost:7200
GRAPH_DB_REPOSITORY=cherry

# Redis (Celery broker + result backend)
REDIS_URL=redis://localhost:6379/0

# FastAPI Settings
FASTAPI_ENV=development
FASTAPI_PORT=8000
FASTAPI_RELOAD=true
CORS_ORIGINS=http://localhost:3000,https://cherry.example.com

# LLM API (z.ai)
ZAI_API_KEY=...
ZAI_MODEL=...

# Integrations
NOTION_API_TOKEN=secret_...
NOTION_DATABASE_ID=...
NOTION_BACKUP_DATABASE_ID=...
GITHUB_PAT=ghp_...
GITHUB_REPO=org/cherry-in-the-haystack

# Celery Settings
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
CELERY_TASK_SERIALIZER=json
CELERY_RESULT_SERIALIZER=json
CELERY_ACCEPT_CONTENT=json
CELERY_TIMEZONE=UTC

# Alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
ALERT_EMAIL=team@example.com

# AWS (backups)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BACKUP_BUCKET=cherry-handbook-backups

# =============================================================================
# Next.js Frontend (TypeScript)
# =============================================================================
# Note: These would be in a separate .env for the Next.js app

NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_SITE_URL=https://cherry.example.com
```

---
