# Deployment Architecture

## Infrastructure Access

**Tailscale** is used for secure access to all infrastructure resources:

- Database access (PostgreSQL, GraphDB) via Tailscale IP
- Internal services communicate over Tailscale network
- Development and production use the same Tailscale net (tailnet) with ACL separation
- No public endpoints for databases — all access through Tailscale

---

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Next.js Frontend (TS)                       │
│                        (Port 3000 / Public)                         │
│  - User-facing UI                                                   │
│  - SEO pages                                                        │
│  - Fetches from NestJS                                              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP (REST API)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      NestJS Backend (TS)                            │
│                        (Port 4000 / Internal)                       │
│  - /api/news/*      — News endpoints                                │
│  - /api/concepts/*  — Concept pages                                 │
│  - /api/auth/*      — Authentication                                │
│  - /api/newsletter/* — Enterprise features                          │
│  - Calls FastAPI when AI/LLM operations needed                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP (when Python needed)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FastAPI Service (Python)                       │
│                        (Port 8000 / Internal)                       │
│  - /ai/scoring       — AI article scoring                           │
│  - /ai/extract       — Concept extraction from documents            │
│  - /ai/synthesize     — Writer Agent page generation                │
│  - /celery/*         — Celery task management                       │
└───────────┬────────────────────────────────┬─────────────────┘
            │                                        │
            │ Celery protocol                        │
            ▼                                        ▼
┌──────────────────────┐              ┌────────────────────────────────┐
│   Redis + Celery     │              │      Databases (Tailscale)     │
│                      │              │                                 │
│  - Task queue        │              │  - PostgreSQL 16 + pgvector    │
│  - Result backend    │              │  - GraphDB (RDF)               │
│  - Scheduling        │              │  - Managed by docker-compose   │
└──────────────────────┘              └────────────────────────────────┘
            │
            │ Tasks execute here
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Celery Workers (Python)                          │
│  - news_ingestion_worker    — RSS, Twitter, YouTube, arxiv          │
│  - ai_scoring_worker        — LLM scoring via z.ai                   │
│  - concept_extraction_worker — GraphDB concept linking              │
│  - writer_agent_worker      — Handbook page synthesis               │
│  - newsletter_worker        — Enterprise email generation            │
│  - stats_snapshot_worker    — Nightly statistics aggregation        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Content Publication Pipeline

**Old (TypeScript):**
```
Cron job: weekly-publish.ts (Sunday 00:00 UTC)
  → Notion (fetch approved items)
  → format-dispatcher.ts (markdown generation)
```

**New (Python + Celery):**
```python
# python_services/api.py or tasks in packages/agent/news_agent/
from celery import shared_task

@shared_task(name="tasks.weekly_publish")
def weekly_publish_task():
    """Fetch approved articles from Notion, publish to database."""
    # 1. Fetch approved items from Notion
    # 2. Update curated_articles table
    # 3. Generate snapshots for all user tiers
    # 4. Trigger any newsletter sends
    pass
```

---

## Celery Task Scheduling

### Celery Beat Schedule

```python
# python_services/api.py (celery_app configuration)
from celery.schedules import crontab

app.conf.beat_schedule = {
    # Daily tasks
    'tasks.notion-backup': {
        'task': 'tasks.notion_backup',
        'schedule': crontab(hour=0, minute=0),  # 00:00 UTC daily
    },
    'tasks.news-ingestion': {
        'task': 'tasks.news_ingestion',
        'schedule': crontab(minute='*/6'),       # Every 6 hours
    },
    'tasks.stats-snapshot': {
        'task': 'tasks.stats_snapshot',
        'schedule': crontab(hour=2, minute=0),   # 02:00 UTC daily
    },

    # Weekly tasks
    'tasks.weekly-publish': {
        'task': 'tasks.weekly_publish',
        'schedule': crontab(day_of_week=0, hour=0, minute=0),  # Sunday 00:00 UTC
    },
    'tasks.writer-agent': {
        'task': 'tasks.writer_agent',
        'schedule': crontab(day_of_month=2, hour=10, minute=0),  # 2nd of month 10:00 UTC
    },
}
```

### Task Definition Examples

```python
# python_services/api.py or in packages/agent/news_agent/
from celery import shared_task
from loguru import logger

@shared_task(bind=True, max_retries=3)
def news_ingestion_task(self):
    """Ingest news from all active sources."""
    try:
        from packages.news_collector import run_ingestion
        count = run_ingestion()
        logger.info(f"Ingested {count} articles")
        return {"count": count}
    except Exception as exc:
        logger.error(f"News ingestion failed: {exc}")
        raise self.retry(exc=exc, countdown=3600)  # Retry in 1 hour

@shared_task
def ai_scoring_task(article_ids: list[str]):
    """Score articles using z.ai LLM."""
    from packages.news_collector.scorers import score_articles
    results = score_articles(article_ids)
    return results
