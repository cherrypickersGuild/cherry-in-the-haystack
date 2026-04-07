import os
import sys
from collections import defaultdict
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


def shorten(uri: str) -> str:
    if "#" in uri:
        return uri.split("#")[-1]
    return uri.rsplit("/", 1)[-1]


def print_tree(
    node: str,
    children_map: dict,
    labels: dict,
    prefix: str = "",
    path: set | None = None,
    lines: list | None = None,
    is_last: bool = True,
) -> None:
    if path is None:
        path = set()

    label = labels.get(node) or shorten(node)
    branch = ""
    if prefix:
        branch = "└── " if is_last else "├── "
    line = f"{prefix}{branch}{label}"

    if node in path:
        line = f"{line} (cycle)"
        if lines is not None:
            lines.append(line)
        else:
            print(line)
        return

    if lines is not None:
        lines.append(line)
    else:
        print(line)

    path.add(node)
    children = sorted(
        set(children_map.get(node, [])),
        key=lambda x: labels.get(x, x)
    )
    for i, child in enumerate(children):
        child_is_last = i == len(children) - 1
        next_prefix = prefix + ("    " if is_last else "│   ")
        print_tree(
            child,
            children_map,
            labels,
            next_prefix,
            path.copy(),
            lines,
            child_is_last,
        )


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

    label_query = """
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT ?concept ?label WHERE {
        ?concept rdfs:label ?label .
        FILTER (STRSTARTS(STR(?concept), "http://example.org/llm-ontology#"))
    }
    """
    labels = {}
    for row in engine.query(label_query):
        uri = row["concept"]["value"]
        label = row["label"]["value"]
        labels[uri] = label

    edge_query = """
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT ?child ?parent WHERE {
        ?child rdfs:subClassOf ?parent .
        FILTER (
            STRSTARTS(STR(?child), "http://example.org/llm-ontology#")
            || STRSTARTS(STR(?parent), "http://example.org/llm-ontology#")
        )
    }
    """
    children_map = defaultdict(list)
    parents_map = defaultdict(set)
    nodes = set()
    for row in engine.query(edge_query):
        child = row["child"]["value"]
        parent = row["parent"]["value"]
        nodes.add(child)
        nodes.add(parent)
        if child == parent:
            continue
        children_map[parent].append(child)
        parents_map[child].add(parent)

    llmconcept_uri = "http://example.org/llm-ontology#LLMConcept"
    output_path = os.getenv(
        "GRAPHDB_TREE_OUTPUT",
        str(Path(__file__).with_name("graphdb_tree.txt"))
    )
    root_override = os.getenv("GRAPHDB_TREE_ROOT", "").strip()
    include_orphans = os.getenv("GRAPHDB_TREE_INCLUDE_ORPHANS", "").strip() == "1"
    lines: list[str] = []

    if root_override:
        root_uri = (
            root_override
            if root_override.startswith("http")
            else f"http://example.org/llm-ontology#{root_override}"
        )
        if root_uri in nodes:
            print_tree(root_uri, children_map, labels, lines=lines)
        else:
            print(f"Root not found: {root_override}")
            return 1
    elif llmconcept_uri in nodes:
        print_tree(llmconcept_uri, children_map, labels, lines=lines)
        if include_orphans:
            roots = [n for n in nodes if not parents_map.get(n)]
            for root in sorted(roots, key=lambda x: labels.get(x, x)):
                if root == llmconcept_uri:
                    continue
                lines.append("")
                print_tree(root, children_map, labels, lines=lines)
    else:
        roots = [n for n in nodes if not parents_map.get(n)]
        if not roots:
            print("No subclass hierarchy found.")
            return 0
        for root in sorted(roots, key=lambda x: labels.get(x, x)):
            print_tree(root, children_map, labels, lines=lines)
            lines.append("")

    Path(output_path).write_text("\n".join(lines))
    print(f"Wrote tree to {output_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
