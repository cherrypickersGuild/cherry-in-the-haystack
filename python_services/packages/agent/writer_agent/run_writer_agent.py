import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def query_graphdb(topic: str, limit: int = 20) -> List[Dict[str, Any]]:
    endpoint = os.getenv("GRAPHDB_ENDPOINT", "").strip()
    if not endpoint:
        raise ValueError("GRAPHDB_ENDPOINT is not set.")

    namespace = os.getenv("GRAPHDB_NAMESPACE", "").strip()
    if not namespace:
        namespace = "http://example.org/llm-eval-ontology#"

    dev_root = Path(__file__).resolve().parents[3]
    ontology_src = dev_root / "packages" / "ontology" / "src"
    sys.path.insert(0, str(ontology_src))
    from storage.graph_query_engine import GraphQueryEngine

    engine = GraphQueryEngine(endpoint)
    topic_lc = topic.lower()
    topic_nospace = topic_lc.replace(" ", "")
    query = f"""
    PREFIX llm: <http://example.org/llm-ontology#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>

    SELECT ?concept ?label ?description WHERE {{
        ?concept a owl:Class ;
                 rdfs:label ?label .
        OPTIONAL {{ ?concept llm:description ?description . }}
        FILTER (
            STRSTARTS(STR(?concept), "{namespace}")
        )
        FILTER (
            CONTAINS(LCASE(STR(?label)), "{topic_lc}")
            || CONTAINS(LCASE(STR(?description)), "{topic_lc}")
            || CONTAINS(REPLACE(LCASE(STR(?label)), " ", ""), "{topic_nospace}")
        )
    }}
    LIMIT {limit}
    """
    return engine.query(query)


def query_graphdb_related(topic: str, limit: int = 20) -> List[Dict[str, Any]]:
    endpoint = os.getenv("GRAPHDB_ENDPOINT", "").strip()
    if not endpoint:
        raise ValueError("GRAPHDB_ENDPOINT is not set.")

    namespace = os.getenv("GRAPHDB_NAMESPACE", "").strip()
    if not namespace:
        namespace = "http://example.org/llm-eval-ontology#"

    dev_root = Path(__file__).resolve().parents[3]
    ontology_src = dev_root / "packages" / "ontology" / "src"
    sys.path.insert(0, str(ontology_src))
    from storage.graph_query_engine import GraphQueryEngine

    engine = GraphQueryEngine(endpoint)
    topic_lc = topic.lower()
    topic_nospace = topic_lc.replace(" ", "")
    query_subclass = f"""
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>

    SELECT ?focus ?focus_label ?related ?related_label WHERE {{
        ?focus a owl:Class ;
               rdfs:label ?focus_label .
        FILTER (
            STRSTARTS(STR(?focus), "{namespace}")
        )
        FILTER (
            CONTAINS(LCASE(STR(?focus_label)), "{topic_lc}")
            || CONTAINS(REPLACE(LCASE(STR(?focus_label)), " ", ""), "{topic_nospace}")
        )

        {{
          ?focus rdfs:subClassOf ?related .
        }}
        UNION
        {{
          ?related rdfs:subClassOf ?focus .
        }}
        UNION
        {{
          ?focus rdfs:subClassOf ?parent .
          ?related rdfs:subClassOf ?parent .
          FILTER (?related != ?focus)
        }}

        OPTIONAL {{ ?related rdfs:label ?related_label . }}
        FILTER (
            STRSTARTS(STR(?related), "{namespace}")
            && ?related != rdfs:Resource
            && ?related != ?focus
        )
    }}
    LIMIT {limit}
    """
    return engine.query(query_subclass)


