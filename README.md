# Cherry in the Haystack

> AI Engineering knowledge handbook — curated, synthesized, always fresh.

A monorepo that continuously ingests AI Engineering content from the web, scores it for quality, synthesizes it into structured knowledge pages, and publishes it as a searchable handbook.

---

## Prerequisites

| Tool           | Version |
| -------------- | ------- |
| Node.js        | 20+     |
| pnpm           | 9+      |
| Python         | 3.10+   |
| Poetry         | 1.8+    |
| Docker Desktop | Latest  |

---

## Quick Start

```bash
# 1. Install TypeScript dependencies
pnpm install

# 2. Start local database services (PostgreSQL 16 + pgvector, GraphDB, Redis)
docker-compose up -d

# 3. Copy environment variables and fill in your values
cp .env.example .env

# 4. Install Python dependencies
poetry install

# 5. Start the development server
pnpm dev
```

---

## Project Structure

See [`docs/architecture/project-structure.md`](docs/architecture/project-structure.md) for the full directory layout.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
