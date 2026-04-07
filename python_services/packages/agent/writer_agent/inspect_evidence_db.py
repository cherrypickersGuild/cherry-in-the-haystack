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

    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT table_schema, table_name
                FROM information_schema.tables
                WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                ORDER BY table_schema, table_name;
                """
            )
            tables = cursor.fetchall()
            print("Tables:")
            for schema, name in tables:
                print(f"- {schema}.{name}")

            target_tables = [
                ("public", "paragraph_chunks"),
                ("public", "books"),
                ("public", "key_ideas"),
            ]

            for schema, name in target_tables:
                cursor.execute(
                    """
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns
                    WHERE table_schema = %s AND table_name = %s
                    ORDER BY ordinal_position;
                    """,
                    (schema, name),
                )
                columns = cursor.fetchall()
                if not columns:
                    print(f"\nColumns for {schema}.{name}: not found")
                    continue
                print(f"\nColumns for {schema}.{name}:")
                for col_name, data_type, nullable in columns:
                    print(f"- {col_name} ({data_type}, nullable={nullable})")

                cursor.execute(
                    f"SELECT * FROM {schema}.{name} LIMIT 3;"
                )
                rows = cursor.fetchall()
                col_names = [desc[0] for desc in cursor.description]
                print(f"Sample rows for {schema}.{name}:")
                if not rows:
                    print("- (no rows)")
                for row in rows:
                    row_map = dict(zip(col_names, row))
                    print(row_map)
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