def query_evidence_db(topic: str, limit: int = 10) -> List[Dict[str, Any]]:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise ValueError("DATABASE_URL is not set.")

    def build_patterns(value: str) -> List[str]:
        cleaned = value.strip()
        if not cleaned:
            return []
        tokens = re.findall(r"[A-Za-z0-9]+", cleaned)
        stopwords = {
            "a", "an", "the", "and", "or", "of", "for", "to", "in", "on",
            "with", "by", "from", "as", "at", "is", "are", "was", "were",
            "be", "been", "being", "this", "that", "these", "those",
        }
        patterns = {cleaned}
        if tokens:
            patterns.add(" ".join(tokens))
            for token in tokens:
                token_lc = token.lower()
                if token_lc in stopwords:
                    continue
                if len(token) >= 4 or (token.isupper() and len(token) >= 2):
                    patterns.add(token)
            if len(tokens) > 1:
                acronym = "".join(token[0] for token in tokens if token)
                if len(acronym) >= 2:
                    patterns.add(acronym)
        ordered = sorted(patterns, key=lambda s: (-len(s), s.lower()))
        return ordered

    def build_anchor(value: str) -> str | None:
        tokens = re.findall(r"[A-Za-z0-9]+", value.strip())
        long_tokens = [token for token in tokens if len(token) >= 4]
        if not long_tokens:
            return None
        anchor = max(long_tokens, key=len)
        return anchor

    query_tpl = os.getenv("EVIDENCE_QUERY_TEMPLATE", "").strip()
    if not query_tpl:
        query_tpl = (
            "SELECT pc.id AS chunk_id, pc.body_text, pc.page_number, "
            "pc.paragraph_index, pc.chapter_id, pc.section_id, "
            "b.id AS book_id, b.title AS book_title, b.author AS book_author "
            "FROM public.paragraph_chunks pc "
            "LEFT JOIN public.books b ON b.id = pc.book_id "
            "WHERE (pc.body_text ILIKE %(phrase)s "
            "OR (pc.body_text ILIKE ANY (%(patterns)s) "
            "AND (%(anchor)s IS NULL OR pc.body_text ILIKE %(anchor)s))) "
            "AND pc.body_text !~* '(^|\\y)(references|copyright|isbn|all rights reserved)\\y' "
            "AND char_length(pc.body_text) >= 120 "
            "AND pc.body_text !~* '(^|\\y)(table of contents|contents|foreword|acknowledg(e)?ments|chapter)\\y' "
            "AND pc.body_text !~ '\\\\.{3,}\\\\s*\\\\d{1,4}' "
            "AND pc.body_text !~ '\\\\.{2,}\\\\s*\\\\d{1,4}' "
            "AND pc.body_text !~ '(^|\\\\n)\\\\s*\\\\d{1,4}\\\\s*(\\\\n|$)' "
            "ORDER BY CASE WHEN pc.body_text ILIKE %(phrase)s THEN 0 ELSE 1 END "
            "LIMIT %(limit)s;"
        )

    try:
        import psycopg2
    except Exception as exc:
        raise RuntimeError(f"psycopg2 is not available: {exc}") from exc

    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor() as cursor:
            patterns = build_patterns(topic)
            if not patterns:
                patterns = [topic]
            pattern_values = [f"%{pattern}%" for pattern in patterns]
            anchor = build_anchor(topic)
            anchor_value = f"%{anchor}%" if anchor else None
            cursor.execute(
                query_tpl,
                {
                    "pattern": f"%{topic}%",
                    "phrase": f"%{topic}%",
                    "patterns": pattern_values,
                    "anchor": anchor_value,
                    "limit": limit,
                }
            )
            rows = cursor.fetchall()
            columns = [col[0] for col in cursor.description]
    finally:
        conn.close()

    raw_rows = [dict(zip(columns, row)) for row in rows]
    filtered = []
    dotted_page = re.compile(r"\.(\s*\.){2,}\s*\d{1,4}")
    for row in raw_rows:
        body = (row.get("body_text") or "").strip()
        if dotted_page.search(body):
            continue
        filtered.append(row)
    return filtered


def sanitize_filename(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "_", value.strip())
    return cleaned or "topic"


def parse_json_output(text: str) -> Dict[str, Any] | None:
    try:
        return json.loads(text)
    except Exception:
        pass

    if not text:
        return None

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None

    snippet = text[start : end + 1]
    try:
        return json.loads(snippet)
    except Exception:
        return None


