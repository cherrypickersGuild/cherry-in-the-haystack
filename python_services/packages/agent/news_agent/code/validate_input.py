import csv
from pathlib import Path


def main() -> int:
    csv_path = Path("dev/apps/agent/news_agent/data/example_data.csv")
    if not csv_path.exists():
        print(f"Missing: {csv_path}")
        return 1

    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        rows = list(reader)

    if not rows:
        print("CSV is empty")
        return 1

    header = rows[0]
    print(f"Header: {header}")

    sample = rows[1:4]
    print("Sample rows (title, content):")
    for row in sample:
        title = row[0] if len(row) > 0 else ""
        content = row[1] if len(row) > 1 else ""
        print(f"- title: {title[:80]}")
        print(f"  content: {content[:120].replace('\n', ' ')}")

    print(f"Total rows (including header): {len(rows)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
