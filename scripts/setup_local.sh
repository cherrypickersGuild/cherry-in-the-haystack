#!/usr/bin/env bash
# Local environment setup: start Docker services, wait for PostgreSQL, apply schema.
# Usage: bash scripts/setup_local.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DATABASE_URL="${DATABASE_URL:-postgresql://cherry:cherry_dev@localhost:5432/cherry_db}"

# ── 1. Start Docker services ──────────────────────────────────────────────────
echo "==> Starting Docker services..."
docker-compose -f "$PROJECT_ROOT/docker-compose.yml" up -d
echo "    Docker services started."

# ── 2. Wait for PostgreSQL to be ready ───────────────────────────────────────
echo "==> Waiting for PostgreSQL to be ready (max 60s)..."
ATTEMPTS=0
MAX_ATTEMPTS=60
until pg_isready -d "$DATABASE_URL" >/dev/null 2>&1; do
    ATTEMPTS=$((ATTEMPTS + 1))
    if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
        echo "ERROR: PostgreSQL did not become ready within ${MAX_ATTEMPTS}s." >&2
        echo "       Check docker-compose logs: docker-compose logs postgres" >&2
        exit 1
    fi
    sleep 1
done
echo "    PostgreSQL is ready (${ATTEMPTS}s)."

# ── 3. Apply evidence layer schema ────────────────────────────────────────────
echo "==> Applying evidence layer schema..."
psql "$DATABASE_URL" -f "$SCRIPT_DIR/setup_evidence_layer.sql"
echo "    Schema applied successfully."

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "✓ Local environment is ready."
echo "  DATABASE_URL: $DATABASE_URL"