def build_references_from_evidence(
    evidence_rows: List[Dict[str, Any]],
    max_snippets_per_source: int = 5,
) -> List[Dict[str, Any]]:
    by_source: Dict[str, List[Dict[str, Any]]] = {}
    for row in evidence_rows:
        source = row.get("book_title") or "Unknown Source"
        by_source.setdefault(source, []).append(row)

    references: List[Dict[str, Any]] = []
    for source, rows in by_source.items():
        snippets = []
        for row in rows[:max_snippets_per_source]:
            body = (row.get("body_text") or "").strip()
            snippet = body[:200].replace("\n", " ").strip()
            snippets.append(
                {
                    "chunk_id": row.get("chunk_id"),
                    "excerpt": snippet,
                }
            )

        references.append(
            {
                "source": source,
                "author": rows[0].get("book_author"),
                "snippets": snippets,
            }
        )

    return references


def parse_update_file(update_path: Path) -> Dict[str, str] | None:
    if not update_path.exists():
        return None
    content = update_path.read_text().strip()
    if not content:
        return None
    lines = [line.rstrip() for line in content.splitlines() if line.strip()]
    if not lines:
        return None
    title = ""
    first = lines[0].strip()
    if first.startswith("[") and first.endswith("]") and len(first) > 2:
        title = first[1:-1].strip()
        body_lines = lines[1:]
    else:
        body_lines = lines
    body = "\n".join(body_lines).strip()
    if not title:
        title = body.split("\n", 1)[0][:120]
    return {"title": title, "body": body}


def build_agents():
    try:
        from agents import Agent, Runner, OpenAIProvider, function_tool
    except Exception as exc:
        raise RuntimeError(
            "Agents SDK is not available. Install the OpenAI Agents SDK "
            "package before running this script."
        ) from exc

    model_name = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not set.")

    provider = OpenAIProvider(api_key=api_key)
    model = provider.get_model(model_name)

    @function_tool
    def graphdb_concepts(topic: str) -> str:
        """Fetch related concepts from GraphDB as JSON."""
        results = query_graphdb(topic)
        return json.dumps(results, ensure_ascii=True)

    @function_tool
    def evidence_chunks(topic: str, limit: int = 10) -> str:
        """Fetch evidence chunks from Evidence DB as JSON."""
        results = query_evidence_db(topic, limit=limit)
        return json.dumps(results, ensure_ascii=True)

    ontology_agent = Agent(
        name="OntologyJudge",
        instructions=(
            "You decide which concepts are most relevant to the topic. "
            "Use the graphdb_concepts tool. Return JSON with two fields: "
            "concepts (list of labels) and notes (short reasoning)."
        ),
        model=model,
        tools=[graphdb_concepts],
    )

    summary_agent = Agent(
        name="EvidenceSummarizer",
        instructions=(
            "You summarize evidence into key points. Use evidence_chunks. "
            "Treat the topic as a single concept label; normalize partial "
            "mentions, abbreviations, or component terms back to the topic. "
            "Return JSON with fields: key_concepts (list), bullets (list)."
        ),
        model=model,
        tools=[evidence_chunks],
    )

    writer_agent = Agent(
        name="CherryWriter",
        instructions=(
            "You output JSON with keys: summary, why_it_matters, references, "
            "updates, patch_notes. Use the provided topic, related concepts, "
            "evidence summary, and update payloads. Patch notes should concisely "
            "describe what changed in the topic. Each reference item should have "
            "source and claims."
        ),
        model=model,
    )

    return Agent, Runner, ontology_agent, summary_agent, writer_agent


