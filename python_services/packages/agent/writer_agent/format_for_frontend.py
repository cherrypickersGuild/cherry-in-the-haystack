import argparse
import json
from pathlib import Path
from typing import Any, Dict, List


def normalize_text(value: str) -> str:
    return " ".join(value.strip().split())


def excerpt_text(value: str, limit: int = 240) -> str:
    normalized = normalize_text(value)
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 3].rstrip() + "..."


def build_evidence_cards(evidence_rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    cards = []
    for row in evidence_rows:
        body = row.get("body_text") or ""
        title = row.get("book_title") or "Evidence"
        cards.append(
            {
                "title": title,
                "excerpt": excerpt_text(body),
                "source": {
                    "book_title": row.get("book_title"),
                    "book_author": row.get("book_author"),
                    "page_number": row.get("page_number"),
                    "chapter_id": row.get("chapter_id"),
                    "section_id": row.get("section_id"),
                    "chunk_id": row.get("chunk_id"),
                },
            }
        )
    return cards


def build_related_cards(related_concepts: List[str]) -> List[Dict[str, str]]:
    return [{"label": label} for label in related_concepts]


def build_reference_cards(references: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    cards = []
    for ref in references:
        cards.append(
            {
                "source": ref.get("source"),
                "author": ref.get("author"),
                "snippets": ref.get("snippets", []),
            }
        )
    return cards


def build_page_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "topic": data.get("topic"),
        "summary": data.get("summary"),
        "why_it_matters": data.get("why_it_matters"),
        "evidence_cards": build_evidence_cards(data.get("evidence", [])),
        "related_cards": build_related_cards(data.get("related_concepts", [])),
        "reference_cards": build_reference_cards(data.get("references", [])),
    }


def build_patch_notes_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    patch_notes = data.get("patch_notes", [])
    if isinstance(patch_notes, str):
        patch_notes = [patch_notes]
    return {
        "topic": data.get("topic"),
        "updates": data.get("updates", []),
        "patch_notes": patch_notes,
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
