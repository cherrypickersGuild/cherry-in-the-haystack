# Development Environment

### Prerequisites

- Docker Desktop
- Python 3.10+
- Poetry 1.8+
- Node.js 20+
- pnpm
- **Tailscale** — required for infrastructure access (databases, GraphDB, internal services)

### Setup Commands

```bash
# Install dependencies
pnpm install          # TypeScript workspace (apps/web + packages/pipeline)
poetry install        # Python AI modules

# Start databases
docker-compose up -d

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run Python database setup
python scripts/setup_local.sh

# Verify Python pipeline
ruff check handbook/
mypy handbook/
pytest handbook/ --cov

# Verify TypeScript pipeline
cd packages/pipeline && pnpm tsc --noEmit

# Run a cron job manually
npx tsx packages/pipeline/src/jobs/notion-backup.ts

# Preview webapp
cd apps/web && pnpm dev
```

---
