# Security Architecture

- **All credentials:** Environment variables only. Never hardcoded. Never committed. `.env.example` shows required keys with placeholder values.
- **Database:** RDS in private VPC subnet; connections use `sslmode=require`
- **GraphDB:** Self-hosted; restrict network access to application server IPs only
- **GitHub PAT (handbook-bot):** Scoped to `repo:write` only; rotate quarterly; store in GitHub Secrets
- **Notion API token:** Scoped to specific database IDs only
- **No user authentication in current epics** — pipeline system only. User auth is Phase 2.

**Required environment variables (`.env.example`):**

```bash
# Database
DATABASE_URL=postgresql+psycopg://user:pass@host:5432/handbook?sslmode=require
GRAPH_DB_URL=http://localhost:7200

# LLM APIs
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

# Integrations
NOTION_API_TOKEN=secret_...
NOTION_DATABASE_ID=...
GITHUB_PAT=ghp_...
GITHUB_REPO=org/cherry-in-the-haystack

# MCP Server
MCP_SERVER_URL=http://localhost:8080

# Alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
ALERT_EMAIL=team@example.com

# AWS (backups)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BACKUP_BUCKET=cherry-handbook-backups
```

---
