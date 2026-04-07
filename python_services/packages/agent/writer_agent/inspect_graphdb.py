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

    search_term = "llm twin"
    if len(sys.argv) > 1:
        search_term = " ".join(sys.argv[1:]).strip()
    search_term_lc = search_term.lower()
    search_term_compact = search_term_lc.replace(" ", "")

    queries = [
        (
            "Namespaces",
            """
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT DISTINCT ?p WHERE {
                ?s ?p ?o .
            } LIMIT 10
            """,
        ),
        (
            "Classes (sample)",
            """
            PREFIX owl: <http://www.w3.org/2002/07/owl#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT ?class ?label WHERE {
                ?class a owl:Class .
                OPTIONAL { ?class rdfs:label ?label . }
            } LIMIT 20
            """,
        ),
        (
            "Relations (sample)",
            """
            PREFIX owl: <http://www.w3.org/2002/07/owl#>
            SELECT ?s ?p ?o WHERE {
                ?s ?p ?o .
            } LIMIT 20
            """,
        ),
        (
            "SubClassOf edges",
            """
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT ?child ?parent WHERE {
                ?child rdfs:subClassOf ?parent .
            } LIMIT 20
            """,
        ),
        (
            "Properties (sample)",
            """
            PREFIX owl: <http://www.w3.org/2002/07/owl#>
            SELECT ?prop WHERE {
                ?prop a owl:ObjectProperty .
            } LIMIT 20
            """,
        ),
        (
            "LLM concepts (label/description)",
            """
            PREFIX llm: <http://example.org/llm-ontology#>
            PREFIX owl: <http://www.w3.org/2002/07/owl#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT ?concept ?label ?desc WHERE {
                ?concept a owl:Class ;
                         rdfs:label ?label .
                OPTIONAL { ?concept llm:description ?desc . }
                FILTER (STRSTARTS(STR(?concept), "http://example.org/llm-ontology#"))
            } LIMIT 20
            """,
        ),
        (
            "LLM relations (related)",
            """
            PREFIX llm: <http://example.org/llm-ontology#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT ?s ?s_label ?o ?o_label WHERE {
                ?s llm:related ?o .
                OPTIONAL { ?s rdfs:label ?s_label . }
                OPTIONAL { ?o rdfs:label ?o_label . }
            } LIMIT 20
            """,
        ),
        (
            "LLM subclass edges",
            """
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT ?child ?parent WHERE {
                ?child rdfs:subClassOf ?parent .
                FILTER (
                    STRSTARTS(STR(?child), "http://example.org/llm-ontology#")
                    || STRSTARTS(STR(?parent), "http://example.org/llm-ontology#")
                )
            } LIMIT 20
            """,
        ),
        (
            "Eval concepts (label/altLabel)",
            """
            PREFIX eval: <http://example.org/llm-eval-ontology#>
            PREFIX owl: <http://www.w3.org/2002/07/owl#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            SELECT ?concept ?label ?alt_label WHERE {
                ?concept a owl:Class ;
                         rdfs:label ?label .
                OPTIONAL { ?concept skos:altLabel ?alt_label . }
                FILTER (STRSTARTS(STR(?concept), "http://example.org/llm-eval-ontology#"))
            } LIMIT 20
            """,
        ),
        (
            "Eval subclass edges",
            """
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT ?child ?parent WHERE {
                ?child rdfs:subClassOf ?parent .
                FILTER (
                    STRSTARTS(STR(?child), "http://example.org/llm-eval-ontology#")
                    || STRSTARTS(STR(?parent), "http://example.org/llm-eval-ontology#")
                )
            } LIMIT 20
            """,
        ),
        (
            "Label search (llm namespace)",
            """
            PREFIX llm: <http://example.org/llm-ontology#>
            PREFIX owl: <http://www.w3.org/2002/07/owl#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT ?concept ?label ?parent ?parent_label WHERE {
                ?concept a owl:Class ;
                         rdfs:label ?label .
                OPTIONAL { ?concept rdfs:subClassOf ?parent .
                           OPTIONAL { ?parent rdfs:label ?parent_label . } }
                FILTER (
                    CONTAINS(LCASE(STR(?label)), "%SEARCH_TERM_LC%")
                    || CONTAINS(REPLACE(LCASE(STR(?label)), " ", ""), "%SEARCH_TERM_COMPACT%")
                )
            } LIMIT 50
            """,
        ),
        (
            "Label search (eval namespace)",
            """
            PREFIX eval: <http://example.org/llm-eval-ontology#>
            PREFIX owl: <http://www.w3.org/2002/07/owl#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            SELECT ?concept ?label ?alt_label ?parent ?parent_label WHERE {
                ?concept a owl:Class ;
                         rdfs:label ?label .
                OPTIONAL { ?concept skos:altLabel ?alt_label . }
                OPTIONAL { ?concept rdfs:subClassOf ?parent .
                           OPTIONAL { ?parent rdfs:label ?parent_label . } }
                FILTER (
                    CONTAINS(LCASE(STR(?label)), "%SEARCH_TERM_LC%")
                    || CONTAINS(REPLACE(LCASE(STR(?label)), " ", ""), "%SEARCH_TERM_COMPACT%")
                    || CONTAINS(LCASE(STR(?alt_label)), "%SEARCH_TERM_LC%")
                )
            } LIMIT 50
            """,
        ),
    ]

    for title, sparql in queries:
        print(f"\n== {title} ==")
        try:
            query = (
                sparql.replace("%SEARCH_TERM_LC%", search_term_lc)
                .replace("%SEARCH_TERM_COMPACT%", search_term_compact)
            )
            results = engine.query(query)
        except Exception as exc:
            print(f"Query failed: {exc}")
            continue
        if not results:
            print("(no results)")
            continue
        for row in results:
            print(row)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