def main() -> int:
    env_path = Path(__file__).with_name(".env")
    load_env_file(env_path)

    topic = " ".join(sys.argv[1:]).strip()
    if not topic:
        topic = os.getenv("WRITER_TOPIC_DEFAULT", "").strip()
    if not topic:
        print("Topic is required. Pass it as args or set WRITER_TOPIC_DEFAULT.")
        return 1

    Agent, Runner, ontology_agent, summary_agent, writer_agent = build_agents()

    update_path = os.getenv("WRITER_UPDATE_PATH", "").strip()
    if not update_path:
        update_path = "./dev/apps/agent/writer_agent/data/update.txt"
    update_payload = parse_update_file(Path(update_path))

    evidence_rows = query_evidence_db(
        topic,
        limit=int(os.getenv("EVIDENCE_DB_MIN_RESULTS", "10"))
    )
    graph_rows = query_graphdb(topic)
    related_rows = query_graphdb_related(topic)

    ontology_result = Runner.run_sync(
        ontology_agent,
        f"Topic: {topic}"
    )
    summary_result = Runner.run_sync(
        summary_agent,
        f"Topic: {topic}"
    )

    writer_input = (
        f"Topic: {topic}\n\n"
        f"Related Concepts (graphdb related):\n{json.dumps(related_rows, ensure_ascii=True)}\n\n"
        f"Ontology Result:\n{ontology_result.final_output}\n\n"
        f"Evidence Summary:\n{summary_result.final_output}\n\n"
        f"Update Payload:\n{json.dumps(update_payload, ensure_ascii=True)}\n"
    )

    writer_result = Runner.run_sync(writer_agent, writer_input)

    writer_json = parse_json_output(writer_result.final_output)
    if writer_json is None:
        retry_prompt = (
            "Return ONLY valid JSON with keys: summary, why_it_matters, references. "
            "Do not add markdown or extra text.\n\n"
            f"{writer_input}"
        )
        retry_result = Runner.run_sync(writer_agent, retry_prompt)
        writer_json = parse_json_output(retry_result.final_output)

    if writer_json is None:
        writer_json = {
            "summary": "",
            "why_it_matters": "",
            "references": [],
            "updates": [],
            "patch_notes": [],
            "raw_output": writer_result.final_output,
        }

    related_concepts = []
    try:
        ontology_json = json.loads(ontology_result.final_output)
        related_concepts = ontology_json.get("concepts", [])
    except Exception:
        related_concepts = []

    graph_labels = []
    for row in graph_rows:
        label = None
        if "label" in row and "value" in row["label"]:
            label = row["label"]["value"]
        if label:
            graph_labels.append(label)

    related_from_graph = []
    for row in related_rows:
        label = None
        if "related_label" in row and "value" in row["related_label"]:
            label = row["related_label"]["value"]
        if not label and "related" in row and "value" in row["related"]:
            label = row["related"]["value"].split("#")[-1]
        if label:
            related_from_graph.append(label)

    related_merged = related_concepts + related_from_graph + graph_labels
    if related_merged:
        topic_norm = topic.strip().lower()
        filtered = []
        for label in related_merged:
            if not label:
                continue
            label_norm = label.strip().lower()
            if label_norm == topic_norm:
                continue
            if label_norm == "resource":
                continue
            filtered.append(label)
        related_concepts = sorted(set(filtered))

    references = build_references_from_evidence(evidence_rows)

    output = {
        "topic": topic,
        "summary": writer_json.get("summary", ""),
        "why_it_matters": writer_json.get("why_it_matters", ""),
        "evidence": evidence_rows,
        "related_concepts": related_concepts,
        "references": references,
        "updates": writer_json.get("updates", []),
        "patch_notes": writer_json.get("patch_notes", []),
    }
    if isinstance(output["patch_notes"], str):
        output["patch_notes"] = [output["patch_notes"]]

    output_dir = os.getenv("WRITER_OUTPUT_DIR", "").strip() or "./dev/apps/agent/writer_agent/outputs"
    path = Path(output_dir)
    path.mkdir(parents=True, exist_ok=True)
    filename = sanitize_filename(topic)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = path / f"{filename}_{timestamp}.json"
    json_path.write_text(json.dumps(output, ensure_ascii=True, indent=2))
    print(json.dumps(output, ensure_ascii=True, indent=2))
    print(f"Wrote: {json_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