```

---

## Local Development

### Docker Compose

```bash
docker-compose up -d
```

**`docker-compose.yml` services:**

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: cherry
      POSTGRES_USER: cherry
      POSTGRES_PASSWORD: dev_password

  graphdb:
    image: ontotext/graphdb:10.0.0
    ports:
      - "7200:7200"
    volumes:
      - graphdb_data:/opt/graphdb/home

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # FastAPI backend
  api:
    build: ./python_services
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+psycopg://cherry:dev_password@postgres:5432/cherry
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - postgres
      - redis
    command: uvicorn api:app --host 0.0.0.0 --port 8000 --reload

  # Celery worker
  worker:
    build: ./python_services
    environment:
      DATABASE_URL: postgresql+psycopg://cherry:dev_password@postgres:5432/cherry
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - postgres
      - redis
    command: celery -A api.celery_app worker --loglevel=info

  # Celery beat (scheduler)
  beat:
    build: ./python_services
    environment:
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - redis
    command: celery -A api.celery_app beat --loglevel=info

  # Flower (Celery monitoring, optional)
  flower:
    build: ./python_services
    ports:
      - "5555:5555"
    environment:
      REDIS_URL: redis://redis://6379/0
    depends_on:
      - redis
    command: celery -A api.celery_app flower --port=5555
```

### Running Services Locally

```bash
# Terminal 1: NestJS backend
cd apps/api
npm run start:dev

# Terminal 2: FastAPI (Python AI service)
cd python_services
uvicorn api:app --reload --port 8000

# Terminal 3: Celery worker
cd python_services
celery -A api.celery_app worker --loglevel=info

# Terminal 4: Celery beat (scheduler)
cd python_services
celery -A api.celery_app beat --loglevel=info

# Terminal 5: Next.js frontend (separate terminal)
cd apps/web
npm run dev
```

---

## Production Deployment

### Option A: Single Server (Docker Compose)

```bash
# On production server
git pull
docker-compose pull
docker-compose up -d
docker-compose exec api alembic upgrade head
```

### Option B: Cloud Services

| Service | Recommended | Notes |
|---------|-------------|-------|
| **FastAPI** | Fly.io, Render, Railway | Easy Python deployment |
| **Celery Workers** | Same as API, or separate | Scale workers independently |
| **PostgreSQL** | Supabase, RDS, Neon | Managed Postgres with pgvector |
| **GraphDB** | Self-hosted on VPS | Requires Java, ~2GB RAM |
| **Redis** | Upstash, Redis Cloud, ElastiCache | Managed Redis |
| **Next.js** | Vercel, Netlify | Edge deployment, automatic HTTPS |
| **Flower** | Optional, internal only | Don't expose publicly |

### Example: Fly.io Deployment

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Launch FastAPI app
fly launch --python-version 3.12
flyctl secrets set DATABASE_URL=postgresql://...
flyctl secrets set REDIS_URL=redis://...
flyctl deploy

# Launch Celery worker
fly launch --name cherry-worker
flyctl secrets set ...
flyctl set worker --cmd "celery -A workers.celery_app worker"
flyctl deploy --regions lax,iad  # Multiple regions
```

---

## Backup Strategy

| Layer | Method | Frequency | Retention |
|-------|--------|-----------|-----------|
| Evidence Layer (RDS) | Automated RDS snapshots | Daily | 30 days |
| Evidence Layer (RDS) | Point-in-time recovery | Continuous | 7-day window |
| Concept Layer (GraphDB) | JSON/RDF export → S3 | Weekly | 60 days |
| Vector DB (pgvector) | Included in RDS backups | Daily | With RDS |

### Backup Script (Python)

```python
# scripts/backup_db.py
import subprocess
from datetime import datetime
from loguru import logger

def backup_postgres():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"postgres_backup_{timestamp}.sql.gz"
    cmd = f"pg_dump $DATABASE_URL | gzip > /backups/{filename}"
    subprocess.run(cmd, shell=True, check=True)
    logger.info(f"Postgres backup: {filename}")

def backup_graphdb():
    # Export GraphDB RDF
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"graphdb_backup_{timestamp}.rdf"
    # Use SPARQLWrapper to export all triples
    logger.info(f"GraphDB backup: {filename}")

if __name__ == "__main__":
    backup_postgres()
    backup_graphdb()
```

---

## Monitoring & Observability

| Tool | Purpose | How to Access |
|------|---------|---------------|
| **Flower** | Celery task monitoring | `http://localhost:5555` (dev only) |
| **Loguru** | Structured logs | `/var/log/cherry/` |
| **Sentry** (optional) | Error tracking | Python + JS SDKs |
| **Prometheus** (optional) | Metrics | FastAPI + Celery exporters |

### Celery Monitoring with Flower

```bash
# Start Flower
celery -A workers.celery_app flower --port=5555

# Access at http://localhost:5555
# Shows:
# - Active tasks
# - Worker status
# - Task success/failure rates
# - Execution time metrics
```

---

## Health Checks

### FastAPI Health Endpoint

```python
# python_services/api.py
from fastapi import FastAPI
from sqlalchemy import text

@app.get("/health")
async def health_check():
    """Health check for load balancer."""
    # Check database
    db_status = await db.execute(text("SELECT 1"))
    # Check Redis
    redis_status = redis.ping()
    # Check Celery
    celery_status = celery.control.ping()

    return {
        "status": "healthy" if all([db_status, redis_status, celery_status]) else "degraded",
        "database": bool(db_status),
        "redis": redis_status,
        "celery": celery_status,
    }
```

---

_Last updated: 2026-04-07_
