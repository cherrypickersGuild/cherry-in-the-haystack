import os
from pathlib import Path


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def resolve_database_url() -> str:
    direct_url = os.getenv("DATABASE_URL", "").strip()

    host = os.getenv("LOCAL_DB_HOST", "").strip()
    port = os.getenv("LOCAL_DB_PORT", "").strip() or "5432"
    user = os.getenv("LOCAL_DB_USER", "").strip()
    password = os.getenv("LOCAL_DB_PASSWORD", "").strip()
    dbname = os.getenv("LOCAL_DB_NAME", "").strip()
    sslmode = os.getenv("LOCAL_DB_SSLMODE", "").strip()

    if host and user and password and dbname:
        if not sslmode:
            sslmode = "require"
        return f"postgresql://{user}:{password}@{host}:{port}/{dbname}?sslmode={sslmode}"

    return direct_url
