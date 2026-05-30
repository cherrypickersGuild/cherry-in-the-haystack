"""Step 5: Generate hierarchical table of contents from GraphDB node depth.

Classifies nodes by depth relative to root (LLMConcept):
    depth 1      → 대 (large categories)
    depth 2-3    → 중 (medium sub-categories)
    depth 4+     → 소 (specific concepts)
"""

from typing import Dict, List

from packages.ontology.src.pipeline.ontology_graph_manager import OntologyGraphManager


def _classify_depth(depth: int) -> str:
    if depth <= 1:
        return "대"
    elif depth <= 3:
        return "중"
    else:
        return "소"


def generate_toc(
    graph_manager: OntologyGraphManager,
    root: str = "LLMConcept",
) -> list[dict]:
    """Generate hierarchical TOC from the ontology graph.

    Returns a list of top-level entries, each with nested children.
    """
    if root not in graph_manager.staging_graph:
        return []

    toc: list[dict] = []
    root_children = sorted(graph_manager.staging_graph.successors(root))

    for child in root_children:
        entry = _build_toc_entry(graph_manager, child, depth=1)
        if entry:
            toc.append(entry)

    return toc


def _build_toc_entry(
    graph_manager: OntologyGraphManager,
    node: str,
    depth: int,
) -> dict | None:
    graph = graph_manager.staging_graph
    if node not in graph:
        return None

    children = sorted(graph.successors(node))
    child_entries = []
    for child in children:
        entry = _build_toc_entry(graph_manager, child, depth + 1)
        if entry:
            child_entries.append(entry)

    return {
        "concept_id": node,
        "depth": depth,
        "level": _classify_depth(depth),
        "children": child_entries,
    }


def format_toc(
    toc: list[dict],
    show_concept_id: bool = True,
) -> str:
    """Format TOC as human-readable indented text."""
    lines: list[str] = []

    def _format(entries: list[dict], indent: int = 0):
        prefix = "  " * indent
        for entry in entries:
            label = entry["concept_id"]
            tag = f"[{entry['level']}]"
            lines.append(f"{prefix}{tag} {label}")
            if entry.get("children"):
                _format(entry["children"], indent + 1)

    _format(toc)
    return "\n".join(lines)


def get_flat_toc(toc: list[dict]) -> list[dict]:
    """Flatten hierarchical TOC into a list with level annotations."""
    flat: list[dict] = []

    def _flatten(entries: list[dict]):
        for entry in entries:
            flat.append({
                "concept_id": entry["concept_id"],
                "depth": entry["depth"],
                "level": entry["level"],
            })
            if entry.get("children"):
                _flatten(entry["children"])

    _flatten(toc)
    return flat
