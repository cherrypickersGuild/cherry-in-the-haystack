from __future__ import annotations

import importlib.util
import json
import os
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence

from anthropic import Anthropic
from db_utils import load_env_file, resolve_database_url


ONTOLOGY_NAMESPACE = "http://example.org/llm-ontology#"


def load_graph_query_engine_class():
    packages_root = Path(__file__).resolve().parents[2]
    module_path = packages_root / "idea_to_graph_ontology" / "src" / "storage" / "graph_query_engine.py"
    spec = importlib.util.spec_from_file_location("writer_agent_graph_query_engine", module_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Failed to load GraphQueryEngine module from {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.GraphQueryEngine


def escape_sparql_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def slugify(value: Any) -> str:
    text = normalize_text(value).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def sanitize_filename(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "_", value.strip())
    return cleaned or "topic"


def normalize_text(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def excerpt_text(value: Any, limit: int = 280) -> str:
    normalized = normalize_text(value)
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 3].rstrip() + "..."


def normalize_author(value: Any) -> str:
    author = normalize_text(value)
    return re.sub(r"[;,]+$", "", author).strip()


def extract_binding_value(row: Dict[str, Any], key: str) -> str:
    value = row.get(key)
    if isinstance(value, dict):
        return str(value.get("value") or "").strip()
    return str(value or "").strip()


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


def split_keywords(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        values = value
    else:
        raw = str(value)
        values = re.split(r"[,\n;|]+", raw)
    keywords: List[str] = []
    seen: set[str] = set()
    for item in values:
        keyword = normalize_text(item)
        if not keyword:
            continue
        keyword_key = keyword.lower()
        if keyword_key in seen:
            continue
        seen.add(keyword_key)
        keywords.append(keyword)
    return keywords


def sentence_count(text: str) -> int:
    parts = [part.strip() for part in re.split(r"(?<=[.!?])\s+", normalize_text(text)) if part.strip()]
    return len(parts)


def first_sentence(text: str) -> str:
    normalized = normalize_text(text)
    if not normalized:
        return ""
    parts = re.split(r"(?<=[.!?])\s+", normalized)
    return parts[0].strip()


def derive_acronym(value: str) -> str:
    words = re.findall(r"[A-Za-z0-9]+", value)
    if len(words) <= 1:
        return ""
    acronym = "".join(word[0] for word in words if word)
    return acronym.upper() if len(acronym) >= 2 else ""


def build_source_label(row: Dict[str, Any]) -> str:
    title = normalize_text(row.get("book_title")) or "Unknown Source"
    author = normalize_author(row.get("book_author"))
    year = row.get("book_year")
    if author and year:
        return f"{title} ({author}, {year})"
    if author:
        return f"{title} ({author})"
    return title


def load_graph_rows(query: str) -> List[Dict[str, Any]]:
    endpoint = os.getenv("GRAPHDB_ENDPOINT", "").strip()
    if not endpoint:
        raise ValueError("GRAPHDB_ENDPOINT is not set.")
    GraphQueryEngine = load_graph_query_engine_class()
    engine = GraphQueryEngine(endpoint)
    return engine.query(query)


def query_focus_concept_candidates(topic: str, limit: int = 50) -> List[Dict[str, Any]]:
    topic_text = escape_sparql_string(normalize_text(topic))
    topic_slug = escape_sparql_string(slugify(topic))
    topic_compact = escape_sparql_string(re.sub(r"[^a-z0-9]+", "", normalize_text(topic).lower()))
    query = f"""
    PREFIX llm: <{ONTOLOGY_NAMESPACE}>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>

    SELECT ?concept ?label ?description ?keyword WHERE {{
      ?concept a owl:Class ;
               rdfs:label ?label .
      OPTIONAL {{ ?concept llm:description ?description . }}
      OPTIONAL {{ ?concept llm:keywords ?keyword . }}
      FILTER (STRSTARTS(STR(?concept), "{ONTOLOGY_NAMESPACE}"))
      FILTER (
        LCASE(STR(?label)) = LCASE("{topic_text}")
        || LCASE(REPLACE(STR(?label), " ", "")) = "{topic_compact}"
        || LCASE(STRAFTER(STR(?concept), "#")) = "{topic_slug}"
        || CONTAINS(LCASE(STR(?label)), LCASE("{topic_text}"))
        || CONTAINS(LCASE(REPLACE(STR(?label), " ", "")), "{topic_compact}")
        || CONTAINS(LCASE(COALESCE(STR(?description), "")), LCASE("{topic_text}"))
        || CONTAINS(LCASE(COALESCE(STR(?keyword), "")), LCASE("{topic_text}"))
      )
    }}
    LIMIT {limit}
    """
    return load_graph_rows(query)


def aggregate_focus_concept_candidates(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    aggregated: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        concept_uri = extract_binding_value(row, "concept")
        if not concept_uri:
            continue
        entry = aggregated.setdefault(
            concept_uri,
            {
                "uri": concept_uri,
                "slug": concept_uri.split("#")[-1],
                "label": "",
                "description": "",
                "keywords": [],
            },
        )
        label = normalize_text(extract_binding_value(row, "label"))
        description = normalize_text(extract_binding_value(row, "description"))
        keyword = normalize_text(extract_binding_value(row, "keyword"))
        if label and not entry["label"]:
            entry["label"] = label
        if description and not entry["description"]:
            entry["description"] = description
        if keyword:
            entry["keywords"] = split_keywords(entry["keywords"] + [keyword])
    return list(aggregated.values())


def score_focus_concept(topic: str, candidate: Dict[str, Any]) -> int:
    topic_norm = normalize_text(topic).lower()
    topic_slug = slugify(topic)
    topic_compact = re.sub(r"[^a-z0-9]+", "", topic_norm)
    label = normalize_text(candidate.get("label")).lower()
    slug = slugify(candidate.get("slug"))
    description = normalize_text(candidate.get("description")).lower()
    keywords = [normalize_text(keyword).lower() for keyword in candidate.get("keywords", [])]
    score = 0

    if label == topic_norm:
        score += 200
    if slug == topic_slug:
        score += 190
    if re.sub(r"[^a-z0-9]+", "", label) == topic_compact and label:
        score += 160
    if topic_norm and topic_norm in label:
        score += 110
    if label and label in topic_norm:
        score += 70
    if topic_norm and topic_norm in description:
        score += 35
    if any(keyword == topic_norm for keyword in keywords):
        score += 90
    if any(topic_norm in keyword or keyword in topic_norm for keyword in keywords if keyword):
        score += 30

    topic_upper = normalize_text(topic).upper()
    candidate_acronym = derive_acronym(candidate.get("label") or "")
    if topic_upper and len(topic_upper) <= 8 and topic_upper == candidate_acronym:
        score += 150
    if candidate.get("label") and normalize_text(candidate.get("label")).upper() == topic_upper:
        score += 130
    return score


def resolve_focus_concept(topic: str) -> Dict[str, Any]:
    rows = query_focus_concept_candidates(topic)
    candidates = aggregate_focus_concept_candidates(rows)
    if not candidates:
        return {
            "slug": slugify(topic),
            "label": normalize_text(topic),
            "description": "",
            "keywords": [normalize_text(topic)],
        }

    candidates.sort(key=lambda item: (-score_focus_concept(topic, item), item["label"]))
    best = candidates[0]
    return {
        "slug": normalize_text(best.get("slug")) or slugify(topic),
        "label": normalize_text(best.get("label")) or normalize_text(topic),
        "description": normalize_text(best.get("description")),
        "keywords": split_keywords(best.get("keywords")),
    }


def query_related_graph_rows(concept_slug: str, limit: int = 50) -> List[Dict[str, Any]]:
    concept_slug_escaped = escape_sparql_string(concept_slug)
    query = f"""
    PREFIX llm: <{ONTOLOGY_NAMESPACE}>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?related ?related_label ?related_description ?relation ?count WHERE {{
      {{
        llm:{concept_slug_escaped} rdfs:subClassOf ?related .
        ?related rdfs:label ?related_label .
        OPTIONAL {{ ?related llm:description ?related_description . }}
        BIND("parent" AS ?relation)
        BIND(0 AS ?count)
      }}
      UNION
      {{
        ?related rdfs:subClassOf llm:{concept_slug_escaped} .
        ?related rdfs:label ?related_label .
        OPTIONAL {{ ?related llm:description ?related_description . }}
        BIND("child" AS ?relation)
        BIND(0 AS ?count)
      }}
      UNION
      {{
        llm:{concept_slug_escaped} llm:related ?related .
        ?related rdfs:label ?related_label .
        OPTIONAL {{ ?related llm:description ?related_description . }}
        OPTIONAL {{
          ?rel llm:source llm:{concept_slug_escaped} ;
               llm:target ?related ;
               llm:cooccurrenceCount ?count .
        }}
        BIND("related" AS ?relation)
      }}
      UNION
      {{
        ?related llm:related llm:{concept_slug_escaped} .
        ?related rdfs:label ?related_label .
        OPTIONAL {{ ?related llm:description ?related_description . }}
        OPTIONAL {{
          ?rel llm:source ?related ;
               llm:target llm:{concept_slug_escaped} ;
               llm:cooccurrenceCount ?count .
        }}
        BIND("related" AS ?relation)
      }}
      FILTER (STRSTARTS(STR(?related), "{ONTOLOGY_NAMESPACE}"))
    }}
    LIMIT {limit}
    """
    return load_graph_rows(query)


def query_graph_concept_instances(concept_slug: str, limit: int = 100) -> List[Dict[str, Any]]:
    concept_slug_escaped = escape_sparql_string(concept_slug)
    query = f"""
    PREFIX llm: <{ONTOLOGY_NAMESPACE}>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?inst ?label ?section WHERE {{
      ?inst a llm:ConceptInstance ;
            llm:instanceOf llm:{concept_slug_escaped} ;
            rdfs:label ?label .
      OPTIONAL {{ ?inst llm:fromSection ?section . }}
    }}
    LIMIT {limit}
    """
    return load_graph_rows(query)


def classify_related_concepts(focus_concept: Dict[str, Any], rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    focus_label = normalize_text(focus_concept.get("label")).lower()
    by_label: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        label = normalize_text(extract_binding_value(row, "related_label"))
        if not label or label.lower() == focus_label:
            continue
        raw_relation = normalize_text(extract_binding_value(row, "relation")).lower() or "related"
        count_text = normalize_text(extract_binding_value(row, "count"))
        try:
            count = int(float(count_text))
        except Exception:
            count = 0
        relation = raw_relation
        if relation == "related":
            relation = "child"
        current = by_label.get(label.lower())
        if current is None or (current["relation"] == "child" and relation == "parent") or count > current["co_occurrence_count"]:
            by_label[label.lower()] = {
                "label": label,
                "relation": relation if relation in {"parent", "child"} else "child",
                "co_occurrence_count": count,
                "raw_relation": raw_relation,
                "description": normalize_text(extract_binding_value(row, "related_description")),
            }
    related = list(by_label.values())
    related.sort(key=lambda item: (0 if item["relation"] == "parent" else 1, -item["co_occurrence_count"], item["label"]))
    return related[:12]


def extract_graph_instance_labels(rows: Sequence[Dict[str, Any]]) -> List[str]:
    labels: List[str] = []
    seen: set[str] = set()
    for row in rows:
        label = normalize_text(extract_binding_value(row, "label"))
        if not label:
            continue
        key = label.lower()
        if key in seen:
            continue
        seen.add(key)
        labels.append(label)
    return labels


def handbook_concept_names(focus_concept: Dict[str, Any], topic: str) -> List[str]:
    names = [
        normalize_text(focus_concept.get("label")),
        normalize_text(topic),
        slugify(topic).replace("-", " "),
    ]
    names.extend(split_keywords(focus_concept.get("keywords")))
    unique: List[str] = []
    seen: set[str] = set()
    for name in names:
        key = normalize_text(name).lower()
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(normalize_text(name))
    return unique


def build_search_terms(focus_concept: Dict[str, Any], topic: str) -> List[str]:
    label = normalize_text(focus_concept.get("label")) or normalize_text(topic)
    description = normalize_text(focus_concept.get("description"))
    terms = [label, normalize_text(topic)]
    terms.extend(split_keywords(focus_concept.get("keywords")))

    if label and len(label) <= 8 and label.upper() == label:
        match = re.search(r"([A-Za-z][A-Za-z -]+)", description)
        if match:
            phrase = normalize_text(match.group(1))
            if len(phrase) > len(label):
                terms.append(phrase)
    else:
        acronym = derive_acronym(label)
        if acronym:
            terms.append(acronym)

    unique: List[str] = []
    seen: set[str] = set()
    for term in terms:
        normalized = normalize_text(term)
        key = normalized.lower()
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(normalized)
    return unique


def build_search_rules(terms: Sequence[str]) -> List[Dict[str, Any]]:
    rules: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for index, term in enumerate(terms):
        normalized = normalize_text(term)
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)

        tokens = re.findall(r"[A-Za-z0-9]+", normalized)
        if not tokens:
            continue

        if normalized.isupper() and len(normalized) <= 8:
            pattern = re.compile(rf"(?<![A-Za-z0-9]){re.escape(normalized)}(?![A-Za-z0-9])", re.IGNORECASE)
            weight = 26 if index == 0 else 20
        elif len(tokens) > 1:
            separator = r"[\s\-\u2010\u2011\u2012\u2013\u2014]+"
            pattern = re.compile(rf"(?<![A-Za-z0-9]){separator.join(re.escape(token) for token in tokens)}(?![A-Za-z0-9])", re.IGNORECASE)
            weight = 22 if index == 0 else 16
        else:
            token = tokens[0]
            pattern = re.compile(rf"(?<![A-Za-z0-9]){re.escape(token)}(?![A-Za-z0-9])", re.IGNORECASE)
            weight = 18 if index == 0 else 12

        rules.append({"term": normalized, "pattern": pattern, "weight": weight})
    return rules


def build_sql_search_clauses(terms: Sequence[str]) -> tuple[str, List[Any]]:
    phrase_terms = [term for term in terms if not (term.isupper() and len(term) <= 8)]
    acronym_terms = [term for term in terms if term.isupper() and len(term) <= 8]
    clauses: List[str] = []
    params: List[Any] = []

    if phrase_terms:
        patterns = [f"%{term}%" for term in phrase_terms]
        clauses.append(
            "("
            "pc.body_text ILIKE ANY(%s) OR "
            "COALESCE(c.title, '') ILIKE ANY(%s) OR "
            "COALESCE(s.title, '') ILIKE ANY(%s)"
            ")"
        )
        params.extend([patterns, patterns, patterns])

    for term in acronym_terms:
        regex = rf"(^|[^A-Za-z0-9]){re.escape(term)}([^A-Za-z0-9]|$)"
        clauses.append(
            "("
            "pc.body_text ~* %s OR "
            "COALESCE(c.title, '') ~* %s OR "
            "COALESCE(s.title, '') ~* %s"
            ")"
        )
        params.extend([regex, regex, regex])

    if not clauses:
        clauses.append("pc.body_text ILIKE %s")
        params.append(f"%{normalize_text(terms[0] if terms else '')}%")

    return " OR ".join(clauses), params


def build_key_idea_sql_clauses(terms: Sequence[str]) -> tuple[str, List[Any]]:
    phrase_terms = [term for term in terms if not (term.isupper() and len(term) <= 8)]
    acronym_terms = [term for term in terms if term.isupper() and len(term) <= 8]
    clauses: List[str] = []
    params: List[Any] = []

    if phrase_terms:
        patterns = [f"%{term}%" for term in phrase_terms]
        clauses.append(
            "("
            "COALESCE(ig.canonical_idea_text, '') ILIKE ANY(%s) OR "
            "COALESCE(ki.core_idea_text, '') ILIKE ANY(%s)"
            ")"
        )
        params.extend([patterns, patterns])

    for term in acronym_terms:
        regex = rf"(^|[^A-Za-z0-9]){re.escape(term)}([^A-Za-z0-9]|$)"
        clauses.append(
            "("
            "COALESCE(ig.canonical_idea_text, '') ~* %s OR "
            "COALESCE(ki.core_idea_text, '') ~* %s"
            ")"
        )
        params.extend([regex, regex])

    if not clauses:
        clauses.append("COALESCE(ig.canonical_idea_text, ki.core_idea_text, '') ILIKE %s")
        params.append(f"%{normalize_text(terms[0] if terms else '')}%")

    return " OR ".join(clauses), params


def get_db_connection():
    database_url = resolve_database_url()
    if not database_url:
        raise ValueError("Evidence DB connection settings are not set. Provide LOCAL_DB_* or DATABASE_URL.")
    try:
        import psycopg2
    except Exception as exc:
        raise RuntimeError(f"psycopg2 is not available: {exc}") from exc
    return psycopg2.connect(database_url)


def fetch_public_key_idea_rows(terms: Sequence[str], limit: int) -> List[Dict[str, Any]]:
    where_clause, params = build_key_idea_sql_clauses(terms)
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                  ki.id::text AS key_idea_id,
                  ki.chunk_id::text AS chunk_id,
                  COALESCE(NULLIF(ig.canonical_idea_text, ''), NULLIF(ki.core_idea_text, ''), '') AS group_label,
                  COALESCE(NULLIF(ki.core_idea_text, ''), NULLIF(ig.canonical_idea_text, ''), '') AS idea_text,
                  ig.id::text AS idea_group_id,
                  ig.canonical_idea_text
                FROM public.key_ideas ki
                LEFT JOIN public.idea_groups ig ON ig.id = ki.idea_group_id
                WHERE {where_clause}
                  AND ki.chunk_id IS NOT NULL
                  AND COALESCE(NULLIF(ig.canonical_idea_text, ''), NULLIF(ki.core_idea_text, ''), '') <> ''
                ORDER BY ki.id DESC
                LIMIT %s
                """,
                params + [max(limit * 12, 200)],
            )
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()
    finally:
        conn.close()
    return [dict(zip(columns, row)) for row in rows]


def score_key_idea_row(row: Dict[str, Any], rules: Sequence[Dict[str, Any]], focus_concept: Dict[str, Any]) -> float:
    group_label = normalize_text(row.get("group_label"))
    idea_text = normalize_text(row.get("idea_text"))
    combined = f"{group_label} {idea_text}".strip()
    if not combined:
        return -999.0

    score = 0.0
    for rule in rules:
        pattern = rule["pattern"]
        weight = float(rule["weight"])
        score += len(pattern.findall(group_label)) * (weight + 10)
        score += len(pattern.findall(idea_text)) * weight

    focus_label = normalize_text(focus_concept.get("label"))
    expanded_title = display_title_for_concept(focus_concept)
    if group_label.lower() == focus_label.lower():
        score += 80
    if expanded_title and group_label.lower() == expanded_title.lower():
        score += 75
    if focus_label and focus_label.lower() in group_label.lower():
        score += 25
    if expanded_title and expanded_title.lower() in group_label.lower():
        score += 25
    if is_example_like_text(idea_text):
        score -= 20
    return score


def select_key_idea_groups(key_idea_rows: Sequence[Dict[str, Any]], rules: Sequence[Dict[str, Any]], focus_concept: Dict[str, Any], limit: int) -> List[Dict[str, Any]]:
    grouped: Dict[str, Dict[str, Any]] = {}
    for row in key_idea_rows:
        group_label = normalize_text(row.get("group_label"))
        if not group_label:
            continue
        group_key = normalize_text(row.get("idea_group_id")) or group_label.lower()
        entry = grouped.setdefault(
            group_key,
            {
                "group_label": group_label,
                "idea_group_id": normalize_text(row.get("idea_group_id")) or None,
                "score": -999.0,
                "idea_texts": set(),
                "chunk_ids": set(),
            },
        )
        score = score_key_idea_row(row, rules, focus_concept)
        entry["score"] = max(entry["score"], score)
        idea_text = normalize_text(row.get("idea_text"))
        if idea_text:
            entry["idea_texts"].add(idea_text)
        chunk_id = normalize_text(row.get("chunk_id"))
        if chunk_id:
            entry["chunk_ids"].add(chunk_id)

    groups = []
    for entry in grouped.values():
        if entry["score"] < 1 or not entry["chunk_ids"]:
            continue
        groups.append(
            {
                "group_label": entry["group_label"],
                "idea_group_id": entry["idea_group_id"],
                "score": entry["score"],
                "idea_texts": sorted(entry["idea_texts"]),
                "chunk_ids": sorted(entry["chunk_ids"]),
            }
        )
    groups.sort(key=lambda item: (-item["score"], -len(item["chunk_ids"]), item["group_label"]))
    return groups[:limit]


def fetch_public_evidence_by_chunk_ids(chunk_ids: Sequence[str]) -> List[Dict[str, Any]]:
    if not chunk_ids:
        return []
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                  pc.id::text AS chunk_id,
                  pc.body_text,
                  b.title AS book_title,
                  b.author AS book_author,
                  NULL::integer AS book_year,
                  c.title AS chapter_title,
                  s.title AS section_title,
                  pc.page_number,
                  false AS is_primary,
                  0::float8 AS importance_score,
                  pc.chapter_id::text AS chapter_id,
                  pc.section_id::text AS section_id,
                  NULL::text AS core_idea_text,
                  'public_key_idea' AS retrieval_method
                FROM public.paragraph_chunks pc
                JOIN public.books b ON b.id = pc.book_id
                LEFT JOIN public.chapters c ON c.id = pc.chapter_id
                LEFT JOIN public.sections s ON s.id = pc.section_id
                WHERE pc.id::text = ANY(%s)
                """,
                (list(chunk_ids),),
            )
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()
    finally:
        conn.close()
    return [dict(zip(columns, row)) for row in rows]


def fetch_handbook_linked_evidence(focus_concept: Dict[str, Any], topic: str, limit: int) -> List[Dict[str, Any]]:
    names = handbook_concept_names(focus_concept, topic)
    if not names:
        return []

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                  pc.id::text AS chunk_id,
                  pc.body_text,
                  b.title AS book_title,
                  b.author AS book_author,
                  NULL::integer AS book_year,
                  c.title AS chapter_title,
                  s.title AS section_title,
                  pc.page_number,
                  COALESCE(pcl.is_primary, false) AS is_primary,
                  COALESCE(pc.importance_score, 0)::float8 AS importance_score,
                  pc.chapter_id::text AS chapter_id,
                  pc.section_id::text AS section_id,
                  pc.core_idea_text,
                  'handbook_link' AS retrieval_method
                FROM handbook.paragraph_concept_link pcl
                JOIN handbook.concept hc ON hc.id = pcl.concept_id
                JOIN handbook.paragraph_chunk pc ON pc.id = pcl.paragraph_chunk_id
                JOIN handbook.book b ON b.id = pc.book_id
                LEFT JOIN handbook.chapter c ON c.id = pc.chapter_id
                LEFT JOIN handbook.section s ON s.id = pc.section_id
                WHERE LOWER(hc.canonical_name) = ANY(%s)
                ORDER BY COALESCE(pcl.is_primary, false) DESC, COALESCE(pc.importance_score, 0) DESC
                LIMIT %s
                """,
                ([name.lower() for name in names], limit),
            )
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()
    finally:
        conn.close()
    return [dict(zip(columns, row)) for row in rows]


def fetch_handbook_search_evidence(terms: Sequence[str], limit: int) -> List[Dict[str, Any]]:
    where_clause, params = build_sql_search_clauses(terms)
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                  pc.id::text AS chunk_id,
                  pc.body_text,
                  b.title AS book_title,
                  b.author AS book_author,
                  NULL::integer AS book_year,
                  c.title AS chapter_title,
                  s.title AS section_title,
                  pc.page_number,
                  false AS is_primary,
                  COALESCE(pc.importance_score, 0)::float8 AS importance_score,
                  pc.chapter_id::text AS chapter_id,
                  pc.section_id::text AS section_id,
                  pc.core_idea_text,
                  'handbook_search' AS retrieval_method
                FROM handbook.paragraph_chunk pc
                JOIN handbook.book b ON b.id = pc.book_id
                LEFT JOIN handbook.chapter c ON c.id = pc.chapter_id
                LEFT JOIN handbook.section s ON s.id = pc.section_id
                WHERE {where_clause}
                ORDER BY COALESCE(pc.importance_score, 0) DESC, pc.created_at DESC
                LIMIT %s
                """,
                params + [max(limit * 6, 80)],
            )
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()
    finally:
        conn.close()
    return [dict(zip(columns, row)) for row in rows]


def fetch_public_search_evidence(terms: Sequence[str], limit: int) -> List[Dict[str, Any]]:
    where_clause, params = build_sql_search_clauses(terms)
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                  pc.id::text AS chunk_id,
                  pc.body_text,
                  b.title AS book_title,
                  b.author AS book_author,
                  NULL::integer AS book_year,
                  c.title AS chapter_title,
                  s.title AS section_title,
                  pc.page_number,
                  false AS is_primary,
                  0::float8 AS importance_score,
                  pc.chapter_id::text AS chapter_id,
                  pc.section_id::text AS section_id,
                  NULL::text AS core_idea_text,
                  'public_search' AS retrieval_method
                FROM public.paragraph_chunks pc
                JOIN public.books b ON b.id = pc.book_id
                LEFT JOIN public.chapters c ON c.id = pc.chapter_id
                LEFT JOIN public.sections s ON s.id = pc.section_id
                WHERE {where_clause}
                ORDER BY pc.created_at DESC, pc.id DESC
                LIMIT %s
                """,
                params + [max(limit * 6, 80)],
            )
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()
    finally:
        conn.close()
    return [dict(zip(columns, row)) for row in rows]


def looks_like_noise_chunk(body: str, chapter_title: str, section_title: str) -> bool:
    body_norm = normalize_text(body)
    chapter_norm = normalize_text(chapter_title).lower()
    section_norm = normalize_text(section_title).lower()
    body_lower = body_norm.lower()
    if not body_norm:
        return True
    if len(body_norm) < 90 and not re.search(r"[.!?]", body_norm):
        return True
    if len(body_norm) < 120 and ("glossary" in chapter_norm or "glossary" in section_norm):
        return False
    if chapter_norm in {"references", "index"} or section_norm in {"references", "index"}:
        return True
    noise_patterns = [
        r"table of contents",
        r"foreword",
        r"acknowledg(e)?ments?",
        r"copyright",
        r"isbn",
        r"all rights reserved",
        r"^chapter\s+\d+\b",
    ]
    for pattern in noise_patterns:
        if re.search(pattern, body_lower):
            return True
    if re.search(r"\.{3,}\s*\d{1,4}$", body_norm):
        return True
    if re.match(r"^(figure|table)\s+\d", body_lower):
        return True
    if re.match(r"^\d+\s*$", body_lower):
        return True
    return False


def is_example_like_text(text: str) -> bool:
    normalized = normalize_text(text).lower()
    return bool(
        re.search(
            r"\b(run the following code|python -m|logger\.info|self_query|query = |from_str\(|cli command)\b",
            normalized,
        )
    )


def score_evidence_row(row: Dict[str, Any], rules: Sequence[Dict[str, Any]]) -> float:
    body = normalize_text(row.get("body_text"))
    chapter = normalize_text(row.get("chapter_title"))
    section = normalize_text(row.get("section_title"))
    if looks_like_noise_chunk(body, chapter, section):
        return -999.0

    score = 0.0
    for rule in rules:
        pattern = rule["pattern"]
        weight = float(rule["weight"])
        body_hits = len(pattern.findall(body))
        chapter_hits = len(pattern.findall(chapter))
        section_hits = len(pattern.findall(section))
        score += min(body_hits, 3) * weight
        score += chapter_hits * (weight + 6)
        score += section_hits * (weight + 8)

    if rules:
        first_match = rules[0]["pattern"].search(body)
        if first_match:
            if first_match.start() < 90:
                score += 14
            window = body[first_match.end() : first_match.end() + 40].lower()
            if re.search(r"\b(is|represents|combines|employs|uses|works|enables|integrates)\b", window):
                score += 16

    score += float(row.get("importance_score") or 0) * 12
    if row.get("is_primary"):
        score += 18

    body_len = len(body)
    if 160 <= body_len <= 1400:
        score += 8
    elif body_len > 1400:
        score += 4

    if "glossary" in chapter.lower() or "glossary" in section.lower():
        score -= 6
    if is_example_like_text(body):
        score -= 18
    if "figure" in body.lower():
        score -= 3
    return score


def normalize_evidence_row(row: Dict[str, Any], retrieval_score: float) -> Dict[str, Any]:
    chunk_id = normalize_text(row.get("chunk_id"))
    return {
        "chunk_id": chunk_id,
        "body_text": normalize_text(row.get("body_text")),
        "book_title": normalize_text(row.get("book_title")),
        "book_author": normalize_author(row.get("book_author")),
        "book_year": row.get("book_year"),
        "chapter_title": normalize_text(row.get("chapter_title")),
        "section_title": normalize_text(row.get("section_title")),
        "page_number": row.get("page_number"),
        "is_primary": bool(row.get("is_primary")),
        "importance_score": float(row.get("importance_score") or 0),
        "chapter_id": normalize_text(row.get("chapter_id")),
        "section_id": normalize_text(row.get("section_id")),
        "core_idea_text": normalize_text(row.get("core_idea_text")),
        "evidence_id": f"chunk_{chunk_id}",
        "source": build_source_label(row),
        "retrieval_method": normalize_text(row.get("retrieval_method")),
        "retrieval_score": retrieval_score,
    }


def merge_evidence_rows(*row_sets: Iterable[Dict[str, Any]], limit: int, rules: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_chunk_id: Dict[str, Dict[str, Any]] = {}
    by_text_key: Dict[tuple[str, str], str] = {}
    for rows in row_sets:
        for row in rows:
            retrieval_score = score_evidence_row(row, rules)
            if retrieval_score < 1:
                continue
            normalized = normalize_evidence_row(row, retrieval_score)
            chunk_id = normalized["chunk_id"]
            text_key = (
                normalized["book_title"].lower(),
                re.sub(r"\s+", " ", normalized["body_text"].lower()),
            )
            existing_chunk_id = by_text_key.get(text_key)
            if existing_chunk_id:
                current = by_chunk_id[existing_chunk_id]
                def method_rank(value: str) -> int:
                    if value == "public_key_idea":
                        return 0
                    if value.startswith("handbook"):
                        return 1
                    return 2
                current_rank = (
                    method_rank(current["retrieval_method"]),
                    -current["retrieval_score"],
                )
                new_rank = (
                    method_rank(normalized["retrieval_method"]),
                    -normalized["retrieval_score"],
                )
                if new_rank >= current_rank:
                    continue
                del by_chunk_id[existing_chunk_id]
            current = by_chunk_id.get(chunk_id)
            if current is None or normalized["retrieval_score"] > current["retrieval_score"]:
                by_chunk_id[chunk_id] = normalized
                by_text_key[text_key] = chunk_id

    evidence = list(by_chunk_id.values())
    evidence.sort(
        key=lambda row: (
            0 if row["is_primary"] else 1,
            -row["retrieval_score"],
            -row["importance_score"],
            row["book_title"],
            row["chunk_id"],
        )
    )
    return evidence[:limit]


def build_key_ideas(evidence_rows: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    grouped: Dict[str, List[str]] = defaultdict(list)
    for row in evidence_rows:
        idea_text = normalize_text(row.get("core_idea_text"))
        chunk_id = normalize_text(row.get("chunk_id"))
        if idea_text and chunk_id:
            grouped[idea_text].append(chunk_id)

    key_ideas: List[Dict[str, Any]] = []
    for idea_text, chunk_ids in grouped.items():
        key_ideas.append(
            {
                "idea_text": idea_text,
                "chunk_ids": sorted(set(chunk_ids)),
            }
        )
    key_ideas.sort(key=lambda item: (-len(item["chunk_ids"]), item["idea_text"]))
    return key_ideas[:8]


def build_key_ideas_from_groups(groups: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    key_ideas: List[Dict[str, Any]] = []
    for group in groups:
        idea_texts = [normalize_text(text) for text in group.get("idea_texts", []) if normalize_text(text)]
        if not idea_texts:
            continue
        key_ideas.append(
            {
                "idea_text": idea_texts[0],
                "chunk_ids": list(group.get("chunk_ids", [])),
            }
        )
    key_ideas.sort(key=lambda item: (-len(item["chunk_ids"]), item["idea_text"]))
    return key_ideas[:8]


def build_writer_input(topic: str, focus_concept: Dict[str, Any], related_concepts: List[Dict[str, Any]], evidence_rows: List[Dict[str, Any]], key_ideas: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "concept": {
            "slug": normalize_text(focus_concept.get("slug")) or slugify(topic),
            "label": normalize_text(focus_concept.get("label")) or normalize_text(topic),
            "description": normalize_text(focus_concept.get("description")),
            "keywords": split_keywords(focus_concept.get("keywords")),
        },
        "related_concepts": [
            {
                "label": normalize_text(item.get("label")),
                "relation": normalize_text(item.get("relation")) or "child",
                "co_occurrence_count": int(item.get("co_occurrence_count") or 0),
            }
            for item in related_concepts
            if normalize_text(item.get("label"))
        ],
        "evidence": [
            {
                "chunk_id": row["chunk_id"],
                "body_text": row["body_text"],
                "book_title": row["book_title"],
                "book_author": normalize_author(row["book_author"]),
                "book_year": row["book_year"],
                "chapter_title": row["chapter_title"] or None,
                "section_title": row["section_title"] or None,
                "page_number": row["page_number"],
                "is_primary": row["is_primary"],
                "importance_score": row["importance_score"],
            }
            for row in evidence_rows
        ],
        "key_ideas": key_ideas,
    }


def group_evidence_by_source(evidence_rows: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in evidence_rows:
        grouped[build_source_label(row)].append(row)

    groups: List[Dict[str, Any]] = []
    for source_label, rows in grouped.items():
        rows_sorted = sorted(
            rows,
            key=lambda row: (
                0 if row.get("is_primary") else 1,
                -float(row.get("retrieval_score") or 0),
                row.get("chunk_id") or "",
            ),
        )
        first = rows_sorted[0]
        groups.append(
            {
                "source": source_label,
                "book_title": normalize_text(first.get("book_title")),
                "book_author": normalize_text(first.get("book_author")),
                "book_year": first.get("book_year"),
                "evidence_count": len(rows_sorted),
                "chunks": rows_sorted,
            }
        )
    groups.sort(key=lambda item: (-int(item.get("evidence_count") or 0), item.get("source") or ""))
    return groups


def display_title_for_concept(focus_concept: Dict[str, Any]) -> str:
    label = normalize_text(focus_concept.get("label"))
    description = normalize_text(focus_concept.get("description"))
    if label.isupper() and len(label) <= 8 and description:
        match = re.search(rf"{re.escape(label)}\s*\(([^)]+)\)", description)
        if match:
            expanded = normalize_text(match.group(1))
            if expanded:
                return expanded
        match = re.search(r"([A-Z][A-Za-z]+(?:[-\s][A-Z][A-Za-z]+)+)", description)
        if match:
            expanded = normalize_text(match.group(1))
            if expanded:
                return expanded
    return label


def humanize_concept_label(label: str) -> str:
    text = normalize_text(label)
    if not text:
        return ""
    if " " in text or "-" in text:
        return text
    text = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", text)
    text = text.replace("LLM", "LLM ").replace("RAG", "RAG ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def concise_description_from_graph(description: str, limit: int = 120) -> str:
    sentence = first_sentence(description)
    sentence = re.sub(r"\*\*", "", sentence)
    sentence = re.sub(r"\([^)]*\)", "", sentence)
    sentence = re.sub(r"\s+", " ", sentence).strip(" -")
    return excerpt_text(sentence, limit=limit)


def pick_evidence_row(evidence_rows: Sequence[Dict[str, Any]], include_keywords: Sequence[str], exclude_keywords: Sequence[str] | None = None) -> Dict[str, Any] | None:
    exclude_keywords = exclude_keywords or []
    for row in evidence_rows:
        text = normalize_text(row.get("body_text")).lower()
        if exclude_keywords and any(keyword in text for keyword in exclude_keywords):
            continue
        if all(keyword in text for keyword in include_keywords):
            return row
    return None


def build_overview_fallback(focus_concept: Dict[str, Any], evidence_rows: Sequence[Dict[str, Any]]) -> Dict[str, str]:
    title = display_title_for_concept(focus_concept)
    description = normalize_text(focus_concept.get("description"))
    top_rows = list(evidence_rows)[:8]

    definition = first_sentence(description)
    if not definition:
        definition_row = pick_evidence_row(top_rows, ["rag"], ["example", "code"]) or (top_rows[0] if top_rows else None)
        definition = first_sentence(definition_row.get("body_text")) if definition_row else ""

    use_case_row = (
        pick_evidence_row(top_rows, ["when"], ["example"])
        or pick_evidence_row(top_rows, ["if"], ["example"])
        or pick_evidence_row(top_rows, ["question", "answer"], ["example"])
        or pick_evidence_row(top_rows, ["domain"], ["example"])
    )
    use_case = first_sentence(use_case_row.get("body_text")) if use_case_row else ""

    pipeline_row = (
        pick_evidence_row(top_rows, ["step"], ["example"])
        or pick_evidence_row(top_rows, ["pipeline"], ["example"])
        or pick_evidence_row(top_rows, ["retriev", "generat"], ["example"])
    )
    pipeline = first_sentence(pipeline_row.get("body_text")) if pipeline_row else ""

    benefits_row = (
        pick_evidence_row(top_rows, ["hallucination"], ["example"])
        or pick_evidence_row(top_rows, ["accurate"], ["example"])
        or pick_evidence_row(top_rows, ["cost"], ["example"])
    )
    benefits = first_sentence(benefits_row.get("body_text")) if benefits_row else ""

    sentences = [text for text in [definition, use_case, pipeline, benefits] if text]
    deduped: List[str] = []
    for sentence in sentences:
        if sentence not in deduped:
            deduped.append(sentence)
    summary = " ".join(deduped[:4]).strip()
    if not summary:
        summary = (
            f"{title} combines retrieval and generation so AI systems can answer with grounded external context. "
            f"It is most useful when factual accuracy, fresh knowledge, or domain-specific context matter. "
            f"For ML engineers, the practical work is retrieval quality, chunking, and context assembly."
        )

    why_parts: List[str] = []
    if benefits:
        why_parts.append(benefits)
    if use_case:
        why_parts.append(use_case)
    why = " ".join(dict.fromkeys(why_parts)).strip()
    if not why:
        why = f"{title} matters because it lets ML engineers improve factual accuracy and freshness without full model retraining."
    return {"title": title, "summary": summary, "why_it_matters": why}


def build_fallback_cherries(evidence_rows: Sequence[Dict[str, Any]], max_sources: int = 5) -> List[Dict[str, Any]]:
    cherries: List[Dict[str, Any]] = []
    for group in group_evidence_by_source(evidence_rows)[:max_sources]:
        insights = []
        explanatory_chunks = [row for row in group["chunks"] if not is_example_like_text(row.get("body_text", ""))]
        for row in explanatory_chunks[:2]:
            if is_example_like_text(row.get("body_text", "")):
                continue
            claim = normalize_text(row.get("core_idea_text")) or first_sentence(row.get("body_text"))
            excerpt = excerpt_text(row.get("body_text"))
            evidence_id = normalize_text(row.get("evidence_id"))
            if claim and excerpt and evidence_id:
                insights.append(
                    {
                        "claim": claim,
                        "evidence_id": evidence_id,
                        "excerpt": excerpt,
                    }
                )
        if insights:
            cherries.append({"source": group["source"], "insights": insights})
    return cherries


def build_fallback_child_concepts(topic: str, related_concepts: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    parents = [item for item in related_concepts if item.get("relation") == "parent"]
    children = [item for item in related_concepts if item.get("relation") == "child"]
    ordered = parents[:2] + children[:4]
    output: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for item in ordered:
        label = humanize_concept_label(normalize_text(item.get("label")))
        relation_type = normalize_text(item.get("relation")) or "child"
        if not label or label.lower() in seen:
            continue
        seen.add(label.lower())
        graph_description = concise_description_from_graph(item.get("description") or "")
        if graph_description:
            description = graph_description
        elif relation_type == "parent":
            description = f"{label} is a prerequisite or broader frame for understanding {topic}."
        else:
            description = f"{label} is a more specific or adjacent concept that comes up when applying {topic}."
        output.append({"label": label, "relation_type": relation_type, "description": description})
    return output[:6]


def reference_accessibility_score(group: Dict[str, Any]) -> float:
    chunks = group.get("chunks", [])
    first = chunks[0] if chunks else {}
    chapter = normalize_text(first.get("chapter_title")).lower()
    section = normalize_text(first.get("section_title")).lower()
    title = normalize_text(first.get("book_title")).lower()
    score = 0.0
    if any(word in chapter for word in ["introduction", "overview", "glossary", "basics", "foundations"]):
        score += 30
    if any(word in section for word in ["introduction", "overview", "glossary", "basics", "foundations"]):
        score += 30
    if any(word in title for word in ["handbook", "guide", "engineering", "applications"]):
        score += 16
    if any(word in chapter for word in ["advanced", "research", "deep", "production"]):
        score -= 8
    if any(word in section for word in ["advanced", "research", "deep", "production"]):
        score -= 8
    page_number = first.get("page_number")
    if isinstance(page_number, int):
        score += max(0, 12 - min(page_number, 120) / 10)
    score += min(float(first.get("retrieval_score") or 0) / 10, 12)
    return score


def build_fallback_progressive_references(evidence_rows: Sequence[Dict[str, Any]], max_refs: int = 5) -> List[Dict[str, Any]]:
    groups = group_evidence_by_source(evidence_rows)
    groups.sort(key=lambda item: (-reference_accessibility_score(item), item["source"]))

    references: List[Dict[str, Any]] = []
    for group in groups:
        first = group["chunks"][0] if group["chunks"] else {}
        if is_example_like_text(first.get("body_text", "")):
            continue
        title_parts = [group["book_title"]]
        chapter_title = normalize_text(first.get("chapter_title"))
        section_title = normalize_text(first.get("section_title"))
        if chapter_title:
            title_parts.append(chapter_title)
        if section_title and section_title.lower() != chapter_title.lower():
            title_parts.append(section_title)
        title = ", ".join(part for part in title_parts if part)
        excerpt = normalize_text(first.get("core_idea_text")) or first_sentence(first.get("body_text"))
        references.append(
            {
                "order": len(references) + 1,
                "title": title or group["source"],
                "what_it_teaches": excerpt or f"Provides a concrete angle on {group['book_title']}.",
                "why_next": "Start here for the conceptual framework." if len(references) == 0 else "Adds something the previous reference did not cover.",
                "source": {
                    "book_title": group["book_title"] or None,
                    "book_author": group["book_author"] or None,
                    "url": None,
                    "author": None,
                },
            }
        )
        if len(references) >= max_refs:
            break
    return references


def normalize_writer_output(
    *,
    topic: str,
    focus_concept: Dict[str, Any],
    writer_json: Dict[str, Any],
    writer_input: Dict[str, Any],
    evidence_rows: Sequence[Dict[str, Any]],
    related_concepts: Sequence[Dict[str, Any]],
    update_payload: Dict[str, Any] | None,
) -> Dict[str, Any]:
    evidence_lookup = {row["evidence_id"]: row for row in evidence_rows}
    valid_sources = {build_source_label(row) for row in evidence_rows}

    overview_input = writer_json.get("overview")
    if not isinstance(overview_input, dict):
        overview_input = {}
    overview = {
        "title": normalize_text(overview_input.get("title")) or display_title_for_concept(focus_concept) or normalize_text(topic),
        "summary": normalize_text(overview_input.get("summary")),
        "why_it_matters": normalize_text(overview_input.get("why_it_matters")),
    }
    expanded_title = display_title_for_concept(focus_concept)
    if overview["title"].upper() == normalize_text(focus_concept.get("label")).upper() and expanded_title:
        overview["title"] = expanded_title
    if sentence_count(overview["summary"]) < 2 or not overview["why_it_matters"]:
        fallback_overview = build_overview_fallback(focus_concept, evidence_rows)
        if not overview["summary"]:
            overview["summary"] = fallback_overview["summary"]
        if not overview["why_it_matters"]:
            overview["why_it_matters"] = fallback_overview["why_it_matters"]

    cherries_input = writer_json.get("cherries")
    if not isinstance(cherries_input, list):
        cherries_input = []
    cherries: List[Dict[str, Any]] = []
    for cherry in cherries_input:
        if not isinstance(cherry, dict):
            continue
        source = normalize_text(cherry.get("source"))
        insights = cherry.get("insights")
        if not source or not isinstance(insights, list):
            continue
        if valid_sources and source not in valid_sources:
            source_match = next((candidate for candidate in valid_sources if candidate.lower() == source.lower()), None)
            source = source_match or source
        normalized_insights = []
        for insight in insights:
            if not isinstance(insight, dict):
                continue
            claim = normalize_text(insight.get("claim"))
            evidence_id = normalize_text(insight.get("evidence_id"))
            excerpt = normalize_text(insight.get("excerpt"))
            evidence_row = evidence_lookup.get(evidence_id)
            if not evidence_row:
                continue
            if is_example_like_text(evidence_row.get("body_text", "")):
                continue
            if not excerpt:
                excerpt = excerpt_text(evidence_row.get("body_text"))
            if claim and evidence_id and excerpt:
                normalized_insights.append(
                    {
                        "claim": claim,
                        "evidence_id": evidence_id,
                        "excerpt": excerpt,
                    }
                )
        if normalized_insights:
            cherries.append({"source": source, "insights": normalized_insights[:5]})
    if len(cherries) < 2:
        cherries = build_fallback_cherries(evidence_rows)

    child_concepts = build_fallback_child_concepts(topic, related_concepts)
    progressive_references = build_fallback_progressive_references(evidence_rows)

    patch_notes = writer_json.get("patch_notes", [])
    if isinstance(patch_notes, str):
        patch_notes = [patch_notes]
    if not isinstance(patch_notes, list):
        patch_notes = []

    updates = writer_json.get("updates")
    if updates is None and update_payload:
        updates = [update_payload]
    elif isinstance(updates, dict):
        updates = [updates]
    elif not isinstance(updates, list):
        updates = []

    return {
        "topic": normalize_text(topic),
        "section": normalize_text(writer_json.get("section")) or os.getenv("WRITER_SECTION_DEFAULT", "Basics"),
        "overview": overview,
        "cherries": cherries,
        "child_concepts": child_concepts,
        "progressive_references": progressive_references,
        "updates": updates,
        "patch_notes": [normalize_text(note) for note in patch_notes if normalize_text(note)],
    }


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


@dataclass
class ClaudeJSONAgent:
    name: str
    instructions: str
    model: str
    max_output_tokens: int
    temperature: float


@dataclass
class ClaudeRunResult:
    final_output: str
    usage: Dict[str, Any]
    model_name: str


class ClaudeRunner:
    def __init__(self) -> None:
        api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY is not set.")
        self.client = Anthropic(api_key=api_key)

    def run_sync(self, agent: ClaudeJSONAgent, payload: str) -> ClaudeRunResult:
        response = self.client.messages.create(
            model=agent.model,
            system=agent.instructions,
            messages=[{"role": "user", "content": payload}],
            max_tokens=agent.max_output_tokens,
            temperature=agent.temperature,
        )
        text_parts: List[str] = []
        for block in getattr(response, "content", []) or []:
            if getattr(block, "type", "") == "text":
                text_parts.append(getattr(block, "text", ""))
        usage = getattr(response, "usage", None)
        usage_summary = {
            "input_tokens": int(getattr(usage, "input_tokens", 0) or 0),
            "output_tokens": int(getattr(usage, "output_tokens", 0) or 0),
            "total_tokens": int((getattr(usage, "input_tokens", 0) or 0) + (getattr(usage, "output_tokens", 0) or 0)),
            "reasoning_tokens": 0,
            "model_name": agent.model,
        }
        return ClaudeRunResult(
            final_output="\n".join(part for part in text_parts if part).strip(),
            usage=usage_summary,
            model_name=agent.model,
        )


def build_agents():
    model_name = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514").strip() or "claude-sonnet-4-20250514"
    max_output_tokens = int(os.getenv("ANTHROPIC_MAX_OUTPUT_TOKENS", "4096") or "4096")
    temperature = float(os.getenv("ANTHROPIC_TEMPERATURE", "0") or "0")
    runner = ClaudeRunner()

    writer_agent = ClaudeJSONAgent(
        name="ConceptReaderWriter",
        instructions=(
            "You generate Concept Reader JSON from a single input JSON object. "
            "Return ONLY valid JSON with keys: section, overview, cherries, child_concepts, progressive_references, updates, patch_notes. "
            "Do not wrap the JSON in markdown. "
            "Use only the provided concept, related_concepts, evidence, key_ideas, and update payload. "
            "Do not invent claims, evidence IDs, sources, concept labels, years, or URLs. "
            "Overview rules: overview.title is the concept label; overview.summary is 3-5 sentences covering definition, when to use it, and key benefit; overview.why_it_matters is 1-2 practical sentences for AI engineers. "
            "Cherries rules: group by source as 'Book Title (Author, Year)' when year exists, otherwise 'Book Title (Author)'; provide 1-5 insights per source; each insight must have claim, evidence_id, excerpt; every claim must be supported by the exact evidence_id in input; same-source insights must not overlap. "
            "Child concept rules: use only labels from related_concepts; relation_type must be parent or child; description must explain the relationship from the current concept's perspective in 1-2 sentences. "
            "Progressive reference rules: produce 2-5 ordered items; prefer diverse sources; order 1 should be the most accessible starting point; each item must include order, title, what_it_teaches, why_next, and source. "
            "If evidence is thin, be conservative and shorter rather than inventing unsupported detail."
        ),
        model=model_name,
        max_output_tokens=max_output_tokens,
        temperature=temperature,
    )
    return runner, writer_agent


def main() -> int:
    env_path = Path(__file__).with_name(".env")
    load_env_file(env_path)

    topic = " ".join(sys.argv[1:]).strip()
    if not topic:
        topic = os.getenv("WRITER_TOPIC_DEFAULT", "").strip()
    if not topic:
        print("Topic is required. Pass it as args or set WRITER_TOPIC_DEFAULT.")
        return 1

    runner, writer_agent = build_agents()

    focus_concept = resolve_focus_concept(topic)
    related_concepts = classify_related_concepts(
        focus_concept,
        query_related_graph_rows(focus_concept["slug"], limit=int(os.getenv("GRAPHDB_RELATED_LIMIT", "50"))),
    )
    graph_instance_rows = query_graph_concept_instances(
        focus_concept["slug"],
        limit=int(os.getenv("GRAPHDB_INSTANCE_LIMIT", "100")),
    )
    graph_instance_labels = extract_graph_instance_labels(graph_instance_rows)

    search_terms = build_search_terms(focus_concept, topic)
    search_rules = build_search_rules(search_terms)
    evidence_limit = int(os.getenv("EVIDENCE_DB_MIN_RESULTS", "18") or "18")

    key_idea_terms = graph_instance_labels + list(search_terms)
    public_key_idea_rows = fetch_public_key_idea_rows(key_idea_terms, limit=evidence_limit)
    key_idea_groups = select_key_idea_groups(
        public_key_idea_rows,
        search_rules,
        focus_concept,
        limit=max(4, evidence_limit // 3),
    )
    key_idea_by_chunk_id = {}
    primary_chunk_ids: set[str] = set()
    for index, group in enumerate(key_idea_groups):
        idea_texts = group.get("idea_texts", [])
        primary_idea = normalize_text(idea_texts[0] if idea_texts else group.get("group_label"))
        for chunk_id in group["chunk_ids"]:
            if primary_idea:
                key_idea_by_chunk_id[chunk_id] = primary_idea
            if index == 0:
                primary_chunk_ids.add(chunk_id)
    public_key_idea_evidence = fetch_public_evidence_by_chunk_ids(
        [chunk_id for group in key_idea_groups for chunk_id in group["chunk_ids"]]
    )
    for row in public_key_idea_evidence:
        chunk_id = normalize_text(row.get("chunk_id"))
        row["core_idea_text"] = key_idea_by_chunk_id.get(chunk_id)
        if chunk_id in primary_chunk_ids:
            row["is_primary"] = True
            row["importance_score"] = 1.0
    linked_evidence = fetch_handbook_linked_evidence(focus_concept, topic, limit=evidence_limit)
    handbook_search_evidence = fetch_handbook_search_evidence(search_terms, limit=evidence_limit)
    public_search_evidence = fetch_public_search_evidence(search_terms, limit=max(6, evidence_limit // 2))

    evidence_rows = merge_evidence_rows(
        public_key_idea_evidence,
        linked_evidence,
        handbook_search_evidence,
        public_search_evidence,
        limit=evidence_limit,
        rules=search_rules,
    )
    if not evidence_rows:
        raise RuntimeError(f"No evidence found for topic '{topic}' using the connected handbook/public schemas.")

    key_ideas = build_key_ideas_from_groups(key_idea_groups)
    if not key_ideas:
        key_ideas = build_key_ideas(evidence_rows)
    writer_input = build_writer_input(topic, focus_concept, related_concepts, evidence_rows, key_ideas)

    update_path = os.getenv("WRITER_UPDATE_PATH", "").strip()
    if not update_path:
        update_path = "./dev/apps/agent/writer_agent/data/update.txt"
    update_payload = parse_update_file(Path(update_path))

    prompt_payload = {
        "input": writer_input,
        "update_payload": update_payload,
        "quality_checks": {
            "min_cherry_sources": 2,
            "min_child_concepts": 2,
            "min_progressive_references": 2,
            "allowed_relation_types": ["parent", "child"],
            "section_default": os.getenv("WRITER_SECTION_DEFAULT", "Basics"),
        },
    }
    writer_result = runner.run_sync(writer_agent, json.dumps(prompt_payload, ensure_ascii=True, indent=2))

    writer_json = parse_json_output(writer_result.final_output)
    if writer_json is None:
        retry_payload = {
            "instruction": "Return ONLY valid JSON matching the required schema. No markdown.",
            "payload": prompt_payload,
        }
        retry_result = runner.run_sync(writer_agent, json.dumps(retry_payload, ensure_ascii=True, indent=2))
        writer_json = parse_json_output(retry_result.final_output)

    if writer_json is None:
        writer_json = {
            "section": os.getenv("WRITER_SECTION_DEFAULT", "Basics"),
            "overview": {},
            "cherries": [],
            "child_concepts": [],
            "progressive_references": [],
            "updates": [update_payload] if update_payload else [],
            "patch_notes": [],
            "raw_output": writer_result.final_output,
        }

    output = normalize_writer_output(
        topic=topic,
        focus_concept=focus_concept,
        writer_json=writer_json,
        writer_input=writer_input,
        evidence_rows=evidence_rows,
        related_concepts=related_concepts,
        update_payload=update_payload,
    )

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
