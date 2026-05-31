import argparse
import json
import math
from pathlib import Path
from typing import Any, Dict, List


def normalize_text(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def excerpt_text(value: Any, limit: int = 240) -> str:
    normalized = normalize_text(value)
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 3].rstrip() + "..."


def build_legacy_cherries(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    cherries = []
    references = data.get("references", [])
    if not isinstance(references, list):
        references = []
    for ref in references:
        if not isinstance(ref, dict):
            continue
        source = normalize_text(ref.get("source"))
        author = normalize_text(ref.get("author"))
        if author and author.lower() not in source.lower():
            source = f"{source} ({author})" if source else author
        snippets = ref.get("snippets", [])
        if not isinstance(snippets, list):
            snippets = []
        insights = []
        for snippet in snippets[:5]:
            if not isinstance(snippet, dict):
                continue
            excerpt = excerpt_text(snippet.get("excerpt"))
            chunk_id = snippet.get("chunk_id")
            if excerpt and chunk_id is not None:
                insights.append(
                    {
                        "claim": excerpt,
                        "evidence_id": f"chunk_{chunk_id}",
                        "excerpt": excerpt,
                    }
                )
        if source and insights:
            cherries.append({"source": source, "insights": insights})
    return cherries


def build_legacy_child_concepts(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    labels = data.get("related_concepts", [])
    if not isinstance(labels, list):
        labels = []
    concepts = []
    for label in labels[:8]:
        label_text = normalize_text(label)
        if label_text:
            concepts.append(
                {
                    "label": label_text,
                    "relation_type": "child",
                    "description": f"{label_text} is a neighboring concept to understand while working through {normalize_text(data.get('topic'))}.",
                }
            )
    return concepts


def build_legacy_progressive_references(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    references = data.get("references", [])
    if not isinstance(references, list):
        references = []
    progressive = []
    for order, ref in enumerate(references[:5], start=1):
        if not isinstance(ref, dict):
            continue
        snippets = ref.get("snippets", [])
        if not isinstance(snippets, list):
            snippets = []
        first_excerpt = ""
        if snippets and isinstance(snippets[0], dict):
            first_excerpt = excerpt_text(snippets[0].get("excerpt"))
        progressive.append(
            {
                "order": order,
                "title": normalize_text(ref.get("source")) or f"Reference {order}",
                "what_it_teaches": first_excerpt or "Provides supporting context for this concept.",
                "why_next": "Start here for the broadest introduction." if order == 1 else "Adds a distinct supporting angle after the previous source.",
                "source": {
                    "book_title": normalize_text(ref.get("source")) or None,
                    "book_author": normalize_text(ref.get("author")) or None,
                },
            }
        )
    return progressive


def build_page_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    if isinstance(data.get("overview"), dict):
        overview = data.get("overview") or {}
        page = {
            "topic": normalize_text(data.get("topic")),
            "section": normalize_text(data.get("section")) or "Basics",
            "overview": {
                "title": normalize_text(overview.get("title")) or normalize_text(data.get("topic")),
                "summary": normalize_text(overview.get("summary")),
                "why_it_matters": normalize_text(overview.get("why_it_matters")),
            },
            "cherries": data.get("cherries", []),
            "child_concepts": data.get("child_concepts", []),
            "progressive_references": data.get("progressive_references", []),
        }
    else:
        page = {
            "topic": normalize_text(data.get("topic")),
            "section": "Basics",
            "overview": {
                "title": normalize_text(data.get("topic")),
                "summary": normalize_text(data.get("summary")),
                "why_it_matters": normalize_text(data.get("why_it_matters")),
            },
            "cherries": build_legacy_cherries(data),
            "child_concepts": build_legacy_child_concepts(data),
            "progressive_references": build_legacy_progressive_references(data),
        }

    page["cherry_cards"] = build_cherry_cards(page)
    page["child_concept_groups"] = build_child_concept_groups(page)
    page["progressive_reading_list"] = build_progressive_reading_list(page)
    page["learning_roadmap"] = build_learning_roadmap(page)
    page["new_in_digest"] = None
    page["knowledge_team"] = []
    page["meta"] = build_meta(page)
    page["content_md"] = build_content_markdown(page)
    return page


def build_cherry_cards(page: Dict[str, Any]) -> List[Dict[str, Any]]:
    cards = []
    cherries = page.get("cherries", [])
    if not isinstance(cherries, list):
        return cards
    for cherry in cherries:
        if not isinstance(cherry, dict):
            continue
        insights = cherry.get("insights", [])
        if not isinstance(insights, list):
            insights = []
        body = " ".join(
            normalize_text(insight.get("claim")) or normalize_text(insight.get("excerpt"))
            for insight in insights
            if isinstance(insight, dict) and (normalize_text(insight.get("claim")) or normalize_text(insight.get("excerpt")))
        )
        cards.append(
            {
                "source": normalize_text(cherry.get("source")),
                "body": body,
                "insights": insights,
            }
        )
    return cards


def build_child_concept_groups(page: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
    grouped = {"parent": [], "child": []}
    concepts = page.get("child_concepts", [])
    if not isinstance(concepts, list):
        return grouped
    for concept in concepts:
        if not isinstance(concept, dict):
            continue
        relation_type = normalize_text(concept.get("relation_type")).lower()
        if relation_type not in grouped:
            continue
        grouped[relation_type].append(
            {
                "label": normalize_text(concept.get("label")),
                "description": normalize_text(concept.get("description")),
            }
        )
    return grouped


def build_learning_roadmap(page: Dict[str, Any]) -> Dict[str, Any]:
    current = normalize_text(page.get("topic")) or normalize_text(page.get("overview", {}).get("title"))
    parent_nodes = []
    child_nodes = []
    for concept in page.get("child_concepts", []):
        if not isinstance(concept, dict):
            continue
        label = normalize_text(concept.get("label"))
        if not label:
            continue
        relation_type = normalize_text(concept.get("relation_type")).lower()
        if relation_type == "parent":
            parent_nodes.append(label)
        elif relation_type == "child":
            child_nodes.append(label)
    return {
        "current": current,
        "prerequisites": parent_nodes[:3],
        "advanced": child_nodes[:3],
        "legend": [
            {"label": "Cherry = Current", "tone": "current"},
            {"label": "Violet = Advanced", "tone": "advanced"},
            {"label": "Gray = Other", "tone": "other"},
        ],
    }


def build_progressive_reading_list(page: Dict[str, Any]) -> List[Dict[str, Any]]:
    references = page.get("progressive_references", [])
    if not isinstance(references, list):
        return []
    order_labels = ["START HERE", "NEXT", "THEN", "DEEP DIVE", "FURTHER"]
    reading_list = []
    for index, ref in enumerate(sorted(references, key=lambda item: int(item.get("order", 0) or 0))):
        if not isinstance(ref, dict):
            continue
        label = order_labels[min(index, len(order_labels) - 1)]
        if index == 1:
            label = "NEXT \u2192"
        elif index == 2:
            label = "THEN \u2192"
        elif index >= 3:
            label = "DEEP DIVE \u2192" if index == 3 else "FURTHER \u2192"
        reading_list.append(
            {
                "label": label,
                "title": normalize_text(ref.get("title")),
                "what_it_teaches": normalize_text(ref.get("what_it_teaches")),
                "why_next": normalize_text(ref.get("why_next")),
                "source": ref.get("source", {}),
            }
        )
    return reading_list


def build_meta(page: Dict[str, Any]) -> Dict[str, Any]:
    source_count = 0
    cherries = page.get("cherries", [])
    if isinstance(cherries, list):
        source_count = len([item for item in cherries if isinstance(item, dict) and normalize_text(item.get("source"))])
    summary_words = len(normalize_text(page.get("overview", {}).get("summary")).split())
    read_minutes = max(1, math.ceil(summary_words / 180))
    return {
        "source_count": source_count,
        "read_minutes": read_minutes,
        "verification_label": "Knowledge Team verified",
    }


def build_content_markdown(page: Dict[str, Any]) -> str:
    overview = page.get("overview", {}) if isinstance(page.get("overview"), dict) else {}
    lines = [
        f"# {normalize_text(overview.get('title')) or normalize_text(page.get('topic'))}",
        "",
        "## Overview",
        normalize_text(overview.get("summary")),
        "",
        f"**Why it matters:** {normalize_text(overview.get('why_it_matters'))}",
        "",
        "## Cherries",
    ]

    for cherry in page.get("cherries", []):
        if not isinstance(cherry, dict):
            continue
        lines.append(f"### {normalize_text(cherry.get('source'))}")
        for insight in cherry.get("insights", []):
            if not isinstance(insight, dict):
                continue
            claim = normalize_text(insight.get("claim"))
            evidence_id = normalize_text(insight.get("evidence_id"))
            excerpt = normalize_text(insight.get("excerpt"))
            if claim:
                lines.append(f"- {claim}")
            if evidence_id or excerpt:
                lines.append(f"  - Evidence: `{evidence_id}` — {excerpt}")
        lines.append("")

    lines.append("## Child Concepts")
    for concept in page.get("child_concepts", []):
        if not isinstance(concept, dict):
            continue
        relation_type = normalize_text(concept.get("relation_type")).upper() or "CHILD"
        label = normalize_text(concept.get("label"))
        description = normalize_text(concept.get("description"))
        lines.append(f"- **{relation_type}** {label}: {description}")
    lines.append("")

    lines.append("## Progressive References")
    for ref in sorted(page.get("progressive_references", []), key=lambda item: int(item.get("order", 0) or 0)):
        if not isinstance(ref, dict):
            continue
        lines.append(f"{int(ref.get('order', 0) or 0)}. **{normalize_text(ref.get('title'))}**")
        lines.append(f"   - What it teaches: {normalize_text(ref.get('what_it_teaches'))}")
        lines.append(f"   - Why next: {normalize_text(ref.get('why_next'))}")
    return "\n".join(lines).strip()


def build_patch_notes_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    patch_notes = data.get("patch_notes", [])
    if isinstance(patch_notes, str):
        patch_notes = [patch_notes]
    if not isinstance(patch_notes, list):
        patch_notes = []

    updates = data.get("updates", [])
    if isinstance(updates, dict):
        updates = [updates]
    if not isinstance(updates, list):
        updates = []

    return {
        "topic": normalize_text(data.get("topic")),
        "updates": updates,
        "patch_notes": [normalize_text(note) for note in patch_notes if normalize_text(note)],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Format writer output for frontend payloads.")
    parser.add_argument("input", help="Path to writer_agent output JSON.")
    parser.add_argument(
        "--out-dir",
        default="./dev/apps/agent/writer_agent/front_outputs",
        help="Output directory for frontend payloads.",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")

    data = json.loads(input_path.read_text())

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    stem = input_path.stem
    page_path = out_dir / f"{stem}_page.json"
    patch_path = out_dir / f"{stem}_patch.json"

    page_path.write_text(json.dumps(build_page_payload(data), ensure_ascii=True, indent=2))
    patch_path.write_text(json.dumps(build_patch_notes_payload(data), ensure_ascii=True, indent=2))

    print(f"Wrote: {page_path}")
    print(f"Wrote: {patch_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
