import os
import sys
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

    endpoint = os.getenv("GRAPHDB_ENDPOINT", "").strip()
    if not endpoint:
        print("GRAPHDB_ENDPOINT is not set.")
        return 1

    dev_root = Path(__file__).resolve().parents[3]
    ontology_src = dev_root / "packages" / "ontology" / "src"
    sys.path.insert(0, str(ontology_src))

    try:
        from storage.graph_query_engine import GraphQueryEngine
    except Exception as exc:
        print(f"Failed to import GraphQueryEngine: {exc}")
        return 1

    engine = GraphQueryEngine(endpoint)
    query = "SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 1"

    try:
        results = engine.query(query)
    except Exception as exc:
        print(f"GraphDB query failed: {exc}")
        return 1

    if results:
        row = results[0]
        print("GraphDB connection OK.")
        print(f"s={row.get('s', {}).get('value')}")
        print(f"p={row.get('p', {}).get('value')}")
        print(f"o={row.get('o', {}).get('value')}")
    else:
        print("GraphDB connection OK, but no results returned.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
