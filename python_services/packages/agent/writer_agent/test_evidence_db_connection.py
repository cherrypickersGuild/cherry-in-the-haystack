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


def main() -> int:
    env_path = Path(__file__).with_name(".env")
    load_env_file(env_path)

    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        print("DATABASE_URL is not set.")
        return 1

    try:
        import psycopg2
    except Exception as exc:
        print(f"psycopg2 is not available: {exc}")
        return 1

    try:
        conn = psycopg2.connect(database_url)
    except Exception as exc:
        print(f"Evidence DB connection failed: {exc}")
        return 1

    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1;")
            row = cursor.fetchone()
            cursor.execute("SELECT version();")
            version = cursor.fetchone()[0]
        print("Evidence DB connection OK.")
        print(f"SELECT 1 result: {row[0]}")
        print(f"Postgres version: {version}")
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
